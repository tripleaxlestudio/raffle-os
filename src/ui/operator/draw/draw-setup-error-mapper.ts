import type { DrawCommandFailure } from '../../../application/draw/draw-command-errors.ts'
import type { DrawSetupQueryError } from '../../../application/draw/draw-setup-query.types.ts'

export type DrawSetupPresentationCode =
  | 'event-not-found'
  | 'configuration-not-found'
  | 'category-not-found'
  | 'session-not-found'
  | 'relationship-mismatch'
  | 'stale-session'
  | 'no-participants'
  | 'insufficient-capacity'
  | 'eligibility-integrity'
  | 'candidate-pool-integrity'
  | 'random-source-failure'
  | 'duplicate-execution'
  | 'persistence-failure'
  | 'unknown-failure'

export interface DrawSetupPresentationError {
  readonly code: DrawSetupPresentationCode
  readonly title: string
  readonly explanation: string
  readonly retryable: boolean
  readonly reloadReadinessBeforeRetry: boolean
  readonly remainBlocked: boolean
  readonly suggestedAction?: string
}

type MappableFailure = DrawCommandFailure | DrawSetupQueryError

function isMappableFailure(value: unknown): value is MappableFailure {
  return typeof value === 'object' && value !== null && 'code' in value && 'message' in value
}

export function mapDrawSetupError(value: unknown): DrawSetupPresentationError {
  const code = isMappableFailure(value) ? value.code : undefined
  const kind = typeof value === 'object' && value !== null && 'kind' in value && typeof value.kind === 'string' ? value.kind : undefined
  if (code === 'candidate-pool-failed' && kind === 'capacity') {
    return { code: 'insufficient-capacity', title: 'There are not enough eligible candidates', explanation: 'The requested winner count exceeds the authoritative eligible capacity.', retryable: false, reloadReadinessBeforeRetry: true, remainBlocked: true }
  }
  switch (code) {
    case 'event-not-found':
      return { code, title: 'No active Event is available', explanation: 'Select or create an Event before configuring a draw.', retryable: false, reloadReadinessBeforeRetry: false, remainBlocked: true, suggestedAction: 'Return to the Dashboard.' }
    case 'configuration-not-found':
      return { code, title: 'Draw configuration is required', explanation: 'Create a valid DrawConfiguration before starting a draw.', retryable: false, reloadReadinessBeforeRetry: false, remainBlocked: true, suggestedAction: 'Open Settings.' }
    case 'category-not-found':
      return { code, title: 'Prize category is unavailable', explanation: 'The selected PrizeCategory is missing or does not belong to this Event.', retryable: false, reloadReadinessBeforeRetry: false, remainBlocked: true }
    case 'session-not-found':
      return { code, title: 'No startable DrawSession exists', explanation: 'A valid ready DrawSession must exist for this Event, category, and configuration. No draw has occurred.', retryable: false, reloadReadinessBeforeRetry: true, remainBlocked: true, suggestedAction: 'Refresh after a ready session is created.' }
    case 'session-event-mismatch':
    case 'session-configuration-mismatch':
    case 'session-category-mismatch':
    case 'session-mode-mismatch':
      return { code: 'relationship-mismatch', title: 'Draw setup relationships are invalid', explanation: 'The Event, configuration, category, and session do not describe the same draw.', retryable: false, reloadReadinessBeforeRetry: true, remainBlocked: true, suggestedAction: 'Refresh readiness and correct the setup.' }
    case 'session-not-ready':
    case 'session-snapshots-already-attached':
      return { code: 'stale-session', title: 'This DrawSession is no longer startable', explanation: 'The persisted session has already advanced or contains an attached draw. No duplicate draw was started.', retryable: false, reloadReadinessBeforeRetry: true, remainBlocked: true, suggestedAction: 'Refresh readiness.' }
    case 'participants-load-failed':
      return { code: 'no-participants', title: 'Participants are unavailable', explanation: 'Valid persisted Participants are required before a draw can start.', retryable: false, reloadReadinessBeforeRetry: true, remainBlocked: true, suggestedAction: 'Import Participants or retry after storage recovers.' }
    case 'candidate-pool-failed':
      return { code: 'candidate-pool-integrity', title: 'Candidate readiness failed', explanation: 'The authoritative candidate pool could not be validated. No winners were produced.', retryable: false, reloadReadinessBeforeRetry: true, remainBlocked: true, suggestedAction: 'Refresh readiness and correct the persisted data.' }
    case 'selection-failed':
      return { code: 'random-source-failure', title: 'Secure winner selection failed', explanation: 'No winners were produced. The draw may be retried after readiness is refreshed.', retryable: true, reloadReadinessBeforeRetry: true, remainBlocked: false, suggestedAction: 'Retry the draw.' }
    case 'session-already-has-winners':
      return { code: 'duplicate-execution', title: 'This DrawSession has already been started', explanation: 'The same official session cannot be executed twice. No additional winners were produced.', retryable: false, reloadReadinessBeforeRetry: true, remainBlocked: true, suggestedAction: 'Refresh readiness.' }
    case 'persistence-failed':
      return { code: 'persistence-failure', title: 'The draw could not be saved', explanation: 'The atomic operation failed and no partial winners or audit record are shown.', retryable: true, reloadReadinessBeforeRetry: true, remainBlocked: false, suggestedAction: 'Refresh readiness, then retry.' }
    case 'eligibility-failed':
      return { code: 'eligibility-integrity', title: 'Eligibility validation failed', explanation: 'The authoritative eligibility data could not be validated. No winners were produced.', retryable: false, reloadReadinessBeforeRetry: true, remainBlocked: true }
    default:
      return { code: 'unknown-failure', title: 'Draw Setup could not be completed', explanation: 'An unexpected problem occurred. No draw is reported and no partial winners are shown.', retryable: true, reloadReadinessBeforeRetry: true, remainBlocked: false, suggestedAction: 'Refresh readiness, then retry.' }
  }
}
