import { describe, expect, it } from 'vitest'
import { buildCandidatePool } from './candidate-pool-builder.ts'
import type { CandidatePoolBuildInput } from './candidate-pool.types.ts'
import type { Participant } from '../../domain/participants/participant.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import { parseTicketNumber } from '../../domain/participants/participant.invariants.ts'
import { parseEventId, parseParticipantId, parsePrizeCategoryId, parseDrawConfigurationId } from '../../domain/shared/identifiers.ts'
import { parseIsoTimestamp } from '../../domain/shared/timestamps.ts'

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw new Error('fixture parse failed')
  return result.value
}
const time = unwrap(parseIsoTimestamp('2026-08-01T00:00:00.000Z'))
const eventId = unwrap(parseEventId('11111111-1111-4111-8111-111111111111'))
const categoryId = unwrap(parsePrizeCategoryId('22222222-2222-4222-8222-222222222222'))
const configurationId = unwrap(parseDrawConfigurationId('33333333-3333-4333-8333-333333333333'))

function participant(id: string, ticket: string, overrides: Partial<Participant> = {}): Participant {
  return {
    createdAt: time,
    eventId,
    id: unwrap(parseParticipantId(id)),
    isCheckedIn: true,
    ticketNumber: unwrap(parseTicketNumber(ticket)),
    updatedAt: time,
    ...overrides,
  }
}
const event: Event = { createdAt: time, id: eventId, name: 'Event', status: 'live', updatedAt: time }
const category: PrizeCategory = { createdAt: time, displayOrder: 0, eventId, id: categoryId, name: 'Category', prizeName: 'Prize' }
const configuration: DrawConfiguration = { createdAt: time, eligibleGroupFilter: null, eventId, id: configurationId, prizeCategoryId: categoryId, requestedWinners: 1, requireCheckIn: true, updatedAt: time, winningRule: 'once-per-event' }

function input(participants: readonly Participant[] = [participant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00042')], overrides: Partial<CandidatePoolBuildInput> = {}): CandidatePoolBuildInput {
  return { activeEvent: event, capturedAt: time, drawConfiguration: configuration, mode: 'live', participants, prizeCategory: category, winnerRecords: [], ...overrides }
}

describe('buildCandidatePool', () => {
  it('evaluates persisted participants, orders by exact ticket strings, and reports diagnostics', () => {
    const first = participant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '42')
    const second = participant('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00042')
    const excluded = participant('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '7', { isCheckedIn: false })
    const result = buildCandidatePool(input([excluded, first, second]))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.snapshot.candidateEntries.map((entry) => entry.ticketNumber)).toEqual(['00042', '42'])
    expect(result.value.diagnostics).toMatchObject({ totalEvaluated: 3, eligibleCount: 2, excludedCount: 1, exclusionCounts: { 'not-checked-in': 1 } })
  })

  it('keeps cross-event participants out of the snapshot and preserves mode context', () => {
    const otherEventParticipant = participant(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '00001',
      { eventId: unwrap(parseEventId('44444444-4444-4444-8444-444444444444')) },
    )
    const result = buildCandidatePool(input([otherEventParticipant]))
    expect(result).toMatchObject({ ok: false, error: { code: 'zero-eligible-candidates' } })
  })

  it('is independent of input order and preserves snapshot context', () => {
    const a = participant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '1')
    const b = participant('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '1')
    const first = buildCandidatePool(input([b, a]))
    const second = buildCandidatePool(input([a, b]))
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.value.snapshot.candidateEntries).toEqual(second.value.snapshot.candidateEntries)
    expect(first.value.snapshot).toMatchObject({ eventId, configurationId, prizeCategoryId: categoryId, mode: 'live', capturedAt: time, snapshotFormatVersion: 1 })
  })

  it('deep-freezes the complete snapshot and does not mutate inputs', () => {
    const source = [participant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00042')]
    const result = buildCandidatePool(input(source))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.isFrozen(result.value.snapshot)).toBe(true)
    expect(Object.isFrozen(result.value.snapshot.candidateEntries)).toBe(true)
    expect(Object.isFrozen(result.value.snapshot.candidateEntries[0])).toBe(true)
    expect(Object.isFrozen(source[0])).toBe(false)
    expect(() =>
      Reflect.apply(Array.prototype.push, result.value.snapshot.candidateEntries, [
        result.value.snapshot.candidateEntries[0],
      ]),
    ).toThrow()
    expect(result.value.snapshot.candidateEntries[0]?.ticketNumber).toBe('00042')
  })

  it('returns typed capacity failures', () => {
    const result = buildCandidatePool(input([], { drawConfiguration: { ...configuration, requestedWinners: 2 } }))
    expect(result).toMatchObject({ ok: false, error: { kind: 'capacity', code: 'zero-eligible-candidates', available: 0, requested: 2 } })
    const insufficient = buildCandidatePool(input(
      [participant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00042')],
      { drawConfiguration: { ...configuration, requestedWinners: 2 } },
    ))
    expect(insufficient).toMatchObject({ ok: false, error: { kind: 'capacity', code: 'insufficient-candidates', available: 1, requested: 2 } })
  })

  it('rejects a corrupt evaluator result instead of rebuilding candidates', () => {
    const source = participant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00042')
    const result = buildCandidatePool(input([source]), () => ({
      ok: true as const,
      value: { configurationId, decisions: [{ eligible: true, exclusionReasons: [], participantId: source.id, ticketNumber: unwrap(parseTicketNumber('42')) }], eligibleCount: 1, eligibleEntries: [{ participantId: source.id, ticketNumber: unwrap(parseTicketNumber('42')) }], excludedCount: 0, eventId, mode: 'live' as const, prizeCategoryId: categoryId },
    }))
    expect(result).toMatchObject({ ok: false, error: { code: 'candidate-source-mismatch' } })
  })
})
