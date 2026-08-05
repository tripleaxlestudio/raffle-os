import type { PresentationStage } from '../../domain/workflow/presentation-workflow.types.ts'

export const PRESENTATION_POLICY_VERSION = 1 as const

export interface PresentationPolicy {
  readonly version: typeof PRESENTATION_POLICY_VERSION
  readonly countdownDurationMs: 3000
  readonly countdownLabelDurationMs: 1000
  readonly rollingDurationMs: 2500
  readonly countdownLabels: readonly [3, 2, 1]
}

export const PRESENTATION_POLICY: PresentationPolicy = {
  version: PRESENTATION_POLICY_VERSION,
  countdownDurationMs: 3000,
  countdownLabelDurationMs: 1000,
  rollingDurationMs: 2500,
  countdownLabels: [3, 2, 1],
}

export function stageDurationMs(stage: PresentationStage, policy = PRESENTATION_POLICY): number {
  if (stage === 'countdown') return policy.countdownDurationMs
  if (stage === 'rolling') return policy.rollingDurationMs
  return Number.POSITIVE_INFINITY
}
