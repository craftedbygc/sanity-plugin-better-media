import {
  AddIcon,
  DocumentIcon,
  EllipsisHorizontalIcon,
  ImageIcon,
  ImagesIcon,
  TagIcon,
  TrashIcon,
  EditIcon,
  UnlinkIcon,
  WarningOutlineIcon,
} from '@sanity/icons'
import {Box, Button, Card, Flex, Label, Menu, MenuButton, MenuItem, Stack, Text} from '@sanity/ui'
import {useState, type ComponentType, type ReactNode} from 'react'

import type {AssetKind, Counts, Filters, MediaTag, View} from '../types'
import {ConfirmDialog, NameDialog} from './dialogs'

interface SidebarProps {
  filters: Filters
  counts: Counts
  /** Set in select mode: the field takes only images or only files */
  kind?: AssetKind
  /** Category editing (tool mode) */
  canManage: boolean
  onChange: (filters: Partial<Filters>) => void
  onCreateTag: (name: string) => Promise<MediaTag>
  onRenameTag: (tag: MediaTag, name: string) => Promise<void>
  onDeleteTag: (tag: MediaTag) => Promise<void>
}

function NavItem(props: {
  icon: ComponentType
  label: string
  count?: number
  active: boolean
  tone?: 'caution'
  onClick: () => void
}) {
  return (
    <Button
      mode="bleed"
      padding={2}
      selected={props.active}
      onClick={props.onClick}
      style={{width: '100%'}}
    >
      <Flex align="center" gap={3}>
        <Text size={1} muted={!props.active}>
          <props.icon />
        </Text>
        <Box flex={1}>
          <Text
            size={1}
            weight={props.active ? 'medium' : 'regular'}
            textOverflow="ellipsis"
            align="left"
          >
            {props.label}
          </Text>
        </Box>
        {props.count !== undefined && (
          <Text
            size={0}
            muted={props.tone !== 'caution' || !props.count}
            style={
              props.tone === 'caution' && props.count
                ? {color: 'var(--card-badge-caution-fg-color)'}
                : undefined
            }
          >
            {props.count}
          </Text>
        )}
      </Flex>
    </Button>
  )
}

function SectionLabel({children, action}: {children: string; action?: ReactNode}) {
  return (
    <Flex align="center" paddingLeft={2} paddingTop={4} paddingBottom={2} style={{minHeight: 33}}>
      <Box flex={1}>
        <Label size={0} muted>
          {children}
        </Label>
      </Box>
      {action}
    </Flex>
  )
}

export function Sidebar({
  filters,
  counts,
  kind,
  canManage,
  onChange,
  onCreateTag,
  onRenameTag,
  onDeleteTag,
}: SidebarProps) {
  const [dialog, setDialog] = useState<
    {type: 'create'} | {type: 'rename' | 'delete'; tag: MediaTag} | null
  >(null)

  // Picking a view keeps the category, so "Missing alt in Homepage" is one click away
  const show = (view: View) => onChange({view})
  const isView = (view: View) => filters.view === view

  const nameTaken = (name: string, except?: string) =>
    counts.tags.some((tag) => tag._id !== except && tag.name.toLowerCase() === name.toLowerCase())
      ? 'There’s already a category with that name'
      : undefined

  return (
    <Card
      data-media-sidebar
      borderRight
      height="fill"
      style={{width: 248, flex: 'none', overflowY: 'auto'}}
    >
      <Stack padding={2} gap={1}>
        <SectionLabel>Library</SectionLabel>
        <NavItem
          icon={ImagesIcon}
          label={kind === 'file' ? 'All files' : kind === 'image' ? 'All images' : 'All media'}
          count={kind === 'image' ? counts.images : kind === 'file' ? counts.files : counts.all}
          active={isView('all')}
          onClick={() => show('all')}
        />
        {!kind && (
          <>
            <NavItem
              icon={ImageIcon}
              label="Images"
              count={counts.images}
              active={isView('images')}
              onClick={() => show('images')}
            />
            <NavItem
              icon={DocumentIcon}
              label="Files"
              count={counts.files}
              active={isView('files')}
              onClick={() => show('files')}
            />
          </>
        )}

        <SectionLabel>Needs attention</SectionLabel>
        {kind !== 'file' && (
          <NavItem
            icon={WarningOutlineIcon}
            label="Missing alt text"
            count={counts.missingAlt}
            tone="caution"
            active={isView('missingAlt')}
            onClick={() => show('missingAlt')}
          />
        )}
        <NavItem
          icon={UnlinkIcon}
          label="Unused"
          count={counts.unused}
          active={isView('unused')}
          onClick={() => show('unused')}
        />

        <SectionLabel
          action={
            canManage && (
              <Button
                icon={AddIcon}
                mode="bleed"
                fontSize={1}
                padding={2}
                aria-label="New category"
                title="New category"
                onClick={() => setDialog({type: 'create'})}
              />
            )
          }
        >
          Categories
        </SectionLabel>

        {counts.tags.length === 0 && (
          <Box paddingX={2} paddingY={1}>
            <Text size={1} muted>
              {canManage
                ? 'Group assets into categories to find them faster.'
                : 'No categories yet.'}
            </Text>
          </Box>
        )}

        {counts.tags.map((tag) => (
          <Flex key={tag._id} align="center" gap={1}>
            <Box flex={1} style={{minWidth: 0}}>
              <NavItem
                icon={TagIcon}
                label={tag.name}
                count={tag.count}
                active={filters.tagIds.length === 1 && filters.tagIds[0] === tag._id}
                // One click shows just this category; again clears it. Several at once: the Filter menu
                onClick={() =>
                  onChange(
                    filters.tagIds.length === 1 && filters.tagIds[0] === tag._id
                      ? {tagIds: [], untagged: false}
                      : {tagIds: [tag._id], tagMatch: 'any', untagged: false},
                  )
                }
              />
            </Box>
            {canManage && (
              <MenuButton
                id={`media-tag-${tag._id}`}
                button={
                  <Button
                    icon={EllipsisHorizontalIcon}
                    mode="bleed"
                    fontSize={1}
                    padding={2}
                    aria-label={`${tag.name} options`}
                  />
                }
                menu={
                  <Menu>
                    <MenuItem
                      icon={EditIcon}
                      text="Rename"
                      onClick={() => setDialog({type: 'rename', tag})}
                    />
                    <MenuItem
                      icon={TrashIcon}
                      text="Delete"
                      tone="critical"
                      onClick={() => setDialog({type: 'delete', tag})}
                    />
                  </Menu>
                }
                popover={{portal: true, placement: 'bottom-end'}}
              />
            )}
          </Flex>
        ))}
      </Stack>

      {dialog?.type === 'create' && (
        <NameDialog
          title="New category"
          confirmText="Create"
          validate={(name) => nameTaken(name)}
          onConfirm={onCreateTag}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === 'rename' && (
        <NameDialog
          title="Rename category"
          confirmText="Rename"
          initialValue={dialog.tag.name}
          validate={(name) => nameTaken(name, dialog.tag._id)}
          onConfirm={(name) => onRenameTag(dialog.tag, name)}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === 'delete' && (
        <ConfirmDialog
          title={`Delete “${dialog.tag.name}”?`}
          confirmText="Delete category"
          onConfirm={() => onDeleteTag(dialog.tag)}
          onClose={() => setDialog(null)}
        >
          {dialog.tag.count
            ? `It’s removed from its ${dialog.tag.count} asset${dialog.tag.count === 1 ? '' : 's'}. The assets themselves stay in the library.`
            : 'No assets are in this category.'}
        </ConfirmDialog>
      )}
    </Card>
  )
}
