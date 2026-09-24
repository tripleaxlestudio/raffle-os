import { describe, expect, it } from 'vitest'
import { createEventSettingsService } from './event-settings-service.ts'
import { DEFAULT_EVENT_SETTINGS } from '../../domain/settings/event-settings.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { EventSettings } from '../../domain/settings/event-settings.types.ts'
import type { EventSettingsRepository } from '../persistence/repositories/event-settings-repository.interface.ts'
import { parseEventId } from '../../domain/shared/identifiers.ts'
import { parseIsoTimestamp } from '../../domain/shared/timestamps.ts'

const eventId = parseEventId('40000000-0000-4000-8000-000000000001'); const timestamp = parseIsoTimestamp('2026-08-06T00:00:00.000Z'); if (!eventId.ok || !timestamp.ok) throw new Error('Test fixture identifiers are invalid.')
const event: Event = { id: eventId.value, name: 'Gala', status: 'draft', createdAt: timestamp.value, updatedAt: timestamp.value }
const repository = (initial: EventSettings | null): EventSettingsRepository & { saved: EventSettings | null } => { const state = { saved: null as EventSettings | null }; return { saved: state.saved, async findByEventId() { return initial }, async save(settings) { state.saved = settings; this.saved = settings }, async deleteForEvent() { return undefined } } }

describe('production Event settings persistence', () => {
  it('defaults an existing record without Presentation settings without changing its other values', async () => {
    const legacy = { eventId: event.id, displayName: 'Legacy', subtitle: 'Subtitle', primaryColor: '#112233', accentColor: '#445566', audioEnabled: true, masterVolume: 40, updatedAt: event.updatedAt }
    const service = createEventSettingsService(repository(legacy as unknown as EventSettings))
    await expect(service.readForEvent(event)).resolves.toMatchObject({ ...legacy, presentation: DEFAULT_EVENT_SETTINGS.presentation })
  })

  it('persists valid Presentation settings and rejects invalid duration values', async () => {
    const store = repository(null); const service = createEventSettingsService(store)
    const defaults = { ...DEFAULT_EVENT_SETTINGS, displayName: event.name }
    await expect(service.saveForEvent(event, { ...defaults, presentation: { ...defaults.presentation, rollingDurationSeconds: 12 } })).resolves.toMatchObject({ presentation: { rollingDurationSeconds: 12 } })
    await expect(service.saveForEvent(event, { ...defaults, presentation: { ...defaults.presentation, countdownDurationSeconds: 0 as never } })).rejects.toThrow('Countdown duration')
  })
})
