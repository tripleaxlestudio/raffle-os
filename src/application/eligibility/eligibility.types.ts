import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type {
  DrawSessionId,
  EventId,
  DrawConfigurationId,
  ParticipantId,
  PrizeCategoryId,
} from '../../domain/shared/identifiers.ts'
import type {
  DrawSessionStatus,
} from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type {
  Participant,
  TicketNumber,
} from '../../domain/participants/participant.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'

export type EligibilityExclusionReason =
  | 'wrong-event'
  | 'not-checked-in'
  | 'group-filter-mismatch'
  | 'previously-confirmed-winner'
  | 'otherwise-disallowed-winner'
  | 'invalid-participant'

export interface EligibilityDecision {
  readonly participantId: ParticipantId
  readonly ticketNumber: TicketNumber
  readonly eligible: boolean
  readonly exclusionReasons: readonly EligibilityExclusionReason[]
}

export interface EligibilityEntry {
  readonly participantId: ParticipantId
  readonly ticketNumber: TicketNumber
}

export interface EligibilityOfficialSession {
  readonly id: DrawSessionId
  readonly eventId: EventId
  readonly configurationId: DrawConfigurationId
  readonly prizeCategoryId: PrizeCategoryId
  readonly mode: AppMode
  readonly status: DrawSessionStatus
}

/** Runtime context needed to identify pending official selections in flight. */
export interface EligibilityRuleContext {
  readonly activeOfficialSessionId?: DrawSessionId
  readonly activeOfficialSessionIds?: readonly DrawSessionId[]
  readonly inFlightOfficialSessionIds?: readonly DrawSessionId[]
  readonly officialSessions?: readonly EligibilityOfficialSession[]
}

export interface EligibilityEvaluatorInput {
  readonly activeEvent: Event
  readonly drawConfiguration: DrawConfiguration
  readonly prizeCategory: PrizeCategory
  readonly mode: AppMode
  readonly participants: readonly Participant[]
  readonly winnerRecords: readonly WinnerRecord[]
  readonly ruleContext?: EligibilityRuleContext
}

export interface EligibilityResult {
  readonly eventId: EventId
  readonly configurationId: DrawConfigurationId
  readonly prizeCategoryId: PrizeCategoryId
  readonly mode: AppMode
  readonly decisions: readonly EligibilityDecision[]
  readonly eligibleEntries: readonly EligibilityEntry[]
  readonly eligibleCount: number
  readonly excludedCount: number
}
