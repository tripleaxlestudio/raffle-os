import type { DrawSessionId } from '../shared/identifiers.ts'
import type { IsoTimestamp } from '../shared/timestamps.ts'
import type { PresentationStage } from './presentation-workflow.types.ts'

export const PRESENTATION_CHECKPOINT_FORMAT_VERSION = 1 as const
export const PRESENTATION_POLICY_VERSION = 1 as const

export interface PresentationCheckpointRecord {
  readonly drawSessionId: DrawSessionId
  readonly stage: PresentationStage
  readonly stageStartedAt: IsoTimestamp
  readonly persistedAt: IsoTimestamp
  readonly presentationPolicyVersion: typeof PRESENTATION_POLICY_VERSION
  readonly checkpointFormatVersion: typeof PRESENTATION_CHECKPOINT_FORMAT_VERSION
  readonly blackoutRequested: boolean
}

export type PresentationCheckpoint = PresentationCheckpointRecord

export function checkpointFromState(
  state: { readonly stage: PresentationStage; readonly drawSessionId: DrawSessionId; readonly stageStartedAt: IsoTimestamp; readonly blackoutRequested: boolean },
  persistedAt: IsoTimestamp,
): PresentationCheckpointRecord {
  return {
    drawSessionId: state.drawSessionId,
    stage: state.stage,
    stageStartedAt: state.stageStartedAt,
    persistedAt,
    presentationPolicyVersion: PRESENTATION_POLICY_VERSION,
    checkpointFormatVersion: PRESENTATION_CHECKPOINT_FORMAT_VERSION,
    blackoutRequested: state.blackoutRequested,
  }
}
