import { describe, expect, it } from 'vitest'
import type { Event } from '../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import { parseEventId, type EventId } from '../../domain/shared/identifiers.ts'
import { createEventSetupService, type EventSetupServices } from './event-setup-service.ts'

function makeServices(): EventSetupServices & { eventsCreated: Event[]; categoriesCreated: PrizeCategory[]; readonly selected: EventId | null } {
  const eventsCreated: Event[] = []
  const categoriesCreated: PrizeCategory[] = []
  let selected: EventId | null = null
  return {
    eventsCreated,
    categoriesCreated,
    get selected() { return selected },
    events: { findById: async (id) => eventsCreated.find((event) => event.id === id) ?? null, create: async (event) => { eventsCreated.push(event) }, updateDraft: async (event) => { eventsCreated.splice(0, 1, event) } },
    categories: { create: async (category) => { categoriesCreated.push(category) }, updateDraft: async (category) => { categoriesCreated.splice(0, 1, category) } },
    preferences: { set: async (key, value, at) => { void at; if (key === 'activeEventId') { if (value === null) selected = null; else { const parsed = parseEventId(value); if (parsed.ok) selected = parsed.value } } } },
  }
}

describe('event setup service', () => {
  it('creates a draft Event with canonical timestamps and trimmed fields', async () => {
    const services = makeServices()
    const event = await createEventSetupService(services).createEvent({ name: '  Annual Raffle  ', description: '  Local event  ' })
    expect(event.name).toBe('Annual Raffle')
    expect(event.description).toBe('Local event')
    expect(event.status).toBe('draft')
    expect(event.createdAt).toBe(event.updatedAt)
    expect(services.eventsCreated).toHaveLength(1)
  })

  it('selects only an existing Event through the preference boundary', async () => {
    const services = makeServices()
    const event = await createEventSetupService(services).createEvent({ name: 'Event' })
    await createEventSetupService(services).selectEvent(event.id)
    expect(services.selected).toBe(event.id)
  })

  it('creates a PrizeCategory with exact Event ownership', async () => {
    const services = makeServices()
    const event = await createEventSetupService(services).createEvent({ name: 'Event' })
    const category = await createEventSetupService(services).createCategory({ eventId: event.id, name: '  Grand Prize ', prizeName: 'Travel voucher', displayOrder: 2 })
    expect(category.eventId).toBe(event.id)
    expect(category.name).toBe('Grand Prize')
    expect(services.categoriesCreated).toHaveLength(1)
  })
})
