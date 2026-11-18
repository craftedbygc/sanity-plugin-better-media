import {CloseIcon, FilterIcon} from '@sanity/icons'
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Inline,
  Label,
  Popover,
  Stack,
  Text,
  useClickOutsideEvent,
  useGlobalKeyDown,
} from '@sanity/ui'
import {useState, type ReactNode} from 'react'

import {
  countActiveFilters,
  type AssetKind,
  type Filters,
  type MediaTag,
  type Orientation,
  type Uploaded,
} from '../types'

/** "image/svg+xml" → "SVG" */
export function formatMimeType(mimeType: string) {
  const known: Record<string, string> = {
    'image/jpeg': 'JPG',
    'image/svg+xml': 'SVG',
    'video/quicktime': 'MOV',
    'audio/mpeg': 'MP3',
    'application/pdf': 'PDF',
    'application/zip': 'ZIP',
    'text/plain': 'TXT',
  }
  return known[mimeType] ?? (mimeType.split('/')[1] ?? mimeType).split(/[+.;-]/)[0].toUpperCase()
}

interface Option<T> {
  value: T
  label: string
}

const ORIENTATIONS: Option<Orientation>[] = [
  {value: 'landscape', label: 'Landscape'},
  {value: 'portrait', label: 'Portrait'},
  {value: 'square', label: 'Square'},
]
const SIZES: Option<number>[] = [
  {value: 1024 * 1024, label: 'Over 1 MB'},
  {value: 5 * 1024 * 1024, label: 'Over 5 MB'},
]
const UPLOADED: Option<Uploaded>[] = [
  {value: 'week', label: 'Last 7 days'},
  {value: 'month', label: 'Last 30 days'},
  {value: 'older', label: 'Older than 30 days'},
]

const labelOf = <T,>(options: Option<T>[], value: T) =>
  options.find((option) => option.value === value)?.label ?? String(value)

type Change = (change: Partial<Filters>) => void

/** Turns off everything in the Filter menu, leaving the view, search and sort */
const CLEARED: Partial<Filters> = {
  tagIds: [],
  tagMatch: 'any',
  untagged: false,
  mimeTypes: [],
  orientation: undefined,
  minSize: undefined,
  uploaded: undefined,
}

/** A row of single-choice buttons, with "Any" to clear */
function Choice<T extends string | number>(props: {
  options: Option<T>[]
  value?: T
  onChange: (value?: T) => void
}) {
  return (
    <Inline gap={1}>
      <Button
        mode="ghost"
        fontSize={1}
        padding={2}
        text="Any"
        selected={props.value === undefined}
        onClick={() => props.onChange(undefined)}
      />
      {props.options.map(({value, label}) => (
        <Button
          key={String(value)}
          mode="ghost"
          fontSize={1}
          padding={2}
          text={label}
          selected={props.value === value}
          onClick={() => props.onChange(props.value === value ? undefined : value)}
        />
      ))}
    </Inline>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Stack gap={3}>
      <Flex align="center" style={{minHeight: 25}}>
        <Box flex={1}>
          <Label size={0} muted>
            {title}
          </Label>
        </Box>
        {action}
      </Flex>
      {children}
    </Stack>
  )
}

/**
 * The Filter button and its popover: type, categories (several, any or all, or none), orientation, size and upload
 * date. Each change applies straight away.
 */
export function FilterMenu(props: {
  filters: Filters
  tags: MediaTag[]
  mimeTypes: string[]
  kind?: AssetKind
  onChange: Change
}) {
  const {filters, onChange} = props
  const [isOpen, setIsOpen] = useState(false)
  const [popover, setPopover] = useState<HTMLDivElement | null>(null)
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null)
  const active = countActiveFilters(filters)

  useClickOutsideEvent(isOpen && (() => setIsOpen(false)), () => [popover, anchor])
  useGlobalKeyDown((event) => {
    if (isOpen && event.key === 'Escape') setIsOpen(false)
  })

  // Only the types in the library, and in select mode only those the field takes
  const mimeTypes = props.mimeTypes
    .filter((mimeType) => !props.kind || (props.kind === 'image') === mimeType.startsWith('image/'))
    .sort((a, b) => formatMimeType(a).localeCompare(formatMimeType(b)))
  const showOrientation = props.kind !== 'file' && filters.view !== 'files'

  const toggleMimeType = (mimeType: string) =>
    onChange({
      mimeTypes: filters.mimeTypes.includes(mimeType)
        ? filters.mimeTypes.filter((type) => type !== mimeType)
        : [...filters.mimeTypes, mimeType],
    })

  const toggleTag = (id: string) =>
    onChange({
      untagged: false,
      tagIds: filters.tagIds.includes(id)
        ? filters.tagIds.filter((tagId) => tagId !== id)
        : [...filters.tagIds, id],
    })

  const content = (
    <Box ref={setPopover} style={{width: 340}}>
      <Stack gap={5} padding={4} style={{maxHeight: 'min(70vh, 640px)', overflowY: 'auto'}}>
        {mimeTypes.length > 1 && (
          <Section title="Type">
            <Inline gap={1}>
              {mimeTypes.map((mimeType) => (
                <Button
                  key={mimeType}
                  mode="ghost"
                  fontSize={1}
                  padding={2}
                  text={formatMimeType(mimeType)}
                  title={mimeType}
                  selected={filters.mimeTypes.includes(mimeType)}
                  onClick={() => toggleMimeType(mimeType)}
                />
              ))}
            </Inline>
          </Section>
        )}

        <Section
          title="Categories"
          action={
            filters.tagIds.length > 1 && (
              <Inline gap={1}>
                <Button
                  mode="bleed"
                  fontSize={0}
                  padding={2}
                  text="Any"
                  selected={filters.tagMatch === 'any'}
                  onClick={() => onChange({tagMatch: 'any'})}
                />
                <Button
                  mode="bleed"
                  fontSize={0}
                  padding={2}
                  text="All"
                  selected={filters.tagMatch === 'all'}
                  onClick={() => onChange({tagMatch: 'all'})}
                />
              </Inline>
            )
          }
        >
          <Stack gap={1}>
            <Card
              as="button"
              padding={2}
              radius={2}
              onClick={() => onChange({untagged: !filters.untagged, tagIds: []})}
            >
              <Flex align="center" gap={3}>
                <Checkbox
                  checked={filters.untagged}
                  readOnly
                  tabIndex={-1}
                  style={{pointerEvents: 'none'}}
                />
                <Text size={1} muted>
                  No category
                </Text>
              </Flex>
            </Card>
            {props.tags.map((tag) => (
              <Card
                key={tag._id}
                as="button"
                padding={2}
                radius={2}
                onClick={() => toggleTag(tag._id)}
              >
                <Flex align="center" gap={3}>
                  <Checkbox
                    checked={filters.tagIds.includes(tag._id)}
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
            ))}
          </Stack>
        </Section>

        {showOrientation && (
          <Section title="Orientation">
            <Choice
              options={ORIENTATIONS}
              value={filters.orientation}
              onChange={(orientation) => onChange({orientation})}
            />
          </Section>
        )}

        <Section title="File size">
          <Choice
            options={SIZES}
            value={filters.minSize}
            onChange={(minSize) => onChange({minSize})}
          />
        </Section>

        <Section title="Uploaded">
          <Choice
            options={UPLOADED}
            value={filters.uploaded}
            onChange={(uploaded) => onChange({uploaded})}
          />
        </Section>
      </Stack>

      <Card borderTop paddingX={3} paddingY={2}>
        <Flex align="center" justify="space-between" gap={2}>
          <Text size={1} muted>
            {active ? `${active} filter${active === 1 ? '' : 's'} on` : 'No filters on'}
          </Text>
          <Button
            mode="bleed"
            fontSize={1}
            padding={2}
            text="Clear all"
            disabled={!active}
            onClick={() => onChange(CLEARED)}
          />
        </Flex>
      </Card>
    </Box>
  )

  return (
    <Popover content={content} open={isOpen} portal placement="bottom-end" constrainSize>
      <Box ref={setAnchor}>
        <Button mode="bleed" fontSize={1} selected={isOpen} onClick={() => setIsOpen(!isOpen)}>
          <Flex align="center" gap={2}>
            <Text size={1}>
              <FilterIcon />
            </Text>
            <Text size={1}>Filter</Text>
            {active > 0 && (
              <Badge tone="primary" fontSize={0}>
                {active}
              </Badge>
            )}
          </Flex>
        </Button>
      </Box>
    </Popover>
  )
}

function Chip({label, onRemove}: {label: string; onRemove: () => void}) {
  return (
    <Button
      mode="ghost"
      tone="primary"
      fontSize={1}
      padding={2}
      text={label}
      iconRight={CloseIcon}
      title={`Remove “${label}”`}
      onClick={onRemove}
    />
  )
}

/** The filters that are on, under the toolbar, each removable */
export function ActiveFilters({
  filters,
  tags,
  onChange,
}: {
  filters: Filters
  tags: MediaTag[]
  onChange: Change
}) {
  if (!countActiveFilters(filters)) return null

  const tagNames = filters.tagIds.map(
    (id) => tags.find((tag) => tag._id === id)?.name ?? 'Deleted category',
  )
  const joiner = filters.tagMatch === 'all' ? ' and ' : ' or '

  return (
    <Card borderBottom paddingX={3} paddingY={2}>
      <Flex align="center" gap={1} wrap="wrap">
        {filters.mimeTypes.length > 0 && (
          <Chip
            label={filters.mimeTypes.map(formatMimeType).join(', ')}
            onRemove={() => onChange({mimeTypes: []})}
          />
        )}
        {filters.untagged && (
          <Chip label="No category" onRemove={() => onChange({untagged: false})} />
        )}
        {tagNames.length > 0 && (
          <Chip
            label={tagNames.join(joiner)}
            onRemove={() => onChange({tagIds: [], tagMatch: 'any'})}
          />
        )}
        {filters.orientation && (
          <Chip
            label={labelOf(ORIENTATIONS, filters.orientation)}
            onRemove={() => onChange({orientation: undefined})}
          />
        )}
        {filters.minSize && (
          <Chip
            label={labelOf(SIZES, filters.minSize)}
            onRemove={() => onChange({minSize: undefined})}
          />
        )}
        {filters.uploaded && (
          <Chip
            label={`Uploaded ${labelOf(UPLOADED, filters.uploaded).toLowerCase()}`}
            onRemove={() => onChange({uploaded: undefined})}
          />
        )}
        <Button
          mode="bleed"
          fontSize={1}
          padding={2}
          text="Clear all"
          onClick={() => onChange(CLEARED)}
        />
      </Flex>
    </Card>
  )
}
