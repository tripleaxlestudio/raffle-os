import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'
import type { Result } from '../../domain/shared/result.ts'
import type { WinnerRecord, WinnerStatus } from '../../domain/winners/winner.types.ts'
import { LOCAL_OPERATOR, type CanonicalDecisionPayload, type DecisionReason, type PendingDecisionCommand, type DecisionTarget } from './command.types.ts'

export type PendingDecisionErrorCode =
  | 'missing-session'
  | 'non-live-session'
  | 'invalid-targets'
  | 'empty-targets'
  | 'target-session-mismatch'
  | 'stale-expected-status'
  | 'duplicate-target-ids'
  | 'command-id-payload-conflict'
  | 'invalid-reason'
  | 'invalid-reason-note'
  | 'insufficient-redraw-capacity'
  | 'invalid-lifecycle-transition'
  | 'unsupported-mode'
  | 'invalid-command-id'
  | 'storage-failure'
  | 'update-in-progress'
  | 'unknown-outcome'

export type PendingDecisionErrorKind = 'not-found' | 'validation' | 'conflict' | 'capacity' | 'transition' | 'storage' | 'unknown'

export interface PendingDecisionError {
  readonly kind: PendingDecisionErrorKind
  readonly code: PendingDecisionErrorCode
  readonly message: string
  readonly commandId?: string
  readonly winnerId?: string
}

function error(kind: PendingDecisionErrorKind, code: PendingDecisionErrorCode, message: string): Result<never, PendingDecisionError> {
  return { ok: false, error: { code, kind, message } }
}

export function validateLiveMutationCommand(command: PendingDecisionCommand): Result<PendingDecisionCommand, PendingDecisionError> {
  if (command.commandId.trim().length === 0) return error('validation', 'invalid-command-id', 'A caller-generated command ID is required.')
  if (command.actor !== LOCAL_OPERATOR) return error('validation', 'invalid-targets', 'Pending decision commands require the local operator actor.')
  if (command.mode !== 'live') return error('validation', 'unsupported-mode', 'Pending decision commands are supported only for Live sessions.')
  if (command.targets.length === 0) return error('validation', 'empty-targets', 'At least one winner target is required.')
  if (new Set(command.targets.map((target) => target.winnerId)).size !== command.targets.length) {
    return error('validation', 'duplicate-target-ids', 'Winner targets must not contain duplicate IDs.')
  }
  if ('reason' in command && !isDecisionReason(command.reason)) return error('validation', 'invalid-reason', 'The decision reason is not supported.')
  if ('reason' in command && command.reason === 'other' && (command.note === undefined || command.note.trim().length === 0)) {
    return error('validation', 'invalid-reason-note', 'The other reason requires a non-empty note.')
  }
  if ('note' in command && command.note !== undefined && command.note.trim().length === 0) {
    return error('validation', 'invalid-reason-note', 'A decision note must not be empty.')
  }
  return { ok: true, value: command }
}

export function validateLiveMutationMode(mode: AppMode): Result<'live', PendingDecisionError> {
  return mode === 'live' ? { ok: true, value: mode } : error('validation', 'unsupported-mode', 'Pending decision mutations are supported only for Live sessions.')
}

export function validateAllowedCommandTransition(operation: PendingDecisionCommand['operation'], status: WinnerStatus): Result<true, PendingDecisionError> {
  const allowed = operation === 'redraw-confirmed-winners' ? status === 'confirmed' : status === 'pending'
  return allowed ? { ok: true, value: true } : error('transition', 'invalid-lifecycle-transition', `The ${operation} command cannot target a ${status} winner.`)
}

export function validateCommandTargets(command: PendingDecisionCommand, session: DrawSession | null, winners: readonly WinnerRecord[]): Result<readonly WinnerRecord[], PendingDecisionError> {
  const commandResult = validateLiveMutationCommand(command)
  if (!commandResult.ok) return commandResult
  if (session === null) return error('not-found', 'missing-session', 'The requested DrawSession was not found.')
  if (session.mode !== 'live') return error('validation', 'non-live-session', 'Pending decision mutations require a Live DrawSession.')
  const byId = new Map(winners.map((winner) => [winner.id, winner]))
  const selected: WinnerRecord[] = []
  for (const target of command.targets) {
    const winner = byId.get(target.winnerId)
    if (winner === undefined) return error('validation', 'invalid-targets', 'Every target must identify an existing WinnerRecord.')
    if (winner.drawSessionId !== session.id || winner.eventId !== session.eventId) return error('conflict', 'target-session-mismatch', 'Every target must belong to the command session and event.')
    if (winner.status !== target.expectedStatus) return error('conflict', 'stale-expected-status', 'A target no longer has its expected status.')
    selected.push(winner)
  }
  return { ok: true, value: selected }
}

export function isDecisionReason(value: unknown): value is DecisionReason {
  return value === 'absent' || value === 'invalid-ticket' || value === 'ineligible' || value === 'previous-winner' || value === 'operator-error' || value === 'other'
}

export function canonicalizeDecisionPayload(command: PendingDecisionCommand): CanonicalDecisionPayload {
  const targets = [...command.targets].sort((left, right) => left.winnerId.localeCompare(right.winnerId)).map((target) => ({ winnerId: target.winnerId, expectedStatus: target.expectedStatus }))
  return 'reason' in command
    ? { drawSessionId: command.drawSessionId, note: command.note?.trim(), operation: command.operation, reason: command.reason, targets }
    : { drawSessionId: command.drawSessionId, operation: command.operation, targets }
}

export function areEquivalentDecisionPayloads(left: CanonicalDecisionPayload, right: CanonicalDecisionPayload): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function validateCommandPayloadConflict(existing: CanonicalDecisionPayload, incoming: CanonicalDecisionPayload): Result<true, PendingDecisionError> {
  return areEquivalentDecisionPayloads(existing, incoming)
    ? { ok: true, value: true }
    : error('conflict', 'command-id-payload-conflict', 'The command ID was already used with a different payload.')
}

export function validateExpectedStatuses(targets: readonly DecisionTarget[], expected: WinnerStatus): Result<true, PendingDecisionError> {
  if (targets.some((target) => target.expectedStatus !== expected)) return error('validation', 'stale-expected-status', `All targets must expect status ${expected}.`)
  return { ok: true, value: true }
}
