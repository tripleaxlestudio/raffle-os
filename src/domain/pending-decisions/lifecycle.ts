import type { DrawSession, DrawSessionStatus } from '../draws/draw-session.types.ts'
import type { IsoTimestamp } from '../shared/timestamps.ts'
import { failure, success, type Result } from '../shared/result.ts'
import { isIsoTimestamp } from '../shared/timestamps.ts'
import type { WinnerRecord, WinnerStatus } from '../winners/winner.types.ts'

export function resolveWinnerStatus(statuses: readonly WinnerStatus[]): DrawSessionStatus {
  if (statuses.some((status) => status === 'pending')) return 'pending-confirmation'
  if (statuses.some((status) => status === 'confirmed')) return 'completed'
  return 'cancelled'
}

export function resolveDrawSession(
  session: DrawSession,
  winners: readonly WinnerRecord[],
  at: IsoTimestamp,
): Result<DrawSession> {
  if (!isIsoTimestamp(at)) {
    return failure('invalid-session-resolution-timestamp', 'Session resolution timestamp must be a valid ISO UTC value.')
  }

  const status = resolveWinnerStatus(winners.map((winner) => winner.status))
  if (status === session.status) {
    return success({ ...session, updatedAt: at })
  }

  if (session.status === 'completed' && status !== 'pending-confirmation') {
    return failure('invalid-lifecycle-transition', 'A completed session can only reopen when a confirmed original is redrawn.')
  }

  if (session.status === 'cancelled' && status !== 'cancelled') {
    return failure('invalid-lifecycle-transition', 'A cancelled session cannot be reopened by ordinary resolution.')
  }

  return success({
    ...session,
    completedAt: status === 'completed' ? at : session.completedAt,
    status,
    updatedAt: at,
  })
}

export function canResolveWinnerTransition(from: WinnerStatus, to: WinnerStatus): boolean {
  return (from === 'pending' && (to === 'confirmed' || to === 'cancelled')) ||
    (from === 'confirmed' && to === 'cancelled')
}
