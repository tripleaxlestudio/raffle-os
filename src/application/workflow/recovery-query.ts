import { StaleCheckpointError } from '../../infrastructure/persistence/errors/persistence-errors.ts'
import type { RecoveryDecision, RecoveryQueryInput } from './recovery.types.ts'

export function decideLiveRecovery(input: RecoveryQueryInput): RecoveryDecision {
  const hasOfficialResult = input.officialWinnerCount > 0
  if (input.checkpoint !== null && input.checkpoint.drawSessionId !== input.drawSessionId) {
    throw new StaleCheckpointError('The checkpoint belongs to a different DrawSession.')
  }
  if (input.checkpoint !== null) {
    return { kind: 'resume', drawSessionId: input.drawSessionId, stage: input.checkpoint.stage, blackoutRequested: input.checkpoint.blackoutRequested }
  }
  if (input.sessionStatus === 'pending-confirmation' && hasOfficialResult) {
    return { kind: 'pending-handoff', drawSessionId: input.drawSessionId, readOnly: true }
  }
  return { kind: 'no-recovery', reason: input.sessionStatus === 'ready' && !hasOfficialResult ? 'ready-without-official-result' : 'no-checkpoint' }
}
