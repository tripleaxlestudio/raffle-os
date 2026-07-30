import type {
  EventId,
  ParticipantId,
} from '../shared/identifiers.ts'
import type { IsoTimestamp } from '../shared/timestamps.ts'

declare const ticketNumberBrand: unique symbol

export type TicketNumber = string & {
  readonly [ticketNumberBrand]: 'TicketNumber'
}

export interface Participant {
  readonly id: ParticipantId
  readonly eventId: EventId
  readonly ticketNumber: TicketNumber
  readonly name?: string
  readonly group?: string
  readonly notes?: string
  readonly isCheckedIn: boolean
  readonly createdAt: IsoTimestamp
  readonly updatedAt: IsoTimestamp
}

export interface ParticipantOperationalChanges {
  readonly name?: string
  readonly group?: string
  readonly notes?: string
  readonly isCheckedIn?: boolean
  readonly updatedAt: IsoTimestamp
}
