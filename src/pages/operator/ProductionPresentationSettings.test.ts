import productionSettingsSource from './ProductionSettingsPage.tsx?raw'
import { describe, expect, it } from 'vitest'

describe('production Presentation settings UI contract', () => {
  it('contains the six persisted Presentation controls in the approved two-column order', () => {
    const source = productionSettingsSource
    expect(source).toContain('Countdown duration')
    expect(source).toContain('Rolling duration')
    expect(source).toContain('Reveal style')
    expect(source).toContain('Celebration effect')
    expect(source).toContain('Respect reduced motion')
    expect(source).toContain('Winner layout preference')
    expect(source).toContain('settings-form-grid--two settings-presentation-grid')
    expect(source).not.toContain('settings-safe-area-preview')
  })

  it('keeps the Presentation save toast detail and Display ownership explicit', () => {
    expect(productionSettingsSource).toContain("`${details[0]} settings saved`")
    expect(productionSettingsSource).toContain('Display owns framing and blackout behavior.')
    expect(productionSettingsSource).toContain('safeAreaMargin, blackoutAppearance')
  })
})
