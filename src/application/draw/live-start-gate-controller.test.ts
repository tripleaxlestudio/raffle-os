import { describe, expect, it, vi } from 'vitest'
import { createHoldController, type HoldClock } from './live-start-gate-controller.ts'

function clock(): HoldClock {
  return { setTimeout: (callback, delay) => setTimeout(callback, delay), clearTimeout: (handle) => clearTimeout(handle) }
}

describe('Live start hold controller', () => {
  it('completes only at 1500ms and ignores duplicate starts while pending', () => {
    vi.useFakeTimers()
    const complete = vi.fn()
    const controller = createHoldController(complete, clock())
    controller.begin()
    controller.begin()
    vi.advanceTimersByTime(1499)
    expect(complete).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(complete).toHaveBeenCalledTimes(1)
    controller.begin()
    expect(complete).toHaveBeenCalledTimes(1)
    controller.dispose()
    vi.useRealTimers()
  })

  it('cancels before completion and does not invoke the command', () => {
    vi.useFakeTimers()
    const complete = vi.fn()
    const controller = createHoldController(complete, clock())
    controller.begin()
    vi.advanceTimersByTime(700)
    controller.cancel()
    vi.advanceTimersByTime(800)
    expect(complete).not.toHaveBeenCalled()
    controller.dispose()
    vi.useRealTimers()
  })

  it('does not invoke after disposal', () => {
    vi.useFakeTimers()
    const complete = vi.fn()
    const controller = createHoldController(complete, clock())
    controller.begin()
    controller.dispose()
    vi.advanceTimersByTime(1500)
    expect(complete).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
