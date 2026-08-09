import { describe, expect, it } from 'vitest'
import { reconstructOfficialHistorySession, type HistoryReadRepositories } from './history-read-model.ts'
import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { AuditRecord } from '../../domain/audit/audit.types.ts'
import type { RedrawRecord } from '../../domain/winners/redraw.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { DrawSessionId, WinnerRecordId } from '../../domain/shared/identifiers.ts'

const ids = {
  category: 'category-1' as PrizeCategory['id'],
  configuration: 'configuration-1' as DrawConfiguration['id'],
  event: 'event-1' as Event['id'],
  original: 'winner-1' as WinnerRecordId,
  replacement: 'winner-2' as WinnerRecordId,
  session: 'session-1' as DrawSessionId,
}
const timestamps = {
  draw: '2026-08-01T10:00:00.000Z' as DrawSession['createdAt'],
  winner: '2026-08-01T10:01:00.000Z' as WinnerRecord['createdAt'],
  redraw: '2026-08-01T10:02:00.000Z' as RedrawRecord['createdAt'],
}

const event: Event = { createdAt: timestamps.draw, id: ids.event, name: 'History Event', status: 'completed', updatedAt: timestamps.redraw }
const category: PrizeCategory = { createdAt: timestamps.draw, displayOrder: 1, eventId: ids.event, id: ids.category, name: 'Grand Prize', prizeName: 'Electric Scooter' }
const configuration: DrawConfiguration = { createdAt: timestamps.draw, eligibleGroupFilter: null, eventId: ids.event, id: ids.configuration, prizeCategoryId: ids.category, requestedWinners: 2, requireCheckIn: true, updatedAt: timestamps.draw, winningRule: 'once-per-event' }
const session: DrawSession = {
  candidatePoolSnapshot: { candidateEntries: [{ participantId: 'participant-1' as WinnerRecord['participantId'], ticketNumber: '00042' as WinnerRecord['ticketNumber'] }, { participantId: 'participant-2' as WinnerRecord['participantId'], ticketNumber: '42' as WinnerRecord['ticketNumber'] }], capturedAt: timestamps.draw, configurationId: ids.configuration, eventId: ids.event, eligibleGroupFilter: null, eligibleSnapshotCount: 2, mode: 'live', prizeCategoryId: ids.category, requireCheckIn: true, snapshotFormatVersion: 1, winningRule: 'once-per-event' },
  completedAt: timestamps.redraw,
  configurationId: ids.configuration,
  configurationSnapshot: { capturedAt: timestamps.draw, categoryName: category.name, configurationId: ids.configuration, eligibleGroupFilter: null, prizeCategoryId: ids.category, prizeName: category.prizeName, requestedWinners: 2, requireCheckIn: true, snapshotFormatVersion: 1, winningRule: 'once-per-event' },
  createdAt: timestamps.draw, eventId: ids.event, id: ids.session, mode: 'live', status: 'completed', updatedAt: timestamps.redraw,
}
const original: WinnerRecord = { cancelledAt: timestamps.redraw, createdAt: timestamps.winner, drawSessionId: ids.session, eventId: ids.event, id: ids.original, participantId: 'participant-1' as WinnerRecord['participantId'], prizeCategoryId: ids.category, sequenceNumber: 1, status: 'cancelled', ticketNumber: '00042' as WinnerRecord['ticketNumber'], updatedAt: timestamps.redraw }
const replacement: WinnerRecord = { confirmedAt: timestamps.redraw, createdAt: timestamps.redraw, drawSessionId: ids.session, eventId: ids.event, id: ids.replacement, participantId: 'participant-2' as WinnerRecord['participantId'], prizeCategoryId: ids.category, sequenceNumber: 2, status: 'confirmed', ticketNumber: '42' as WinnerRecord['ticketNumber'], updatedAt: timestamps.redraw }
const redraw: RedrawRecord = { createdAt: timestamps.redraw, drawSessionId: ids.session, eventId: ids.event, id: 'redraw-1' as RedrawRecord['id'], originalWinnerRecordId: ids.original, reason: 'other', reasonNote: 'Manual review', replacementWinnerRecordId: ids.replacement }
const audit: AuditRecord = { action: 'redraw-recorded', actor: { name: 'Operator', type: 'operator' }, detail: { originalWinnerId: ids.original, replacementWinnerId: ids.replacement }, eventId: ids.event, id: 'audit-1' as AuditRecord['id'], timestamp: timestamps.redraw }

function repositories(overrides: Partial<{ event: Event | null; category: PrizeCategory | null; configuration: DrawConfiguration | null; winners: WinnerRecord[]; redraws: RedrawRecord[]; audits: AuditRecord[] }> = {}): HistoryReadRepositories {
  const values = { audits: [audit], category, configuration, event, redraws: [redraw], winners: [original, replacement], ...overrides }
  return {
    audits: { findByEventId: async () => values.audits },
    categories: { findById: async () => values.category },
    configurations: { findById: async () => values.configuration },
    events: { findById: async () => values.event },
    redraws: { findByDrawSessionId: async () => values.redraws },
    sessions: { findById: async () => session },
    winners: { findByDrawSessionId: async () => values.winners },
  }
}

describe('reconstructOfficialHistorySession', () => {
  it('reconstructs complete Live history and preserves exact ticket strings and lineage', async () => {
    const result = await reconstructOfficialHistorySession(ids.session, repositories())
    expect(result?.kind).toBe('complete')
    if (result?.kind !== 'complete') return
    expect(result.value.summary).toMatchObject({ eligibleCount: 2, eventName: 'History Event', requestedWinnerCount: 2, categoryName: 'Grand Prize', prizeName: 'Electric Scooter' })
    expect(result.value.winners.map((winner) => winner.ticketNumber)).toEqual(['00042', '42'])
    expect(result.value.lineages[0]).toMatchObject({ originalTicketNumber: '00042', replacementTicketNumber: '42', reason: 'other', reasonNote: 'Manual review', redrawRecordId: 'redraw-1' })
    expect(result.value.winners[0]?.status).toBe('cancelled')
  })

  it('keeps pending winners visible without treating them as confirmed', async () => {
    const pending: WinnerRecord = { ...replacement, confirmedAt: undefined, id: 'winner-pending' as WinnerRecordId, sequenceNumber: 3, status: 'pending', ticketNumber: '00043' as WinnerRecord['ticketNumber'] }
    const result = await reconstructOfficialHistorySession(ids.session, repositories({ winners: [original, pending], redraws: [] }))
    expect(result?.kind).toBe('complete')
    if (result?.kind !== 'complete') return
    expect(result.value.winners.find((winner) => winner.status === 'pending')?.ticketNumber).toBe('00043')
  })

  it('returns typed incomplete evidence for missing relationships', async () => {
    const result = await reconstructOfficialHistorySession(ids.session, repositories({ event: null, category: null, redraws: [{ ...redraw, originalWinnerRecordId: 'missing-original' as WinnerRecordId }] }))
    expect(result?.kind).toBe('incomplete')
    expect(result && result.value.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['missing-event', 'missing-category', 'missing-redraw-original']))
    expect(result && result.value.winners).toHaveLength(2)
  })

  it('orders winners by sequence and audits/redraws by timestamp then stable ID', async () => {
    const secondAudit: AuditRecord = { ...audit, id: 'audit-0' as AuditRecord['id'] }
    const secondRedraw: RedrawRecord = { ...redraw, id: 'redraw-0' as RedrawRecord['id'] }
    const result = await reconstructOfficialHistorySession(ids.session, repositories({ audits: [audit, secondAudit], redraws: [secondRedraw, redraw] }))
    expect(result?.value.audits.map((entry) => entry.id)).toEqual(['audit-0', 'audit-1'])
    expect(result?.value.redraws.map((entry) => entry.id)).toEqual(['redraw-0', 'redraw-1'])
    expect(result?.value.winners.map((entry) => entry.sequence)).toEqual([1, 2])
  })

  it('does not call a write method while reconstructing', async () => {
    const result = await reconstructOfficialHistorySession(ids.session, repositories())
    expect(result?.value.session.id).toBe(ids.session)
  })
})
