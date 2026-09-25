import { describe, expect, it } from 'vitest'
import { evaluateUpdateSafety, type UpdateSafetySnapshot } from './update-safety.ts'

const idle: UpdateSafetySnapshot = {
  workspaceReadable: true,
  liveSessionStatuses: ['ready'],
  recovery: 'normal',
  receiptAmbiguous: false,
  activeRedrawRecovery: false,
  presentationStages: [],
  audience: 'disconnected',
}

describe('evaluateUpdateSafety', () => {
  it('allows an authoritatively readable idle workspace with no Audience', () => expect(evaluateUpdateSafety(idle)).toEqual({ safe: true }))
  it('blocks an unreadable workspace', () => expect(evaluateUpdateSafety({ ...idle, workspaceReadable: false })).toMatchObject({ safe: false, reason: 'workspace-unreadable' }))
  it.each(['drawing', 'pending-confirmation'] as const)('blocks %s Live state', (status) => expect(evaluateUpdateSafety({ ...idle, liveSessionStatuses: [status] })).toMatchObject({ safe: false, reason: 'draw-active' }))
  it('blocks unresolved recovery', () => expect(evaluateUpdateSafety({ ...idle, recovery: 'unresolved' })).toMatchObject({ safe: false, reason: 'recovery-unresolved' }))
  it('blocks conflicting sessions', () => expect(evaluateUpdateSafety({ ...idle, recovery: 'conflicting-sessions' })).toMatchObject({ safe: false, reason: 'conflicting-sessions' }))
  it('blocks receipt ambiguity', () => expect(evaluateUpdateSafety({ ...idle, receiptAmbiguous: true })).toMatchObject({ safe: false, reason: 'receipt-ambiguous' }))
  it('blocks active redraw recovery', () => expect(evaluateUpdateSafety({ ...idle, activeRedrawRecovery: true })).toMatchObject({ safe: false, reason: 'redraw-recovery-active' }))
  it.each(['countdown', 'rolling', 'reveal', 'pending-handoff'] as const)('blocks %s presentation checkpoint', (stage) => expect(evaluateUpdateSafety({ ...idle, presentationStages: [stage] })).toMatchObject({ safe: false, reason: 'presentation-active' }))
  it('blocks a connected Audience even in standby', () => expect(evaluateUpdateSafety({ ...idle, audience: 'connected' })).toMatchObject({ safe: false, reason: 'audience-connected' }))
  it('fails closed when Audience connectivity is ambiguous', () => expect(evaluateUpdateSafety({ ...idle, audience: 'ambiguous' })).toMatchObject({ safe: false, reason: 'audience-ambiguous' }))
})
