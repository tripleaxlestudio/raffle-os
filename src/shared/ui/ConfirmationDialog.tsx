import { useRef, type ReactNode } from 'react'
import { Button } from './Button.tsx'
import { Modal } from './Modal.tsx'

interface ConfirmationDialogProps {
  cancelLabel?: string
  confirmLabel: string
  consequence: ReactNode
  onCancel: () => void
  onConfirm: () => void
  open: boolean
  title: string
  tone?: 'warning' | 'danger'
}

export function ConfirmationDialog({
  cancelLabel = 'Cancel',
  confirmLabel,
  consequence,
  onCancel,
  onConfirm,
  open,
  title,
  tone = 'warning',
}: ConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      footer={
        <>
          <Button
            onClick={onCancel}
            ref={cancelButtonRef}
            variant="secondary"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            variant={tone === 'danger' ? 'danger' : 'primary'}
          >
            {confirmLabel}
          </Button>
        </>
      }
      initialFocusRef={cancelButtonRef}
      onClose={onCancel}
      open={open}
      title={title}
    >
      <div className="ui-confirmation" data-tone={tone}>
        <span aria-hidden="true" className="ui-confirmation__marker">
          !
        </span>
        <div>
          <strong>Review the consequence</strong>
          <p>{consequence}</p>
        </div>
      </div>
    </Modal>
  )
}
