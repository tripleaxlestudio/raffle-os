import type { Event } from '../../domain/events/event.types.ts'
import { DEFAULT_EVENT_SETTINGS, validateAsset, validateHexColor, type EventSettings, type LocalAsset } from '../../domain/settings/event-settings.types.ts'
import type { EventSettingsRepository } from '../persistence/repositories/event-settings-repository.interface.ts'
export type EventSettingsInput = Omit<EventSettings, 'eventId' | 'updatedAt'>
export function createEventSettingsService(repository: EventSettingsRepository) {
  return {
    async readForEvent(event: Event): Promise<EventSettings> { const current = await repository.findByEventId(event.id); return current ?? { eventId: event.id, ...DEFAULT_EVENT_SETTINGS, displayName: event.name, updatedAt: new Date().toISOString() } },
    async saveForEvent(event: Event, input: EventSettingsInput): Promise<EventSettings> {
      if (!input.displayName.trim()) throw new Error('Public Event display name is required.')
      if (!validateHexColor(input.primaryColor) || !validateHexColor(input.accentColor)) throw new Error('Colors must use six-digit hexadecimal values.')
      if (!Number.isFinite(input.safeAreaMargin) || input.safeAreaMargin < 0 || input.safeAreaMargin > 500) throw new Error('Safe-area margin must be between 0 and 500 px.')
      if (!Number.isFinite(input.masterVolume) || input.masterVolume < 0 || input.masterVolume > 100) throw new Error('Master volume must be between 0 and 100%.')
      const assets: [LocalAsset | undefined, 'image' | 'image' | 'audio'][] = [[input.logo, 'image'], [input.background, 'image'], [input.revealCue, 'audio']]
      for (const [asset, kind] of assets) { const error = validateAsset(asset, kind); if (error !== null) throw new Error(error) }
      const settings: EventSettings = { ...input, eventId: event.id, displayName: input.displayName.trim(), subtitle: input.subtitle.trim(), updatedAt: new Date().toISOString() }
      await repository.save(settings); return settings
    },
  }
}
