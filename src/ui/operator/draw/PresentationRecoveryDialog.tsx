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
      eyebrow="PEMULIHAN PRESENTASI"
      footer={
        <>
          <Button onClick={onBackToSetup} ref={backButtonRef} variant="quiet">
            Kembali ke Pengaturan Undian
          </Button>
          {reviewPendingResultsAvailable && onReviewPendingResults !== undefined ? <Button onClick={onReviewPendingResults} ref={reviewButtonRef}>
            Tinjau Pemenang
          </Button> : null}
        </>
      }
      initialFocusRef={initialFocusRef}
      onClose={() => undefined}
      open
      showCloseButton={false}
      title="Hasil pemenang tersimpan dengan aman"
    >
      <div className="production-recovery-dialog__content">
        <div className="production-recovery-dialog__safe-state">
          <Badge variant="warning">STATUS AMAN</Badge>
          <p className="production-recovery-dialog__explanation">
            Pemenang yang dipilih telah dicatat dengan aman.
          </p>
          <p className="production-recovery-dialog__preservation">
            Lanjutkan peninjauan untuk mengonfirmasi hasil atau mengundi pengganti bila diperlukan.
          </p>
        </div>
      </div>
    </Modal>
  )
}
