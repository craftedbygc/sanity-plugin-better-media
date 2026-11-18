/** The asset document types the library manages */
export const IMAGE_ASSET = 'sanity.imageAsset'
export const FILE_ASSET = 'sanity.fileAsset'
/** Categories. Same type and shape as sanity-plugin-media's tags, so existing data carries over */
export const TAG_TYPE = 'media.tag'

export type AssetKind = 'image' | 'file'

/** What the sidebar is showing */
export type View = 'all' | 'images' | 'files' | 'missingAlt' | 'unused'

export type Sort = 'newest' | 'oldest' | 'name' | 'largest'

export type Layout = 'grid' | 'list'

export type Orientation = 'landscape' | 'portrait' | 'square'

export type Uploaded = 'week' | 'month' | 'older'

export interface Filters {
  view: View
  search: string
  sort: Sort
  /** Categories (`_id`s): assets in any of them, or in all of them with `tagMatch: 'all'` */
  tagIds: string[]
  tagMatch: 'any' | 'all'
  /** Only assets with no category. Excludes `tagIds` */
  untagged: boolean
  /** MIME types, e.g. `image/png`. Any of them */
  mimeTypes: string[]
  orientation?: Orientation
  /** Bytes: only files larger than this */
  minSize?: number
  uploaded?: Uploaded
}

export const EMPTY_FILTERS: Filters = {
  view: 'all',
  search: '',
  sort: 'newest',
  tagIds: [],
  tagMatch: 'any',
  untagged: false,
  mimeTypes: [],
}

/** How many filters from the Filter menu are on (the view, search and sort aren't counted) */
export function countActiveFilters(filters: Filters) {
  return (
    (filters.tagIds.length || filters.untagged ? 1 : 0) +
    (filters.mimeTypes.length ? 1 : 0) +
    (filters.orientation ? 1 : 0) +
    (filters.minSize ? 1 : 0) +
    (filters.uploaded ? 1 : 0)
  )
}

export interface MediaAsset {
  _id: string
  _type: typeof IMAGE_ASSET | typeof FILE_ASSET
  _createdAt: string
  _updatedAt: string
  url: string
  originalFilename?: string
  title?: string
  altText?: string
  description?: string
  mimeType?: string
  extension?: string
  size?: number
  dimensions?: {width: number; height: number; aspectRatio: number}
  lqip?: string
  /** `_id`s of the asset's categories */
  tagIds: string[]
}

export interface MediaTag {
  _id: string
  name: string
  count: number
}

export interface Counts {
  all: number
  images: number
  files: number
  missingAlt: number
  unused: number
  tags: MediaTag[]
  /** The MIME types in the library, for the type filter */
  mimeTypes: string[]
}
