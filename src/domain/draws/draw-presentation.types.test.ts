import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DRAW_PRESENTATION_CONFIGURATION,
  DRAW_ROLL_SPEED_PER_SECOND_MAX,
  DRAW_ROLL_SPEED_PER_SECOND_MIN,
  resolveDrawPresentationConfiguration,
  validateDrawPresentationConfiguration,
} from './draw-presentation.types.ts'

describe('draw presentation configuration', () => {
  it('supports Random Number Roll', () => {
    const configuration = {
      presentationMode: 'random-number-roll',
      rollDurationSeconds: 12,
      rollSpeedPerSecond: 18,
      revealMode: 'sequential',
    } as const

    expect(validateDrawPresentationConfiguration(configuration)).toEqual({ ok: true, value: configuration })
  })

  it('supports Instant Reveal', () => {
    expect(validateDrawPresentationConfiguration(DEFAULT_DRAW_PRESENTATION_CONFIGURATION)).toEqual({ ok: true, value: DEFAULT_DRAW_PRESENTATION_CONFIGURATION })
  })

  it.each([
    ['invalid mode', { ...DEFAULT_DRAW_PRESENTATION_CONFIGURATION, presentationMode: 'unsupported' }],
    ['invalid duration', { ...DEFAULT_DRAW_PRESENTATION_CONFIGURATION, rollDurationSeconds: 0 }],
    ['invalid speed', { ...DEFAULT_DRAW_PRESENTATION_CONFIGURATION, rollSpeedPerSecond: DRAW_ROLL_SPEED_PER_SECOND_MIN - 1 }],
    ['infinite speed', { ...DEFAULT_DRAW_PRESENTATION_CONFIGURATION, rollSpeedPerSecond: Number.POSITIVE_INFINITY }],
    ['invalid reveal mode', { ...DEFAULT_DRAW_PRESENTATION_CONFIGURATION, revealMode: 'unsupported' }],
  ])('rejects %s', (_label, value) => {
    expect(validateDrawPresentationConfiguration(value).ok).toBe(false)
  })

  it('rejects a speed above the conservative bound', () => {
    expect(validateDrawPresentationConfiguration({
      ...DEFAULT_DRAW_PRESENTATION_CONFIGURATION,
      rollSpeedPerSecond: DRAW_ROLL_SPEED_PER_SECOND_MAX + 1,
    }).ok).toBe(false)
  })

  it('resolves a legacy configuration to safe defaults', () => {
    expect(resolveDrawPresentationConfiguration(undefined)).toEqual({
      presentationMode: 'instant-reveal',
      rollDurationSeconds: 8,
      rollSpeedPerSecond: 12,
      revealMode: 'all-together',
    })
  })
})
