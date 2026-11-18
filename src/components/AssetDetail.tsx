import {
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  LaunchIcon,
  SyncIcon,
  TagIcon,
  TrashIcon,
} from '@sanity/icons'
import {
  Box,
  Button,
  Card,
  Flex,
  Label,
  Stack,
  Text,
  TextArea,
  TextInput,
  Tooltip,
  useToast,
} from '@sanity/ui'
import {useState, type ReactNode} from 'react'
import {styled} from 'styled-components'

import {deleteAssets, setAssetTags, updateAssetFields, type AssetFields} from '../lib/assets'
import {assetName, errorMessage, formatBytes, formatDate, formatKind, isImage} from '../lib/format'
import {useMediaClient} from '../lib/useMediaLibrary'
import type {MediaAsset, MediaTag} from '../types'
import {AssetThumb} from './AssetThumb'
import {CategoryPicker} from './CategoryPicker'
import {ConfirmDialog} from './dialogs'
import {ReplaceDialog} from './ReplaceDialog'
import {UsedIn, useUsingDocuments} from './UsedIn'

const FIELD_NAMES = [
  'title',
  'altText',
  'description',
] as const satisfies readonly (keyof AssetFields)[]

const fieldsOf = (asset: MediaAsset): AssetFields => ({
  title: asset.title ?? '',
  altText: asset.altText ?? '',
  description: asset.description ?? '',
})

function Field({label, hint, children}: {label: string; hint?: string; children: ReactNode}) {
  return (
    <Stack gap={2}>
      <Text size={1} weight="medium">
        {label}
      </Text>
      {hint && (
        <Text size={1} muted>
          {hint}
        </Text>
      )}
      {children}
    </Stack>
  )
}

function Meta({label, value}: {label: string; value: string}) {
  return (
    <Flex gap={3}>
      <Box style={{width: 88, flex: 'none'}}>
        <Text size={1} muted>
          {label}
        </Text>
      </Box>
      <Box flex={1} style={{minWidth: 0}}>
        <Text size={1} textOverflow="ellipsis" title={value}>
          {value}
        </Text>
      </Box>
    </Flex>
  )
}

/** Beside the results on wide screens; over them, from the right, on narrower ones */
const Panel = styled(Card)`
  width: 400px;
  flex: none;

  @media (max-width: 1199px) {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 4;
    max-width: 100%;
    box-shadow: -12px 0 32px -16px rgba(0, 0, 0, 0.45);
  }
`

/** The side panel for one asset: preview, fields, categories, details and where it's used */
export function AssetDetail(props: {
  asset: MediaAsset
  tags: MediaTag[]
  onClose: () => void
  onCreateTag: (name: string) => Promise<MediaTag>
  /** After a delete or replace, so the browser can move on */
  onGone: (replacedBy?: string) => void
}) {
  const {asset, tags} = props
  const client = useMediaClient()
  const toast = useToast()
  const usingDocuments = useUsingDocuments(asset._id)
  const [fields, setFields] = useState(() => fieldsOf(asset))
  const [isSaving, setIsSaving] = useState(false)
  const [dialog, setDialog] = useState<'delete' | 'replace' | null>(null)

  const saved = fieldsOf(asset)
  const isDirty = FIELD_NAMES.some((key) => fields[key].trim() !== saved[key])

  // Categories change on screen straight away; the listener's refetch then confirms them
  const [tagIds, setTagIds] = useState(asset.tagIds)
  const [createdTags, setCreatedTags] = useState<MediaTag[]>([])

  // Changed elsewhere (another editor, the alt row under a field): show the new values, keeping unsaved edits.
  // Done while rendering, React's pattern for adjusting state to a prop. A new asset remounts this panel (it's keyed)
  const [syncedAt, setSyncedAt] = useState(asset._updatedAt)
  if (asset._updatedAt !== syncedAt) {
    setSyncedAt(asset._updatedAt)
    setTagIds(asset.tagIds)
    if (!isDirty) setFields(fieldsOf(asset))
  }

  const save = async () => {
    setIsSaving(true)
    try {
      await updateAssetFields(client, asset._id, fields)
      toast.push({status: 'success', title: 'Saved'})
    } catch (error) {
      toast.push({status: 'error', title: 'Couldn’t save', description: errorMessage(error)})
    } finally {
      setIsSaving(false)
    }
  }

  const allTags = [
    ...tags,
    ...createdTags.filter((created) => !tags.some((tag) => tag._id === created._id)),
  ]

  const createTag = async (name: string) => {
    const tag = await props.onCreateTag(name)
    setCreatedTags((previous) => [...previous, tag])
    return tag
  }

  const toggleTag = async (tag: MediaTag, add: boolean) => {
    const previous = tagIds
    const next = [...new Set(add ? [...tagIds, tag._id] : tagIds.filter((id) => id !== tag._id))]
    setTagIds(next)
    try {
      await setAssetTags(client, asset._id, next)
    } catch (error) {
      setTagIds(previous)
      toast.push({
        status: 'error',
        title: 'Couldn’t update categories',
        description: errorMessage(error),
      })
    }
  }

  const remove = async () => {
    const {deleted} = await deleteAssets(client, [asset._id])
    if (deleted.length) {
      toast.push({status: 'success', title: `Deleted ${assetName(asset)}`})
      props.onGone()
    } else {
      toast.push({
        status: 'error',
        title: 'Couldn’t delete',
        description: 'It’s probably still used by a document.',
      })
    }
  }

  const copyUrl = async () => {
    await navigator.clipboard.writeText(asset.url)
    toast.push({status: 'success', title: 'URL copied'})
  }

  const assetTags = allTags.filter((tag) => tagIds.includes(tag._id))
  const usedCount = usingDocuments?.length ?? 0
  const image = isImage(asset)

  return (
    <Panel borderLeft height="fill" style={{display: 'flex', flexDirection: 'column'}}>
      <Card borderBottom paddingX={3} paddingY={2}>
        <Flex align="center" gap={2}>
          <Box flex={1} style={{minWidth: 0}}>
            <Text size={1} weight="semibold" textOverflow="ellipsis">
              {assetName(asset)}
            </Text>
          </Box>
          <Button
            icon={CloseIcon}
            mode="bleed"
            fontSize={1}
            padding={2}
            aria-label="Close"
            onClick={props.onClose}
          />
        </Flex>
      </Card>

      <Box flex={1} style={{overflowY: 'auto', minHeight: 0}}>
        <Stack gap={5} padding={4}>
          <Stack gap={2}>
            <Card radius={3} overflow="hidden" border style={{height: image ? 260 : 160}}>
              <AssetThumb asset={asset} size={400} iconSize={3} />
            </Card>
            <Flex gap={1} wrap="wrap">
              <Button
                icon={CopyIcon}
                mode="bleed"
                fontSize={1}
                padding={2}
                text="Copy URL"
                onClick={copyUrl}
              />
              <Button
                as="a"
                href={`${asset.url}?dl=`}
                icon={DownloadIcon}
                mode="bleed"
                fontSize={1}
                padding={2}
                text="Download"
              />
              <Button
                as="a"
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                icon={LaunchIcon}
                mode="bleed"
                fontSize={1}
                padding={2}
                aria-label="Open original"
                title="Open original"
              />
            </Flex>
          </Stack>

          <Stack gap={4}>
            <Field label="Title">
              <TextInput
                fontSize={1}
                value={fields.title}
                placeholder={asset.originalFilename}
                onChange={(event) => setFields({...fields, title: event.currentTarget.value})}
              />
            </Field>

            {image && (
              <Field
                label="Alt text"
                hint="Read by screen readers and search engines. Empty means decorative."
              >
                <TextArea
                  fontSize={1}
                  rows={2}
                  value={fields.altText}
                  placeholder="Describe what the image shows"
                  onChange={(event) => setFields({...fields, altText: event.currentTarget.value})}
                />
              </Field>
            )}

            <Field label="Description" hint="Notes for editors. Not shown on the site.">
              <TextArea
                fontSize={1}
                rows={2}
                value={fields.description}
                onChange={(event) => setFields({...fields, description: event.currentTarget.value})}
              />
            </Field>

            <Flex gap={2} justify="flex-end">
              {isDirty && (
                <Button
                  mode="bleed"
                  fontSize={1}
                  text="Reset"
                  onClick={() => setFields(saved)}
                  disabled={isSaving}
                />
              )}
              <Button
                tone="primary"
                fontSize={1}
                text="Save"
                onClick={save}
                disabled={!isDirty}
                loading={isSaving}
              />
            </Flex>
          </Stack>

          <Stack gap={3}>
            <Label size={0} muted>
              Categories
            </Label>
            <Flex gap={2} wrap="wrap" align="center">
              {assetTags.map((tag) => (
                <Button
                  key={tag._id}
                  mode="ghost"
                  fontSize={1}
                  padding={2}
                  icon={TagIcon}
                  iconRight={CloseIcon}
                  text={tag.name}
                  title={`Remove from ${tag.name}`}
                  onClick={() => toggleTag(tag, false)}
                />
              ))}
              <CategoryPicker
                tags={allTags}
                stateOf={(id) => (tagIds.includes(id) ? 'on' : 'off')}
                onToggle={toggleTag}
                onCreate={createTag}
                buttonProps={{
                  mode: 'bleed',
                  fontSize: 1,
                  padding: 2,
                  text: assetTags.length ? 'Edit' : 'Add to category',
                }}
              />
            </Flex>
          </Stack>

          <Stack gap={3}>
            <Label size={0} muted>
              Used in {usingDocuments ? `(${usedCount})` : ''}
            </Label>
            <UsedIn documents={usingDocuments} />
          </Stack>

          <Stack gap={3}>
            <Label size={0} muted>
              Details
            </Label>
            <Stack gap={3}>
              {asset.originalFilename && <Meta label="File name" value={asset.originalFilename} />}
              <Meta label={image ? 'Dimensions' : 'Type'} value={formatKind(asset)} />
              <Meta label="Size" value={formatBytes(asset.size)} />
              {asset.mimeType && <Meta label="MIME type" value={asset.mimeType} />}
              <Meta label="Uploaded" value={formatDate(asset._createdAt)} />
            </Stack>
          </Stack>
        </Stack>
      </Box>

      <Card borderTop paddingX={3} paddingY={2}>
        <Flex gap={2}>
          <Button
            icon={SyncIcon}
            mode="ghost"
            fontSize={1}
            text="Replace file"
            onClick={() => setDialog('replace')}
          />
          <Box flex={1} />
          <Tooltip
            portal
            disabled={!usedCount}
            content={
              <Box padding={2}>
                <Text size={1}>
                  Used in {usedCount} document{usedCount === 1 ? '' : 's'}. Remove it there first.
                </Text>
              </Box>
            }
          >
            <Box>
              <Button
                icon={TrashIcon}
                mode="bleed"
                tone="critical"
                fontSize={1}
                text="Delete"
                disabled={!usingDocuments || usedCount > 0}
                onClick={() => setDialog('delete')}
              />
            </Box>
          </Tooltip>
        </Flex>
      </Card>

      {dialog === 'delete' && (
        <ConfirmDialog
          title={`Delete ${assetName(asset)}?`}
          confirmText="Delete"
          onConfirm={remove}
          onClose={() => setDialog(null)}
        >
          The file is removed from the library and its URL stops working. This can’t be undone.
        </ConfirmDialog>
      )}

      {dialog === 'replace' && (
        <ReplaceDialog
          asset={asset}
          usedCount={usedCount}
          onClose={() => setDialog(null)}
          onReplaced={(id) => props.onGone(id)}
        />
      )}
    </Panel>
  )
}
