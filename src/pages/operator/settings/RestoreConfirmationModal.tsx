import { Modal, Button, Icon } from '../../../shared/ui/index.ts'
import type { BackupPreviewSummary } from '../../../application/storage/storage-types.ts'

interface RestoreConfirmationModalProps {
  readonly open: boolean
  readonly preview: BackupPreviewSummary | null
  readonly isRestoring: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function RestoreConfirmationModal({
  open,
  preview,
  isRestoring,
  onConfirm,
  onCancel,
}: RestoreConfirmationModalProps) {
  if (!open || preview === null) return null

  const formattedDate = new Date(preview.createdAt).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Pulihkan Backup?"
      eyebrow="Data & Penyimpanan"
      description="Data dari backup akan menggantikan seluruh data Kocokan yang saat ini tersimpan di perangkat ini."
      headerIcon={<Icon name="Upload" size={20} />}
      headerIconTone="info"
      footer={
        <>
          <Button disabled={isRestoring} onClick={onCancel} variant="secondary">
            Batal
          </Button>
          <Button
            disabled={isRestoring}
            icon={<Icon name="Upload" size={16} />}
            isLoading={isRestoring}
            onClick={onConfirm}
            variant="primary"
          >
            {isRestoring ? 'Memulihkan Data…' : 'Pulihkan Backup'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="kc-table-frame">
          <table className="kc-table">
            <tbody>
              <tr>
                <th scope="row" style={{ width: '180px' }}>Tanggal Backup</th>
                <td>{formattedDate}</td>
              </tr>
              <tr>
                <th scope="row">Versi Backup</th>
                <td>v{preview.version} ({preview.appVersion})</td>
              </tr>
              <tr>
                <th scope="row">Jumlah Acara</th>
                <td><strong>{preview.eventCount.toLocaleString('id-ID')}</strong> acara</td>
              </tr>
              <tr>
                <th scope="row">Jumlah Peserta</th>
                <td><strong>{preview.participantCount.toLocaleString('id-ID')}</strong> peserta</td>
              </tr>
              <tr>
                <th scope="row">Riwayat Undian Resmi</th>
                <td><strong>{preview.officialHistoryCount.toLocaleString('id-ID')}</strong> sesi resmi ({preview.totalSessionsCount} total)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="kc-confirmation" data-tone="warning">
          <span className="kc-confirmation__marker" aria-hidden="true">
            <Icon name="TriangleAlert" size={16} />
          </span>
          <div>
            <strong>Perhatian Penggantian Data</strong>
            <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
              Database lokal saat ini akan ditimpa secara penuh dengan isi file backup ini.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  )
}
