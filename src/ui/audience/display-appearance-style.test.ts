import { describe, expect, it } from 'vitest'
import { DEFAULT_DISPLAY_APPEARANCE } from '../../domain/display/display-configuration.types.ts'
import { displayAppearanceDataAttributes, displayAppearanceToStyle, isTransparentDisplayAppearance } from './display-appearance-style.ts'

describe('shared display appearance mapper', () => {
  it('maps the same saved contract to stable preview and Audience variables', () => {
    const style = displayAppearanceToStyle(DEFAULT_DISPLAY_APPEARANCE)
    expect(style).toMatchObject({
      '--display-primary': '#7567FF',
      '--display-background': '#1D1726',
      '--display-text': '#FFFFFF',
      '--text-primary': '#FFFFFF',
      '--text-secondary': 'color-mix(in srgb, #FFFFFF 78%, transparent)',
      '--text-muted': 'color-mix(in srgb, #FFFFFF 64%, transparent)',
      '--draw-box-fill': '#21113E',
      '--draw-box-text': '#FFFFFF',
    })
    expect(displayAppearanceDataAttributes(DEFAULT_DISPLAY_APPEARANCE)).toMatchObject({ 'data-display-theme': 'default', 'data-draw-label-visible': 'true' })
  })

  it('keeps an explicit manual text color effective regardless of the selected preset', () => {
    const explicitText = {
      ...DEFAULT_DISPLAY_APPEARANCE,
      theme: { preset: 'light' as const },
      colors: { ...DEFAULT_DISPLAY_APPEARANCE.colors, text: '#FF0000' },
    }

    expect(displayAppearanceToStyle(explicitText)).toMatchObject({
      '--display-text': '#FF0000',
      '--text-primary': '#FF0000',
      '--text-secondary': 'color-mix(in srgb, #FF0000 78%, transparent)',
    })
  })

  it('makes the background mode authoritative over the selected theme', () => {
    const transparent = { ...DEFAULT_DISPLAY_APPEARANCE, background: { ...DEFAULT_DISPLAY_APPEARANCE.background, type: 'transparent' as const } }
    expect(isTransparentDisplayAppearance(transparent)).toBe(true)
    expect(displayAppearanceDataAttributes(transparent)['data-display-transparent']).toBe('true')
    expect(displayAppearanceToStyle(transparent)['--display-background']).toBe('transparent')

    const restoredTheme = { ...transparent, theme: { preset: 'transparent' as const }, background: { ...transparent.background, type: 'theme' as const } }
    expect(isTransparentDisplayAppearance(restoredTheme)).toBe(false)
    expect(displayAppearanceDataAttributes(restoredTheme)['data-display-transparent']).toBeUndefined()
    expect(displayAppearanceToStyle(restoredTheme)['--display-background']).toBe(DEFAULT_DISPLAY_APPEARANCE.colors.background)
  })

  it('maps a draft image background URL and fit through the shared mapper', () => {
    const imageBackground = {
      ...DEFAULT_DISPLAY_APPEARANCE,
      background: { ...DEFAULT_DISPLAY_APPEARANCE.background, type: 'image' as const, fit: 'contain' as const },
    }

    expect(displayAppearanceToStyle(imageBackground, 'blob:preview-background')).toMatchObject({
      '--audience-background-image': 'url(blob:preview-background)',
      '--display-background-fit': 'contain',
    })
  })

  it('maps countdown composition and effective font through the shared resolver', () => {
    const appearance = {
      ...DEFAULT_DISPLAY_APPEARANCE,
      typography: { fontSource: 'custom' as const, fontFamily: 'arial' as const, fontWeight: 800 as const, customFontAssetId: 'font-1', customFontFileName: 'event.woff2' },
      countdownStyle: { ...DEFAULT_DISPLAY_APPEARANCE.countdownStyle, preset: 'outline' as const, numberColor: '#ABCDEF', numberScale: 1.2, boxVisible: true, borderVisible: true, position: 'upper' as const, fontFamilyOverride: 'mono' as const },
    }
    expect(displayAppearanceToStyle(appearance)).toMatchObject({
      '--display-font-family': expect.stringContaining('KocokanCustom-font-1'),
      '--display-font-weight': 400,
      '--countdown-font-family': expect.stringContaining('Consolas'),
      '--countdown-number-color': '#ABCDEF',
      '--countdown-number-scale': 1.2,
      '--countdown-position-offset': '-6vh',
      '--countdown-box-border-width': '2px',
    })
    expect(displayAppearanceDataAttributes(appearance)).toMatchObject({ 'data-countdown-preset': 'outline', 'data-countdown-box-visible': 'true', 'data-countdown-position': 'upper' })
  })

})
