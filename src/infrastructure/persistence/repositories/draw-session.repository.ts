import type { DrawSessionRepository } from '../../../application/persistence/repositories/draw-session-repository.interface.ts'
import {
  attachSnapshotsAndStartDrawing,
  transitionDrawSessionStatus,
  validateDrawSession,
  validateDrawStartSnapshots,
} from '../../../domain/draws/draw.invariants.ts'
import type {
  DrawSession,
  DrawSessionStatus,
  DrawStartSnapshots,
} from '../../../domain/draws/draw-session.types.ts'
import type {
  DrawSessionId,
  EventId,
} from '../../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type { AppMode } from '../../../domain/types/app-mode.ts'
import type { RaffleOSDatabase } from '../db.ts'
import {
  ImmutableRecordError,
  RecordNotFoundError,
  RelationshipMismatchError,
  ValidationError,
} from '../errors/persistence-errors.ts'
import {
  normalizeRepositoryError,
  requireValid,
} from './repository-helpers.ts'

function assertConfigurationSnapshotMatchesSource(
  snapshots: DrawStartSnapshots,
  source: {
    readonly id: string
    readonly prizeCategoryId: string
    readonly requestedWinners: number
    readonly winningRule: string
    readonly requireCheckIn: boolean
    readonly eligibleGroupFilter: string | null
  },
  category: {
    readonly id: string
    readonly name: string
    readonly prizeName: string
  },
): void {
  const snapshot = snapshots.configurationSnapshot

  if (
    snapshot.configurationId !== source.id ||
    snapshot.prizeCategoryId !== source.prizeCategoryId ||
    snapshot.prizeCategoryId !== category.id ||
    snapshot.categoryName !== category.name ||
    snapshot.prizeName !== category.prizeName ||
    snapshot.requestedWinners !== source.requestedWinners ||
    snapshot.winningRule !== source.winningRule ||
    snapshot.requireCheckIn !== source.requireCheckIn ||
    snapshot.eligibleGroupFilter !== source.eligibleGroupFilter
  ) {
    throw new RelationshipMismatchError(
      'The configuration snapshot must exactly match its source DrawConfiguration and PrizeCategory.',
    )
  }
}

export async function attachDrawSessionSnapshotsInTransaction(
  database: RaffleOSDatabase,
  id: DrawSessionId,
  expectedStatus: 'ready',
  snapshots: DrawStartSnapshots,
  at: IsoTimestamp,
): Promise<DrawSession> {
  if (
    snapshots.configurationSnapshot === null ||
    typeof snapshots.configurationSnapshot !== 'object' ||
    snapshots.candidatePoolSnapshot === null ||
    typeof snapshots.candidatePoolSnapshot !== 'object' ||
    !Array.isArray(
      snapshots.candidatePoolSnapshot.candidateEntries,
    )
  ) {
    throw new ValidationError(
      'Both complete DrawSession snapshots are required.',
    )
  }
  requireValid(validateDrawStartSnapshots(snapshots))

  const session = await database.draw_sessions.get(id)
  if (session === undefined) {
    throw new RecordNotFoundError(
      'The DrawSession required for snapshot attachment was not found.',
    )
  }

  requireValid(validateDrawSession(session))

  if (session.status !== expectedStatus) {
    throw new ImmutableRecordError(
      `DrawSession status is ${session.status}, not the expected ${expectedStatus}.`,
    )
  }

  if (
    session.configurationSnapshot !== null ||
    session.candidatePoolSnapshot !== null
  ) {
    throw new ImmutableRecordError(
      'DrawSession snapshots have already been attached and cannot be replaced.',
    )
  }

  const [event, configuration] = await Promise.all([
    database.events.get(session.eventId),
    database.draw_configurations.get(session.configurationId),
  ])
  if (event === undefined) {
    throw new RelationshipMismatchError(
      'The DrawSession parent Event was not found.',
    )
  }
  if (
    configuration === undefined ||
    configuration.eventId !== session.eventId
  ) {
    throw new RelationshipMismatchError(
      'The DrawSession source DrawConfiguration must exist in the same Event.',
    )
  }

  const category = await database.prize_categories.get(
    configuration.prizeCategoryId,
  )
  if (
    category === undefined ||
    category.eventId !== session.eventId
  ) {
    throw new RelationshipMismatchError(
      'The DrawSession source PrizeCategory must exist in the same Event.',
    )
  }

  assertConfigurationSnapshotMatchesSource(
    snapshots,
    configuration,
    category,
  )

  const candidateSnapshot = snapshots.candidatePoolSnapshot
  if (
    candidateSnapshot.eventId !== session.eventId ||
    candidateSnapshot.configurationId !== configuration.id ||
    candidateSnapshot.prizeCategoryId !== configuration.prizeCategoryId ||
    candidateSnapshot.mode !== session.mode ||
    candidateSnapshot.winningRule !== configuration.winningRule ||
    candidateSnapshot.requireCheckIn !== configuration.requireCheckIn ||
    candidateSnapshot.eligibleGroupFilter !== configuration.eligibleGroupFilter
  ) {
    throw new RelationshipMismatchError(
      'The candidate snapshot must exactly match the DrawSession Event, mode, configuration, category, and rules.',
    )
  }

  const entries = snapshots.candidatePoolSnapshot.candidateEntries
  const participants = await database.participants.bulkGet(
    entries.map((entry) => entry.participantId),
  )

  for (const [index, entry] of entries.entries()) {
    const participant = participants[index]
    if (
      participant === undefined ||
      participant.eventId !== session.eventId ||
      participant.ticketNumber !== entry.ticketNumber
    ) {
      throw new RelationshipMismatchError(
        'Every candidate snapshot entry must match an existing Participant in the DrawSession Event.',
      )
    }
  }

  const transition = attachSnapshotsAndStartDrawing(
    session,
    snapshots,
    at,
  )
  const updated = requireValid(transition)
  requireValid(validateDrawSession(updated))
  await database.draw_sessions.put(updated)
  return updated
}

export async function transitionDrawSessionInTransaction(
  database: RaffleOSDatabase,
  id: DrawSessionId,
  from: DrawSessionStatus,
  to: DrawSessionStatus,
  at: IsoTimestamp,
): Promise<DrawSession> {
  const current = await database.draw_sessions.get(id)
  if (current === undefined) {
    throw new RecordNotFoundError(
      'The DrawSession required for a status transition was not found.',
    )
  }

  requireValid(validateDrawSession(current))

  if (current.status !== from) {
    throw new ImmutableRecordError(
      `DrawSession status is ${current.status}, not the expected ${from}.`,
    )
  }

  if (to === 'drawing') {
    throw new ImmutableRecordError(
      'The drawing transition is available only while atomically attaching immutable snapshots.',
    )
  }

  const updated = requireValid(
    transitionDrawSessionStatus(current, to, at),
  )
  requireValid(validateDrawSession(updated))
  await database.draw_sessions.put(updated)
  return updated
}

export class DexieDrawSessionRepository
  implements DrawSessionRepository
{
  private readonly database: RaffleOSDatabase

  constructor(database: RaffleOSDatabase) {
    this.database = database
  }

  async findById(id: DrawSessionId): Promise<DrawSession | null> {
    try {
      return (await this.database.draw_sessions.get(id)) ?? null
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Finding the DrawSession')
    }
  }

  async findByEventId(eventId: EventId): Promise<DrawSession[]> {
    try {
      const sessions = await this.database.draw_sessions
        .where('eventId')
        .equals(eventId)
        .toArray()
      return sessions.sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Listing Event DrawSessions')
    }
  }

  async findLatestByEventId(
    eventId: EventId,
    mode?: AppMode,
  ): Promise<DrawSession | null> {
    try {
      const sessions = await this.database.draw_sessions
        .where('eventId')
        .equals(eventId)
        .toArray()
      const matching =
        mode === undefined
          ? sessions
          : sessions.filter((session) => session.mode === mode)

      matching.sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) ||
          left.id.localeCompare(right.id),
      )
      return matching[0] ?? null
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Finding the latest Event DrawSession',
      )
    }
  }

  async createDraft(session: DrawSession): Promise<void> {
    try {
      requireValid(validateDrawSession(session))

      if (
        session.status !== 'draft' ||
        session.configurationSnapshot !== null ||
        session.candidatePoolSnapshot !== null ||
        session.completedAt !== undefined
      ) {
        throw new ValidationError(
          'A new DrawSession must be a snapshot-free draft without a completion timestamp.',
        )
      }

      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.draw_configurations,
          this.database.draw_sessions,
        ],
        async () => {
          const [event, configuration] = await Promise.all([
            this.database.events.get(session.eventId),
            this.database.draw_configurations.get(
              session.configurationId,
            ),
          ])
          if (event === undefined) {
            throw new RelationshipMismatchError(
              'The parent Event for the DrawSession was not found.',
            )
          }
          if (
            configuration === undefined ||
            configuration.eventId !== session.eventId
          ) {
            throw new RelationshipMismatchError(
              'The DrawSession DrawConfiguration must exist in the same Event.',
            )
          }

          await this.database.draw_sessions.add(session)
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Creating the draft DrawSession',
      )
    }
  }

  async attachSnapshotsAndTransitionToDrawing(
    id: DrawSessionId,
    expectedStatus: 'ready',
    snapshots: DrawStartSnapshots,
    at: IsoTimestamp,
  ): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.participants,
          this.database.prize_categories,
          this.database.draw_configurations,
          this.database.draw_sessions,
        ],
        async () => {
          await attachDrawSessionSnapshotsInTransaction(
            this.database,
            id,
            expectedStatus,
            snapshots,
            at,
          )
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Attaching DrawSession snapshots',
      )
    }
  }

  async transitionStatus(
    id: DrawSessionId,
    from: DrawSessionStatus,
    to: DrawSessionStatus,
    at: IsoTimestamp,
  ): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        this.database.draw_sessions,
        async () => {
          await transitionDrawSessionInTransaction(
            this.database,
            id,
            from,
            to,
            at,
          )
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Transitioning DrawSession status',
      )
    }
  }
}
