import { describe, expect, it } from 'vitest'
import { projectCommittedAudienceState } from './authoritative-projection.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'

const session = {
  id: '00000000-0000-4000-8000-000000000001', eventId: 'event-1', configurationId: 'config-1', mode: 'live', status: 'pending-confirmation', configurationSnapshot: null, candidatePoolSnapshot: null,
  createdAt: '2026-08-05T00:00:00.000Z' as never, updatedAt: '2026-08-05T00:00:01.000Z' as never,
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
})
