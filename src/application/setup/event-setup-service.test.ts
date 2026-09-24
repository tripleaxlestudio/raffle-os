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
    events: { findById: async (id) => eventsCreated.find((event) => event.id === id) ?? null, create: async (event) => { eventsCreated.push(event) }, updateDraft: async (event) => { eventsCreated.splice(0, 1, event) }, transitionStatus: async (id, from, to, at) => { const index = eventsCreated.findIndex((event) => event.id === id); const current = eventsCreated[index]; if (current === undefined || current.status !== from) throw new Error('stale Event'); eventsCreated[index] = { ...current, status: to, updatedAt: at } } },
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

  it('activates a draft Event through the supported draft-to-ready transition', async () => {
    const services = makeServices()
    const event = await createEventSetupService(services).createEvent({ name: 'Event' })

    const activated = await createEventSetupService(services).activateEvent(event.id)

    expect(activated.status).toBe('ready')
    expect(services.eventsCreated[0].status).toBe('ready')
    expect(activated.id).toBe(event.id)
  })

  it('activates only the requested Event', async () => {
    const services = makeServices()
    const first = await createEventSetupService(services).createEvent({ name: 'First Event' })
    const second = await createEventSetupService(services).createEvent({ name: 'Second Event' })

    await createEventSetupService(services).activateEvent(first.id)

    expect(services.eventsCreated.find((candidate) => candidate.id === first.id)?.status).toBe('ready')
    expect(services.eventsCreated.find((candidate) => candidate.id === second.id)?.status).toBe('draft')
  })

  it('creates a PrizeCategory with exact Event ownership and optional prizeImageAssetId', async () => {
    const services = makeServices()
    const event = await createEventSetupService(services).createEvent({ name: 'Event' })
    const category = await createEventSetupService(services).createCategory({
      eventId: event.id,
      name: '  Grand Prize ',
      prizeName: 'Travel voucher',
      displayOrder: 2,
      prizeImageAssetId: 'asset-12345',
    })
    expect(category.eventId).toBe(event.id)
    expect(category.name).toBe('Grand Prize')
    expect(category.prizeImageAssetId).toBe('asset-12345')
    expect(services.categoriesCreated).toHaveLength(1)

    const updated = await createEventSetupService(services).updateCategory(category, {
      name: 'Updated Grand Prize',
      prizeName: 'Car',
      displayOrder: 1,
      prizeImageAssetId: 'asset-67890',
    })
    expect(updated.name).toBe('Updated Grand Prize')
    expect(updated.prizeImageAssetId).toBe('asset-67890')
  })
})
