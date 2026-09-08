import { describe, expect, it, vi } from 'vitest'
import { decideLiveRecovery } from './recovery-query.ts'
import { PresentationController, type PresentationClock } from './presentation-controller.ts'
import type { PresentationResultProjection } from './presentation-projection.ts'

const session = '00000000-0000-4000-8000-000000000001' as never
const result: PresentationResultProjection = { drawSessionId: session, winners: [{ winnerId: '00000000-0000-4000-8000-000000000002' as never, sequence: 1, ticketNumber: '00042' }] }
const checkpoint = { drawSessionId: session, stage: 'countdown' as const, stageStartedAt: '2026-08-05T00:00:00.000Z' as never, persistedAt: '2026-08-05T00:00:00.100Z' as never, presentationPolicyVersion: 1 as const, checkpointFormatVersion: 1 as const, blackoutRequested: false }

describe('Phase 6 recovery', () => {
  it('returns elapsed time for a checkpoint and never selects', () => {
    expect(decideLiveRecovery({ sessionStatus: 'pending-confirmation', drawSessionId: session, checkpoint, officialWinnerCount: 1, now: '2026-08-05T00:00:01.250Z' })).toMatchObject({ kind: 'resume', stage: 'countdown', elapsedMs: 1250 })
  })

  it('bypasses a corrupt checkpoint to read-only Pending when the result is official', () => {
    expect(decideLiveRecovery({ sessionStatus: 'pending-confirmation', drawSessionId: session, checkpoint: null, officialWinnerCount: 1, checkpointError: 'corrupt' })).toEqual({ kind: 'pending-handoff', drawSessionId: session, readOnly: true })
  })

  it('resumes the remaining rolling stage without restarting it', async () => {
    vi.useFakeTimers()
    let current = 0
    const persisted: string[] = []
    const clock: PresentationClock = { now: () => new Date(current).toISOString() as never, setTimeout: (callback, delay) => setTimeout(callback, delay), clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>), prefersReducedMotion: () => false }
    const controller = new PresentationController({ result, mode: 'live', clock, persistStage: async (stage) => { persisted.push(stage) }, onState: () => undefined })
    current = Date.parse('2026-08-05T00:00:02.000Z')
    await controller.resume('rolling', '2026-08-05T00:00:00.000Z' as never)
    expect(controller.getState().stage).toBe('rolling')
    await vi.advanceTimersByTimeAsync(5000)
    expect(persisted).toEqual([])
    await controller.stopRollingAndReveal()
    expect(persisted).toEqual(['reveal'])
    controller.dispose()
    vi.useRealTimers()
  })
})
