import {Box, Dialog} from '@sanity/ui'
import {useId} from 'react'
import type {AssetSourceComponentProps} from 'sanity'

import {MediaBrowser} from './components/MediaBrowser'

/** The library in a dialog, from an image or file field's "Select" menu. A click picks the asset */
export function MediaAssetSource(props: AssetSourceComponentProps) {
  const id = useId()
  const kind = props.assetType === 'file' ? 'file' : 'image'

  const select = (asset: {_id: string}) => {
    props.onSelect([{kind: 'assetDocumentId', value: asset._id}])
  }

  return (
    <Dialog
      id={`better-media-${id}`}
      header={props.dialogHeaderTitle ?? (kind === 'image' ? 'Select an image' : 'Select a file')}
      width={5}
      onClose={props.onClose}
      onClickOutside={props.onClose}
    >
      <Box style={{height: 'min(78vh, 900px)', display: 'flex', flexDirection: 'column'}}>
        <MediaBrowser
          mode="select"
          kind={kind}
          accept={props.accept || (kind === 'image' ? 'image/*' : undefined)}
          currentAssetId={props.selectedAssets?.[0]?._id}
          onSelect={select}
        />
      </Box>
    </Dialog>
  )
}
