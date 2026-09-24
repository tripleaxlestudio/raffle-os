import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import type { PresentationCheckpointRecord } from '../../domain/workflow/presentation-checkpoint.types.ts'
import type { PresentationStage } from '../../domain/workflow/presentation-workflow.types.ts'

export type RecoveryDecision =
  | { readonly kind: 'no-recovery'; readonly reason: 'ready-without-official-result' | 'no-checkpoint' }
  | { readonly kind: 'resume'; readonly drawSessionId: DrawSessionId; readonly stage: PresentationStage; readonly blackoutRequested: boolean; readonly elapsedMs?: number }
  | { readonly kind: 'pending-handoff'; readonly drawSessionId: DrawSessionId; readonly readOnly: true }
  | { readonly kind: 'typed-failure'; readonly code: 'official-result-missing' | 'invalid-winner-relationship' | 'checkpoint-corrupt' | 'unsupported-checkpoint' | 'ambiguous-pending-session'; readonly retryable: boolean; readonly message: string }

export interface RecoveryQueryInput {
  readonly sessionStatus: string
  readonly drawSessionId: DrawSessionId
  readonly checkpoint: PresentationCheckpointRecord | null
  readonly officialWinnerCount: number
  readonly now?: string
  readonly checkpointError?: 'corrupt' | 'unsupported' | 'stale'
}
