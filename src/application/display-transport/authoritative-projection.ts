import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import type { PresentationProjectionSource } from './public-projection.ts'

/** Builds the public view from records read after a committed transaction. */
export function projectCommittedAudienceState(input: {
  readonly session: DrawSession
  readonly winners: readonly WinnerRecord[]
  readonly stageStartedAt: IsoTimestamp
  readonly blackoutRequested: boolean
}): PresentationProjectionSource {
  const presentation = input.session.configurationSnapshot?.presentation
  const active = input.winners
    .filter((winner) => winner.drawSessionId === input.session.id && winner.status !== 'cancelled')
    .sort((left, right) => left.sequenceNumber - right.sequenceNumber)
  const hasPendingWinner = input.winners.some((winner) => winner.status === 'pending')
  const resultIsResolved = input.winners.length > 0 && input.winners.every((winner) => winner.status === 'confirmed' || winner.status === 'cancelled')
  const verificationState = hasPendingWinner
    ? 'in-progress' as const
    : resultIsResolved
      ? 'verified' as const
      : 'pending' as const
  return {
    drawSessionId: input.session.id,
    stage: 'pending-handoff',
    stageStartedAt: input.stageStartedAt,
    blackoutRequested: input.blackoutRequested,
    mode: input.session.mode,
    verificationState,
    ...(input.session.configurationSnapshot === null ? {} : { prizeCategory: input.session.configurationSnapshot.categoryName, prizeName: input.session.configurationSnapshot.prizeName }),
    ...(presentation === undefined ? {} : {
      presentationConfiguration: {
        ...presentation,
        winnerCount: active.length,
      },
      presentationSeed: input.session.id,
    }),
    result: {
      drawSessionId: input.session.id,
      winners: active.map((winner, index) => ({
        sequence: index + 1,
        ticketNumber: winner.ticketNumber,
        status: winner.status === 'confirmed' ? 'confirmed' : 'pending',
      })),
    },
  }
}
