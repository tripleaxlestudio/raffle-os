import type { RedrawRepository } from '../../../application/persistence/repositories/redraw-repository.interface.ts'
import type {
  DrawSessionId,
  WinnerRecordId,
} from '../../../domain/shared/identifiers.ts'
import type {
  RedrawReason,
  RedrawRecord,
} from '../../../domain/winners/redraw.types.ts'
import { validateRedrawRelationship } from '../../../domain/winners/winner.invariants.ts'
import type { RaffleOSDatabase } from '../db.ts'
import {
  DuplicateRecordError,
  RecordNotFoundError,
  RelationshipMismatchError,
  ValidationError,
} from '../errors/persistence-errors.ts'
import {
  normalizeRepositoryError,
  requireValid,
} from './repository-helpers.ts'

const REDRAW_REASONS: ReadonlySet<RedrawReason> = new Set([
  'absent',
  'invalid-ticket',
  'ineligible',
  'previous-winner',
  'operator-error',
  'other',
])

export async function appendRedrawInTransaction(
  database: RaffleOSDatabase,
  redraw: RedrawRecord,
): Promise<void> {
  if (!REDRAW_REASONS.has(redraw.reason)) {
    throw new ValidationError('The RedrawRecord reason is invalid.')
  }

  const [session, original, replacement, existing] =
    await Promise.all([
      database.draw_sessions.get(redraw.drawSessionId),
      database.winner_records.get(redraw.originalWinnerRecordId),
      database.winner_records.get(redraw.replacementWinnerRecordId),
      database.redraw_records
        .where('originalWinnerRecordId')
        .equals(redraw.originalWinnerRecordId)
        .first(),
    ])

  if (session === undefined) {
    throw new RecordNotFoundError(
      'The DrawSession required for the RedrawRecord was not found.',
    )
  }
  if (original === undefined || replacement === undefined) {
    throw new RecordNotFoundError(
      'Both WinnerRecords required for the RedrawRecord must exist.',
    )
  }
  if (
    session.id !== original.drawSessionId ||
    session.id !== replacement.drawSessionId ||
    session.eventId !== redraw.eventId ||
    original.prizeCategoryId !== replacement.prizeCategoryId
  ) {
    throw new RelationshipMismatchError(
      'The RedrawRecord and both WinnerRecords must share one DrawSession, Event, and PrizeCategory.',
    )
  }
  if (existing !== undefined) {
    throw new DuplicateRecordError(
      'The original WinnerRecord already has a direct RedrawRecord.',
    )
  }

  requireValid(
    validateRedrawRelationship(redraw, original, replacement),
  )
  await database.redraw_records.add(redraw)
}

export class DexieRedrawRepository implements RedrawRepository {
  private readonly database: RaffleOSDatabase

  constructor(database: RaffleOSDatabase) {
    this.database = database
  }

  async findByDrawSessionId(
    drawSessionId: DrawSessionId,
  ): Promise<RedrawRecord[]> {
    try {
      const redraws = await this.database.redraw_records
        .where('drawSessionId')
        .equals(drawSessionId)
        .toArray()
      return redraws.sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.id.localeCompare(right.id),
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Listing DrawSession RedrawRecords',
      )
    }
  }

  async findByOriginalWinnerId(
    winnerId: WinnerRecordId,
  ): Promise<RedrawRecord | null> {
    try {
      const redraw = await this.database.redraw_records
        .where('originalWinnerRecordId')
        .equals(winnerId)
        .first()
      return redraw ?? null
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Finding the original WinnerRecord RedrawRecord',
      )
    }
  }

  async append(redraw: RedrawRecord): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        [
          this.database.draw_sessions,
          this.database.winner_records,
          this.database.redraw_records,
        ],
        async () => {
          await appendRedrawInTransaction(this.database, redraw)
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Appending the RedrawRecord',
      )
    }
  }
}
