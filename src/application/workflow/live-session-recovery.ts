import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
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

export type LiveSessionRecoveryOutcome =
  | {
      readonly status: 'recovered-pending'
      readonly session: DrawSession
      readonly winners: readonly WinnerRecord[]
      readonly redraws: readonly RedrawRecord[]
      readonly recommendedRoute: string
      readonly isReadOnly: boolean
      readonly checkpointWarning?: string
    }
  | {
      readonly status: 'recovered-setup'
      readonly session: DrawSession
      readonly recommendedRoute: string
      readonly reason: string
    }
  | {
      readonly status: 'acknowledgement-required'
      readonly session: DrawSession
      readonly reason: 'selection-outcome-unknown' | 'receipt-unresolved' | 'checkpoint-conflict'
      readonly recommendedRoute: string
    }
  | {
      readonly status: 'terminal-read-only'
      readonly session: DrawSession
      readonly winners: readonly WinnerRecord[]
      readonly redraws: readonly RedrawRecord[]
      readonly recommendedRoute: string
    }

export interface LiveSessionRecoveryInput {
  readonly session: DrawSession
  readonly winners: readonly WinnerRecord[]
  readonly redraws?: readonly RedrawRecord[]
  readonly receipts?: readonly CommandReceiptRecord[]
  readonly checkpoint?: PresentationCheckpointRecord | null
  readonly checkpointError?: 'corrupt' | 'unsupported' | 'stale'
}

/**
 * High-level orchestrator for recovering a Live DrawSession across reloads or presentation interruptions.
 * Guarantees that official persisted records (WinnerRecords, RedrawRecords) take precedence over presentation checkpoints.
 * Never performs reselection or mutates history.
 */
export function evaluateLiveSessionRecovery(input: LiveSessionRecoveryInput): LiveSessionRecoveryOutcome {
  const sessionWinners = input.winners.filter((winner) => winner.drawSessionId === input.session.id)
  const sessionRedraws = (input.redraws ?? []).filter((redraw) => redraw.drawSessionId === input.session.id)
  const sessionReceipts = (input.receipts ?? []).filter((receipt) => receipt.drawSessionId === input.session.id)

  let checkpointObs: RecoveryCheckpointObservation = checkpointForSession(
    input.session.id,
    input.checkpoint ?? null,
  )

  if (input.checkpointError === 'corrupt') {
    checkpointObs = { kind: 'corrupt' }
  } else if (input.checkpointError === 'unsupported') {
    checkpointObs = { kind: 'unsupported' }
  } else if (input.checkpointError === 'stale') {
    checkpointObs = { kind: 'stale' }
  }

  const decision: RecoveryDecision = decideRecovery({
    session: input.session,
    winners: sessionWinners,
    redraws: sessionRedraws,
    receipts: sessionReceipts,
    checkpoint: checkpointObs,
  })

  switch (decision.kind) {
    case 'resume-pending':
    case 'resume-verification': {
      let checkpointWarning: string | undefined = undefined
      if (checkpointObs.kind === 'corrupt') {
        checkpointWarning = 'Presentation checkpoint was corrupt, but official winner records were safely recovered.'
      } else if (checkpointObs.kind === 'unsupported') {
        checkpointWarning = 'Presentation checkpoint format is unsupported, but official winner records were safely recovered.'
      } else if (checkpointObs.kind === 'stale') {
        checkpointWarning = 'Presentation checkpoint was stale, but official winner records were safely recovered.'
      }

      return {
        status: 'recovered-pending',
        session: input.session,
        winners: sessionWinners,
        redraws: sessionRedraws,
        recommendedRoute: `/draw/pending/${input.session.id}`,
        isReadOnly: true,
        checkpointWarning,
      }
    }

    case 'resume-setup':
      return {
        status: 'recovered-setup',
        session: input.session,
        recommendedRoute: '/draw/setup',
        reason: decision.reason,
      }

    case 'safe-acknowledgement-required':
      return {
        status: 'acknowledgement-required',
        session: input.session,
        reason: decision.reason,
        recommendedRoute: `/draw/pending/${input.session.id}`,
      }

    case 'terminal':
      return {
        status: 'terminal-read-only',
        session: input.session,
        winners: sessionWinners,
        redraws: sessionRedraws,
        recommendedRoute: `/history/${input.session.id}`,
      }
  }
}
