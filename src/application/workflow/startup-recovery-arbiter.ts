import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { RedrawRecord } from '../../domain/winners/redraw.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { CommandReceiptRecord } from '../persistence/command-receipt-repository.interface.ts'
import type { PresentationCheckpointRecord } from '../../domain/workflow/presentation-checkpoint.types.ts'
import {
  checkpointForSession,
  decideRecovery,
  type RecoveryCheckpointObservation,
  type RecoveryDecision,
} from './recovery-contract.ts'

export type StartupRecoveryResult =
  | { readonly kind: 'storage-failure'; readonly error: string }
  | { readonly kind: 'no-active-event' }
  | { readonly kind: 'normal'; readonly targetPath: string }
  | {
      readonly kind: 'conflicting-sessions'
      readonly sessions: readonly DrawSession[]
      readonly recommendedRoute: '/draw/pending'
    }
  | {
      readonly kind: 'recover-session'
      readonly session: DrawSession
      readonly decision: RecoveryDecision
      readonly recommendedRoute: string
    }

export interface StartupRecoveryInput {
  readonly storageError?: string | null
  readonly activeEvent: Event | null
  readonly sessions: readonly DrawSession[]
  readonly winners?: readonly WinnerRecord[]
  readonly redraws?: readonly RedrawRecord[]
  readonly receipts?: readonly CommandReceiptRecord[]
  readonly checkpoint?: PresentationCheckpointRecord | null
}

/**
 * Idempotent startup precedence arbiter.
 * Evaluates storage health, active event, and unresolved official Live sessions in order.
 * Guaranteed never to mutate official history, create new sessions, or reselect winners.
 */
export function evaluateStartupRecovery(input: StartupRecoveryInput): StartupRecoveryResult {
  if (input.storageError !== undefined && input.storageError !== null && input.storageError.length > 0) {
    return { kind: 'storage-failure', error: input.storageError }
  }

  if (input.activeEvent === null) {
    return { kind: 'no-active-event' }
  }

  const activeEventId = input.activeEvent.id
  const unresolvedSessions = input.sessions
    .filter(
      (session) =>
        session.eventId === activeEventId &&
        session.mode === 'live' &&
        (session.status === 'drawing' || session.status === 'pending-confirmation'),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

  if (unresolvedSessions.length > 1) {
    return { kind: 'conflicting-sessions', sessions: unresolvedSessions, recommendedRoute: '/draw/pending' }
  }

  const unresolvedSession = unresolvedSessions[0] ?? null

  if (unresolvedSession === null) {
    return { kind: 'normal', targetPath: '/dashboard' }
  }

  const sessionWinners = (input.winners ?? []).filter((winner) => winner.drawSessionId === unresolvedSession.id)
  const sessionRedraws = (input.redraws ?? []).filter((redraw) => redraw.drawSessionId === unresolvedSession.id)
  const sessionReceipts = (input.receipts ?? []).filter((receipt) => receipt.drawSessionId === unresolvedSession.id)
  const checkpointObs: RecoveryCheckpointObservation = checkpointForSession(
    unresolvedSession.id,
    input.checkpoint ?? null,
  )

  const decision = decideRecovery({
    session: unresolvedSession,
    winners: sessionWinners,
    redraws: sessionRedraws,
    receipts: sessionReceipts,
    checkpoint: checkpointObs,
  })

  let recommendedRoute = '/dashboard'
  if (decision.kind === 'resume-pending' || decision.kind === 'resume-verification' || decision.kind === 'safe-acknowledgement-required') {
    recommendedRoute = `/draw/pending/${unresolvedSession.id}`
  } else if (decision.kind === 'resume-setup') {
    recommendedRoute = '/draw/setup'
  }

  return {
    kind: 'recover-session',
    session: unresolvedSession,
    decision,
    recommendedRoute,
  }
}
