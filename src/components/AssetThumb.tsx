import {DocumentIcon} from '@sanity/icons'
import {Card, Flex, Stack, Text} from '@sanity/ui'

import {formatKind, isImage, thumbnailUrl} from '../lib/format'
import type {MediaAsset} from '../types'

/**
 * An asset's picture: the image on a checkerboard (so transparent PNGs read), or a file icon with its extension.
 * Fills its parent; the parent sets the size.
 */
export function AssetThumb({
  asset,
  size,
  iconSize = 2,
}: {
  asset: MediaAsset
  size: number
  iconSize?: number
}) {
  if (isImage(asset)) {
    return (
      <Card tone="transparent" style={{width: '100%', height: '100%'}}>
        <img
          src={thumbnailUrl(asset, size * 2)}
          alt={asset.altText || ''}
          loading="lazy"
          draggable={false}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            // The blurred placeholder fills the square until the thumbnail arrives
            backgroundImage: asset.lqip ? `url(${asset.lqip})` : undefined,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      </Card>
    )
  }

  return (
    <Card tone="transparent" style={{width: '100%', height: '100%'}}>
      <Flex align="center" justify="center" height="fill">
        <Stack gap={2} style={{textAlign: 'center'}}>
          <Text size={iconSize} muted>
            <DocumentIcon />
          </Text>
          {iconSize > 1 && (
            <Text size={0} weight="semibold" muted>
              {formatKind(asset)}
            </Text>
          )}
        </Stack>
      </Flex>
    </Card>
  )
}
