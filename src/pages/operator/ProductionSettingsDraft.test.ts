import { describe, expect, it } from 'vitest'
import { assetsEqual, settingsEqual } from './production-settings-draft.ts'
import { DEFAULT_EVENT_SETTINGS, type EventSettings } from '../../domain/settings/event-settings.types.ts'

const settings = (overrides: Partial<EventSettings> = {}): EventSettings => ({ eventId: 'event-00000000-0000-4000-8000-000000000001' as EventSettings['eventId'], updatedAt: '2026-01-01T00:00:00.000Z', ...DEFAULT_EVENT_SETTINGS, displayName: 'Gala', ...overrides })

describe('production Settings draft comparison', () => {
  it('does not treat hydration or a rerender as dirty, but detects values and assets', () => {
    const background = { blob: new Blob(['a'], { type: 'image/png' }), name: 'a.png', size: 1, type: 'image/png' }
    expect(settingsEqual(settings({ background }), settings({ background }))).toBe(true)
    expect(settingsEqual(settings(), settings({ masterVolume: 73 }))).toBe(false)
    expect(settingsEqual(settings({ background }), settings())).toBe(false)
    expect(assetsEqual(background, undefined)).toBe(false)
  })
})
