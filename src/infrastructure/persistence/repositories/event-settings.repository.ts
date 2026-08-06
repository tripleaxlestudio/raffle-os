import type { EventSettingsRepository } from '../../../application/persistence/repositories/event-settings-repository.interface.ts'
import type { EventSettings } from '../../../domain/settings/event-settings.types.ts'
import type { EventId } from '../../../domain/shared/identifiers.ts'
import type { RaffleOSDatabase } from '../db.ts'
import { normalizeRepositoryError } from './repository-helpers.ts'
export class DexieEventSettingsRepository implements EventSettingsRepository {
  private readonly database: RaffleOSDatabase
  constructor(database: RaffleOSDatabase) { this.database = database }
  async findByEventId(eventId: EventId): Promise<EventSettings | null> { try { return (await this.database.event_settings.get(eventId)) ?? null } catch (error: unknown) { throw normalizeRepositoryError(error, 'Reading Event settings') } }
  async save(settings: EventSettings): Promise<void> { try { await this.database.event_settings.put(settings) } catch (error: unknown) { throw normalizeRepositoryError(error, 'Saving Event settings') } }
  async deleteForEvent(eventId: EventId): Promise<void> { try { await this.database.event_settings.delete(eventId) } catch (error: unknown) { throw normalizeRepositoryError(error, 'Deleting Event settings') } }
}
