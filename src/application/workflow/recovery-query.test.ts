import { describe, expect, it } from 'vitest'
import { decideLiveRecovery } from './recovery-query.ts'

const session = '11111111-1111-4111-8111-111111111111' as never
const checkpoint = { drawSessionId: session, stage: 'reveal' as const, stageStartedAt: '2026-08-05T01:00:00.000Z' as never, persistedAt: '2026-08-05T01:00:01.000Z' as never, presentationPolicyVersion: 1 as const, checkpointFormatVersion: 1 as const, blackoutRequested: true }

describe('live recovery decision', () => {
  it('resumes a valid checkpoint without reselection', () => expect(decideLiveRecovery({ sessionStatus: 'drawing', drawSessionId: session, checkpoint, officialWinnerCount: 1 })).toEqual({ kind: 'resume', drawSessionId: session, stage: 'reveal', blackoutRequested: true }))
  it('hands off pending results when checkpoint is missing or invalid upstream', () => expect(decideLiveRecovery({ sessionStatus: 'pending-confirmation', drawSessionId: session, checkpoint: null, officialWinnerCount: 1 })).toEqual({ kind: 'pending-handoff', drawSessionId: session, readOnly: true }))
  it('does not recover a ready session without official results', () => expect(decideLiveRecovery({ sessionStatus: 'ready', drawSessionId: session, checkpoint: null, officialWinnerCount: 0 })).toEqual({ kind: 'no-recovery', reason: 'ready-without-official-result' }))
})
