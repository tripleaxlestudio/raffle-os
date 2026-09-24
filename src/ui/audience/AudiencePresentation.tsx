import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { PublicDisplaySnapshot } from '../../application/display-transport/public-projection.ts'
import { resolveDisplayAppearance, type DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import { BlackoutStage, CountdownStage, DisconnectedStage, RandomNumberRollStage, RollingStage, StandbyStage, WinnerStage } from './index.ts'
import type { PublicAudienceScenario } from './audience-view.types.ts'
import { customDisplayFontFamily, displayAppearanceDataAttributes, displayAppearanceToStyle, isTransparentDisplayAppearance } from './display-appearance-style.ts'
import { DexieDisplayFontAssetRepository } from '../../infrastructure/persistence/repositories/display-font-asset.repository.ts'

const publicContext = { eventName: 'HUT RI 81', eventSubtitle: 'Presentasi Acara publik', prizeCategory: 'Undian aktif', prizeLabel: 'Pengumuman pemenang' } as const

// eslint-disable-next-line react-refresh/only-export-components
export function snapshotToAudienceScenario(snapshot: PublicDisplaySnapshot): PublicAudienceScenario {
  const statuses = snapshot.winnerStatuses ?? []
  const hasTickets = (snapshot.ticketNumbers?.length ?? 0) > 0
  const allConfirmed = hasTickets && statuses.length === snapshot.ticketNumbers?.length && statuses.every((status) => status === 'confirmed')
  const someConfirmed = statuses.some((status) => status === 'confirmed')
  const verified = snapshot.verificationState === 'verified' || (snapshot.verificationState === undefined && allConfirmed)
  const inProgress = snapshot.verificationState === 'in-progress' || (snapshot.verificationState === undefined && someConfirmed && !allConfirmed)
  const committedState = snapshot.stage === 'pending-handoff' && !hasTickets
    ? 'standby' as const
    : snapshot.stage === 'pending-handoff' && verified
      ? 'confirmed' as const
      : snapshot.stage
  return {
    ...publicContext,
    ...(snapshot.prizeImageAssetId === undefined ? {} : { prizeImageAssetId: snapshot.prizeImageAssetId }),
    ...(snapshot.eventName === undefined ? {} : { eventName: snapshot.eventName }),
    ...(snapshot.eventSubtitle === undefined ? {} : { eventSubtitle: snapshot.eventSubtitle }),
    ...(snapshot.prizeCategory === undefined ? {} : { prizeCategory: snapshot.prizeCategory }),
    ...(snapshot.prizeName === undefined ? {} : { prizeLabel: snapshot.prizeName }),
    ...(snapshot.winnerCount === undefined ? {} : { winnerCount: snapshot.winnerCount }),
    ...(snapshot.appearance !== undefined || snapshot.logo === undefined ? {} : { logo: snapshot.logo.blob }),
    ...(snapshot.primaryColor === undefined ? {} : { primaryColor: snapshot.primaryColor }),
    ...(snapshot.accentColor === undefined ? {} : { accentColor: snapshot.accentColor }),
    ...(snapshot.stage === 'rolling' || snapshot.stage === 'reveal' || snapshot.stage === 'pending-handoff' ? { rollingStartedAt: snapshot.stage === 'rolling' ? snapshot.stageStartedAt : undefined, rollingSlotCount: snapshot.rollingSlotCount, rollSpeedPerSecond: snapshot.rollSpeedPerSecond, rollStopMode: snapshot.rollStopMode, rollDurationSeconds: snapshot.rollDurationSeconds, presentationSeed: snapshot.presentationSeed, presentationMode: snapshot.presentationMode } : {}),
    ...(snapshot.stage === 'reveal' || snapshot.stage === 'pending-handoff' ? { revealMode: snapshot.revealMode, revealStartedAt: snapshot.revealStartedAt ?? snapshot.stageStartedAt } : {}),
    state: committedState,
    nextDrawReady: committedState === 'standby' && snapshot.winnerCount !== undefined && snapshot.prizeName !== undefined,
    message: committedState === 'standby' ? (snapshot.displayTest === false && snapshot.winnerCount === undefined ? 'Menunggu undian berikutnya' : snapshot.stage === 'pending-handoff' ? 'Tidak ada pemenang aktif' : 'Undian segera dimulai') : committedState === 'countdown' ? 'Bersiap' : committedState === 'rolling' ? 'Pengundian berlangsung' : undefined,
    countdownValue: snapshot.stage === 'countdown' ? String(snapshot.countdownValue ?? '—') : undefined,
    ticketNumbers: snapshot.ticketNumbers,
    winnerStatuses: snapshot.winnerStatuses,
    statusMessage: committedState === 'confirmed' ? 'HASIL DIKONFIRMASI' : snapshot.stage === 'pending-handoff' ? (inProgress ? 'VERIFIKASI BERLANGSUNG' : 'HASIL SEDANG DIVERIFIKASI') : snapshot.stage === 'reveal' ? 'HASIL SEDANG DIVERIFIKASI' : undefined,
    displayTest: snapshot.displayTest,
  }
}

function useAssetUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (blob === undefined) { queueMicrotask(() => setUrl(undefined)); return }
    const next = URL.createObjectURL(blob)
    queueMicrotask(() => setUrl(next))
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

function useCustomDisplayFont(assetId: string | undefined): void {
  useEffect(() => {
    if (assetId === undefined || typeof FontFace === 'undefined') return
    const repository = new DexieDisplayFontAssetRepository()
    let disposed = false
    let objectUrl: string | undefined
    let face: FontFace | undefined
    void (async () => {
      try {
        const asset = await repository.findById(assetId)
        if (asset === null || disposed) return
        objectUrl = URL.createObjectURL(asset.blob)
        face = new FontFace(customDisplayFontFamily(assetId), `url(${objectUrl})`)
        await face.load()
        if (!disposed) document.fonts.add(face)
      } catch { /* The CSS stack retains the product fallback font. */ }
    })()
    return () => {
      disposed = true
      if (face !== undefined) document.fonts.delete(face)
      if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl)
      repository.close()
    }
  }, [assetId])
}

export function AudiencePresentation({ snapshot, displayConfiguration, className, preview = false }: { readonly snapshot: PublicDisplaySnapshot; readonly displayConfiguration?: Pick<DisplayConfiguration, 'safeAreaMargin' | 'blackoutAppearance' | 'appearance'>; readonly className?: string; readonly preview?: boolean }) {
  const presentationRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0.5)
  const appearance = useMemo(() => resolveDisplayAppearance(
    snapshot.appearance === undefined ? displayConfiguration : { appearance: snapshot.appearance },
    {
      primaryColor: snapshot.primaryColor ?? '#7567FF',
      accentColor: snapshot.accentColor ?? '#F2A93B',
      ...(snapshot.logo === undefined ? {} : { logo: snapshot.logo }),
      ...(snapshot.background === undefined ? {} : { background: snapshot.background }),
    },
  ), [displayConfiguration, snapshot.accentColor, snapshot.appearance, snapshot.background, snapshot.logo, snapshot.primaryColor])
  useCustomDisplayFont(appearance.typography.fontSource === 'custom' ? appearance.typography.customFontAssetId : undefined)
  const backgroundUrl = useAssetUrl(appearance.background.imageAsset?.blob)
  const logoUrl = useAssetUrl(appearance.logo.customAsset?.blob)
  const scenario = snapshotToAudienceScenario(snapshot)
  const announcement = audienceStateAnnouncement(scenario)
  useEffect(() => {
    if (preview) return
    const transparent = isTransparentDisplayAppearance(appearance)
    const roots = [document.documentElement, document.body, document.getElementById('root')].filter((node): node is HTMLElement => node !== null)
    for (const root of roots) {
      if (transparent) root.setAttribute('data-audience-transparent', 'true')
      else root.removeAttribute('data-audience-transparent')
    }
    return () => { for (const root of roots) root.removeAttribute('data-audience-transparent') }
  }, [appearance, preview])
  useEffect(() => {
    if (!preview) return
    const presentation = presentationRef.current
    const viewport = presentation?.parentElement
    if (viewport === null || viewport === undefined) return
    const updateScale = () => {
      const width = viewport.clientWidth
      const height = viewport.clientHeight
      if (width <= 0 || height <= 0) return
      const nextScale = Math.min(width / 1920, height / 1080)
      if (Number.isFinite(nextScale) && nextScale > 0) queueMicrotask(() => setPreviewScale(nextScale))
    }
    updateScale()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(updateScale)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [preview])
  const audienceStyle = useMemo(() => ({ ...displayAppearanceToStyle(appearance, appearance.background.type === 'image' ? backgroundUrl : undefined), '--audience-safe-inline': `${displayConfiguration?.safeAreaMargin ?? snapshot.safeAreaMargin ?? 0}px`, '--audience-safe-block': `${displayConfiguration?.safeAreaMargin ?? snapshot.safeAreaMargin ?? 0}px`, ...(preview ? { '--audience-preview-scale': previewScale } : {}) } as CSSProperties), [appearance, backgroundUrl, displayConfiguration?.safeAreaMargin, preview, previewScale, snapshot.safeAreaMargin])
  const appearanceAttributes = displayAppearanceDataAttributes(appearance)
  if (snapshot.blackoutRequested) return <div className={['audience-display-page', className].filter(Boolean).join(' ')} style={audienceStyle} {...appearanceAttributes}><BlackoutStage appearance={displayConfiguration?.blackoutAppearance ?? snapshot.blackoutAppearance} /></div>
  const rendered = scenario.presentationMode === 'random-number-roll' && (scenario.state === 'rolling' || scenario.state === 'reveal')
    ? <RandomNumberRollStage scenario={scenario} />
    : scenario.state === 'standby' ? <StandbyStage scenario={scenario} />
      : scenario.state === 'countdown' ? <CountdownStage scenario={scenario} />
        : scenario.state === 'rolling' ? <RollingStage scenario={scenario} />
          : <WinnerStage scenario={scenario} />
  const logo = appearance.logo.visible ? <div aria-label={appearance.logo.source === 'custom' ? 'Logo acara' : 'Logo Kocokan'} className="audience-display-logo" data-logo-position={appearance.logo.position}>{appearance.logo.source === 'custom' && logoUrl !== undefined ? <img alt="" src={logoUrl} /> : <><b aria-hidden="true">K</b><span>KOCOKAN</span></>}</div> : null
  return <div ref={presentationRef} aria-hidden={preview ? true : undefined} data-audience-preview={preview ? 'true' : undefined} className={['audience-display-page', preview && (snapshot.stage === 'reveal' || snapshot.stage === 'pending-handoff') ? 'production-preview__tickets production-preview__tickets--surface' : undefined, className].filter(Boolean).join(' ')} style={audienceStyle} {...appearanceAttributes}><p aria-atomic="true" aria-live="polite" className="sr-only" role="status">{announcement}</p>{logo}{rendered}<div aria-hidden="true" className="audience-presentation-footer"><span>LIVE DRAW</span><span>kocokan.local</span></div></div>
}

function audienceStateAnnouncement(scenario: PublicAudienceScenario): string {
  switch (scenario.state) {
    case 'standby':
      return scenario.displayTest ? 'Tes Tampilan Audiens. Ini bukan undian resmi.' : 'Tampilan Audiens siap dan menunggu undian berikutnya.'
    case 'countdown':
      return `Hitung mundur undian ${scenario.countdownValue ?? ''}`.trim()
    case 'rolling':
      return 'Pengundian berlangsung. Presentasi putaran tidak menentukan hasil.'
    case 'reveal':
    case 'winner-reveal':
      return 'Hasil pemenang ditampilkan dan sedang diverifikasi.'
    case 'pending-handoff':
      return 'Hasil pemenang menunggu verifikasi Operator.'
    case 'confirmed':
      return 'Hasil pemenang telah dikonfirmasi.'
    case 'connecting':
      return 'Tampilan Audiens sedang menghubungkan.'
    case 'disconnected':
    case 'disconnected-safe':
      return 'Koneksi Tampilan Audiens terputus. Menunggu Operator dengan aman.'
    case 'blackout':
      return 'Layar hitam Tampilan Audiens aktif.'
  }
}

export function AudienceUnavailablePresentation({ state }: { readonly state: 'connecting' | 'disconnected-safe' }) {
  return <DisconnectedStage scenario={{ ...publicContext, state, message: state === 'connecting' ? 'Menghubungkan ke Operator' : 'Koneksi tampilan terputus', instruction: state === 'connecting' ? 'Menunggu snapshot presentasi publik.' : 'Silakan tunggu Operator.' }} />
}
