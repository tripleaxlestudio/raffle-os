import type { DisplayConfiguration } from '../../../domain/display/display-configuration.types.ts'
import type { EventId } from '../../../domain/shared/identifiers.ts'

export interface DisplayConfigurationRepository {
  findByEventId(
    eventId: EventId,
  ): Promise<DisplayConfiguration | null>
  create(configuration: DisplayConfiguration): Promise<void>
  updateForEvent(configuration: DisplayConfiguration): Promise<void>
}
