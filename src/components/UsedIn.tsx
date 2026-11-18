import {Badge, Box, Card, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {useEffect, useState} from 'react'
import {Preview, useSchema} from 'sanity'
import {useIntentLink} from 'sanity/router'

import {REFERENCING_DOCUMENTS} from '../lib/queries'
import {useMediaClient} from '../lib/useMediaLibrary'

interface UsingDocument {
  /** The id without `drafts.` / `versions.…` */
  id: string
  type: string
  /** The id to preview: the published one when it exists, else the draft or version */
  previewId: string
  states: Array<'published' | 'draft' | 'version'>
}

const baseId = (id: string) => id.replace(/^drafts\./, '').replace(/^versions\.[^.]+\./, '')

/** Folds the published, draft and release versions of a document into one row */
function group(docs: {_id: string; _type: string}[]): UsingDocument[] {
  const byId = new Map<string, UsingDocument>()

  for (const doc of docs) {
    const id = baseId(doc._id)
    const state = doc._id.startsWith('drafts.')
      ? 'draft'
      : doc._id.startsWith('versions.')
        ? 'version'
        : 'published'
    const entry = byId.get(id) ?? {id, type: doc._type, previewId: doc._id, states: []}
    if (state === 'published') entry.previewId = doc._id
    else if (!entry.states.includes('published') && state === 'draft') entry.previewId = doc._id
    if (!entry.states.includes(state)) entry.states.push(state)
    byId.set(id, entry)
  }

  return [...byId.values()]
}

/**
 * The documents that use an asset, drafts and release versions included, so the count is what deleting would
 * break. Reports the count up for the delete and replace buttons.
 */
export function useUsingDocuments(assetId: string) {
  const client = useMediaClient()
  // Keyed by asset, so switching assets shows "checking" rather than the last asset's documents
  const [result, setResult] = useState<{assetId: string; documents: UsingDocument[]} | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      let documents: UsingDocument[] = []
      try {
        const docs = await client
          .withConfig({perspective: 'raw'})
          .fetch<{_id: string; _type: string}[]>(REFERENCING_DOCUMENTS, {id: assetId})
        documents = group(docs)
      } catch {
        // Shown as unused; deleting a used asset is still refused by Sanity
      }
      if (!cancelled) setResult({assetId, documents})
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [assetId, client])

  return result?.assetId === assetId ? result.documents : null
}

function UsingRow({doc}: {doc: UsingDocument}) {
  const schema = useSchema()
  const schemaType = schema.get(doc.type)
  const {href, onClick} = useIntentLink({intent: 'edit', params: {id: doc.id, type: doc.type}})

  // A document whose type this Studio doesn't define (left over from a removed type): it still counts as a use,
  // but there's nothing to preview or open
  if (!schemaType) {
    return (
      <Card radius={2} padding={3} tone="transparent">
        <Stack gap={2}>
          <Text size={1} weight="medium" textOverflow="ellipsis">
            {doc.type}
          </Text>
          <Text size={0} muted textOverflow="ellipsis" title={doc.id}>
            Not a type in this Studio · {doc.id}
          </Text>
        </Stack>
      </Card>
    )
  }

  return (
    <Card as="a" href={href} onClick={onClick} radius={2} padding={1}>
      <Flex align="center" gap={2}>
        <Box flex={1} style={{minWidth: 0}}>
          <Preview
            schemaType={schemaType}
            value={{_id: doc.previewId, _type: doc.type}}
            layout="default"
          />
        </Box>
        {!doc.states.includes('published') && (
          <Badge fontSize={0} tone={doc.states.includes('draft') ? 'caution' : 'primary'}>
            {doc.states.includes('draft') ? 'Draft' : 'Release'}
          </Badge>
        )}
      </Flex>
    </Card>
  )
}

export function UsedIn({documents}: {documents: UsingDocument[] | null}) {
  if (!documents) {
    return (
      <Flex padding={2} gap={2} align="center">
        <Spinner muted size={1} />
        <Text size={1} muted>
          Checking where it’s used…
        </Text>
      </Flex>
    )
  }

  if (!documents.length) {
    return (
      <Card tone="transparent" radius={2} padding={3}>
        <Text size={1} muted>
          Not used anywhere. It’s safe to delete.
        </Text>
      </Card>
    )
  }

  return (
    <Stack gap={1}>
      {documents.map((doc) => (
        <UsingRow key={doc.id} doc={doc} />
      ))}
    </Stack>
  )
}
