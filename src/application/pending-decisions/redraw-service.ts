import type { CommandReceiptRepository } from '../persistence/command-receipt-repository.interface.ts'
import type { DrawPersistenceUnitOfWork } from '../persistence/draw-persistence-unit-of-work.interface.ts'
import type { PendingDecisionError } from './validation.ts'
import { canonicalizeDecisionPayload, validateCommandPayloadConflict, validateLiveMutationCommand } from './validation.ts'
import type { PendingDecisionOutcome, RedrawConfirmedWinnersCommand, RedrawPendingWinnersCommand } from './command.types.ts'
import { PersistenceError } from '../../infrastructure/persistence/errors/persistence-errors.ts'
import type { CommandId } from '../../domain/shared/identifiers.ts'
import type { RedrawRequest } from '../../domain/winners/redraw-request.types.ts'

export type RedrawApplicationResult =
  | { readonly status: 'committed' | 'idempotent-replay'; readonly outcome: PendingDecisionOutcome }
  | { readonly status: 'conflict' | 'stale' | 'invalid' | 'insufficient-capacity' | 'storage-failure' | 'unknown'; readonly error: PendingDecisionError }

function error(status: Exclude<RedrawApplicationResult['status'], 'committed' | 'idempotent-replay'>, code: PendingDecisionError['code'], message: string): RedrawApplicationResult {
  return {
    status,
    error: {
      code,
      kind: status === 'insufficient-capacity' ? 'capacity' : status === 'storage-failure' ? 'storage' : status === 'unknown' ? 'unknown' : status === 'stale' || status === 'conflict' ? 'conflict' : 'validation',
      message,
    },
  }
}

function replay(receipt: Awaited<ReturnType<CommandReceiptRepository['read']>>): RedrawApplicationResult | null {
  if (receipt === undefined || receipt.status !== 'committed') return null
  return {
    status: 'idempotent-replay',
    outcome: {
      affectedWinnerIds: receipt.affectedWinnerIds,
      commandId: receipt.commandId,
      committedAt: receipt.committedAt,
      drawSessionId: receipt.drawSessionId,
      operation: receipt.operation,
      replacementWinnerIds: receipt.replacementWinnerIds,
      replacementTickets: receipt.replacementTickets,
      sessionStatus: receipt.sessionStatus,
      status: 'committed',
    },
  }
}

export class RedrawService {
  private readonly persistence: DrawPersistenceUnitOfWork
  private readonly receipts: CommandReceiptRepository

  constructor(persistence: DrawPersistenceUnitOfWork, receipts: CommandReceiptRepository) {
    this.persistence = persistence
    this.receipts = receipts
  }

  async redraw(command: RedrawPendingWinnersCommand | RedrawConfirmedWinnersCommand): Promise<RedrawApplicationResult> {
    const validation = validateLiveMutationCommand(command)
    if (!validation.ok) return { status: 'invalid', error: validation.error }
    const payload = canonicalizeDecisionPayload(command)
    try {
      const existing = await this.receipts.read(command.commandId)
      if (existing !== undefined) {
        const equivalent = validateCommandPayloadConflict(JSON.parse(existing.canonicalPayload) as typeof payload, payload)
        if (!equivalent.ok) return { status: 'conflict', error: equivalent.error }
        const result = replay(existing)
        if (result !== null) return result
      }
      if (command.operation === 'redraw-pending-winners') {
        if (this.persistence.redrawPendingWinners === undefined) return error('storage-failure', 'storage-failure', 'The redraw persistence boundary is unavailable.')
        const outcome = await this.persistence.redrawPendingWinners({ ...command, canonicalPayload: payload })
        return { status: 'committed', outcome }
      }
      if (this.persistence.redrawConfirmedWinners === undefined) return error('storage-failure', 'storage-failure', 'The redraw persistence boundary is unavailable.')
      const outcome = await this.persistence.redrawConfirmedWinners({ ...command, canonicalPayload: payload })
      return { status: 'committed', outcome }
    } catch (cause: unknown) {
      if (cause instanceof PersistenceError) {
        if (cause.code === 'immutable-record' || cause.code === 'relationship-mismatch' || cause.code === 'record-not-found') return error('stale', cause.code === 'record-not-found' ? 'missing-session' : 'stale-expected-status', cause.message)
        if (cause.code === 'validation-failed' && cause.message.includes('Insufficient redraw capacity')) return error('insufficient-capacity', 'insufficient-redraw-capacity', cause.message)
        if (cause.code === 'validation-failed' && cause.message.includes('expected status')) return error('stale', 'stale-expected-status', cause.message)
        if (cause.code === 'validation-failed') return error('invalid', 'invalid-targets', cause.message)
        return error('storage-failure', 'storage-failure', cause.message)
      }
      return error('unknown', 'unknown-outcome', 'The redraw outcome is unknown; reconcile the command receipt and authoritative records.')
    }
  }

  async reconcile(command: RedrawPendingWinnersCommand | RedrawConfirmedWinnersCommand): Promise<RedrawApplicationResult> {
    const validation = validateLiveMutationCommand(command)
    if (!validation.ok) return { status: 'invalid', error: validation.error }
    const payload = canonicalizeDecisionPayload(command)
    const receipt = await this.receipts.read(command.commandId)
    if (receipt === undefined) return error('unknown', 'unknown-outcome', 'No receipt exists; check authoritative records before retrying.')
    const equivalent = validateCommandPayloadConflict(JSON.parse(receipt.canonicalPayload) as typeof payload, payload)
    if (!equivalent.ok) return { status: 'conflict', error: equivalent.error }
    return replay(receipt) ?? error('unknown', 'unknown-outcome', 'The redraw receipt is not committed; reload authoritative records before retrying.')
  }

  async start(requestId: CommandId): Promise<RedrawRequest> {
    if (this.persistence.startRedraw === undefined) throw new Error('The redraw start persistence boundary is unavailable.')
    return this.persistence.startRedraw({ requestId })
  }

  async complete(requestId: CommandId): Promise<RedrawRequest> {
    if (this.persistence.completeRedraw === undefined) throw new Error('The redraw completion persistence boundary is unavailable.')
    return this.persistence.completeRedraw({ requestId })
  }
}
