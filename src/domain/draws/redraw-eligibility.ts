import type { CandidatePoolSnapshotEntry, DrawSession } from './draw-session.types.ts'
import type { DrawConfigurationSnapshot } from './draw-session.types.ts'
import type { Event } from '../events/event.types.ts'
import type { Participant } from '../participants/participant.types.ts'
import type { PrizeCategory } from '../prizes/prize.types.ts'
import type { WinnerRecord } from '../winners/winner.types.ts'

export interface RedrawRandomSource { nextUint32(): number }

export function buildRedrawCandidates(
  event: Event,
  category: PrizeCategory,
  configuration: DrawConfigurationSnapshot,
  snapshot: { readonly candidateEntries: readonly CandidatePoolSnapshotEntry[] },
  participants: readonly Participant[],
  winners: readonly WinnerRecord[],
  sessions: readonly DrawSession[],
  originals: readonly WinnerRecord[],
): CandidatePoolSnapshotEntry[] {
  const byId = new Map(participants.map((participant) => [participant.id, participant]))
  const snapshotIds = new Set<string>()
  const snapshotTickets = new Set<string>()
  for (const entry of snapshot.candidateEntries) {
    if (snapshotIds.has(entry.participantId) || snapshotTickets.has(entry.ticketNumber)) throw new Error('The immutable candidate snapshot contains duplicate participants or tickets.')
    snapshotIds.add(entry.participantId)
    snapshotTickets.add(entry.ticketNumber)
    const participant = byId.get(entry.participantId)
    if (participant === undefined || participant.eventId !== event.id || participant.ticketNumber !== entry.ticketNumber) throw new Error('An immutable candidate snapshot entry no longer matches its Participant.')
  }
  if (category.eventId !== event.id) throw new Error('The redraw category does not belong to the session Event.')
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const originalIds = new Set(originals.map((winner) => winner.participantId))
  const originalTickets = new Set(originals.map((winner) => winner.ticketNumber))
  const activeParticipants = new Set(winners.filter((winner) => winner.drawSessionId === originals[0]?.drawSessionId && winner.status !== 'cancelled').map((winner) => winner.participantId))
  const activeTickets = new Set(winners.filter((winner) => winner.drawSessionId === originals[0]?.drawSessionId && winner.status !== 'cancelled').map((winner) => winner.ticketNumber))
  const confirmed = new Set(winners.filter((winner) => winner.status === 'confirmed' && winner.eventId === event.id && (configuration.winningRule === 'once-per-event' || (configuration.winningRule === 'once-per-category' && winner.prizeCategoryId === category.id))).map((winner) => winner.participantId))
  const pendingInFlight = new Set(winners.filter((winner) => winner.status === 'pending' && sessionById.get(winner.drawSessionId)?.mode === 'live' && (sessionById.get(winner.drawSessionId)?.status === 'drawing' || sessionById.get(winner.drawSessionId)?.status === 'pending-confirmation')).map((winner) => winner.participantId))
  return snapshot.candidateEntries.filter((entry) => {
    const participant = byId.get(entry.participantId)
    if (participant === undefined || participant.eventId !== event.id || participant.ticketNumber !== entry.ticketNumber) return false
    if (configuration.requireCheckIn && !participant.isCheckedIn) return false
    if (configuration.eligibleGroupFilter !== null && participant.group !== configuration.eligibleGroupFilter) return false
    if (confirmed.has(participant.id) || pendingInFlight.has(participant.id) || originalIds.has(participant.id) || originalTickets.has(entry.ticketNumber) || activeParticipants.has(participant.id) || activeTickets.has(entry.ticketNumber)) return false
    return true
  })
}

export function selectRedrawCandidates<T>(candidates: readonly T[], count: number, random: RedrawRandomSource): T[] {
  const available = [...candidates]
  const selected: T[] = []
  while (selected.length < count) {
    const range = available.length
    const limit = Math.floor(0x100000000 / range) * range
    let value = random.nextUint32()
    while (value >= limit) value = random.nextUint32()
    const index = value % range
    const item = available[index]
    if (item === undefined) throw new Error('Redraw selection produced an invalid candidate index.')
    selected.push(item)
    available.splice(index, 1)
  }
  return selected
}
