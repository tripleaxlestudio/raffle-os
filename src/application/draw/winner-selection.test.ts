import { describe, expect, it } from 'vitest'
import type { CandidatePoolSnapshot, DrawConfigurationSnapshot } from '../../domain/draws/draw-session.types.ts'
import { createDrawConfigurationId, createDrawSessionId, createEventId, createParticipantId, createPrizeCategoryId, createWinnerRecordId } from '../../domain/shared/identifiers.ts'
import { parseIsoTimestamp } from '../../domain/shared/timestamps.ts'
import { parseTicketNumber } from '../../domain/participants/participant.invariants.ts'
import { selectWinners } from './winner-selection.ts'
import type { WinnerSelectionInput } from './winner-selection.types.ts'
import type { RandomSource } from './random-source.ts'

const at = (() => {
  const result = parseIsoTimestamp('2026-08-01T00:00:00.000Z')
  if (!result.ok) throw new Error(result.error.message)
  return result.value
})()

function source(...values: number[]): RandomSource & { readonly consumed: number[] } {
  const consumed: number[] = []
  let index = 0
  return {
    consumed,
    nextUint32: () => {
      const value = values[index]
      index += 1
      if (value === undefined) throw new Error('Deterministic source exhausted.')
      consumed.push(value)
      return value
    },
  }
}

function frozen<T extends object>(value: T): T {
  return Object.freeze(value)
}

function makeInput(
  count = 2,
  candidateTickets = ['00042', '42', '100'],
  randomSource: RandomSource = source(0, 0, 0, 0, 0),
): WinnerSelectionInput {
  const eventId = createEventId()
  const configurationId = createDrawConfigurationId()
  const prizeCategoryId = createPrizeCategoryId()
  const drawSessionId = createDrawSessionId()
  const entries = candidateTickets.map((ticketNumber) => frozen({
    participantId: createParticipantId(),
    ticketNumber: (() => {
      const result = parseTicketNumber(ticketNumber)
      if (!result.ok) throw new Error(result.error.message)
      return result.value
    })(),
  }))
  const configurationSnapshot: DrawConfigurationSnapshot = frozen({
    snapshotFormatVersion: 1,
    configurationId,
    prizeCategoryId,
    categoryName: 'Grand Prize',
    prizeName: 'Electric Bicycle',
    requestedWinners: count,
    winningRule: 'once-per-event',
    requireCheckIn: true,
    eligibleGroupFilter: 'VIP',
    capturedAt: at,
  })
  const candidatePoolSnapshot: CandidatePoolSnapshot = frozen({
    snapshotFormatVersion: 1,
    eventId,
    configurationId,
    prizeCategoryId,
    mode: 'live',
    capturedAt: at,
    winningRule: 'once-per-event',
    requireCheckIn: true,
    eligibleGroupFilter: 'VIP',
    candidateEntries: frozen(entries),
    eligibleSnapshotCount: entries.length,
  })
  return {
    candidatePoolSnapshot,
    configurationSnapshot,
    eventId,
    prizeCategoryId,
    mode: 'live',
    drawSessionId,
    at,
    randomSource,
    createWinnerRecordId: createWinnerRecordId,
  }
}

describe('selectWinners', () => {
  it('selects one winner in actual random selection order', () => {
    const input = makeInput(1, ['00042', '42', '100'], source(0, 0))
    const result = selectWinners(input)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.selectedCandidateEntries).toHaveLength(1)
    expect(result.value.selectedCandidateEntries[0]?.ticketNumber).toBe('42')
    expect(result.value.pendingWinners[0]).toMatchObject({
      ticketNumber: '42',
      sequenceNumber: 1,
      status: 'pending',
      eventId: input.eventId,
      prizeCategoryId: input.prizeCategoryId,
      drawSessionId: input.drawSessionId,
      createdAt: at,
      updatedAt: at,
    })
    expect(result.value.pendingWinners[0]?.confirmedAt).toBeUndefined()
    expect(result.value.pendingWinners[0]?.cancelledAt).toBeUndefined()
  })

  it('is deterministic for the same frozen input and random sequence', () => {
    const first = makeInput(2, ['00042', '42', '100'], source(0, 0, 1))
    const second = { ...first, randomSource: source(0, 0, 1), createWinnerRecordId: first.createWinnerRecordId }
    const left = selectWinners(first)
    const right = selectWinners(second)

    expect(left.ok && right.ok).toBe(true)
    if (!left.ok || !right.ok) return
    expect(left.value.selectedCandidateEntries.map((entry) => entry.ticketNumber))
      .toEqual(right.value.selectedCandidateEntries.map((entry) => entry.ticketNumber))
  })

  it('preserves exact ticket strings and treats leading-zero variants as distinct', () => {
    const input = makeInput(2, ['00042', '42'], source(0, 0))
    const result = selectWinners(input)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.pendingWinners.map((winner) => winner.ticketNumber)).toEqual(['42', '00042'])
    expect(new Set(result.value.pendingWinners.map((winner) => winner.participantId)).size).toBe(2)
  })

  it('assigns contiguous one-based sequences in selection order', () => {
    const input = makeInput(3, ['A', 'B', 'C'], source(0, 0, 0, 0))
    const result = selectWinners(input)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.pendingWinners.map((winner) => winner.sequenceNumber)).toEqual([1, 2, 3])
    expect(result.value.pendingWinners.map((winner) => winner.ticketNumber))
      .toEqual(result.value.selectedCandidateEntries.map((entry) => entry.ticketNumber))
  })

  it('supports the 100-winner boundary and full capacity', () => {
    const tickets = Array.from({ length: 100 }, (_, index) => String(index))
    const randomValues = Array.from({ length: 99 }, () => 0)
    const result = selectWinners(makeInput(100, tickets, source(...randomValues)))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.pendingWinners).toHaveLength(100)
    expect(result.value.pendingWinners.map((winner) => winner.sequenceNumber))
      .toEqual(Array.from({ length: 100 }, (_, index) => index + 1))
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 101])(
    'rejects invalid requested count %s before consuming randomness',
    (count) => {
      const random = source(0, 0, 0)
      const input = makeInput(count, ['00042', '42', '100'], random)
      const result = selectWinners(input)

      expect(result).toMatchObject({ ok: false, error: { code: 'invalid-requested-count' } })
      expect(random.consumed).toEqual([])
    },
  )

  it('rejects insufficient capacity before consuming randomness', () => {
    const random = source(0, 0)
    const result = selectWinners(makeInput(3, ['00042', '42'], random))

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'insufficient-capacity', requested: 3, available: 2 },
    })
    expect(random.consumed).toEqual([])
  })

  it('rejects a mutable snapshot and mutable candidate entries', () => {
    const input = makeInput()
    const mutableSnapshot = { ...input.candidatePoolSnapshot }
    expect(selectWinners({ ...input, candidatePoolSnapshot: mutableSnapshot })).toMatchObject({
      ok: false,
      error: { code: 'snapshot-not-frozen' },
    })
    const mutableEntrySnapshot = frozen({
      ...input.candidatePoolSnapshot,
      candidateEntries: frozen([{ ...input.candidatePoolSnapshot.candidateEntries[0] }]),
      eligibleSnapshotCount: 1,
    })
    expect(selectWinners({ ...input, candidatePoolSnapshot: mutableEntrySnapshot })).toMatchObject({
      ok: false,
      error: { code: 'candidate-entry-not-frozen' },
    })
  })

  it('rejects duplicate source identities and configuration relationships', () => {
    const input = makeInput(1, ['00042', '00042'])
    expect(selectWinners(input)).toMatchObject({ ok: false, error: { code: 'duplicate-ticket' } })
    const mismatched = { ...makeInput(), configurationSnapshot: frozen({
      ...makeInput().configurationSnapshot,
      configurationId: createDrawConfigurationId(),
    }) }
    expect(selectWinners(mismatched)).toMatchObject({ ok: false, error: { code: 'configuration-mismatch' } })
  })

  it('returns a typed random failure without exposing partial winners', () => {
    const random = source(0)
    const result = selectWinners(makeInput(3, ['1', '2', '3'], random))

    expect(result).toMatchObject({ ok: false, error: { code: 'random-failure' } })
    expect(result.ok && result.value).toBe(false)
  })

  it('does not mutate the frozen snapshot or its entries', () => {
    const input = makeInput(2, ['00042', '42', '100'], source(0, 0, 1))
    const before = input.candidatePoolSnapshot.candidateEntries.map((entry) => ({ ...entry }))
    selectWinners(input)

    expect(input.candidatePoolSnapshot.candidateEntries).toEqual(before)
    expect(Object.isFrozen(input.candidatePoolSnapshot)).toBe(true)
    expect(Object.isFrozen(input.candidatePoolSnapshot.candidateEntries)).toBe(true)
  })
})
