import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react'
import { Button } from '../../shared/ui/Button.tsx'
import { Icon } from '../../shared/ui/Icon.tsx'
import { useProductionAudiencePublisher, useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { signalProductionWorkspaceChanged } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { createDisplayConfigurationService } from '../../application/display/display-configuration-service.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { ProductionLoadingState, ProductionSetupRequired } from '../../shared/components/ProductionWorkspaceState.tsx'
import {
  applyDisplayThemePreset,
  DEFAULT_DISPLAY_APPEARANCE,
  resolveDisplayAppearance,
  validateDisplayAppearance,
  type DisplayAppearanceConfiguration,
  type DisplayBuiltinFont,
  type DisplayCountdownPosition,
  type DisplayCountdownPreset,
  type DisplayFontWeight,
  type ResolvedDisplayAppearanceConfiguration,
} from '../../domain/display/display-configuration.types.ts'
import { isTransparentDisplayAppearance } from '../../ui/audience/display-appearance-style.ts'
import { AudiencePresentation } from '../../ui/audience/AudiencePresentation.tsx'
import type { PublicDisplaySnapshot } from '../../application/display-transport/public-projection.ts'
import { parseTicketNumber } from '../../domain/participants/participant.invariants.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import { parseIsoTimestamp } from '../../domain/shared/timestamps.ts'
import '../../styles/kocokan/display-designer.css'
import { DexieDisplayFontAssetRepository } from '../../infrastructure/persistence/repositories/display-font-asset.repository.ts'
import { getDisplayConnectionStatus, subscribeDisplayConnectionStatus, type DisplayConnectionStatus } from '../../application/display-transport/connection-status.ts'
import { AudienceShareModal } from './AudienceShareModal.tsx'

type PreviewMode = 'standby' | 'countdown' | 'rolling' | 'one' | 'three' | 'six' | 'ten' | 'confirmed'
type LogoSource = 'kocokan' | 'event'
type LogoPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
type ThemePreset = 'default' | 'light' | 'dark' | 'contrast' | 'transparent' | 'custom'
type TextStyle = 'default' | 'outline' | 'shadow'
type BoxPreset = 'solid' | 'outline' | 'brutal' | 'clean'
type CornerStyle = 'square' | 'small' | 'medium'
type ShadowStyle = 'none' | 'hard' | 'soft'
type BackgroundMode = 'theme' | 'color' | 'image' | 'transparent'
type BackgroundFit = 'cover' | 'contain'

const DEFAULT_PREVIEW_MODE: PreviewMode = 'standby'

interface DesignerState {
  readonly previewMode: PreviewMode
  readonly showLogo: boolean
  readonly logoSource: LogoSource
  readonly logoPosition: LogoPosition
  readonly logoSize: number
  readonly logoCustomAsset?: { readonly type: string; readonly blob: Blob }
  readonly theme: ThemePreset
  readonly primaryColor: string
  readonly accentColor: string
  readonly textColor: string
  readonly backgroundColor: string
  readonly textStyle: TextStyle
  readonly boxPreset: BoxPreset
  readonly boxFill: string
  readonly showBorder: boolean
  readonly borderColor: string
  readonly borderWidth: number
  readonly cornerStyle: CornerStyle
  readonly shadowStyle: ShadowStyle
  readonly numberColor: string
  readonly showLabel: boolean
  readonly labelColor: string
  readonly labelTextColor: string
  readonly backgroundMode: BackgroundMode
  readonly backgroundFit: BackgroundFit
  readonly backgroundImageAsset?: { readonly type: string; readonly blob: Blob }
  readonly fontSource: 'builtin' | 'custom'
  readonly fontFamily: DisplayBuiltinFont
  readonly fontWeight: DisplayFontWeight
  readonly customFontAssetId?: string
  readonly customFontFileName?: string
  readonly customFontStatus: 'none' | 'loading' | 'loaded' | 'error'
  readonly countdownPreset: DisplayCountdownPreset
  readonly countdownNumberColor: string
  readonly countdownNumberScale: number
  readonly countdownLabelVisible: boolean
  readonly countdownLabelColor: string
  readonly countdownBoxVisible: boolean
  readonly countdownBoxFill: string
  readonly countdownBorderVisible: boolean
  readonly countdownBorderColor: string
  readonly countdownBorderWidth: number
  readonly countdownCornerStyle: CornerStyle
  readonly countdownShadowStyle: ShadowStyle
  readonly countdownPosition: DisplayCountdownPosition
  readonly countdownFontOverride: DisplayBuiltinFont | 'inherit'
}

type DesignerColorKey =
  | 'primaryColor'
  | 'accentColor'
  | 'textColor'
  | 'backgroundColor'
  | 'boxFill'
  | 'borderColor'
  | 'numberColor'
  | 'labelColor'
  | 'labelTextColor'
  | 'countdownNumberColor'
  | 'countdownLabelColor'
  | 'countdownBoxFill'
  | 'countdownBorderColor'

type PreviewColorVariable = readonly [name: `--${string}`, value: string]

const DEFAULT_STATE: DesignerState = {
  previewMode: DEFAULT_PREVIEW_MODE,
  showLogo: true,
  logoSource: 'kocokan',
  logoPosition: 'top-left',
  logoSize: DEFAULT_DISPLAY_APPEARANCE.logo.size,
  theme: 'default',
  primaryColor: '#7567FF',
  accentColor: '#F2A93B',
  textColor: '#FFFFFF',
  backgroundColor: '#1D1726',
  textStyle: 'default',
  boxPreset: 'solid',
  boxFill: DEFAULT_DISPLAY_APPEARANCE.drawBox.fillColor,
  showBorder: true,
  borderColor: '#7567FF',
  borderWidth: 2,
  cornerStyle: 'small',
  shadowStyle: 'none',
  numberColor: '#FFFFFF',
  showLabel: true,
  labelColor: '#3B1684',
  labelTextColor: '#FFFFFF',
  backgroundMode: 'theme',
  backgroundFit: 'cover',
  fontSource: 'builtin', fontFamily: 'kocokan', fontWeight: 700, customFontStatus: 'none',
  countdownPreset: 'minimal', countdownNumberColor: '#FFFFFF', countdownNumberScale: 1,
  countdownLabelVisible: true, countdownLabelColor: '#FFFFFF', countdownBoxVisible: false,
  countdownBoxFill: '#21113E', countdownBorderVisible: false, countdownBorderColor: '#7567FF',
  countdownBorderWidth: 2, countdownCornerStyle: 'small', countdownShadowStyle: 'none',
  countdownPosition: 'center', countdownFontOverride: 'inherit',
}

const previewModes: readonly { value: PreviewMode; label: string }[] = [
  { value: 'standby', label: 'Standby' },
  { value: 'countdown', label: 'Countdown' },
  { value: 'rolling', label: 'Rolling' },
  { value: 'one', label: '1 Pemenang' },
  { value: 'three', label: '3 Pemenang' },
  { value: 'six', label: '6 Pemenang' },
  { value: 'ten', label: '10 Pemenang' },
  { value: 'confirmed', label: 'Confirmed' },
]

function fixtureTicket(value: string) {
  const parsed = parseTicketNumber(value)
  if (!parsed.ok) throw new Error(`Invalid Display Designer ticket fixture: ${value}`)
  return parsed.value
}

function fixtureTimestamp(value: string) {
  const parsed = parseIsoTimestamp(value)
  if (!parsed.ok) throw new Error(`Invalid Display Designer timestamp fixture: ${value}`)
  return parsed.value
}

const tickets = ['870159', '230534', '273081', '046821', '991205', '510733', '348902', '711064', '125438', '662017'].map(fixtureTicket)
const DISPLAY_DESIGNER_PREVIEW_SESSION = '00000000-0000-4000-8000-000000000001' as DrawSessionId
const DISPLAY_DESIGNER_PREVIEW_TIMESTAMP = fixtureTimestamp('2026-01-01T00:00:00.000Z')

const themePresets: readonly { value: ThemePreset; label: string; className: string }[] = [
  { value: 'default', label: 'Default', className: 'is-default' },
  { value: 'light', label: 'Light', className: 'is-light' },
  { value: 'dark', label: 'Dark', className: 'is-dark' },
  { value: 'contrast', label: 'Contrast', className: 'is-contrast' },
  { value: 'transparent', label: 'Transparent', className: 'is-transparent' },
  { value: 'custom', label: 'Custom', className: 'is-custom' },
]

const logoPositions: readonly { value: LogoPosition; label: string }[] = [
  { value: 'top-left', label: 'Kiri Atas' },
  { value: 'top-center', label: 'Tengah Atas' },
  { value: 'top-right', label: 'Kanan Atas' },
  { value: 'bottom-left', label: 'Kiri Bawah' },
  { value: 'bottom-center', label: 'Tengah Bawah' },
  { value: 'bottom-right', label: 'Kanan Bawah' },
]

function appearanceToState(appearance: ResolvedDisplayAppearanceConfiguration, previewMode: PreviewMode = DEFAULT_PREVIEW_MODE): DesignerState {
  return {
    previewMode,
    showLogo: appearance.logo.visible,
    logoSource: appearance.logo.source === 'custom' ? 'event' : 'kocokan',
    logoPosition: appearance.logo.position,
    logoSize: appearance.logo.size,
    ...(appearance.logo.customAsset === undefined ? {} : { logoCustomAsset: appearance.logo.customAsset }),
    theme: appearance.theme.preset,
    primaryColor: appearance.colors.primary,
    accentColor: appearance.colors.accent,
    textColor: appearance.colors.text,
    backgroundColor: appearance.colors.background,
    textStyle: appearance.textStyle,
    boxPreset: appearance.drawBox.preset,
    boxFill: appearance.drawBox.fillColor,
    showBorder: appearance.drawBox.borderVisible,
    borderColor: appearance.drawBox.borderColor,
    borderWidth: appearance.drawBox.borderWidth,
    cornerStyle: appearance.drawBox.cornerStyle === 'rounded-md' ? 'medium' : appearance.drawBox.cornerStyle === 'rounded-sm' ? 'small' : 'square',
    shadowStyle: appearance.drawBox.shadowStyle,
    numberColor: appearance.drawBox.textColor,
    showLabel: appearance.drawBox.labelVisible,
    labelColor: appearance.drawBox.labelFillColor,
    labelTextColor: appearance.drawBox.labelTextColor,
    backgroundMode: appearance.background.type,
    backgroundFit: appearance.background.fit,
    ...(appearance.background.imageAsset === undefined ? {} : { backgroundImageAsset: appearance.background.imageAsset }),
    fontSource: appearance.typography.fontSource,
    fontFamily: appearance.typography.fontFamily,
    fontWeight: appearance.typography.fontWeight,
    ...(appearance.typography.customFontAssetId === undefined ? {} : { customFontAssetId: appearance.typography.customFontAssetId }),
    ...(appearance.typography.customFontFileName === undefined ? {} : { customFontFileName: appearance.typography.customFontFileName }),
    customFontStatus: appearance.typography.customFontAssetId === undefined ? 'none' : 'loading',
    countdownPreset: appearance.countdownStyle.preset,
    countdownNumberColor: appearance.countdownStyle.numberColor,
    countdownNumberScale: appearance.countdownStyle.numberScale,
    countdownLabelVisible: appearance.countdownStyle.labelVisible,
    countdownLabelColor: appearance.countdownStyle.labelColor,
    countdownBoxVisible: appearance.countdownStyle.boxVisible,
    countdownBoxFill: appearance.countdownStyle.boxFill,
    countdownBorderVisible: appearance.countdownStyle.borderVisible,
    countdownBorderColor: appearance.countdownStyle.borderColor,
    countdownBorderWidth: appearance.countdownStyle.borderWidth,
    countdownCornerStyle: appearance.countdownStyle.cornerStyle === 'rounded-md' ? 'medium' : appearance.countdownStyle.cornerStyle === 'rounded-sm' ? 'small' : 'square',
    countdownShadowStyle: appearance.countdownStyle.shadowStyle,
    countdownPosition: appearance.countdownStyle.position,
    countdownFontOverride: appearance.countdownStyle.fontFamilyOverride ?? 'inherit',
  }
}

function stateToAppearance(state: DesignerState): DisplayAppearanceConfiguration {
  return {
    logo: { visible: state.showLogo, source: state.logoSource === 'event' ? 'custom' : 'kocokan', position: state.logoPosition, size: state.logoSize, ...(state.logoCustomAsset === undefined ? {} : { customAsset: state.logoCustomAsset }) },
    theme: { preset: state.theme },
    colors: { primary: state.primaryColor, accent: state.accentColor, text: state.textColor, background: state.backgroundColor },
    textStyle: state.textStyle,
    drawBox: { preset: state.boxPreset, fillColor: state.boxFill, borderVisible: state.showBorder, borderColor: state.borderColor, borderWidth: state.borderWidth, cornerStyle: state.cornerStyle === 'medium' ? 'rounded-md' : state.cornerStyle === 'small' ? 'rounded-sm' : 'square', shadowStyle: state.shadowStyle, textColor: state.numberColor, labelVisible: state.showLabel, labelFillColor: state.labelColor, labelTextColor: state.labelTextColor },
    background: { type: state.backgroundMode, fit: state.backgroundFit, ...(state.backgroundImageAsset === undefined ? {} : { imageAsset: state.backgroundImageAsset }) },
    typography: { fontSource: state.fontSource, fontFamily: state.fontFamily, fontWeight: state.fontWeight, ...(state.customFontAssetId === undefined ? {} : { customFontAssetId: state.customFontAssetId }), ...(state.customFontFileName === undefined ? {} : { customFontFileName: state.customFontFileName }) },
    countdownStyle: { preset: state.countdownPreset, numberColor: state.countdownNumberColor, numberScale: state.countdownNumberScale, labelVisible: state.countdownLabelVisible, labelColor: state.countdownLabelColor, boxVisible: state.countdownBoxVisible, boxFill: state.countdownBoxFill, borderVisible: state.countdownBorderVisible, borderColor: state.countdownBorderColor, borderWidth: state.countdownBorderWidth, cornerStyle: state.countdownCornerStyle === 'medium' ? 'rounded-md' : state.countdownCornerStyle === 'small' ? 'rounded-sm' : 'square', shadowStyle: state.countdownShadowStyle, position: state.countdownPosition, ...(state.countdownFontOverride === 'inherit' ? {} : { fontFamilyOverride: state.countdownFontOverride }) },
  }
}

function appearanceSignature(appearance: DisplayAppearanceConfiguration): string {
  return JSON.stringify({ ...appearance, logo: { ...appearance.logo, customAsset: appearance.logo.customAsset === undefined ? undefined : [appearance.logo.customAsset.type, appearance.logo.customAsset.blob.size] }, background: { ...appearance.background, imageAsset: appearance.background.imageAsset === undefined ? undefined : [appearance.background.imageAsset.type, appearance.background.imageAsset.blob.size] } })
}

function colorPreviewVariables(key: DesignerColorKey, value: string, state: DesignerState): readonly PreviewColorVariable[] {
  switch (key) {
    case 'primaryColor': return [['--display-primary', value], ['--accent', value]]
    case 'accentColor': {
      const variables: PreviewColorVariable[] = [['--display-accent', value], ['--accent-hover', value]]
      if (state.shadowStyle === 'hard' || state.boxPreset === 'brutal') variables.push(['--draw-box-shadow', `.45rem .45rem 0 ${value}`])
      if (state.countdownBoxVisible && state.countdownShadowStyle === 'hard') variables.push(['--countdown-box-shadow', `.45rem .45rem 0 ${value}`])
      return variables
    }
    case 'textColor': return [
      ['--display-text', value],
      ['--text-primary', value],
      ['--text-secondary', `color-mix(in srgb, ${value} 78%, transparent)`],
      ['--text-muted', `color-mix(in srgb, ${value} 64%, transparent)`],
    ]
    case 'backgroundColor': return [['--display-background', value]]
    case 'boxFill': return [['--draw-box-fill', value]]
    case 'borderColor': return [['--draw-box-border', value]]
    case 'numberColor': return [['--draw-box-text', value]]
    case 'labelColor': return [['--draw-label-fill', value]]
    case 'labelTextColor': return [['--draw-label-text', value]]
    case 'countdownNumberColor': return [['--countdown-number-color', value]]
    case 'countdownLabelColor': return [['--countdown-label-color', value]]
    case 'countdownBoxFill': return [['--countdown-box-fill', value]]
    case 'countdownBorderColor': return [['--countdown-box-border', value]]
  }
}

function previewWinnerCount(mode: PreviewMode): number {
  if (mode === 'one') return 1
  if (mode === 'six') return 6
  if (mode === 'ten') return 10
  return 3
}

export function ProductionDisplayDesignerPage() {
  const workspace = useProductionWorkspace()
  const audience = useProductionAudiencePublisher()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const displayService = useMemo(() => {
    if (services.displayConfigurations === undefined) return null
    return createDisplayConfigurationService({ events: services.events, configurations: services.displayConfigurations })
  }, [services])
  const displayStatusKey = workspace.status === 'ready' && workspace.displayConfiguration !== null
    ? `${workspace.event.id}:${workspace.displayConfiguration.id}`
    : 'unconfigured'
  const subscribeToDisplayStatus = useCallback(
    (listener: () => void) => subscribeDisplayConnectionStatus(displayStatusKey, listener),
    [displayStatusKey],
  )
  const getDisplayStatus = useCallback(
    () => getDisplayConnectionStatus(displayStatusKey),
    [displayStatusKey],
  )
  const observedConnectionStatus = useSyncExternalStore<DisplayConnectionStatus>(subscribeToDisplayStatus, getDisplayStatus, () => 'waiting')
  const audienceSnapshot = useSyncExternalStore(audience.subscribeSnapshot, audience.getSnapshot, audience.getSnapshot)

  if (workspace.status === 'loading') return <ProductionLoadingState description="Menyiapkan pengaturan Tampilan Audiens." />
  if (workspace.status !== 'ready') return <ProductionSetupRequired description="Pilih Acara sebelum mengatur Tampilan Audiens." />
  const initialAppearance = resolveDisplayAppearance(workspace.displayConfiguration, workspace.eventSettings)
  const audiencePath = workspace.displayConfiguration === null
    ? '/display'
    : `/display?eventId=${encodeURIComponent(workspace.event.id)}&displayConfigurationId=${encodeURIComponent(workspace.displayConfiguration.id)}`
  const connectionStatus: DisplayConnectionStatus = workspace.displayConfiguration === null ? 'setup-required' : observedConnectionStatus

  return <DisplayDesignerPrototypePage audiencePath={audiencePath} audienceSnapshot={audienceSnapshot} connectionStatus={connectionStatus} key={`${workspace.event.id}:${workspace.displayConfiguration?.updatedAt ?? 'new'}`} initialAppearance={initialAppearance} previewEventName={workspace.eventSettings.displayName} previewEventSubtitle={workspace.eventSettings.subtitle} previewSafeAreaMargin={workspace.displayConfiguration?.safeAreaMargin ?? 48} onSave={async (appearance) => {
    if (displayService === null) throw new Error('Penyimpanan konfigurasi tampilan tidak tersedia.')
    await services.open?.()
    const existing = workspace.displayConfiguration
    const saved = await displayService.saveForEvent(workspace.event, {
      targetResolution: existing?.targetResolution ?? { width: 1920, height: 1080 },
      safeAreaMargin: existing?.safeAreaMargin ?? 48,
      blackoutAppearance: existing?.blackoutAppearance ?? 'pure-black',
      appearance,
    }, existing)
    signalProductionWorkspaceChanged()
    if (audience.publisher !== null) {
      const published = audience.publishAppearance(saved.appearance ?? appearance)
      if (!published.ok) throw new Error('Pengaturan tersimpan, tetapi belum dapat dikirim ke Tampilan Audiens. Coba simpan kembali setelah koneksi pulih.')
    }
  }} />
}

export function DisplayDesignerPrototypePage({ audiencePath = '/display', audienceSnapshot, connectionStatus = 'unavailable', initialAppearance = DEFAULT_DISPLAY_APPEARANCE, onSave, previewEventName = 'KOCOKAN LAUNCH NIGHT', previewEventSubtitle = '', previewSafeAreaMargin = 48 }: { readonly audiencePath?: string; readonly audienceSnapshot?: PublicDisplaySnapshot; readonly connectionStatus?: DisplayConnectionStatus; readonly initialAppearance?: DisplayAppearanceConfiguration; readonly onSave?: (appearance: DisplayAppearanceConfiguration) => Promise<void>; readonly previewEventName?: string; readonly previewEventSubtitle?: string; readonly previewSafeAreaMargin?: number }) {
  const initialState = useMemo(() => initialAppearance === DEFAULT_DISPLAY_APPEARANCE ? DEFAULT_STATE : appearanceToState(resolveDisplayAppearance({ appearance: initialAppearance })), [initialAppearance])
  const [state, setState] = useState<DesignerState>(initialState)
  const [savedState, setSavedState] = useState<DesignerState>(initialState)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const previewHostRef = useRef<HTMLDivElement>(null)
  const sharePreviewHostRef = useRef<HTMLDivElement>(null)
  const draftAppearance = useMemo(() => stateToAppearance(state), [state])
  const savedAppearanceSignature = useMemo(() => appearanceSignature(stateToAppearance(savedState)), [savedState])
  const dirty = useMemo(() => appearanceSignature(draftAppearance) !== savedAppearanceSignature, [draftAppearance, savedAppearanceSignature])

  useEffect(() => {
    if (state.customFontAssetId === undefined) return
    const repository = new DexieDisplayFontAssetRepository()
    let disposed = false
    void repository.findById(state.customFontAssetId).then((asset) => {
      if (!disposed) setState((current) => current.customFontAssetId === state.customFontAssetId ? { ...current, customFontStatus: asset === null ? 'error' : 'loaded', ...(asset === null ? {} : { customFontFileName: asset.name }) } : current)
    }).finally(() => repository.close())
    return () => { disposed = true; repository.close() }
  }, [state.customFontAssetId])

  function update<K extends keyof DesignerState>(key: K, value: DesignerState[K]) {
    setState((current) => ({ ...current, [key]: value }))
    setSaveState('saved')
    setErrorMessage(null)
  }

  function previewColor(key: DesignerColorKey, value: string) {
    const previewRoot = previewHostRef.current?.querySelector<HTMLElement>('.audience-display-page[data-audience-preview="true"]')
    if (previewRoot === null || previewRoot === undefined) return
    for (const [name, variableValue] of colorPreviewVariables(key, value, state)) previewRoot.style.setProperty(name, variableValue)
  }

  function chooseTheme(theme: ThemePreset) {
    setState((current) => appearanceToState(resolveDisplayAppearance({ appearance: applyDisplayThemePreset(stateToAppearance(current), theme) }), current.previewMode))
    setSaveState('saved')
    setErrorMessage(null)
  }

  function handleImage(file: File | undefined, target: 'logo' | 'background') {
    if (file === undefined) return
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setSaveState('error')
      setErrorMessage('Gunakan gambar JPG, PNG, atau WEBP berukuran maksimal 5 MB.')
      return
    }
    if (target === 'logo') setState((current) => ({ ...current, logoSource: 'event', logoCustomAsset: { type: file.type, blob: file } }))
    else setState((current) => ({ ...current, backgroundMode: 'image', backgroundImageAsset: { type: file.type, blob: file } }))
    setSaveState('saved')
    setErrorMessage(null)
  }

  function chooseCountdownPreset(preset: DisplayCountdownPreset) {
    setState((current) => ({
      ...current,
      countdownPreset: preset,
      ...(preset === 'minimal' ? { countdownBoxVisible: false, countdownBorderVisible: false, countdownShadowStyle: 'none' as const }
        : preset === 'box' ? { countdownBoxVisible: true, countdownBorderVisible: false, countdownShadowStyle: 'soft' as const }
          : preset === 'outline' ? { countdownBoxVisible: true, countdownBorderVisible: true, countdownShadowStyle: 'none' as const }
            : { countdownBoxVisible: false, countdownBorderVisible: false, countdownShadowStyle: 'hard' as const }),
    }))
    setSaveState('saved')
    setErrorMessage(null)
  }

  async function handleFont(file: File | undefined) {
    if (file === undefined) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['woff', 'woff2', 'ttf'].includes(extension ?? '') || file.size > 10 * 1024 * 1024) {
      setSaveState('error'); setErrorMessage('Gunakan font WOFF, WOFF2, atau TTF berukuran maksimal 10 MB.'); return
    }
    setState((current) => ({ ...current, customFontStatus: 'loading' }))
    setErrorMessage(null)
    let objectUrl: string | undefined
    try {
      if (typeof FontFace !== 'undefined') {
        objectUrl = URL.createObjectURL(file)
        const probe = new FontFace('KocokanFontUploadProbe', `url(${objectUrl})`)
        await probe.load()
      }
      const repository = new DexieDisplayFontAssetRepository()
      try {
        const asset = await repository.save({ name: file.name, type: file.type || `font/${extension}`, size: file.size, blob: file })
        setState((current) => ({ ...current, fontSource: 'custom', customFontAssetId: asset.id, customFontFileName: asset.name, customFontStatus: 'loaded' }))
        setSaveState('saved')
      } finally { repository.close() }
    } catch {
      setState((current) => ({ ...current, customFontStatus: 'error' }))
      setSaveState('error')
      setErrorMessage('Font tidak dapat dimuat. Tampilan tetap menggunakan font default.')
    } finally {
      if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl)
    }
  }

  function removeCustomFont() {
    setState((current) => ({ ...current, fontSource: 'builtin', customFontAssetId: undefined, customFontFileName: undefined, customFontStatus: 'none' }))
    setSaveState('saved')
    setErrorMessage(null)
  }

  async function saveAndApply() {
    const validated = validateDisplayAppearance(draftAppearance)
    if (!validated.ok) { setSaveState('error'); setErrorMessage(validated.error.message); return }
    if (onSave === undefined) { setSaveState('error'); setErrorMessage('Penyimpanan production tidak tersedia pada preview ini.'); return }
    setSaveState('saving')
    setErrorMessage(null)
    try {
      await onSave(validated.value)
      setSavedState(state)
      setSaveState('saved')
    } catch (cause: unknown) {
      setSaveState('error')
      setErrorMessage(cause instanceof Error ? cause.message : 'Pengaturan tidak dapat disimpan. Coba lagi.')
    }
  }

  return (
    <section aria-labelledby="display-designer-title" className="kc-display-designer display-designer">
      <header className="kc-display-designer__header display-designer__header">
        <div>
          <p className="kc-display-designer__eyebrow display-designer__eyebrow">DISPLAY DESIGNER</p>
          <h1 id="display-designer-title">Pengaturan Tampilan</h1>
          <p>Atur tampilan yang akan dilihat oleh audiens.</p>
        </div>
        <div className="kc-display-designer__header-actions">
          <span className="kc-display-designer__prototype-badge display-designer__prototype-badge">PRODUCTION</span>
        </div>
      </header>

      {shareOpen ? <AudienceShareModal
        audiencePath={audiencePath}
        connectionStatus={connectionStatus}
        onClose={() => setShareOpen(false)}
        open
        preview={audienceSnapshot === undefined
          ? <DesignerAudiencePreview appearance={draftAppearance} eventName={previewEventName} eventSubtitle={previewEventSubtitle} mode={state.previewMode} previewHostRef={sharePreviewHostRef} safeAreaMargin={previewSafeAreaMargin} />
          : <AudienceSnapshotPreview previewHostRef={sharePreviewHostRef} snapshot={audienceSnapshot} />}
        stateLabel={audienceSnapshot === undefined ? previewModes.find((mode) => mode.value === state.previewMode)?.label ?? 'Tidak tersedia' : audienceSnapshotLabel(audienceSnapshot)}
        transparent={state.backgroundMode === 'transparent'}
      /> : null}

      <div className="kc-display-designer__workspace display-designer__workspace">
        <div className="kc-display-designer__preview-column display-designer__preview">
          <div className="kc-display-designer__preview-sticky display-designer__preview-sticky">
            <div className="kc-display-designer__preview-card display-designer__preview-card">
              <div className="kc-display-designer__preview-card-heading display-designer__preview-card-heading">
                <div><span className="kc-display-designer__live-dot display-designer__live-dot" />LIVE PREVIEW</div>
                <span>16:9 · PREVIEW</span>
              </div>
              <DesignerAudiencePreview
                appearance={draftAppearance}
                eventName={previewEventName}
                eventSubtitle={previewEventSubtitle}
                mode={state.previewMode}
                previewHostRef={previewHostRef}
                safeAreaMargin={previewSafeAreaMargin}
              />
              <div className="kc-display-designer__preview-toolbar display-designer__preview-toolbar">
                <label htmlFor="display-preview-state">Pratinjau</label>
                <select id="display-preview-state" value={state.previewMode} onChange={(event) => update('previewMode', event.target.value as PreviewMode)}>
                  {previewModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                </select>
                <Button icon={<Icon name="ExternalLink" />} onClick={() => setShareOpen(true)} variant="secondary">Bagikan Tampilan</Button>
              </div>
            </div>
            <div className="kc-display-designer__notice display-designer__notice">
              <Icon name="CircleAlert" size={18} />
              <div><strong>Draft lokal</strong><span>Perubahan preview baru dikirim ke Tampilan Audiens setelah disimpan.</span></div>
            </div>
          </div>
        </div>

        <aside aria-label="Panel konfigurasi tampilan" className="kc-display-designer__controls display-designer__controls">
          <DesignerSection description="Atur logo yang tampil pada Tampilan Audiens." number="01" title="Logo">
            <Toggle checked={state.showLogo} label="Tampilkan logo" onChange={(checked) => update('showLogo', checked)} />
            <FieldGroup label="Sumber logo">
              <div className="kc-display-designer__choice-grid kc-display-designer__choice-grid--two">
                <ChoiceCard active={state.logoSource === 'kocokan'} label="Logo Kocokan" onClick={() => update('logoSource', 'kocokan')}>
                  <span className="kc-display-designer__logo-sample">K</span><small>Default</small>
                </ChoiceCard>
                <ChoiceCard active={state.logoSource === 'event'} label="Logo Acara" onClick={() => update('logoSource', 'event')}>
                  <span className="kc-display-designer__upload-sample"><Icon name="Upload" size={19} /></span>
                  <span className="kc-display-designer__upload-copy"><em>Logo acara</em><small>Aset lokal</small></span>
                </ChoiceCard>
              </div>
            </FieldGroup>
            {state.logoSource === 'event' ? <label className="kc-display-designer__dummy-upload"><Icon name="Upload" /><strong>{state.logoCustomAsset === undefined ? 'Upload logo acara' : 'Ganti logo acara'}</strong><span>JPG, PNG, atau WEBP · maks. 5 MB</span><input aria-label="Upload logo acara" accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => handleImage(event.target.files?.[0], 'logo')} /></label> : null}
            <FieldGroup label="Posisi logo">
              <div className="kc-display-designer__position-grid">
                {logoPositions.map((position) => <button aria-label={position.label} aria-pressed={state.logoPosition === position.value} key={position.value} onClick={() => update('logoPosition', position.value)} type="button"><span /></button>)}
              </div>
              <small className="kc-display-designer__field-hint">{logoPositions.find((position) => position.value === state.logoPosition)?.label}</small>
            </FieldGroup>
            <RangeField label="Ukuran logo" max={92} min={36} value={state.logoSize} valueLabel={`${state.logoSize}px`} onChange={(value) => update('logoSize', value)} />
          </DesignerSection>

          <DesignerSection description="Pilih dasar tampilan untuk layar audiens." number="02" title="Tema">
            <div className="kc-display-designer__theme-grid">
              {themePresets.map((preset) => <button aria-pressed={state.theme === preset.value} className="kc-display-designer__theme-card" key={preset.value} onClick={() => chooseTheme(preset.value)} type="button"><span className={`kc-display-designer__theme-thumb ${preset.className}`}><i /><b>870159</b><em /></span><strong>{preset.label}</strong></button>)}
            </div>
          </DesignerSection>

          <DesignerSection number="03" title="Warna">
            <div className="kc-display-designer__color-grid">
              <ColorField label="Warna Utama" value={state.primaryColor} onChange={(value) => update('primaryColor', value)} onPreview={(value) => previewColor('primaryColor', value)} />
              <ColorField label="Warna Aksen" value={state.accentColor} onChange={(value) => update('accentColor', value)} onPreview={(value) => previewColor('accentColor', value)} />
              <ColorField label="Warna Teks" value={state.textColor} onChange={(value) => update('textColor', value)} onPreview={(value) => previewColor('textColor', value)} />
              <ColorField label="Warna Latar" value={state.backgroundColor} onChange={(value) => update('backgroundColor', value)} onPreview={(value) => previewColor('backgroundColor', value)} />
            </div>
          </DesignerSection>

          <DesignerSection number="04" title="Gaya Teks">
            <div className="kc-display-designer__text-style-grid">
              {(['default', 'outline', 'shadow'] as const).map((style) => { const label = style === 'default' ? 'Default' : style === 'outline' ? 'Outline' : 'Shadow'; return <button aria-label={label} aria-pressed={state.textStyle === style} key={style} onClick={() => update('textStyle', style)} type="button"><span aria-hidden="true" className={`is-${style}`}>870159</span><strong>{label}</strong></button> })}
            </div>
          </DesignerSection>

          <DesignerSection description="Atur bentuk box nomor yang tampil saat proses undian." number="05" title="Style Box Kocokan">
            <FieldGroup label="Preset box">
              <div className="kc-display-designer__box-preset-grid">
                {(['solid', 'outline', 'brutal', 'clean'] as const).map((preset) => <button aria-pressed={state.boxPreset === preset} key={preset} onClick={() => update('boxPreset', preset)} type="button"><span className={`is-${preset}`}>870159</span><strong>{preset[0].toUpperCase() + preset.slice(1)}</strong></button>)}
              </div>
            </FieldGroup>
            <ColorField label="Warna Isi" value={state.boxFill} onChange={(value) => update('boxFill', value)} onPreview={(value) => previewColor('boxFill', value)} />
            <Toggle checked={state.showBorder} label="Tampilkan Border" onChange={(checked) => update('showBorder', checked)} />
            <ColorField disabled={!state.showBorder} label="Warna Border" value={state.borderColor} onChange={(value) => update('borderColor', value)} onPreview={(value) => previewColor('borderColor', value)} />
            <RangeField disabled={!state.showBorder} label="Ketebalan Border" max={8} min={1} value={state.borderWidth} valueLabel={`${state.borderWidth}px`} onChange={(value) => update('borderWidth', value)} />
            <SegmentedField label="Sudut" options={[['square', 'Kotak'], ['small', 'Rounded Kecil'], ['medium', 'Rounded Sedang']]} value={state.cornerStyle} onChange={(value) => update('cornerStyle', value as CornerStyle)} />
            <SegmentedField label="Bayangan" options={[['none', 'Tidak Ada'], ['hard', 'Hard'], ['soft', 'Soft']]} value={state.shadowStyle} onChange={(value) => update('shadowStyle', value as ShadowStyle)} />
            <ColorField label="Warna Nomor" value={state.numberColor} onChange={(value) => update('numberColor', value)} onPreview={(value) => previewColor('numberColor', value)} />
            <Toggle checked={state.showLabel} label="Tampilkan Label" onChange={(checked) => update('showLabel', checked)} />
            <ColorField disabled={!state.showLabel} label="Warna Label" value={state.labelColor} onChange={(value) => update('labelColor', value)} onPreview={(value) => previewColor('labelColor', value)} />
            <ColorField disabled={!state.showLabel} label="Warna Teks Label" value={state.labelTextColor} onChange={(value) => update('labelTextColor', value)} onPreview={(value) => previewColor('labelTextColor', value)} />
          </DesignerSection>

          <DesignerSection number="06" title="Background">
            <div className="kc-display-designer__background-options">
              {(['theme', 'color', 'image', 'transparent'] as const).map((mode) => <button aria-pressed={state.backgroundMode === mode} key={mode} onClick={() => update('backgroundMode', mode)} type="button"><span className={`is-${mode}`} /><strong>{mode === 'theme' ? 'Tema' : mode === 'color' ? 'Warna' : mode === 'image' ? 'Gambar' : 'Transparan'}</strong></button>)}
            </div>
            {state.backgroundMode === 'image' ? <><label className="kc-display-designer__dummy-upload"><Icon name="Upload" /><strong>{state.backgroundImageAsset === undefined ? 'Upload background 16:9' : 'Ganti background 16:9'}</strong><span>JPG, PNG, atau WEBP · maks. 5 MB</span><input aria-label="Upload background 16:9" accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => handleImage(event.target.files?.[0], 'background')} /></label><SegmentedField label="Fit" options={[['cover', 'Cover'], ['contain', 'Contain']]} value={state.backgroundFit} onChange={(value) => update('backgroundFit', value as BackgroundFit)} /></> : null}
          </DesignerSection>

          <DesignerSection description="Atur tampilan hitung mundur sebelum pengundian dimulai." number="07" title="Countdown">
            <FieldGroup label="Gaya Countdown">
              <div className="kc-display-designer__countdown-preset-grid">
                {(['minimal', 'box', 'outline', 'bold'] as const).map((preset) => <button aria-label={`Countdown ${preset[0].toUpperCase() + preset.slice(1)}`} aria-pressed={state.countdownPreset === preset} key={preset} onClick={() => chooseCountdownPreset(preset)} type="button"><span className={`is-${preset}`}>3</span><strong>{preset[0].toUpperCase() + preset.slice(1)}</strong></button>)}
              </div>
            </FieldGroup>
            <ColorField label="Warna Angka" value={state.countdownNumberColor} onChange={(value) => update('countdownNumberColor', value)} onPreview={(value) => previewColor('countdownNumberColor', value)} />
            <RangeField label="Ukuran Angka" max={130} min={70} value={Math.round(state.countdownNumberScale * 100)} valueLabel={`${Math.round(state.countdownNumberScale * 100)}%`} onChange={(value) => update('countdownNumberScale', value / 100)} />
            <Toggle ariaLabel="Tampilkan Label Countdown" checked={state.countdownLabelVisible} label="Tampilkan Label" onChange={(checked) => update('countdownLabelVisible', checked)} />
            <ColorField disabled={!state.countdownLabelVisible} label="Warna Label" value={state.countdownLabelColor} onChange={(value) => update('countdownLabelColor', value)} onPreview={(value) => previewColor('countdownLabelColor', value)} />
            <Toggle checked={state.countdownBoxVisible} label="Tampilkan Box" onChange={(checked) => update('countdownBoxVisible', checked)} />
            {state.countdownBoxVisible ? <>
              <ColorField label="Warna Isi" value={state.countdownBoxFill} onChange={(value) => update('countdownBoxFill', value)} onPreview={(value) => previewColor('countdownBoxFill', value)} />
              <Toggle ariaLabel="Tampilkan Border Countdown" checked={state.countdownBorderVisible} label="Tampilkan Border" onChange={(checked) => update('countdownBorderVisible', checked)} />
              <ColorField disabled={!state.countdownBorderVisible} label="Warna Border Countdown" value={state.countdownBorderColor} onChange={(value) => update('countdownBorderColor', value)} onPreview={(value) => previewColor('countdownBorderColor', value)} />
              <RangeField disabled={!state.countdownBorderVisible} label="Ketebalan Border Countdown" max={8} min={1} value={state.countdownBorderWidth} valueLabel={`${state.countdownBorderWidth}px`} onChange={(value) => update('countdownBorderWidth', value)} />
              <SegmentedField label="Sudut Countdown" options={[["square", "Kotak"], ["small", "Rounded Kecil"], ["medium", "Rounded Sedang"]]} value={state.countdownCornerStyle} onChange={(value) => update('countdownCornerStyle', value as CornerStyle)} />
              <SegmentedField label="Shadow Countdown" options={[["none", "Tidak Ada"], ["hard", "Hard"], ["soft", "Soft"]]} value={state.countdownShadowStyle} onChange={(value) => update('countdownShadowStyle', value as ShadowStyle)} />
            </> : null}
            <SegmentedField label="Posisi Countdown" options={[["upper", "Sedikit Atas"], ["center", "Tengah"], ["lower", "Sedikit Bawah"]]} value={state.countdownPosition} onChange={(value) => update('countdownPosition', value as DisplayCountdownPosition)} />
          </DesignerSection>

          <DesignerSection description="Atur font yang digunakan pada Tampilan Audiens." number="08" title="Tipografi">
            <FieldGroup label="Font Utama">
              <div className="kc-display-designer__font-grid">
                {([['kocokan', 'Default Kocokan'], ['inter', 'Inter'], ['arial', 'Arial / Sans'], ['mono', 'Mono']] as const).map(([value, label]) => <button aria-label={`Font ${label}`} aria-pressed={state.fontSource === 'builtin' && state.fontFamily === value} key={value} onClick={() => { update('fontSource', 'builtin'); update('fontFamily', value) }} type="button"><span className={`is-${value}`}>Aa</span><strong>{label}</strong></button>)}
              </div>
            </FieldGroup>
            <SegmentedField label="Weight" options={[["400", "Regular"], ["500", "Medium"], ["700", "Bold"], ["800", "Extra Bold"]]} value={String(state.fontWeight)} onChange={(value) => update('fontWeight', Number(value) as DisplayFontWeight)} />
            <FieldGroup label="Font Kustom">
              {state.customFontAssetId === undefined ? <label className="kc-display-designer__dummy-upload"><Icon name="Upload" /><strong>Upload font lokal</strong><span>WOFF, WOFF2, atau TTF · maks. 10 MB</span><input aria-label="Upload font kustom" accept=".woff,.woff2,.ttf,font/woff,font/woff2,font/ttf" type="file" onChange={(event) => void handleFont(event.target.files?.[0])} /></label> : <div className="kc-display-designer__font-asset"><div><strong>{state.customFontFileName ?? 'Font kustom'}</strong><span>{state.customFontStatus === 'loaded' ? 'Loaded · tersimpan lokal' : state.customFontStatus === 'loading' ? 'Memuat…' : 'Gagal dimuat · fallback aktif'}</span></div><label className="kc-display-designer__font-action">Ganti<input aria-label="Ganti font kustom" accept=".woff,.woff2,.ttf,font/woff,font/woff2,font/ttf" type="file" onChange={(event) => void handleFont(event.target.files?.[0])} /></label><button onClick={removeCustomFont} type="button">Hapus</button></div>}
              {state.fontSource === 'custom' ? <small className="kc-display-designer__field-hint">Font kustom memakai weight bawaan file agar tidak membuat weight sintetis.</small> : null}
              {state.customFontAssetId === undefined ? null : <button aria-pressed={state.fontSource === 'custom'} className="kc-display-designer__use-custom-font" onClick={() => update('fontSource', 'custom')} type="button">Gunakan Font Kustom</button>}
            </FieldGroup>
            <SegmentedField label="Font Countdown" options={[["inherit", "Ikuti Font Utama"], ["kocokan", "Kocokan"], ["arial", "Arial"], ["mono", "Mono"]]} value={state.countdownFontOverride} onChange={(value) => update('countdownFontOverride', value as DisplayBuiltinFont | 'inherit')} />
          </DesignerSection>

          <footer className="kc-display-designer__actions">
            <p>{saveState === 'saving' ? 'Menyimpan dan menerapkan perubahan…' : saveState === 'error' ? errorMessage : dirty ? 'Ada perubahan yang belum diterapkan ke Tampilan Audiens.' : 'Pengaturan tersimpan dan aktif pada Tampilan Audiens.'}</p>
            <div>
              <Button disabled={saveState === 'saving' || (!dirty && saveState !== 'error')} icon={<Icon name="Save" />} onClick={() => void saveAndApply()}>{saveState === 'saving' ? 'Menyimpan…' : 'Simpan & Terapkan'}</Button>
              <Button disabled={saveState === 'saving' || !dirty} icon={<Icon name="RotateCcw" />} onClick={() => { setState(savedState); setSaveState('saved'); setErrorMessage(null) }} variant="secondary">Reset Perubahan</Button>
            </div>
            <div aria-live="polite" className="kc-display-designer__toast" role="status"><Icon name={saveState === 'error' ? 'CircleAlert' : 'CircleCheck'} size={17} />{saveState === 'saving' ? 'Menyimpan' : saveState === 'error' ? 'Gagal menerapkan' : dirty ? 'Draft belum disimpan' : 'Tersimpan'}</div>
          </footer>
        </aside>
      </div>
    </section>
  )
}

function previewSnapshot(mode: PreviewMode, appearance: DisplayAppearanceConfiguration, eventName: string, eventSubtitle: string, safeAreaMargin: number): PublicDisplaySnapshot {
  const winnerCount = previewWinnerCount(mode)
  const presentationCommon = {
    drawSessionId: DISPLAY_DESIGNER_PREVIEW_SESSION,
    blackoutRequested: false,
    displayTest: false,
    mode: 'live' as const,
    eventName,
    eventSubtitle,
    appearance,
    safeAreaMargin,
  }
  if (mode === 'standby') return { ...presentationCommon, stage: 'standby' }
  const drawCommon = {
    ...presentationCommon,
    prizeCategory: 'Grand Prize',
    prizeName: 'Sepeda Listrik',
    winnerCount,
  }
  if (mode === 'countdown') return {
    ...drawCommon,
    stage: 'countdown',
    stageStartedAt: DISPLAY_DESIGNER_PREVIEW_TIMESTAMP,
    countdownValue: 3,
  }
  if (mode === 'rolling') return {
    ...drawCommon,
    stage: 'rolling',
    stageStartedAt: DISPLAY_DESIGNER_PREVIEW_TIMESTAMP,
    rollingSlotCount: winnerCount,
    rollSpeedPerSecond: 12,
    rollStopMode: 'manual',
    rollDurationSeconds: 0,
    presentationSeed: 'display-designer-preview',
    presentationMode: 'instant-reveal',
    revealMode: 'all-together',
  }
  const visibleTickets = tickets.slice(0, winnerCount)
  const confirmed = mode === 'confirmed'
  return {
    ...drawCommon,
    stage: confirmed ? 'pending-handoff' : 'reveal',
    stageStartedAt: DISPLAY_DESIGNER_PREVIEW_TIMESTAMP,
    revealStartedAt: DISPLAY_DESIGNER_PREVIEW_TIMESTAMP,
    presentationMode: 'instant-reveal',
    revealMode: 'all-together',
    ticketNumbers: visibleTickets,
    winnerStatuses: visibleTickets.map(() => confirmed ? 'confirmed' as const : 'pending' as const),
    verificationState: confirmed ? 'verified' : 'pending',
  }
}

const DesignerAudiencePreview = memo(function DesignerAudiencePreview({ appearance, eventName, eventSubtitle, mode, previewHostRef, safeAreaMargin }: { readonly appearance: DisplayAppearanceConfiguration; readonly eventName: string; readonly eventSubtitle: string; readonly mode: PreviewMode; readonly previewHostRef: RefObject<HTMLDivElement | null>; readonly safeAreaMargin: number }) {
  const transparent = isTransparentDisplayAppearance(appearance)
  const snapshot = useMemo(() => previewSnapshot(mode, appearance, eventName, eventSubtitle, safeAreaMargin), [appearance, eventName, eventSubtitle, mode, safeAreaMargin])
  return <div ref={previewHostRef} className={`kc-display-preview display-preview kc-display-preview--shared ${transparent ? 'is-transparent' : ''}`}>
    <div className="production-preview__viewport">
      <AudiencePresentation preview snapshot={snapshot} />
    </div>
  </div>
})

const AudienceSnapshotPreview = memo(function AudienceSnapshotPreview({ previewHostRef, snapshot }: { readonly previewHostRef: RefObject<HTMLDivElement | null>; readonly snapshot: PublicDisplaySnapshot }) {
  const transparent = snapshot.appearance === undefined ? false : isTransparentDisplayAppearance(snapshot.appearance)
  return <div ref={previewHostRef} className={`kc-display-preview display-preview kc-display-preview--shared ${transparent ? 'is-transparent' : ''}`}>
    <div className="production-preview__viewport">
      <AudiencePresentation preview snapshot={snapshot} />
    </div>
  </div>
})

function audienceSnapshotLabel(snapshot: PublicDisplaySnapshot): string {
  if (snapshot.blackoutRequested) return 'Blackout'
  if (snapshot.displayTest === true) return 'Uji Tampilan'
  if (snapshot.stage === 'standby') return 'Standby'
  if (snapshot.stage === 'countdown') return 'Countdown'
  if (snapshot.stage === 'rolling') return 'Rolling'
  if (snapshot.stage === 'reveal') return 'Reveal'
  return 'Terkonfirmasi'
}

function DesignerSection({ children, description, number, title }: { readonly children: ReactNode; readonly description?: string; readonly number: string; readonly title: string }) {
  return <section className="kc-display-designer__section display-designer__section"><header><span>{number}</span><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div></header><div className="kc-display-designer__section-body display-designer__section-body">{children}</div></section>
}

function FieldGroup({ children, label }: { readonly children: ReactNode; readonly label: string }) {
  return <div className="kc-display-designer__field"><span className="kc-display-designer__field-label">{label}</span>{children}</div>
}

function Toggle({ ariaLabel, checked, label, onChange }: { readonly ariaLabel?: string; readonly checked: boolean; readonly label: string; readonly onChange: (checked: boolean) => void }) {
  return <label className="kc-display-designer__toggle"><span>{label}</span><input aria-label={ariaLabel ?? label} checked={checked} onChange={(event) => onChange(event.target.checked)} role="switch" type="checkbox" /><span aria-hidden="true" className="kc-display-designer__toggle-track"><span /></span></label>
}

function ChoiceCard({ active, children, label, onClick }: { readonly active: boolean; readonly children: ReactNode; readonly label: string; readonly onClick: () => void }) {
  return <button aria-pressed={active} className="kc-display-designer__choice-card" onClick={onClick} type="button"><span>{children}</span><strong>{label}</strong></button>
}

const VALID_COLOR = /^#[0-9A-F]{6}$/

function ColorField({ disabled = false, label, onChange, onPreview, value }: { readonly disabled?: boolean; readonly label: string; readonly onChange: (value: string) => void; readonly onPreview: (value: string) => void; readonly value: string }) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLInputElement>(null)
  const [transientState, setTransientState] = useState({ sourceValue: value, value })
  const latestValueRef = useRef(value)
  const committedValueRef = useRef(value)
  const animationFrameRef = useRef<number | null>(null)
  const onChangeRef = useRef(onChange)
  const onPreviewRef = useRef(onPreview)
  const transientValue = transientState.sourceValue === value ? transientState.value : value

  useEffect(() => {
    onChangeRef.current = onChange
    onPreviewRef.current = onPreview
  }, [onChange, onPreview])

  const cancelPreviewFrame = useCallback(() => {
    if (animationFrameRef.current === null) return
    cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
  }, [])

  const schedulePreview = useCallback((nextValue: string) => {
    latestValueRef.current = nextValue
    setTransientState({ sourceValue: value, value: nextValue })
    if (!VALID_COLOR.test(nextValue) || animationFrameRef.current !== null) return
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null
      const latestValue = latestValueRef.current
      if (VALID_COLOR.test(latestValue)) onPreviewRef.current(latestValue)
    })
  }, [value])

  const commitTransientValue = useCallback((committedValue?: string) => {
    const nextValue = committedValue ?? latestValueRef.current
    latestValueRef.current = nextValue
    setTransientState({ sourceValue: value, value: nextValue })
    cancelPreviewFrame()
    if (VALID_COLOR.test(nextValue)) onPreviewRef.current(nextValue)
    if (nextValue === committedValueRef.current) return
    committedValueRef.current = nextValue
    onChangeRef.current(nextValue)
  }, [cancelPreviewFrame, value])

  useEffect(() => {
    cancelPreviewFrame()
    latestValueRef.current = value
    committedValueRef.current = value
  }, [cancelPreviewFrame, value])

  useEffect(() => {
    const inputs = [pickerRef.current, textRef.current].filter((input): input is HTMLInputElement => input !== null)
    const handleNativeChange = (event: Event) => commitTransientValue((event.currentTarget as HTMLInputElement).value.toUpperCase())
    for (const input of inputs) input.addEventListener('change', handleNativeChange)
    return () => { for (const input of inputs) input.removeEventListener('change', handleNativeChange) }
  }, [commitTransientValue])

  useEffect(() => () => cancelPreviewFrame(), [cancelPreviewFrame])

  return <label className={`kc-display-designer__color-field ${disabled ? 'is-disabled' : ''}`}><span>{label}</span><span className="kc-display-designer__color-control"><input ref={pickerRef} aria-label={`${label} picker`} disabled={disabled} type="color" value={transientValue} onChange={() => undefined} onInput={(event) => schedulePreview(event.currentTarget.value.toUpperCase())} onBlur={() => commitTransientValue()} /><input ref={textRef} aria-label={label} disabled={disabled} maxLength={7} value={transientValue} onChange={() => undefined} onInput={(event) => schedulePreview(event.currentTarget.value.toUpperCase())} onBlur={() => commitTransientValue()} onKeyDown={(event) => { if (event.key === 'Enter') commitTransientValue() }} /></span></label>
}

function RangeField({ disabled = false, label, max, min, onChange, value, valueLabel }: { readonly disabled?: boolean; readonly label: string; readonly max: number; readonly min: number; readonly onChange: (value: number) => void; readonly value: number; readonly valueLabel: string }) {
  return <label className={`kc-display-designer__range-field ${disabled ? 'is-disabled' : ''}`}><span><strong>{label}</strong><output>{valueLabel}</output></span><input aria-label={label} disabled={disabled} max={max} min={min} type="range" value={value} onChange={(event) => onChange(Number(event.target.value))} /><small>{min === 36 ? 'Kecil' : min}<i />{max === 92 ? 'Besar' : max}</small></label>
}

function SegmentedField({ label, onChange, options, value }: { readonly label: string; readonly onChange: (value: string) => void; readonly options: readonly (readonly [string, string])[]; readonly value: string }) {
  return <FieldGroup label={label}><div className="kc-display-designer__segments">{options.map(([optionValue, optionLabel]) => <button aria-pressed={value === optionValue} key={optionValue} onClick={() => onChange(optionValue)} type="button">{optionLabel}</button>)}</div></FieldGroup>
}
