import {
  validateDrawConfiguration,
} from '../../domain/draws/draw.invariants.ts'
import {
  validateEvent,
} from '../../domain/events/event.invariants.ts'
import {
  validateParticipant,
} from '../../domain/participants/participant.invariants.ts'
import {
  validatePrizeCategory,
} from '../../domain/prizes/prize.types.ts'
import {
  validateWinnerRecord,
} from '../../domain/winners/winner.invariants.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { Participant } from '../../domain/participants/participant.types.ts'
import type { Result } from '../../domain/shared/result.ts'
import {
  integrityFailure,
  relationshipFailure,
  validationFailure,
  type EligibilityFailure,
} from './eligibility-errors.ts'
import type {
  EligibilityDecision,
  EligibilityEntry,
  EligibilityEvaluatorInput,
  EligibilityOfficialSession,
  EligibilityResult,
} from './eligibility.types.ts'

export type EligibilityEvaluation = Result<
  EligibilityResult,
  EligibilityFailure
>

const VALID_MODES = ['practice', 'live'] as const
const IN_FLIGHT_STATUSES = new Set<EligibilityOfficialSession['status']>([
  'drawing',
  'pending-confirmation',
])
const WINNER_STATUSES = new Set<WinnerRecord['status']>([
  'pending',
  'confirmed',
  'cancelled',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function safeValidate<T>(
  value: T,
  validator: (candidate: T) => Result<T>,
): Result<T> | null {
  try {
    return validator(value)
  } catch {
    return null
  }
}

function hasParticipantShape(value: unknown): value is Participant {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.eventId === 'string' &&
    typeof value.ticketNumber === 'string' &&
    typeof value.isCheckedIn === 'boolean' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function hasWinnerShape(value: unknown): value is WinnerRecord {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.eventId === 'string' &&
    typeof value.prizeCategoryId === 'string' &&
    typeof value.drawSessionId === 'string' &&
    typeof value.participantId === 'string' &&
    typeof value.ticketNumber === 'string' &&
    typeof value.status === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isLiveMode(mode: EligibilityEvaluatorInput['mode']): boolean {
  return mode === 'live'
}

function isPendingWinnerInFlight(
  winner: WinnerRecord,
  input: EligibilityEvaluatorInput,
): boolean {
  if (winner.status !== 'pending' || !isLiveMode(input.mode)) return false

  const context = input.ruleContext
  if (context === undefined) return false

  const explicitIds = new Set([
    ...(context.activeOfficialSessionId === undefined
      ? []
      : [context.activeOfficialSessionId]),
    ...(context.activeOfficialSessionIds ?? []),
    ...(context.inFlightOfficialSessionIds ?? []),
  ])
  if (explicitIds.has(winner.drawSessionId)) return true

  return (context.officialSessions ?? []).some(
    (session) =>
      session.id === winner.drawSessionId &&
      session.eventId === input.activeEvent.id &&
      session.mode === 'live' &&
      IN_FLIGHT_STATUSES.has(session.status),
  )
}

function hasConfirmedWin(
  participant: Participant,
  input: EligibilityEvaluatorInput,
): boolean {
  if (!isLiveMode(input.mode)) return false

  return input.winnerRecords.some((winner) => {
    if (
      winner.status !== 'confirmed' ||
      winner.eventId !== input.activeEvent.id ||
      winner.participantId !== participant.id
    ) {
      return false
    }

    return (
      input.drawConfiguration.winningRule === 'once-per-event' ||
      (input.drawConfiguration.winningRule === 'once-per-category' &&
        winner.prizeCategoryId === input.prizeCategory.id)
    )
  })
}

function addReason(
  reasons: EligibilityDecision['exclusionReasons'],
  reason: EligibilityDecision['exclusionReasons'][number],
): EligibilityDecision['exclusionReasons'] {
  return reasons.includes(reason) ? reasons : [...reasons, reason]
}

function validateInput(
  input: EligibilityEvaluatorInput,
): EligibilityFailure | null {
  if (!VALID_MODES.includes(input.mode)) {
    return validationFailure(
      'invalid-input-mode',
      'Eligibility mode must be practice or live.',
    )
  }

  const eventResult = safeValidate(input.activeEvent, validateEvent)
  if (eventResult === null || !eventResult.ok) {
    return validationFailure(
      'invalid-event',
      'The active Event is invalid.',
    )
  }
  const configResult = safeValidate(
    input.drawConfiguration,
    validateDrawConfiguration,
  )
  if (configResult === null || !configResult.ok) {
    return validationFailure(
      'invalid-configuration',
      'The DrawConfiguration is invalid.',
    )
  }
  const categoryResult = safeValidate(
    input.prizeCategory,
    validatePrizeCategory,
  )
  if (categoryResult === null || !categoryResult.ok) {
    return validationFailure(
      'invalid-prize-category',
      'The PrizeCategory is invalid.',
    )
  }

  if (input.drawConfiguration.eventId !== input.activeEvent.id) {
    return relationshipFailure(
      'configuration-event-mismatch',
      'DrawConfiguration does not belong to the active Event.',
    )
  }
  if (
    input.drawConfiguration.prizeCategoryId !== input.prizeCategory.id
  ) {
    return relationshipFailure(
      'configuration-category-mismatch',
      'DrawConfiguration does not select the supplied PrizeCategory.',
    )
  }
  if (input.prizeCategory.eventId !== input.activeEvent.id) {
    return relationshipFailure(
      'category-event-mismatch',
      'PrizeCategory does not belong to the active Event.',
    )
  }

  const participantIds = new Set<string>()
  const ticketKeys = new Set<string>()
  for (const participant of input.participants) {
    if (!hasParticipantShape(participant)) {
      return validationFailure(
        'invalid-participant',
        'A Participant has an invalid persisted shape.',
      )
    }
    const participantResult = safeValidate(
      participant,
      validateParticipant,
    )
    if (participantResult === null || !participantResult.ok) {
      return validationFailure(
        'invalid-participant',
        'A Participant contains invalid persisted data.',
        { participantId: participant.id },
      )
    }
    if (participantIds.has(participant.id)) {
      return integrityFailure(
        'duplicate-participant',
        'Participant IDs must be unique in an eligibility evaluation.',
        { participantId: participant.id },
      )
    }
    const ticketKey = participant.ticketNumber
    if (ticketKeys.has(ticketKey)) {
      return integrityFailure(
        'duplicate-participant',
        'Ticket numbers must be unique in an eligibility evaluation.',
        { participantId: participant.id },
      )
    }
    participantIds.add(participant.id)
    ticketKeys.add(ticketKey)
  }

  const winnerIds = new Set<string>()
  const winnerKeys = new Set<string>()
  for (const winner of input.winnerRecords) {
    if (!hasWinnerShape(winner)) {
      return validationFailure(
        'invalid-winner-record',
        'A WinnerRecord has an invalid persisted shape.',
      )
    }
    const winnerResult = safeValidate(winner, validateWinnerRecord)
    if (winnerResult === null || !winnerResult.ok) {
      return integrityFailure(
        'invalid-winner-record',
        'A WinnerRecord contains contradictory or invalid history data.',
        { winnerRecordId: winner.id },
      )
    }
    if (
      !WINNER_STATUSES.has(winner.status) ||
      (winner.status === 'pending' &&
        (winner.confirmedAt !== undefined ||
          winner.cancelledAt !== undefined)) ||
      (winner.status === 'confirmed' &&
        winner.cancelledAt !== undefined) ||
      (winner.status === 'cancelled' &&
        winner.confirmedAt !== undefined)
    ) {
      return integrityFailure(
        'invalid-winner-record',
        'A WinnerRecord contains contradictory status history.',
        { winnerRecordId: winner.id },
      )
    }
    if (winnerIds.has(winner.id)) {
      return integrityFailure(
        'duplicate-winner-record',
        'WinnerRecord IDs must be unique in official history.',
        { winnerRecordId: winner.id },
      )
    }
    const winnerKey = `${winner.drawSessionId}|${winner.participantId}|${winner.ticketNumber}`
    if (winnerKeys.has(winnerKey)) {
      return integrityFailure(
        'duplicate-winner-record',
        'Official history contains a duplicate winner record.',
        { winnerRecordId: winner.id },
      )
    }
    winnerIds.add(winner.id)
    winnerKeys.add(winnerKey)

    const participant = input.participants.find(
      (candidate) => candidate.id === winner.participantId,
    )
    if (
      participant !== undefined &&
      (participant.eventId !== winner.eventId ||
        participant.ticketNumber !== winner.ticketNumber)
    ) {
      return integrityFailure(
        'winner-participant-mismatch',
        'WinnerRecord does not match its persisted Participant.',
        { winnerRecordId: winner.id },
      )
    }
  }

  const officialSessions = input.ruleContext?.officialSessions ?? []
  const sessionsById = new Map(
    officialSessions.map((session) => [session.id, session]),
  )
  for (const session of officialSessions) {
    if (
      session.eventId !== input.activeEvent.id ||
      session.mode !== 'live' ||
      typeof session.id !== 'string'
    ) {
      return relationshipFailure(
        'invalid-official-session',
        'Official session context must belong to the active Live Event.',
      )
    }
  }
  for (const winner of input.winnerRecords) {
    const session = sessionsById.get(winner.drawSessionId)
    if (
      session !== undefined &&
      (session.eventId !== winner.eventId ||
        session.prizeCategoryId !== winner.prizeCategoryId)
    ) {
      return integrityFailure(
        'winner-session-mismatch',
        'WinnerRecord does not match the ownership of its DrawSession.',
        { winnerRecordId: winner.id },
      )
    }
  }
  return null
}

function decideParticipant(
  participant: Participant,
  input: EligibilityEvaluatorInput,
): EligibilityDecision {
  let reasons: EligibilityDecision['exclusionReasons'] = []
  if (participant.eventId !== input.activeEvent.id) {
    reasons = addReason(reasons, 'wrong-event')
  }
  if (input.drawConfiguration.requireCheckIn && !participant.isCheckedIn) {
    reasons = addReason(reasons, 'not-checked-in')
  }
  if (
    input.drawConfiguration.eligibleGroupFilter !== null &&
    participant.group !== input.drawConfiguration.eligibleGroupFilter
  ) {
    reasons = addReason(reasons, 'group-filter-mismatch')
  }
  if (hasConfirmedWin(participant, input)) {
    reasons = addReason(reasons, 'previously-confirmed-winner')
  }
  if (
    isLiveMode(input.mode) &&
    input.winnerRecords.some(
      (winner) =>
        winner.participantId === participant.id &&
        winner.eventId === input.activeEvent.id &&
        isPendingWinnerInFlight(winner, input),
    )
  ) {
    reasons = addReason(reasons, 'otherwise-disallowed-winner')
  }

  return {
    exclusionReasons: reasons,
    eligible: reasons.length === 0,
    participantId: participant.id,
    ticketNumber: participant.ticketNumber,
  }
}

export function evaluateEligibility(
  input: EligibilityEvaluatorInput,
): EligibilityEvaluation {
  const failure = validateInput(input)
  if (failure !== null) return { error: failure, ok: false }

  const decisions = input.participants.map((participant) =>
    decideParticipant(participant, input),
  )
  const eligibleEntries: EligibilityEntry[] = decisions
    .filter((decision) => decision.eligible)
    .map(({ participantId, ticketNumber }) => ({
      participantId,
      ticketNumber,
    }))

  return {
    ok: true,
    value: {
      configurationId: input.drawConfiguration.id,
      decisions,
      eligibleCount: eligibleEntries.length,
      eligibleEntries,
      eventId: input.activeEvent.id,
      excludedCount: decisions.length - eligibleEntries.length,
      mode: input.mode,
      prizeCategoryId: input.prizeCategory.id,
    },
  }
}
