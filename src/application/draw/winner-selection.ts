import {
  validateConfigurationSnapshot,
  validateRequestedWinners,
} from '../../domain/draws/draw.invariants.ts'
import type { CandidatePoolSnapshotEntry } from '../../domain/draws/draw-session.types.ts'
import { parseParticipantId, parsePrizeCategoryId, parseDrawConfigurationId, parseDrawSessionId, parseEventId, parseWinnerRecordId } from '../../domain/shared/identifiers.ts'
import { isIsoTimestamp } from '../../domain/shared/timestamps.ts'
import { parseTicketNumber } from '../../domain/participants/participant.invariants.ts'
import { validateWinnerRecord } from '../../domain/winners/winner.invariants.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import { fisherYatesShuffle } from './fisher-yates.ts'
import type { WinnerSelectionFailure } from './winner-selection-errors.ts'
import { winnerSelectionFailure } from './winner-selection-errors.ts'
import type { WinnerSelectionInput, WinnerSelectionOutput, WinnerSelectionResult } from './winner-selection.types.ts'

function failure(
  kind: WinnerSelectionFailure['kind'],
  code: WinnerSelectionFailure['code'],
  message: string,
  context: Omit<WinnerSelectionFailure, 'kind' | 'code' | 'message'> = {},
): WinnerSelectionResult {
  return { ok: false, error: winnerSelectionFailure(kind, code, message, context) }
}

function frozenSnapshotFailure(input: WinnerSelectionInput): WinnerSelectionResult | null {
  const snapshot = input.candidatePoolSnapshot
  if (!Object.isFrozen(snapshot)) {
    return failure('validation', 'snapshot-not-frozen', 'Candidate pool snapshot must be runtime-frozen.')
  }
  if (!Object.isFrozen(snapshot.candidateEntries)) {
    return failure('validation', 'candidate-array-not-frozen', 'Candidate entries must be runtime-frozen.')
  }
  for (const entry of snapshot.candidateEntries) {
    if (!Object.isFrozen(entry)) {
      return failure('validation', 'candidate-entry-not-frozen', 'Every candidate entry must be runtime-frozen.')
    }
  }
  if (!Object.isFrozen(input.configurationSnapshot)) {
    return failure('validation', 'invalid-snapshot', 'Configuration snapshot must be runtime-frozen.')
  }
  return null
}

function validateInput(input: WinnerSelectionInput): WinnerSelectionResult | null {
  const frozenFailure = frozenSnapshotFailure(input)
  if (frozenFailure !== null) return frozenFailure

  const snapshot = input.candidatePoolSnapshot
  const configuration = input.configurationSnapshot
  if (snapshot.snapshotFormatVersion !== 1 || configuration.snapshotFormatVersion !== 1) {
    return failure('validation', 'unsupported-snapshot-version', 'The supplied snapshot format version is not supported.')
  }
  if (!isIsoTimestamp(snapshot.capturedAt) || !isIsoTimestamp(configuration.capturedAt) || !isIsoTimestamp(input.at)) {
    return failure('validation', 'invalid-snapshot', 'Snapshots and winner timestamps must be valid ISO UTC values.')
  }
  if (!parseEventId(input.eventId).ok || snapshot.eventId !== input.eventId) {
    return failure('relationship', 'event-mismatch', 'Candidate snapshot Event identity does not match the selection context.')
  }
  if (!parseDrawConfigurationId(snapshot.configurationId).ok || snapshot.configurationId !== configuration.configurationId) {
    return failure('relationship', 'configuration-mismatch', 'Candidate snapshot configuration does not match the configuration snapshot.')
  }
  if (!parsePrizeCategoryId(input.prizeCategoryId).ok || snapshot.prizeCategoryId !== input.prizeCategoryId || configuration.prizeCategoryId !== input.prizeCategoryId) {
    return failure('relationship', 'category-mismatch', 'Candidate snapshot category does not match the selection context.')
  }
  if (snapshot.mode !== input.mode) {
    return failure('relationship', 'mode-mismatch', 'Candidate snapshot mode does not match the selection context.')
  }
  if (
    snapshot.winningRule !== configuration.winningRule ||
    snapshot.requireCheckIn !== configuration.requireCheckIn ||
    snapshot.eligibleGroupFilter !== configuration.eligibleGroupFilter
  ) {
    return failure('relationship', 'winning-rule-mismatch', 'Candidate snapshot rules do not match the configuration snapshot.')
  }
  if (!parseDrawSessionId(input.drawSessionId).ok) {
    return failure('validation', 'invalid-snapshot', 'DrawSession identity must be a valid identifier.')
  }
  const requested = configuration.requestedWinners
  if (!validateRequestedWinners(requested).ok) {
    return failure('validation', 'invalid-requested-count', 'Requested winners must be an integer from 1 through 100.', { requested })
  }
  const configurationValidation = validateConfigurationSnapshot(configuration)
  if (!configurationValidation.ok) {
    return failure('validation', 'invalid-snapshot', configurationValidation.error.message)
  }
  if (snapshot.eligibleSnapshotCount !== snapshot.candidateEntries.length) {
    return failure('integrity', 'candidate-count-mismatch', 'Eligible snapshot count must equal candidate entry count.')
  }
  if (snapshot.candidateEntries.length === 0) {
    return failure('capacity', 'empty-candidate-snapshot', 'At least one candidate is required for winner selection.')
  }
  if (requested > snapshot.candidateEntries.length) {
    return failure('capacity', 'insufficient-capacity', 'The candidate snapshot cannot supply the requested winners.', {
      requested,
      available: snapshot.candidateEntries.length,
    })
  }

  const participantIds = new Set<string>()
  const tickets = new Set<string>()
  for (const entry of snapshot.candidateEntries) {
    if (!parseParticipantId(entry.participantId).ok || !parseTicketNumber(entry.ticketNumber).ok) {
      return failure('integrity', 'invalid-candidate-identity', 'Every candidate must contain valid Participant and TicketNumber identities.')
    }
    if (participantIds.has(entry.participantId)) {
      return failure('uniqueness', 'duplicate-participant', 'Candidate Participant IDs must be unique.', { participantId: entry.participantId })
    }
    if (tickets.has(entry.ticketNumber)) {
      return failure('uniqueness', 'duplicate-ticket', 'Candidate ticket numbers must be unique.', { ticketNumber: entry.ticketNumber })
    }
    participantIds.add(entry.participantId)
    tickets.add(entry.ticketNumber)
  }
  return null
}

function freezeRecord(record: WinnerRecord): WinnerRecord {
  return Object.freeze(record)
}

export function selectWinners(input: WinnerSelectionInput): WinnerSelectionResult {
  const validationFailure = validateInput(input)
  if (validationFailure !== null) return validationFailure

  const { candidatePoolSnapshot: snapshot, configurationSnapshot: configuration } = input
  let shuffled: CandidatePoolSnapshotEntry[]
  try {
    shuffled = fisherYatesShuffle(snapshot.candidateEntries, input.randomSource)
  } catch (cause: unknown) {
    return failure('random', 'random-failure', 'Winner selection randomness failed before a result was completed.', { cause })
  }

  const selected = shuffled.slice(0, configuration.requestedWinners)
  const winnerIds = new Set<string>()
  const pendingWinners: WinnerRecord[] = []
  try {
    for (const [index, entry] of selected.entries()) {
      const id = input.createWinnerRecordId()
      if (!parseWinnerRecordId(id).ok) {
        return failure('integrity', 'invalid-winner-record', 'WinnerRecord ID factory returned an invalid identifier.')
      }
      if (winnerIds.has(id)) {
        return failure('uniqueness', 'duplicate-winner-record-id', 'WinnerRecord ID factory returned a duplicate identifier.')
      }
      winnerIds.add(id)
      const winner: WinnerRecord = {
        id,
        eventId: input.eventId,
        prizeCategoryId: input.prizeCategoryId,
        drawSessionId: input.drawSessionId,
        participantId: entry.participantId,
        ticketNumber: entry.ticketNumber,
        sequenceNumber: index + 1,
        status: 'pending',
        createdAt: input.at,
        updatedAt: input.at,
      }
      const winnerValidation = validateWinnerRecord(winner)
      if (!winnerValidation.ok) {
        return failure('integrity', 'invalid-winner-record', winnerValidation.error.message)
      }
      pendingWinners.push(freezeRecord(winner))
    }
  } catch (cause: unknown) {
    return failure('integrity', 'invalid-winner-record', 'WinnerRecord creation failed before a result was completed.', { cause })
  }

  const selectedCandidateEntries = Object.freeze(selected.map((entry) => Object.freeze({ ...entry })))
  const output: WinnerSelectionOutput = {
    eventId: input.eventId,
    configurationId: configuration.configurationId,
    prizeCategoryId: input.prizeCategoryId,
    drawSessionId: input.drawSessionId,
    mode: input.mode,
    requestedWinners: configuration.requestedWinners,
    selectedCandidateEntries,
    pendingWinners: Object.freeze(pendingWinners),
  }
  return { ok: true, value: Object.freeze(output) }
}
