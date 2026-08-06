import type { PresentationStage } from '../../domain/workflow/presentation-workflow.types.ts'

export const PRESENTATION_POLICY_VERSION = 1 as const

export interface PresentationPolicy {
  readonly version: typeof PRESENTATION_POLICY_VERSION
  readonly countdownDurationMs: number
  readonly countdownLabelDurationMs: number
  readonly rollingDurationMs: number
  readonly countdownLabels: readonly [3, 2, 1]
}

export const PRESENTATION_POLICY: PresentationPolicy = {
  version: PRESENTATION_POLICY_VERSION,
  countdownDurationMs: 3000,
  countdownLabelDurationMs: 1000,
  rollingDurationMs: 2500,
  countdownLabels: [3, 2, 1],
}

export function presentationPolicyFromSettings(countdownDurationSeconds: number, rollingDurationSeconds: number): PresentationPolicy {
  return { version: PRESENTATION_POLICY_VERSION, countdownDurationMs: countdownDurationSeconds * 1000, countdownLabelDurationMs: (countdownDurationSeconds * 1000) / 3, rollingDurationMs: rollingDurationSeconds * 1000, countdownLabels: [3, 2, 1] }
}

export function stageDurationMs(stage: PresentationStage, policy = PRESENTATION_POLICY): number {
  if (stage === 'countdown') return policy.countdownDurationMs
  if (stage === 'rolling') return policy.rollingDurationMs
  return Number.POSITIVE_INFINITY
}
