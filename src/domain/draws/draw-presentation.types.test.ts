import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DRAW_PRESENTATION_CONFIGURATION,
  DRAW_ROLL_SPEED_PER_SECOND_MAX,
  DRAW_ROLL_SPEED_PER_SECOND_MIN,
  resolveDrawPresentationConfiguration,
  validateDrawPresentationConfiguration,
} from './draw-presentation.types.ts'

describe('draw presentation configuration', () => {
  it('supports Random Number Roll with fixed defaults', () => {
    const legacy = {
      presentationMode: 'random-number-roll',
      rollStopMode: 'manual',
      rollDurationSeconds: 12,
      rollSpeedPerSecond: 18,
      revealMode: 'sequential',
    } as const

    expect(validateDrawPresentationConfiguration(legacy)).toEqual({
      ok: true,
      value: {
        presentationMode: 'random-number-roll',
        rollStopMode: 'manual',
        rollDurationSeconds: 8,
        rollSpeedPerSecond: 12,
        revealMode: 'all-together',
      },
    })
  })

  it('supports Random Number Roll without legacy fields', () => {
    expect(validateDrawPresentationConfiguration({ presentationMode: 'random-number-roll' })).toEqual({
      ok: true,
      value: {
        presentationMode: 'random-number-roll',
        rollStopMode: 'manual',
        rollDurationSeconds: 8,
        rollSpeedPerSecond: 12,
        revealMode: 'all-together',
      },
    })
  })

  it('supports Instant Reveal with fixed defaults', () => {
    expect(validateDrawPresentationConfiguration(DEFAULT_DRAW_PRESENTATION_CONFIGURATION)).toEqual({
      ok: true,
      value: DEFAULT_DRAW_PRESENTATION_CONFIGURATION,
    })
  })

  it.each([
    ['invalid mode', { presentationMode: 'unsupported' }],
    ['invalid duration', { presentationMode: 'random-number-roll', rollDurationSeconds: 0 }],
    ['invalid speed', { presentationMode: 'random-number-roll', rollSpeedPerSecond: DRAW_ROLL_SPEED_PER_SECOND_MIN - 1 }],
    ['infinite speed', { presentationMode: 'random-number-roll', rollSpeedPerSecond: Number.POSITIVE_INFINITY }],
    ['invalid reveal mode', { presentationMode: 'random-number-roll', revealMode: 'unsupported' }],
    ['invalid stop mode', { presentationMode: 'random-number-roll', rollStopMode: 'automatic' }],
  ])('rejects %s', (_label, value) => {
    expect(validateDrawPresentationConfiguration(value).ok).toBe(false)
  })

  it('rejects a speed above the conservative bound', () => {
    expect(validateDrawPresentationConfiguration({
      presentationMode: 'random-number-roll',
      rollSpeedPerSecond: DRAW_ROLL_SPEED_PER_SECOND_MAX + 1,
    }).ok).toBe(false)
  })

  it('resolves undefined to safe defaults', () => {
    expect(resolveDrawPresentationConfiguration(undefined)).toEqual({
      presentationMode: 'instant-reveal',
      rollStopMode: 'manual',
      rollDurationSeconds: 8,
      rollSpeedPerSecond: 12,
      revealMode: 'all-together',
    })
  })

  it('normalizes legacy timed rolling, custom speed, and sequential reveal to fixed production defaults', () => {
    expect(resolveDrawPresentationConfiguration({
      presentationMode: 'random-number-roll',
      rollStopMode: 'timed',
      rollDurationSeconds: 12,
      rollSpeedPerSecond: 20,
      revealMode: 'sequential',
    })).toEqual({
      presentationMode: 'random-number-roll',
      rollStopMode: 'manual',
      rollDurationSeconds: 8,
      rollSpeedPerSecond: 12,
      revealMode: 'all-together',
    })
  })
})
