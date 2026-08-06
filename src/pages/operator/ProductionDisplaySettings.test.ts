import productionSettingsSource from './ProductionSettingsPage.tsx?raw'
import { describe, expect, it } from 'vitest'

describe('production Display settings UI contract', () => {
  it('keeps the persisted controls in grouped output and safety sections', () => {
    const source = productionSettingsSource

    expect(source).toContain('settings-display-config__group')
    expect(source).toContain('Output framing')
    expect(source).toContain('Safety behavior')
    expect(source).toContain('Target resolution')
    expect(source).toContain('Safe-area margin')
    expect(source).toContain('Blackout appearance')
    expect(source).toContain('settings-display-config__helper')
    expect(source).toContain('aria-hidden="true">px</span>')
    expect(source).not.toContain('Prefer fullscreen')
    expect(source).not.toContain('Disconnected-safe state')
  })

  it('preserves the live preview, metadata strip, and desktop action order', () => {
    const source = productionSettingsSource

    expect(source).toContain('<AudiencePreviewSurface')
    expect(source).toContain('background={currentSettings.background}')
    expect(source).toContain('safeAreaMargin={safeAreaMargin}')
    expect(source).toContain('Aspect')
    expect(source).toContain('Resolution')
    expect(source).toContain('Safe area')
    expect(source).toContain('Runtime / test')

    const actionRow = source.indexOf('<div className="settings-action-row">')
    const save = source.indexOf('Save ${details[0]} settings', actionRow)
    const open = source.indexOf('Open Audience Display', actionRow)
    const test = source.indexOf('Test Display Connection', actionRow)
    const stop = source.indexOf('Stop Test', actionRow)
    expect(save).toBeGreaterThan(-1)
    expect(open).toBeGreaterThan(save)
    expect(test).toBeGreaterThan(open)
    expect(stop).toBeGreaterThan(test)
  })
})
