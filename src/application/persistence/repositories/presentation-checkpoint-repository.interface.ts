import type { DrawSessionId } from '../../../domain/shared/identifiers.ts'
import type { PresentationCheckpointRecord } from '../../../domain/workflow/presentation-checkpoint.types.ts'

export interface PresentationCheckpointRepository {
  findByDrawSessionId(drawSessionId: DrawSessionId): Promise<PresentationCheckpointRecord | null>
  upsert(checkpoint: PresentationCheckpointRecord): Promise<void>
  deleteByDrawSessionId(drawSessionId: DrawSessionId): Promise<void>
}
