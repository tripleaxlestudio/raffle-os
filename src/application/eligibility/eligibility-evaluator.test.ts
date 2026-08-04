import { describe, expect, it } from 'vitest'
import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { Participant, TicketNumber } from '../../domain/participants/participant.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type {
  DrawConfigurationId,
  DrawSessionId,
  EventId,
  ParticipantId,
  PrizeCategoryId,
  WinnerRecordId,
} from '../../domain/shared/identifiers.ts'
import { evaluateEligibility } from './eligibility-evaluator.ts'
import type { EligibilityEvaluatorInput } from './eligibility.types.ts'

const timestamp = '2026-08-04T00:00:00.000Z' as never
const eventId = 'event-1' as EventId
const otherEventId = 'event-2' as EventId
const configurationId = 'configuration-1' as DrawConfigurationId
const categoryId = 'category-1' as PrizeCategoryId
const otherCategoryId = 'category-2' as PrizeCategoryId
const sessionId = 'session-1' as DrawSessionId

function makeEvent(id: EventId = eventId): Event {
  return {
    createdAt: timestamp,
    id,
    name: 'Annual Raffle',
    status: 'live',
    updatedAt: timestamp,
  }
}

function makeCategory(
  id: PrizeCategoryId = categoryId,
  owner: EventId = eventId,
): PrizeCategory {
  return {
    createdAt: timestamp,
    displayOrder: 1,
    eventId: owner,
    id,
    name: 'Category',
    prizeName: 'Prize',
  }
}

function makeConfiguration(
  overrides: Partial<DrawConfiguration> = {},
): DrawConfiguration {
  return {
    createdAt: timestamp,
    eligibleGroupFilter: null,
    eventId,
    id: configurationId,
    prizeCategoryId: categoryId,
    requestedWinners: 1,
    requireCheckIn: false,
    updatedAt: timestamp,
    winningRule: 'allow-repeat',
    ...overrides,
  }
}

function makeParticipant(
  id: string,
  ticketNumber: string,
  overrides: Partial<Participant> = {},
): Participant {
  return {
    createdAt: timestamp,
    eventId,
    id: id as ParticipantId,
    isCheckedIn: true,
    ticketNumber: ticketNumber as TicketNumber,
    updatedAt: timestamp,
    ...overrides,
  }
}

function makeWinner(
  participant: Participant,
  overrides: Partial<WinnerRecord> = {},
): WinnerRecord {
  return {
    createdAt: timestamp,
    drawSessionId: sessionId,
    eventId: participant.eventId,
    id: `winner-${participant.id}` as WinnerRecordId,
    participantId: participant.id,
    prizeCategoryId: categoryId,
    sequenceNumber: 1,
    status: 'confirmed',
    ticketNumber: participant.ticketNumber,
    updatedAt: timestamp,
    confirmedAt: timestamp,
    ...overrides,
  }
}

function input(
  overrides: Partial<EligibilityEvaluatorInput> = {},
): EligibilityEvaluatorInput {
  return {
    activeEvent: makeEvent(),
    drawConfiguration: makeConfiguration(),
    mode: 'live',
    participants: [makeParticipant('participant-1', '00042')],
    prizeCategory: makeCategory(),
    winnerRecords: [],
    ...overrides,
  }
}

function decision(result: ReturnType<typeof evaluateEligibility>) {
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value.decisions[0]
}

describe('evaluateEligibility', () => {
  it('accepts an unrestricted Participant and preserves exact ticket strings', () => {
    const result = evaluateEligibility(input())

    expect(result).toMatchObject({ ok: true })
    if (result.ok) {
      expect(result.value.eligibleEntries).toEqual([
        { participantId: 'participant-1', ticketNumber: '00042' },
      ])
    }
  })

  it('excludes a Participant from another Event with an explicit reason', () => {
    const result = evaluateEligibility(
      input({
        participants: [
          makeParticipant('participant-1', '1', { eventId: otherEventId }),
        ],
      }),
    )

    expect(decision(result)).toMatchObject({
      eligible: false,
      exclusionReasons: ['wrong-event'],
    })
  })

  it.each([
    ['configuration-event-mismatch', { drawConfiguration: makeConfiguration({ eventId: otherEventId }) }],
    ['configuration-category-mismatch', { drawConfiguration: makeConfiguration({ prizeCategoryId: otherCategoryId }) }],
    ['category-event-mismatch', { prizeCategory: makeCategory(categoryId, otherEventId) }],
  ])('returns a typed relationship failure for %s', (code, overrides) => {
    const result = evaluateEligibility(input(overrides))
    expect(result).toMatchObject({ ok: false, error: { code, kind: 'relationship' } })
  })

  it('applies the check-in requirement only when enabled', () => {
    const participant = makeParticipant('participant-1', '1', {
      isCheckedIn: false,
    })
    expect(
      decision(
        evaluateEligibility(
          input({
            drawConfiguration: makeConfiguration({ requireCheckIn: true }),
            participants: [participant],
          }),
        ),
      ),
    ).toMatchObject({ eligible: false, exclusionReasons: ['not-checked-in'] })
    expect(
      decision(evaluateEligibility(input({ participants: [participant] }))),
    ).toMatchObject({ eligible: true, exclusionReasons: [] })
  })

  it('uses exact persisted group equality and treats missing groups as mismatches', () => {
    const configuration = makeConfiguration({ eligibleGroupFilter: 'VIP' })
    expect(
      decision(
        evaluateEligibility(
          input({
            drawConfiguration: configuration,
            participants: [makeParticipant('participant-1', '1', { group: 'VIP' })],
          }),
        ),
      ),
    ).toMatchObject({ eligible: true })
    expect(
      decision(
        evaluateEligibility(
          input({
            drawConfiguration: configuration,
            participants: [makeParticipant('participant-1', '1')],
          }),
        ),
      ),
    ).toMatchObject({ eligible: false, exclusionReasons: ['group-filter-mismatch'] })
    expect(
      decision(
        evaluateEligibility(
          input({
            drawConfiguration: configuration,
            participants: [makeParticipant('participant-1', '1', { group: 'vip' })],
          }),
        ),
      ),
    ).toMatchObject({ eligible: false, exclusionReasons: ['group-filter-mismatch'] })
  })

  it.each([
    ['once-per-event', categoryId, false],
    ['once-per-category', categoryId, false],
    ['once-per-category', otherCategoryId, true],
    ['allow-repeat', categoryId, true],
  ] as const)('applies %s winner history correctly', (winningRule, winnerCategory, eligible) => {
    const participant = makeParticipant('participant-1', '1')
    const result = evaluateEligibility(
      input({
        drawConfiguration: makeConfiguration({
          prizeCategoryId: winnerCategory,
          winningRule,
        }),
        participants: [participant],
        prizeCategory: makeCategory(winnerCategory),
        winnerRecords: [makeWinner(participant, { prizeCategoryId: categoryId })],
      }),
    )
    expect(decision(result).eligible).toBe(eligible)
    if (!eligible) {
      expect(decision(result).exclusionReasons).toContain('previously-confirmed-winner')
    }
  })

  it('does not treat cancelled or pending history as confirmed wins', () => {
    const participant = makeParticipant('participant-1', '1')
    for (const status of ['cancelled', 'pending'] as const) {
      const winner = makeWinner(participant, {
        cancelledAt: status === 'cancelled' ? timestamp : undefined,
        confirmedAt: undefined,
        id: `winner-${status}` as WinnerRecordId,
        status,
      })
      const result = evaluateEligibility(
        input({
          drawConfiguration: makeConfiguration({ winningRule: 'once-per-event' }),
          participants: [participant],
          winnerRecords: [winner],
        }),
      )
      expect(decision(result)).toMatchObject({ eligible: true })
    }
  })

  it('blocks a pending winner from an active official session in Live mode', () => {
    const participant = makeParticipant('participant-1', '1')
    const pendingWinner = makeWinner(participant, {
      confirmedAt: undefined,
      id: 'winner-pending' as WinnerRecordId,
      status: 'pending',
    })
    const result = evaluateEligibility(
      input({
        mode: 'live',
        participants: [participant],
        ruleContext: { activeOfficialSessionId: sessionId },
        winnerRecords: [pendingWinner],
      }),
    )
    expect(decision(result)).toMatchObject({
      eligible: false,
      exclusionReasons: ['otherwise-disallowed-winner'],
    })
  })

  it('isolates Practice from official winner history and in-flight pending records', () => {
    const participant = makeParticipant('participant-1', '1')
    const result = evaluateEligibility(
      input({
        mode: 'practice',
        participants: [participant],
        ruleContext: { activeOfficialSessionId: sessionId },
        winnerRecords: [makeWinner(participant)],
      }),
    )
    expect(decision(result)).toMatchObject({ eligible: true })
  })

  it('returns all simultaneous exclusion reasons without mutating inputs', () => {
    const participant = makeParticipant('participant-1', '00042', {
      group: 'STAFF',
      isCheckedIn: false,
    })
    const winner = makeWinner(participant)
    const participants = Object.freeze([participant])
    const winners = Object.freeze([winner])
    const beforeParticipant = structuredClone(participant)
    const beforeWinner = structuredClone(winner)
    const result = evaluateEligibility(
      input({
        drawConfiguration: makeConfiguration({
          eligibleGroupFilter: 'VIP',
          requireCheckIn: true,
          winningRule: 'once-per-event',
        }),
        participants,
        winnerRecords: winners,
      }),
    )
    expect(decision(result).exclusionReasons).toEqual([
      'not-checked-in',
      'group-filter-mismatch',
      'previously-confirmed-winner',
    ])
    expect(participant).toEqual(beforeParticipant)
    expect(winner).toEqual(beforeWinner)
  })

  it('keeps 00042 and 42 distinct and is deterministic on repeated evaluation', () => {
    const firstInput = input({
      participants: [
        makeParticipant('participant-1', '00042'),
        makeParticipant('participant-2', '42'),
      ],
    })
    const first = evaluateEligibility(firstInput)
    const second = evaluateEligibility(firstInput)
    expect(first).toEqual(second)
    if (first.ok) {
      expect(first.value.eligibleEntries.map((entry) => entry.ticketNumber)).toEqual([
        '00042',
        '42',
      ])
    }
  })

  it('returns typed failures for invalid data and corrupt duplicate history', () => {
    const invalidParticipant = makeParticipant('participant-1', '')
    expect(
      evaluateEligibility(input({ participants: [invalidParticipant] })),
    ).toMatchObject({ ok: false, error: { code: 'invalid-participant', kind: 'validation' } })

    const participant = makeParticipant('participant-1', '1')
    const duplicate = makeWinner(participant, { id: 'winner-2' as WinnerRecordId })
    expect(
      evaluateEligibility(input({ participants: [participant], winnerRecords: [makeWinner(participant), duplicate] })),
    ).toMatchObject({ ok: false, error: { code: 'duplicate-winner-record', kind: 'integrity' } })

    expect(
      evaluateEligibility(
        input({
          participants: [participant],
          winnerRecords: [
            makeWinner(participant, {
              cancelledAt: timestamp,
              status: 'confirmed',
            }),
          ],
        }),
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalid-winner-record', kind: 'integrity' } })
  })
})
