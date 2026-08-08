import { describe, expect, it } from 'vitest'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import { createDisplayConfigurationId, createEventId } from '../../domain/shared/identifiers.ts'
import { createDisplayConfigurationService } from './display-configuration-service.ts'

const at = '2026-08-08T00:00:00.000Z' as Event['createdAt']

function event(): Event {
  return { id: createEventId(), name: 'New Event', status: 'draft', createdAt: at, updatedAt: at }
}

function dependencies(records: DisplayConfiguration[] = []) {
  const events = new Map<string, Event>()
  const configurations = new Map(records.map((record) => [record.eventId, record]))
  return {
    events: { findById: async (id: Event['id']) => events.get(id) ?? null },
    configurations: {
      findByEventId: async (id: Event['id']) => configurations.get(id) ?? null,
      create: async (configuration: DisplayConfiguration) => { configurations.set(configuration.eventId, configuration) },
      updateForEvent: async (configuration: DisplayConfiguration) => { configurations.set(configuration.eventId, configuration) },
    },
    eventsStore: events,
    configurationsStore: configurations,
  }
}

describe('display configuration service', () => {
  it('creates valid default display configuration for a new Event', async () => {
    const currentEvent = event()
    const services = dependencies()
    services.eventsStore.set(currentEvent.id, currentEvent)
    const service = createDisplayConfigurationService(services)

    expect(await service.readForEvent(currentEvent)).toBeNull()
    const saved = await service.saveForEvent(currentEvent, { targetResolution: { width: 1920, height: 1080 }, safeAreaMargin: 0, blackoutAppearance: 'pure-black' })

    expect(saved.eventId).toBe(currentEvent.id)
    expect(saved.targetResolution).toEqual({ width: 1920, height: 1080 })
    expect(await service.readForEvent(currentEvent)).toEqual(saved)
  })

  it('updates only the existing configuration owned by the selected Event', async () => {
    const first = event()
    const second = event()
    const firstConfiguration: DisplayConfiguration = { id: createDisplayConfigurationId(), eventId: first.id, targetResolution: { width: 1920, height: 1080 }, safeAreaMargin: 0, blackoutAppearance: 'pure-black', createdAt: at, updatedAt: at }
    const services = dependencies([firstConfiguration])
    services.eventsStore.set(first.id, first)
    services.eventsStore.set(second.id, second)
    const service = createDisplayConfigurationService(services)

    const updated = await service.saveForEvent(first, { targetResolution: { width: 1280, height: 720 }, safeAreaMargin: 12, blackoutAppearance: 'pure-black' }, firstConfiguration)
    expect(updated.id).toBe(firstConfiguration.id)
    expect(await service.readForEvent(second)).toBeNull()
    expect(services.configurationsStore.get(first.id)?.targetResolution).toEqual({ width: 1280, height: 720 })
  })
})
