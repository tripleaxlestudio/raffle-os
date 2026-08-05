import { parseDrawSessionId } from '../shared/identifiers.ts'
import { isIsoTimestamp } from '../shared/timestamps.ts'
import { PRESENTATION_CHECKPOINT_FORMAT_VERSION, PRESENTATION_POLICY_VERSION, type PresentationCheckpointRecord } from './presentation-checkpoint.types.ts'
import type { PresentationStage } from './presentation-workflow.types.ts'

const stages: readonly PresentationStage[] = ['countdown', 'rolling', 'reveal', 'pending-handoff']
export class PresentationCheckpointValidationError extends Error {
  readonly kind: 'invalid' | 'unsupported'
  constructor(kind: 'invalid' | 'unsupported', message: string) { super(message); this.kind = kind; this.name = kind === 'invalid' ? 'InvalidCheckpointError' : 'UnsupportedCheckpointVersionError' }
}
export function isPresentationStage(value: unknown): value is PresentationStage { return typeof value === 'string' && stages.includes(value as PresentationStage) }

export function validatePresentationCheckpoint(value: unknown): PresentationCheckpointRecord {
  if (typeof value !== 'object' || value === null) throw new PresentationCheckpointValidationError('invalid', 'The presentation checkpoint is invalid or corrupt.')
  const record = value as Record<string, unknown>
  if (record.checkpointFormatVersion !== PRESENTATION_CHECKPOINT_FORMAT_VERSION || record.presentationPolicyVersion !== PRESENTATION_POLICY_VERSION) {
    throw new PresentationCheckpointValidationError('unsupported', 'The presentation checkpoint format is unsupported.')
  }
  const parsedSessionId = parseDrawSessionId(record.drawSessionId)
  if (!parsedSessionId.ok || !isPresentationStage(record.stage) || !isIsoTimestamp(record.stageStartedAt) || !isIsoTimestamp(record.persistedAt) || typeof record.blackoutRequested !== 'boolean') {
    throw new PresentationCheckpointValidationError('invalid', 'The presentation checkpoint is invalid or corrupt.')
  }
  return {
    drawSessionId: parsedSessionId.value,
    stage: record.stage,
    stageStartedAt: record.stageStartedAt,
    persistedAt: record.persistedAt,
    presentationPolicyVersion: PRESENTATION_POLICY_VERSION,
    checkpointFormatVersion: PRESENTATION_CHECKPOINT_FORMAT_VERSION,
    blackoutRequested: record.blackoutRequested,
  }
}
