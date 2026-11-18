import {CheckmarkIcon, WarningOutlineIcon} from '@sanity/icons'
import {Box, Card, Flex, Stack, Text, useToast} from '@sanity/ui'
import {useCallback, useEffect, useState} from 'react'
import type {SanityDocument} from 'sanity'

import {addTagToAssets, assetKind, tagIdsOf, uploadFile} from '../lib/assets'
import {errorMessage} from '../lib/format'
import {useMediaClient} from '../lib/useMediaLibrary'
import type {AssetKind} from '../types'

interface Upload {
  key: string
  name: string
  percent: number
  status: 'uploading' | 'done' | 'failed'
  error?: string
}

// Finished uploads stay listed this long, so the editor sees they landed
const CLEAR_DELAY = 4000

/**
 * Uploads files one request each, tracking progress. With a category open, new assets go into it.
 * In select mode (`kind` set) files of the other kind are turned away.
 */
export function useUploads(
  kind?: AssetKind,
  onUploaded?: (document: SanityDocument, tagIds: string[]) => void,
) {
  const client = useMediaClient()
  const toast = useToast()
  const [uploads, setUploads] = useState<Upload[]>([])

  const update = (key: string, change: Partial<Upload>) =>
    setUploads((previous) =>
      previous.map((upload) => (upload.key === key ? {...upload, ...change} : upload)),
    )

  const start = useCallback(
    (files: File[], tagId?: string) => {
      const accepted = kind ? files.filter((file) => assetKind(file) === kind) : files
      if (accepted.length < files.length) {
        toast.push({
          status: 'warning',
          title: `Only ${kind === 'image' ? 'images' : 'files'} can be used here`,
          description: `${files.length - accepted.length} skipped`,
        })
      }

      for (const file of accepted) {
        const key = `${file.name}-${Math.random().toString(36).slice(2)}`
        setUploads((previous) => [
          ...previous,
          {key, name: file.name, percent: 0, status: 'uploading'},
        ])

        const run = async () => {
          try {
            const document = await uploadFile(client, file, (percent) => update(key, {percent}))
            const tagIds = tagIdsOf(document)
            if (tagId) await addTagToAssets(client, [{_id: document._id, tagIds}], tagId)
            update(key, {status: 'done', percent: 100})
            onUploaded?.(document, tagId && !tagIds.includes(tagId) ? [...tagIds, tagId] : tagIds)
          } catch (error) {
            update(key, {status: 'failed', error: errorMessage(error)})
          }
        }
        void run()
      }
    },
    [client, kind, onUploaded, toast],
  )

  // Clear the list once everything has finished
  const isIdle = uploads.length > 0 && uploads.every((upload) => upload.status !== 'uploading')
  useEffect(() => {
    const timeout = isIdle
      ? setTimeout(
          () =>
            setUploads((previous) => previous.filter((upload) => upload.status === 'uploading')),
          CLEAR_DELAY,
        )
      : undefined
    return () => clearTimeout(timeout)
  }, [isIdle])

  return {uploads, start}
}

export function UploadProgress({uploads}: {uploads: Upload[]}) {
  if (!uploads.length) return null
  const done = uploads.filter((upload) => upload.status !== 'uploading').length

  return (
    <Card shadow={3} radius={3} padding={3} style={{width: 300}}>
      <Stack gap={3}>
        <Text size={1} weight="medium">
          {done < uploads.length
            ? `Uploading ${done + 1} of ${uploads.length}`
            : `Uploaded ${uploads.filter((upload) => upload.status === 'done').length} of ${uploads.length}`}
        </Text>
        <Stack gap={3} style={{maxHeight: 200, overflowY: 'auto'}}>
          {uploads.map((upload) => (
            <Stack key={upload.key} gap={2}>
              <Flex align="center" gap={2}>
                <Box flex={1} style={{minWidth: 0}}>
                  <Text size={1} muted textOverflow="ellipsis" title={upload.error}>
                    {upload.name}
                  </Text>
                </Box>
                {upload.status === 'done' && (
                  <Text size={1} style={{color: 'var(--card-badge-positive-fg-color)'}}>
                    <CheckmarkIcon />
                  </Text>
                )}
                {upload.status === 'failed' && (
                  <Text
                    size={1}
                    style={{color: 'var(--card-badge-critical-fg-color)'}}
                    title={upload.error}
                  >
                    <WarningOutlineIcon />
                  </Text>
                )}
              </Flex>
              {upload.status === 'uploading' && (
                <Card tone="transparent" radius={2} style={{height: 3, overflow: 'hidden'}}>
                  <Box
                    style={{
                      height: '100%',
                      width: `${upload.percent}%`,
                      background: 'var(--card-focus-ring-color)',
                      transition: 'width 150ms ease',
                    }}
                  />
                </Card>
              )}
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Card>
  )
}
