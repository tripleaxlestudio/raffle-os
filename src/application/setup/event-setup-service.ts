import type { EventRepository } from '../persistence/repositories/event-repository.interface.ts'
import type { PreferenceRepository } from '../persistence/repositories/preference-repository.interface.ts'
import type { PrizeCategoryRepository } from '../persistence/repositories/prize-category-repository.interface.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import { createEventId, createPrizeCategoryId, type EventId, type PrizeCategoryId } from '../../domain/shared/identifiers.ts'
import { isoTimestampFromDate, parseIsoTimestamp, type IsoTimestamp } from '../../domain/shared/timestamps.ts'

export interface EventSetupServices {
  readonly events: Pick<EventRepository, 'findById' | 'create' | 'updateDraft' | 'transitionStatus'>
  readonly categories: Pick<PrizeCategoryRepository, 'create' | 'updateDraft'>
  readonly preferences: Pick<PreferenceRepository, 'set'>
}

export interface EventDraft { readonly name: string; readonly description?: string; readonly scheduledAt?: string }
export interface CategoryDraft { readonly eventId: EventId; readonly name: string; readonly prizeName: string; readonly description?: string; readonly sponsorName?: string; readonly displayOrder: number }

function timestamp(): IsoTimestamp {
  const result = isoTimestampFromDate(new Date())
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === '' ? undefined : trimmed
}

function optionalTimestamp(value: string | undefined): IsoTimestamp | undefined {
  const trimmed = optionalText(value)
  if (trimmed === undefined) return undefined
  const result = parseIsoTimestamp(trimmed)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

export function createEventSetupService(services: EventSetupServices) {
  return {
    async createEvent(draft: EventDraft): Promise<Event> {
      const now = timestamp()
      const event: Event = { id: createEventId(), name: draft.name.trim(), description: optionalText(draft.description), scheduledAt: optionalTimestamp(draft.scheduledAt), status: 'draft', createdAt: now, updatedAt: now }
      await services.events.create(event)
      return event
    },
    async updateEvent(event: Event, draft: EventDraft): Promise<Event> {
      const updated: Event = { ...event, name: draft.name.trim(), description: optionalText(draft.description), scheduledAt: optionalTimestamp(draft.scheduledAt), updatedAt: timestamp() }
      await services.events.updateDraft(updated)
      return updated
    },
    async activateEvent(eventId: EventId): Promise<Event> {
      const event = await services.events.findById(eventId)
      if (event === null) throw new Error('The Event to activate no longer exists.')
      const at = timestamp()
      await services.events.transitionStatus(event.id, event.status, 'ready', at)
      const activated = await services.events.findById(event.id)
      if (activated === null) throw new Error('The activated Event could not be read back.')
      return activated
    },
    async selectEvent(eventId: EventId): Promise<void> {
      const event = await services.events.findById(eventId)
      if (event === null) throw new Error('The selected Event no longer exists.')
      await services.preferences.set('activeEventId', eventId, timestamp())
    },
    async createCategory(draft: CategoryDraft): Promise<PrizeCategory> {
      const category: PrizeCategory = { id: createPrizeCategoryId(), eventId: draft.eventId, name: draft.name.trim(), prizeName: draft.prizeName.trim(), description: optionalText(draft.description), sponsorName: optionalText(draft.sponsorName), displayOrder: draft.displayOrder, createdAt: timestamp() }
      await services.categories.create(category)
      return category
    },
    async updateCategory(category: PrizeCategory, draft: Omit<CategoryDraft, 'eventId'>): Promise<PrizeCategory> {
      const updated: PrizeCategory = { ...category, name: draft.name.trim(), prizeName: draft.prizeName.trim(), description: optionalText(draft.description), sponsorName: optionalText(draft.sponsorName), displayOrder: draft.displayOrder }
      await services.categories.updateDraft(updated)
      return updated
    },
  }
}

export type EventSetupService = ReturnType<typeof createEventSetupService>
export type { PrizeCategoryId }
