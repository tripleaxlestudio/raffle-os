import type { AppMode } from '../../domain/types/app-mode.ts'
import type {
  CandidatePoolSnapshot,
  CandidatePoolSnapshotEntry,
  DrawConfigurationSnapshot,
} from '../../domain/draws/draw-session.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type {
  DrawConfigurationId,
  DrawSessionId,
  EventId,
  PrizeCategoryId,
  WinnerRecordId,
} from '../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import type { RandomSource } from './random-source.ts'
import type { WinnerSelectionFailure } from './winner-selection-errors.ts'

export interface WinnerSelectionInput {
  readonly candidatePoolSnapshot: CandidatePoolSnapshot
  readonly configurationSnapshot: DrawConfigurationSnapshot
  readonly eventId: EventId
  readonly prizeCategoryId: PrizeCategoryId
  readonly mode: AppMode
  readonly drawSessionId: DrawSessionId
  readonly at: IsoTimestamp
  readonly randomSource: RandomSource
  readonly createWinnerRecordId: () => WinnerRecordId
}

export interface WinnerSelectionOutput {
  readonly eventId: EventId
  readonly configurationId: DrawConfigurationId
  readonly prizeCategoryId: PrizeCategoryId
  readonly drawSessionId: DrawSessionId
  readonly mode: AppMode
  readonly requestedWinners: number
  readonly selectedCandidateEntries: readonly CandidatePoolSnapshotEntry[]
  readonly pendingWinners: readonly WinnerRecord[]
}

export type WinnerSelectionResult =
  | { readonly ok: true; readonly value: WinnerSelectionOutput }
  | { readonly ok: false; readonly error: WinnerSelectionFailure }
