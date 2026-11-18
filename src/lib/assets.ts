import type {SanityClient, SanityDocument} from 'sanity'

import {FILE_ASSET, IMAGE_ASSET, TAG_TYPE, type AssetKind, type MediaAsset} from '../types'
import {REFERENCING_DOCUMENTS} from './queries'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** The category ids on an asset document, as stored by this plugin or sanity-plugin-media */
export function tagIdsOf(document: Record<string, unknown>): string[] {
  const media = isRecord(document.opt) ? document.opt.media : undefined
  const tags: unknown = isRecord(media) ? media.tags : undefined
  if (!Array.isArray(tags)) return []
  return tags.flatMap((tag: unknown) =>
    isRecord(tag) && typeof tag._ref === 'string' ? [tag._ref] : [],
  )
}

/** An image asset document's width and height, if it has them */
function dimensionsOf(
  document: Record<string, unknown>,
): {width: number; height: number} | undefined {
  const dimensions = isRecord(document.metadata) ? document.metadata.dimensions : undefined
  if (
    !isRecord(dimensions) ||
    typeof dimensions.width !== 'number' ||
    typeof dimensions.height !== 'number'
  )
    return undefined
  return {width: dimensions.width, height: dimensions.height}
}

const stringOf = (value: unknown) => (typeof value === 'string' ? value : undefined)

/**
 * An asset document (as an upload returns it) in the shape the library lists, so it can be shown straight away.
 * `tagIds` overrides the stored categories, for an upload that's just been put into one
 */
export function toMediaAsset(document: SanityDocument, tagIds?: string[]): MediaAsset | undefined {
  const type =
    document._type === IMAGE_ASSET
      ? IMAGE_ASSET
      : document._type === FILE_ASSET
        ? FILE_ASSET
        : undefined
  const url = stringOf(document.url)
  if (!type || !url) return undefined

  const dimensions = dimensionsOf(document)
  const metadata = isRecord(document.metadata) ? document.metadata : {}

  return {
    _id: document._id,
    _type: type,
    _createdAt: document._createdAt,
    _updatedAt: document._updatedAt,
    url,
    originalFilename: stringOf(document.originalFilename),
    title: stringOf(document.title),
    altText: stringOf(document.altText),
    description: stringOf(document.description),
    mimeType: stringOf(document.mimeType),
    extension: stringOf(document.extension),
    size: typeof document.size === 'number' ? document.size : undefined,
    dimensions: dimensions && {...dimensions, aspectRatio: dimensions.width / dimensions.height},
    lqip: stringOf(metadata.lqip),
    tagIds: tagIds ?? tagIdsOf(document),
  }
}

const randomKey = () => Math.random().toString(36).slice(2, 14)

/** A category reference as sanity-plugin-media stores it: weak, so deleting a category never fails on its assets */
const tagReference = (tagId: string) => ({
  _key: randomKey(),
  _type: 'reference',
  _ref: tagId,
  _weak: true,
})

export function assetKind(file: File): AssetKind {
  return file.type.startsWith('image/') ? 'image' : 'file'
}

// Fields

export interface AssetFields {
  title: string
  altText: string
  description: string
}

/** Saves the editable fields. An empty field is removed rather than stored as "" */
export async function updateAssetFields(client: SanityClient, id: string, fields: AssetFields) {
  const set: Record<string, string> = {}
  const unset: string[] = []

  for (const [name, value] of Object.entries(fields)) {
    const text = value.trim()
    if (text) set[name] = text
    else unset.push(name)
  }

  await client.patch(id).set(set).unset(unset).commit()
}

// Categories

type TaggedAsset = Pick<MediaAsset, '_id' | 'tagIds'>

/** Gives an asset exactly these categories */
export async function setAssetTags(client: SanityClient, id: string, tagIds: string[]) {
  await client
    .patch(id)
    .setIfMissing({opt: {}})
    .setIfMissing({'opt.media': {}})
    .set({'opt.media.tags': tagIds.map(tagReference)})
    .commit()
}

/** Adds a category to every asset that doesn't have it yet */
export async function addTagToAssets(client: SanityClient, assets: TaggedAsset[], tagId: string) {
  const transaction = client.transaction()
  const missing = assets.filter((asset) => !asset.tagIds.includes(tagId))

  for (const asset of missing) {
    transaction.patch(asset._id, (patch) =>
      patch
        .setIfMissing({opt: {}})
        .setIfMissing({'opt.media': {}})
        .setIfMissing({'opt.media.tags': []})
        .append('opt.media.tags', [tagReference(tagId)]),
    )
  }

  if (missing.length) await transaction.commit()
  return missing.length
}

export async function removeTagFromAssets(
  client: SanityClient,
  assets: TaggedAsset[],
  tagId: string,
) {
  const transaction = client.transaction()
  const tagged = assets.filter((asset) => asset.tagIds.includes(tagId))

  for (const asset of tagged) {
    transaction.patch(asset._id, (patch) => patch.unset([`opt.media.tags[_ref == "${tagId}"]`]))
  }

  if (tagged.length) await transaction.commit()
  return tagged.length
}

export async function createTag(client: SanityClient, name: string) {
  const tag = await client.create({_type: TAG_TYPE, name: {_type: 'slug', current: name.trim()}})
  return {_id: tag._id, name: name.trim(), count: 0}
}

export async function renameTag(client: SanityClient, id: string, name: string) {
  await client.patch(id).set({'name.current': name.trim()}).commit()
}

/** Removes the category from its assets, then deletes it */
export async function deleteTag(client: SanityClient, id: string) {
  const assetIds = await client.fetch<string[]>('*[$id in opt.media.tags[]._ref]._id', {id})
  const transaction = client.transaction()

  for (const assetId of assetIds) {
    transaction.patch(assetId, (patch) => patch.unset([`opt.media.tags[_ref == "${id}"]`]))
  }

  transaction.delete(id)
  await transaction.commit()
}

// Upload

/**
 * Uploads a file as an image or file asset, reporting progress (0–100). Sanity stores each file once, so uploading
 * a file that's already in the library returns the existing asset.
 */
export function uploadFile(
  client: SanityClient,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<SanityDocument> {
  return new Promise((resolve, reject) => {
    client.observable.assets.upload(assetKind(file), file, {filename: file.name}).subscribe({
      next: (event) => {
        if (event.type === 'progress') onProgress?.(event.percent)
        if (event.type === 'response') resolve(event.body.document)
      },
      error: reject,
    })
  })
}

// Delete

export interface DeleteResult {
  deleted: string[]
  /** Assets Sanity refused to delete, almost always because something still uses them */
  failed: string[]
}

/** Deletes each asset on its own, so one that's in use doesn't stop the rest */
export async function deleteAssets(client: SanityClient, ids: string[]): Promise<DeleteResult> {
  const results = await Promise.allSettled(ids.map((id) => client.delete(id)))

  return {
    deleted: ids.filter((_, index) => results[index].status === 'fulfilled'),
    failed: ids.filter((_, index) => results[index].status === 'rejected'),
  }
}

// Replace

type PathSegment = string | number | {_key: string}

/** The path to every reference object in a document that points at `assetId` (the object, not its `_ref`) */
function findReferencePaths(
  value: unknown,
  assetId: string,
  path: PathSegment[] = [],
): PathSegment[][] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findReferencePaths(item, assetId, [
        ...path,
        item && typeof item === 'object' && '_key' in item ? {_key: String(item._key)} : index,
      ]),
    )
  }

  if (value && typeof value === 'object') {
    if ((value as {_ref?: unknown})._ref === assetId) return [path]
    return Object.entries(value).flatMap(([key, child]) =>
      findReferencePaths(child, assetId, [...path, key]),
    )
  }

  return []
}

/** `content[_key=="abc"].asset._ref` */
function toPatchPath(path: PathSegment[]): string {
  return path.reduce<string>((result, segment) => {
    if (typeof segment === 'number') return `${result}[${segment}]`
    if (typeof segment === 'object') return `${result}[_key=="${segment._key}"]`
    return result ? `${result}.${segment}` : segment
  }, '')
}

export interface ReplaceResult {
  asset: SanityDocument
  /** How many documents (drafts and versions counted separately) now point at the new file */
  updatedDocuments: number
  /** The new image's size differs, so crops and hotspots set on the old one may need checking */
  dimensionsChanged: boolean
  oldAssetDeleted: boolean
}

/**
 * Assets can't change their file, so replacing one uploads the new file as a new asset, copies the title, alt,
 * description and categories across, and moves every document (published, drafts and release versions) onto it.
 */
export async function replaceAsset(
  client: SanityClient,
  oldAsset: MediaAsset,
  file: File,
  options: {deleteOld: boolean; onProgress?: (percent: number) => void},
): Promise<ReplaceResult> {
  const asset = await uploadFile(client, file, options.onProgress)
  if (asset._id === oldAsset._id) throw new Error('That’s the same file as the current one')

  const old = await client.fetch<Record<string, unknown> | null>(
    '*[_id == $id][0]{title, altText, description, "tags": opt.media.tags}',
    {id: oldAsset._id},
  )

  const copy: Record<string, unknown> = {}
  for (const field of ['title', 'altText', 'description'] as const) {
    if (old?.[field]) copy[field] = old[field]
  }
  if (Array.isArray(old?.tags) && old.tags.length) copy.opt = {media: {tags: old.tags}}
  if (Object.keys(copy).length) await client.patch(asset._id).set(copy).commit()

  const raw = client.withConfig({perspective: 'raw'})
  const referencing = await raw.fetch<{_id: string}[]>(REFERENCING_DOCUMENTS, {id: oldAsset._id})
  const documents = await raw.getDocuments(referencing.map((doc) => doc._id))

  const transaction = raw.transaction()
  let updatedDocuments = 0

  for (const document of documents) {
    if (!document) continue
    const paths = findReferencePaths(document, oldAsset._id)
    if (!paths.length) continue

    // Each path is the reference object itself: change only its `_ref`, keeping `_type`, `_weak` and the rest
    const set = Object.fromEntries(paths.map((path) => [`${toPatchPath(path)}._ref`, asset._id]))
    transaction.patch(document._id, (patch) => patch.ifRevisionId(document._rev).set(set))
    updatedDocuments++
  }

  if (updatedDocuments) await transaction.commit()

  let oldAssetDeleted = false
  if (options.deleteOld) {
    oldAssetDeleted = (await deleteAssets(client, [oldAsset._id])).deleted.length === 1
  }

  const newDimensions = dimensionsOf(asset)
  const dimensionsChanged = Boolean(
    oldAsset.dimensions &&
    newDimensions &&
    (oldAsset.dimensions.width !== newDimensions.width ||
      oldAsset.dimensions.height !== newDimensions.height),
  )

  return {asset, updatedDocuments, dimensionsChanged, oldAssetDeleted}
}
