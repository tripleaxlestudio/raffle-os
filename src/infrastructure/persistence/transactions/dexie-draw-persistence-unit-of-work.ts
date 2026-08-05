import type {
  DrawPersistenceUnitOfWork,
  ConfirmPendingWinnersPersistenceInput,
  ConfirmPendingWinnersPersistenceOutcome,
  CancelPendingWinnersPersistenceInput,
  CancelPendingWinnersPersistenceOutcome,
  RedrawWinnersPersistenceOutcome,
  RedrawWinnersPersistenceInput,
  PersistStartedDrawInput,
  RecordRedrawReplacementInput,
  TransitionWinnersWithAuditInput,
} from '../../../application/persistence/draw-persistence-unit-of-work.interface.ts'
import type { AuditRecord } from '../../../domain/audit/audit.types.ts'
import type { CancelPendingWinnersCommand, ConfirmPendingWinnersCommand, CanonicalDecisionPayload } from '../../../application/pending-decisions/command.types.ts'
import { LOCAL_OPERATOR } from '../../../application/pending-decisions/command.types.ts'
import { validateCommandTargets } from '../../../application/pending-decisions/validation.ts'
import { resolveWinnerStatus } from '../../../domain/pending-decisions/lifecycle.ts'
import { isoTimestampFromDate } from '../../../domain/shared/timestamps.ts'
import { createAuditRecordId } from '../../../domain/shared/identifiers.ts'
import {
  canTransitionWinnerStatus,
  transitionWinnerStatus,
  validateWinnerRecord,
} from '../../../domain/winners/winner.invariants.ts'
import type { RaffleOSDatabase } from '../db.ts'
import {
  DuplicateRecordError,
  ImmutableRecordError,
  RecordNotFoundError,
  RelationshipMismatchError,
  ValidationError,
  TransactionError,
} from '../errors/persistence-errors.ts'
import {
  appendAuditInTransaction,
} from '../repositories/audit.repository.ts'
import {
  attachDrawSessionSnapshotsInTransaction,
  transitionDrawSessionInTransaction,
} from '../repositories/draw-session.repository.ts'
import {
  appendRedrawInTransaction,
} from '../repositories/redraw.repository.ts'
import {
  appendWinnerBatchInTransaction,
  transitionWinnerInTransaction,
} from '../repositories/winner.repository.ts'
import {
  normalizeRepositoryError,
  requireValid,
} from '../repositories/repository-helpers.ts'
import { DexieCommandReceiptRepository } from '../repositories/command-receipt.repository.ts'
import type { RandomSource } from '../../../application/draw/random-source.ts'
import { createWebCryptoRandomSource } from '../../random/web-crypto-random-source.ts'
import { createRedrawRecordId, createWinnerRecordId } from '../../../domain/shared/identifiers.ts'
import { buildRedrawCandidates, selectRedrawCandidates } from '../../../domain/draws/redraw-eligibility.ts'

function requireAuditRecords(
  count: number,
  operation: string,
): void {
  if (count === 0) {
    throw new ValidationError(
      `${operation} requires at least one AuditRecord.`,
    )
  }
}

function requireStartedWinnerSequences(
  input: PersistStartedDrawInput,
): void {
  if (
    input.winners.length !==
    input.snapshots.configurationSnapshot.requestedWinners
  ) {
    throw new ValidationError(
      'The supplied WinnerRecord count must equal requestedWinners.',
    )
  }

  const sequences = input.winners
    .map((winner) => winner.sequenceNumber)
    .sort((left, right) => left - right)
  for (const [index, sequence] of sequences.entries()) {
    if (sequence !== index + 1) {
      throw new ValidationError(
        'Initial WinnerRecord sequences must be unique and contiguous from one.',
      )
    }
  }
}

export class DexieDrawPersistenceUnitOfWork
  implements DrawPersistenceUnitOfWork
{
  private readonly database: RaffleOSDatabase
  private readonly receipts: DexieCommandReceiptRepository
  private readonly randomSource: RandomSource

  constructor(database: RaffleOSDatabase, options: { readonly randomSource?: RandomSource } = {}) {
    this.database = database
    this.receipts = new DexieCommandReceiptRepository(database)
    this.randomSource = options.randomSource ?? createWebCryptoRandomSource()
  }

  async persistStartedDraw(
    input: PersistStartedDrawInput,
  ): Promise<void> {
    try {
      requireStartedWinnerSequences(input)
      if (input.auditRecord.action !== 'draw-session-started') {
        throw new ValidationError(
          'Persisting a started draw requires a draw-session-started AuditRecord.',
        )
      }

      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.participants,
          this.database.prize_categories,
          this.database.draw_configurations,
          this.database.draw_sessions,
          this.database.winner_records,
          this.database.audit_records,
        ],
        async () => {
          const started =
            await attachDrawSessionSnapshotsInTransaction(
              this.database,
              input.drawSessionId,
              input.expectedStatus,
              input.snapshots,
              input.at,
            )

          if (input.auditRecord.eventId !== started.eventId) {
            throw new RelationshipMismatchError(
              'The started-draw AuditRecord must belong to the DrawSession Event.',
            )
          }
          if (
            input.winners.some(
              (winner) =>
                winner.eventId !== started.eventId ||
                winner.prizeCategoryId !== input.snapshots.configurationSnapshot.prizeCategoryId ||
                winner.status !== 'pending',
            )
          ) {
            throw new RelationshipMismatchError(
              'Every started-draw WinnerRecord must belong to the DrawSession Event and category and remain pending.',
            )
          }
          if (
            input.winners.some(
              (winner) => winner.drawSessionId !== started.id,
            )
          ) {
            throw new RelationshipMismatchError(
              'Every started-draw WinnerRecord must belong to the supplied DrawSession.',
            )
          }

          await appendWinnerBatchInTransaction(
            this.database,
            input.winners,
          )
          await transitionDrawSessionInTransaction(
            this.database,
            started.id,
            'drawing',
            'pending-confirmation',
            input.at,
          )
          await appendAuditInTransaction(
            this.database,
            input.auditRecord,
          )
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Persisting the started draw',
      )
    }
  }

  async transitionWinnersWithAudit(
    input: TransitionWinnersWithAuditInput,
  ): Promise<void> {
    try {
      if (input.transitions.length === 0) {
        throw new ValidationError(
          'A winner transition transaction requires at least one transition.',
        )
      }
      requireAuditRecords(
        input.auditRecords.length,
        'A winner transition transaction',
      )

      const transitionIds = new Set<string>()
      for (const transition of input.transitions) {
        if (transitionIds.has(transition.winnerId)) {
          throw new DuplicateRecordError(
            'A WinnerRecord appears more than once in the transition request.',
          )
        }
        transitionIds.add(transition.winnerId)

        if (
          transition.from !== 'pending' ||
          (transition.to !== 'confirmed' &&
            transition.to !== 'cancelled') ||
          !canTransitionWinnerStatus(
            transition.from,
            transition.to,
          )
        ) {
          throw new ImmutableRecordError(
            'This operation permits only pending-to-confirmed or pending-to-cancelled WinnerRecord transitions.',
          )
        }
      }

      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.participants,
          this.database.draw_sessions,
          this.database.winner_records,
          this.database.audit_records,
        ],
        async () => {
          const session = await this.database.draw_sessions.get(
            input.drawSessionId,
          )
          if (session === undefined) {
            throw new RecordNotFoundError(
              'The DrawSession required for winner transitions was not found.',
            )
          }

          const winners = await this.database.winner_records.bulkGet(
            input.transitions.map(
              (transition) => transition.winnerId,
            ),
          )
          for (const [index, transition] of input.transitions.entries()) {
            const winner = winners[index]
            if (winner === undefined) {
              throw new RecordNotFoundError(
                'A WinnerRecord required for transition was not found.',
              )
            }
            requireValid(validateWinnerRecord(winner))
            if (winner.drawSessionId !== session.id) {
              throw new RelationshipMismatchError(
                'Every transitioned WinnerRecord must belong to the supplied DrawSession.',
              )
            }
            if (winner.status !== transition.from) {
              throw new ImmutableRecordError(
                `WinnerRecord status is ${winner.status}, not the expected ${transition.from}.`,
              )
            }
          }

          if (
            input.auditRecords.some(
              (audit) => audit.eventId !== session.eventId,
            )
          ) {
            throw new RelationshipMismatchError(
              'Every transition AuditRecord must belong to the DrawSession Event.',
            )
          }

          for (const transition of input.transitions) {
            await transitionWinnerInTransaction(
              this.database,
              transition.winnerId,
              transition.from,
              transition.to,
              transition.at,
            )
          }
          for (const audit of input.auditRecords) {
            await appendAuditInTransaction(this.database, audit)
          }
          if (input.sessionTransition !== undefined) {
            await transitionDrawSessionInTransaction(
              this.database,
              session.id,
              input.sessionTransition.from,
              input.sessionTransition.to,
              input.sessionTransition.at,
            )
          }
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Transitioning WinnerRecords with audit',
      )
    }
  }

  async recordRedrawReplacement(
    input: RecordRedrawReplacementInput,
  ): Promise<void> {
    try {
      requireAuditRecords(
        input.auditRecords.length,
        'An audited redraw transaction',
      )

      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.participants,
          this.database.draw_sessions,
          this.database.winner_records,
          this.database.redraw_records,
          this.database.audit_records,
        ],
        async () => {
          const [session, original, sessionWinners] =
            await Promise.all([
              this.database.draw_sessions.get(input.drawSessionId),
              this.database.winner_records.get(
                input.originalWinnerId,
              ),
              this.database.winner_records
                .where('drawSessionId')
                .equals(input.drawSessionId)
                .toArray(),
            ])

          if (session === undefined) {
            throw new RecordNotFoundError(
              'The DrawSession required for the redraw was not found.',
            )
          }
          if (original === undefined) {
            throw new RecordNotFoundError(
              'The original WinnerRecord required for the redraw was not found.',
            )
          }
          if (original.drawSessionId !== session.id) {
            throw new RelationshipMismatchError(
              'The original WinnerRecord must belong to the supplied DrawSession.',
            )
          }
          if (original.status !== input.expectedOriginalStatus) {
            throw new ImmutableRecordError(
              `Original WinnerRecord status is ${original.status}, not the expected ${input.expectedOriginalStatus}.`,
            )
          }

          const replacement = input.replacementWinner
          requireValid(validateWinnerRecord(replacement))
          const nextSequence =
            Math.max(
              0,
              ...sessionWinners.map(
                (winner) => winner.sequenceNumber,
              ),
            ) + 1
          if (
            replacement.id === original.id ||
            replacement.status !== 'pending' ||
            replacement.eventId !== session.eventId ||
            replacement.drawSessionId !== session.id ||
            replacement.prizeCategoryId !==
              original.prizeCategoryId ||
            replacement.sequenceNumber !== nextSequence
          ) {
            throw new RelationshipMismatchError(
              'The redraw replacement must be distinct, pending, share the original parent relationships, and use the next unused sequence.',
            )
          }

          if (
            input.redrawRecord.originalWinnerRecordId !==
              original.id ||
            input.redrawRecord.replacementWinnerRecordId !==
              replacement.id ||
            input.redrawRecord.eventId !== session.eventId ||
            input.redrawRecord.drawSessionId !== session.id
          ) {
            throw new RelationshipMismatchError(
              'The RedrawRecord must link the supplied original and replacement in the same DrawSession Event.',
            )
          }
          if (
            input.auditRecords.some(
              (audit) => audit.eventId !== session.eventId,
            )
          ) {
            throw new RelationshipMismatchError(
              'Every redraw AuditRecord must belong to the DrawSession Event.',
            )
          }

          await transitionWinnerInTransaction(
            this.database,
            original.id,
            input.expectedOriginalStatus,
            'cancelled',
            input.at,
            true,
          )
          await appendWinnerBatchInTransaction(this.database, [
            replacement,
          ])
          await appendRedrawInTransaction(
            this.database,
            input.redrawRecord,
          )
          for (const audit of input.auditRecords) {
            await appendAuditInTransaction(this.database, audit)
          }
          if (input.sessionTransition !== undefined) {
            await transitionDrawSessionInTransaction(
              this.database,
              session.id,
              input.sessionTransition.from,
              input.sessionTransition.to,
              input.sessionTransition.at,
            )
          }
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Recording the audited redraw replacement',
      )
    }
  }

  async confirmPendingWinners(
    input: ConfirmPendingWinnersPersistenceInput,
  ): Promise<ConfirmPendingWinnersPersistenceOutcome> {
    try {
      const command: ConfirmPendingWinnersCommand = { ...input, mode: 'live' }
      const payload = input.canonicalPayload as CanonicalDecisionPayload
      return await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.participants,
          this.database.draw_sessions,
          this.database.winner_records,
          this.database.audit_records,
          this.database.command_receipts,
        ],
        async (transaction) => {
          const receipt = await this.receipts.create(
            command.commandId,
            LOCAL_OPERATOR,
            payload,
            this.receipts.inTransaction(transaction),
          )
          if (!('canonicalPayload' in receipt)) return {
            affectedWinnerIds: receipt.affectedWinnerIds,
            commandId: receipt.commandId,
            committedAt: receipt.committedAt,
            drawSessionId: receipt.drawSessionId,
            operation: 'confirm-pending-winners' as const,
            sessionStatus: receipt.sessionStatus,
            status: 'committed' as const,
          }
          if (receipt.status === 'committed') {
            return {
              affectedWinnerIds: receipt.affectedWinnerIds,
              commandId: receipt.commandId,
              committedAt: receipt.committedAt,
              drawSessionId: receipt.drawSessionId,
              operation: 'confirm-pending-winners' as const,
              sessionStatus: receipt.sessionStatus,
              status: 'committed',
            }
          }

          const atResult = isoTimestampFromDate(new Date())
          if (!atResult.ok) throw new TransactionError('Persistence could not generate a canonical commit timestamp.')
          const at = atResult.value
          const session = await this.database.draw_sessions.get(command.drawSessionId)
          const winners = await this.database.winner_records.where('drawSessionId').equals(command.drawSessionId).toArray()
          const targetResult = validateCommandTargets(command, session ?? null, winners)
          if (!targetResult.ok) throw new ValidationError(targetResult.error.message)
          if (session === undefined || session.status !== 'pending-confirmation') {
            throw new ImmutableRecordError('Confirmation requires a pending-confirmation Live DrawSession.')
          }

          const targetIds = new Set(command.targets.map((target) => target.winnerId))
          const transitions = targetResult.value.map((winner) => ({ winnerId: winner.id, from: 'pending' as const, to: 'confirmed' as const, at }))
          const nextWinners = winners.map((winner) => targetIds.has(winner.id)
            ? requireValid(transitionWinnerStatus(winner, 'confirmed', at))
            : winner)
          const nextSessionStatus = resolveWinnerStatus(nextWinners.map((winner) => winner.status))
          const audits: AuditRecord[] = targetResult.value.map((winner) => ({
            action: 'winner-confirmed',
            actor: { type: 'operator', name: LOCAL_OPERATOR },
            detail: { afterStatus: 'confirmed', beforeStatus: 'pending', commandId: command.commandId, drawSessionId: command.drawSessionId, ticketNumber: winner.ticketNumber, winnerId: winner.id },
            eventId: session.eventId,
            id: createAuditRecordId(),
            timestamp: at,
          }))
          if (nextSessionStatus === 'completed') {
            audits.push({
              action: 'draw-session-completed',
              actor: { type: 'operator', name: LOCAL_OPERATOR },
              detail: { commandId: command.commandId, drawSessionId: command.drawSessionId },
              eventId: session.eventId,
              id: createAuditRecordId(),
              timestamp: at,
            })
          }

          for (const transition of transitions) {
            await transitionWinnerInTransaction(this.database, transition.winnerId, transition.from, transition.to, transition.at)
          }
          for (const audit of audits) await appendAuditInTransaction(this.database, audit)
          if (nextSessionStatus === 'completed') {
            await transitionDrawSessionInTransaction(this.database, session.id, 'pending-confirmation', 'completed', at)
          }
          const outcome = await this.receipts.finalize(command.commandId, payload, {
            affectedWinnerIds: targetResult.value.map((winner) => winner.id),
            commandId: command.commandId,
            committedAt: at,
            drawSessionId: command.drawSessionId,
            operation: command.operation,
            sessionStatus: nextSessionStatus,
            status: 'committed',
          }, this.receipts.inTransaction(transaction))
          return {
            affectedWinnerIds: outcome.affectedWinnerIds,
            commandId: outcome.commandId,
            committedAt: outcome.committedAt,
            drawSessionId: outcome.drawSessionId,
            operation: 'confirm-pending-winners' as const,
            sessionStatus: outcome.sessionStatus,
            status: 'committed' as const,
          }
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Confirming pending WinnerRecords')
    }
  }

  async cancelPendingWinners(
    input: CancelPendingWinnersPersistenceInput,
  ): Promise<CancelPendingWinnersPersistenceOutcome> {
    try {
      const payload = input.canonicalPayload as CanonicalDecisionPayload
      return await this.database.transaction('rw', [
        this.database.events,
        this.database.participants,
        this.database.draw_sessions,
        this.database.winner_records,
        this.database.audit_records,
        this.database.command_receipts,
      ], async (transaction) => {
        const command: CancelPendingWinnersCommand = {
          actor: input.actor,
          commandId: input.commandId,
          drawSessionId: input.drawSessionId,
          mode: 'live',
          operation: 'cancel-pending-winners',
          reason: input.reason,
          ...(input.note === undefined ? {} : { note: input.note }),
          targets: input.targets,
        }
        const receipt = await this.receipts.create(input.commandId, LOCAL_OPERATOR, payload, this.receipts.inTransaction(transaction))
        if (!('canonicalPayload' in receipt)) return { affectedWinnerIds: receipt.affectedWinnerIds, commandId: receipt.commandId, committedAt: receipt.committedAt, drawSessionId: receipt.drawSessionId, operation: 'cancel-pending-winners' as const, sessionStatus: receipt.sessionStatus, status: 'committed' as const }
        if (receipt.status === 'committed') return { affectedWinnerIds: receipt.affectedWinnerIds, commandId: receipt.commandId, committedAt: receipt.committedAt, drawSessionId: receipt.drawSessionId, operation: 'cancel-pending-winners' as const, sessionStatus: receipt.sessionStatus, status: 'committed' as const }

        const atResult = isoTimestampFromDate(new Date())
        if (!atResult.ok) throw new TransactionError('Persistence could not generate a canonical commit timestamp.')
        const at = atResult.value
        const session = await this.database.draw_sessions.get(input.drawSessionId)
        const winners = await this.database.winner_records.where('drawSessionId').equals(input.drawSessionId).toArray()
        const targetResult = validateCommandTargets(command, session ?? null, winners)
        if (!targetResult.ok) throw new ValidationError(targetResult.error.message)
        if (session === undefined || session.status !== 'pending-confirmation') throw new ImmutableRecordError('Cancellation requires a pending-confirmation Live DrawSession.')

        const targetIds = targetResult.value.map((winner) => winner.id)
        const targetSet = new Set(targetIds)
        const nextWinners = winners.map((winner) => targetSet.has(winner.id) ? requireValid(transitionWinnerStatus(winner, 'cancelled', at)) : winner)
        const nextSessionStatus = resolveWinnerStatus(nextWinners.map((winner) => winner.status))
        const audits: AuditRecord[] = targetResult.value.map((winner) => ({
          action: 'winner-cancelled',
          actor: { type: 'operator', name: LOCAL_OPERATOR },
          detail: {
            afterStatus: 'cancelled', beforeStatus: 'pending', commandId: input.commandId,
            drawSessionId: input.drawSessionId, ...(input.note === undefined ? {} : { normalizedNote: input.note }), reason: input.reason,
            resultingSessionStatus: nextSessionStatus, targetWinnerIds: targetIds,
            ticketNumber: winner.ticketNumber, winnerId: winner.id,
          },
          eventId: session.eventId,
          id: createAuditRecordId(),
          timestamp: at,
        }))
        if (nextSessionStatus === 'completed' || nextSessionStatus === 'cancelled') audits.push({
          action: nextSessionStatus === 'completed' ? 'draw-session-completed' : 'draw-session-cancelled',
          actor: { type: 'operator', name: LOCAL_OPERATOR },
          detail: { commandId: input.commandId, drawSessionId: input.drawSessionId, resultingSessionStatus: nextSessionStatus, targetWinnerIds: targetIds },
          eventId: session.eventId, id: createAuditRecordId(), timestamp: at,
        })
        for (const winner of targetResult.value) await transitionWinnerInTransaction(this.database, winner.id, 'pending', 'cancelled', at)
        for (const audit of audits) await appendAuditInTransaction(this.database, audit)
        if (nextSessionStatus !== session.status) await transitionDrawSessionInTransaction(this.database, session.id, session.status, nextSessionStatus, at)
        const outcome = await this.receipts.finalize(input.commandId, payload, { affectedWinnerIds: targetIds, commandId: input.commandId, committedAt: at, drawSessionId: input.drawSessionId, operation: 'cancel-pending-winners', sessionStatus: nextSessionStatus, status: 'committed' }, this.receipts.inTransaction(transaction))
        return { ...outcome, operation: 'cancel-pending-winners' as const, status: 'committed' as const }
      })
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Cancelling pending WinnerRecords')
    }
  }

  async redrawPendingWinners(
    input: RedrawWinnersPersistenceInput,
  ): Promise<RedrawWinnersPersistenceOutcome> {
    return this.persistRedraw(input)
  }

  async redrawConfirmedWinners(
    input: RedrawWinnersPersistenceInput,
  ): Promise<RedrawWinnersPersistenceOutcome> {
    return this.persistRedraw(input)
  }

  private async persistRedraw(
    input: RedrawWinnersPersistenceInput,
  ): Promise<RedrawWinnersPersistenceOutcome> {
    try {
      const payload = input.canonicalPayload as CanonicalDecisionPayload
      return await this.database.transaction('rw', [
        this.database.events,
        this.database.participants,
        this.database.prize_categories,
        this.database.draw_sessions,
        this.database.winner_records,
        this.database.redraw_records,
        this.database.audit_records,
        this.database.command_receipts,
      ], async (transaction) => {
        const receipt = await this.receipts.create(input.commandId, LOCAL_OPERATOR, payload, this.receipts.inTransaction(transaction))
        if (!('canonicalPayload' in receipt)) return {
          affectedWinnerIds: receipt.affectedWinnerIds,
          commandId: receipt.commandId,
          committedAt: receipt.committedAt,
          drawSessionId: receipt.drawSessionId,
          operation: input.operation,
          replacementWinnerIds: receipt.replacementWinnerIds ?? [],
          replacementTickets: receipt.replacementTickets ?? [],
          sessionStatus: receipt.sessionStatus ?? 'pending-confirmation',
          status: 'committed' as const,
        }
        if (receipt.status === 'committed') return {
          affectedWinnerIds: receipt.affectedWinnerIds,
          commandId: receipt.commandId,
          committedAt: receipt.committedAt,
          drawSessionId: receipt.drawSessionId,
          operation: input.operation,
          replacementWinnerIds: receipt.replacementWinnerIds ?? [],
          replacementTickets: receipt.replacementTickets ?? [],
          sessionStatus: receipt.sessionStatus ?? 'pending-confirmation',
          status: 'committed' as const,
        }

        const atResult = isoTimestampFromDate(new Date())
        if (!atResult.ok) throw new TransactionError('Persistence could not generate a canonical commit timestamp.')
        const at = atResult.value
        const session = await this.database.draw_sessions.get(input.drawSessionId)
        if (session === undefined) throw new RecordNotFoundError('The DrawSession required for redraw was not found.')
        if (session.mode !== 'live') throw new ImmutableRecordError('Redraw requires a Live DrawSession.')
        const expectedStatus = input.operation === 'redraw-confirmed-winners' ? 'confirmed' : 'pending'
        const expectedSessionStatus = input.operation === 'redraw-confirmed-winners' ? 'completed' : 'pending-confirmation'
        if (session.status !== expectedSessionStatus) throw new ImmutableRecordError(`Redraw requires a ${expectedSessionStatus} DrawSession.`)
        if (session.configurationSnapshot === null || session.candidatePoolSnapshot === null) throw new ImmutableRecordError('Redraw requires immutable DrawSession snapshots.')

        const winners = await this.database.winner_records.where('eventId').equals(session.eventId).toArray()
        const sessionWinners = winners.filter((winner) => winner.drawSessionId === session.id)
        const targetIds = new Set(input.targets.map((target) => target.winnerId))
        if (targetIds.size !== input.targets.length) throw new DuplicateRecordError('Redraw targets must be unique.')
        const originals = input.targets.map((target) => {
          const winner = sessionWinners.find((candidate) => candidate.id === target.winnerId)
          if (winner === undefined) throw new RecordNotFoundError('A redraw target WinnerRecord was not found.')
          if (winner.status !== expectedStatus) throw new ImmutableRecordError(`WinnerRecord status is ${winner.status}, not the expected ${expectedStatus}.`)
          if (winner.eventId !== session.eventId) throw new RelationshipMismatchError('Every redraw target must belong to the session Event.')
          return winner
        })
        const event = await this.database.events.get(session.eventId)
        if (event === undefined) throw new RecordNotFoundError('The DrawSession Event was not found.')
        const category = await this.database.prize_categories.get(session.configurationSnapshot.prizeCategoryId)
        if (category === undefined) throw new RecordNotFoundError('The DrawSession PrizeCategory was not found.')
        const participants = await this.database.participants.where('eventId').equals(session.eventId).toArray()
        const participantById = new Map(participants.map((participant) => [participant.id, participant]))
        const candidateSnapshot = session.candidatePoolSnapshot
        const snapshotParticipantIds = new Set<string>()
        const snapshotTickets = new Set<string>()
        for (const entry of candidateSnapshot.candidateEntries) {
          if (snapshotParticipantIds.has(entry.participantId) || snapshotTickets.has(entry.ticketNumber)) throw new ValidationError('The immutable candidate snapshot contains duplicate participants or tickets.')
          snapshotParticipantIds.add(entry.participantId)
          snapshotTickets.add(entry.ticketNumber)
          const participant = participantById.get(entry.participantId)
          if (participant === undefined || participant.eventId !== session.eventId || participant.ticketNumber !== entry.ticketNumber) throw new RelationshipMismatchError('An immutable candidate snapshot entry no longer matches its Participant.')
        }
        const eligible = buildRedrawCandidates(event, category, session.configurationSnapshot, candidateSnapshot, participants, winners, (await this.database.draw_sessions.where('eventId').equals(session.eventId).toArray()), originals)
        if (eligible.length < originals.length) throw new ValidationError(`Insufficient redraw capacity: ${eligible.length} eligible replacement(s) for ${originals.length} target(s).`)
        const selected = selectRedrawCandidates(eligible, originals.length, this.randomSource)
        const existingSequences = sessionWinners.map((winner) => winner.sequenceNumber)
        let nextSequence = Math.max(0, ...existingSequences) + 1
        const replacements = selected.map((entry) => ({
          id: createWinnerRecordId(),
          eventId: session.eventId,
          prizeCategoryId: session.configurationSnapshot!.prizeCategoryId,
          drawSessionId: session.id,
          participantId: entry.participantId,
          ticketNumber: entry.ticketNumber,
          sequenceNumber: nextSequence++,
          status: 'pending' as const,
          createdAt: at,
          updatedAt: at,
        }))
        const redraws = originals.map((original, index) => ({
          id: createRedrawRecordId(),
          eventId: session.eventId,
          drawSessionId: session.id,
          originalWinnerRecordId: original.id,
          replacementWinnerRecordId: replacements[index]!.id,
          reason: input.reason,
          ...(payload.note === undefined ? {} : { reasonNote: payload.note }),
          createdAt: at,
        }))
        const audits: AuditRecord[] = []
        for (const [index, original] of originals.entries()) {
          const replacement = replacements[index]!
          audits.push({ action: 'winner-cancelled', actor: { type: 'operator', name: LOCAL_OPERATOR }, detail: { afterStatus: 'cancelled', beforeStatus: original.status, commandId: input.commandId, drawSessionId: session.id, reason: input.reason, ...(payload.note === undefined ? {} : { normalizedNote: payload.note }), ticketNumber: original.ticketNumber, winnerId: original.id }, eventId: session.eventId, id: createAuditRecordId(), timestamp: at })
          audits.push({ action: 'redraw-recorded', actor: { type: 'operator', name: LOCAL_OPERATOR }, detail: { commandId: input.commandId, drawSessionId: session.id, originalWinnerId: original.id, originalTicketNumber: original.ticketNumber, replacementWinnerId: replacement.id, replacementTicketNumber: replacement.ticketNumber, reason: input.reason, ...(payload.note === undefined ? {} : { normalizedNote: payload.note }), actor: LOCAL_OPERATOR, resultingSessionStatus: 'pending-confirmation' }, eventId: session.eventId, id: createAuditRecordId(), timestamp: at })
        }

        if (session.status === 'completed') await transitionDrawSessionInTransaction(this.database, session.id, 'completed', 'pending-confirmation', at)
        for (const original of originals) await transitionWinnerInTransaction(this.database, original.id, expectedStatus, 'cancelled', at, true)
        await appendWinnerBatchInTransaction(this.database, replacements)
        for (const redraw of redraws) await appendRedrawInTransaction(this.database, redraw)
        for (const audit of audits) await appendAuditInTransaction(this.database, audit)
        const outcome = await this.receipts.finalize(input.commandId, payload, { affectedWinnerIds: originals.map((winner) => winner.id), commandId: input.commandId, committedAt: at, drawSessionId: session.id, operation: input.operation, replacementWinnerIds: replacements.map((winner) => winner.id), replacementTickets: replacements.map((winner) => winner.ticketNumber), sessionStatus: 'pending-confirmation', status: 'committed' }, this.receipts.inTransaction(transaction))
        return { ...outcome, operation: input.operation, replacementWinnerIds: replacements.map((winner) => winner.id), replacementTickets: replacements.map((winner) => winner.ticketNumber), sessionStatus: 'pending-confirmation', status: 'committed' as const }
      })
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Persisting the audited redraw replacement')
    }
  }
}
