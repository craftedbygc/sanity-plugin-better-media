import {UploadIcon} from '@sanity/icons'
import {Box, Button, Card, Checkbox, Dialog, Flex, Stack, Text, useToast} from '@sanity/ui'
import {useId, useRef, useState} from 'react'

import {assetKind, replaceAsset} from '../lib/assets'
import {assetName, errorMessage, formatBytes, isImage} from '../lib/format'
import {useMediaClient} from '../lib/useMediaLibrary'
import type {MediaAsset} from '../types'

/**
 * Swap an asset's file everywhere it's used. Sanity assets can't change their file, so this uploads a new asset,
 * carries the title, alt, description and categories over and points every document at it (see `replaceAsset`).
 */
export function ReplaceDialog(props: {
  asset: MediaAsset
  usedCount: number
  onClose: () => void
  onReplaced: (newId: string) => void
}) {
  const id = useId()
  const client = useMediaClient()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [deleteOld, setDeleteOld] = useState(true)
  const [progress, setProgress] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const image = isImage(props.asset)
  const wrongKind = file && assetKind(file) !== (image ? 'image' : 'file')

  const pick = (files: FileList | null) => {
    if (files?.[0]) setFile(files[0])
  }

  const replace = async () => {
    if (!file) return
    setProgress(0)
    try {
      const result = await replaceAsset(client, props.asset, file, {
        deleteOld,
        onProgress: setProgress,
      })
      const documents = `${result.updatedDocuments} document${result.updatedDocuments === 1 ? '' : 's'}`
      toast.push({
        status: result.dimensionsChanged ? 'warning' : 'success',
        title: `Replaced in ${documents}`,
        description: result.dimensionsChanged
          ? 'The new image is a different size: check crops and hotspots where it’s used.'
          : deleteOld && !result.oldAssetDeleted
            ? 'The old file was kept, because something still uses it.'
            : undefined,
      })
      props.onReplaced(result.asset._id)
      props.onClose()
    } catch (error) {
      toast.push({
        status: 'error',
        title: 'Couldn’t replace the file',
        description: errorMessage(error),
      })
      setProgress(null)
    }
  }

  const isBusy = progress !== null

  return (
    <Dialog
      id={id}
      header={`Replace ${assetName(props.asset)}`}
      width={1}
      onClose={isBusy ? undefined : props.onClose}
      footer={
        <Flex gap={2} justify="flex-end" padding={3}>
          <Button mode="bleed" text="Cancel" onClick={props.onClose} disabled={isBusy} />
          <Button
            tone="primary"
            text={isBusy ? `Uploading ${Math.round(progress)}%` : 'Replace'}
            onClick={replace}
            disabled={!file || Boolean(wrongKind) || isBusy}
            loading={isBusy && progress >= 100}
          />
        </Flex>
      }
    >
      <Stack gap={4} padding={4}>
        <Text size={1} muted>
          {props.usedCount
            ? `The new file takes its place in the ${props.usedCount} document${props.usedCount === 1 ? '' : 's'} that use it, drafts included. Title, alt text, description and categories carry over.`
            : 'Nothing uses this asset yet. Title, alt text, description and categories carry over to the new file.'}
        </Text>

        <Card
          as="button"
          border
          radius={3}
          padding={5}
          tone={isDragging ? 'primary' : wrongKind ? 'critical' : 'default'}
          style={{borderStyle: 'dashed', width: '100%'}}
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragging(false)
            pick(event.dataTransfer.files)
          }}
        >
          <Stack gap={3} style={{textAlign: 'center'}}>
            <Text size={2} muted>
              <UploadIcon />
            </Text>
            <Text size={1} weight="medium">
              {file
                ? file.name
                : `Drop the new ${image ? 'image' : 'file'} here, or click to choose`}
            </Text>
            {file && (
              <Text size={0} muted>
                {wrongKind
                  ? `That’s not ${image ? 'an image' : 'a file of this kind'}`
                  : formatBytes(file.size)}
              </Text>
            )}
          </Stack>
        </Card>
        <input
          ref={input}
          type="file"
          hidden
          accept={image ? 'image/*' : undefined}
          onChange={(event) => pick(event.currentTarget.files)}
        />

        <Flex as="label" align="center" gap={3}>
          <Checkbox
            checked={deleteOld}
            onChange={(event) => setDeleteOld(event.currentTarget.checked)}
          />
          <Box>
            <Text size={1}>Delete the old file afterwards</Text>
          </Box>
        </Flex>
      </Stack>
    </Dialog>
  )
}
