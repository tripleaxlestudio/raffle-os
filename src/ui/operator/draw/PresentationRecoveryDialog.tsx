import { useRef } from 'react'
import { Badge, Button, Modal } from '../../../shared/ui/index.ts'

interface PresentationRecoveryDialogProps {
  readonly onBackToSetup: () => void
  readonly onReviewPendingResults?: () => void
  readonly reviewPendingResultsAvailable?: boolean
}

export function PresentationRecoveryDialog({ onBackToSetup, onReviewPendingResults, reviewPendingResultsAvailable = false }: PresentationRecoveryDialogProps) {
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const reviewButtonRef = useRef<HTMLButtonElement>(null)
  const initialFocusRef = reviewPendingResultsAvailable ? reviewButtonRef : backButtonRef

  return (
    <Modal
      closeOnEscape={false}
      eyebrow="PRESENTATION RECOVERY"
      footer={
        <>
          <Button onClick={onBackToSetup} ref={backButtonRef} variant="quiet">
            Back to Draw Setup
          </Button>
          {reviewPendingResultsAvailable && onReviewPendingResults !== undefined ? <Button onClick={onReviewPendingResults} ref={reviewButtonRef}>
            Review Winner
          </Button> : null}
        </>
      }
      initialFocusRef={initialFocusRef}
      onClose={() => undefined}
      open
      showCloseButton={false}
      title="Winner result safely saved"
    >
      <div className="production-recovery-dialog__content">
        <div className="production-recovery-dialog__safe-state">
          <Badge variant="warning">SAFE STATE</Badge>
          <p className="production-recovery-dialog__explanation">
            The selected winner is safely recorded.
          </p>
          <p className="production-recovery-dialog__preservation">
            Continue to review the winner to confirm the result or draw a replacement if needed.
          </p>
        </div>
      </div>
    </Modal>
  )
}
