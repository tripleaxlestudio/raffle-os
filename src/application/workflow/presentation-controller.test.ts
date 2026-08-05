import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PresentationController, type PresentationClock } from './presentation-controller.ts'
import type { PresentationResultProjection } from './presentation-projection.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'

const result: PresentationResultProjection = { drawSessionId: '00000000-0000-4000-8000-000000000001' as never, winners: [{ winnerId: '00000000-0000-4000-8000-000000000002' as never, sequence: 1, ticketNumber: '00042' }] }
const now = '2026-08-05T00:00:00.000Z' as IsoTimestamp

function makeClock(reduced = false): PresentationClock { return { now: () => now, setTimeout: (callback, delay) => setTimeout(callback, delay), clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>), prefersReducedMotion: () => reduced } }

describe('PresentationController', () => {
  beforeEach(() => vi.useFakeTimers())

  it('persists countdown, rolls, and reveals with one immutable result', async () => {
    const persisted: string[] = []
    const states: string[] = []
    const controller = new PresentationController({ result, mode: 'live', clock: makeClock(), persistStage: async (stage) => { persisted.push(stage) }, onState: (state) => { states.push(state.stage) } })
    await controller.start()
    expect(controller.result).toBe(result)
    expect(persisted).toEqual(['countdown'])
    await vi.advanceTimersByTimeAsync(1000)
    expect(controller.getState().countdownLabel).toBe(2)
    await vi.advanceTimersByTimeAsync(2000)
    expect(persisted).toEqual(['countdown', 'rolling'])
    await vi.advanceTimersByTimeAsync(2500)
    expect(persisted).toEqual(['countdown', 'rolling', 'reveal'])
    expect(states.filter((stage) => stage === 'reveal')).toHaveLength(1)
  })

  it('skips once and never starts a second transition', async () => {
    const persistStage = vi.fn(async () => undefined)
    const controller = new PresentationController({ result, mode: 'practice', clock: makeClock(), persistStage, onState: () => undefined })
    await controller.start()
    await controller.skip()
    await controller.skip()
    await vi.runAllTimersAsync()
    expect(controller.getState().stage).toBe('reveal')
    expect(persistStage).toHaveBeenCalledTimes(2)
  })

  it('goes directly to persisted reveal under reduced motion', async () => {
    const persistStage = vi.fn(async () => undefined)
    const controller = new PresentationController({ result, mode: 'practice', clock: makeClock(true), persistStage, onState: () => undefined })
    await controller.start()
    expect(controller.getState().stage).toBe('reveal')
    expect(persistStage).toHaveBeenCalledWith('reveal', now)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves the locked result when persistence fails', async () => {
    const controller = new PresentationController({ result, mode: 'live', clock: makeClock(), persistStage: async () => { throw new Error('storage') }, onState: () => undefined })
    await controller.start()
    expect(controller.getState().stage).toBe('failed')
    expect(controller.result).toBe(result)
  })

  it('can bootstrap again after a Strict Mode-style dispose before async persistence settles', async () => {
    const persistStage = vi.fn(async () => undefined)
    const controller = new PresentationController({ result, mode: 'practice', clock: makeClock(), persistStage, onState: () => undefined })
    controller.dispose()
    await controller.start()
    expect(controller.getState().stage).toBe('countdown')
    expect(persistStage).toHaveBeenCalledTimes(1)
  })
})
