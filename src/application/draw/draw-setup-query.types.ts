import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'
import type { DrawCommandFailure } from './draw-command-errors.ts'
import type { CandidatePoolDiagnostics } from './candidate-pool.types.ts'

export type DrawSetupExclusionReason =
  keyof CandidatePoolDiagnostics['exclusionCounts']

export interface DrawSetupReadyViewModel {
  readonly state: 'ready'
  readonly mode: AppMode
  readonly event: Event
  readonly configuration: DrawConfiguration
  readonly category: PrizeCategory
  readonly session: DrawSession
  readonly totalParticipantCount: number
  readonly eligibleCandidateCount: number
  readonly excludedCount: number
  readonly exclusionCounts: Readonly<Partial<Record<DrawSetupExclusionReason, number>>>
}

export type DrawSetupViewModel =
  | { readonly state: 'loading' }
  | { readonly state: 'no-active-event'; readonly mode: AppMode }
  | { readonly state: 'no-configuration'; readonly mode: AppMode; readonly event: Event }
  | { readonly state: 'invalid-category'; readonly mode: AppMode; readonly event: Event; readonly configuration: DrawConfiguration }
  | { readonly state: 'no-participants'; readonly mode: AppMode; readonly event: Event; readonly configuration: DrawConfiguration; readonly category: PrizeCategory; readonly session: DrawSession | null }
  | { readonly state: 'no-session'; readonly mode: AppMode; readonly event: Event; readonly configuration: DrawConfiguration; readonly category: PrizeCategory; readonly totalParticipantCount: number; readonly eligibleCandidateCount: number; readonly excludedCount: number; readonly exclusionCounts: Readonly<Partial<Record<DrawSetupExclusionReason, number>>> }
  | { readonly state: 'blocked'; readonly mode: AppMode; readonly event: Event; readonly configuration: DrawConfiguration; readonly category: PrizeCategory; readonly session: DrawSession | null; readonly totalParticipantCount: number; readonly eligibleCandidateCount: number; readonly excludedCount: number; readonly exclusionCounts: Readonly<Partial<Record<DrawSetupExclusionReason, number>>>; readonly reason: string }
  | DrawSetupReadyViewModel
  | { readonly state: 'query-failure'; readonly mode: AppMode; readonly error: DrawSetupQueryError | DrawCommandFailure }

export interface DrawSetupQueryError {
  readonly code: 'persistence-failed' | 'invalid-data'
  readonly message: string
  readonly cause?: unknown
}

export interface DrawSetupQueryRepositories {
  readonly events: import('../persistence/repositories/event-repository.interface.ts').EventRepository
  readonly preferences: import('../persistence/repositories/preference-repository.interface.ts').PreferenceRepository
  readonly configurations: import('../persistence/repositories/draw-configuration-repository.interface.ts').DrawConfigurationRepository
  readonly categories: import('../persistence/repositories/prize-category-repository.interface.ts').PrizeCategoryRepository
  readonly sessions: import('../persistence/repositories/draw-session-repository.interface.ts').DrawSessionRepository
  readonly participants: import('../persistence/repositories/participant-repository.interface.ts').ParticipantRepository
  readonly winners: import('../persistence/repositories/winner-repository.interface.ts').WinnerRepository
}

export interface DrawSetupCommandService {
  execute(input: import('./draw-command.types.ts').DrawCommandInput): Promise<import('./draw-command.types.ts').DrawCommandExecution>
}

export interface DrawSetupProductionServices extends DrawSetupQueryRepositories {
  readonly command: DrawSetupCommandService
  readonly open: () => Promise<void>
}

export type DrawSetupFailure = DrawCommandFailure
