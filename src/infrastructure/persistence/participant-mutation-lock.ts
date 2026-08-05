import type { EventId } from '../../domain/shared/identifiers.ts'
import type { RaffleOSDatabase } from './db.ts'
import { ParticipantMutationLockedError } from './errors/persistence-errors.ts'

/** The lock is derived from the official session and persisted presentation stage. */
export async function assertParticipantMutationAllowed(database: RaffleOSDatabase, eventId: EventId): Promise<void> {
  const sessions = await database.draw_sessions.where('eventId').equals(eventId).toArray()
  const active = sessions.find((session) => session.mode === 'live' && session.status === 'pending-confirmation')
  if (active === undefined) return
  const checkpoint = await database.presentation_checkpoints.get(active.id)
  if (checkpoint === undefined || checkpoint.stage !== 'pending-handoff') throw new ParticipantMutationLockedError()
}
