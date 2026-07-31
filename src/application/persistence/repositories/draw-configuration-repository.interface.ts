import type { DrawConfiguration } from '../../../domain/draws/draw-configuration.types.ts'
import type {
  DrawConfigurationId,
  EventId,
} from '../../../domain/shared/identifiers.ts'

export interface DrawConfigurationRepository {
  findById(
    id: DrawConfigurationId,
  ): Promise<DrawConfiguration | null>
  /** Returns configurations ordered by createdAt, then id. */
  findByEventId(eventId: EventId): Promise<DrawConfiguration[]>
  createDraft(configuration: DrawConfiguration): Promise<void>
  updateDraft(configuration: DrawConfiguration): Promise<void>
  deleteUnused(id: DrawConfigurationId): Promise<void>
}
