import type { CandidatePoolSnapshot } from '../../domain/draws/draw-session.types.ts'
import type { EligibilityDecision, EligibilityRuleContext } from '../eligibility/eligibility.types.ts'
import type { EligibilityFailure } from '../eligibility/eligibility-errors.ts'

export interface CandidatePoolDiagnostics {
  readonly totalEvaluated: number
  readonly eligibleCount: number
  readonly excludedCount: number
  readonly exclusionCounts: Readonly<Partial<Record<
    EligibilityDecision['exclusionReasons'][number],
    number
  >>>
}

export interface CandidatePoolBuildInput {
  readonly activeEvent: import('../../domain/events/event.types.ts').Event
  readonly drawConfiguration: import('../../domain/draws/draw-configuration.types.ts').DrawConfiguration
  readonly prizeCategory: import('../../domain/prizes/prize.types.ts').PrizeCategory
  readonly mode: import('../../domain/types/app-mode.ts').AppMode
  readonly participants: readonly import('../../domain/participants/participant.types.ts').Participant[]
  readonly winnerRecords: readonly import('../../domain/winners/winner.types.ts').WinnerRecord[]
  readonly ruleContext?: EligibilityRuleContext
  readonly capturedAt: import('../../domain/shared/timestamps.ts').IsoTimestamp
}

export interface CandidatePoolBuildOutput {
  readonly snapshot: CandidatePoolSnapshot
  readonly diagnostics: CandidatePoolDiagnostics
  readonly decisions: readonly EligibilityDecision[]
}

export type CandidatePoolEligibilityEvaluator = (
  input: Omit<CandidatePoolBuildInput, 'capturedAt'>,
) =>
  | { readonly ok: true; readonly value: import('../eligibility/eligibility.types.ts').EligibilityResult }
  | { readonly ok: false; readonly error: EligibilityFailure }
