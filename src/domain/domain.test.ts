import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  isStructuredCloneSafeAuditDetail,
  type AuditDetailValue,
} from './audit/audit.types.ts'
import {
  validateBlackoutAppearance,
  validateDisplayConfiguration,
  validateSafeAreaMargin,
  validateTargetResolution,
} from './display/display-configuration.types.ts'
import {
  attachSnapshotsAndStartDrawing,
  canTransitionDrawSessionStatus,
  transitionDrawSessionStatus,
  validateCandidatePoolSnapshot,
  validateDrawConfigurationUpdate,
  validateDrawStartSnapshots,
  validateRequestedWinners,
} from './draws/draw.invariants.ts'
import type { DrawConfiguration } from './draws/draw-configuration.types.ts'
import type {
  CandidatePoolSnapshot,
  DrawConfigurationSnapshot,
  DrawSession,
  DrawStartSnapshots,
} from './draws/draw-session.types.ts'
import {
  canHardDeleteEvent,
  canTransitionEventStatus,
  transitionEventStatus,
  validateEvent,
} from './events/event.invariants.ts'
import type { Event } from './events/event.types.ts'
import {
  parseTicketNumber,
  validateParticipant,
} from './participants/participant.invariants.ts'
import type { Participant } from './participants/participant.types.ts'
import {
  validatePrizeCategory,
  type PrizeCategory,
} from './prizes/prize.types.ts'
import {
  isApplicationPreferenceKey,
  isStructuredCloneSafePreferenceValue,
  validateApplicationPreferenceValue,
} from './preferences/application-preference.types.ts'
import {
  createAuditRecordId,
  createDisplayConfigurationId,
  createDrawConfigurationId,
  createDrawSessionId,
  createEventId,
  createParticipantId,
  createPrizeCategoryId,
  createRedrawRecordId,
  createWinnerRecordId,
  parseAuditRecordId,
  parseDisplayConfigurationId,
  parseDrawConfigurationId,
  parseDrawSessionId,
  parseEventId,
  parseParticipantId,
  parsePrizeCategoryId,
  parseRedrawRecordId,
  parseWinnerRecordId,
} from './shared/identifiers.ts'
import type { Result } from './shared/result.ts'
import {
  isoTimestampFromDate,
  parseIsoTimestamp,
} from './shared/timestamps.ts'
import type { RedrawRecord } from './winners/redraw.types.ts'
import {
  canTransitionWinnerStatus,
  transitionWinnerStatus,
  validateRedrawRelationship,
  validateWinnerSequence,
} from './winners/winner.invariants.ts'
import type {
  WinnerRecord,
  WinnerStatus,
} from './winners/winner.types.ts'

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  return result.value
}

const identifierValues = {
  audit: '10000000-0000-4000-8000-000000000001',
  configuration: '20000000-0000-4000-8000-000000000001',
  display: '30000000-0000-4000-8000-000000000001',
  event: '40000000-0000-4000-8000-000000000001',
  participant: '50000000-0000-4000-8000-000000000001',
  participantTwo: '50000000-0000-4000-8000-000000000002',
  prize: '60000000-0000-4000-8000-000000000001',
  redraw: '70000000-0000-4000-8000-000000000001',
  session: '80000000-0000-4000-8000-000000000001',
  winner: '90000000-0000-4000-8000-000000000001',
  winnerTwo: '90000000-0000-4000-8000-000000000002',
} as const

const timestamp = unwrap(
  parseIsoTimestamp('2026-07-30T12:30:45.000Z'),
)
const laterTimestamp = unwrap(
  parseIsoTimestamp('2026-07-30T12:31:45.000Z'),
)
const eventId = unwrap(parseEventId(identifierValues.event))
const participantId = unwrap(
  parseParticipantId(identifierValues.participant),
)
const participantTwoId = unwrap(
  parseParticipantId(identifierValues.participantTwo),
)
const prizeCategoryId = unwrap(
  parsePrizeCategoryId(identifierValues.prize),
)
const configurationId = unwrap(
  parseDrawConfigurationId(identifierValues.configuration),
)
const drawSessionId = unwrap(
  parseDrawSessionId(identifierValues.session),
)
const winnerRecordId = unwrap(
  parseWinnerRecordId(identifierValues.winner),
)
const replacementWinnerRecordId = unwrap(
  parseWinnerRecordId(identifierValues.winnerTwo),
)

const ticket00042 = unwrap(parseTicketNumber('00042'))
const ticket000001 = unwrap(parseTicketNumber('000001'))

const configuration: DrawConfiguration = {
  createdAt: timestamp,
  eligibleGroupFilter: null,
  eventId,
  id: configurationId,
  prizeCategoryId,
  requestedWinners: 1,
  requireCheckIn: true,
  updatedAt: timestamp,
  winningRule: 'once-per-event',
}

const configurationSnapshot: DrawConfigurationSnapshot = {
  capturedAt: timestamp,
  categoryName: 'Grand Prize',
  configurationId,
  eligibleGroupFilter: null,
  prizeCategoryId,
  prizeName: 'Electric Scooter',
  requestedWinners: 1,
  requireCheckIn: true,
  snapshotFormatVersion: 1,
  winningRule: 'once-per-event',
}

const candidatePoolSnapshot: CandidatePoolSnapshot = {
  candidateEntries: [
    {
      participantId,
      ticketNumber: ticket00042,
    },
  ],
  configurationId,
  capturedAt: timestamp,
  eventId,
  eligibleGroupFilter: null,
  eligibleSnapshotCount: 1,
  mode: 'live',
  prizeCategoryId,
  requireCheckIn: true,
  snapshotFormatVersion: 1,
  winningRule: 'once-per-event',
}

const startSnapshots: DrawStartSnapshots = {
  candidatePoolSnapshot,
  configurationSnapshot,
}

const readySession: DrawSession = {
  candidatePoolSnapshot: null,
  configurationId,
  configurationSnapshot: null,
  createdAt: timestamp,
  eventId,
  id: drawSessionId,
  mode: 'live',
  status: 'ready',
  updatedAt: timestamp,
}

const pendingWinner: WinnerRecord = {
  createdAt: timestamp,
  drawSessionId,
  eventId,
  id: winnerRecordId,
  participantId,
  prizeCategoryId,
  sequenceNumber: 1,
  status: 'pending',
  ticketNumber: ticket00042,
  updatedAt: timestamp,
}

describe('identifier and timestamp contracts', () => {
  it('generates every entity identifier as a UUID string', () => {
    const generated = [
      createEventId(),
      createParticipantId(),
      createPrizeCategoryId(),
      createDrawConfigurationId(),
      createDrawSessionId(),
      createWinnerRecordId(),
      createRedrawRecordId(),
      createAuditRecordId(),
      createDisplayConfigurationId(),
    ]

    for (const id of generated) {
      expect(typeof id).toBe('string')
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
    }
  })

  it('preserves validated identifier values exactly', () => {
    expect(unwrap(parseEventId(identifierValues.event))).toBe(
      identifierValues.event,
    )
    expect(
      unwrap(parseParticipantId(identifierValues.participant)),
    ).toBe(identifierValues.participant)
    expect(unwrap(parsePrizeCategoryId(identifierValues.prize))).toBe(
      identifierValues.prize,
    )
    expect(
      unwrap(
        parseDrawConfigurationId(identifierValues.configuration),
      ),
    ).toBe(identifierValues.configuration)
    expect(unwrap(parseDrawSessionId(identifierValues.session))).toBe(
      identifierValues.session,
    )
    expect(unwrap(parseWinnerRecordId(identifierValues.winner))).toBe(
      identifierValues.winner,
    )
    expect(unwrap(parseRedrawRecordId(identifierValues.redraw))).toBe(
      identifierValues.redraw,
    )
    expect(unwrap(parseAuditRecordId(identifierValues.audit))).toBe(
      identifierValues.audit,
    )
    expect(
      unwrap(
        parseDisplayConfigurationId(identifierValues.display),
      ),
    ).toBe(identifierValues.display)
  })

  it('rejects arbitrary and non-string identifiers', () => {
    expect(parseEventId('event-1').ok).toBe(false)
    expect(parseEventId(42).ok).toBe(false)
  })

  it('accepts valid UTC timestamps and deterministic Date conversion', () => {
    expect(parseIsoTimestamp('2026-07-30T12:30:45Z').ok).toBe(true)
    expect(
      isoTimestampFromDate(
        new Date('2026-07-30T12:30:45.123Z'),
      ),
    ).toEqual({
      ok: true,
      value: '2026-07-30T12:30:45.123Z',
    })
  })

  it.each([
    '30 Jul 2026 12:30',
    '2026-07-30T12:30:45+07:00',
    '2026-07-30T12:30:45',
    '2026-02-31T12:30:45Z',
  ])('rejects an invalid or non-UTC timestamp: %s', (value) => {
    expect(parseIsoTimestamp(value).ok).toBe(false)
  })
})

describe('event and participant invariants', () => {
  const event: Event = {
    createdAt: timestamp,
    id: eventId,
    name: 'Nusantara Tech Gala',
    status: 'draft',
    updatedAt: timestamp,
  }

  const participant: Participant = {
    createdAt: timestamp,
    eventId,
    id: participantId,
    isCheckedIn: true,
    ticketNumber: ticket00042,
    updatedAt: timestamp,
  }

  it('requires a non-empty trimmed event name', () => {
    expect(validateEvent(event).ok).toBe(true)
    expect(validateEvent({ ...event, name: '   ' }).ok).toBe(false)
  })

  it('guards event transitions and hard deletion capability', () => {
    expect(canTransitionEventStatus('draft', 'ready')).toBe(true)
    expect(canTransitionEventStatus('draft', 'live')).toBe(false)
    expect(transitionEventStatus(event, 'ready', laterTimestamp)).toMatchObject(
      {
        ok: true,
        value: { status: 'ready', updatedAt: laterTimestamp },
      },
    )
    expect(canHardDeleteEvent(event, false)).toBe(true)
    expect(canHardDeleteEvent(event, true)).toBe(false)
  })

  it('validates prize names and non-negative display order', () => {
    const prizeCategory: PrizeCategory = {
      createdAt: timestamp,
      displayOrder: 0,
      eventId,
      id: prizeCategoryId,
      name: 'Grand Prize',
      prizeName: 'Electric Scooter',
    }

    expect(validatePrizeCategory(prizeCategory).ok).toBe(true)
    expect(
      validatePrizeCategory({
        ...prizeCategory,
        prizeName: ' ',
      }).ok,
    ).toBe(false)
    expect(
      validatePrizeCategory({
        ...prizeCategory,
        displayOrder: -1,
      }).ok,
    ).toBe(false)
  })

  it('preserves leading-zero ticket strings exactly', () => {
    expect(ticket00042).toBe('00042')
    expect(ticket000001).toBe('000001')
    expect(validateParticipant(participant).ok).toBe(true)
  })

  it('rejects empty and numeric ticket values', () => {
    expect(parseTicketNumber('').ok).toBe(false)
    expect(parseTicketNumber(42).ok).toBe(false)
  })

  it('does not trim or numerically normalize ticket values', () => {
    expect(unwrap(parseTicketNumber(' 00042 '))).toBe(' 00042 ')
    expect(unwrap(parseTicketNumber('00042'))).not.toBe('42')
  })

  it('does not put import validation status on Participant', () => {
    expect('validationStatus' in participant).toBe(false)
    expect('status' in participant).toBe(false)
  })
})

describe('draw configuration and immutable start snapshots', () => {
  it.each([1, 100])(
    'accepts requested-winner boundary %i',
    (count) => {
      expect(validateRequestedWinners(count).ok).toBe(true)
    },
  )

  it.each([0, -1, 1.5, 101])(
    'rejects invalid requested-winner value %s',
    (count) => {
      expect(validateRequestedWinners(count).ok).toBe(false)
    },
  )

  it('allows prizeCategoryId to change while the configuration is unused', () => {
    const proposed = {
      ...configuration,
      prizeCategoryId: createPrizeCategoryId(),
      updatedAt: laterTimestamp,
    }

    expect(
      validateDrawConfigurationUpdate(configuration, proposed, {
        hasStartedDrawSession: false,
      }),
    ).toEqual({ ok: true, value: proposed })
  })

  it('rejects a draft update that changes the configuration ID', () => {
    expect(
      validateDrawConfigurationUpdate(
        configuration,
        {
          ...configuration,
          id: createDrawConfigurationId(),
          updatedAt: laterTimestamp,
        },
        { hasStartedDrawSession: false },
      ).ok,
    ).toBe(false)
  })

  it('rejects a draft update that changes Event ownership', () => {
    expect(
      validateDrawConfigurationUpdate(
        configuration,
        {
          ...configuration,
          eventId: createEventId(),
          updatedAt: laterTimestamp,
        },
        { hasStartedDrawSession: false },
      ).ok,
    ).toBe(false)
  })

  it('rejects a draft update that changes createdAt', () => {
    expect(
      validateDrawConfigurationUpdate(
        configuration,
        {
          ...configuration,
          createdAt: laterTimestamp,
          updatedAt: laterTimestamp,
        },
        { hasStartedDrawSession: false },
      ).ok,
    ).toBe(false)
  })

  it('allows all valid draft-editable operational fields to change', () => {
    const proposed = {
      ...configuration,
      eligibleGroupFilter: 'VIP',
      prizeCategoryId: createPrizeCategoryId(),
      requestedWinners: 3,
      requireCheckIn: false,
      updatedAt: laterTimestamp,
      winningRule: 'allow-repeat' as const,
    }

    expect(
      validateDrawConfigurationUpdate(
        configuration,
        proposed,
        { hasStartedDrawSession: false },
      ),
    ).toEqual({ ok: true, value: proposed })
  })

  it('validates the resulting draft configuration', () => {
    expect(
      validateDrawConfigurationUpdate(
        configuration,
        {
          ...configuration,
          requestedWinners: 101,
          updatedAt: laterTimestamp,
        },
        { hasStartedDrawSession: false },
      ).ok,
    ).toBe(false)
  })

  it('locks every configuration update after a session starts', () => {
    expect(
      validateDrawConfigurationUpdate(
        configuration,
        {
          ...configuration,
          prizeCategoryId: createPrizeCategoryId(),
          updatedAt: laterTimestamp,
        },
        { hasStartedDrawSession: true },
      ).ok,
    ).toBe(false)
  })

  it('requires candidate count to match the entry count', () => {
    expect(
      validateCandidatePoolSnapshot({
        ...candidatePoolSnapshot,
        eligibleSnapshotCount: 2,
      }).ok,
    ).toBe(false)
  })

  it('rejects duplicate candidate participant IDs', () => {
    expect(
      validateCandidatePoolSnapshot({
        ...candidatePoolSnapshot,
        candidateEntries: [
          candidatePoolSnapshot.candidateEntries[0],
          {
            participantId,
            ticketNumber: ticket000001,
          },
        ],
        eligibleSnapshotCount: 2,
      }).ok,
    ).toBe(false)
  })

  it('rejects duplicate candidate ticket values', () => {
    expect(
      validateCandidatePoolSnapshot({
        ...candidatePoolSnapshot,
        candidateEntries: [
          candidatePoolSnapshot.candidateEntries[0],
          {
            participantId: participantTwoId,
            ticketNumber: ticket00042,
          },
        ],
        eligibleSnapshotCount: 2,
      }).ok,
    ).toBe(false)
  })

  it('retains exact leading-zero tickets in candidate entries', () => {
    expect(
      unwrap(
        validateCandidatePoolSnapshot(candidatePoolSnapshot),
      ).candidateEntries[0]?.ticketNumber,
    ).toBe('00042')
  })

  it('requires complete and mutually consistent draw snapshots', () => {
    expect(validateDrawStartSnapshots(startSnapshots).ok).toBe(true)
    expect(
      validateDrawStartSnapshots({
        ...startSnapshots,
        candidatePoolSnapshot: {
          ...candidatePoolSnapshot,
          requireCheckIn: false,
        },
      }).ok,
    ).toBe(false)
  })

  it('requires both snapshots to enter drawing', () => {
    expect(
      canTransitionDrawSessionStatus('ready', 'drawing'),
    ).toBe(true)
    expect(
      attachSnapshotsAndStartDrawing(
        readySession,
        startSnapshots,
        laterTimestamp,
      ),
    ).toMatchObject({
      ok: true,
      value: {
        candidatePoolSnapshot,
        configurationSnapshot,
        status: 'drawing',
      },
    })
  })

  it('does not expose drawing through the general transition helper', () => {
    expectTypeOf(transitionDrawSessionStatus).parameter(1).not.toEqualTypeOf<
      'drawing'
    >()
  })

  it('rejects replacement of already attached snapshots', () => {
    const started = unwrap(
      attachSnapshotsAndStartDrawing(
        readySession,
        startSnapshots,
        laterTimestamp,
      ),
    )
    const readyWithSnapshots: DrawSession = {
      ...started,
      status: 'ready',
    }

    expect(
      attachSnapshotsAndStartDrawing(
        readyWithSnapshots,
        startSnapshots,
        laterTimestamp,
      ).ok,
    ).toBe(false)
  })

  it('treats completed and cancelled sessions as terminal', () => {
    expect(canTransitionDrawSessionStatus('completed', 'ready')).toBe(
      false,
    )
    expect(canTransitionDrawSessionStatus('cancelled', 'ready')).toBe(
      false,
    )
  })
})

describe('winner and redraw lifecycle', () => {
  it('allows pending winners to be confirmed or cancelled', () => {
    expect(
      transitionWinnerStatus(
        pendingWinner,
        'confirmed',
        laterTimestamp,
      ),
    ).toMatchObject({
      ok: true,
      value: {
        confirmedAt: laterTimestamp,
        participantId,
        status: 'confirmed',
      },
    })
    expect(
      transitionWinnerStatus(
        pendingWinner,
        'cancelled',
        laterTimestamp,
      ).ok,
    ).toBe(true)
  })

  it('requires audited redraw context for confirmed cancellation', () => {
    const confirmed = unwrap(
      transitionWinnerStatus(
        pendingWinner,
        'confirmed',
        laterTimestamp,
      ),
    )

    expect(
      transitionWinnerStatus(
        confirmed,
        'cancelled',
        laterTimestamp,
      ).ok,
    ).toBe(false)
    expect(
      transitionWinnerStatus(
        confirmed,
        'cancelled',
        laterTimestamp,
        { auditedRedraw: true },
      ).ok,
    ).toBe(true)
  })

  it('keeps cancelled winners terminal', () => {
    expect(
      canTransitionWinnerStatus('cancelled', 'confirmed'),
    ).toBe(false)
    expect(
      canTransitionWinnerStatus('cancelled', 'cancelled'),
    ).toBe(false)
  })

  it('does not store replaced as a WinnerStatus', () => {
    const storedStatuses: readonly WinnerStatus[] = [
      'pending',
      'confirmed',
      'cancelled',
    ]

    expect(storedStatuses).not.toContain('replaced')
  })

  it.each([1, 20])(
    'accepts positive integer sequence %i',
    (sequence) => {
      expect(validateWinnerSequence(sequence).ok).toBe(true)
    },
  )

  it.each([0, -1, 1.5])(
    'rejects invalid winner sequence %s',
    (sequence) => {
      expect(validateWinnerSequence(sequence).ok).toBe(false)
    },
  )

  function makeRedraw(
    reason: RedrawRecord['reason'] = 'absent',
    reasonNote?: string,
  ) {
    const original = unwrap(
      transitionWinnerStatus(
        pendingWinner,
        'cancelled',
        laterTimestamp,
      ),
    )
    const replacement: WinnerRecord = {
      ...pendingWinner,
      id: replacementWinnerRecordId,
      participantId: participantTwoId,
      sequenceNumber: 2,
      ticketNumber: ticket000001,
    }
    const record: RedrawRecord = {
      createdAt: laterTimestamp,
      drawSessionId,
      eventId,
      id: unwrap(parseRedrawRecordId(identifierValues.redraw)),
      originalWinnerRecordId: original.id,
      reason,
      reasonNote,
      replacementWinnerRecordId: replacement.id,
    }

    return { original, record, replacement }
  }

  it('links a cancelled original to a distinct pending replacement', () => {
    const { original, record, replacement } = makeRedraw()
    expect(
      validateRedrawRelationship(record, original, replacement),
    ).toEqual({ ok: true, value: record })
    expect(replacement.id).not.toBe(original.id)
    expect(replacement.status).toBe('pending')
  })

  it('requires a non-empty note for the other reason', () => {
    const missing = makeRedraw('other')
    const provided = makeRedraw('other', 'Ticket was voided on site.')

    expect(
      validateRedrawRelationship(
        missing.record,
        missing.original,
        missing.replacement,
      ).ok,
    ).toBe(false)
    expect(
      validateRedrawRelationship(
        provided.record,
        provided.original,
        provided.replacement,
      ).ok,
    ).toBe(true)
  })

  it('rejects a redraw record that links one winner to itself', () => {
    const { original, record } = makeRedraw()
    const selfLinked: RedrawRecord = {
      ...record,
      replacementWinnerRecordId: original.id,
    }

    expect(
      validateRedrawRelationship(
        selfLinked,
        original,
        original,
      ).ok,
    ).toBe(false)
  })
})

describe('audit detail, display, and application preferences', () => {
  it('accepts structured-clone-safe audit detail', () => {
    const detail: AuditDetailValue = {
      count: 10,
      nested: ['00042', true, null],
    }

    expect(isStructuredCloneSafeAuditDetail(detail)).toBe(true)
  })

  it('rejects unsafe audit detail values and cyclic graphs', () => {
    const cyclic: { self?: object } = {}
    cyclic.self = cyclic

    expect(isStructuredCloneSafeAuditDetail(() => undefined)).toBe(false)
    expect(isStructuredCloneSafeAuditDetail(Symbol('detail'))).toBe(
      false,
    )
    expect(isStructuredCloneSafeAuditDetail(undefined)).toBe(false)
    expect(isStructuredCloneSafeAuditDetail(new Date())).toBe(false)
    expect(isStructuredCloneSafeAuditDetail(document.body)).toBe(false)
    expect(isStructuredCloneSafeAuditDetail(cyclic)).toBe(false)
  })

  it('allows repeated safe references that are not cyclic', () => {
    const shared = { ticket: '00042' }

    expect(
      isStructuredCloneSafeAuditDetail([shared, shared]),
    ).toBe(true)
  })

  it('accepts conservative positive display resolutions', () => {
    expect(
      validateTargetResolution({ height: 1080, width: 1920 }),
    ).toEqual({
      ok: true,
      value: { height: 1080, width: 1920 },
    })
    expect(
      validateTargetResolution({ height: 0, width: 1920 }).ok,
    ).toBe(false)
  })

  it('validates a complete display configuration', () => {
    expect(
      validateDisplayConfiguration({
        blackoutAppearance: 'pure-black',
        createdAt: timestamp,
        eventId,
        id: unwrap(
          parseDisplayConfigurationId(identifierValues.display),
        ),
        safeAreaMargin: 48,
        targetResolution: { height: 1080, width: 1920 },
        updatedAt: timestamp,
      }).ok,
    ).toBe(true)
  })

  it('accepts only pure-black blackout appearance', () => {
    expect(validateBlackoutAppearance('pure-black').ok).toBe(true)
    expect(validateBlackoutAppearance('branded').ok).toBe(false)
  })

  it('rejects negative or non-finite safe-area margins', () => {
    expect(validateSafeAreaMargin(0).ok).toBe(true)
    expect(validateSafeAreaMargin(-1).ok).toBe(false)
    expect(validateSafeAreaMargin(Number.NaN).ok).toBe(false)
  })

  it('validates the closed preference key set', () => {
    expect(isApplicationPreferenceKey('activeEventId')).toBe(true)
    expect(isApplicationPreferenceKey('lastOperatorMode')).toBe(true)
    expect(isApplicationPreferenceKey('theme')).toBe(false)
  })

  it('returns key-specific typed preference values', () => {
    const activeEvent = validateApplicationPreferenceValue(
      'activeEventId',
      identifierValues.event,
    )
    const mode = validateApplicationPreferenceValue(
      'lastOperatorMode',
      'live',
    )

    expectTypeOf(activeEvent).toEqualTypeOf<
      Result<typeof eventId | null>
    >()
    expectTypeOf(mode).toEqualTypeOf<
      Result<'practice' | 'live'>
    >()
    expect(activeEvent).toEqual({ ok: true, value: eventId })
    expect(mode).toEqual({ ok: true, value: 'live' })
  })

  it('rejects invalid preference values', () => {
    expect(
      validateApplicationPreferenceValue(
        'activeEventId',
        'event-1',
      ).ok,
    ).toBe(false)
    expect(
      validateApplicationPreferenceValue(
        'lastOperatorMode',
        'official',
      ).ok,
    ).toBe(false)
  })

  it('limits preference values to their structured-clone-safe registry', () => {
    expect(
      isStructuredCloneSafePreferenceValue(
        'activeEventId',
        eventId,
      ),
    ).toBe(true)
    expect(
      isStructuredCloneSafePreferenceValue(
        'lastOperatorMode',
        () => 'live',
      ),
    ).toBe(false)
  })
})

describe('production-domain source boundaries', () => {
  const productionSources = import.meta.glob(
    [
      './audit/*.ts',
      './display/*.ts',
      './draws/*.ts',
      './events/*.ts',
      './participants/*.ts',
      './preferences/*.ts',
      './prizes/*.ts',
      './shared/*.ts',
      './types/*.ts',
      './winners/*.ts',
    ],
    {
      eager: true,
      import: 'default',
      query: '?raw',
    },
  )

  it('does not import React, prototype, persistence, or draw randomness', () => {
    for (const [path, source] of Object.entries(productionSources)) {
      expect(source, path).toEqual(expect.any(String))
      if (typeof source !== 'string') {
        continue
      }

      expect(source, path).not.toMatch(/from\s+['"]react/)
      expect(source, path).not.toContain('prototype/')
      expect(source, path).not.toContain('indexedDB')
      expect(source, path).not.toContain('Dexie')
      expect(source, path).not.toContain('Math.random')
    }
  })
})
