import { describe, expect, it } from 'vitest'
import type { AuditRecord } from '../../domain/audit/audit.types.ts'
import { projectRecentActivity } from './recent-activity.ts'

function audit(id: string, action: AuditRecord['action'], timestamp: string, detail: AuditRecord['detail']): AuditRecord {
  return { id: id as AuditRecord['id'], eventId: 'event-1' as AuditRecord['eventId'], action, actor: { type: 'system' }, detail, timestamp: timestamp as AuditRecord['timestamp'] }
}

describe('recent dashboard activity', () => {
  it('orders newest first, preserves ticket strings, and links official draw evidence to History', () => {
    const items = projectRecentActivity([
      audit('audit-1', 'participant-import-committed', '2026-09-21T08:00:00.000Z', { insertedParticipantCount: 300, source: { fileName: 'peserta.xlsx' } }),
      audit('audit-2', 'winner-confirmed', '2026-09-21T09:00:00.000Z', { commandId: 'command-1', drawSessionId: 'session/1', ticketNumber: '00042' }),
    ])

    expect(items.map((item) => item.title)).toEqual(['Pemenang dikonfirmasi', 'Peserta berhasil diimpor'])
    expect(items[0]).toMatchObject({ detail: 'Tiket 00042', to: '/history/session%2F1' })
    expect(items[1]).toMatchObject({ detail: '300 peserta dari peserta.xlsx', to: '/participants' })
  })

  it('groups winners from one official command without changing the underlying audit records', () => {
    const records = [
      audit('audit-a', 'winner-confirmed', '2026-09-21T09:00:00.000Z', { commandId: 'command-1', drawSessionId: 'session-1', ticketNumber: '00001' }),
      audit('audit-b', 'winner-confirmed', '2026-09-21T09:00:00.000Z', { commandId: 'command-1', drawSessionId: 'session-1', ticketNumber: '00002' }),
    ]

    expect(projectRecentActivity(records)).toEqual([expect.objectContaining({ title: '2 pemenang dikonfirmasi', detail: 'Keputusan operator tersimpan' })])
    expect(records).toHaveLength(2)
  })

  it('limits the feed after grouping and safely handles a non-positive limit', () => {
    const records = Array.from({ length: 8 }, (_, index) => audit(`audit-${index}`, 'event-created', `2026-09-21T0${index}:00:00.000Z`, {}))
    expect(projectRecentActivity(records)).toHaveLength(6)
    expect(projectRecentActivity(records, 2).map((item) => item.id)).toEqual(['audit-7', 'audit-6'])
    expect(projectRecentActivity(records, 0)).toEqual([])
  })
})
