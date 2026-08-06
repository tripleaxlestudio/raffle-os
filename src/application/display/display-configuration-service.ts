import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import { validateBlackoutAppearance, validateSafeAreaMargin, validateTargetResolution } from '../../domain/display/display-configuration.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import { createDisplayConfigurationId } from '../../domain/shared/identifiers.ts'
import { parseIsoTimestamp, type IsoTimestamp } from '../../domain/shared/timestamps.ts'
import type { DisplayConfigurationRepository } from '../persistence/repositories/display-configuration-repository.interface.ts'
import type { EventRepository } from '../persistence/repositories/event-repository.interface.ts'

export type DisplayConfigurationInput = Readonly<Pick<DisplayConfiguration, 'targetResolution' | 'safeAreaMargin' | 'blackoutAppearance'>>

export type DisplayConfigurationService = {
  readForEvent(event: Event): Promise<DisplayConfiguration | null>
  saveForEvent(event: Event, input: DisplayConfigurationInput, existing?: DisplayConfiguration | null): Promise<DisplayConfiguration>
}

const timestamp = (): IsoTimestamp => {
  const result = parseIsoTimestamp(new Date().toISOString())
  if (!result.ok) throw new Error('The local clock produced an invalid timestamp.')
  return result.value
}

export function createDisplayConfigurationService(dependencies: {
  readonly events: EventRepository
  readonly configurations: DisplayConfigurationRepository
}): DisplayConfigurationService {
  return {
    async readForEvent(event) {
      const persistedEvent = await dependencies.events.findById(event.id)
      if (persistedEvent === null) throw new Error('The active Event no longer exists.')
      return dependencies.configurations.findByEventId(persistedEvent.id)
    },
    async saveForEvent(event, input, existing) {
      const resolution = validateTargetResolution(input.targetResolution)
      if (!resolution.ok) throw new Error(resolution.error.message)
      const margin = validateSafeAreaMargin(input.safeAreaMargin)
      if (!margin.ok || input.safeAreaMargin > 500) throw new Error(margin.ok ? 'Safe-area margin must be 500 or less.' : margin.error.message)
      const blackout = validateBlackoutAppearance(input.blackoutAppearance)
      if (!blackout.ok) throw new Error(blackout.error.message)
      const now = timestamp()
      const configuration: DisplayConfiguration = existing === null || existing === undefined
        ? { id: createDisplayConfigurationId(), eventId: event.id, targetResolution: resolution.value, safeAreaMargin: margin.value, blackoutAppearance: blackout.value, createdAt: now, updatedAt: now }
        : { ...existing, eventId: event.id, targetResolution: resolution.value, safeAreaMargin: margin.value, blackoutAppearance: blackout.value, updatedAt: now }
      if (existing === null || existing === undefined) await dependencies.configurations.create(configuration)
      else await dependencies.configurations.updateForEvent(configuration)
      return configuration
    },
  }
}

export function deriveProductionDisplayScope(eventId: string, displayConfigurationId: string) {
  return { eventId, displayId: displayConfigurationId } as const
}
