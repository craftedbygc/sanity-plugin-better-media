import {Badge, Box, Card, Checkbox, Flex, Stack, Text} from '@sanity/ui'
import type {KeyboardEvent, MouseEvent} from 'react'
import {styled} from 'styled-components'

import {assetName, formatBytes, formatDate, formatKind, hasNoAlt} from '../lib/format'
import type {Layout, MediaAsset} from '../types'
import {AssetThumb} from './AssetThumb'

export interface ResultsProps {
  assets: MediaAsset[]
  layout: Layout
  /** Ids of the checked assets (tool) or the field's current asset (select) */
  selectedIds: Set<string>
  /** Show checkboxes (tool mode) */
  selectable: boolean
  /** The asset open in the detail panel */
  activeId?: string
  onOpen: (asset: MediaAsset, event: MouseEvent | KeyboardEvent) => void
  onToggle: (asset: MediaAsset, event: MouseEvent) => void
}

const Tile = styled(Card)`
  position: relative;
  cursor: pointer;
  overflow: hidden;
  outline: none;
  user-select: none;
  transition: box-shadow 120ms ease;

  &:hover {
    box-shadow:
      0 0 0 1px var(--card-border-color),
      0 4px 16px -8px rgba(0, 0, 0, 0.3);
  }

  &[data-active='true'],
  &[data-checked='true'],
  &:focus-visible {
    box-shadow: 0 0 0 2px var(--card-focus-ring-color);
  }

  [data-check] {
    opacity: 0;
    transition: opacity 120ms ease;
  }

  &:hover [data-check],
  &[data-selecting='true'] [data-check],
  &[data-checked='true'] [data-check] {
    opacity: 1;
  }
`

const Row = styled(Card)`
  cursor: pointer;
  outline: none;
  user-select: none;

  &[data-active='true'],
  &:focus-visible {
    box-shadow: inset 0 0 0 2px var(--card-focus-ring-color);
  }
`

/** The checkbox, sized for a click target and kept from opening the asset */
function Check({
  asset,
  checked,
  onToggle,
}: {
  asset: MediaAsset
  checked: boolean
  onToggle: ResultsProps['onToggle']
}) {
  return (
    <Box
      padding={2}
      onClick={(event) => {
        event.stopPropagation()
        onToggle(asset, event)
      }}
    >
      <Checkbox
        checked={checked}
        readOnly
        aria-label={`Select ${assetName(asset)}`}
        style={{pointerEvents: 'none'}}
      />
    </Box>
  )
}

function openOnKey(asset: MediaAsset, onOpen: ResultsProps['onOpen']) {
  return (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen(asset, event)
    }
  }
}

export function AssetResults(props: ResultsProps) {
  return props.layout === 'grid' ? <AssetGrid {...props} /> : <AssetList {...props} />
}

function AssetGrid({assets, selectedIds, selectable, activeId, onOpen, onToggle}: ResultsProps) {
  const selecting = selectable && selectedIds.size > 0

  return (
    <Box
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
        gap: 12,
      }}
    >
      {assets.map((asset) => {
        const selected = selectedIds.has(asset._id)
        return (
          <Tile
            key={asset._id}
            border
            radius={3}
            tabIndex={0}
            data-checked={selected}
            data-selecting={selecting}
            data-active={asset._id === activeId}
            onClick={(event: MouseEvent) => onOpen(asset, event)}
            onKeyDown={openOnKey(asset, onOpen)}
          >
            <Box style={{aspectRatio: '1 / 1'}}>
              <AssetThumb asset={asset} size={200} />
            </Box>

            {selectable && (
              <Box data-check style={{position: 'absolute', top: 8, left: 8}}>
                <Card radius={2} shadow={1} style={{lineHeight: 0, overflow: 'hidden'}}>
                  <Check asset={asset} checked={selected} onToggle={onToggle} />
                </Card>
              </Box>
            )}

            {hasNoAlt(asset) && (
              <Box style={{position: 'absolute', top: 8, right: 8}}>
                <Badge tone="caution" fontSize={0}>
                  No alt
                </Badge>
              </Box>
            )}

            <Stack gap={2} padding={3}>
              <Text size={1} weight="medium" textOverflow="ellipsis" title={assetName(asset)}>
                {assetName(asset)}
              </Text>
              <Text size={0} muted textOverflow="ellipsis">
                {formatKind(asset)} · {formatBytes(asset.size)}
              </Text>
            </Stack>
          </Tile>
        )
      })}
    </Box>
  )
}

function AssetList({assets, selectedIds, selectable, activeId, onOpen, onToggle}: ResultsProps) {
  return (
    <Card border radius={3} overflow="hidden">
      <Stack>
        {assets.map((asset, index) => {
          const selected = selectedIds.has(asset._id)
          return (
            <Row
              key={asset._id}
              tabIndex={0}
              borderTop={index > 0}
              paddingY={2}
              paddingLeft={selectable ? 1 : 3}
              paddingRight={3}
              selected={selected}
              data-active={asset._id === activeId}
              onClick={(event: MouseEvent) => onOpen(asset, event)}
              onKeyDown={openOnKey(asset, onOpen)}
            >
              <Flex align="center" gap={3}>
                {selectable && <Check asset={asset} checked={selected} onToggle={onToggle} />}
                <Card radius={2} overflow="hidden" style={{width: 44, height: 44, flex: 'none'}}>
                  <AssetThumb asset={asset} size={44} iconSize={1} />
                </Card>
                <Stack gap={2} flex={1} style={{minWidth: 0}}>
                  <Text size={1} weight="medium" textOverflow="ellipsis">
                    {assetName(asset)}
                  </Text>
                  {asset.title && asset.originalFilename && (
                    <Text size={0} muted textOverflow="ellipsis">
                      {asset.originalFilename}
                    </Text>
                  )}
                </Stack>
                {hasNoAlt(asset) && (
                  <Badge tone="caution" fontSize={0} style={{flex: 'none', whiteSpace: 'nowrap'}}>
                    No alt
                  </Badge>
                )}
                <Box data-media-col="kind" style={{width: 110, flex: 'none'}}>
                  <Text size={1} muted>
                    {formatKind(asset)}
                  </Text>
                </Box>
                <Box style={{width: 72, flex: 'none', textAlign: 'right'}}>
                  <Text size={1} muted>
                    {formatBytes(asset.size)}
                  </Text>
                </Box>
                <Box data-media-col="date" style={{width: 100, flex: 'none', textAlign: 'right'}}>
                  <Text size={1} muted>
                    {formatDate(asset._createdAt)}
                  </Text>
                </Box>
              </Flex>
            </Row>
          )
        })}
      </Stack>
    </Card>
  )
}
