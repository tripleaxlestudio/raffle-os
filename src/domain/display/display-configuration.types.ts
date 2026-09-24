import type {
  DisplayConfigurationId,
  EventId,
} from '../shared/identifiers.ts'
import {
  failure,
  success,
  type Result,
} from '../shared/result.ts'
import {
  isIsoTimestamp,
  type IsoTimestamp,
} from '../shared/timestamps.ts'

export interface TargetResolution {
  readonly width: number
  readonly height: number
}

export type DisplayLogoPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
export type DisplayThemePreset = 'default' | 'light' | 'dark' | 'contrast' | 'transparent' | 'custom'
export type DisplayTextStyle = 'default' | 'outline' | 'shadow'
export type DisplayDrawBoxPreset = 'solid' | 'outline' | 'brutal' | 'clean'
export type DisplayCornerStyle = 'square' | 'rounded-sm' | 'rounded-md'
export type DisplayShadowStyle = 'none' | 'hard' | 'soft'
export type DisplayBackgroundType = 'theme' | 'color' | 'image' | 'transparent'
export type DisplayBuiltinFont = 'kocokan' | 'inter' | 'arial' | 'mono'
export type DisplayFontWeight = 400 | 500 | 700 | 800
export type DisplayCountdownPreset = 'minimal' | 'box' | 'outline' | 'bold'
export type DisplayCountdownPosition = 'upper' | 'center' | 'lower'

export interface DisplayTypographyConfiguration {
  readonly fontSource: 'builtin' | 'custom'
  readonly fontFamily: DisplayBuiltinFont
  readonly customFontAssetId?: string
  readonly customFontFileName?: string
  readonly fontWeight: DisplayFontWeight
}

export interface DisplayCountdownStyleConfiguration {
  readonly preset: DisplayCountdownPreset
  readonly numberColor: string
  readonly numberScale: number
  readonly labelVisible: boolean
  readonly labelColor: string
  readonly boxVisible: boolean
  readonly boxFill: string
  readonly borderVisible: boolean
  readonly borderColor: string
  readonly borderWidth: number
  readonly cornerStyle: DisplayCornerStyle
  readonly shadowStyle: DisplayShadowStyle
  readonly position: DisplayCountdownPosition
  readonly fontFamilyOverride?: DisplayBuiltinFont
}

export interface DisplayImageAsset {
  readonly type: string
  readonly blob: Blob
}

export interface DisplayAppearanceConfiguration {
  readonly logo: {
    readonly visible: boolean
    readonly source: 'kocokan' | 'custom'
    readonly customAsset?: DisplayImageAsset
    readonly position: DisplayLogoPosition
    readonly size: number
  }
  readonly theme: { readonly preset: DisplayThemePreset }
  readonly colors: {
    readonly primary: string
    readonly accent: string
    readonly text: string
    readonly background: string
  }
  readonly textStyle: DisplayTextStyle
  readonly drawBox: {
    readonly preset: DisplayDrawBoxPreset
    readonly fillColor: string
    readonly borderVisible: boolean
    readonly borderColor: string
    readonly borderWidth: number
    readonly cornerStyle: DisplayCornerStyle
    readonly shadowStyle: DisplayShadowStyle
    readonly textColor: string
    readonly labelVisible: boolean
    readonly labelFillColor: string
    readonly labelTextColor: string
  }
  readonly background: {
    readonly type: DisplayBackgroundType
    readonly imageAsset?: DisplayImageAsset
    readonly fit: 'cover' | 'contain'
  }
  /** Optional on legacy persisted records; normalized by resolveDisplayAppearance. */
  readonly typography?: DisplayTypographyConfiguration
  /** Optional on legacy persisted records; normalized by resolveDisplayAppearance. */
  readonly countdownStyle?: DisplayCountdownStyleConfiguration
}

export type ResolvedDisplayAppearanceConfiguration = DisplayAppearanceConfiguration & Readonly<{
  typography: DisplayTypographyConfiguration
  countdownStyle: DisplayCountdownStyleConfiguration
}>

export const DEFAULT_DISPLAY_TYPOGRAPHY: DisplayTypographyConfiguration = {
  fontSource: 'builtin', fontFamily: 'kocokan', fontWeight: 700,
}

export const DEFAULT_COUNTDOWN_STYLE: DisplayCountdownStyleConfiguration = {
  preset: 'minimal', numberColor: '#FFFFFF', numberScale: 1, labelVisible: true,
  labelColor: '#FFFFFF', boxVisible: false, boxFill: '#21113E', borderVisible: false,
  borderColor: '#7567FF', borderWidth: 2, cornerStyle: 'rounded-sm', shadowStyle: 'none',
  position: 'center',
}

export const DEFAULT_DISPLAY_APPEARANCE: ResolvedDisplayAppearanceConfiguration = {
  logo: { visible: true, source: 'kocokan', position: 'top-left', size: 64 },
  theme: { preset: 'default' },
  colors: { primary: '#7567FF', accent: '#F2A93B', text: '#FFFFFF', background: '#1D1726' },
  textStyle: 'default',
  drawBox: {
    preset: 'solid', fillColor: '#21113E', borderVisible: true, borderColor: '#7567FF', borderWidth: 2,
    cornerStyle: 'rounded-sm', shadowStyle: 'none', textColor: '#FFFFFF', labelVisible: true,
    labelFillColor: '#3B1684', labelTextColor: '#FFFFFF',
  },
  background: { type: 'theme', fit: 'cover' },
  typography: DEFAULT_DISPLAY_TYPOGRAPHY,
  countdownStyle: DEFAULT_COUNTDOWN_STYLE,
}

type LegacyDisplayAppearanceSource = Readonly<{
  primaryColor: string
  accentColor: string
  logo?: DisplayImageAsset
  background?: DisplayImageAsset
}>

function cloneAppearance(appearance: DisplayAppearanceConfiguration): ResolvedDisplayAppearanceConfiguration {
  return {
    logo: { ...appearance.logo }, theme: { ...appearance.theme }, colors: { ...appearance.colors },
    textStyle: appearance.textStyle, drawBox: { ...appearance.drawBox }, background: { ...appearance.background },
    typography: { ...(appearance.typography ?? DEFAULT_DISPLAY_TYPOGRAPHY) },
    countdownStyle: { ...(appearance.countdownStyle ?? DEFAULT_COUNTDOWN_STYLE) },
  }
}

export function resolveDisplayAppearance(configuration?: Pick<DisplayConfiguration, 'appearance'> | null, legacy?: LegacyDisplayAppearanceSource): ResolvedDisplayAppearanceConfiguration {
  if (configuration?.appearance !== undefined) {
    const validated = validateDisplayAppearance(configuration.appearance)
    if (validated.ok) return cloneAppearance(validated.value)
  }
  const base = cloneAppearance(DEFAULT_DISPLAY_APPEARANCE)
  return {
    ...base,
    logo: legacy?.logo === undefined ? base.logo : { ...base.logo, source: 'custom', customAsset: legacy.logo },
    colors: { ...base.colors, ...(legacy === undefined ? {} : { primary: legacy.primaryColor, accent: legacy.accentColor }) },
    background: legacy?.background === undefined ? base.background : { ...base.background, type: 'image', imageAsset: legacy.background },
  }
}

export function applyDisplayThemePreset(appearance: DisplayAppearanceConfiguration, preset: DisplayThemePreset): DisplayAppearanceConfiguration {
  const normalized = cloneAppearance(appearance)
  const countdownNumberFollowsTheme = normalized.countdownStyle.numberColor === normalized.colors.text
  const countdownLabelFollowsTheme = normalized.countdownStyle.labelColor === normalized.colors.text
  const presetValues: Record<Exclude<DisplayThemePreset, 'custom'>, Pick<DisplayAppearanceConfiguration, 'colors' | 'drawBox'>> = {
    default: { colors: { primary: '#7567FF', accent: '#F2A93B', text: '#FFFFFF', background: '#1D1726' }, drawBox: { ...DEFAULT_DISPLAY_APPEARANCE.drawBox } },
    light: { colors: { primary: '#5B46D8', accent: '#D77B1D', text: '#1D1726', background: '#F5F1E8' }, drawBox: { ...DEFAULT_DISPLAY_APPEARANCE.drawBox, fillColor: '#FFFFFF', borderColor: '#5B46D8', textColor: '#1D1726', labelFillColor: '#E8E1FF', labelTextColor: '#1D1726' } },
    dark: { colors: { primary: '#8B7DFF', accent: '#F2A93B', text: '#FFFFFF', background: '#121017' }, drawBox: { ...DEFAULT_DISPLAY_APPEARANCE.drawBox, fillColor: '#21113E', borderColor: '#8B7DFF' } },
    contrast: { colors: { primary: '#FFF200', accent: '#00E5FF', text: '#FFFFFF', background: '#000000' }, drawBox: { ...DEFAULT_DISPLAY_APPEARANCE.drawBox, fillColor: '#000000', borderColor: '#FFF200', borderWidth: 4, textColor: '#FFFFFF', labelFillColor: '#FFF200', labelTextColor: '#000000' } },
    transparent: { colors: { ...normalized.colors }, drawBox: { ...normalized.drawBox } },
  }
  if (preset === 'custom') return { ...normalized, theme: { preset } }
  const selected = presetValues[preset]
  return { ...normalized, theme: { preset }, colors: selected.colors, drawBox: selected.drawBox, countdownStyle: { ...normalized.countdownStyle, numberColor: countdownNumberFollowsTheme ? selected.colors.text : normalized.countdownStyle.numberColor, labelColor: countdownLabelFollowsTheme ? selected.colors.text : normalized.countdownStyle.labelColor }, background: { ...normalized.background, type: preset === 'transparent' ? 'transparent' : 'theme' } }
}

const validHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const oneOf = <T extends string>(value: unknown, options: readonly T[]): value is T => typeof value === 'string' && options.includes(value as T)
const imageAssetValid = (value: unknown): value is DisplayImageAsset => record(value) && typeof value.type === 'string' && value.type.startsWith('image/') && value.blob instanceof Blob && value.blob.size <= 5 * 1024 * 1024
const optionalNonEmptyString = (value: unknown): value is string | undefined => value === undefined || (typeof value === 'string' && value.trim().length > 0)

export function validateDisplayAppearance(value: unknown): Result<ResolvedDisplayAppearanceConfiguration> {
  if (!record(value) || !record(value.logo) || !record(value.theme) || !record(value.colors) || !record(value.drawBox) || !record(value.background)) return failure('invalid-display-appearance', 'Display appearance is incomplete.')
  const logo = value.logo; const colors = value.colors; const drawBox = value.drawBox; const background = value.background
  if (typeof logo.visible !== 'boolean' || !oneOf(logo.source, ['kocokan', 'custom']) || !oneOf(logo.position, ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']) || typeof logo.size !== 'number' || !Number.isFinite(logo.size) || logo.size < 24 || logo.size > 240 || (logo.customAsset !== undefined && !imageAssetValid(logo.customAsset))) return failure('invalid-display-logo', 'Display logo configuration is invalid.')
  if (!oneOf(value.theme.preset, ['default', 'light', 'dark', 'contrast', 'transparent', 'custom'])) return failure('invalid-display-theme', 'Display theme preset is invalid.')
  if (!validHex(colors.primary) || !validHex(colors.accent) || !validHex(colors.text) || !validHex(colors.background)) return failure('invalid-display-colors', 'Display colors must use six-digit hexadecimal values.')
  if (!oneOf(value.textStyle, ['default', 'outline', 'shadow'])) return failure('invalid-display-text-style', 'Display text style is invalid.')
  if (!oneOf(drawBox.preset, ['solid', 'outline', 'brutal', 'clean']) || !validHex(drawBox.fillColor) || typeof drawBox.borderVisible !== 'boolean' || !validHex(drawBox.borderColor) || typeof drawBox.borderWidth !== 'number' || !Number.isFinite(drawBox.borderWidth) || drawBox.borderWidth < 0 || drawBox.borderWidth > 16 || !oneOf(drawBox.cornerStyle, ['square', 'rounded-sm', 'rounded-md']) || !oneOf(drawBox.shadowStyle, ['none', 'hard', 'soft']) || !validHex(drawBox.textColor) || typeof drawBox.labelVisible !== 'boolean' || !validHex(drawBox.labelFillColor) || !validHex(drawBox.labelTextColor)) return failure('invalid-display-draw-box', 'Display draw box configuration is invalid.')
  if (!oneOf(background.type, ['theme', 'color', 'image', 'transparent']) || !oneOf(background.fit, ['cover', 'contain']) || (background.imageAsset !== undefined && !imageAssetValid(background.imageAsset))) return failure('invalid-display-background', 'Display background configuration is invalid.')
  const typography = value.typography === undefined ? DEFAULT_DISPLAY_TYPOGRAPHY : value.typography
  if (!record(typography) || !oneOf(typography.fontSource, ['builtin', 'custom']) || !oneOf(typography.fontFamily, ['kocokan', 'inter', 'arial', 'mono']) || ![400, 500, 700, 800].includes(typography.fontWeight as number) || !optionalNonEmptyString(typography.customFontAssetId) || !optionalNonEmptyString(typography.customFontFileName) || (typography.fontSource === 'custom' && typography.customFontAssetId === undefined)) return failure('invalid-display-typography', 'Display typography configuration is invalid.')
  const countdown = value.countdownStyle === undefined ? { ...DEFAULT_COUNTDOWN_STYLE, numberColor: colors.text, labelColor: colors.text } : value.countdownStyle
  if (!record(countdown) || !oneOf(countdown.preset, ['minimal', 'box', 'outline', 'bold']) || !validHex(countdown.numberColor) || typeof countdown.numberScale !== 'number' || !Number.isFinite(countdown.numberScale) || countdown.numberScale < 0.7 || countdown.numberScale > 1.3 || typeof countdown.labelVisible !== 'boolean' || !validHex(countdown.labelColor) || typeof countdown.boxVisible !== 'boolean' || !validHex(countdown.boxFill) || typeof countdown.borderVisible !== 'boolean' || !validHex(countdown.borderColor) || typeof countdown.borderWidth !== 'number' || !Number.isFinite(countdown.borderWidth) || countdown.borderWidth < 0 || countdown.borderWidth > 12 || !oneOf(countdown.cornerStyle, ['square', 'rounded-sm', 'rounded-md']) || !oneOf(countdown.shadowStyle, ['none', 'hard', 'soft']) || !oneOf(countdown.position, ['upper', 'center', 'lower']) || (countdown.fontFamilyOverride !== undefined && !oneOf(countdown.fontFamilyOverride, ['kocokan', 'inter', 'arial', 'mono']))) return failure('invalid-display-countdown', 'Display countdown configuration is invalid.')
  return success({
    logo: { visible: logo.visible, source: logo.source, position: logo.position, size: logo.size, ...(imageAssetValid(logo.customAsset) ? { customAsset: logo.customAsset } : {}) },
    theme: { preset: value.theme.preset },
    colors: { primary: colors.primary, accent: colors.accent, text: colors.text, background: colors.background },
    textStyle: value.textStyle,
    drawBox: {
      preset: drawBox.preset, fillColor: drawBox.fillColor, borderVisible: drawBox.borderVisible,
      borderColor: drawBox.borderColor, borderWidth: drawBox.borderWidth, cornerStyle: drawBox.cornerStyle,
      shadowStyle: drawBox.shadowStyle, textColor: drawBox.textColor, labelVisible: drawBox.labelVisible,
      labelFillColor: drawBox.labelFillColor, labelTextColor: drawBox.labelTextColor,
    },
    background: { type: background.type, fit: background.fit, ...(imageAssetValid(background.imageAsset) ? { imageAsset: background.imageAsset } : {}) },
    typography: { fontSource: typography.fontSource, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight as DisplayFontWeight, ...(typeof typography.customFontAssetId === 'string' ? { customFontAssetId: typography.customFontAssetId } : {}), ...(typeof typography.customFontFileName === 'string' ? { customFontFileName: typography.customFontFileName } : {}) },
    countdownStyle: { preset: countdown.preset, numberColor: countdown.numberColor, numberScale: countdown.numberScale, labelVisible: countdown.labelVisible, labelColor: countdown.labelColor, boxVisible: countdown.boxVisible, boxFill: countdown.boxFill, borderVisible: countdown.borderVisible, borderColor: countdown.borderColor, borderWidth: countdown.borderWidth, cornerStyle: countdown.cornerStyle, shadowStyle: countdown.shadowStyle, position: countdown.position, ...(countdown.fontFamilyOverride === undefined ? {} : { fontFamilyOverride: countdown.fontFamilyOverride }) },
  })
}

export interface DisplayConfiguration {
  readonly id: DisplayConfigurationId
  readonly eventId: EventId
  readonly targetResolution: TargetResolution
  readonly safeAreaMargin: number
  readonly blackoutAppearance: 'pure-black'
  /** Optional on persisted legacy records; resolve through resolveDisplayAppearance. */
  readonly appearance?: DisplayAppearanceConfiguration
  readonly createdAt: IsoTimestamp
  readonly updatedAt: IsoTimestamp
}

export function validateTargetResolution(
  value: unknown,
): Result<TargetResolution> {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('width' in value) ||
    !('height' in value)
  ) {
    return failure(
      'invalid-target-resolution',
      'Target resolution requires width and height.',
    )
  }

  const width = value.width
  const height = value.height
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 16384 ||
    height > 16384
  ) {
    return failure(
      'invalid-target-resolution',
      'Resolution dimensions must be positive integers up to 16384.',
    )
  }

  return success({ height, width })
}

export function validateSafeAreaMargin(
  value: unknown,
): Result<number> {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return failure(
      'invalid-safe-area-margin',
      'Safe-area margin must be a non-negative finite number.',
    )
  }

  return success(value)
}

export function validateBlackoutAppearance(
  value: unknown,
): Result<'pure-black'> {
  if (value !== 'pure-black') {
    return failure(
      'invalid-blackout-appearance',
      'Only pure-black blackout is supported.',
    )
  }

  return success('pure-black')
}

export function validateDisplayConfiguration(
  configuration: DisplayConfiguration,
): Result<DisplayConfiguration> {
  if (!validateTargetResolution(configuration.targetResolution).ok) {
    return failure(
      'invalid-display-resolution',
      'Display configuration target resolution is invalid.',
    )
  }

  if (!validateSafeAreaMargin(configuration.safeAreaMargin).ok) {
    return failure(
      'invalid-display-safe-area',
      'Display configuration safe-area margin is invalid.',
    )
  }

  if (!validateBlackoutAppearance(configuration.blackoutAppearance).ok) {
    return failure(
      'invalid-display-blackout',
      'Display configuration blackout appearance is invalid.',
    )
  }

  if (configuration.appearance !== undefined && !validateDisplayAppearance(configuration.appearance).ok) {
    return failure('invalid-display-appearance', 'Display configuration appearance is invalid.')
  }

  if (
    !isIsoTimestamp(configuration.createdAt) ||
    !isIsoTimestamp(configuration.updatedAt)
  ) {
    return failure(
      'invalid-display-timestamp',
      'Display configuration timestamps must be valid ISO UTC values.',
    )
  }

  return success(configuration)
}
