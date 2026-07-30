import type {
  DrawConfigurationId,
  EventId,
  PrizeCategoryId,
} from '../shared/identifiers.ts'
import type { IsoTimestamp } from '../shared/timestamps.ts'

export type WinningRule =
  | 'once-per-event'
  | 'once-per-category'
  | 'allow-repeat'

export interface DrawConfiguration {
  readonly id: DrawConfigurationId
  readonly eventId: EventId
  readonly prizeCategoryId: PrizeCategoryId
  readonly requestedWinners: number
  readonly winningRule: WinningRule
  readonly requireCheckIn: boolean
  readonly eligibleGroupFilter: string | null
  readonly createdAt: IsoTimestamp
  readonly updatedAt: IsoTimestamp
}

export interface DrawConfigurationMutationContext {
  readonly hasStartedDrawSession: boolean
}

export const DRAW_CONFIGURATION_MUTABILITY_POLICY =
  'editable-until-first-session-start' as const
