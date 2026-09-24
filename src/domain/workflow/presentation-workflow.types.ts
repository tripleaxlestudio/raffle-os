import type { DrawSessionId } from '../shared/identifiers.ts'
import type { IsoTimestamp } from '../shared/timestamps.ts'

export type PresentationStage = 'countdown' | 'rolling' | 'reveal' | 'pending-handoff'
export type WorkflowStage = 'ready' | 'starting' | PresentationStage | 'interrupted' | 'failed'

export interface WorkflowStateBase {
  readonly blackoutRequested: boolean
}
export interface ReadyWorkflowState extends WorkflowStateBase { readonly stage: 'ready' }
export interface StartingWorkflowState extends WorkflowStateBase { readonly stage: 'starting'; readonly drawSessionId: DrawSessionId }
export interface PersistedWorkflowState extends WorkflowStateBase {
  readonly stage: PresentationStage
  readonly drawSessionId: DrawSessionId
  readonly stageStartedAt: IsoTimestamp
}
export interface InterruptedWorkflowState extends WorkflowStateBase { readonly stage: 'interrupted'; readonly drawSessionId: DrawSessionId }
export interface FailedWorkflowState extends WorkflowStateBase { readonly stage: 'failed'; readonly message: string }
export type PresentationWorkflowState = ReadyWorkflowState | StartingWorkflowState | PersistedWorkflowState | InterruptedWorkflowState | FailedWorkflowState

export function withBlackout<T extends WorkflowStateBase>(state: T, blackoutRequested: boolean): T {
  return { ...state, blackoutRequested }
}
