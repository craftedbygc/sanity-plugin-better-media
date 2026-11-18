import {IMAGE_ASSET, type MediaAsset} from '../types'

export const isImage = (asset: MediaAsset) => asset._type === IMAGE_ASSET

/** The name editors know an asset by: its title, else the uploaded file name */
export const assetName = (asset: MediaAsset) => asset.title || asset.originalFilename || asset._id

export const hasNoAlt = (asset: MediaAsset) => isImage(asset) && !asset.altText

/** A resized copy from the image CDN, so the grid never loads originals */
export function thumbnailUrl(asset: MediaAsset, size: number) {
  return `${asset.url}?w=${size}&h=${size}&fit=max&auto=format`
}

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "1920 × 1080" for images, the extension for files */
export function formatKind(asset: MediaAsset) {
  if (asset.dimensions) return `${asset.dimensions.width} × ${asset.dimensions.height}`
  return (asset.extension || asset.mimeType?.split('/')[1] || 'file').toUpperCase()
}

/** Whatever was thrown, as an Error */
export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/** A thrown value's message, for toasts */
export function errorMessage(error: unknown): string {
  return toError(error).message
}
