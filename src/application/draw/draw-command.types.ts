import type { AuditRecord } from '../../domain/audit/audit.types.ts'
import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { DrawConfigurationSnapshot, DrawSession, CandidatePoolSnapshot } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { Participant } from '../../domain/participants/participant.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'
import type { DrawSessionId, EventId, PrizeCategoryId, DrawConfigurationId, WinnerRecordId, AuditRecordId } from '../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { EligibilityEvaluation, EligibilityEvaluatorInput } from '../eligibility/index.ts'
import type { CandidatePoolBuildInput, CandidatePoolBuildOutput, CandidatePoolEligibilityEvaluator } from './candidate-pool.types.ts'
import type { CandidatePoolFailure } from './candidate-pool-errors.ts'
import type { WinnerSelectionInput, WinnerSelectionOutput, WinnerSelectionResult } from './winner-selection.types.ts'
import type { RandomSource } from './random-source.ts'
import type { DrawPersistenceUnitOfWork } from '../persistence/draw-persistence-unit-of-work.interface.ts'
import type { EventRepository } from '../persistence/repositories/event-repository.interface.ts'
import type { PrizeCategoryRepository } from '../persistence/repositories/prize-category-repository.interface.ts'
import type { DrawConfigurationRepository } from '../persistence/repositories/draw-configuration-repository.interface.ts'
import type { DrawSessionRepository } from '../persistence/repositories/draw-session-repository.interface.ts'
import type { ParticipantRepository } from '../persistence/repositories/participant-repository.interface.ts'
import type { WinnerRepository } from '../persistence/repositories/winner-repository.interface.ts'
import type { DrawCommandFailure } from './draw-command-errors.ts'

export interface DrawCommandInput {
  readonly eventId: EventId
  readonly drawSessionId: DrawSessionId
  readonly configurationId: DrawConfigurationId
  readonly prizeCategoryId: PrizeCategoryId
  readonly mode: AppMode
  readonly expectedStatus?: 'ready'
}

export interface DrawCommandResult {
  readonly event: Event
  readonly configuration: DrawConfiguration
  readonly prizeCategory: PrizeCategory
  readonly session: DrawSession
  readonly participants: readonly Participant[]
  readonly configurationSnapshot: DrawConfigurationSnapshot
  readonly candidatePoolSnapshot: CandidatePoolSnapshot
  readonly selectedCandidateEntries: WinnerSelectionOutput['selectedCandidateEntries']
  readonly pendingWinners: readonly WinnerRecord[]
  readonly auditRecord: AuditRecord
}

export interface DrawCommandDependencies {
  readonly events: EventRepository
  readonly configurations: DrawConfigurationRepository
  readonly categories: PrizeCategoryRepository
  readonly sessions: DrawSessionRepository
  readonly participants: ParticipantRepository
  readonly winners: WinnerRepository
  readonly evaluateEligibility?: (input: EligibilityEvaluatorInput) => EligibilityEvaluation
  readonly buildCandidatePool?: (input: CandidatePoolBuildInput, evaluator?: CandidatePoolEligibilityEvaluator) => { readonly ok: true; readonly value: CandidatePoolBuildOutput } | { readonly ok: false; readonly error: CandidatePoolFailure }
  readonly selectWinners?: (input: WinnerSelectionInput) => WinnerSelectionResult
  readonly randomSource: RandomSource
  readonly persistence: DrawPersistenceUnitOfWork
  /** Optional production preflight. Live must verify storage before selection when supplied. */
  readonly checkStorageHealth?: () => Promise<{
    readonly ok: true
  } | {
    readonly ok: false
    readonly code: string
    readonly reason: string
  }>
  readonly now: () => IsoTimestamp
  readonly createWinnerRecordId: () => WinnerRecordId
  readonly createAuditRecordId: () => AuditRecordId
  readonly auditActor?: AuditRecord['actor']
}

export type DrawCommandExecution =
  | { readonly ok: true; readonly value: DrawCommandResult }
  | { readonly ok: false; readonly error: DrawCommandFailure }
