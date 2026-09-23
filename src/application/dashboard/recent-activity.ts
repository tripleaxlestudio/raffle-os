import type { AuditRecord } from '../../domain/audit/audit.types.ts'

export type RecentActivityKind =
  | 'event'
  | 'import'
  | 'draw'
  | 'confirmation'
  | 'cancellation'
  | 'redraw'

export interface RecentActivityItem {
  readonly id: string
  readonly kind: RecentActivityKind
  readonly title: string
  readonly detail: string
  readonly timestamp: AuditRecord['timestamp']
  readonly to: string
}

type AuditEvidence = Readonly<Record<string, unknown>>

function evidence(record: AuditRecord): AuditEvidence {
  return typeof record.detail === 'object' && record.detail !== null && !Array.isArray(record.detail)
    ? record.detail as AuditEvidence
    : {}
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function activityRoute(record: AuditRecord, detail: AuditEvidence): string {
  if (record.action === 'participant-import-committed') return '/participants'
  if (record.action === 'event-created' || record.action === 'event-status-changed') return '/events'
  const drawSessionId = stringValue(detail.drawSessionId)
  return drawSessionId === null ? '/history' : `/history/${encodeURIComponent(drawSessionId)}`
}

function groupKey(record: AuditRecord): string {
  const detail = evidence(record)
  const commandId = stringValue(detail.commandId)
  if (commandId !== null && ['winner-confirmed', 'winner-cancelled', 'redraw-recorded'].includes(record.action)) {
    return `${record.action}:${commandId}`
  }
  return String(record.id)
}

function projectGroup(records: readonly AuditRecord[]): RecentActivityItem {
  const latest = records[records.length - 1]!
  const detail = evidence(latest)
  const count = records.length
  const ticketNumber = stringValue(detail.ticketNumber)
  const fileName = stringValue((detail.source as AuditEvidence | undefined)?.fileName)
  const insertedCount = numberValue(detail.insertedParticipantCount)

  switch (latest.action) {
    case 'participant-import-committed':
      return {
        id: String(latest.id), kind: 'import', title: 'Peserta berhasil diimpor',
        detail: insertedCount === null ? (fileName ?? 'Dataset peserta diperbarui') : `${insertedCount} peserta${fileName === null ? '' : ` dari ${fileName}`}`,
        timestamp: latest.timestamp, to: activityRoute(latest, detail),
      }
    case 'draw-session-started':
      return { id: String(latest.id), kind: 'draw', title: 'Undian dimulai', detail: 'Sesi Live resmi mulai dijalankan', timestamp: latest.timestamp, to: activityRoute(latest, detail) }
    case 'draw-session-completed':
      return { id: String(latest.id), kind: 'draw', title: 'Undian resmi diselesaikan', detail: 'Seluruh hasil sesi telah diputuskan', timestamp: latest.timestamp, to: activityRoute(latest, detail) }
    case 'draw-session-cancelled':
      return { id: String(latest.id), kind: 'cancellation', title: 'Sesi undian dibatalkan', detail: 'Bukti pembatalan tersimpan di Riwayat', timestamp: latest.timestamp, to: activityRoute(latest, detail) }
    case 'winner-confirmed':
      return { id: String(latest.id), kind: 'confirmation', title: count === 1 ? 'Pemenang dikonfirmasi' : `${count} pemenang dikonfirmasi`, detail: count === 1 && ticketNumber !== null ? `Tiket ${ticketNumber}` : 'Keputusan operator tersimpan', timestamp: latest.timestamp, to: activityRoute(latest, detail) }
    case 'winner-cancelled':
      return { id: String(latest.id), kind: 'cancellation', title: count === 1 ? 'Pemenang dibatalkan' : `${count} pemenang dibatalkan`, detail: count === 1 && ticketNumber !== null ? `Tiket ${ticketNumber}` : 'Alasan pembatalan tersimpan', timestamp: latest.timestamp, to: activityRoute(latest, detail) }
    case 'redraw-recorded':
      return { id: String(latest.id), kind: 'redraw', title: count === 1 ? 'Undian ulang dicatat' : `${count} hasil undian ulang dicatat`, detail: 'Relasi pemenang asal dan pengganti tersimpan', timestamp: latest.timestamp, to: activityRoute(latest, detail) }
    case 'event-status-changed': {
      const status = stringValue(detail.afterStatus) ?? stringValue(detail.status)
      return { id: String(latest.id), kind: 'event', title: 'Status acara diperbarui', detail: status === null ? 'Perubahan acara tersimpan' : `Status baru: ${status}`, timestamp: latest.timestamp, to: activityRoute(latest, detail) }
    }
    case 'event-created':
      return { id: String(latest.id), kind: 'event', title: 'Acara dibuat', detail: 'Ruang kerja acara mulai disiapkan', timestamp: latest.timestamp, to: activityRoute(latest, detail) }
  }
}

export function projectRecentActivity(records: readonly AuditRecord[], limit = 6): readonly RecentActivityItem[] {
  if (!Number.isInteger(limit) || limit <= 0) return []
  const ordered = [...records].sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id))
  const groups = new Map<string, AuditRecord[]>()
  for (const record of ordered) {
    const key = groupKey(record)
    const group = groups.get(key)
    if (group === undefined) groups.set(key, [record])
    else group.push(record)
  }
  return [...groups.values()]
    .map(projectGroup)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp) || right.id.localeCompare(left.id))
    .slice(0, limit)
}
