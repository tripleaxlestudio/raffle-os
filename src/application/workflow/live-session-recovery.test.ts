import { describe, expect, it } from 'vitest'
import { evaluateLiveSessionRecovery, type LiveSessionRecoveryInput } from './live-session-recovery.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'

const mockEventId = '11111111-1111-4111-8111-111111111111' as never
const mockSessionId = '22222222-2222-4222-8222-222222222222' as never

const mockSession: DrawSession = {
  id: mockSessionId,
  eventId: mockEventId,
  configurationId: '33333333-3333-4333-8333-333333333333' as never,
  mode: 'live',
  status: 'drawing',
  createdAt: '2026-08-05T00:00:00.000Z' as never,
  updatedAt: '2026-08-05T00:00:00.000Z' as never,
} as unknown as DrawSession

const mockPendingWinner: WinnerRecord = {
  id: '44444444-4444-4444-8444-444444444444',
  eventId: mockEventId,
  prizeCategoryId: '55555555-5555-4555-8555-555555555555',
  drawSessionId: mockSessionId,
  participantId: '66666666-6666-4666-8666-666666666666',
  ticketNumber: '00789',
  sequenceNumber: 1,
  status: 'pending',
  createdAt: '2026-08-05T00:00:01.000Z' as never,
  updatedAt: '2026-08-05T00:00:01.000Z' as never,
} as unknown as WinnerRecord

const mockConfirmedWinner: WinnerRecord = {
  id: '77777777-7777-4777-8777-777777777777',
  eventId: mockEventId,
  prizeCategoryId: '55555555-5555-4555-8555-555555555555',
  drawSessionId: mockSessionId,
  participantId: '88888888-8888-4888-8888-888888888888',
  ticketNumber: '00123',
  sequenceNumber: 2,
  status: 'confirmed',
  createdAt: '2026-08-05T00:00:01.000Z' as never,
  updatedAt: '2026-08-05T00:00:02.000Z' as never,
} as unknown as WinnerRecord

function createInput(overrides: Partial<LiveSessionRecoveryInput> = {}): LiveSessionRecoveryInput {
  return {
    session: mockSession,
    winners: [],
    ...overrides,
  }
}

describe('Phase 10.3 live-session-recovery', () => {
  it('recovers to setup route when refresh occurs before official selection (ready status)', () => {
    const readySession: DrawSession = { ...mockSession, status: 'ready' } as unknown as DrawSession
    const result = evaluateLiveSessionRecovery(createInput({ session: readySession, winners: [] }))

    expect(result).toEqual({
      status: 'recovered-setup',
      session: readySession,
      recommendedRoute: '/draw/setup',
      reason: 'no-official-selection',
    })
  })

  it('recovers pending winners to /draw/pending/:id route with ticket number preserved', () => {
    const result = evaluateLiveSessionRecovery(createInput({ winners: [mockPendingWinner] }))

    expect(result).toMatchObject({
      status: 'recovered-pending',
      recommendedRoute: `/draw/pending/${mockSessionId}`,
      isReadOnly: true,
      winners: [mockPendingWinner],
    })
    if (result.status === 'recovered-pending') {
      expect(result.winners[0].ticketNumber).toBe('00789')
    }
  })

  it('preserves status split after partial confirmation', () => {
    const pendingSession: DrawSession = { ...mockSession, status: 'pending-confirmation' } as unknown as DrawSession
    const result = evaluateLiveSessionRecovery(
      createInput({
        session: pendingSession,
        winners: [mockPendingWinner, mockConfirmedWinner],
      }),
    )

    expect(result).toMatchObject({
      status: 'recovered-pending',
      recommendedRoute: `/draw/pending/${mockSessionId}`,
      winners: [mockPendingWinner, mockConfirmedWinner],
    })
    if (result.status === 'recovered-pending') {
      expect(result.winners.find((w) => w.id === mockPendingWinner.id)?.status).toBe('pending')
      expect(result.winners.find((w) => w.id === mockConfirmedWinner.id)?.status).toBe('confirmed')
    }
  })

  it('recovers official winner records safely when presentation checkpoint is corrupt', () => {
    const result = evaluateLiveSessionRecovery(
      createInput({
        winners: [mockPendingWinner],
        checkpointError: 'corrupt',
      }),
    )

    expect(result).toMatchObject({
      status: 'recovered-pending',
      recommendedRoute: `/draw/pending/${mockSessionId}`,
      winners: [mockPendingWinner],
      checkpointWarning: 'Presentation checkpoint was corrupt, but official winner records were safely recovered.',
    })
  })

  it.each(['corrupt', 'unsupported', 'stale'] as const)('keeps official winner authoritative for a %s checkpoint', (checkpointError) => {
    const result = evaluateLiveSessionRecovery(createInput({ winners: [mockPendingWinner], checkpointError }))
    expect(result).toMatchObject({ status: 'recovered-pending', winners: [mockPendingWinner], isReadOnly: true })
  })

  it('requires acknowledgement for an unresolved receipt', () => {
    expect(evaluateLiveSessionRecovery(createInput({ receipts: [{ drawSessionId: mockSessionId, status: 'unknown' } as never] }))).toMatchObject({
      status: 'acknowledgement-required',
      reason: 'receipt-unresolved',
    })
  })

  it('requires acknowledgement when pending-confirmation has no official winner', () => {
    const pendingSession: DrawSession = { ...mockSession, status: 'pending-confirmation' } as unknown as DrawSession
    expect(evaluateLiveSessionRecovery(createInput({ session: pendingSession }))).toMatchObject({
      status: 'acknowledgement-required',
      reason: 'selection-outcome-unknown',
    })
  })

  it('requires safe operator acknowledgement if selection was interrupted during drawing with 0 winners', () => {
    const result = evaluateLiveSessionRecovery(createInput({ winners: [] }))

    expect(result).toEqual({
      status: 'acknowledgement-required',
      session: mockSession,
      reason: 'selection-outcome-unknown',
      recommendedRoute: `/draw/pending/${mockSessionId}`,
    })
  })

  it('recovers terminal completed session as read-only history', () => {
    const completedSession: DrawSession = { ...mockSession, status: 'completed' } as unknown as DrawSession
    const result = evaluateLiveSessionRecovery(
      createInput({
        session: completedSession,
        winners: [mockConfirmedWinner],
      }),
    )

    expect(result).toEqual({
      status: 'terminal-read-only',
      session: completedSession,
      winners: [mockConfirmedWinner],
      redraws: [],
      recommendedRoute: `/history/${mockSessionId}`,
    })
  })

  it('preserves ticket 00042 from the official winner record', () => {
    const winner: WinnerRecord = { ...mockPendingWinner, ticketNumber: '00042' } as unknown as WinnerRecord
    const result = evaluateLiveSessionRecovery(createInput({ winners: [winner] }))
    expect(result).toMatchObject({ status: 'recovered-pending', winners: [{ ticketNumber: '00042' }] })
  })

  it('is strictly idempotent', () => {
    const input = createInput({ winners: [mockPendingWinner] })
    const first = evaluateLiveSessionRecovery(input)
    const second = evaluateLiveSessionRecovery(input)
    expect(second).toEqual(first)
  })
})
