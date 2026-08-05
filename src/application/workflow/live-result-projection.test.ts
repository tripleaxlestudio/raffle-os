import { describe, expect, it } from 'vitest'
import { projectLiveResult } from './live-result-projection.ts'

describe('Live result projection', () => {
  it('projects only public winner identifiers and ticket strings at runtime', () => {
    const session = '11111111-1111-4111-8111-111111111111' as never
    const winner = { id: 'winner', drawSessionId: session, ticketNumber: '00042' } as never
    expect(projectLiveResult(session, [winner])).toEqual({ drawSessionId: session, winnerRecordIds: ['winner'], ticketNumbers: ['00042'] })
  })
})
