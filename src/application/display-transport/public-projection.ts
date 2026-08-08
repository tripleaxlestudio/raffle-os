import { parseTicketNumber } from '../../domain/participants/participant.invariants.ts'
import type { TicketNumber } from '../../domain/participants/participant.types.ts'
import { parseDrawSessionId, type DrawSessionId } from '../../domain/shared/identifiers.ts'
import { isIsoTimestamp, type IsoTimestamp } from '../../domain/shared/timestamps.ts'
import type { PublicAsset, PublicDisplayStage, PublicVerificationState, PublicWinnerStatus } from './protocol.ts'

export type PublicProjectionStage = 'standby' | 'countdown' | 'rolling' | 'reveal' | 'pending-handoff'
export type PublicProjectionMode = 'practice' | 'live'

export type PublicDisplaySnapshot = Readonly<{
  readonly drawSessionId: DrawSessionId
  readonly stage: PublicProjectionStage
  readonly stageStartedAt?: IsoTimestamp
  readonly countdownValue?: 3 | 2 | 1
  readonly blackoutRequested: boolean
  readonly displayTest?: boolean
  readonly eventName?: string
  readonly eventSubtitle?: string
  readonly prizeCategory?: string
  readonly prizeName?: string
  readonly winnerCount?: number
  readonly primaryColor?: string
  readonly accentColor?: string
  readonly logo?: PublicAsset
  readonly background?: PublicAsset
  readonly blackoutAppearance?: 'pure-black' | 'event-surface'
  readonly safeAreaMargin?: number
  readonly mode?: PublicProjectionMode
  readonly rollingSlotCount?: number
  readonly rollSpeedPerSecond?: number
  readonly rollStopMode?: 'timed' | 'manual'
  readonly rollDurationSeconds?: number
  readonly presentationSeed?: string
  readonly presentationMode?: 'instant-reveal' | 'random-number-roll'
  readonly revealMode?: 'all-together' | 'sequential'
  readonly revealStartedAt?: IsoTimestamp
  readonly ticketNumbers?: readonly TicketNumber[]
  readonly winnerStatuses?: readonly PublicWinnerStatus[]
  readonly verificationState?: PublicVerificationState
}>

export type PresentationProjectionSource = Readonly<{
  readonly drawSessionId: DrawSessionId
  readonly stage: 'ready' | PublicProjectionStage
  readonly stageStartedAt?: IsoTimestamp
  readonly countdownValue?: 3 | 2 | 1
  readonly blackoutRequested: boolean
  readonly displayTest?: boolean
  readonly eventName?: string
  readonly eventSubtitle?: string
  readonly prizeCategory?: string
  readonly prizeName?: string
  readonly winnerCount?: number
  readonly primaryColor?: string
  readonly accentColor?: string
  readonly logo?: PublicAsset
  readonly background?: PublicAsset
  readonly blackoutAppearance?: 'pure-black' | 'event-surface'
  readonly safeAreaMargin?: number
  readonly mode?: PublicProjectionMode
  readonly presentationConfiguration?: Readonly<{
    readonly winnerCount: number
    readonly presentationMode: 'instant-reveal' | 'random-number-roll'
    readonly rollSpeedPerSecond: number
    readonly rollStopMode: 'timed' | 'manual'
    readonly rollDurationSeconds: number
    readonly revealMode: 'all-together' | 'sequential'
  }>
  readonly presentationSeed?: string
  readonly result?: Readonly<{
    readonly drawSessionId: DrawSessionId
    readonly winners: readonly Readonly<{ readonly sequence: number; readonly ticketNumber: string; readonly status?: PublicWinnerStatus }>[]
  }>
  readonly verificationState?: PublicVerificationState
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
const isRollStopMode = (value: unknown): value is 'timed' | 'manual' => value === 'timed' || value === 'manual'
const isRevealMode = (value: unknown): value is 'all-together' | 'sequential' => value === 'all-together' || value === 'sequential'
const isPresentationMode = (value: unknown): value is 'instant-reveal' | 'random-number-roll' => value === 'instant-reveal' || value === 'random-number-roll'
const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).every((key) => keys.includes(key))
const isPublicAsset = (value: unknown): value is PublicAsset => isRecord(value) && typeof value.type === 'string' && value.blob instanceof Blob

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
  if (!isRecord(value) || !isNonEmptyString(value.drawSessionId) || !isStage(value.stage) || typeof value.blackoutRequested !== 'boolean' || (value.countdownValue !== undefined && value.countdownValue !== 1 && value.countdownValue !== 2 && value.countdownValue !== 3) || (value.mode !== undefined && !isMode(value.mode)) || (value.displayTest !== undefined && typeof value.displayTest !== 'boolean') || (value.eventName !== undefined && !isNonEmptyString(value.eventName)) || (value.eventSubtitle !== undefined && typeof value.eventSubtitle !== 'string') || (value.prizeCategory !== undefined && !isNonEmptyString(value.prizeCategory)) || (value.prizeName !== undefined && !isNonEmptyString(value.prizeName)) || (value.winnerCount !== undefined && (typeof value.winnerCount !== 'number' || !Number.isInteger(value.winnerCount) || value.winnerCount < 1 || value.winnerCount > 100)) || (value.logo !== undefined && !isPublicAsset(value.logo)) || (value.background !== undefined && !isPublicAsset(value.background))) invalidSource('Presentation source is malformed.')
  const parsedSession = parseDrawSessionId(value.drawSessionId)
  if (!parsedSession.ok) invalidSource('Presentation source session is malformed.')
  if (value.stage !== 'ready' && value.stage !== 'standby' && (value.stageStartedAt === undefined || !isIsoTimestamp(value.stageStartedAt))) invalidSource('A non-standby presentation stage requires a valid timestamp.')
  const stage: PublicProjectionStage = value.stage === 'ready' ? 'standby' : value.stage
  const projected = stage === 'reveal' || stage === 'pending-handoff' ? projectTickets(value, parsedSession.value) : undefined
  const configuration = isRecord(value.presentationConfiguration) ? value.presentationConfiguration : undefined
  const winners = isRecord(value.result) && Array.isArray(value.result.winners) ? value.result.winners : []
  const rolling = stage === 'rolling' ? {
    rollingSlotCount: configuration !== undefined && typeof configuration.winnerCount === 'number' ? configuration.winnerCount : winners.length || 1,
    presentationMode: configuration !== undefined && isPresentationMode(configuration.presentationMode) ? configuration.presentationMode : 'instant-reveal' as const,
    rollSpeedPerSecond: configuration !== undefined && typeof configuration.rollSpeedPerSecond === 'number' ? configuration.rollSpeedPerSecond : 12,
    rollStopMode: configuration !== undefined && isRollStopMode(configuration.rollStopMode) ? configuration.rollStopMode : 'timed' as const,
    rollDurationSeconds: configuration !== undefined && typeof configuration.rollDurationSeconds === 'number' ? configuration.rollDurationSeconds : 8,
    presentationSeed: typeof value.presentationSeed === 'string' && value.presentationSeed.length > 0 ? value.presentationSeed : parsedSession.value,
    revealMode: configuration !== undefined && isRevealMode(configuration.revealMode) ? configuration.revealMode : 'all-together' as const,
  } : undefined
  const reveal = stage === 'reveal' || stage === 'pending-handoff' ? {
    rollingSlotCount: configuration !== undefined && typeof configuration.winnerCount === 'number' ? configuration.winnerCount : winners.length || 1,
    presentationMode: configuration !== undefined && isPresentationMode(configuration.presentationMode) ? configuration.presentationMode : 'instant-reveal' as const,
    rollSpeedPerSecond: configuration !== undefined && typeof configuration.rollSpeedPerSecond === 'number' ? configuration.rollSpeedPerSecond : 12,
    rollStopMode: configuration !== undefined && isRollStopMode(configuration.rollStopMode) ? configuration.rollStopMode : 'timed' as const,
    rollDurationSeconds: configuration !== undefined && typeof configuration.rollDurationSeconds === 'number' ? configuration.rollDurationSeconds : 8,
    presentationSeed: typeof value.presentationSeed === 'string' && value.presentationSeed.length > 0 ? value.presentationSeed : parsedSession.value,
    revealMode: configuration !== undefined && isRevealMode(configuration.revealMode) ? configuration.revealMode : 'all-together' as const,
    revealStartedAt: value.stageStartedAt as IsoTimestamp,
  } : undefined
  const snapshot: PublicDisplaySnapshot = {
    drawSessionId: parsedSession.value,
    stage,
    ...(value.stageStartedAt === undefined ? {} : { stageStartedAt: value.stageStartedAt as IsoTimestamp }),
    ...(value.countdownValue === undefined ? {} : { countdownValue: value.countdownValue as 3 | 2 | 1 }),
    blackoutRequested: value.blackoutRequested,
    ...(value.displayTest === undefined ? {} : { displayTest: value.displayTest }),
    ...(value.eventName === undefined ? {} : { eventName: value.eventName }),
    ...(value.prizeCategory === undefined ? {} : { prizeCategory: value.prizeCategory as string }),
    ...(value.prizeName === undefined ? {} : { prizeName: value.prizeName as string }),
    ...(value.winnerCount === undefined ? {} : { winnerCount: value.winnerCount as number }),
    ...(value.eventSubtitle === undefined ? {} : { eventSubtitle: value.eventSubtitle as string }), ...(value.primaryColor === undefined ? {} : { primaryColor: value.primaryColor as string }), ...(value.accentColor === undefined ? {} : { accentColor: value.accentColor as string }), ...(value.logo === undefined ? {} : { logo: value.logo as PublicAsset }), ...(value.background === undefined ? {} : { background: value.background as PublicAsset }), ...(value.blackoutAppearance === undefined ? {} : { blackoutAppearance: value.blackoutAppearance as 'pure-black' | 'event-surface' }), ...(value.safeAreaMargin === undefined ? {} : { safeAreaMargin: value.safeAreaMargin as number }),
    ...(value.mode === undefined ? {} : { mode: value.mode }),
    ...(rolling === undefined ? {} : rolling),
    ...(reveal === undefined ? {} : reveal),
    ...(projected === undefined ? {} : { ticketNumbers: projected.tickets, winnerStatuses: projected.statuses }),
    ...(value.verificationState === undefined ? {} : { verificationState: value.verificationState as PublicVerificationState }),
  }
  return freezeSnapshot(snapshot)
}

export function serializePublicDisplaySnapshot(snapshot: PublicDisplaySnapshot): string {
  return JSON.stringify({
    drawSessionId: snapshot.drawSessionId,
    stage: snapshot.stage,
    ...(snapshot.stageStartedAt === undefined ? {} : { stageStartedAt: snapshot.stageStartedAt }),
    ...(snapshot.revealStartedAt === undefined ? {} : { revealStartedAt: snapshot.revealStartedAt }),
    ...(snapshot.countdownValue === undefined ? {} : { countdownValue: snapshot.countdownValue }),
    blackoutRequested: snapshot.blackoutRequested,
    ...(snapshot.displayTest === undefined ? {} : { displayTest: snapshot.displayTest }),
    ...(snapshot.eventName === undefined ? {} : { eventName: snapshot.eventName }),
    ...(snapshot.prizeCategory === undefined ? {} : { prizeCategory: snapshot.prizeCategory }),
    ...(snapshot.prizeName === undefined ? {} : { prizeName: snapshot.prizeName }),
    ...(snapshot.winnerCount === undefined ? {} : { winnerCount: snapshot.winnerCount }),
    ...(snapshot.eventSubtitle === undefined ? {} : { eventSubtitle: snapshot.eventSubtitle }),
    ...(snapshot.primaryColor === undefined ? {} : { primaryColor: snapshot.primaryColor }),
    ...(snapshot.accentColor === undefined ? {} : { accentColor: snapshot.accentColor }),
    ...(snapshot.logo === undefined ? {} : { logo: { type: snapshot.logo.type, size: snapshot.logo.blob.size, name: snapshot.logo.blob.type } }),
    ...(snapshot.background === undefined ? {} : { background: { type: snapshot.background.type, size: snapshot.background.blob.size, name: snapshot.background.blob.type } }),
    ...(snapshot.blackoutAppearance === undefined ? {} : { blackoutAppearance: snapshot.blackoutAppearance }),
    ...(snapshot.safeAreaMargin === undefined ? {} : { safeAreaMargin: snapshot.safeAreaMargin }),
    ...(snapshot.mode === undefined ? {} : { mode: snapshot.mode }),
    ...(snapshot.rollingSlotCount === undefined ? {} : { rollingSlotCount: snapshot.rollingSlotCount }),
    ...(snapshot.rollSpeedPerSecond === undefined ? {} : { rollSpeedPerSecond: snapshot.rollSpeedPerSecond }),
    ...(snapshot.rollStopMode === undefined ? {} : { rollStopMode: snapshot.rollStopMode }),
    ...(snapshot.rollDurationSeconds === undefined ? {} : { rollDurationSeconds: snapshot.rollDurationSeconds }),
    ...(snapshot.presentationSeed === undefined ? {} : { presentationSeed: snapshot.presentationSeed }),
    ...(snapshot.presentationMode === undefined ? {} : { presentationMode: snapshot.presentationMode }),
    ...(snapshot.revealMode === undefined ? {} : { revealMode: snapshot.revealMode }),
    ...(snapshot.ticketNumbers === undefined ? {} : { ticketNumbers: [...snapshot.ticketNumbers] }),
    ...(snapshot.winnerStatuses === undefined ? {} : { winnerStatuses: [...snapshot.winnerStatuses] }),
    ...(snapshot.verificationState === undefined ? {} : { verificationState: snapshot.verificationState }),
  })
}

export function parsePublicDisplaySnapshot(value: unknown, expectedSession?: DrawSessionId): PublicDisplaySnapshot {
  if (!isRecord(value) || !isNonEmptyString(value.drawSessionId) || !isStage(value.stage) || value.stage === 'ready' || typeof value.blackoutRequested !== 'boolean' || (value.countdownValue !== undefined && value.countdownValue !== 1 && value.countdownValue !== 2 && value.countdownValue !== 3) || (value.mode !== undefined && !isMode(value.mode)) || (value.displayTest !== undefined && typeof value.displayTest !== 'boolean') || (value.eventName !== undefined && !isNonEmptyString(value.eventName)) || (value.eventSubtitle !== undefined && typeof value.eventSubtitle !== 'string') || (value.prizeCategory !== undefined && !isNonEmptyString(value.prizeCategory)) || (value.prizeName !== undefined && !isNonEmptyString(value.prizeName)) || (value.winnerCount !== undefined && (typeof value.winnerCount !== 'number' || !Number.isInteger(value.winnerCount) || value.winnerCount < 1 || value.winnerCount > 100)) || (value.logo !== undefined && !isPublicAsset(value.logo)) || (value.background !== undefined && !isPublicAsset(value.background))) throw new PublicProjectionError('invalid-public-snapshot', 'The public display snapshot is malformed.')
  if (!hasOnlyKeys(value, ['drawSessionId', 'stage', 'stageStartedAt', 'revealStartedAt', 'countdownValue', 'blackoutRequested', 'displayTest', 'eventName', 'eventSubtitle', 'prizeCategory', 'prizeName', 'winnerCount', 'primaryColor', 'accentColor', 'logo', 'background', 'blackoutAppearance', 'safeAreaMargin', 'mode', 'rollingSlotCount', 'rollSpeedPerSecond', 'rollStopMode', 'rollDurationSeconds', 'presentationSeed', 'presentationMode', 'revealMode', 'ticketNumbers', 'winnerStatuses', 'verificationState'])) throw new PublicProjectionError('invalid-public-snapshot', 'The public display snapshot contains unsupported fields.')
  const parsedSession = parseDrawSessionId(value.drawSessionId)
  if (!parsedSession.ok) throw new PublicProjectionError('invalid-public-snapshot', 'The public display snapshot session is malformed.')
  if (expectedSession !== undefined && value.drawSessionId !== expectedSession) sessionMismatch(expectedSession, value.drawSessionId)
  if (value.stage !== 'standby' && (value.stageStartedAt === undefined || !isIsoTimestamp(value.stageStartedAt))) throw new PublicProjectionError('invalid-public-snapshot', 'The public display snapshot timestamp is invalid.')
  if (value.revealStartedAt !== undefined && !isIsoTimestamp(value.revealStartedAt)) throw new PublicProjectionError('invalid-public-snapshot', 'The reveal timestamp is invalid.')
  const needsTickets = value.stage === 'reveal' || value.stage === 'pending-handoff'
  if (needsTickets && value.ticketNumbers === undefined) throw new PublicProjectionError('invalid-public-snapshot', 'This public display stage requires tickets.')
  if (!needsTickets && value.ticketNumbers !== undefined) throw new PublicProjectionError('invalid-public-snapshot', 'This public display stage cannot carry tickets.')
  if (value.ticketNumbers !== undefined && (!Array.isArray(value.ticketNumbers) || value.ticketNumbers.length > 100 || value.ticketNumbers.some((ticket) => !isNonEmptyString(ticket) || !parseTicketNumber(ticket).ok))) throw new PublicProjectionError('invalid-public-snapshot', 'The public display ticket list is invalid.')
  if (value.winnerStatuses !== undefined && (!Array.isArray(value.winnerStatuses) || value.winnerStatuses.length !== (Array.isArray(value.ticketNumbers) ? value.ticketNumbers.length : 0) || value.winnerStatuses.some((status) => status !== 'pending' && status !== 'confirmed'))) throw new PublicProjectionError('invalid-public-snapshot', 'The public display winner statuses are invalid.')
  if (value.verificationState !== undefined && value.verificationState !== 'pending' && value.verificationState !== 'in-progress' && value.verificationState !== 'verified') throw new PublicProjectionError('invalid-public-snapshot', 'The public display verification state is invalid.')
  if (value.stage === 'rolling' && (typeof value.rollingSlotCount !== 'number' || !Number.isInteger(value.rollingSlotCount) || value.rollingSlotCount < 1 || value.rollingSlotCount > 100 || typeof value.rollSpeedPerSecond !== 'number' || !Number.isFinite(value.rollSpeedPerSecond) || value.rollSpeedPerSecond < 1 || !isRollStopMode(value.rollStopMode) || typeof value.rollDurationSeconds !== 'number' || !Number.isFinite(value.rollDurationSeconds) || value.rollDurationSeconds < 0 || typeof value.presentationSeed !== 'string' || value.presentationSeed.length === 0 || !isRevealMode(value.revealMode))) throw new PublicProjectionError('invalid-public-snapshot', 'Rolling presentation metadata is invalid.')
  if (value.presentationMode !== undefined && !isPresentationMode(value.presentationMode)) throw new PublicProjectionError('invalid-public-snapshot', 'Presentation mode is invalid.')
  if (value.stage !== 'rolling' && value.stage !== 'reveal' && value.stage !== 'pending-handoff' && ['rollingSlotCount', 'rollSpeedPerSecond', 'rollStopMode', 'rollDurationSeconds', 'presentationSeed'].some((key) => key in value)) throw new PublicProjectionError('invalid-public-snapshot', 'Rolling metadata is only valid during a draw presentation.')
  if (value.stage !== 'rolling' && value.stage !== 'reveal' && value.stage !== 'pending-handoff' && ['revealMode', 'revealStartedAt'].some((key) => key in value)) throw new PublicProjectionError('invalid-public-snapshot', 'Reveal metadata is only valid during reveal.')
  if ((value.stage === 'reveal' || value.stage === 'pending-handoff') && value.revealMode !== undefined && !isRevealMode(value.revealMode)) throw new PublicProjectionError('invalid-public-snapshot', 'Reveal mode is invalid.')
  const tickets = value.ticketNumbers === undefined ? undefined : Object.freeze(value.ticketNumbers.map(parsePublicTicket))
  return freezeSnapshot({
    drawSessionId: parsedSession.value,
    stage: value.stage,
    ...(value.stageStartedAt === undefined ? {} : { stageStartedAt: value.stageStartedAt as IsoTimestamp }),
    ...(value.countdownValue === undefined ? {} : { countdownValue: value.countdownValue as 3 | 2 | 1 }),
    blackoutRequested: value.blackoutRequested,
    ...(value.displayTest === undefined ? {} : { displayTest: value.displayTest }),
    ...(value.eventName === undefined ? {} : { eventName: value.eventName }),
    ...(value.prizeCategory === undefined ? {} : { prizeCategory: value.prizeCategory as string }),
    ...(value.prizeName === undefined ? {} : { prizeName: value.prizeName as string }),
    ...(value.winnerCount === undefined ? {} : { winnerCount: value.winnerCount as number }),
    ...(value.eventSubtitle === undefined ? {} : { eventSubtitle: value.eventSubtitle as string }), ...(value.primaryColor === undefined ? {} : { primaryColor: value.primaryColor as string }), ...(value.accentColor === undefined ? {} : { accentColor: value.accentColor as string }), ...(value.logo === undefined ? {} : { logo: value.logo as PublicAsset }), ...(value.background === undefined ? {} : { background: value.background as PublicAsset }), ...(value.blackoutAppearance === undefined ? {} : { blackoutAppearance: value.blackoutAppearance as 'pure-black' | 'event-surface' }), ...(value.safeAreaMargin === undefined ? {} : { safeAreaMargin: value.safeAreaMargin as number }),
    ...(value.mode === undefined ? {} : { mode: value.mode }),
    ...(typeof value.rollingSlotCount !== 'number' ? {} : { rollingSlotCount: value.rollingSlotCount }),
    ...(typeof value.rollSpeedPerSecond !== 'number' ? {} : { rollSpeedPerSecond: value.rollSpeedPerSecond }),
    ...(isRollStopMode(value.rollStopMode) ? { rollStopMode: value.rollStopMode } : {}),
    ...(typeof value.rollDurationSeconds !== 'number' ? {} : { rollDurationSeconds: value.rollDurationSeconds }),
    ...(typeof value.presentationSeed !== 'string' ? {} : { presentationSeed: value.presentationSeed }),
    ...(isPresentationMode(value.presentationMode) ? { presentationMode: value.presentationMode } : {}),
    ...(isRevealMode(value.revealMode) ? { revealMode: value.revealMode } : {}),
    ...(value.revealStartedAt === undefined ? {} : { revealStartedAt: value.revealStartedAt as IsoTimestamp }),
    ...(tickets === undefined ? {} : { ticketNumbers: tickets }),
    ...(value.winnerStatuses === undefined ? {} : { winnerStatuses: Object.freeze([...value.winnerStatuses] as PublicWinnerStatus[]) }),
    ...(value.verificationState === undefined ? {} : { verificationState: value.verificationState as PublicVerificationState }),
  })
}

export const publicSnapshotToProtocolState = (snapshot: PublicDisplaySnapshot) => ({
  type: 'display-state' as const,
  stage: snapshot.stage as PublicDisplayStage,
  drawSessionId: snapshot.drawSessionId,
  ...(snapshot.stageStartedAt === undefined ? {} : { stageStartedAt: snapshot.stageStartedAt }),
  ...(snapshot.countdownValue === undefined ? {} : { countdownValue: snapshot.countdownValue }),
  blackoutRequested: snapshot.blackoutRequested,
  ...(snapshot.displayTest === undefined ? {} : { displayTest: snapshot.displayTest }),
  ...(snapshot.eventName === undefined ? {} : { eventName: snapshot.eventName }),
  ...(snapshot.prizeCategory === undefined ? {} : { prizeCategory: snapshot.prizeCategory }),
    ...(snapshot.prizeName === undefined ? {} : { prizeName: snapshot.prizeName }),
    ...(snapshot.winnerCount === undefined ? {} : { winnerCount: snapshot.winnerCount }),
  ...(snapshot.eventSubtitle === undefined ? {} : { eventSubtitle: snapshot.eventSubtitle }), ...(snapshot.primaryColor === undefined ? {} : { primaryColor: snapshot.primaryColor }), ...(snapshot.accentColor === undefined ? {} : { accentColor: snapshot.accentColor }), ...(snapshot.logo === undefined ? {} : { logo: snapshot.logo }), ...(snapshot.background === undefined ? {} : { background: snapshot.background }), ...(snapshot.blackoutAppearance === undefined ? {} : { blackoutAppearance: snapshot.blackoutAppearance }), ...(snapshot.safeAreaMargin === undefined ? {} : { safeAreaMargin: snapshot.safeAreaMargin }),
  ...(snapshot.mode === undefined ? {} : { mode: snapshot.mode }),
  ...(snapshot.rollingSlotCount === undefined ? {} : { rollingSlotCount: snapshot.rollingSlotCount }),
  ...(snapshot.rollSpeedPerSecond === undefined ? {} : { rollSpeedPerSecond: snapshot.rollSpeedPerSecond }),
  ...(snapshot.rollStopMode === undefined ? {} : { rollStopMode: snapshot.rollStopMode }),
  ...(snapshot.rollDurationSeconds === undefined ? {} : { rollDurationSeconds: snapshot.rollDurationSeconds }),
  ...(snapshot.presentationSeed === undefined ? {} : { presentationSeed: snapshot.presentationSeed }),
  ...(snapshot.presentationMode === undefined ? {} : { presentationMode: snapshot.presentationMode }),
  ...(snapshot.revealMode === undefined ? {} : { revealMode: snapshot.revealMode }),
  ...(snapshot.revealStartedAt === undefined ? {} : { revealStartedAt: snapshot.revealStartedAt }),
  ...(snapshot.ticketNumbers === undefined ? {} : { ticketNumbers: [...snapshot.ticketNumbers] }),
  ...(snapshot.winnerStatuses === undefined ? {} : { winnerStatuses: [...snapshot.winnerStatuses] }),
  ...(snapshot.verificationState === undefined ? {} : { verificationState: snapshot.verificationState }),
})
