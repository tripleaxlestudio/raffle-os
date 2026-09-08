import type { DrawPresentationConfiguration } from '../../domain/draws/draw-presentation.types.ts'
import { resolveDrawPresentationConfiguration } from '../../domain/draws/draw-presentation.types.ts'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import type { DrawReadinessResult } from './draw-readiness.types.ts'

export type DrawRunPreflightCheckState = 'ready' | 'blocked' | 'waiting'

export interface DrawRunPreflightCheck {
  readonly key: 'event' | 'prize' | 'eligibility' | 'audience' | 'presentation' | 'session'
  readonly label: string
  readonly state: DrawRunPreflightCheckState
  readonly value: string
  readonly detail: string
  readonly recoveryPath?: string
}

export interface DrawRunPreflight {
  readonly state: 'ready' | 'blocked'
  readonly canStart: boolean
  readonly mode: 'live' | 'practice' | null
  readonly checks: readonly DrawRunPreflightCheck[]
  readonly blocker: DrawRunPreflightCheck | null
  readonly presentation: DrawPresentationConfiguration | null
}

export type DrawRunAudienceState = 'setup-required' | 'waiting' | 'connected' | 'unavailable'

function presentationSummary(configuration: DrawPresentationConfiguration): string {
  if (configuration.presentationMode === 'instant-reveal') return 'Instant Reveal'
  return 'Random Number Roll · Manual Stop'
}

export function createDrawRunPreflight(
  readiness: DrawReadinessResult,
  displayConfiguration: DisplayConfiguration | null | undefined,
  audienceState: DrawRunAudienceState,
): DrawRunPreflight {
  const data = readiness.data
  const presentation = data === undefined ? null : resolveDrawPresentationConfiguration(data.session.configurationSnapshot?.presentation ?? data.configuration.presentation)
  const checks: DrawRunPreflightCheck[] = []
  const eventReady = data !== undefined && (data.event.status === 'ready' || data.event.status === 'live')
  checks.push({ key: 'event', label: 'Event', state: eventReady ? 'ready' : 'blocked', value: eventReady ? 'Ready' : 'Unavailable', detail: eventReady ? `${data.event.name} · Active · ${data.event.status === 'live' ? 'Live' : 'Ready'}` : data === undefined ? readiness.reason ?? 'Event could not be verified.' : 'Event is not active for draw execution.' })
  checks.push({ key: 'prize', label: 'Prize', state: data === undefined || readiness.state === 'missing-category' ? 'blocked' : 'ready', value: data?.category === undefined ? 'Unavailable' : 'Ready', detail: data?.category === undefined ? readiness.reason ?? 'Prize category is unavailable.' : `${data.category.name} · ${data.category.prizeName}` })
  const eligibilityReady = data !== undefined && readiness.state !== 'insufficient-capacity'
  checks.push({ key: 'eligibility', label: 'Eligible pool', state: eligibilityReady ? 'ready' : 'blocked', value: data === undefined ? 'Unavailable' : `${data.authoritativeEligibleCount} eligible`, detail: data === undefined ? readiness.reason ?? 'Eligibility could not be verified.' : `${data.authoritativeEligibleCount} eligible · ${data.requestedWinnerCount} winner${data.requestedWinnerCount === 1 ? '' : 's'} requested`, })
  const displaySetupMissing = displayConfiguration === null
  checks.push({ key: 'audience', label: 'Audience Display', state: displaySetupMissing ? 'blocked' : audienceState === 'connected' ? 'ready' : 'waiting', value: displaySetupMissing ? 'Setup required' : audienceState === 'connected' ? 'Connected' : audienceState === 'waiting' ? 'Waiting for Audience' : 'Unavailable', detail: displaySetupMissing ? 'Configure the Audience Display before starting a draw.' : audienceState === 'connected' ? 'Audience presence and public snapshot acknowledgement are active.' : audienceState === 'waiting' ? 'Display is configured; waiting for Audience presence.' : 'Display is configured, but the connection is unavailable.', recoveryPath: displaySetupMissing ? '/settings' : undefined })
  checks.push({ key: 'presentation', label: 'Presentation', state: presentation === null ? 'blocked' : 'ready', value: presentation === null ? 'Unavailable' : presentationSummary(presentation), detail: presentation === null ? 'Persisted draw presentation configuration is unavailable.' : 'Persisted configuration will drive the presentation; selection remains independent.' })
  const sessionReady = readiness.state === 'ready'
  checks.push({ key: 'session', label: 'Session', state: sessionReady ? 'ready' : 'blocked', value: data === undefined ? 'Unavailable' : `${data.mode === 'live' ? 'Live' : 'Practice'} · ${sessionReady ? 'Ready' : 'Blocked'}`, detail: sessionReady ? 'DrawSession is ready for the final start-time validation.' : readiness.reason ?? 'Resolve the persisted DrawSession state before starting.' })
  const blocker = checks.find((check) => check.state === 'blocked') ?? null
  return { state: blocker === null ? 'ready' : 'blocked', canStart: blocker === null, mode: data?.mode ?? null, checks, blocker, presentation }
}
