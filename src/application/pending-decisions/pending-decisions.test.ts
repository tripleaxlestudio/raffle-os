import { describe, expect, it } from 'vitest'
import { canTransitionWinnerStatus, transitionWinnerStatus } from '../../domain/winners/winner.invariants.ts'
import { resolveDrawSession, resolveWinnerStatus } from '../../domain/pending-decisions/lifecycle.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { CommandId, DrawSessionId, EventId, ParticipantId, PrizeCategoryId, WinnerRecordId } from '../../domain/shared/identifiers.ts'
import type { TicketNumber } from '../../domain/participants/participant.types.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import { areEquivalentDecisionPayloads, canonicalizeDecisionPayload, validateAllowedCommandTransition, validateCommandPayloadConflict, validateCommandTargets, validateLiveMutationCommand, validateLiveMutationMode } from './index.ts'
import type { CancelPendingWinnersCommand, ConfirmPendingWinnersCommand, RedrawConfirmedWinnersCommand } from './index.ts'

const at = '2026-08-05T10:00:00.000Z' as IsoTimestamp
const eventId = 'event' as EventId
const sessionId = 'session' as DrawSessionId
const categoryId = 'category' as PrizeCategoryId

function winner(id: string, status: WinnerRecord['status'], ticketNumber: string): WinnerRecord {
  return { id: id as WinnerRecordId, eventId, prizeCategoryId: categoryId, drawSessionId: sessionId, participantId: `participant-${id}` as ParticipantId, ticketNumber: ticketNumber as TicketNumber, sequenceNumber: 1, status, createdAt: at, updatedAt: at, ...(status === 'confirmed' ? { confirmedAt: at } : {}), ...(status === 'cancelled' ? { cancelledAt: at } : {}) }
}

function session(status: DrawSession['status']): DrawSession {
  return { id: sessionId, eventId, configurationId: 'configuration' as DrawSession['configurationId'], mode: 'live', status, configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: at, updatedAt: at }
}

const confirm: ConfirmPendingWinnersCommand = { actor: 'local-operator', commandId: 'command-confirm' as CommandId, drawSessionId: sessionId, mode: 'live', operation: 'confirm-pending-winners', targets: [{ expectedStatus: 'pending', winnerId: 'winner-1' as WinnerRecordId }] }
const cancel: CancelPendingWinnersCommand = { ...confirm, commandId: 'command-cancel' as CommandId, operation: 'cancel-pending-winners', reason: 'other', note: 'Operator verified the result.' }
const redrawConfirmed: RedrawConfirmedWinnersCommand = { ...confirm, commandId: 'command-redraw' as CommandId, operation: 'redraw-confirmed-winners', reason: 'invalid-ticket', targets: [{ expectedStatus: 'confirmed', winnerId: 'winner-1' as WinnerRecordId }] }

function errorCode<T>(result: { readonly ok: false; readonly error: { readonly code: string } } | { readonly ok: true; readonly value: T }): string {
  if (result.ok) throw new Error('Expected a failed result.')
  return result.error.code
}

describe('Phase 8 winner lifecycle contracts', () => {
  it('allows only valid WinnerRecord transition edges', () => {
    expect(canTransitionWinnerStatus('pending', 'confirmed')).toBe(true)
    expect(canTransitionWinnerStatus('pending', 'cancelled')).toBe(true)
    expect(canTransitionWinnerStatus('confirmed', 'cancelled', { auditedRedraw: true })).toBe(true)
    expect(canTransitionWinnerStatus('confirmed', 'cancelled')).toBe(false)
    expect(canTransitionWinnerStatus('confirmed', 'confirmed')).toBe(false)
    expect(canTransitionWinnerStatus('cancelled', 'pending')).toBe(false)
    expect(canTransitionWinnerStatus('cancelled', 'cancelled')).toBe(false)
    expect(canTransitionWinnerStatus('cancelled', 'confirmed')).toBe(false)
    expect(canTransitionWinnerStatus('pending', 'pending')).toBe(false)
    expect(transitionWinnerStatus(winner('winner-1', 'confirmed', '00042'), 'cancelled', at, { auditedRedraw: true }).ok).toBe(true)
  })

  it('resolves pending, partial, completed, and all-cancelled sessions', () => {
    expect(resolveWinnerStatus(['pending', 'confirmed'])).toBe('pending-confirmation')
    expect(resolveWinnerStatus(['pending', 'pending'])).toBe('pending-confirmation')
    expect(resolveWinnerStatus(['confirmed', 'cancelled'])).toBe('completed')
    expect(resolveWinnerStatus(['cancelled', 'cancelled'])).toBe('cancelled')
    const reopened = resolveDrawSession(session('completed'), [winner('winner-1', 'pending', '00042')], at)
    const completed = resolveDrawSession(session('pending-confirmation'), [winner('winner-1', 'confirmed', '00042')], at)
    expect(reopened.ok && reopened.value.status).toBe('pending-confirmation')
    expect(completed.ok && completed.value.status).toBe('completed')
    expect(errorCode(resolveDrawSession(session('completed'), [winner('winner-1', 'cancelled', '00042')], at))).toBe('invalid-lifecycle-transition')
  })

  it('keeps a confirmed-original redraw replacement pending', () => {
    expect(resolveWinnerStatus(['cancelled', 'pending'])).toBe('pending-confirmation')
    expect(redrawConfirmed.operation).toBe('redraw-confirmed-winners')
  })
})

describe('Phase 8 command contracts', () => {
  it('rejects empty, duplicate, mixed-session, and stale targets', () => {
    expect(errorCode(validateLiveMutationCommand({ ...confirm, targets: [] }))).toBe('empty-targets')
    expect(errorCode(validateLiveMutationCommand({ ...confirm, targets: [confirm.targets[0], confirm.targets[0]] }))).toBe('duplicate-target-ids')
    expect(errorCode(validateCommandTargets({ ...confirm, targets: [confirm.targets[0], { winnerId: 'winner-2' as WinnerRecordId, expectedStatus: 'pending' }] }, session('pending-confirmation'), [winner('winner-1', 'pending', '00042'), { ...winner('winner-2', 'pending', '42'), drawSessionId: 'other-session' as DrawSessionId }]))).toBe('target-session-mismatch')
    expect(errorCode(validateCommandTargets(confirm, session('pending-confirmation'), [{ ...winner('winner-1', 'pending', '00042'), drawSessionId: 'other-session' as DrawSessionId }]))).toBe('target-session-mismatch')
    expect(errorCode(validateCommandTargets(confirm, session('pending-confirmation'), [winner('winner-1', 'confirmed', '00042')]))).toBe('stale-expected-status')
  })

  it('requires Live mode and validates reason notes', () => {
    expect(errorCode(validateLiveMutationMode('practice'))).toBe('unsupported-mode')
    expect(errorCode(validateLiveMutationCommand({ ...cancel, note: '   ' }))).toBe('invalid-reason-note')
    expect(errorCode(validateLiveMutationCommand({ ...cancel, reason: 'not-a-reason' as never }))).toBe('invalid-reason')
    expect(errorCode(validateLiveMutationCommand({ ...cancel, reason: 'absent', note: '   ' }))).toBe('invalid-reason-note')
    expect(errorCode(validateAllowedCommandTransition(redrawConfirmed.operation, 'pending'))).toBe('invalid-lifecycle-transition')
    expect(validateAllowedCommandTransition(redrawConfirmed.operation, 'confirmed').ok).toBe(true)
  })

  it('preserves exact ticket strings during target validation', () => {
    const selected = validateCommandTargets(confirm, session('pending-confirmation'), [winner('winner-1', 'pending', '00042')])
    expect(selected.ok && selected.value[0].ticketNumber).toBe('00042')
    const distinct = validateCommandTargets({ ...confirm, targets: [{ winnerId: 'winner-2' as WinnerRecordId, expectedStatus: 'pending' }] }, session('pending-confirmation'), [winner('winner-2', 'pending', '42')])
    expect(distinct.ok && distinct.value[0].ticketNumber).toBe('42')
  })

  it('canonicalizes equivalent payloads and detects command ID conflicts', () => {
    const left = canonicalizeDecisionPayload(cancel)
    const right = canonicalizeDecisionPayload({ ...cancel, targets: [...cancel.targets].reverse() })
    expect(areEquivalentDecisionPayloads(left, right)).toBe(true)
    expect(validateCommandPayloadConflict(left, right).ok).toBe(true)
    expect(errorCode(validateCommandPayloadConflict(left, canonicalizeDecisionPayload({ ...cancel, reason: 'absent' })))).toBe('command-id-payload-conflict')
  })
})
