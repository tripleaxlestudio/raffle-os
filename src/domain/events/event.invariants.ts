import type { Event, EventStatus } from './event.types.ts'
import {
  failure,
  success,
  type Result,
} from '../shared/result.ts'
import {
  isIsoTimestamp,
  type IsoTimestamp,
} from '../shared/timestamps.ts'

const permittedTransitions: Readonly<
  Record<EventStatus, readonly EventStatus[]>
> = {
  archived: ['ready'],
  completed: ['archived'],
  draft: ['ready', 'archived'],
  live: ['completed'],
  ready: ['draft', 'live', 'archived'],
}

export function validateEvent(event: Event): Result<Event> {
  if (event.name.trim().length === 0) {
    return failure(
      'invalid-event-name',
      'Event name must contain non-whitespace characters.',
    )
  }

  if (
    (event.scheduledAt !== undefined &&
      !isIsoTimestamp(event.scheduledAt)) ||
    !isIsoTimestamp(event.createdAt) ||
    !isIsoTimestamp(event.updatedAt)
  ) {
    return failure(
      'invalid-event-timestamp',
      'Event timestamps must be valid ISO 8601 UTC values.',
    )
  }

  return success(event)
}

export function canTransitionEventStatus(
  from: EventStatus,
  to: EventStatus,
): boolean {
  return permittedTransitions[from].includes(to)
}

export function transitionEventStatus(
  event: Event,
  to: EventStatus,
  at: IsoTimestamp,
): Result<Event> {
  if (!isIsoTimestamp(at)) {
    return failure(
      'invalid-event-transition-timestamp',
      'Event transition timestamp must be a valid ISO UTC value.',
    )
  }

  if (!canTransitionEventStatus(event.status, to)) {
    return failure(
      'unsupported-event-transition',
      `Event cannot transition from ${event.status} to ${to}.`,
    )
  }

  return success({
    ...event,
    status: to,
    updatedAt: at,
  })
}

export function canHardDeleteEvent(
  event: Event,
  hasOfficialHistory: boolean,
): boolean {
  return event.status === 'draft' && !hasOfficialHistory
}

export function canPermanentlyDeleteEvent(
  event: Event,
  hasUnresolvedOperationalState: boolean,
): boolean {
  return event.status !== 'live' && !hasUnresolvedOperationalState
}
