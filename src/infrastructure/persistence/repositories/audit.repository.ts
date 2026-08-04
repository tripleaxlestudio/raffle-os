import type { AuditRepository } from '../../../application/persistence/repositories/audit-repository.interface.ts'
import {
  isStructuredCloneSafeAuditDetail,
  type AuditAction,
  type AuditRecord,
} from '../../../domain/audit/audit.types.ts'
import type { EventId } from '../../../domain/shared/identifiers.ts'
import { isIsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type { RaffleOSDatabase } from '../db.ts'
import {
  RelationshipMismatchError,
  ValidationError,
} from '../errors/persistence-errors.ts'
import { normalizeRepositoryError } from './repository-helpers.ts'

const AUDIT_ACTIONS: ReadonlySet<AuditAction> = new Set([
  'event-created',
  'event-status-changed',
  'draw-session-started',
  'draw-session-completed',
  'draw-session-cancelled',
  'winner-confirmed',
  'winner-cancelled',
  'redraw-recorded',
  'participant-import-committed',
])

function validateAuditRecord(audit: AuditRecord): void {
  if (!AUDIT_ACTIONS.has(audit.action)) {
    throw new ValidationError('The AuditRecord action is invalid.')
  }
  if (!isIsoTimestamp(audit.timestamp)) {
    throw new ValidationError(
      'The AuditRecord timestamp must be a valid ISO UTC value.',
    )
  }
  const actor: unknown = audit.actor
  if (
    typeof actor !== 'object' ||
    actor === null ||
    !('type' in actor) ||
    (actor.type !== 'operator' && actor.type !== 'system')
  ) {
    throw new ValidationError('The AuditRecord actor is invalid.')
  }
  if (
    actor.type === 'operator' &&
    (!('name' in actor) ||
      typeof actor.name !== 'string' ||
      actor.name.trim().length === 0)
  ) {
    throw new ValidationError(
      'An operator AuditRecord requires a non-empty actor name.',
    )
  }
  if (!isStructuredCloneSafeAuditDetail(audit.detail)) {
    throw new ValidationError(
      'The AuditRecord detail must be structured-clone safe.',
    )
  }
}

export async function appendAuditInTransaction(
  database: RaffleOSDatabase,
  audit: AuditRecord,
): Promise<void> {
  validateAuditRecord(audit)
  const event = await database.events.get(audit.eventId)
  if (event === undefined) {
    throw new RelationshipMismatchError(
      'The parent Event for the AuditRecord was not found.',
    )
  }
  await database.audit_records.add(audit)
}

export class DexieAuditRepository implements AuditRepository {
  private readonly database: RaffleOSDatabase

  constructor(database: RaffleOSDatabase) {
    this.database = database
  }

  async findByEventId(eventId: EventId): Promise<AuditRecord[]> {
    try {
      const audits = await this.database.audit_records
        .where('[eventId+timestamp]')
        .between(
          [eventId, DexieAuditRepository.MIN_TIMESTAMP],
          [eventId, DexieAuditRepository.MAX_TIMESTAMP],
          true,
          true,
        )
        .toArray()
      return audits.sort(
        (left, right) =>
          left.timestamp.localeCompare(right.timestamp) ||
          left.id.localeCompare(right.id),
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Listing Event AuditRecords',
      )
    }
  }

  async append(audit: AuditRecord): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        [this.database.events, this.database.audit_records],
        async () => {
          await appendAuditInTransaction(this.database, audit)
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Appending the AuditRecord',
      )
    }
  }

  private static readonly MIN_TIMESTAMP = ''
  private static readonly MAX_TIMESTAMP = '\uffff'
}
