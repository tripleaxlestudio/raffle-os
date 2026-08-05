import { parseTicketNumber } from '../../domain/participants/participant.invariants.ts'
import type { TicketNumber } from '../../domain/participants/participant.types.ts'
import { parseDrawSessionId, type DrawSessionId } from '../../domain/shared/identifiers.ts'
import { isIsoTimestamp, type IsoTimestamp } from '../../domain/shared/timestamps.ts'
import type { PublicDisplayStage, PublicWinnerStatus } from './protocol.ts'

export type PublicProjectionStage = 'standby' | 'countdown' | 'rolling' | 'reveal' | 'pending-handoff'
export type PublicProjectionMode = 'practice' | 'live'

export type PublicDisplaySnapshot = Readonly<{
  readonly drawSessionId: DrawSessionId
  readonly stage: PublicProjectionStage
  readonly stageStartedAt?: IsoTimestamp
  readonly blackoutRequested: boolean
  readonly mode?: PublicProjectionMode
  readonly ticketNumbers?: readonly TicketNumber[]
  readonly winnerStatuses?: readonly PublicWinnerStatus[]
}>

export type PresentationProjectionSource = Readonly<{
  readonly drawSessionId: DrawSessionId
  readonly stage: 'ready' | PublicProjectionStage
  readonly stageStartedAt?: IsoTimestamp
  readonly blackoutRequested: boolean
  readonly mode?: PublicProjectionMode
  readonly result?: Readonly<{
    readonly drawSessionId: DrawSessionId
    readonly winners: readonly Readonly<{ readonly sequence: number; readonly ticketNumber: string; readonly status?: PublicWinnerStatus }>[]
  }>
}>

export type PublicProjectionErrorCode =
  | 'invalid-source'
  | 'invalid-ticket'
  | 'session-mismatch'
  | 'invalid-public-snapshot'

export class PublicProjectionError extends Error {
  readonly code: PublicProjectionErrorCode
  readonly expectedSession?: string
  readonly receivedSession?: string

  constructor(code: PublicProjectionErrorCode, message: string, details: { expectedSession?: string; receivedSession?: string } = {}) {
    super(message)
    this.name = 'PublicProjectionError'
    this.code = code
    this.expectedSession = details.expectedSession
    this.receivedSession = details.receivedSession
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const isStage = (value: unknown): value is PresentationProjectionSource['stage'] => value === 'ready' || value === 'standby' || value === 'countdown' || value === 'rolling' || value === 'reveal' || value === 'pending-handoff'
const isMode = (value: unknown): value is PublicProjectionMode => value === 'practice' || value === 'live'
const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).every((key) => keys.includes(key))

function freezeSnapshot(snapshot: PublicDisplaySnapshot): PublicDisplaySnapshot {
  if (snapshot.ticketNumbers !== undefined) Object.freeze(snapshot.ticketNumbers)
  return Object.freeze(snapshot)
}

function invalidSource(message: string): never {
  throw new PublicProjectionError('invalid-source', message)
}

function sessionMismatch(expected: string, received: string | undefined): never {
  throw new PublicProjectionError('session-mismatch', 'The public projection session does not match its source session.', { expectedSession: expected, receivedSession: received })
}

function parsePublicTicket(ticket: unknown): TicketNumber {
  const parsed = parseTicketNumber(ticket)
  if (!parsed.ok) throw new PublicProjectionError('invalid-ticket', parsed.error.message)
  return parsed.value
}

function projectTickets(source: Record<string, unknown>, drawSessionId: string): Readonly<{ readonly tickets: readonly TicketNumber[]; readonly statuses?: readonly PublicWinnerStatus[] }> {
  const result = source.result
  if (!isRecord(result) || result.drawSessionId !== drawSessionId || !Array.isArray(result.winners)) {
    if (isRecord(result) && result.drawSessionId !== drawSessionId) sessionMismatch(drawSessionId, typeof result.drawSessionId === 'string' ? result.drawSessionId : undefined)
    invalidSource('A reveal or pending projection requires a matching result list.')
  }
  const winners = result.winners
  const tickets: TicketNumber[] = []
  const statuses: PublicWinnerStatus[] = []
  let hasStatuses = false
  winners.forEach((winner, index) => {
    if (!isRecord(winner) || winner.sequence !== index + 1) invalidSource('Public result sequence or ticket data is invalid.')
    tickets.push(parsePublicTicket(winner.ticketNumber))
    if (winner.status !== undefined && winner.status !== 'pending' && winner.status !== 'confirmed') invalidSource('Public winner status is invalid.')
    if (winner.status !== undefined) hasStatuses = true
    statuses.push(winner.status ?? 'pending')
  })
  if (tickets.length > 100) invalidSource('Public result must contain at most one hundred tickets.')
  return { tickets: Object.freeze(tickets), statuses: hasStatuses ? Object.freeze(statuses) : undefined }
}

export function projectPublicDisplaySnapshot(source: PresentationProjectionSource): PublicDisplaySnapshot {
  const value: unknown = source
  if (!isRecord(value) || !isNonEmptyString(value.drawSessionId) || !isStage(value.stage) || typeof value.blackoutRequested !== 'boolean' || (value.mode !== undefined && !isMode(value.mode))) invalidSource('Presentation source is malformed.')
  const parsedSession = parseDrawSessionId(value.drawSessionId)
  if (!parsedSession.ok) invalidSource('Presentation source session is malformed.')
  if (value.stage !== 'ready' && value.stage !== 'standby' && (value.stageStartedAt === undefined || !isIsoTimestamp(value.stageStartedAt))) invalidSource('A non-standby presentation stage requires a valid timestamp.')
  const stage: PublicProjectionStage = value.stage === 'ready' ? 'standby' : value.stage
  const projected = stage === 'reveal' || stage === 'pending-handoff' ? projectTickets(value, parsedSession.value) : undefined
  const snapshot: PublicDisplaySnapshot = {
    drawSessionId: parsedSession.value,
    stage,
    ...(value.stageStartedAt === undefined ? {} : { stageStartedAt: value.stageStartedAt as IsoTimestamp }),
    blackoutRequested: value.blackoutRequested,
    ...(value.mode === undefined ? {} : { mode: value.mode }),
    ...(projected === undefined ? {} : { ticketNumbers: projected.tickets, winnerStatuses: projected.statuses }),
  }
  return freezeSnapshot(snapshot)
}

export function serializePublicDisplaySnapshot(snapshot: PublicDisplaySnapshot): string {
  return JSON.stringify({
    drawSessionId: snapshot.drawSessionId,
    stage: snapshot.stage,
    ...(snapshot.stageStartedAt === undefined ? {} : { stageStartedAt: snapshot.stageStartedAt }),
    blackoutRequested: snapshot.blackoutRequested,
    ...(snapshot.mode === undefined ? {} : { mode: snapshot.mode }),
    ...(snapshot.ticketNumbers === undefined ? {} : { ticketNumbers: [...snapshot.ticketNumbers] }),
    ...(snapshot.winnerStatuses === undefined ? {} : { winnerStatuses: [...snapshot.winnerStatuses] }),
  })
}

export function parsePublicDisplaySnapshot(value: unknown, expectedSession?: DrawSessionId): PublicDisplaySnapshot {
  if (!isRecord(value) || !isNonEmptyString(value.drawSessionId) || !isStage(value.stage) || value.stage === 'ready' || typeof value.blackoutRequested !== 'boolean' || (value.mode !== undefined && !isMode(value.mode))) throw new PublicProjectionError('invalid-public-snapshot', 'The public display snapshot is malformed.')
  if (!hasOnlyKeys(value, ['drawSessionId', 'stage', 'stageStartedAt', 'blackoutRequested', 'mode', 'ticketNumbers', 'winnerStatuses'])) throw new PublicProjectionError('invalid-public-snapshot', 'The public display snapshot contains unsupported fields.')
  const parsedSession = parseDrawSessionId(value.drawSessionId)
  if (!parsedSession.ok) throw new PublicProjectionError('invalid-public-snapshot', 'The public display snapshot session is malformed.')
  if (expectedSession !== undefined && value.drawSessionId !== expectedSession) sessionMismatch(expectedSession, value.drawSessionId)
  if (value.stage !== 'standby' && (value.stageStartedAt === undefined || !isIsoTimestamp(value.stageStartedAt))) throw new PublicProjectionError('invalid-public-snapshot', 'The public display snapshot timestamp is invalid.')
  const needsTickets = value.stage === 'reveal' || value.stage === 'pending-handoff'
  if (needsTickets && value.ticketNumbers === undefined) throw new PublicProjectionError('invalid-public-snapshot', 'This public display stage requires tickets.')
  if (!needsTickets && value.ticketNumbers !== undefined) throw new PublicProjectionError('invalid-public-snapshot', 'This public display stage cannot carry tickets.')
  if (value.ticketNumbers !== undefined && (!Array.isArray(value.ticketNumbers) || value.ticketNumbers.length > 100 || value.ticketNumbers.some((ticket) => !isNonEmptyString(ticket) || !parseTicketNumber(ticket).ok))) throw new PublicProjectionError('invalid-public-snapshot', 'The public display ticket list is invalid.')
  if (value.winnerStatuses !== undefined && (!Array.isArray(value.winnerStatuses) || value.winnerStatuses.length !== (Array.isArray(value.ticketNumbers) ? value.ticketNumbers.length : 0) || value.winnerStatuses.some((status) => status !== 'pending' && status !== 'confirmed'))) throw new PublicProjectionError('invalid-public-snapshot', 'The public display winner statuses are invalid.')
  const tickets = value.ticketNumbers === undefined ? undefined : Object.freeze(value.ticketNumbers.map(parsePublicTicket))
  return freezeSnapshot({
    drawSessionId: parsedSession.value,
    stage: value.stage,
    ...(value.stageStartedAt === undefined ? {} : { stageStartedAt: value.stageStartedAt as IsoTimestamp }),
    blackoutRequested: value.blackoutRequested,
    ...(value.mode === undefined ? {} : { mode: value.mode }),
    ...(tickets === undefined ? {} : { ticketNumbers: tickets }),
    ...(value.winnerStatuses === undefined ? {} : { winnerStatuses: Object.freeze([...value.winnerStatuses] as PublicWinnerStatus[]) }),
  })
}

export const publicSnapshotToProtocolState = (snapshot: PublicDisplaySnapshot) => ({
  type: 'display-state' as const,
  stage: snapshot.stage as PublicDisplayStage,
  drawSessionId: snapshot.drawSessionId,
  ...(snapshot.stageStartedAt === undefined ? {} : { stageStartedAt: snapshot.stageStartedAt }),
  blackoutRequested: snapshot.blackoutRequested,
  ...(snapshot.mode === undefined ? {} : { mode: snapshot.mode }),
  ...(snapshot.ticketNumbers === undefined ? {} : { ticketNumbers: [...snapshot.ticketNumbers] }),
  ...(snapshot.winnerStatuses === undefined ? {} : { winnerStatuses: [...snapshot.winnerStatuses] }),
})
