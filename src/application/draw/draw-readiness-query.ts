import { evaluateEligibility } from '../eligibility/eligibility-evaluator.ts'
import type { DrawReadinessData, DrawReadinessResult } from './draw-readiness.types.ts'
import type { DrawSetupQueryRepositories } from './draw-setup-query.types.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'

export type StorageReadiness = { readonly ok: true } | { readonly ok: false; readonly code: string; readonly reason: string }
export type CryptoReadiness = { readonly ok: true } | { readonly ok: false; readonly reason: string }
export interface DrawReadinessDependencies extends DrawSetupQueryRepositories {
  readonly checkStorage: () => Promise<StorageReadiness>
  readonly checkCrypto: () => Promise<CryptoReadiness>
}

const blocked = (state: DrawReadinessResult['state'], reason: string, retryable = false, errorCode?: string): DrawReadinessResult => ({ state, reason, retryable, errorCode })

export async function queryDrawReadiness(
  sessionId: string,
  dependencies: DrawReadinessDependencies,
): Promise<DrawReadinessResult> {
  try {
    const storage = await dependencies.checkStorage()
    if (!storage.ok) return blocked(storage.code === 'unsupported-schema' ? 'failed' : 'storage-unavailable', storage.reason, true, storage.code)
    const crypto = await dependencies.checkCrypto()
    if (!crypto.ok) return blocked('crypto-unavailable', crypto.reason, false, 'crypto-unavailable')

    const session = await dependencies.sessions.findById(sessionId as DrawSessionId)
    if (session === null) return blocked('missing-session', 'This DrawSession no longer exists.', false, 'session-not-found')
    const event = await dependencies.events.findById(session.eventId)
    if (event === null) return blocked('missing-event', 'The Event for this DrawSession is unavailable.', false, 'event-not-found')
    const configuration = await dependencies.configurations.findById(session.configurationId)
    if (configuration === null) return blocked('missing-configuration', 'The DrawConfiguration for this DrawSession is unavailable.', false, 'configuration-not-found')
    const category = await dependencies.categories.findById(configuration.prizeCategoryId)
    if (category === null) return blocked('missing-category', 'The PrizeCategory for this DrawSession is unavailable.', false, 'category-not-found')
    if (configuration.eventId !== event.id || category.eventId !== event.id || session.eventId !== event.id) return blocked('stale-data', 'Persisted Event, category, configuration, and session relationships are inconsistent.', false, 'relationship-mismatch')
    const sessions = await dependencies.sessions.findByEventId(event.id)
    const conflicting = sessions.find((candidate) => candidate.id !== session.id && candidate.mode === 'live' && (candidate.status === 'drawing' || candidate.status === 'pending-confirmation'))
    if (conflicting !== undefined) return blocked('session-conflict', conflicting.status === 'pending-confirmation' ? 'A pending Live result must be resolved before another Live session can be handed off.' : 'Another Live draw is active for this Event.', false, 'session-conflict')

    const total = await dependencies.participants.countByEventId(event.id)
    const participants = await dependencies.participants.findByEventId(event.id, { limit: total, offset: 0 })
    const winners = await dependencies.winners.findByEventId(event.id)
    const officialSessions = sessions.filter((candidate) => candidate.mode === 'live').map((candidate) => ({ id: candidate.id, eventId: candidate.eventId, configurationId: candidate.configurationId, prizeCategoryId: configuration.prizeCategoryId, mode: candidate.mode, status: candidate.status }))
    const eligibility = evaluateEligibility({ activeEvent: event, drawConfiguration: configuration, prizeCategory: category, mode: session.mode, participants, winnerRecords: winners, ruleContext: { officialSessions } })
    if (!eligibility.ok) return blocked('failed', 'Authoritative eligibility could not be evaluated from persisted data.', true, 'eligibility-failed')
    const data: DrawReadinessData = {
      event,
      category,
      configuration,
      session,
      authoritativeEligibleCount: eligibility.value.eligibleCount,
      totalParticipantCount: participants.length,
      checkedInParticipantCount: participants.filter((participant) => participant.isCheckedIn).length,
      previousWinnerExcludedCount: eligibility.value.decisions.filter((decision) => decision.exclusionReasons.includes('previously-confirmed-winner')).length,
      requestedWinnerCount: configuration.requestedWinners,
      mode: session.mode,
    }
    if (session.status !== 'ready') return { state: 'session-not-ready', data, reason: `This DrawSession is ${session.status.replace('-', ' ')} and is not a startable session.`, retryable: false, errorCode: 'session-not-ready' }
    if (eligibility.value.eligibleCount < configuration.requestedWinners) return { state: 'insufficient-capacity', data, reason: `There are ${eligibility.value.eligibleCount} eligible participants for ${configuration.requestedWinners} requested winners. Reduce the winner count or correct participant eligibility.`, retryable: false, errorCode: 'insufficient-capacity' }
    return { state: 'ready', data, retryable: false }
  } catch {
    return blocked('failed', 'Readiness could not be verified from local persistence.', true, 'unexpected-failure')
  }
}

export function modeFromReadiness(result: DrawReadinessResult): AppMode | null { return result.data?.mode ?? null }
