import { describe, expect, it } from 'vitest'
import { evaluateStartupRecovery, type StartupRecoveryInput } from './startup-recovery-arbiter.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'

const mockEventId = '11111111-1111-4111-8111-111111111111' as never
const mockSessionId = '22222222-2222-4222-8222-222222222222' as never

const mockEvent: Event = {
  id: mockEventId,
  name: 'Annual Gala 2026',
  status: 'ready',
  createdAt: '2026-08-01T00:00:00.000Z' as never,
  updatedAt: '2026-08-01T00:00:00.000Z' as never,
}

const mockSession: DrawSession = {
  id: mockSessionId,
  eventId: mockEventId,
  configurationId: '33333333-3333-4333-8333-333333333333' as never,
  mode: 'live',
  status: 'drawing',
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
} as unknown as DrawSession

const mockWinner: WinnerRecord = {
  id: '44444444-4444-4444-8444-444444444444',
  eventId: mockEventId,
  prizeCategoryId: '55555555-5555-4555-8555-555555555555',
  drawSessionId: mockSessionId,
  participantId: '66666666-6666-4666-8666-666666666666',
  ticketNumber: '00789',
  sequenceNumber: 1,
  status: 'pending',
  createdAt: '2026-08-05T00:00:01.000Z',
  updatedAt: '2026-08-05T00:00:01.000Z',
} as unknown as WinnerRecord

function createInput(overrides: Partial<StartupRecoveryInput> = {}): StartupRecoveryInput {
  return {
    activeEvent: mockEvent,
    sessions: [],
    ...overrides,
  }
}

describe('Phase 10.2 startup-recovery-arbiter', () => {
  it('returns storage-failure when IndexedDB fails to open/read', () => {
    const result = evaluateStartupRecovery(createInput({ storageError: 'IndexedDB quota exceeded or failed to open' }))
    expect(result).toEqual({
      kind: 'storage-failure',
      error: 'IndexedDB quota exceeded or failed to open',
    })
  })

  it('returns no-active-event when activeEvent is null', () => {
    const result = evaluateStartupRecovery(createInput({ activeEvent: null }))
    expect(result).toEqual({ kind: 'no-active-event' })
  })

  it('returns normal route to /dashboard when there are no unresolved live sessions', () => {
    const result = evaluateStartupRecovery(createInput({ sessions: [] }))
    expect(result).toEqual({
      kind: 'normal',
      targetPath: '/dashboard',
    })
  })

  it('routes to /draw/pending/:id when an unresolved session has persisted winners', () => {
    const result = evaluateStartupRecovery(
      createInput({
        sessions: [mockSession],
        winners: [mockWinner],
      }),
    )

    expect(result).toMatchObject({
      kind: 'recover-session',
      recommendedRoute: `/draw/pending/${mockSessionId}`,
      decision: {
        kind: 'resume-pending',
        winners: [mockWinner],
      },
    })
  })

  it('requires safe acknowledgement when a session is drawing but has no persisted winners', () => {
    const result = evaluateStartupRecovery(
      createInput({
        sessions: [mockSession],
        winners: [],
      }),
    )

    expect(result).toMatchObject({
      kind: 'recover-session',
      recommendedRoute: `/draw/pending/${mockSessionId}`,
      decision: {
        kind: 'safe-acknowledgement-required',
        reason: 'selection-outcome-unknown',
      },
    })
  })

  it('routes to /draw/setup when session is ready without winners', () => {
    const readySession: DrawSession = { ...mockSession, status: 'ready' } as unknown as DrawSession
    const result = evaluateStartupRecovery(
      createInput({
        sessions: [readySession],
        winners: [],
      }),
    )

    expect(result).toMatchObject({
      kind: 'normal',
      targetPath: '/dashboard',
    })
  })

  it('preserves exact ticket numbers with leading zeros during startup evaluation', () => {
    const result = evaluateStartupRecovery(
      createInput({
        sessions: [mockSession],
        winners: [mockWinner],
      }),
    )

    if (result.kind === 'recover-session' && result.decision.kind === 'resume-pending') {
      expect(result.decision.winners[0].ticketNumber).toBe('00789')
    } else {
      throw new Error('Expected recover-session result')
    }
  })

  it('does not silently choose between multiple unresolved Live sessions', () => {
    const otherSession: DrawSession = { ...mockSession, id: '99999999-9999-4999-8999-999999999999' as never, updatedAt: '2026-08-05T00:00:02.000Z' as never } as unknown as DrawSession
    expect(evaluateStartupRecovery(createInput({ sessions: [mockSession, otherSession] }))).toEqual({
      kind: 'conflicting-sessions',
      sessions: [otherSession, mockSession],
      recommendedRoute: '/draw/pending',
    })
  })

  it('is strictly idempotent across repeated evaluations', () => {
    const input = createInput({
      sessions: [mockSession],
      winners: [mockWinner],
    })
    const first = evaluateStartupRecovery(input)
    const second = evaluateStartupRecovery(input)
    expect(second).toEqual(first)
  })
})
