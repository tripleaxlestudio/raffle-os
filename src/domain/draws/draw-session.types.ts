import type { AppMode } from '../types/app-mode.ts'
import type { TicketNumber } from '../participants/participant.types.ts'
import type {
  DrawConfigurationId,
  DrawSessionId,
  EventId,
  ParticipantId,
  PrizeCategoryId,
} from '../shared/identifiers.ts'
import type { IsoTimestamp } from '../shared/timestamps.ts'
import type { WinningRule } from './draw-configuration.types.ts'

export type DrawSessionStatus =
  | 'draft'
  | 'ready'
  | 'drawing'
  | 'pending-confirmation'
  | 'completed'
  | 'cancelled'

export interface DrawConfigurationSnapshot {
  readonly snapshotFormatVersion: 1
  readonly configurationId: DrawConfigurationId
  readonly prizeCategoryId: PrizeCategoryId
  readonly categoryName: string
  readonly prizeName: string
  readonly requestedWinners: number
  readonly winningRule: WinningRule
  readonly requireCheckIn: boolean
  readonly eligibleGroupFilter: string | null
  readonly capturedAt: IsoTimestamp
}

export interface CandidatePoolSnapshotEntry {
  readonly participantId: ParticipantId
  readonly ticketNumber: TicketNumber
}

export interface CandidatePoolSnapshot {
  readonly snapshotFormatVersion: 1
  readonly capturedAt: IsoTimestamp
  readonly winningRule: WinningRule
  readonly requireCheckIn: boolean
  readonly eligibleGroupFilter: string | null
  readonly candidateEntries:
    readonly CandidatePoolSnapshotEntry[]
  readonly eligibleSnapshotCount: number
}

export interface DrawStartSnapshots {
  readonly configurationSnapshot: DrawConfigurationSnapshot
  readonly candidatePoolSnapshot: CandidatePoolSnapshot
}

export interface DrawSession {
  readonly id: DrawSessionId
  readonly eventId: EventId
  readonly configurationId: DrawConfigurationId
  readonly mode: AppMode
  readonly status: DrawSessionStatus
  readonly configurationSnapshot:
    | DrawConfigurationSnapshot
    | null
  readonly candidatePoolSnapshot: CandidatePoolSnapshot | null
  readonly createdAt: IsoTimestamp
  readonly updatedAt: IsoTimestamp
  readonly completedAt?: IsoTimestamp
}
