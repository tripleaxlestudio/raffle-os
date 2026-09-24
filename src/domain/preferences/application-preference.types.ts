import type { AppMode } from '../types/app-mode.ts'
import {
  parseEventId,
  type EventId,
} from '../shared/identifiers.ts'
import {
  failure,
  success,
  type Result,
} from '../shared/result.ts'
import type { IsoTimestamp } from '../shared/timestamps.ts'

export interface ApplicationPreferenceRegistry {
  activeEventId: EventId | null
  lastOperatorMode: AppMode
  setupJourneyReachedStepByEvent: Readonly<Record<string, number>>
}

export type ApplicationPreferenceKey =
  keyof ApplicationPreferenceRegistry

export type ApplicationPreference<
  K extends
    ApplicationPreferenceKey = ApplicationPreferenceKey,
> = {
  [P in K]: {
    readonly key: P
    readonly value: ApplicationPreferenceRegistry[P]
    readonly updatedAt: IsoTimestamp
  }
}[K]

export function isApplicationPreferenceKey(
  value: unknown,
): value is ApplicationPreferenceKey {
  return value === 'activeEventId' || value === 'lastOperatorMode' || value === 'setupJourneyReachedStepByEvent'
}

export function validateApplicationPreferenceValue(
  key: 'activeEventId',
  value: unknown,
): Result<EventId | null>
export function validateApplicationPreferenceValue(
  key: 'lastOperatorMode',
  value: unknown,
): Result<AppMode>
export function validateApplicationPreferenceValue(
  key: 'setupJourneyReachedStepByEvent',
  value: unknown,
): Result<Readonly<Record<string, number>>>
export function validateApplicationPreferenceValue(
  key: ApplicationPreferenceKey,
  value: unknown,
): Result<EventId | null | AppMode | Readonly<Record<string, number>>>
export function validateApplicationPreferenceValue(
  key: ApplicationPreferenceKey,
  value: unknown,
): Result<EventId | null | AppMode | Readonly<Record<string, number>>> {
  if (key === 'activeEventId') {
    if (value === null) {
      return success(null)
    }

    return parseEventId(value)
  }

  if (key === 'setupJourneyReachedStepByEvent') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return failure('invalid-setup-journey-reached-step', 'Setup journey progress must be an Event-keyed object.')
    const entries = Object.entries(value)
    if (entries.some(([eventId, step]) => parseEventId(eventId).ok === false || typeof step !== 'number' || !Number.isInteger(step) || step < 1 || step > 5)) return failure('invalid-setup-journey-reached-step', 'Setup journey progress contains an invalid Event step.')
    return success(Object.fromEntries(entries) as Readonly<Record<string, number>>)
  }

  if (value !== 'practice' && value !== 'live') {
    return failure(
      'invalid-operator-mode-preference',
      'Last operator mode must be practice or live.',
    )
  }

  return success(value)
}

export function isStructuredCloneSafePreferenceValue(
  key: ApplicationPreferenceKey,
  value: unknown,
): boolean {
  return validateApplicationPreferenceValue(key, value).ok
}
