import { describe, expect, it } from 'vitest'
import { projectCommittedAudienceState } from './authoritative-projection.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'

const session = {
  id: '00000000-0000-4000-8000-000000000001', eventId: 'event-1', configurationId: 'config-1', mode: 'live', status: 'pending-confirmation', configurationSnapshot: null, candidatePoolSnapshot: null,
  createdAt: '2026-08-05T00:00:00.000Z' as never, updatedAt: '2026-08-05T00:00:01.000Z' as never,
} as unknown as DrawSession

const randomRollSession = {
  ...session,
  configurationSnapshot: {
    snapshotFormatVersion: 1,
    configurationId: 'config-1',
    prizeCategoryId: 'category-1',
    categoryName: 'Gold',
    prizeName: 'Prize',
    requestedWinners: 2,
    winningRule: 'once-per-event',
    requireCheckIn: false,
    eligibleGroupFilter: null,
    capturedAt: '2026-08-05T00:00:00.000Z' as never,
    presentation: { presentationMode: 'random-number-roll' as const, rollStopMode: 'timed' as const, rollDurationSeconds: 8, rollSpeedPerSecond: 12, revealMode: 'all-together' as const },
  },
} as unknown as DrawSession

const winner = (id: string, sequenceNumber: number, ticketNumber: string, status: WinnerRecord['status']): WinnerRecord => ({
  id: id as never, eventId: 'event-1' as never, prizeCategoryId: 'category-1' as never, drawSessionId: session.id, participantId: `participant-${id}` as never, ticketNumber: ticketNumber as never, sequenceNumber, status, createdAt: '2026-08-05T00:00:00.000Z' as never, updatedAt: '2026-08-05T00:00:01.000Z' as never,
})

describe('committed Audience projection', () => {
  it('publishes only active committed winners, preserving ticket strings and public statuses', () => {
    const source = projectCommittedAudienceState({ session, winners: [winner('a', 1, '00042', 'pending'), winner('b', 2, '42', 'confirmed'), winner('c', 3, 'private-name-never-published', 'cancelled')], stageStartedAt: '2026-08-05T00:00:01.000Z' as never, blackoutRequested: false })
    expect(source.result?.winners).toEqual([{ sequence: 1, ticketNumber: '00042', status: 'pending' }, { sequence: 2, ticketNumber: '42', status: 'confirmed' }])
    expect(JSON.stringify(source)).not.toContain('private-name-never-published')
  })

  it('represents an all-cancelled committed session without inventing a replacement', () => {
    const source = projectCommittedAudienceState({ session: { ...session, status: 'cancelled' }, winners: [winner('a', 1, '00042', 'cancelled')], stageStartedAt: '2026-08-05T00:00:01.000Z' as never, blackoutRequested: true })
    expect(source.result?.winners).toEqual([])
    expect(source.blackoutRequested).toBe(true)
  })

  it('retains the locked presentation mode for the committed public handoff', () => {
    const source = projectCommittedAudienceState({ session: randomRollSession, winners: [winner('a', 1, '00042', 'pending')], stageStartedAt: '2026-08-05T00:00:01.000Z' as never, blackoutRequested: false })
    expect(source).toMatchObject({ prizeCategory: 'Gold', prizeName: 'Prize' })
    expect(source.presentationConfiguration).toMatchObject({ presentationMode: 'random-number-roll', winnerCount: 1 })
    expect(source.presentationSeed).toBe(randomRollSession.id)
  })

  it('reprojects committed decisions even after the DrawSession is completed', () => {
    const completed = { ...session, status: 'completed' as const }
    const pending = projectCommittedAudienceState({ session: completed, winners: [winner('a', 1, '00073', 'pending'), winner('b', 2, '00052', 'confirmed')], stageStartedAt: '2026-08-05T00:00:01.000Z' as never, blackoutRequested: false })
    const confirmed = projectCommittedAudienceState({ session: completed, winners: [winner('a', 1, '00073', 'confirmed'), winner('b', 2, '00052', 'confirmed')], stageStartedAt: '2026-08-05T00:00:02.000Z' as never, blackoutRequested: false })
    expect(pending.result?.winners).toEqual([{ sequence: 1, ticketNumber: '00073', status: 'pending' }, { sequence: 2, ticketNumber: '00052', status: 'confirmed' }])
    expect(confirmed.result?.winners).toEqual([{ sequence: 1, ticketNumber: '00073', status: 'confirmed' }, { sequence: 2, ticketNumber: '00052', status: 'confirmed' }])
  })
})
