import {AddIcon, SearchIcon} from '@sanity/icons'
import {
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Popover,
  Stack,
  Text,
  TextInput,
  useClickOutsideEvent,
  useGlobalKeyDown,
} from '@sanity/ui'
import {useMemo, useState, type ComponentProps} from 'react'

import type {MediaTag} from '../types'

export type TagState = 'on' | 'off' | 'mixed'

/**
 * A searchable checklist of categories in a popover, with "Create …" for a name that doesn't exist yet.
 * Used for one asset (on/off) and for a selection (where some assets may have a category: mixed).
 */
export function CategoryPicker(props: {
  tags: MediaTag[]
  stateOf: (tagId: string) => TagState
  onToggle: (tag: MediaTag, add: boolean) => void
  onCreate: (name: string) => Promise<MediaTag>
  /** The button that opens it */
  buttonProps: ComponentProps<typeof Button>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [popover, setPopover] = useState<HTMLDivElement | null>(null)
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null)

  const close = () => {
    setIsOpen(false)
    setQuery('')
  }

  useClickOutsideEvent(isOpen && close, () => [popover, anchor])
  useGlobalKeyDown((event) => {
    if (isOpen && event.key === 'Escape') close()
  })

  const trimmed = query.trim()
  const visible = useMemo(
    () => props.tags.filter((tag) => tag.name.toLowerCase().includes(trimmed.toLowerCase())),
    [props.tags, trimmed],
  )
  const exactMatch = props.tags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase())

  const create = async () => {
    if (!trimmed || exactMatch) return
    setIsCreating(true)
    try {
      const tag = await props.onCreate(trimmed)
      props.onToggle(tag, true)
      setQuery('')
    } finally {
      setIsCreating(false)
    }
  }

  const toggle = (tag: MediaTag) => props.onToggle(tag, props.stateOf(tag._id) !== 'on')

  const content = (
    <Box ref={setPopover} style={{width: 280}}>
      <Box padding={2}>
        <TextInput
          autoFocus
          icon={SearchIcon}
          fontSize={1}
          value={query}
          placeholder="Find or create a category"
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            if (exactMatch) toggle(exactMatch)
            else void create()
          }}
        />
      </Box>

      <Box padding={1} style={{maxHeight: 280, overflowY: 'auto'}}>
        <Stack gap={1}>
          {visible.map((tag) => {
            const state = props.stateOf(tag._id)
            return (
              <Card key={tag._id} as="button" padding={2} radius={2} onClick={() => toggle(tag)}>
                <Flex align="center" gap={3}>
                  <Checkbox
                    checked={state === 'on'}
                    indeterminate={state === 'mixed'}
                    readOnly
                    tabIndex={-1}
                    style={{pointerEvents: 'none'}}
                  />
                  <Box flex={1}>
                    <Text size={1} textOverflow="ellipsis">
                      {tag.name}
                    </Text>
                  </Box>
                  <Text size={0} muted>
                    {tag.count}
                  </Text>
                </Flex>
              </Card>
            )
          })}

          {trimmed && !exactMatch && (
            <Card
              as="button"
              padding={2}
              radius={2}
              tone="primary"
              onClick={create}
              disabled={isCreating}
            >
              <Flex align="center" gap={3}>
                <Text size={1}>
                  <AddIcon />
                </Text>
                <Text size={1} textOverflow="ellipsis">
                  Create “{trimmed}”
                </Text>
              </Flex>
            </Card>
          )}

          {!trimmed && props.tags.length === 0 && (
            <Box padding={2}>
              <Text size={1} muted>
                No categories yet. Type a name to create one.
              </Text>
            </Box>
          )}
        </Stack>
      </Box>
    </Box>
  )

  return (
    <Popover content={content} open={isOpen} portal placement="bottom-start" constrainSize>
      <Box ref={setAnchor} style={{display: 'inline-block'}}>
        <Button
          {...props.buttonProps}
          selected={isOpen}
          onClick={() => (isOpen ? close() : setIsOpen(true))}
        />
      </Box>
    </Popover>
  )
}
