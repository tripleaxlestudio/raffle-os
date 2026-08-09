import type { CandidatePoolSnapshot } from '../../domain/draws/draw-session.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'

export interface ReplacementCapacityQuery {
  readonly candidatePoolSnapshot: CandidatePoolSnapshot | null
  readonly drawSessionId?: string
  readonly winners: readonly WinnerRecord[]
  readonly targetWinnerIds: readonly string[]
  readonly requestedReplacementCount: number
}

export interface ReplacementCapacityResult {
  readonly eligibleCandidateCount: number
  readonly requestedReplacementCount: number
  readonly sufficient: boolean
}

export function calculateReplacementCapacity(input: ReplacementCapacityQuery): ReplacementCapacityResult {
  if (input.requestedReplacementCount < 1 || input.candidatePoolSnapshot === null) return { eligibleCandidateCount: 0, requestedReplacementCount: input.requestedReplacementCount, sufficient: false }
  const occupiedTickets = new Set(input.winners.filter((winner) => winner.status !== 'cancelled' || input.drawSessionId === undefined || winner.drawSessionId === input.drawSessionId).map((winner) => winner.ticketNumber))
  const eligibleCandidateCount = input.candidatePoolSnapshot.candidateEntries.filter((entry) => !occupiedTickets.has(entry.ticketNumber)).length
  return { eligibleCandidateCount, requestedReplacementCount: input.requestedReplacementCount, sufficient: eligibleCandidateCount >= input.requestedReplacementCount }
}
