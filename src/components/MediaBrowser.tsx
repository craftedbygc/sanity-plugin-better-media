import {ImagesIcon, UploadIcon} from '@sanity/icons'
import {Box, Button, Card, Flex, Spinner, Stack, Text, useToast} from '@sanity/ui'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import type {SanityDocument} from 'sanity'
import {styled} from 'styled-components'

import {createTag, deleteAssets, deleteTag, renameTag, toMediaAsset} from '../lib/assets'
import {errorMessage} from '../lib/format'
import {UNUSED_ASSET_IDS, assetTypes} from '../lib/queries'
import {useMediaClient, useMediaLibrary} from '../lib/useMediaLibrary'
import {
  EMPTY_FILTERS,
  countActiveFilters,
  type AssetKind,
  type Filters,
  type Layout,
  type MediaAsset,
  type MediaTag,
} from '../types'
import {AssetDetail} from './AssetDetail'
import {AssetResults} from './AssetResults'
import {BulkBar} from './BulkBar'
import {ConfirmDialog} from './dialogs'
import {ActiveFilters, FilterMenu} from './Filters'
import {Sidebar} from './Sidebar'
import {Toolbar} from './Toolbar'
import {UploadProgress, useUploads} from './Uploads'

const SEARCH_DELAY = 250
// Remembered per mode: the picker usually wants the grid even if the tool is in list view
const layoutKey = (mode: string) => `sanity-plugin-better-media:layout:${mode}`

function readLayout(mode: string): Layout {
  try {
    return localStorage.getItem(layoutKey(mode)) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

/**
 * Sized by its own width, not the window's: the picker opens inside a document pane, which can be narrow.
 * The sidebar slims then hides, and list columns drop out, as space runs out.
 */
const Root = styled(Flex)`
  container: better-media / inline-size;

  @container better-media (max-width: 960px) {
    [data-media-col='date'] {
      display: none;
    }
  }

  @container better-media (max-width: 800px) {
    [data-media-sidebar] {
      width: 196px !important;
    }
    [data-media-col='kind'] {
      display: none;
    }
  }

  @container better-media (max-width: 600px) {
    [data-media-sidebar] {
      display: none;
    }
  }
`

/**
 * Whether a just-uploaded asset belongs at the top of the list as it's filtered and sorted now. Only for the cases
 * this can tell for sure; anything else waits for the refetch
 */
function fitsList(asset: MediaAsset, filters: Filters, kind?: AssetKind) {
  const image = asset._type === 'sanity.imageAsset'
  if (filters.sort !== 'newest' || filters.search.trim()) return false
  if (filters.orientation || filters.minSize || filters.uploaded === 'older') return false
  if (kind && (kind === 'image') !== image) return false
  if ((filters.view === 'images' || filters.view === 'missingAlt') && !image) return false
  if (filters.view === 'files' && image) return false
  if (filters.view === 'missingAlt' && asset.altText) return false
  if (filters.mimeTypes.length && !filters.mimeTypes.includes(asset.mimeType ?? '')) return false
  if (filters.untagged && asset.tagIds.length) return false
  if (filters.tagIds.length) {
    const has = (id: string) => asset.tagIds.includes(id)
    if (filters.tagMatch === 'all' ? !filters.tagIds.every(has) : !filters.tagIds.some(has))
      return false
  }
  return true
}

export interface MediaBrowserProps {
  /** `tool`: manage the library. `select`: pick an asset for a field */
  mode: 'tool' | 'select'
  /** Select mode: the field takes images or files */
  kind?: AssetKind
  accept?: string
  /** Select mode: the field's current asset, highlighted */
  currentAssetId?: string
  onSelect?: (asset: {_id: string}) => void
}

export function MediaBrowser({mode, kind, accept, currentAssetId, onSelect}: MediaBrowserProps) {
  const client = useMediaClient()
  const toast = useToast()
  const isTool = mode === 'tool'

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [searchInput, setSearchInput] = useState('')
  const [layout, setLayout] = useState<Layout>(() => readLayout(mode))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // The asset open in the panel, as last seen. It stays open even when an edit moves it out of the filtered list
  const [openSnapshot, setOpenAsset] = useState<MediaAsset | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isConfirmingCleanup, setIsConfirmingCleanup] = useState(false)
  const dragDepth = useRef(0)
  const lastClicked = useRef<number | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  const {assets, total, counts, isLoading, error, loadMore, refresh, refreshSoon, showNew} =
    useMediaLibrary(filters, kind)

  // With exactly one category showing, uploads go into it
  const activeTag =
    filters.tagIds.length === 1 && !filters.untagged
      ? counts.tags.find((tag) => tag._id === filters.tagIds[0])
      : undefined
  const isFiltered = Boolean(
    filters.search || filters.view !== 'all' || countActiveFilters(filters),
  )

  // Search as you type, without a query per keystroke
  useEffect(() => {
    const timeout = setTimeout(
      () => setFilters((previous) => ({...previous, search: searchInput})),
      SEARCH_DELAY,
    )
    return () => clearTimeout(timeout)
  }, [searchInput])

  const changeFilters = (change: Partial<Filters>) => {
    setFilters((previous) => ({...previous, ...change}))
    setSelectedIds(new Set())
    lastClicked.current = null
    scroller.current?.scrollTo({top: 0})
  }

  const changeLayout = (next: Layout) => {
    setLayout(next)
    try {
      localStorage.setItem(layoutKey(mode), next)
    } catch {
      // Not remembered, that's all
    }
  }

  // The freshest copy of the open asset: from the list when it's there (the listener refetches it after edits)
  const openAsset = openSnapshot
    ? (assets.find((asset) => asset._id === openSnapshot._id) ?? openSnapshot)
    : null

  // Load the next page when the end of the list scrolls into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      {root: scroller.current, rootMargin: '400px'},
    )
    if (sentinel.current) observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [loadMore])

  // Uploads

  const onUploaded = useCallback(
    (document: SanityDocument, tagIds: string[]) => {
      // Show it now: a refetch straight after an upload can come back without it. Where it can't be placed
      // correctly (another sort, or filters this can't check), wait for the refetch instead
      const asset = toMediaAsset(document, tagIds)
      if (asset && fitsList(asset, filters, kind)) showNew([asset])
      else refreshSoon()
      // Picking for a field and uploading one file: that's the one they want
      if (!isTool && onSelect) onSelect(document)
    },
    [filters, isTool, kind, onSelect, refreshSoon, showNew],
  )
  const {uploads, start: startUploads} = useUploads(kind, onUploaded)
  const upload = (files: File[]) => {
    if (!files.length) return
    startUploads(isTool ? files : files.slice(0, 1), activeTag?._id)
  }

  const dragHandlers = {
    onDragEnter: (event: DragEvent) => {
      if (!event.dataTransfer.types.includes('Files')) return
      dragDepth.current++
      setIsDragging(true)
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (!dragDepth.current) setIsDragging(false)
    },
    onDragOver: (event: DragEvent) => event.preventDefault(),
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      dragDepth.current = 0
      setIsDragging(false)
      upload(Array.from(event.dataTransfer.files))
    },
  }

  // Selection

  const toggle = (asset: MediaAsset, event: {shiftKey: boolean}) => {
    const index = assets.findIndex((item) => item._id === asset._id)
    setSelectedIds((previous) => {
      const next = new Set(previous)
      // Shift-click selects the run since the last click
      if (event.shiftKey && lastClicked.current !== null) {
        const [from, to] = [lastClicked.current, index].sort((a, b) => a - b)
        for (const item of assets.slice(from, to + 1)) next.add(item._id)
      } else if (next.has(asset._id)) {
        next.delete(asset._id)
      } else {
        next.add(asset._id)
      }
      return next
    })
    lastClicked.current = index
  }

  const open = (asset: MediaAsset, event: MouseEvent | KeyboardEvent) => {
    if (!isTool) {
      onSelect?.(asset)
      return
    }
    // While selecting, or with a modifier, a click adds to the selection instead of opening
    if (selectedIds.size > 0 || event.metaKey || event.ctrlKey || event.shiftKey) {
      toggle(asset, event)
      return
    }
    setOpenAsset(openAsset?._id === asset._id ? null : asset)
  }

  const selected = useMemo(
    () => assets.filter((asset) => selectedIds.has(asset._id)),
    [assets, selectedIds],
  )
  const highlighted = useMemo(
    () => (isTool ? selectedIds : new Set(currentAssetId ? [currentAssetId] : [])),
    [isTool, selectedIds, currentAssetId],
  )

  // Categories

  const onCreateTag = async (name: string) => {
    try {
      return await createTag(client, name)
    } catch (err) {
      toast.push({
        status: 'error',
        title: 'Couldn’t create the category',
        description: errorMessage(err),
      })
      throw err
    }
  }

  const onRenameTag = async (tag: MediaTag, name: string) => {
    await renameTag(client, tag._id, name)
    toast.push({status: 'success', title: `Renamed to ${name}`})
  }

  const onDeleteTag = async (tag: MediaTag) => {
    await deleteTag(client, tag._id)
    if (filters.tagIds.includes(tag._id))
      changeFilters({tagIds: filters.tagIds.filter((id) => id !== tag._id)})
    toast.push({status: 'success', title: `Deleted ${tag.name}`})
  }

  // Cleanup

  const deleteUnused = async () => {
    const ids = await client.fetch<string[]>(UNUSED_ASSET_IDS, {
      types: assetTypes({...filters, view: 'all'}, kind),
    })
    const {deleted, failed} = await deleteAssets(client, ids)
    toast.push({
      status: failed.length ? 'warning' : 'success',
      title: `Deleted ${deleted.length} unused asset${deleted.length === 1 ? '' : 's'}`,
      description: failed.length ? `${failed.length} couldn’t be deleted.` : undefined,
    })
  }

  return (
    <Root height="fill" style={{minHeight: 0, position: 'relative'}}>
      <Sidebar
        filters={filters}
        counts={counts}
        kind={kind}
        canManage={isTool}
        onChange={changeFilters}
        onCreateTag={onCreateTag}
        onRenameTag={onRenameTag}
        onDeleteTag={onDeleteTag}
      />

      <Flex
        direction="column"
        flex={1}
        style={{minWidth: 0, position: 'relative'}}
        {...dragHandlers}
      >
        <Toolbar
          search={searchInput}
          sort={filters.sort}
          layout={layout}
          total={total}
          accept={accept}
          onSearch={setSearchInput}
          onSort={(sort) => changeFilters({sort})}
          onLayout={changeLayout}
          onUpload={upload}
          filterMenu={
            <FilterMenu
              filters={filters}
              tags={counts.tags}
              mimeTypes={counts.mimeTypes}
              kind={kind}
              onChange={changeFilters}
            />
          }
        />
        <ActiveFilters filters={filters} tags={counts.tags} onChange={changeFilters} />

        <Box ref={scroller} flex={1} style={{overflowY: 'auto', minHeight: 0}}>
          <Stack gap={4} padding={4} paddingBottom={selected.length ? 9 : 4}>
            {activeTag && (
              <Text size={1} muted>
                In <strong>{activeTag.name}</strong>
                {isTool && '. Uploads go into this category.'}
              </Text>
            )}

            {filters.view === 'missingAlt' && counts.missingAlt > 0 && (
              <Card tone="caution" radius={3} padding={3} border>
                <Text size={1}>
                  These images have no alt text, so screen readers can’t describe them.{' '}
                  {isTool ? 'Open one to add it.' : ''}
                </Text>
              </Card>
            )}

            {filters.view === 'unused' && isTool && counts.unused > 0 && (
              <Card tone="caution" radius={3} padding={3} border>
                <Flex align="center" gap={3} wrap="wrap">
                  <Box flex={1} style={{minWidth: 200}}>
                    <Text size={1}>
                      No document uses these, drafts included. Delete them to tidy the library.
                    </Text>
                  </Box>
                  <Button
                    tone="critical"
                    mode="ghost"
                    fontSize={1}
                    text={`Delete all ${counts.unused} unused`}
                    onClick={() => setIsConfirmingCleanup(true)}
                  />
                </Flex>
              </Card>
            )}

            {error && (
              <Card tone="critical" radius={3} padding={3} border>
                <Text size={1}>Couldn’t load the library: {error.message}</Text>
              </Card>
            )}

            {assets.length > 0 && (
              <AssetResults
                assets={assets}
                layout={layout}
                selectedIds={highlighted}
                selectable={isTool}
                activeId={openAsset?._id}
                onOpen={open}
                onToggle={toggle}
              />
            )}

            {!isLoading && !error && assets.length === 0 && (
              <Flex align="center" justify="center" paddingY={9}>
                <Stack gap={4} style={{textAlign: 'center', maxWidth: 320}}>
                  <Text size={4} muted>
                    <ImagesIcon />
                  </Text>
                  <Text size={2} weight="semibold">
                    {isFiltered ? 'Nothing matches' : 'No media yet'}
                  </Text>
                  <Text size={1} muted>
                    {isFiltered
                      ? filters.view === 'missingAlt'
                        ? 'Every image has alt text.'
                        : filters.view === 'unused'
                          ? 'Everything in the library is in use.'
                          : 'Try another search, or remove a filter.'
                      : 'Drop files here or use Upload to add some.'}
                  </Text>
                </Stack>
              </Flex>
            )}

            <div ref={sentinel} />

            {isLoading && (
              <Flex justify="center" padding={4}>
                <Spinner muted />
              </Flex>
            )}
          </Stack>
        </Box>

        {isTool && selected.length > 0 && (
          <Flex
            justify="center"
            style={{position: 'absolute', left: 16, right: 16, bottom: 16, pointerEvents: 'none'}}
          >
            <Box style={{pointerEvents: 'auto'}}>
              <BulkBar
                selected={selected}
                tags={counts.tags}
                canSelectMore={selected.length < assets.length}
                onSelectAll={() => setSelectedIds(new Set(assets.map((asset) => asset._id)))}
                onClear={() => setSelectedIds(new Set())}
                onCreateTag={onCreateTag}
              />
            </Box>
          </Flex>
        )}

        {uploads.length > 0 && (
          <Box
            style={{position: 'absolute', right: 16, bottom: selected.length ? 80 : 16, zIndex: 2}}
          >
            <UploadProgress uploads={uploads} />
          </Box>
        )}

        {isDragging && (
          <Card
            tone="primary"
            radius={3}
            border
            style={{
              position: 'absolute',
              inset: 8,
              borderStyle: 'dashed',
              borderWidth: 2,
              zIndex: 3,
              pointerEvents: 'none',
              opacity: 0.95,
            }}
          >
            <Flex align="center" justify="center" height="fill">
              <Stack gap={3} style={{textAlign: 'center'}}>
                <Text size={4}>
                  <UploadIcon />
                </Text>
                <Text size={2} weight="semibold">
                  Drop to upload{activeTag ? ` to ${activeTag.name}` : ''}
                </Text>
              </Stack>
            </Flex>
          </Card>
        )}
      </Flex>

      {isTool && openAsset && (
        <AssetDetail
          key={openAsset._id}
          asset={openAsset}
          tags={counts.tags}
          onClose={() => setOpenAsset(null)}
          onCreateTag={onCreateTag}
          onGone={() => {
            setOpenAsset(null)
            // A replace adds a new asset, which (like an upload) the query API may not include yet
            refresh()
            refreshSoon()
          }}
        />
      )}

      {isConfirmingCleanup && (
        <ConfirmDialog
          title={`Delete ${counts.unused} unused asset${counts.unused === 1 ? '' : 's'}?`}
          confirmText="Delete all"
          onConfirm={deleteUnused}
          onClose={() => setIsConfirmingCleanup(false)}
        >
          Nothing uses them, so no page changes, but their URLs stop working. This can’t be undone.
        </ConfirmDialog>
      )}
    </Root>
  )
}
