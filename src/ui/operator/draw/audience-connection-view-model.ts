import type { OperatorPublisherDiagnostics, PublisherStatus } from '../../../application/display-transport/operator-publisher.ts'
import type { BadgeVariant } from '../../../shared/ui/Badge.tsx'

export interface AudienceConnectionPresentation {
  readonly label: 'Terhubung' | 'Menunggu' | 'Tidak tersedia' | 'Publikasi gagal'
  readonly tone: BadgeVariant
  readonly detail: string
  readonly acknowledged: boolean
  readonly acknowledgedAt: string | undefined
}

export function presentAudienceConnection(status: PublisherStatus, diagnostics: OperatorPublisherDiagnostics | undefined): AudienceConnectionPresentation {
  const acknowledged = diagnostics?.lastAcknowledgement !== undefined
  const acknowledgedAt = acknowledged ? diagnostics?.lastSnapshotTimestamp : undefined
  if (status.kind === 'transport-error' || status.kind === 'projection-error' || status.kind === 'closed') return { label: status.kind === 'transport-error' ? 'Publikasi gagal' : 'Tidak tersedia', tone: 'danger', detail: 'Tampilan Audiens saat ini tidak dapat menerima snapshot publik tepercaya.', acknowledged, acknowledgedAt }
  if (status.kind === 'audience-presence' && status.status === 'connected' && acknowledged) return { label: 'Terhubung', tone: 'success', detail: 'Tampilan Audiens aktif dan snapshot publik terakhir telah dikonfirmasi.', acknowledged: true, acknowledgedAt }
  if (status.kind === 'snapshot-applied' && acknowledged) return { label: 'Terhubung', tone: 'success', detail: 'Snapshot publik terakhir telah diterapkan dan dikonfirmasi oleh Tampilan Audiens.', acknowledged: true, acknowledgedAt }
  if (acknowledged) return { label: 'Terhubung', tone: 'success', detail: 'Snapshot publik terakhir telah dikonfirmasi; menunggu pembaruan kehadiran berikutnya.', acknowledged: true, acknowledgedAt }
  return { label: 'Menunggu', tone: 'warning', detail: 'Transport siap, tetapi belum ada konfirmasi dari Tampilan Audiens.', acknowledged: false, acknowledgedAt }
}
