import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import type { PresentationCheckpointRecord } from '../../domain/workflow/presentation-checkpoint.types.ts'
import type { PresentationStage } from '../../domain/workflow/presentation-workflow.types.ts'

export type RecoveryDecision =
  | { readonly kind: 'no-recovery'; readonly reason: 'ready-without-official-result' | 'no-checkpoint' }
  | { readonly kind: 'resume'; readonly drawSessionId: DrawSessionId; readonly stage: PresentationStage; readonly blackoutRequested: boolean }
  | { readonly kind: 'pending-handoff'; readonly drawSessionId: DrawSessionId; readonly readOnly: true }

export interface RecoveryQueryInput {
  readonly sessionStatus: string
  readonly drawSessionId: DrawSessionId
  readonly checkpoint: PresentationCheckpointRecord | null
  readonly officialWinnerCount: number
}
