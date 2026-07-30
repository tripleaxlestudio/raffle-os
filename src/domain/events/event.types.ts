import type { EventId } from '../shared/identifiers.ts'
import type { IsoTimestamp } from '../shared/timestamps.ts'

export type EventStatus =
  | 'draft'
  | 'ready'
  | 'live'
  | 'completed'
  | 'archived'

export interface Event {
  readonly id: EventId
  readonly name: string
  readonly description?: string
  readonly scheduledAt?: IsoTimestamp
  readonly status: EventStatus
  readonly createdAt: IsoTimestamp
  readonly updatedAt: IsoTimestamp
}

export const EVENT_HARD_DELETION_POLICY =
  'draft-only-without-official-history' as const
