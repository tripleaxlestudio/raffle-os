import { describe, expect, it } from 'vitest'
import { calculateReplacementCapacity } from './capacity-query.ts'
import type { CandidatePoolSnapshot } from '../../domain/draws/draw-session.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'

const snapshot = { candidateEntries: [{ participantId: 'p1', ticketNumber: '00042' }, { participantId: 'p2', ticketNumber: '42' }, { participantId: 'p3', ticketNumber: '77' }], eligibleSnapshotCount: 3 } as unknown as CandidatePoolSnapshot
const winner = (id: string, ticketNumber: string, status: WinnerRecord['status']): WinnerRecord => ({ id: id as never, eventId: 'e' as never, prizeCategoryId: 'c' as never, drawSessionId: 's' as never, participantId: id as never, ticketNumber: ticketNumber as never, sequenceNumber: 1, status, createdAt: '2026-08-05T00:00:00.000Z' as IsoTimestamp, updatedAt: '2026-08-05T00:00:00.000Z' as IsoTimestamp })

describe('replacement capacity query', () => {
  it('counts without consuming random source or exposing a replacement identity', () => {
    const result = calculateReplacementCapacity({ candidatePoolSnapshot: snapshot, requestedReplacementCount: 1, targetWinnerIds: ['w1'], winners: [winner('w1', '00042', 'pending'), winner('w2', '42', 'confirmed')] })
    expect(result).toEqual({ eligibleCandidateCount: 1, requestedReplacementCount: 1, sufficient: true })
    expect(result).not.toHaveProperty('replacementTicket')
  })

  it('keeps cancelled winners from the same session out of later replacement capacity', () => {
    const result = calculateReplacementCapacity({ candidatePoolSnapshot: snapshot, drawSessionId: 's', requestedReplacementCount: 1, targetWinnerIds: ['w3'], winners: [winner('w1', '00042', 'cancelled'), winner('w2', '42', 'pending'), winner('w3', '77', 'pending')] })
    expect(result.eligibleCandidateCount).toBe(0)
  })
})
