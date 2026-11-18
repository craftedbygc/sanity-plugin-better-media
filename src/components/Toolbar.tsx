import {
  CheckmarkIcon,
  SearchIcon,
  SortIcon,
  ThLargeIcon,
  ThListIcon,
  UploadIcon,
} from '@sanity/icons'
import {
  Box,
  Button,
  Card,
  Flex,
  Inline,
  Menu,
  MenuButton,
  MenuItem,
  Text,
  TextInput,
} from '@sanity/ui'
import {useRef, type ReactNode} from 'react'

import type {Layout, Sort} from '../types'

const SORTS: Sort[] = ['newest', 'oldest', 'name', 'largest']

const SORT_LABELS: Record<Sort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  name: 'Name',
  largest: 'Largest first',
}

export function Toolbar(props: {
  search: string
  sort: Sort
  layout: Layout
  total: number
  /** What the file picker accepts */
  accept?: string
  /** The Filter button, before Sort */
  filterMenu?: ReactNode
  onSearch: (search: string) => void
  onSort: (sort: Sort) => void
  onLayout: (layout: Layout) => void
  onUpload: (files: File[]) => void
}) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <Card borderBottom paddingX={3} paddingY={2}>
      <Flex align="center" gap={2} wrap="wrap">
        <Box flex={1} style={{minWidth: 200, maxWidth: 420}}>
          <TextInput
            icon={SearchIcon}
            fontSize={1}
            value={props.search}
            placeholder="Search by name, title, alt or description"
            clearButton={Boolean(props.search)}
            onClear={() => props.onSearch('')}
            onChange={(event) => props.onSearch(event.currentTarget.value)}
          />
        </Box>

        <Box flex={1}>
          <Text size={1} muted style={{whiteSpace: 'nowrap'}}>
            {props.total} {props.total === 1 ? 'item' : 'items'}
          </Text>
        </Box>

        {props.filterMenu}

        <MenuButton
          id="media-sort"
          button={
            <Button icon={SortIcon} mode="bleed" fontSize={1} text={SORT_LABELS[props.sort]} />
          }
          menu={
            <Menu>
              {SORTS.map((sort) => (
                <MenuItem
                  key={sort}
                  text={SORT_LABELS[sort]}
                  iconRight={sort === props.sort ? CheckmarkIcon : undefined}
                  pressed={sort === props.sort}
                  onClick={() => props.onSort(sort)}
                />
              ))}
            </Menu>
          }
          popover={{portal: true, placement: 'bottom-end'}}
        />

        <Card radius={2} border padding={0}>
          <Inline gap={0}>
            <Button
              icon={ThLargeIcon}
              mode="bleed"
              fontSize={1}
              padding={2}
              selected={props.layout === 'grid'}
              aria-label="Grid"
              title="Grid"
              onClick={() => props.onLayout('grid')}
            />
            <Button
              icon={ThListIcon}
              mode="bleed"
              fontSize={1}
              padding={2}
              selected={props.layout === 'list'}
              aria-label="List"
              title="List"
              onClick={() => props.onLayout('list')}
            />
          </Inline>
        </Card>

        <Button
          icon={UploadIcon}
          tone="primary"
          fontSize={1}
          text="Upload"
          onClick={() => input.current?.click()}
        />
        <input
          ref={input}
          type="file"
          multiple
          accept={props.accept}
          hidden
          onChange={(event) => {
            props.onUpload(Array.from(event.currentTarget.files ?? []))
            event.currentTarget.value = ''
          }}
        />
      </Flex>
    </Card>
  )
}
