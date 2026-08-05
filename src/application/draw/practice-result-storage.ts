import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import { LiveStartGateError } from './live-start-gate-errors.ts'

const PREFIX = 'raffle-os:practice-result:v1:'

export interface PracticeResultProjection {
  readonly drawSessionId: DrawSessionId
  readonly winners: readonly { readonly winnerId: WinnerRecord['id']; readonly sequence: number; readonly ticketNumber: WinnerRecord['ticketNumber'] }[]
  readonly createdAt: string
  readonly policyVersion: 1
}

function key(id: DrawSessionId): string { return `${PREFIX}${id}` }

function storage(): Storage {
  try {
    if (typeof globalThis.sessionStorage === 'undefined') throw new Error('sessionStorage unavailable')
    return globalThis.sessionStorage
  } catch (cause: unknown) {
    throw new LiveStartGateError('practice-session-storage-unavailable', 'Practice result cannot be retained in this tab because session storage is unavailable.', 'unavailable-capability', cause)
  }
}

export function savePracticeResult(result: PracticeResultProjection): void {
  try {
    storage().setItem(key(result.drawSessionId), JSON.stringify(result))
  } catch (cause: unknown) {
    if (cause instanceof LiveStartGateError) throw cause
    throw new LiveStartGateError('practice-session-storage-write-failure', 'Practice result could not be retained in this tab. No official result was created.', 'retryable', cause)
  }
}

export function readPracticeResult(drawSessionId: DrawSessionId): PracticeResultProjection | null {
  try {
    const raw = storage().getItem(key(drawSessionId))
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || (parsed as { drawSessionId?: unknown }).drawSessionId !== drawSessionId) return null
    return parsed as PracticeResultProjection
  } catch (cause: unknown) {
    if (cause instanceof LiveStartGateError) throw cause
    throw new LiveStartGateError('practice-session-storage-unavailable', 'The Practice result could not be read safely from this tab.', 'retryable', cause)
  }
}

export function practiceResultFromWinners(drawSessionId: DrawSessionId, winners: readonly WinnerRecord[], createdAt: string): PracticeResultProjection {
  return { drawSessionId, winners: winners.map((winner) => ({ winnerId: winner.id, sequence: winner.sequenceNumber, ticketNumber: winner.ticketNumber })), createdAt, policyVersion: 1 }
}
