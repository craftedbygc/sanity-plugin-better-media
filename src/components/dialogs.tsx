import {Box, Button, Dialog, Flex, Stack, Text, TextInput} from '@sanity/ui'
import {useId, useState, type ReactNode} from 'react'

/** "Are you sure?" with a cancel and a (usually red) confirm button */
export function ConfirmDialog(props: {
  title: string
  children: ReactNode
  confirmText: string
  tone?: 'critical' | 'primary'
  onConfirm: () => Promise<unknown> | void
  onClose: () => void
}) {
  const id = useId()
  const [isBusy, setIsBusy] = useState(false)

  const confirm = async () => {
    setIsBusy(true)
    try {
      await props.onConfirm()
      props.onClose()
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Dialog
      id={id}
      header={props.title}
      width={1}
      onClose={isBusy ? undefined : props.onClose}
      footer={
        <Flex gap={2} justify="flex-end" padding={3}>
          <Button mode="bleed" text="Cancel" onClick={props.onClose} disabled={isBusy} />
          <Button
            tone={props.tone ?? 'critical'}
            text={props.confirmText}
            onClick={confirm}
            loading={isBusy}
          />
        </Flex>
      }
    >
      <Box padding={4}>
        <Stack gap={3}>
          {typeof props.children === 'string' ? (
            <Text size={1}>{props.children}</Text>
          ) : (
            props.children
          )}
        </Stack>
      </Box>
    </Dialog>
  )
}

/** One text field: creating and renaming categories */
export function NameDialog(props: {
  title: string
  initialValue?: string
  confirmText: string
  /** Return an error message to keep the dialog open */
  validate?: (name: string) => string | undefined
  onConfirm: (name: string) => Promise<unknown>
  onClose: () => void
}) {
  const id = useId()
  const [name, setName] = useState(props.initialValue ?? '')
  const [isBusy, setIsBusy] = useState(false)
  const error = name.trim() ? props.validate?.(name.trim()) : undefined
  const canSave = Boolean(name.trim()) && !error && name.trim() !== props.initialValue

  const save = async () => {
    if (!canSave) return
    setIsBusy(true)
    try {
      await props.onConfirm(name.trim())
      props.onClose()
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Dialog
      id={id}
      header={props.title}
      width={1}
      onClose={isBusy ? undefined : props.onClose}
      footer={
        <Flex gap={2} justify="flex-end" padding={3}>
          <Button mode="bleed" text="Cancel" onClick={props.onClose} disabled={isBusy} />
          <Button
            tone="primary"
            text={props.confirmText}
            onClick={save}
            disabled={!canSave}
            loading={isBusy}
          />
        </Flex>
      }
    >
      <Box padding={4}>
        <Stack gap={3}>
          <TextInput
            autoFocus
            value={name}
            placeholder="Category name"
            customValidity={error}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => event.key === 'Enter' && save()}
          />
          {error && (
            <Text size={1} style={{color: 'var(--card-badge-critical-fg-color)'}}>
              {error}
            </Text>
          )}
        </Stack>
      </Box>
    </Dialog>
  )
}
