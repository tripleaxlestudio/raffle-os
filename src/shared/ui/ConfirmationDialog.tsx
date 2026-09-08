import { useUiClass, useUiTheme } from './ui-theme.ts'
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
  confirmDisabled?: boolean
  confirmLoading?: boolean
  consequenceLabel?: string | null
  confirmIcon?: ReactNode
  cancelIcon?: ReactNode
  headerIcon?: ReactNode
  headerIconTone?: 'warning' | 'danger' | 'success' | 'info'
  closeAriaLabel?: string
  closeLabel?: string
  consequenceIcon?: ReactNode
  structuredConsequence?: boolean
  eyebrow?: string
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
  confirmDisabled = false,
  confirmLoading = false,
  consequenceLabel = 'Review the consequence',
  confirmIcon,
  cancelIcon,
  headerIcon,
  headerIconTone,
  closeAriaLabel,
  closeLabel,
  consequenceIcon,
  structuredConsequence = false,
  eyebrow,
}: ConfirmationDialogProps) {
  const ui = useUiClass()
  const theme = useUiTheme()
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      footer={
        <>
          <Button
            icon={cancelIcon}
            onClick={onCancel}
            ref={cancelButtonRef}
            variant="secondary"
          >
            {cancelLabel}
          </Button>
          <Button
            icon={confirmIcon}
            disabled={confirmDisabled}
            isLoading={confirmLoading}
            onClick={onConfirm}
            variant={tone === 'danger' ? 'danger' : 'primary'}
          >
            {confirmLabel}
          </Button>
        </>
      }
      initialFocusRef={cancelButtonRef}
      headerIcon={headerIcon}
      headerIconTone={headerIconTone ?? (theme === 'kocokan' ? tone : undefined)}
      closeAriaLabel={closeAriaLabel}
      closeLabel={closeLabel}
      eyebrow={eyebrow}
      onClose={onCancel}
      open={open}
      title={title}
    >
      <div className={ui("ui-confirmation")} data-tone={tone}>
        <span aria-hidden="true" className={ui("ui-confirmation__marker")}>
          {consequenceIcon ?? '!'}
        </span>
        <div>
          {consequenceLabel === null ? null : <strong>{consequenceLabel}</strong>}
          {structuredConsequence ? (
            <div className={ui("ui-confirmation__consequence")}>{consequence}</div>
          ) : (
            <p>{consequence}</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
