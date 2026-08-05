import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'
import type { DrawAuthoringError } from './draw-authoring-errors.ts'

export interface DrawAuthoringDraft {
  readonly eventId: string
  readonly prizeCategoryId: string
  readonly requestedWinners: unknown
  readonly winningRule: unknown
  readonly requireCheckIn: boolean
  readonly eligibleGroupFilter: unknown
  readonly mode: unknown
  readonly configurationId?: string
  readonly sessionId?: string
}

export interface DrawAuthoringRecord {
  readonly event: Event
  readonly category: PrizeCategory
  readonly configuration: DrawConfiguration
  readonly session: DrawSession
  readonly eligibleCount: number
}

export interface DrawAuthoringRepositories {
  readonly events: import('../persistence/repositories/event-repository.interface.ts').EventRepository
  readonly categories: import('../persistence/repositories/prize-category-repository.interface.ts').PrizeCategoryRepository
  readonly configurations: import('../persistence/repositories/draw-configuration-repository.interface.ts').DrawConfigurationRepository
  readonly sessions: import('../persistence/repositories/draw-session-repository.interface.ts').DrawSessionRepository
  readonly participants: import('../persistence/repositories/participant-repository.interface.ts').ParticipantRepository
  readonly winners: import('../persistence/repositories/winner-repository.interface.ts').WinnerRepository
  readonly authoring?: import('../persistence/draw-authoring-unit-of-work.interface.ts').DrawAuthoringUnitOfWork
}

export interface DrawAuthoringService {
  load(input?: { readonly eventId?: string; readonly configurationId?: string }): Promise<DrawAuthoringLoadResult>
  save(draft: DrawAuthoringDraft): Promise<DrawAuthoringSaveResult>
}

export type DrawAuthoringLoadResult =
  | { readonly ok: true; readonly record: DrawAuthoringRecord | null; readonly event: Event | null; readonly categories: readonly PrizeCategory[] }
  | { readonly ok: false; readonly error: DrawAuthoringError }

export type DrawAuthoringSaveResult =
  | { readonly ok: true; readonly record: DrawAuthoringRecord }
  | { readonly ok: false; readonly error: DrawAuthoringError }

export interface DrawSetupAuthoringServices extends DrawAuthoringRepositories {
  readonly preferences: import('../persistence/repositories/preference-repository.interface.ts').PreferenceRepository
  readonly open: () => Promise<void>
  readonly authoringService?: DrawAuthoringService
}

export type PersistedMode = AppMode
