import type { Transaction } from 'dexie'
import type { CanonicalDecisionPayload, PendingDecisionActor, PendingDecisionOutcome } from '../../../application/pending-decisions/command.types.ts'
import type { CommandId, DrawSessionId } from '../../../domain/shared/identifiers.ts'
import { isoTimestampFromDate, type IsoTimestamp } from '../../../domain/shared/timestamps.ts'
import { areEquivalentDecisionPayloads, validateCommandPayloadConflict } from '../../../application/pending-decisions/validation.ts'
import type { CommandReceiptRecord, CommandReceiptReconciliation, CommandReceiptRepository, CommandReceiptTransaction } from '../../../application/persistence/command-receipt-repository.interface.ts'
import { DuplicateRecordError, RecordNotFoundError, RelationshipMismatchError, TransactionError, isUniqueConstraintError } from '../errors/persistence-errors.ts'
import type { RaffleOSDatabase } from '../db.ts'

function now(): IsoTimestamp {
  const result = isoTimestampFromDate(new Date())
  if (!result.ok) throw new TransactionError('Persistence generated an invalid command receipt timestamp.')
  return result.value
}

function payloadFromRecord(record: CommandReceiptRecord): CanonicalDecisionPayload {
  return JSON.parse(record.canonicalPayload) as CanonicalDecisionPayload
}

function outcomeFromRecord(record: CommandReceiptRecord): PendingDecisionOutcome {
  return {
    affectedWinnerIds: record.affectedWinnerIds,
    commandId: record.commandId,
    committedAt: record.committedAt,
    drawSessionId: record.drawSessionId,
    operation: record.operation,
    sessionStatus: record.sessionStatus,
    status: record.outcomeStatus,
  }
}

export class DexieCommandReceiptRepository implements CommandReceiptRepository {
  readonly #database: RaffleOSDatabase

  constructor(database: RaffleOSDatabase) { this.#database = database }

  inTransaction(transaction: Transaction): CommandReceiptTransaction { return { transaction } }

  async read(commandId: CommandId, context?: CommandReceiptTransaction): Promise<CommandReceiptRecord | undefined> {
    return (context?.transaction.table('command_receipts') ?? this.#database.command_receipts).get(commandId) as Promise<CommandReceiptRecord | undefined>
  }

  async findBySession(drawSessionId: DrawSessionId, context?: CommandReceiptTransaction): Promise<readonly CommandReceiptRecord[]> {
    return ((context?.transaction.table('command_receipts') ?? this.#database.command_receipts).where('drawSessionId').equals(drawSessionId).toArray()) as Promise<readonly CommandReceiptRecord[]>
  }

  async create(commandId: CommandId, actor: PendingDecisionActor, payload: CanonicalDecisionPayload, context?: CommandReceiptTransaction): Promise<CommandReceiptRecord | PendingDecisionOutcome> {
    const table = context?.transaction.table('command_receipts') ?? this.#database.command_receipts
    const existing = await table.get(commandId) as CommandReceiptRecord | undefined
    if (existing !== undefined) {
      this.#assertEquivalent(existing, payload)
      return existing.status === 'committed' ? outcomeFromRecord(existing) : existing
    }
    const record: CommandReceiptRecord = {
      actor,
      affectedWinnerIds: [],
      canonicalPayload: JSON.stringify(payload),
      commandId,
      createdAt: now(),
      drawSessionId: payload.drawSessionId,
      operation: payload.operation,
      outcomeStatus: 'unknown',
      status: 'started',
    }
    try {
      await table.add(record)
      return record
    } catch (error: unknown) {
      if (!isUniqueConstraintError(error)) throw new TransactionError('The command receipt could not be created.', { cause: error })
      const raced = await table.get(commandId) as CommandReceiptRecord | undefined
      if (raced === undefined) throw new TransactionError('A concurrent receipt was lost before it could be read.')
      this.#assertEquivalent(raced, payload)
      return raced.status === 'committed' ? outcomeFromRecord(raced) : raced
    }
  }

  async finalize(commandId: CommandId, payload: CanonicalDecisionPayload, outcome: PendingDecisionOutcome, context?: CommandReceiptTransaction): Promise<PendingDecisionOutcome> {
    const table = context?.transaction.table('command_receipts') ?? this.#database.command_receipts
    const existing = await table.get(commandId) as CommandReceiptRecord | undefined
    if (existing === undefined) throw new RecordNotFoundError('Cannot finalize a command without its receipt.')
    this.#assertEquivalent(existing, payload)
    if (existing.status === 'committed') return outcomeFromRecord(existing)
    if (existing.drawSessionId !== outcome.drawSessionId || existing.operation !== outcome.operation) throw new RelationshipMismatchError('The receipt outcome does not match the command scope.')
    const committedAt = outcome.status === 'committed' ? now() : undefined
    const finalized: CommandReceiptRecord = {
      ...existing,
      affectedWinnerIds: outcome.affectedWinnerIds,
      committedAt,
      outcomeStatus: outcome.status,
      sessionStatus: outcome.sessionStatus,
      status: outcome.status,
    }
    await table.put(finalized)
    return { ...outcome, committedAt, status: outcome.status }
  }

  async reconcile(commandId: CommandId, payload: CanonicalDecisionPayload, context?: CommandReceiptTransaction): Promise<CommandReceiptReconciliation> {
    const receipt = await this.read(commandId, context)
    if (receipt === undefined) return { kind: 'missing', retryable: true }
    if (!areEquivalentDecisionPayloads(payloadFromRecord(receipt), payload)) return { kind: 'conflict', receipt }
    return receipt.status === 'committed'
      ? { kind: 'committed', outcome: outcomeFromRecord(receipt) }
      : { kind: 'in-progress', receipt }
  }

  #assertEquivalent(existing: CommandReceiptRecord, payload: CanonicalDecisionPayload): void {
    const result = validateCommandPayloadConflict(payloadFromRecord(existing), payload)
    if (!result.ok) throw new DuplicateRecordError(result.error.message)
  }
}
