import type { CSSProperties } from 'react'
import { resolveDisplayAppearance, type DisplayAppearanceConfiguration, type DisplayBuiltinFont } from '../../domain/display/display-configuration.types.ts'

export type DisplayAppearanceStyle = CSSProperties & Partial<Record<`--display-${string}` | `--draw-${string}` | `--countdown-${string}` | '--accent' | '--accent-hover' | '--text-primary' | '--text-secondary' | '--text-muted' | '--audience-background-image' | '--font-family-sans' | '--font-family-mono', string | number | undefined>>

const BUILTIN_FONT_STACKS: Readonly<Record<DisplayBuiltinFont, string>> = {
  kocokan: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
}

export function customDisplayFontFamily(assetId: string): string { return `KocokanCustom-${assetId.replace(/[^a-z0-9_-]/gi, '-')}` }
export function displayFontStack(font: DisplayBuiltinFont): string { return BUILTIN_FONT_STACKS[font] }

export function isTransparentDisplayAppearance(appearance: DisplayAppearanceConfiguration): boolean {
  return appearance.background.type === 'transparent'
}

export function displayAppearanceToStyle(appearance: DisplayAppearanceConfiguration, backgroundUrl?: string): DisplayAppearanceStyle {
  const resolved = resolveDisplayAppearance({ appearance })
  const radius = resolved.drawBox.cornerStyle === 'square' ? '0px' : resolved.drawBox.cornerStyle === 'rounded-md' ? '1.25rem' : '.65rem'
  const shadow = resolved.drawBox.shadowStyle === 'hard'
    ? `.45rem .45rem 0 ${resolved.colors.accent}`
    : resolved.drawBox.shadowStyle === 'soft'
      ? '0 .75rem 2rem rgb(0 0 0 / .32)'
      : resolved.drawBox.preset === 'brutal' ? `.45rem .45rem 0 ${resolved.colors.accent}` : 'none'
  const countdownRadius = resolved.countdownStyle.cornerStyle === 'square' ? '0px' : resolved.countdownStyle.cornerStyle === 'rounded-md' ? '1.25rem' : '.65rem'
  const countdownShadow = resolved.countdownStyle.shadowStyle === 'hard' ? `.45rem .45rem 0 ${resolved.colors.accent}` : resolved.countdownStyle.shadowStyle === 'soft' ? '0 .75rem 2rem rgb(0 0 0 / .32)' : 'none'
  const globalFont = resolved.typography.fontSource === 'custom' && resolved.typography.customFontAssetId !== undefined ? `"${customDisplayFontFamily(resolved.typography.customFontAssetId)}", ${displayFontStack(resolved.typography.fontFamily)}` : displayFontStack(resolved.typography.fontFamily)
  const countdownFont = resolved.countdownStyle.fontFamilyOverride === undefined ? globalFont : displayFontStack(resolved.countdownStyle.fontFamilyOverride)
  const effectiveGlobalWeight = resolved.typography.fontSource === 'custom' ? 400 : resolved.typography.fontWeight
  const effectiveBackground = isTransparentDisplayAppearance(resolved) ? 'transparent' : resolved.colors.background
  return {
    '--display-primary': resolved.colors.primary,
    '--display-accent': resolved.colors.accent,
    '--display-text': resolved.colors.text,
    '--display-background': effectiveBackground,
    '--display-font-family': globalFont,
    '--display-font-weight': effectiveGlobalWeight,
    '--font-family-sans': globalFont,
    '--font-family-mono': globalFont,
    '--text-primary': resolved.colors.text,
    '--text-secondary': `color-mix(in srgb, ${resolved.colors.text} 78%, transparent)`,
    '--text-muted': `color-mix(in srgb, ${resolved.colors.text} 64%, transparent)`,
    '--display-background-fit': resolved.background.fit,
    '--display-logo-size': `${resolved.logo.size}px`,
    '--draw-box-fill': resolved.drawBox.fillColor,
    '--draw-box-border': resolved.drawBox.borderColor,
    '--draw-box-border-width': resolved.drawBox.borderVisible ? `${resolved.drawBox.borderWidth}px` : '0px',
    '--draw-box-radius': radius,
    '--draw-box-shadow': shadow,
    '--draw-box-text': resolved.drawBox.textColor,
    '--draw-label-fill': resolved.drawBox.labelFillColor,
    '--draw-label-text': resolved.drawBox.labelTextColor,
    '--countdown-font-family': countdownFont,
    '--countdown-font-weight': resolved.countdownStyle.fontFamilyOverride === undefined && resolved.typography.fontSource === 'custom' ? 400 : resolved.countdownStyle.preset === 'bold' ? 800 : resolved.typography.fontWeight,
    '--countdown-number-color': resolved.countdownStyle.numberColor,
    '--countdown-number-scale': resolved.countdownStyle.numberScale,
    '--countdown-label-color': resolved.countdownStyle.labelColor,
    '--countdown-box-fill': resolved.countdownStyle.boxVisible ? resolved.countdownStyle.boxFill : 'transparent',
    '--countdown-box-border-width': resolved.countdownStyle.boxVisible && resolved.countdownStyle.borderVisible ? `${resolved.countdownStyle.borderWidth}px` : '0px',
    '--countdown-box-border': resolved.countdownStyle.borderColor,
    '--countdown-box-radius': countdownRadius,
    '--countdown-box-shadow': resolved.countdownStyle.boxVisible ? countdownShadow : 'none',
    '--countdown-position-offset': resolved.countdownStyle.position === 'upper' ? '-6vh' : resolved.countdownStyle.position === 'lower' ? '6vh' : '0vh',
    '--accent': resolved.colors.primary,
    '--accent-hover': resolved.colors.accent,
    ...(backgroundUrl === undefined ? {} : { '--audience-background-image': `url(${backgroundUrl})` }),
  }
}

export function displayAppearanceDataAttributes(appearance: DisplayAppearanceConfiguration) {
  const resolved = resolveDisplayAppearance({ appearance })
  return {
    'data-display-theme': resolved.theme.preset,
    'data-display-background': resolved.background.type,
    'data-display-transparent': isTransparentDisplayAppearance(resolved) ? 'true' : undefined,
    'data-display-text-style': resolved.textStyle,
    'data-draw-box-preset': resolved.drawBox.preset,
    'data-draw-label-visible': resolved.drawBox.labelVisible ? 'true' : 'false',
    'data-countdown-preset': resolved.countdownStyle.preset,
    'data-countdown-label-visible': resolved.countdownStyle.labelVisible ? 'true' : 'false',
    'data-countdown-box-visible': resolved.countdownStyle.boxVisible ? 'true' : 'false',
    'data-countdown-position': resolved.countdownStyle.position,
  } as const
}
