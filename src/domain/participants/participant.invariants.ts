import type { Participant, TicketNumber } from './participant.types.ts'
import {
  failure,
  success,
  type Result,
} from '../shared/result.ts'
import { isIsoTimestamp } from '../shared/timestamps.ts'

export function parseTicketNumber(
  value: unknown,
): Result<TicketNumber> {
  if (typeof value !== 'string') {
    return failure(
      'invalid-ticket-type',
      'Ticket number must be supplied as a string.',
    )
  }

  if (value.length === 0) {
    return failure(
      'empty-ticket-number',
      'Ticket number must not be empty.',
    )
  }

  return success(value as TicketNumber)
}

export function validateParticipant(
  participant: Participant,
): Result<Participant> {
  const ticketResult = parseTicketNumber(participant.ticketNumber)
  if (!ticketResult.ok) {
    return ticketResult
  }

  if (
    !isIsoTimestamp(participant.createdAt) ||
    !isIsoTimestamp(participant.updatedAt)
  ) {
    return failure(
      'invalid-participant-timestamp',
      'Participant timestamps must be valid ISO 8601 UTC values.',
    )
  }

  return success(participant)
}
