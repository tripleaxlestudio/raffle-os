import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { PublicDisplaySnapshot } from '../../application/display-transport/public-projection.ts'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import { BlackoutStage, CountdownStage, DisconnectedStage, RandomNumberRollStage, RollingStage, StandbyStage, WinnerStage } from './index.ts'
import type { PublicAudienceScenario } from './audience-view.types.ts'

const publicContext = { eventName: 'HUT RI 81', eventSubtitle: 'Public event presentation', prizeCategory: 'Current draw', prizeLabel: 'Winner announcement' } as const

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
    ...(snapshot.eventName === undefined ? {} : { eventName: snapshot.eventName }),
    ...(snapshot.eventSubtitle === undefined ? {} : { eventSubtitle: snapshot.eventSubtitle }),
    ...(snapshot.prizeCategory === undefined ? {} : { prizeCategory: snapshot.prizeCategory }),
    ...(snapshot.prizeName === undefined ? {} : { prizeLabel: snapshot.prizeName }),
    ...(snapshot.winnerCount === undefined ? {} : { winnerCount: snapshot.winnerCount }),
    ...(snapshot.logo === undefined ? {} : { logo: snapshot.logo.blob }),
    ...(snapshot.primaryColor === undefined ? {} : { primaryColor: snapshot.primaryColor }),
    ...(snapshot.accentColor === undefined ? {} : { accentColor: snapshot.accentColor }),
    ...(snapshot.stage === 'rolling' || snapshot.stage === 'reveal' || snapshot.stage === 'pending-handoff' ? { rollingStartedAt: snapshot.stage === 'rolling' ? snapshot.stageStartedAt : undefined, rollingSlotCount: snapshot.rollingSlotCount, rollSpeedPerSecond: snapshot.rollSpeedPerSecond, rollStopMode: snapshot.rollStopMode, rollDurationSeconds: snapshot.rollDurationSeconds, presentationSeed: snapshot.presentationSeed, presentationMode: snapshot.presentationMode } : {}),
    ...(snapshot.stage === 'reveal' || snapshot.stage === 'pending-handoff' ? { revealMode: snapshot.revealMode, revealStartedAt: snapshot.revealStartedAt ?? snapshot.stageStartedAt } : {}),
    state: committedState,
    nextDrawReady: committedState === 'standby' && snapshot.winnerCount !== undefined && snapshot.prizeName !== undefined,
    message: committedState === 'standby' ? (snapshot.displayTest === false && snapshot.winnerCount === undefined ? 'Waiting for the next presentation' : snapshot.stage === 'pending-handoff' ? 'No active winners' : 'Draw will begin shortly') : committedState === 'countdown' ? 'Get ready' : committedState === 'rolling' ? 'Drawing in progress' : undefined,
    countdownValue: snapshot.stage === 'countdown' ? String(snapshot.countdownValue ?? '—') : undefined,
    ticketNumbers: snapshot.ticketNumbers,
    winnerStatuses: snapshot.winnerStatuses,
    statusMessage: committedState === 'confirmed' ? 'RESULTS CONFIRMED' : snapshot.stage === 'pending-handoff' ? (inProgress ? 'VERIFICATION IN PROGRESS' : 'RESULTS UNDER VERIFICATION') : snapshot.stage === 'reveal' ? 'RESULTS UNDER VERIFICATION' : undefined,
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

export function AudiencePresentation({ snapshot, displayConfiguration, className, preview = false }: { readonly snapshot: PublicDisplaySnapshot; readonly displayConfiguration?: Pick<DisplayConfiguration, 'safeAreaMargin' | 'blackoutAppearance'>; readonly className?: string; readonly preview?: boolean }) {
  const presentationRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0.5)
  const backgroundUrl = useAssetUrl(snapshot.background?.blob)
  const scenario = snapshotToAudienceScenario(snapshot)
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
  const audienceStyle = useMemo(() => ({ '--audience-safe-inline': `${displayConfiguration?.safeAreaMargin ?? snapshot.safeAreaMargin ?? 0}px`, '--audience-safe-block': `${displayConfiguration?.safeAreaMargin ?? snapshot.safeAreaMargin ?? 0}px`, '--accent': snapshot.primaryColor ?? undefined, '--accent-hover': snapshot.accentColor ?? undefined, ...(preview ? { '--audience-preview-scale': previewScale } : {}), ...(backgroundUrl === undefined ? {} : { '--audience-background-image': `url(${backgroundUrl})` }) } as CSSProperties), [backgroundUrl, displayConfiguration?.safeAreaMargin, preview, previewScale, snapshot])
  if (snapshot.blackoutRequested) return <div className={['audience-display-page', className].filter(Boolean).join(' ')} style={audienceStyle}><BlackoutStage appearance={displayConfiguration?.blackoutAppearance ?? snapshot.blackoutAppearance} /></div>
  const rendered = scenario.presentationMode === 'random-number-roll' && (scenario.state === 'rolling' || scenario.state === 'reveal')
    ? <RandomNumberRollStage scenario={scenario} />
    : scenario.state === 'standby' ? <StandbyStage scenario={scenario} />
      : scenario.state === 'countdown' ? <CountdownStage scenario={scenario} />
        : scenario.state === 'rolling' ? <RollingStage scenario={scenario} />
          : <WinnerStage scenario={scenario} />
  return <div ref={presentationRef} aria-hidden={preview ? true : undefined} data-audience-preview={preview ? 'true' : undefined} className={['audience-display-page', preview && (snapshot.stage === 'reveal' || snapshot.stage === 'pending-handoff') ? 'production-preview__tickets production-preview__tickets--surface' : undefined, className].filter(Boolean).join(' ')} style={audienceStyle}>{rendered}</div>
}

export function AudienceUnavailablePresentation({ state }: { readonly state: 'connecting' | 'disconnected-safe' }) {
  return <DisconnectedStage scenario={{ ...publicContext, state, message: state === 'connecting' ? 'Connecting to the operator' : 'Display connection interrupted', instruction: state === 'connecting' ? 'Waiting for a public presentation snapshot.' : 'Please wait for the operator.' }} />
}
