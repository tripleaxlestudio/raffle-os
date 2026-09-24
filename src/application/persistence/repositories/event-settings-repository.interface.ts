import type { EventSettings } from '../../../domain/settings/event-settings.types.ts'
import type { EventId } from '../../../domain/shared/identifiers.ts'
export interface EventSettingsRepository { findByEventId(eventId: EventId): Promise<EventSettings | null>; save(settings: EventSettings): Promise<void>; deleteForEvent(eventId: EventId): Promise<void> }
