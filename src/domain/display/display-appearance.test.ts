import { describe, expect, it } from 'vitest'
import { applyDisplayThemePreset, DEFAULT_DISPLAY_APPEARANCE, resolveDisplayAppearance, validateDisplayAppearance } from './display-configuration.types.ts'

describe('display appearance compatibility', () => {
  it('uses the production-safe Kocokan defaults for a record without appearance', () => {
    expect(resolveDisplayAppearance(null)).toEqual(DEFAULT_DISPLAY_APPEARANCE)
    expect(resolveDisplayAppearance(null).logo).toMatchObject({ visible: true, source: 'kocokan', position: 'top-left' })
  })

  it('adapts legacy Event Settings colors and assets without changing their blobs', () => {
    const logo = { type: 'image/png', blob: new Blob(['logo'], { type: 'image/png' }) }
    const background = { type: 'image/webp', blob: new Blob(['background'], { type: 'image/webp' }) }
    const resolved = resolveDisplayAppearance(null, { primaryColor: '#112233', accentColor: '#445566', logo, background })
    expect(resolved).toMatchObject({ colors: { primary: '#112233', accent: '#445566' }, logo: { source: 'custom' }, background: { type: 'image' } })
    expect(resolved.logo.customAsset?.blob).toBe(logo.blob)
    expect(resolved.background.imageAsset?.blob).toBe(background.blob)
  })

  it('applies a theme preset additively and validates the resulting contract', () => {
    const light = applyDisplayThemePreset(DEFAULT_DISPLAY_APPEARANCE, 'light')
    expect(light).toMatchObject({ theme: { preset: 'light' }, colors: { background: '#F5F1E8', text: '#1D1726' } })
    expect(light.countdownStyle).toMatchObject({ numberColor: '#1D1726', labelColor: '#1D1726' })
    expect(validateDisplayAppearance(light)).toMatchObject({ ok: true })
  })

  it('normalizes legacy appearance records with countdown and typography defaults', () => {
    const legacy = {
      logo: DEFAULT_DISPLAY_APPEARANCE.logo,
      theme: DEFAULT_DISPLAY_APPEARANCE.theme,
      colors: DEFAULT_DISPLAY_APPEARANCE.colors,
      textStyle: DEFAULT_DISPLAY_APPEARANCE.textStyle,
      drawBox: DEFAULT_DISPLAY_APPEARANCE.drawBox,
      background: DEFAULT_DISPLAY_APPEARANCE.background,
    }
    const resolved = resolveDisplayAppearance({ appearance: legacy })
    expect(resolved.typography).toEqual({ fontSource: 'builtin', fontFamily: 'kocokan', fontWeight: 700 })
    expect(resolved.countdownStyle).toMatchObject({ preset: 'minimal', numberScale: 1, labelVisible: true, boxVisible: false, position: 'center' })
    expect(validateDisplayAppearance(legacy)).toMatchObject({ ok: true, value: { typography: { fontFamily: 'kocokan' }, countdownStyle: { preset: 'minimal' } } })
  })
})
