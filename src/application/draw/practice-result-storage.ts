import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import { parseDrawSessionId, parseWinnerRecordId } from '../../domain/shared/identifiers.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import { isIsoTimestamp } from '../../domain/shared/timestamps.ts'
import { LiveStartGateError } from './live-start-gate-errors.ts'

const PREFIX = 'raffle-os:practice-result:v1:'

export interface PracticeResultProjection {
  readonly drawSessionId: DrawSessionId
  readonly winners: readonly { readonly winnerId: WinnerRecord['id']; readonly sequence: number; readonly ticketNumber: WinnerRecord['ticketNumber'] }[]
  readonly createdAt: string
  readonly policyVersion: 1
}

function key(id: DrawSessionId): string { return `${PREFIX}${id}` }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = new Set(keys)
  return Object.keys(value).every((key) => expected.has(key)) && keys.every((key) => key in value)
}

function isValidProjection(value: unknown, drawSessionId: DrawSessionId): value is PracticeResultProjection {
  if (!isRecord(value) || !hasOnlyKeys(value, ['drawSessionId', 'winners', 'createdAt', 'policyVersion'])) return false
  if (value.drawSessionId !== drawSessionId || value.policyVersion !== 1 || typeof value.createdAt !== 'string' || !isIsoTimestamp(value.createdAt)) return false
  if (!parseDrawSessionId(value.drawSessionId).ok || !Array.isArray(value.winners) || value.winners.length < 1 || value.winners.length > 100) return false

  const sequences = new Set<number>()
  const winnerIds = new Set<string>()
  const ticketNumbers = new Set<string>()
  for (const entry of value.winners) {
    if (!isRecord(entry) || !hasOnlyKeys(entry, ['winnerId', 'sequence', 'ticketNumber'])) return false
    if (typeof entry.winnerId !== 'string' || !parseWinnerRecordId(entry.winnerId).ok || winnerIds.has(entry.winnerId) || typeof entry.sequence !== 'number' || !Number.isInteger(entry.sequence) || entry.sequence < 1 || sequences.has(entry.sequence) || typeof entry.ticketNumber !== 'string' || entry.ticketNumber.length === 0 || ticketNumbers.has(entry.ticketNumber)) return false
    sequences.add(entry.sequence)
    winnerIds.add(entry.winnerId)
    ticketNumbers.add(entry.ticketNumber)
  }

  return [...sequences].sort((left, right) => left - right).every((sequence, index) => sequence === index + 1)
}

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
    let parsed: unknown
    try {
      parsed = JSON.parse(raw) as unknown
    } catch {
      return null
    }
    return isValidProjection(parsed, drawSessionId) ? parsed : null
  } catch (cause: unknown) {
    if (cause instanceof LiveStartGateError) throw cause
    throw new LiveStartGateError('practice-session-storage-unavailable', 'The Practice result could not be read safely from this tab.', 'retryable', cause)
  }
}

export function practiceResultFromWinners(drawSessionId: DrawSessionId, winners: readonly WinnerRecord[], createdAt: string): PracticeResultProjection {
  return { drawSessionId, winners: winners.map((winner) => ({ winnerId: winner.id, sequence: winner.sequenceNumber, ticketNumber: winner.ticketNumber })), createdAt, policyVersion: 1 }
}
