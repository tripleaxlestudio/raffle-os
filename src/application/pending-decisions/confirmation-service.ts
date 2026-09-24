import type { DrawPersistenceUnitOfWork } from '../persistence/draw-persistence-unit-of-work.interface.ts'
import type { CommandReceiptRepository } from '../persistence/command-receipt-repository.interface.ts'
import type { ConfirmPendingWinnersCommand, PendingDecisionOutcome } from './command.types.ts'
import { canonicalizeDecisionPayload, validateCommandPayloadConflict, validateLiveMutationCommand } from './validation.ts'
import type { PendingDecisionError } from './validation.ts'
import { PersistenceError } from '../../infrastructure/persistence/errors/persistence-errors.ts'

export type ConfirmationFailureStatus = 'conflict' | 'stale' | 'invalid' | 'storage-failure' | 'unknown'
export type ConfirmationApplicationResult =
  | { readonly status: 'committed' | 'idempotent-replay'; readonly outcome: PendingDecisionOutcome }
  | { readonly status: 'conflict' | 'stale' | 'invalid' | 'storage-failure' | 'unknown'; readonly error: PendingDecisionError }

function applicationError(status: ConfirmationFailureStatus, code: PendingDecisionError['code'], message: string): ConfirmationApplicationResult {
  return { status, error: { kind: status === 'storage-failure' ? 'storage' : status === 'stale' || status === 'conflict' ? 'conflict' : 'validation', code, message } }
}

export class ConfirmationService {
  private readonly persistence: DrawPersistenceUnitOfWork
  private readonly receipts: CommandReceiptRepository

  constructor(
    persistence: DrawPersistenceUnitOfWork,
    receipts: CommandReceiptRepository,
  ) {
    this.persistence = persistence
    this.receipts = receipts
  }

  async confirm(command: ConfirmPendingWinnersCommand): Promise<ConfirmationApplicationResult> {
    const validation = validateLiveMutationCommand(command)
    if (!validation.ok) return { status: 'invalid', error: validation.error }
    const payload = canonicalizeDecisionPayload(command)
    const existing = await this.receipts.read(command.commandId)
    if (existing !== undefined) {
      const equivalent = validateCommandPayloadConflict(JSON.parse(existing.canonicalPayload) as typeof payload, payload)
      if (!equivalent.ok) return { status: 'conflict', error: equivalent.error }
      if (existing.status === 'committed') {
        return { status: 'idempotent-replay', outcome: { affectedWinnerIds: existing.affectedWinnerIds, commandId: existing.commandId, committedAt: existing.committedAt, drawSessionId: existing.drawSessionId, operation: existing.operation, sessionStatus: existing.sessionStatus, status: 'committed' } }
      }
    }
    try {
      if (this.persistence.confirmPendingWinners === undefined) return applicationError('storage-failure', 'storage-failure', 'The confirmation persistence boundary is unavailable.')
      return { status: 'committed', outcome: await this.persistence.confirmPendingWinners({
        actor: command.actor,
        canonicalPayload: payload,
        commandId: command.commandId,
        drawSessionId: command.drawSessionId,
        operation: command.operation,
        targets: command.targets,
      }) }
    } catch (error: unknown) {
      if (error instanceof PersistenceError) {
        if (error.code === 'immutable-record' || error.code === 'relationship-mismatch' || error.code === 'record-not-found') return applicationError('stale', 'stale-expected-status', error.message)
        if (error.code === 'validation-failed' && error.message.includes('no longer has its expected status')) return applicationError('stale', 'stale-expected-status', error.message)
        if (error.code === 'validation-failed') return applicationError('invalid', 'invalid-targets', error.message)
        return applicationError('storage-failure', 'storage-failure', error.message)
      }
      return applicationError('unknown', 'unknown-outcome', 'The confirmation outcome is unknown; reconcile the command receipt and authoritative records.')
    }
  }

  async reconcile(command: ConfirmPendingWinnersCommand): Promise<ConfirmationApplicationResult> {
    const validation = validateLiveMutationCommand(command)
    if (!validation.ok) return { status: 'invalid', error: validation.error }
    const payload = canonicalizeDecisionPayload(command)
    const receipt = await this.receipts.read(command.commandId)
    if (receipt === undefined) return applicationError('unknown', 'unknown-outcome', 'No receipt exists; the command may be retried after checking authoritative records.')
    const equivalent = validateCommandPayloadConflict(JSON.parse(receipt.canonicalPayload) as typeof payload, payload)
    if (!equivalent.ok) return { status: 'conflict', error: equivalent.error }
    if (receipt.status === 'committed') return { status: 'idempotent-replay', outcome: { affectedWinnerIds: receipt.affectedWinnerIds, commandId: receipt.commandId, committedAt: receipt.committedAt, drawSessionId: receipt.drawSessionId, operation: receipt.operation, sessionStatus: receipt.sessionStatus, status: 'committed' } }
    return applicationError('unknown', 'unknown-outcome', 'The command receipt is not committed; reload authoritative records before retrying.')
  }
}
