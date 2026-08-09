import { describe, expect, it } from 'vitest'
import { projectAuditTimeline } from './audit-timeline.ts'
import type { HistoryReconstruction } from './history-read-model.ts'

describe('audit timeline projection', () => {
  it('sorts equal timestamps by stable audit ID and preserves redraw context', () => {
    const reconstruction = { kind: 'incomplete', value: { session: { id: 'session-1' }, winners: [{ winnerRecordId: 'winner-1', ticketNumber: '00042' }], lineages: [{ originalWinnerRecordId: 'winner-1', originalTicketNumber: '00042', replacementTicketNumber: '42', replacementWinnerRecordId: 'winner-2', reason: 'other' }], audits: [{ id: 'audit-b', action: 'redraw-recorded', actor: { type: 'operator', name: 'Alex' }, detail: { drawSessionId: 'session-1', originalWinnerId: 'winner-1', replacementWinnerId: 'winner-2', reason: 'other', normalizedNote: 'manual review' }, eventId: 'event-1', timestamp: '2026-08-08T10:00:00.000Z' }, { id: 'audit-a', action: 'winner-cancelled', actor: { type: 'operator', name: 'Alex' }, detail: { drawSessionId: 'session-1', winnerId: 'winner-1', ticketNumber: '00042', reason: 'other', normalizedNote: 'manual review' }, eventId: 'event-1', timestamp: '2026-08-08T10:00:00.000Z' }] } } as unknown as HistoryReconstruction
    const result = projectAuditTimeline(reconstruction)
    expect(result.map((entry) => entry.id)).toEqual(['audit-a', 'audit-b'])
    expect(result[1]).toMatchObject({ originalTicketNumber: '00042', replacementTicketNumber: '42', reason: 'other', note: 'manual review', actor: 'Alex' })
  })
  it('keeps unknown actions as safe fallback evidence', () => { const result = projectAuditTimeline({ kind: 'complete', value: { session: { id: 'session-1' }, winners: [], lineages: [], audits: [{ id: 'audit-1', action: 'future-action', actor: { type: 'system' }, detail: { drawSessionId: 'session-1' }, eventId: 'event-1', timestamp: '2026-08-08T10:00:00.000Z' }] } } as unknown as HistoryReconstruction); expect(result[0]?.action).toBe('Unknown audit action') })
})
