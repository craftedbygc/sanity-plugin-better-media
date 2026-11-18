import {CloseIcon, TagIcon, TrashIcon} from '@sanity/icons'
import {Box, Button, Card, Flex, Text, useToast} from '@sanity/ui'
import {useState} from 'react'

import {addTagToAssets, deleteAssets, removeTagFromAssets} from '../lib/assets'
import {errorMessage} from '../lib/format'
import {useMediaClient} from '../lib/useMediaLibrary'
import type {MediaAsset, MediaTag} from '../types'
import {CategoryPicker, type TagState} from './CategoryPicker'
import {ConfirmDialog} from './dialogs'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** Floats over the results while assets are checked: categorise or delete them together */
export function BulkBar(props: {
  selected: MediaAsset[]
  tags: MediaTag[]
  canSelectMore: boolean
  onSelectAll: () => void
  onClear: () => void
  onCreateTag: (name: string) => Promise<MediaTag>
}) {
  const {selected, tags} = props
  const client = useMediaClient()
  const toast = useToast()
  const [isConfirming, setIsConfirming] = useState(false)

  const stateOf = (tagId: string): TagState => {
    const count = selected.filter((asset) => asset.tagIds.includes(tagId)).length
    return count === 0 ? 'off' : count === selected.length ? 'on' : 'mixed'
  }

  const toggle = async (tag: MediaTag, add: boolean) => {
    try {
      const changed = add
        ? await addTagToAssets(client, selected, tag._id)
        : await removeTagFromAssets(client, selected, tag._id)
      toast.push({
        status: 'success',
        title: `${add ? 'Added' : 'Removed'} ${plural(changed, 'asset')} ${add ? 'to' : 'from'} ${tag.name}`,
      })
    } catch (error) {
      toast.push({
        status: 'error',
        title: 'Couldn’t update categories',
        description: errorMessage(error),
      })
    }
  }

  const remove = async () => {
    const {deleted, failed} = await deleteAssets(
      client,
      selected.map((asset) => asset._id),
    )
    toast.push({
      status: failed.length ? 'warning' : 'success',
      title: `Deleted ${plural(deleted.length, 'asset')}`,
      description: failed.length
        ? `${plural(failed.length, 'asset')} kept, because documents still use them.`
        : undefined,
    })
    props.onClear()
  }

  return (
    <Card shadow={3} radius={3} paddingX={3} paddingY={2}>
      <Flex align="center" gap={2}>
        <Box paddingRight={2}>
          <Text size={1} weight="medium">
            {selected.length} selected
          </Text>
        </Box>
        {props.canSelectMore && (
          <Button
            mode="bleed"
            fontSize={1}
            padding={2}
            text="Select all"
            onClick={props.onSelectAll}
          />
        )}
        <CategoryPicker
          tags={tags}
          stateOf={stateOf}
          onToggle={toggle}
          onCreate={props.onCreateTag}
          buttonProps={{icon: TagIcon, mode: 'ghost', fontSize: 1, padding: 2, text: 'Categories'}}
        />
        <Button
          icon={TrashIcon}
          mode="ghost"
          tone="critical"
          fontSize={1}
          padding={2}
          text="Delete"
          onClick={() => setIsConfirming(true)}
        />
        <Button
          icon={CloseIcon}
          mode="bleed"
          fontSize={1}
          padding={2}
          aria-label="Clear selection"
          title="Clear selection"
          onClick={props.onClear}
        />
      </Flex>

      {isConfirming && (
        <ConfirmDialog
          title={`Delete ${plural(selected.length, 'asset')}?`}
          confirmText="Delete"
          onConfirm={remove}
          onClose={() => setIsConfirming(false)}
        >
          Their files are removed and their URLs stop working. Any that documents still use are
          kept. This can’t be undone.
        </ConfirmDialog>
      )}
    </Card>
  )
}
