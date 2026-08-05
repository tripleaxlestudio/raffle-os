import { beforeEach, describe, expect, it } from 'vitest'
import { practiceResultFromWinners, readPracticeResult, savePracticeResult } from './practice-result-storage.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'

const sessionId = '00000000-0000-4000-8000-000000000001' as DrawSessionId
const winner = { id: '00000000-0000-4000-8000-000000000002', drawSessionId: sessionId, participantId: '00000000-0000-4000-8000-000000000003', eventId: '00000000-0000-4000-8000-000000000004', prizeCategoryId: '00000000-0000-4000-8000-000000000005', sequenceNumber: 1, ticketNumber: '00042', status: 'pending', createdAt: '2026-08-05T00:00:00.000Z' } as WinnerRecord

describe('Practice result storage', () => {
  beforeEach(() => sessionStorage.clear())

  it('stores only the minimal projection and preserves ticket strings', () => {
    savePracticeResult(practiceResultFromWinners(sessionId, [winner], '2026-08-05T00:00:00.000Z'))
    const result = readPracticeResult(sessionId)
    expect(result?.winners).toEqual([{ winnerId: winner.id, sequence: 1, ticketNumber: '00042' }])
    expect(JSON.stringify(result)).not.toContain('participantId')
    expect(readPracticeResult('00000000-0000-4000-8000-000000000006' as DrawSessionId)).toBeNull()
  })

  it.each([
    ['malformed JSON', '{not-json}'],
    ['unsupported version', JSON.stringify({ drawSessionId: sessionId, winners: [], createdAt: '2026-08-05T00:00:00.000Z', policyVersion: 2 })],
    ['mismatched DrawSession ID', JSON.stringify({ drawSessionId: '00000000-0000-4000-8000-000000000006', winners: [], createdAt: '2026-08-05T00:00:00.000Z', policyVersion: 1 })],
    ['malformed projection', JSON.stringify({ drawSessionId: sessionId, winners: [{ winnerId: 'not-an-id', sequence: 1, ticketNumber: 42 }], createdAt: '2026-08-05T00:00:00.000Z', policyVersion: 1 })],
  ])('rejects %s safely', (_reason, raw) => {
    sessionStorage.setItem(`raffle-os:practice-result:v1:${sessionId}`, raw)
    expect(readPracticeResult(sessionId)).toBeNull()
  })

  it('accepts close-tab loss as the documented Practice policy', () => {
    savePracticeResult(practiceResultFromWinners(sessionId, [winner], '2026-08-05T00:00:00.000Z'))
    sessionStorage.clear()
    expect(readPracticeResult(sessionId)).toBeNull()
  })
})
