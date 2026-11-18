import {TagIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

import {TAG_TYPE} from '../types'

/**
 * A media category. Same type name and shape as sanity-plugin-media's tags (`name` is a slug), so a dataset that used
 * that plugin keeps its categories. Assets point at these through weak references in `opt.media.tags`.
 * Managed from the Media tool, never edited as a document.
 */
export const mediaTag = defineType({
  name: TAG_TYPE,
  type: 'document',
  title: 'Media category',
  icon: TagIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'slug',
      title: 'Name',
    }),
  ],
  preview: {
    select: {name: 'name.current'},
    prepare: ({name}) => ({title: name, media: TagIcon}),
  },
})
