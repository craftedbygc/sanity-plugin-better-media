import {FILE_ASSET, IMAGE_ASSET, TAG_TYPE, type AssetKind, type Filters, type Sort} from '../types'

export const API_VERSION = '2026-02-04'

/** Assets per page; more load as the list scrolls */
export const PAGE_SIZE = 60

const ASSET_PROJECTION = `{
	_id,
	_type,
	_createdAt,
	_updatedAt,
	url,
	originalFilename,
	title,
	altText,
	description,
	mimeType,
	extension,
	size,
	"dimensions": metadata.dimensions,
	"lqip": metadata.lqip,
	"tagIds": coalesce(opt.media.tags[]._ref, [])
}`

const ORDER: Record<Sort, string> = {
  newest: '_createdAt desc',
  oldest: '_createdAt asc',
  name: 'lower(coalesce(title, originalFilename)) asc',
  largest: 'size desc',
}

const HAS_NO_ALT = '_type == "sanity.imageAsset" && (!defined(altText) || altText == "")'
const IS_UNUSED = 'count(*[references(^._id)]) == 0'

/** The asset types to list: fixed by the field in select mode, otherwise from the view */
export function assetTypes(filters: Filters, kind?: AssetKind): string[] {
  if (kind === 'image') return [IMAGE_ASSET]
  if (kind === 'file') return [FILE_ASSET]
  if (filters.view === 'images' || filters.view === 'missingAlt') return [IMAGE_ASSET]
  if (filters.view === 'files') return [FILE_ASSET]
  return [IMAGE_ASSET, FILE_ASSET]
}

/** Each search word must match the start of a word in the name, title, alt or description */
function searchTerms(search: string): string[] {
  return search
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.replace(/[*"\\]/g, '')}*`)
}

export function buildAssetQuery(filters: Filters, kind?: AssetKind) {
  const conditions = ['_type in $types']
  const params: Record<string, unknown> = {types: assetTypes(filters, kind)}

  if (filters.view === 'missingAlt') conditions.push(`(${HAS_NO_ALT})`)
  if (filters.view === 'unused') conditions.push(IS_UNUSED)

  // Categories. Assets only reference categories, so `references()` is a category match
  if (filters.untagged) {
    conditions.push('count(coalesce(opt.media.tags, [])) == 0')
  } else if (filters.tagIds.length && filters.tagMatch === 'all') {
    filters.tagIds.forEach((id, index) => {
      conditions.push(`references($tag${index})`)
      params[`tag${index}`] = id
    })
  } else if (filters.tagIds.length) {
    conditions.push('references($tagIds)')
    params.tagIds = filters.tagIds
  }

  if (filters.mimeTypes.length) {
    conditions.push('mimeType in $mimeTypes')
    params.mimeTypes = filters.mimeTypes
  }

  // A little give either side of 1:1, so a 1000 × 1002 image still counts as square
  if (filters.orientation === 'landscape') conditions.push('metadata.dimensions.aspectRatio > 1.05')
  if (filters.orientation === 'portrait') conditions.push('metadata.dimensions.aspectRatio < 0.95')
  if (filters.orientation === 'square') {
    conditions.push(
      'metadata.dimensions.aspectRatio >= 0.95 && metadata.dimensions.aspectRatio <= 1.05',
    )
  }

  if (filters.minSize) {
    conditions.push('size > $minSize')
    params.minSize = filters.minSize
  }

  if (filters.uploaded) {
    const days = filters.uploaded === 'week' ? 7 : 30
    conditions.push(filters.uploaded === 'older' ? '_createdAt < $since' : '_createdAt >= $since')
    params.since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }

  const terms = searchTerms(filters.search)
  if (terms.length) {
    conditions.push('[originalFilename, title, altText, description] match $terms')
    params.terms = terms
  }

  const filter = conditions.join(' && ')

  return {
    query: `{
			"items": *[${filter}] | order(${ORDER[filters.sort]}) [$start...$end] ${ASSET_PROJECTION},
			"total": count(*[${filter}])
		}`,
    params,
  }
}

/** Sidebar numbers and the categories, with how many assets each has */
export function buildCountsQuery(kind?: AssetKind) {
  const types = kind ? [kind === 'image' ? IMAGE_ASSET : FILE_ASSET] : [IMAGE_ASSET, FILE_ASSET]

  return {
    query: `{
			"all": count(*[_type in $types]),
			"images": count(*[_type == "${IMAGE_ASSET}"]),
			"files": count(*[_type == "${FILE_ASSET}"]),
			"missingAlt": count(*[${HAS_NO_ALT}]),
			"unused": count(*[_type in $types && ${IS_UNUSED}]),
			"tags": *[_type == "${TAG_TYPE}" && defined(name.current)] | order(lower(name.current) asc) {
				_id,
				"name": name.current,
				"count": count(*[_type in $types && ^._id in opt.media.tags[]._ref])
			},
			"mimeTypes": array::unique(*[_type in $types && defined(mimeType)].mimeType)
		}`,
    params: {types},
  }
}

/** One asset, for the detail panel after an edit elsewhere */
export const ASSET_BY_ID = `*[_id == $id][0] ${ASSET_PROJECTION}`

/** Every asset nothing references, for "Delete unused" */
export const UNUSED_ASSET_IDS = `*[_type in $types && ${IS_UNUSED}]._id`

/**
 * Documents that use an asset. Asked with the `raw` perspective, so drafts and release versions are included:
 * the panel folds them into one row per document, and Replace patches every one of them.
 */
export const REFERENCING_DOCUMENTS = '*[references($id)]{_id, _type, _rev}'
