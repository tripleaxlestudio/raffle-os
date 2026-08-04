import type { ParticipantImportUnitOfWork, ParticipantImportTransactionInput, ParticipantImportTransactionResult } from '../../../application/persistence/participant-import-unit-of-work.interface.ts'
import { canHardDeleteEvent } from '../../../domain/events/event.invariants.ts'
import { validateParticipant } from '../../../domain/participants/participant.invariants.ts'
import type { RaffleOSDatabase } from '../db.ts'
import { appendAuditInTransaction } from '../repositories/audit.repository.ts'
import { normalizeRepositoryError } from '../repositories/repository-helpers.ts'
import { DuplicateRecordError, ImmutableRecordError, RecordNotFoundError, RelationshipMismatchError, ValidationError } from '../errors/persistence-errors.ts'

const OFFICIAL_AUDIT_ACTIONS = new Set([
  'draw-session-started', 'draw-session-completed', 'draw-session-cancelled',
  'winner-confirmed', 'winner-cancelled', 'redraw-recorded',
])

function validateInput(input: ParticipantImportTransactionInput): void {
  if (input.participants.length === 0) throw new ValidationError('A Participant import must contain at least one record.')
  const ids = new Set<string>()
  const tickets = new Set<string>()
  for (const participant of input.participants) {
    const validation = validateParticipant(participant)
    if (!validation.ok) throw new ValidationError(validation.error.message, { cause: validation.error })
    if (participant.eventId !== input.eventId) throw new RelationshipMismatchError('Every imported Participant must belong to the selected Event.')
    if (ids.has(participant.id)) throw new DuplicateRecordError('Imported Participant IDs must be unique.')
    if (tickets.has(participant.ticketNumber)) throw new DuplicateRecordError('Imported Ticket Numbers must be unique.')
    ids.add(participant.id)
    tickets.add(participant.ticketNumber)
  }
  if (input.auditRecord.eventId !== input.eventId) throw new RelationshipMismatchError('The import AuditRecord must belong to the selected Event.')
}

export class DexieParticipantImportUnitOfWork implements ParticipantImportUnitOfWork {
  private readonly database: RaffleOSDatabase

  constructor(database: RaffleOSDatabase) {
    this.database = database
  }

  async commitParticipantImport(input: ParticipantImportTransactionInput): Promise<ParticipantImportTransactionResult> {
    try {
      validateInput(input)
      let result: ParticipantImportTransactionResult = { removedCount: 0, unchangedCount: 0 }
      await this.database.transaction('rw', [this.database.events, this.database.participants, this.database.draw_sessions, this.database.winner_records, this.database.redraw_records, this.database.audit_records], async () => {
        const event = await this.database.events.get(input.eventId)
        if (event === undefined) throw new RecordNotFoundError('The Event required for participant import was not found.')
        const [drawSession, winnerRecord, redrawRecord, officialAudit] = await Promise.all([
          this.database.draw_sessions.where('eventId').equals(input.eventId).first(),
          this.database.winner_records.where('eventId').equals(input.eventId).first(),
          this.database.redraw_records.where('eventId').equals(input.eventId).first(),
          this.database.audit_records.where('eventId').equals(input.eventId).filter((record) => OFFICIAL_AUDIT_ACTIONS.has(record.action)).first(),
        ])
        if (!canHardDeleteEvent(event, drawSession !== undefined || winnerRecord !== undefined || redrawRecord !== undefined || officialAudit !== undefined)) {
          throw new ImmutableRecordError('Participants can be imported only into an unreferenced draft Event.')
        }
        const existing = await this.database.participants.where('eventId').equals(input.eventId).toArray()
        const existingTickets = new Set(existing.map((participant) => participant.ticketNumber))
        if (input.strategy === 'merge') {
          const conflict = input.participants.find((participant) => existingTickets.has(participant.ticketNumber))
          if (conflict !== undefined) throw new DuplicateRecordError(`Ticket Number ${conflict.ticketNumber} already exists in this Event.`)
          result = { removedCount: 0, unchangedCount: existing.length }
        } else {
          result = { removedCount: existing.length, unchangedCount: 0 }
          await this.database.participants.where('eventId').equals(input.eventId).delete()
        }
        await this.database.participants.bulkAdd([...input.participants])
        await appendAuditInTransaction(this.database, input.auditRecord)
      })
      return result
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Committing the participant import')
    }
  }
}
