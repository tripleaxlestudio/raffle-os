import { useRef } from 'react'
import { Badge, Button, Modal } from '../../../shared/ui/index.ts'

interface PresentationRecoveryDialogProps {
  readonly onBackToSetup: () => void
  readonly onRetry: () => void
}

export function PresentationRecoveryDialog({ onBackToSetup, onRetry }: PresentationRecoveryDialogProps) {
  const backButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      closeOnEscape={false}
      eyebrow="PRESENTATION RECOVERY"
      footer={
        <>
          <Button onClick={onBackToSetup} ref={backButtonRef} variant="secondary">
            Back to Draw Setup
          </Button>
          <Button onClick={onRetry} variant="primary">
            Retry presentation
          </Button>
        </>
      }
      initialFocusRef={backButtonRef}
      onClose={() => undefined}
      open
      showCloseButton={false}
      title="Presentation needs attention"
    >
      <div className="production-recovery-dialog__content">
        <div className="production-recovery-dialog__safe-state">
          <Badge variant="warning">SAFE STATE</Badge>
          <p className="production-recovery-dialog__explanation">
            The presentation stage transition could not continue.
          </p>
          <p className="production-recovery-dialog__preservation">
            Your locked winner result is preserved.
          </p>
          <p className="production-recovery-dialog__supporting-copy">
            You can retry the presentation from the same result or return to Draw Setup.
          </p>
        </div>
      </div>
    </Modal>
  )
}
