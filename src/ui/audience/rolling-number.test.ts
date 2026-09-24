import { describe, expect, it } from 'vitest'
import { rollingFrameIndex, syntheticRollingNumber } from './rolling-number.ts'

describe('audience rolling presentation', () => {
  const startedAt = '2026-08-07T00:00:00.000Z'
  it.each([[6, 0, 0], [6, 500, 3], [12, 500, 6], [20, 250, 5]] as const)('derives the discrete frame for %i rolls/sec', (speed, elapsed, expected) => {
    expect(rollingFrameIndex(startedAt, Date.parse(startedAt) + elapsed, speed)).toBe(expected)
  })

  it('reconstructs identical values across displays without shared state', () => {
    expect(syntheticRollingNumber('public-seed', 2, 12)).toBe(syntheticRollingNumber('public-seed', 2, 12))
    expect(syntheticRollingNumber('public-seed', 2, 12)).not.toBe(syntheticRollingNumber('public-seed', 3, 12))
    expect(syntheticRollingNumber('public-seed', 2, 12)).toMatch(/^\d{6}$/)
  })
})
