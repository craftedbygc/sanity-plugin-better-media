import {useCallback, useEffect, useRef, useState} from 'react'
import {useClient} from 'sanity'

import {
  FILE_ASSET,
  IMAGE_ASSET,
  TAG_TYPE,
  type AssetKind,
  type Counts,
  type Filters,
  type MediaAsset,
} from '../types'
import {toError} from './format'
import {API_VERSION, PAGE_SIZE, buildAssetQuery, buildCountsQuery} from './queries'

// Wait for a burst of mutations (a bulk edit, a multi-file upload) to settle before refetching
const REFRESH_DELAY = 300
// How long to give the query API to include documents that have just been created
const SETTLE_DELAY = 1500

const EMPTY_COUNTS: Counts = {
  all: 0,
  images: 0,
  files: 0,
  missingAlt: 0,
  unused: 0,
  tags: [],
  mimeTypes: [],
}

interface Page {
  items: MediaAsset[]
  total: number
}

/** The list as last fetched, and which filters it was fetched for */
interface List extends Page {
  key: string
  error: Error | null
}

export function useMediaClient() {
  return useClient({apiVersion: API_VERSION})
}

/**
 * The assets matching the filters, a page at a time, plus the sidebar counts. Both follow changes made anywhere
 * (this browser, another tab, another editor) through a listener.
 */
export function useMediaLibrary(filters: Filters, kind?: AssetKind) {
  const client = useMediaClient()

  // Filters arrive as a new object on every change; keep one per distinct value, so fetches rerun only on a real change
  const [stableFilters, setStableFilters] = useState(filters)
  if (JSON.stringify(filters) !== JSON.stringify(stableFilters)) setStableFilters(filters)
  const key = `${kind ?? 'any'}:${JSON.stringify(stableFilters)}`

  const [list, setList] = useState<List | null>(null)
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  // Bumped by the listener (and `refresh`): refetch what's showing
  const [version, setVersion] = useState(0)

  // How many assets are loaded for which filters, so a refetch keeps the pages already scrolled through
  const loaded = useRef({key, count: 0})
  const currentKey = useRef(key)

  useEffect(() => {
    currentKey.current = key
    if (loaded.current.key !== key) loaded.current = {key, count: 0}

    let cancelled = false
    const {query, params} = buildAssetQuery(stableFilters, kind)
    const end = Math.max(loaded.current.count, PAGE_SIZE)

    async function load() {
      try {
        const page = await client.fetch<Page>(query, {...params, start: 0, end})
        if (cancelled) return
        loaded.current = {key, count: page.items.length}
        setList({key, ...page, error: null})
      } catch (error) {
        if (cancelled) return
        setList((previous) => ({
          key,
          items: previous?.key === key ? previous.items : [],
          total: previous?.key === key ? previous.total : 0,
          error: toError(error),
        }))
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [client, key, kind, stableFilters, version])

  useEffect(() => {
    let cancelled = false
    const {query, params} = buildCountsQuery(kind)

    async function load() {
      try {
        const next = await client.fetch<Counts>(query, params)
        if (!cancelled) setCounts(next)
      } catch {
        // The counts are a guide; the list still works without them
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [client, kind, version])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const subscription = client
      .listen(
        `*[_type in $types]`,
        {types: [IMAGE_ASSET, FILE_ASSET, TAG_TYPE]},
        {includeResult: false, visibility: 'query', events: ['mutation']},
      )
      .subscribe(() => {
        clearTimeout(timer)
        timer = setTimeout(() => setVersion((previous) => previous + 1), REFRESH_DELAY)
      })

    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [client])

  const isCurrent = list?.key === key

  const loadMore = useCallback(async () => {
    if (!list || list.key !== key || isLoadingMore || list.items.length >= list.total) return
    setIsLoadingMore(true)
    const {query, params} = buildAssetQuery(stableFilters, kind)
    const start = list.items.length

    try {
      const page = await client.fetch<Page>(query, {...params, start, end: start + PAGE_SIZE})
      // The filters changed while this page loaded: it belongs to a list that's gone
      if (currentKey.current !== key) return
      setList((previous) => {
        if (previous?.key !== key) return previous
        const items = [
          ...previous.items,
          ...page.items.filter((item) => !previous.items.some((asset) => asset._id === item._id)),
        ]
        loaded.current = {key, count: items.length}
        return {...previous, items, total: page.total}
      })
    } catch {
      // The next scroll tries again
    } finally {
      setIsLoadingMore(false)
    }
  }, [client, isLoadingMore, key, kind, list, stableFilters])

  const refresh = useCallback(() => setVersion((previous) => previous + 1), [])

  // Sanity's query API can take a moment to include a document it has just created, so a refetch right after an
  // upload can miss it. Refetch again once it has caught up
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const refreshSoon = useCallback(() => {
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(refresh, SETTLE_DELAY)
  }, [refresh])
  useEffect(() => () => clearTimeout(settleTimer.current), [])

  /** Puts just-uploaded assets at the top of the list now, before a refetch can include them */
  const showNew = useCallback(
    (items: MediaAsset[]) => {
      setList((previous) => {
        if (previous?.key !== key) return previous
        const added = items.filter(
          (item) => !previous.items.some((asset) => asset._id === item._id),
        )
        if (!added.length) return previous
        return {
          ...previous,
          items: [...added, ...previous.items],
          total: previous.total + added.length,
        }
      })
      refreshSoon()
    },
    [key, refreshSoon],
  )

  return {
    // The previous list stays up while the next one loads, with the spinner showing
    assets: list?.items ?? [],
    total: list?.total ?? 0,
    counts,
    isLoading: !isCurrent || isLoadingMore,
    error: isCurrent ? list.error : null,
    loadMore,
    refresh,
    refreshSoon,
    showNew,
  }
}
