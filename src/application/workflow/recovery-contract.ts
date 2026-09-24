import type { CommandReceiptRecord } from '../persistence/command-receipt-repository.interface.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import type { RedrawRecord } from '../../domain/winners/redraw.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { PresentationCheckpointRecord } from '../../domain/workflow/presentation-checkpoint.types.ts'

export type RecoveryReceiptResolution =
  | { readonly kind: 'committed'; readonly receipts: readonly CommandReceiptRecord[] }
  | { readonly kind: 'not-committed'; readonly receipts: readonly CommandReceiptRecord[] }
  | { readonly kind: 'unresolved'; readonly receipts: readonly CommandReceiptRecord[] }
  | { readonly kind: 'absent' }

export type RecoveryCheckpointObservation =
  | { readonly kind: 'absent' }
  | { readonly kind: 'matching'; readonly checkpoint: PresentationCheckpointRecord }
  | { readonly kind: 'other-session'; readonly checkpoint: PresentationCheckpointRecord }
  | { readonly kind: 'stale' }
  | { readonly kind: 'unsupported' }
  | { readonly kind: 'corrupt' }

export type RecoveryDecision =
  | {
      readonly kind: 'resume-setup'
      readonly session: DrawSession
      readonly reason: 'no-official-selection' | 'presentation-interrupted-before-selection'
      readonly checkpoint: RecoveryCheckpointObservation
    }
  | {
      readonly kind: 'resume-pending'
      readonly session: DrawSession
      readonly winners: readonly WinnerRecord[]
      readonly redraws: readonly RedrawRecord[]
      readonly receipts: RecoveryReceiptResolution
      readonly checkpoint: RecoveryCheckpointObservation
    }
  | {
      readonly kind: 'resume-verification'
      readonly session: DrawSession
      readonly winners: readonly WinnerRecord[]
      readonly redraws: readonly RedrawRecord[]
      readonly receipts: RecoveryReceiptResolution
      readonly checkpoint: RecoveryCheckpointObservation
    }
  | {
      readonly kind: 'safe-acknowledgement-required'
      readonly session: DrawSession
      readonly reason: 'selection-outcome-unknown' | 'receipt-unresolved' | 'checkpoint-conflict'
      readonly receipts: RecoveryReceiptResolution
      readonly checkpoint: RecoveryCheckpointObservation
    }
  | {
      readonly kind: 'terminal'
      readonly session: DrawSession
      readonly winners: readonly WinnerRecord[]
      readonly redraws: readonly RedrawRecord[]
      readonly checkpoint: RecoveryCheckpointObservation
    }

export interface RecoveryContractInput {
  readonly session: DrawSession
  readonly winners: readonly WinnerRecord[]
  readonly redraws: readonly RedrawRecord[]
  readonly receipts: readonly CommandReceiptRecord[]
  readonly checkpoint: RecoveryCheckpointObservation
}

function resolveReceipts(receipts: readonly CommandReceiptRecord[]): RecoveryReceiptResolution {
  if (receipts.length === 0) return { kind: 'absent' }
  if (receipts.some((receipt) => receipt.status === 'committed')) return { kind: 'committed', receipts }
  if (receipts.some((receipt) => receipt.status === 'started' || receipt.status === 'unknown')) return { kind: 'unresolved', receipts }
  return { kind: 'not-committed', receipts }
}

function hasReceiptConflict(receipts: RecoveryReceiptResolution): boolean {
  return receipts.kind === 'unresolved'
}

function relatedWinners(session: DrawSession, winners: readonly WinnerRecord[]): readonly WinnerRecord[] {
  return winners.filter((winner) => winner.drawSessionId === session.id)
}

function relatedRedraws(session: DrawSession, redraws: readonly RedrawRecord[]): readonly RedrawRecord[] {
  return redraws.filter((redraw) => redraw.drawSessionId === session.id)
}

/**
 * Read-only recovery policy. It deliberately has no selector or persistence dependency.
 * Official records take precedence over presentation checkpoints.
 */
export function decideRecovery(input: RecoveryContractInput): RecoveryDecision {
  const winners = relatedWinners(input.session, input.winners)
  const redraws = relatedRedraws(input.session, input.redraws)
  const receipts = resolveReceipts(input.receipts)

  if (input.session.status === 'completed' || input.session.status === 'cancelled') {
    return { kind: 'terminal', session: input.session, winners, redraws, checkpoint: input.checkpoint }
  }

  if (hasReceiptConflict(receipts)) {
    return { kind: 'safe-acknowledgement-required', session: input.session, reason: 'receipt-unresolved', receipts, checkpoint: input.checkpoint }
  }

  if (winners.length === 0 && input.checkpoint.kind === 'other-session') {
    return { kind: 'safe-acknowledgement-required', session: input.session, reason: 'checkpoint-conflict', receipts, checkpoint: input.checkpoint }
  }

  if (winners.length === 0) {
    if (input.session.status === 'drawing' || input.session.status === 'pending-confirmation') {
      return {
        kind: 'safe-acknowledgement-required',
        session: input.session,
        reason: 'selection-outcome-unknown',
        receipts,
        checkpoint: input.checkpoint,
      }
    }

    return {
      kind: 'resume-setup',
      session: input.session,
      reason: input.checkpoint.kind === 'matching' ? 'presentation-interrupted-before-selection' : 'no-official-selection',
      checkpoint: input.checkpoint,
    }
  }

  if (input.checkpoint.kind === 'corrupt' || input.checkpoint.kind === 'unsupported') {
    return { kind: 'resume-verification', session: input.session, winners, redraws, receipts, checkpoint: input.checkpoint }
  }

  if (input.session.status === 'drawing') {
    return { kind: 'resume-pending', session: input.session, winners, redraws, receipts, checkpoint: input.checkpoint }
  }

  return { kind: 'resume-verification', session: input.session, winners, redraws, receipts, checkpoint: input.checkpoint }
}

export function checkpointForSession(
  sessionId: DrawSessionId,
  checkpoint: PresentationCheckpointRecord | null,
): RecoveryCheckpointObservation {
  if (checkpoint === null) return { kind: 'absent' }
  return checkpoint.drawSessionId === sessionId ? { kind: 'matching', checkpoint } : { kind: 'other-session', checkpoint }
}
