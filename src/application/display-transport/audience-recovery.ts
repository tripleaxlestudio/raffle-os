import { resolveDisplayAppearance, type DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import type { EventSettings } from '../../domain/settings/event-settings.types.ts'
import type { StartupRecoveryResult } from '../workflow/startup-recovery-arbiter.ts'
import { projectCommittedAudienceState } from './authoritative-projection.ts'
import type { PresentationProjectionSource } from './public-projection.ts'

export type AudienceRecoveryProjectionInput = Readonly<{
  readonly recovery: StartupRecoveryResult
  readonly eventSettings: EventSettings
  readonly displayConfiguration: DisplayConfiguration
}>

/**
 * Rebuilds the first public snapshot after an Operator reload from persisted
 * official records. Ambiguous recovery decisions intentionally return null so
 * the publisher can remain on standby until the Operator resolves them.
 */
export function projectAudienceRecoverySource(
  input: AudienceRecoveryProjectionInput,
): PresentationProjectionSource | null {
  if (input.recovery.kind !== 'recover-session') return null

  const decision = input.recovery.decision
  if (decision.kind !== 'resume-pending' && decision.kind !== 'resume-verification') return null

  const checkpoint = decision.checkpoint.kind === 'matching'
    ? decision.checkpoint.checkpoint
    : null
  const base = projectCommittedAudienceState({
    session: decision.session,
    winners: decision.winners,
    stageStartedAt: checkpoint?.stageStartedAt ?? decision.session.updatedAt,
    blackoutRequested: checkpoint?.blackoutRequested ?? false,
  })
  const settings = input.eventSettings

  return {
    ...base,
    stage: checkpoint?.stage ?? 'pending-handoff',
    eventName: settings.displayName,
    eventSubtitle: settings.subtitle,
    primaryColor: settings.primaryColor,
    accentColor: settings.accentColor,
    logo: settings.logo === undefined ? undefined : { type: settings.logo.type, blob: settings.logo.blob },
    background: settings.background === undefined ? undefined : { type: settings.background.type, blob: settings.background.blob },
    blackoutAppearance: input.displayConfiguration.blackoutAppearance,
    safeAreaMargin: input.displayConfiguration.safeAreaMargin,
    appearance: resolveDisplayAppearance(input.displayConfiguration, settings),
  }
}
