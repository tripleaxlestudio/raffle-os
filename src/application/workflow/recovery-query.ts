import type { RecoveryDecision, RecoveryQueryInput } from './recovery.types.ts'

export function decideLiveRecovery(input: RecoveryQueryInput): RecoveryDecision {
  const hasOfficialResult = input.officialWinnerCount > 0
  if (input.checkpointError !== undefined) {
    if (hasOfficialResult && input.sessionStatus === 'pending-confirmation') return { kind: 'pending-handoff', drawSessionId: input.drawSessionId, readOnly: true }
    return { kind: 'typed-failure', code: input.checkpointError === 'unsupported' ? 'unsupported-checkpoint' : input.checkpointError === 'stale' ? 'invalid-winner-relationship' : 'checkpoint-corrupt', retryable: input.checkpointError !== 'stale', message: 'The presentation checkpoint cannot be trusted. Resolve the saved draw state or retry the local read.' }
  }
  if (input.checkpoint !== null) {
    if (input.checkpoint.drawSessionId !== input.drawSessionId) return hasOfficialResult ? { kind: 'pending-handoff', drawSessionId: input.drawSessionId, readOnly: true } : { kind: 'typed-failure', code: 'invalid-winner-relationship', retryable: false, message: 'The saved presentation checkpoint does not match this draw.' }
    const elapsedMs = input.now === undefined ? 0 : Math.max(0, Date.parse(input.now) - Date.parse(input.checkpoint.stageStartedAt))
    return input.now === undefined
      ? { kind: 'resume', drawSessionId: input.drawSessionId, stage: input.checkpoint.stage, blackoutRequested: input.checkpoint.blackoutRequested }
      : { kind: 'resume', drawSessionId: input.drawSessionId, stage: input.checkpoint.stage, blackoutRequested: input.checkpoint.blackoutRequested, elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : 0 }
  }
  if (input.sessionStatus === 'pending-confirmation' && hasOfficialResult) {
    return { kind: 'pending-handoff', drawSessionId: input.drawSessionId, readOnly: true }
  }
  return { kind: 'no-recovery', reason: input.sessionStatus === 'ready' && !hasOfficialResult ? 'ready-without-official-result' : 'no-checkpoint' }
}
