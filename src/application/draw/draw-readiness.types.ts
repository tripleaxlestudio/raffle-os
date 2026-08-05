import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'

export type DrawReadinessState =
  | 'loading' | 'ready' | 'insufficient-capacity' | 'storage-unavailable'
  | 'crypto-unavailable' | 'session-conflict' | 'missing-event'
  | 'missing-category' | 'missing-configuration' | 'missing-session'
  | 'session-not-ready' | 'stale-data' | 'failed'

export interface DrawReadinessData {
  readonly event: Event
  readonly category: PrizeCategory
  readonly configuration: DrawConfiguration
  readonly session: DrawSession
  readonly authoritativeEligibleCount: number
  readonly requestedWinnerCount: number
  readonly mode: AppMode
}

export interface DrawReadinessResult {
  readonly state: DrawReadinessState
  readonly data?: DrawReadinessData
  readonly reason?: string
  readonly retryable: boolean
  readonly errorCode?: string
}
