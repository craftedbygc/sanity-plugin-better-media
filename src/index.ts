import {ImagesIcon} from '@sanity/icons'
import {defineLocaleResourceBundle, definePlugin, type AssetSource, type Tool} from 'sanity'

import {MediaAssetSource} from './MediaAssetSource'
import {MediaTool} from './MediaTool'
import {mediaTag} from './schema/mediaTag'
import {TAG_TYPE} from './types'

/**
 * Options for {@link betterMedia}.
 *
 * @public
 */
export interface BetterMediaOptions {
  /**
   * The Media tool in the Studio's top bar. `false` leaves it out (fields can still pick from the library).
   * Default: `{name: 'media', title: 'Media'}`
   */
  tool?: false | {name?: string; title?: string}
  /**
   * The library as an asset source on image and file fields. `false` leaves it out.
   * Default: `{title: 'Media'}`, on both image and file fields
   */
  assetSource?: false | {title?: string; images?: boolean; files?: boolean}
}

// The picker's name in field menus. Sanity looks asset source names up in its `studio` namespace, so the plugin adds
// this key there, in English, set from the `assetSource.title` option
const SOURCE_TITLE_KEY = 'better-media.asset-source.title'

/**
 * The asset source on its own, to place it yourself in `form.image.assetSources` / `form.file.assetSources`
 * (for example to keep it and drop others), or match it by `name === 'better-media'`. Its name in menus comes from
 * the plugin, so add `betterMedia()` too (with `assetSource: false` if you place the source yourself).
 *
 * @public
 */
export const betterMediaAssetSource: AssetSource = {
  name: 'better-media',
  i18nKey: SOURCE_TITLE_KEY,
  icon: ImagesIcon,
  component: MediaAssetSource,
}

/**
 * A media library for Sanity Studio: browse, filter, upload, categorise, describe, replace and clean up images and
 * files, and pick them for fields. Uses the same data as sanity-plugin-media, so it replaces it with nothing to
 * migrate. Don't install both: they both define the `media.tag` type.
 *
 * ```ts
 * import {defineConfig} from 'sanity'
 * import {betterMedia} from '@unseenco/sanity-plugin-better-media'
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [betterMedia()],
 * })
 * ```
 *
 * @public
 */
export const betterMedia = definePlugin<BetterMediaOptions | void>((options) => {
  const toolOptions = options?.tool === false ? false : (options?.tool ?? {})
  const sourceOptions = options?.assetSource === false ? false : (options?.assetSource ?? {})

  const tool: Tool | undefined = toolOptions
    ? {
        // "media" by default, like sanity-plugin-media, so existing Studio URLs (/media) keep working
        name: toolOptions.name ?? 'media',
        title: toolOptions.title ?? 'Media',
        icon: ImagesIcon,
        component: MediaTool,
      }
    : undefined

  const sourceTitle = (sourceOptions && sourceOptions.title) || 'Media'
  const onImages = sourceOptions !== false && sourceOptions.images !== false
  const onFiles = sourceOptions !== false && sourceOptions.files !== false

  return {
    name: 'sanity-plugin-better-media',

    tools: (prev) => (tool ? [...prev, tool] : prev),

    schema: {types: [mediaTag]},

    form: {
      image: {assetSources: (prev) => (onImages ? [...prev, betterMediaAssetSource] : prev)},
      file: {assetSources: (prev) => (onFiles ? [...prev, betterMediaAssetSource] : prev)},
    },

    i18n: {
      bundles: [
        defineLocaleResourceBundle({
          locale: 'en-US',
          namespace: 'studio',
          resources: {[SOURCE_TITLE_KEY]: sourceTitle},
        }),
      ],
    },

    // Categories are made in the Media tool, not from "Create new"
    document: {
      newDocumentOptions: (prev) => prev.filter((template) => template.templateId !== TAG_TYPE),
    },
  }
})
