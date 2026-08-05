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
})
