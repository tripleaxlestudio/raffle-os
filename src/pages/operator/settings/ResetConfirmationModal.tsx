import { useState } from 'react'
import { Modal, Button, Icon } from '../../../shared/ui/index.ts'

interface ResetConfirmationModalProps {
  readonly open: boolean
  readonly isResetting: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly onBackupFirst: () => void
}

export function ResetConfirmationModal({
  open,
  isResetting,
  onConfirm,
  onCancel,
  onBackupFirst,
}: ResetConfirmationModalProps) {
  const [confirmationInput, setConfirmationInput] = useState('')

  if (!open) return null

  const isConfirmed = confirmationInput === 'RESET'

  const handleClose = () => {
    setConfirmationInput('')
    onCancel()
  }

  const handleConfirm = () => {
    if (!isConfirmed || isResetting) return
    onConfirm()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Reset Seluruh Data?"
      eyebrow="Tindakan Destruktif"
      headerIcon={<Icon name="TriangleAlert" size={20} />}
      headerIconTone="danger"
      footer={
        <>
          <Button disabled={isResetting} onClick={handleClose} variant="secondary">
            Batal
          </Button>
          <Button
            disabled={!isConfirmed || isResetting}
            icon={<Icon name="Trash2" size={16} />}
            isLoading={isResetting}
            onClick={handleConfirm}
            variant="danger"
          >
            {isResetting ? 'Menghapus Seluruh Data…' : 'Reset Seluruh Data'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div className="kc-confirmation" data-tone="danger">
          <span className="kc-confirmation__marker" aria-hidden="true">
            <Icon name="TriangleAlert" size={16} />
          </span>
          <div>
            <strong>Peringatan Penghapusan Permanen</strong>
            <p style={{ margin: '6px 0 0', fontSize: '13.5px', lineHeight: 1.45 }}>
              Tindakan ini akan menghapus seluruh acara, peserta, hasil undian, riwayat, dan pengaturan lokal Kocokan dari perangkat ini.
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--kc-danger)' }}>
              Tindakan ini tidak dapat dibatalkan kecuali Anda memiliki file backup.
            </p>
          </div>
        </div>

        {/* Optional CTA: Buat Backup Dulu */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid var(--kc-divider)',
            background: 'var(--kc-surface-muted)',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 650 }}>Amankan data terlebih dahulu?</span>
            <span style={{ fontSize: '12.5px', color: 'var(--kc-text-muted)' }}>
              Unduh salinan file backup ke komputer sebelum mereset.
            </span>
          </div>
          <Button
            icon={<Icon name="Download" size={15} />}
            onClick={onBackupFirst}
            size="sm"
            type="button"
            variant="secondary"
          >
            Buat Backup Dulu
          </Button>
        </div>

        {/* Confirmation text input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="reset-confirm-input" style={{ fontSize: '13.5px', fontWeight: 650 }}>
            Ketik <code style={{ color: 'var(--kc-danger)', fontWeight: 800 }}>RESET</code> untuk mengonfirmasi:
          </label>
          <input
            id="reset-confirm-input"
            className="kc-input"
            type="text"
            placeholder="RESET"
            autoComplete="off"
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            disabled={isResetting}
          />
        </div>
      </div>
    </Modal>
  )
}
