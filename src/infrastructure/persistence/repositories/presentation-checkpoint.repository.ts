import type { PresentationCheckpointRepository } from '../../../application/persistence/repositories/presentation-checkpoint-repository.interface.ts'
import type { DrawSession } from '../../../domain/draws/draw-session.types.ts'
import type { DrawSessionId } from '../../../domain/shared/identifiers.ts'
import type { PresentationCheckpointRecord } from '../../../domain/workflow/presentation-checkpoint.types.ts'
import { validatePresentationCheckpoint } from '../../../domain/workflow/presentation-checkpoint.validation.ts'
import { PresentationCheckpointValidationError } from '../../../domain/workflow/presentation-checkpoint.validation.ts'
import type { RaffleOSDatabase } from '../db.ts'
import { CheckpointDeleteError, CheckpointReadError, CheckpointWriteError, InvalidCheckpointError, RelationshipMismatchError, StaleCheckpointError, UnsupportedCheckpointVersionError } from '../errors/persistence-errors.ts'

async function requireLiveSession(database: RaffleOSDatabase, id: DrawSessionId): Promise<DrawSession> {
  const session = await database.draw_sessions.get(id)
  if (session === undefined) throw new RelationshipMismatchError('The DrawSession for a presentation checkpoint was not found.')
  if (session.mode !== 'live') throw new RelationshipMismatchError('Presentation checkpoints are only valid for Live DrawSessions.')
  return session
}

export class DexiePresentationCheckpointRepository implements PresentationCheckpointRepository {
  private readonly database: RaffleOSDatabase
  constructor(database: RaffleOSDatabase) { this.database = database }

  async findByDrawSessionId(drawSessionId: DrawSessionId): Promise<PresentationCheckpointRecord | null> {
    try {
      const stored = await this.database.presentation_checkpoints.get(drawSessionId)
      if (stored === undefined) return null
      const checkpoint = validatePresentationCheckpoint(stored)
      if (checkpoint.drawSessionId !== drawSessionId) throw new StaleCheckpointError()
      await requireLiveSession(this.database, drawSessionId)
      return checkpoint
    } catch (error: unknown) {
      if (error instanceof RelationshipMismatchError) throw error
      if (error instanceof StaleCheckpointError) throw error
      if (error instanceof PresentationCheckpointValidationError) throw error.kind === 'unsupported' ? new UnsupportedCheckpointVersionError(undefined, { cause: error }) : new InvalidCheckpointError(undefined, { cause: error })
      throw new CheckpointReadError('Reading the presentation checkpoint failed.', { cause: error })
    }
  }

  async upsert(checkpoint: PresentationCheckpointRecord): Promise<void> {
    try {
      const valid = validatePresentationCheckpoint(checkpoint)
      if (valid.drawSessionId !== checkpoint.drawSessionId) throw new StaleCheckpointError()
      await this.database.transaction('rw', [this.database.draw_sessions, this.database.presentation_checkpoints], async () => {
        await requireLiveSession(this.database, checkpoint.drawSessionId)
        await this.database.presentation_checkpoints.put(valid)
      })
    } catch (error: unknown) {
      if (error instanceof RelationshipMismatchError || error instanceof StaleCheckpointError) throw error
      if (error instanceof PresentationCheckpointValidationError) throw error.kind === 'unsupported' ? new UnsupportedCheckpointVersionError(undefined, { cause: error }) : new InvalidCheckpointError(undefined, { cause: error })
      throw new CheckpointWriteError('Writing the presentation checkpoint failed.', { cause: error })
    }
  }

  async deleteByDrawSessionId(drawSessionId: DrawSessionId): Promise<void> {
    try {
      await this.database.presentation_checkpoints.delete(drawSessionId)
    } catch (error: unknown) {
      throw new CheckpointDeleteError('Deleting the presentation checkpoint failed.', { cause: error })
    }
  }
}
