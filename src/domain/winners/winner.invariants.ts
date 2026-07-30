import type { RedrawRecord } from './redraw.types.ts'
import type {
  WinnerCancellationContext,
  WinnerRecord,
  WinnerStatus,
} from './winner.types.ts'
import {
  failure,
  success,
  type Result,
} from '../shared/result.ts'
import {
  isIsoTimestamp,
  type IsoTimestamp,
} from '../shared/timestamps.ts'

export function validateWinnerSequence(
  value: unknown,
): Result<number> {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    return failure(
      'invalid-winner-sequence',
      'Winner sequence must be a positive 1-based integer.',
    )
  }

  return success(value)
}

export function validateWinnerRecord(
  winner: WinnerRecord,
): Result<WinnerRecord> {
  const sequenceResult = validateWinnerSequence(
    winner.sequenceNumber,
  )
  if (!sequenceResult.ok) {
    return sequenceResult
  }

  if (
    !isIsoTimestamp(winner.createdAt) ||
    !isIsoTimestamp(winner.updatedAt) ||
    (winner.confirmedAt !== undefined &&
      !isIsoTimestamp(winner.confirmedAt)) ||
    (winner.cancelledAt !== undefined &&
      !isIsoTimestamp(winner.cancelledAt))
  ) {
    return failure(
      'invalid-winner-timestamp',
      'Winner timestamps must be valid ISO UTC values.',
    )
  }

  if (
    (winner.status === 'confirmed' &&
      winner.confirmedAt === undefined) ||
    (winner.status === 'cancelled' &&
      winner.cancelledAt === undefined)
  ) {
    return failure(
      'missing-winner-status-timestamp',
      'Confirmed and cancelled winners require their status timestamp.',
    )
  }

  return success(winner)
}

export function canTransitionWinnerStatus(
  from: WinnerStatus,
  to: WinnerStatus,
  context?: WinnerCancellationContext,
): boolean {
  if (from === 'pending') {
    return to === 'confirmed' || to === 'cancelled'
  }

  if (from === 'confirmed') {
    return to === 'cancelled' && context?.auditedRedraw === true
  }

  return false
}

export function transitionWinnerStatus(
  winner: WinnerRecord,
  to: Exclude<WinnerStatus, 'pending'>,
  at: IsoTimestamp,
  context?: WinnerCancellationContext,
): Result<WinnerRecord> {
  if (!isIsoTimestamp(at)) {
    return failure(
      'invalid-winner-transition-timestamp',
      'Winner transition timestamp must be a valid ISO UTC value.',
    )
  }

  if (!canTransitionWinnerStatus(winner.status, to, context)) {
    return failure(
      'unsupported-winner-transition',
      `Winner cannot transition from ${winner.status} to ${to}.`,
    )
  }

  return success({
    ...winner,
    cancelledAt: to === 'cancelled' ? at : winner.cancelledAt,
    confirmedAt: to === 'confirmed' ? at : winner.confirmedAt,
    status: to,
    updatedAt: at,
  })
}

export function validateRedrawRelationship(
  record: RedrawRecord,
  original: WinnerRecord,
  replacement: WinnerRecord,
): Result<RedrawRecord> {
  if (
    record.originalWinnerRecordId ===
      record.replacementWinnerRecordId ||
    original.id === replacement.id
  ) {
    return failure(
      'same-redraw-winner',
      'Original and replacement winner records must be distinct.',
    )
  }

  if (
    record.originalWinnerRecordId !== original.id ||
    record.replacementWinnerRecordId !== replacement.id
  ) {
    return failure(
      'redraw-record-link-mismatch',
      'Redraw record IDs must link the supplied winners.',
    )
  }

  if (
    original.eventId !== replacement.eventId ||
    original.eventId !== record.eventId ||
    original.drawSessionId !== replacement.drawSessionId ||
    original.drawSessionId !== record.drawSessionId
  ) {
    return failure(
      'redraw-parent-mismatch',
      'Redraw winners must belong to the same event and draw session.',
    )
  }

  if (original.status !== 'cancelled') {
    return failure(
      'redraw-original-not-cancelled',
      'The original winner must be terminal cancelled.',
    )
  }

  if (replacement.status !== 'pending') {
    return failure(
      'redraw-replacement-not-pending',
      'A replacement winner must start pending.',
    )
  }

  if (original.participantId === replacement.participantId) {
    return failure(
      'same-redraw-participant',
      'A replacement must identify a different participant.',
    )
  }

  if (
    record.reason === 'other' &&
    (record.reasonNote === undefined ||
      record.reasonNote.trim().length === 0)
  ) {
    return failure(
      'missing-other-reason-note',
      'The other redraw reason requires a non-empty note.',
    )
  }

  if (!isIsoTimestamp(record.createdAt)) {
    return failure(
      'invalid-redraw-timestamp',
      'Redraw timestamp must be a valid ISO UTC value.',
    )
  }

  return success(record)
}
