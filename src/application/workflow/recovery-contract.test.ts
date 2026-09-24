import { describe, expect, it } from 'vitest'
import { decideRecovery, checkpointForSession, type RecoveryContractInput } from './recovery-contract.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'

const sessionId = '11111111-1111-4111-8111-111111111111' as never
const otherSessionId = '22222222-2222-4222-8222-222222222222' as never
const session = { id: sessionId, eventId: '33333333-3333-4333-8333-333333333333', configurationId: '44444444-4444-4444-8444-444444444444', mode: 'live', status: 'drawing', configurationSnapshot: { snapshotFormatVersion: 1, configurationId: '44444444-4444-4444-8444-444444444444', prizeCategoryId: '55555555-5555-4555-8555-555555555555', categoryName: 'Prize', prizeName: 'Prize', requestedWinners: 1, winningRule: 'allow-repeat', requireCheckIn: false, eligibleGroupFilter: null, capturedAt: '2026-08-05T00:00:00.000Z', }, candidatePoolSnapshot: { snapshotFormatVersion: 1, eventId: '33333333-3333-4333-8333-333333333333', configurationId: '44444444-4444-4444-8444-444444444444', prizeCategoryId: '55555555-5555-4555-8555-555555555555', mode: 'live', capturedAt: '2026-08-05T00:00:00.000Z', winningRule: 'allow-repeat', requireCheckIn: false, eligibleGroupFilter: null, candidateEntries: [{ participantId: '66666666-6666-4666-8666-666666666666', ticketNumber: '00042' }], eligibleSnapshotCount: 1 }, createdAt: '2026-08-05T00:00:00.000Z', updatedAt: '2026-08-05T00:00:00.000Z' } as unknown as DrawSession
const winner = { id: '77777777-7777-4777-8777-777777777777', eventId: session.eventId, prizeCategoryId: session.configurationSnapshot?.prizeCategoryId, drawSessionId: sessionId, participantId: '66666666-6666-4666-8666-666666666666', ticketNumber: '00042', sequenceNumber: 1, status: 'pending', createdAt: '2026-08-05T00:00:01.000Z', updatedAt: '2026-08-05T00:00:01.000Z' } as unknown as WinnerRecord

function input(overrides: Partial<RecoveryContractInput> = {}): RecoveryContractInput {
  return { session, winners: [], redraws: [], receipts: [], checkpoint: { kind: 'absent' }, ...overrides }
}

describe('Phase 10.1 recovery contract', () => {
  it('requires explicit acknowledgement when drawing has no persisted result', () => expect(decideRecovery(input())).toMatchObject({ kind: 'safe-acknowledgement-required', reason: 'selection-outcome-unknown' }))
  it('treats a checkpoint before selection as presentation interruption only', () => expect(decideRecovery(input({ session: { ...session, status: 'ready' }, checkpoint: { kind: 'matching', checkpoint: { drawSessionId: sessionId, stage: 'rolling', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, persistedAt: '2026-08-05T00:00:00.100Z' as never, presentationPolicyVersion: 1, checkpointFormatVersion: 1, blackoutRequested: false } } })).kind).toBe('resume-setup'))
  it('returns exact official records and snapshots for persisted winners', () => {
    const decision = decideRecovery(input({ winners: [winner] }))
    expect(decision).toMatchObject({ kind: 'resume-pending', winners: [winner], session: { id: sessionId, candidatePoolSnapshot: session.candidatePoolSnapshot } })
  })
  it('uses terminal sessions as read-only history', () => expect(decideRecovery(input({ session: { ...session, status: 'completed' }, winners: [winner] }))).toMatchObject({ kind: 'terminal', winners: [winner] }))
  it('resolves committed receipts before recovery interpretation', () => expect(decideRecovery(input({ receipts: [{ status: 'committed' } as never] }))).toMatchObject({ kind: 'safe-acknowledgement-required', reason: 'selection-outcome-unknown', receipts: { kind: 'committed' } }))
  it('does not let an unresolved receipt be treated as absent', () => expect(decideRecovery(input({ receipts: [{ status: 'started' } as never] }))).toMatchObject({ kind: 'safe-acknowledgement-required', reason: 'receipt-unresolved' }))
  it('preserves winner identity and ticket strings across repeated evaluation', () => {
    const first = decideRecovery(input({ winners: [winner], checkpoint: checkpointForSession(sessionId, null) }))
    const second = decideRecovery(input({ winners: [winner], checkpoint: checkpointForSession(sessionId, null) }))
    expect(second).toEqual(first)
    expect(first).toMatchObject({ winners: [{ id: winner.id, ticketNumber: '00042' }] })
  })
  it('marks a checkpoint from another session without overriding official state', () => expect(decideRecovery(input({ winners: [winner], checkpoint: checkpointForSession(sessionId, { drawSessionId: otherSessionId, stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, persistedAt: '2026-08-05T00:00:00.000Z' as never, presentationPolicyVersion: 1, checkpointFormatVersion: 1, blackoutRequested: false }) }))).toMatchObject({ kind: 'resume-pending', checkpoint: { kind: 'other-session' } }))
  it('requires acknowledgement for a foreign checkpoint when no official winner exists', () => expect(decideRecovery(input({ checkpoint: checkpointForSession(sessionId, { drawSessionId: otherSessionId, stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, persistedAt: '2026-08-05T00:00:00.000Z' as never, presentationPolicyVersion: 1, checkpointFormatVersion: 1, blackoutRequested: false }) }))).toMatchObject({ kind: 'safe-acknowledgement-required', reason: 'checkpoint-conflict', checkpoint: { kind: 'other-session' } }))
  it('does not treat pending-confirmation without a winner as setup recovery', () => expect(decideRecovery(input({ session: { ...session, status: 'pending-confirmation' } }))).toMatchObject({ kind: 'safe-acknowledgement-required', reason: 'selection-outcome-unknown' }))
})
