import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import type { EventSettings } from '../../domain/settings/event-settings.types.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import type { PresentationProjectionSource } from '../display-transport/public-projection.ts'
import type { HistoryReconstruction, ReconstructedHistorySession } from './history-read-model.ts'

export type CompletedResultProjection =
  | { readonly ok: true; readonly source: PresentationProjectionSource }
  | { readonly ok: false; readonly reason: 'incomplete' | 'not-live' | 'not-completed' | 'no-confirmed-winners' }

/** Converts trusted History evidence into a public, confirmed-only presentation source. */
export function projectCompletedResultForAudience(input: {
  readonly reconstruction: HistoryReconstruction
  readonly eventSettings: EventSettings
  readonly displayConfiguration: DisplayConfiguration | null
  readonly stageStartedAt: IsoTimestamp
}): CompletedResultProjection {
  if (input.reconstruction.kind === 'incomplete') return { ok: false, reason: 'incomplete' }
  const item: ReconstructedHistorySession = input.reconstruction.value
  if (item.session.mode !== 'live') return { ok: false, reason: 'not-live' }
  if (item.session.status !== 'completed') return { ok: false, reason: 'not-completed' }
  const winners = item.winners.filter((winner) => winner.status === 'confirmed')
  if (winners.length === 0) return { ok: false, reason: 'no-confirmed-winners' }
  const presentation = item.session.configurationSnapshot?.presentation
  return {
    ok: true,
    source: {
      drawSessionId: item.session.id,
      stage: 'pending-handoff',
      stageStartedAt: input.stageStartedAt,
      blackoutRequested: false,
      mode: 'live',
      verificationState: 'verified',
      eventName: input.eventSettings.displayName,
      eventSubtitle: input.eventSettings.subtitle,
      primaryColor: input.eventSettings.primaryColor,
      accentColor: input.eventSettings.accentColor,
      ...(input.eventSettings.logo === undefined ? {} : { logo: { type: input.eventSettings.logo.type, blob: input.eventSettings.logo.blob } }),
      ...(input.eventSettings.background === undefined ? {} : { background: { type: input.eventSettings.background.type, blob: input.eventSettings.background.blob } }),
      ...(input.displayConfiguration === null ? {} : { blackoutAppearance: input.displayConfiguration.blackoutAppearance, safeAreaMargin: input.displayConfiguration.safeAreaMargin }),
      ...(item.summary.categoryName === null ? {} : { prizeCategory: item.summary.categoryName }),
      ...(item.summary.prizeName === null ? {} : { prizeName: item.summary.prizeName }),
      ...(presentation === undefined ? {} : { presentationConfiguration: { ...presentation, winnerCount: winners.length } }),
      presentationSeed: item.session.id,
      result: {
        drawSessionId: item.session.id,
        winners: winners.map((winner, index) => ({ sequence: index + 1, ticketNumber: winner.ticketNumber, status: 'confirmed' as const })),
      },
    },
  }
}

export function canShowCompletedResultOnAudience(reconstruction: HistoryReconstruction): boolean {
  if (reconstruction.kind === 'incomplete') return false
  const item = reconstruction.value
  return item.session.mode === 'live' && item.session.status === 'completed' && item.winners.some((winner) => winner.status === 'confirmed')
}
