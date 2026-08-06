import { describe, expect, it } from 'vitest'
import { DEFAULT_PRESENTATION_SETTINGS, validatePresentationSettings } from './presentation-settings.types.ts'

describe('production Presentation settings contract', () => {
  it('uses the deterministic prototype-derived defaults', () => {
    expect(DEFAULT_PRESENTATION_SETTINGS).toEqual({ countdownDurationSeconds: 3, rollingDurationSeconds: 8, revealStyle: 'ticket-spotlight', celebrationEffect: 'confetti-burst', respectReducedMotion: true, winnerLayoutPreference: 'adaptive-operator-preview' })
  })

  it.each([
    ['countdownDurationSeconds', 0],
    ['countdownDurationSeconds', Number.NaN],
    ['countdownDurationSeconds', 61],
    ['rollingDurationSeconds', -1],
  ])('rejects invalid %s values', (field, value) => {
    expect(validatePresentationSettings({ ...DEFAULT_PRESENTATION_SETTINGS, [field]: value }).ok).toBe(false)
  })

  it.each([
    ['revealStyle', 'unknown'],
    ['celebrationEffect', 'unknown'],
    ['winnerLayoutPreference', 'unknown'],
  ])('rejects unsupported %s values', (field, value) => {
    expect(validatePresentationSettings({ ...DEFAULT_PRESENTATION_SETTINGS, [field]: value }).ok).toBe(false)
  })
})
