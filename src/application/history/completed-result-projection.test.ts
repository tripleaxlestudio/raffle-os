import { describe, expect, it } from 'vitest'
import type { ReconstructedHistorySession } from './history-read-model.ts'
import { canShowCompletedResultOnAudience, projectCompletedResultForAudience } from './completed-result-projection.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { EventSettings } from '../../domain/settings/event-settings.types.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'

const eventSettings = {
  eventId: 'event-1', displayName: 'Current event branding', subtitle: 'Public subtitle', primaryColor: '#111111', accentColor: '#222222',
  presentation: { countdownDurationSeconds: 3, rollingDurationSeconds: 8, revealStyle: 'ticket-spotlight', celebrationEffect: 'none', respectReducedMotion: true, winnerLayoutPreference: 'adaptive-operator-preview' },
  audioEnabled: false, masterVolume: 72, updatedAt: '2026-08-09T00:00:00.000Z',
} as unknown as EventSettings

const session = {
  id: 'session-1', eventId: 'event-1', configurationId: 'configuration-1', mode: 'live', status: 'completed',
  configurationSnapshot: { snapshotFormatVersion: 1, configurationId: 'configuration-1', prizeCategoryId: 'category-1', categoryName: 'Grand Prize', prizeName: 'Scooter', requestedWinners: 3, winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: null, capturedAt: '2026-08-09T00:00:00.000Z' },
  candidatePoolSnapshot: null, createdAt: '2026-08-09T00:00:00.000Z', updatedAt: '2026-08-09T00:01:00.000Z', completedAt: '2026-08-09T00:01:00.000Z',
} as unknown as DrawSession

function reconstruction(winners: ReconstructedHistorySession['winners'] = [
  { winnerRecordId: 'original', drawSessionId: 'session-1', participantId: 'participant-1', ticketNumber: '00042', sequence: 1, status: 'cancelled', selectedTimestamp: '2026-08-09T00:00:01.000Z', cancellationTimestamp: '2026-08-09T00:00:02.000Z' },
  { winnerRecordId: 'replacement', drawSessionId: 'session-1', participantId: 'participant-2', ticketNumber: '42', sequence: 2, status: 'confirmed', selectedTimestamp: '2026-08-09T00:00:03.000Z', confirmationTimestamp: '2026-08-09T00:00:04.000Z' },
  { winnerRecordId: 'third', drawSessionId: 'session-1', participantId: 'participant-3', ticketNumber: '00073', sequence: 3, status: 'confirmed', selectedTimestamp: '2026-08-09T00:00:05.000Z', confirmationTimestamp: '2026-08-09T00:00:06.000Z' },
 ] as unknown as ReconstructedHistorySession['winners']): { kind: 'complete'; value: ReconstructedHistorySession } {
  return { kind: 'complete', value: { session, event: null, category: null, configuration: null, winners, redraws: [], lineages: [], audits: [], issues: [], summary: { drawSessionId: session.id, eventId: session.eventId, eventName: 'Event', mode: session.mode, sessionStatus: session.status, drawTimestamp: session.createdAt, completionTimestamp: session.completedAt, eligibleCount: 3, requestedWinnerCount: 3, categoryId: 'category-1', categoryName: 'Grand Prize', prizeName: 'Scooter' } } }
}

describe('completed Audience result projection', () => {
  it('projects confirmed winners only, in authoritative sequence, preserving exact ticket strings', () => {
    const result = projectCompletedResultForAudience({ reconstruction: reconstruction(), eventSettings, displayConfiguration: null, stageStartedAt: '2026-08-09T00:02:00.000Z' as IsoTimestamp })
    expect(result).toMatchObject({ ok: true, source: { stage: 'pending-handoff', verificationState: 'verified', prizeName: 'Scooter', eventName: 'Current event branding' } })
    if (!result.ok) return
    expect(result.source.result?.winners).toEqual([
      { sequence: 1, ticketNumber: '42', status: 'confirmed' },
      { sequence: 2, ticketNumber: '00073', status: 'confirmed' },
    ])
  })

  it('rejects incomplete, pending, non-live, and no-confirmed results safely', () => {
    expect(canShowCompletedResultOnAudience({ ...reconstruction(), kind: 'incomplete' })).toBe(false)
    expect(projectCompletedResultForAudience({ reconstruction: reconstruction([{ ...reconstruction().value.winners[1], status: 'pending' }]), eventSettings, displayConfiguration: null, stageStartedAt: '2026-08-09T00:02:00.000Z' as IsoTimestamp })).toMatchObject({ ok: false, reason: 'no-confirmed-winners' })
    expect(projectCompletedResultForAudience({ reconstruction: { ...reconstruction(), value: { ...reconstruction().value, session: { ...session, status: 'pending-confirmation' } } }, eventSettings, displayConfiguration: null, stageStartedAt: '2026-08-09T00:02:00.000Z' as IsoTimestamp })).toMatchObject({ ok: false, reason: 'not-completed' })
    expect(projectCompletedResultForAudience({ reconstruction: { ...reconstruction(), value: { ...reconstruction().value, session: { ...session, mode: 'practice' } } }, eventSettings, displayConfiguration: null, stageStartedAt: '2026-08-09T00:02:00.000Z' as IsoTimestamp })).toMatchObject({ ok: false, reason: 'not-live' })
  })
})
