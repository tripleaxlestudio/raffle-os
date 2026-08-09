import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import type { AuditDetailValue } from '../../../domain/audit/audit.types.ts'
import { createDrawSessionId } from '../../../domain/shared/identifiers.ts'
import {
  DuplicateRecordError,
  ImmutableRecordError,
  RelationshipMismatchError,
  ValidationError,
} from '../errors/persistence-errors.ts'
import {
  cleanupTestDatabases,
  makeAudit,
  makeDrawHistoryFixture,
  makeRedraw,
  makeWinner,
  openTestDatabase,
  seedFixtureParents,
  seedReadyFixture,
  seedStartedFixture,
  TIME_1,
  TIME_2,
  TIME_3,
  TIME_4,
} from '../test/draw-history-test-helpers.ts'
import { DexieAuditRepository } from './audit.repository.ts'
import { DexieDrawSessionRepository } from './draw-session.repository.ts'
import { DexieRedrawRepository } from './redraw.repository.ts'
import { DexieWinnerRepository } from './winner.repository.ts'

afterEach(cleanupTestDatabases)

describe('DexieDrawSessionRepository', () => {
  it('finds by ID or null and deterministically finds the latest scoped session with an optional mode', async () => {
    const database = await openTestDatabase('session-reads')
    const fixture = makeDrawHistoryFixture()
    await seedFixtureParents(database, fixture)
    const repository = new DexieDrawSessionRepository(database)
    const practice = {
      ...fixture.session,
      id: createDrawSessionId(),
      mode: 'practice' as const,
      createdAt: TIME_3,
      updatedAt: TIME_3,
    }
    const liveTie = {
      ...fixture.session,
      id: createDrawSessionId(),
      createdAt: TIME_3,
      updatedAt: TIME_3,
    }
    await database.draw_sessions.bulkAdd([
      fixture.session,
      practice,
      liveTie,
    ])

    expect(await repository.findById(fixture.session.id)).toEqual(
      fixture.session,
    )
    expect(
      await repository.findById(createDrawSessionId()),
    ).toBeNull()
    expect(
      (await repository.findLatestByEventId(fixture.event.id))?.id,
    ).toBe(
      [practice.id, liveTie.id].sort((left, right) =>
        left.localeCompare(right),
      )[0],
    )
    expect(
      (
        await repository.findLatestByEventId(
          fixture.event.id,
          'practice',
        )
      )?.id,
    ).toBe(practice.id)
    expect(
      await repository.findLatestByEventId(fixture.otherEvent.id),
    ).toBeNull()
  })

  it('creates only a complete snapshot-free draft with matching parents and never overwrites a duplicate ID', async () => {
    const database = await openTestDatabase('session-create')
    const fixture = makeDrawHistoryFixture()
    await seedFixtureParents(database, fixture)
    const repository = new DexieDrawSessionRepository(database)
    const draft = {
      ...fixture.session,
      status: 'draft' as const,
    }

    await repository.createDraft(draft)
    await expect(repository.createDraft(draft)).rejects.toBeInstanceOf(
      DuplicateRecordError,
    )
    expect(await database.draw_sessions.get(draft.id)).toEqual(draft)

    await expect(
      repository.createDraft({ ...draft, updatedAt: TIME_2 }),
    ).rejects.toBeInstanceOf(DuplicateRecordError)
    expect(await database.draw_sessions.get(draft.id)).toEqual(draft)

    await expect(
      repository.createDraft({
        ...draft,
        id: createDrawSessionId(),
        status: 'ready',
      }),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      repository.createDraft({
        ...draft,
        id: createDrawSessionId(),
        eventId: fixture.otherEvent.id,
      }),
    ).rejects.toBeInstanceOf(RelationshipMismatchError)
  })

  it('rejects missing Event and DrawConfiguration parents', async () => {
    const database = await openTestDatabase('session-parents')
    const fixture = makeDrawHistoryFixture()
    const repository = new DexieDrawSessionRepository(database)
    const draft = {
      ...fixture.session,
      status: 'draft' as const,
    }

    await expect(repository.createDraft(draft)).rejects.toBeInstanceOf(
      RelationshipMismatchError,
    )
    await database.events.add(fixture.event)
    await expect(repository.createDraft(draft)).rejects.toBeInstanceOf(
      RelationshipMismatchError,
    )
  })

  it('attaches exact snapshots once, preserves leading zeroes, and applies the supplied timestamp', async () => {
    const database = await openTestDatabase('session-snapshot')
    const fixture = makeDrawHistoryFixture()
    await seedReadyFixture(database, fixture)
    const repository = new DexieDrawSessionRepository(database)

    await repository.attachSnapshotsAndTransitionToDrawing(
      fixture.session.id,
      'ready',
      fixture.snapshots,
      TIME_3,
    )

    const stored = await database.draw_sessions.get(fixture.session.id)
    expect(stored?.status).toBe('drawing')
    expect(stored?.updatedAt).toBe(TIME_3)
    expect(
      stored?.candidatePoolSnapshot?.candidateEntries[0]?.ticketNumber,
    ).toBe('00042')
    await expect(
      repository.attachSnapshotsAndTransitionToDrawing(
        fixture.session.id,
        'ready',
        fixture.snapshots,
        TIME_4,
      ),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    expect(await database.draw_sessions.get(fixture.session.id)).toEqual(
      stored,
    )
  })

  it('rejects count, candidate uniqueness, source, and Participant mismatches without changing the ready session', async () => {
    const database = await openTestDatabase('session-invalid-snapshot')
    const fixture = makeDrawHistoryFixture()
    await seedReadyFixture(database, fixture)
    const repository = new DexieDrawSessionRepository(database)
    const first = fixture.snapshots.candidatePoolSnapshot.candidateEntries[0]
    const second =
      fixture.snapshots.candidatePoolSnapshot.candidateEntries[1]
    if (first === undefined || second === undefined) {
      throw new Error('Fixture candidates are missing.')
    }
    const missingConfigurationSnapshot = structuredClone(
      fixture.snapshots,
    )
    Reflect.deleteProperty(
      missingConfigurationSnapshot,
      'configurationSnapshot',
    )

    const invalidSnapshots = [
      missingConfigurationSnapshot,
      {
        ...fixture.snapshots,
        candidatePoolSnapshot: {
          ...fixture.snapshots.candidatePoolSnapshot,
          eligibleSnapshotCount: 99,
        },
      },
      {
        ...fixture.snapshots,
        candidatePoolSnapshot: {
          ...fixture.snapshots.candidatePoolSnapshot,
          candidateEntries: [first, first],
          eligibleSnapshotCount: 2,
        },
      },
      {
        ...fixture.snapshots,
        candidatePoolSnapshot: {
          ...fixture.snapshots.candidatePoolSnapshot,
          candidateEntries: [
            first,
            {
              ...second,
              ticketNumber: first.ticketNumber,
            },
          ],
          eligibleSnapshotCount: 2,
        },
      },
      {
        ...fixture.snapshots,
        configurationSnapshot: {
          ...fixture.snapshots.configurationSnapshot,
          prizeName: 'Changed prize',
        },
      },
      {
        ...fixture.snapshots,
        candidatePoolSnapshot: {
          ...fixture.snapshots.candidatePoolSnapshot,
          candidateEntries: [
            {
              ...first,
              ticketNumber: second.ticketNumber,
            },
            second,
          ],
        },
      },
    ]

    for (const snapshots of invalidSnapshots) {
      await expect(
        repository.attachSnapshotsAndTransitionToDrawing(
          fixture.session.id,
          'ready',
          snapshots,
          TIME_3,
        ),
      ).rejects.toBeInstanceOf(Error)
      expect(
        await database.draw_sessions.get(fixture.session.id),
      ).toEqual(fixture.session)
    }
  })

  it('performs valid status transitions while rejecting stale, drawing-only, and terminal transitions', async () => {
    const database = await openTestDatabase('session-transition')
    const fixture = makeDrawHistoryFixture()
    await seedStartedFixture(database, fixture)
    const repository = new DexieDrawSessionRepository(database)

    await repository.transitionStatus(
      fixture.session.id,
      'pending-confirmation',
      'completed',
      TIME_3,
    )
    const completed = await database.draw_sessions.get(
      fixture.session.id,
    )
    expect(completed?.updatedAt).toBe(TIME_3)
    expect(completed?.completedAt).toBe(TIME_3)
    await expect(
      repository.transitionStatus(
        fixture.session.id,
        'pending-confirmation',
        'cancelled',
        TIME_4,
      ),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    await expect(
      repository.transitionStatus(
        fixture.session.id,
        'completed',
        'cancelled',
        TIME_4,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      repository.transitionStatus(
        fixture.session.id,
        'completed',
        'drawing',
        TIME_4,
      ),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
  })
})

describe('DexieWinnerRepository', () => {
  it('appends a valid pending winner and preserves its exact leading-zero ticket', async () => {
    const database = await openTestDatabase('winner-append')
    const fixture = makeDrawHistoryFixture()
    await seedStartedFixture(database, fixture)
    const winner = makeWinner(fixture, 0, 1)
    const repository = new DexieWinnerRepository(database)

    await repository.append(winner)
    expect(await database.winner_records.get(winner.id)).toEqual(winner)
    expect(
      (await database.winner_records.get(winner.id))?.ticketNumber,
    ).toBe('00042')
  })

  it('rejects Event, category, Participant, ticket, and candidate membership mismatches', async () => {
    const database = await openTestDatabase('winner-relations')
    const fixture = makeDrawHistoryFixture()
    await seedStartedFixture(database, fixture)
    const repository = new DexieWinnerRepository(database)
    const valid = makeWinner(fixture, 0, 1)
    const unrelated = makeDrawHistoryFixture(['99999'])

    const invalidWinners = [
      { ...valid, eventId: fixture.otherEvent.id },
      { ...valid, prizeCategoryId: unrelated.category.id },
      { ...valid, participantId: unrelated.participants[0]?.id ?? valid.participantId },
      { ...valid, ticketNumber: fixture.participants[1]?.ticketNumber ?? valid.ticketNumber },
    ]
    for (const winner of invalidWinners) {
      await expect(repository.append(winner)).rejects.toBeInstanceOf(
        RelationshipMismatchError,
      )
    }
    expect(await database.winner_records.count()).toBe(0)
  })

  it('normalizes duplicate IDs and sequence positions without overwriting history', async () => {
    const database = await openTestDatabase('winner-duplicates')
    const fixture = makeDrawHistoryFixture()
    await seedStartedFixture(database, fixture)
    const repository = new DexieWinnerRepository(database)
    const original = makeWinner(fixture, 0, 1)
    await repository.append(original)

    await expect(repository.append(original)).rejects.toBeInstanceOf(
      DuplicateRecordError,
    )
    await expect(
      repository.append(makeWinner(fixture, 1, 1)),
    ).rejects.toBeInstanceOf(DuplicateRecordError)
    expect(await database.winner_records.toArray()).toEqual([original])
  })

  it('retains terminal winner evidence when a conflicting record uses the same ID', async () => {
    const database = await openTestDatabase('winner-terminal-immutability')
    const fixture = makeDrawHistoryFixture()
    await seedStartedFixture(database, fixture)
    const repository = new DexieWinnerRepository(database)
    const confirmed = makeWinner(fixture, 0, 1, { status: 'confirmed', confirmedAt: TIME_3, updatedAt: TIME_3 })
    await database.winner_records.add(confirmed)
    await expect(repository.append({ ...confirmed, ticketNumber: '99999' as typeof confirmed.ticketNumber })).rejects.toBeInstanceOf(ValidationError)
    expect(await database.winner_records.get(confirmed.id)).toEqual(confirmed)

    const cancelled = makeWinner(fixture, 1, 2, { status: 'cancelled', cancelledAt: TIME_4, updatedAt: TIME_4 })
    await database.winner_records.add(cancelled)
    await expect(repository.append({ ...cancelled, ticketNumber: '88888' as typeof cancelled.ticketNumber })).rejects.toBeInstanceOf(ValidationError)
    expect(await database.winner_records.get(cancelled.id)).toEqual(cancelled)
  })

  it('inserts a valid batch atomically and rejects empty, duplicate participant, duplicate ticket, and invalid batches', async () => {
    const database = await openTestDatabase('winner-batch')
    const fixture = makeDrawHistoryFixture()
    await seedStartedFixture(database, fixture)
    const repository = new DexieWinnerRepository(database)
    const first = makeWinner(fixture, 0, 1)
    const second = makeWinner(fixture, 1, 2)

    await expect(repository.appendBatch([])).rejects.toBeInstanceOf(
      ValidationError,
    )
    await expect(
      repository.appendBatch([
        first,
        { ...second, participantId: first.participantId },
      ]),
    ).rejects.toBeInstanceOf(DuplicateRecordError)
    await expect(
      repository.appendBatch([
        first,
        { ...second, ticketNumber: first.ticketNumber },
      ]),
    ).rejects.toBeInstanceOf(DuplicateRecordError)
    await expect(
      repository.appendBatch([
        first,
        { ...second, eventId: fixture.otherEvent.id },
      ]),
    ).rejects.toBeInstanceOf(RelationshipMismatchError)
    expect(await database.winner_records.count()).toBe(0)

    await repository.appendBatch([second, first])
    expect(await repository.findByDrawSessionId(fixture.session.id)).toEqual(
      [first, second],
    )
  })

  it('uses confirmed compound-index scopes for Event and category reads', async () => {
    const database = await openTestDatabase('winner-queries')
    const fixture = makeDrawHistoryFixture()
    await seedStartedFixture(database, fixture)
    const pending = makeWinner(fixture, 0, 1)
    const confirmed = makeWinner(fixture, 1, 2, {
      status: 'confirmed',
      confirmedAt: TIME_3,
      updatedAt: TIME_3,
    })
    const other = makeWinner(fixture, 2, 3, {
      eventId: fixture.otherEvent.id,
      status: 'confirmed',
      confirmedAt: TIME_3,
      updatedAt: TIME_3,
    })
    await database.winner_records.bulkAdd([
      pending,
      confirmed,
      other,
    ])
    const repository = new DexieWinnerRepository(database)

    expect(
      await repository.findConfirmedByEventId(fixture.event.id),
    ).toEqual([confirmed])
    expect(
      await repository.findConfirmedByEventAndCategory(
        fixture.event.id,
        fixture.category.id,
      ),
    ).toEqual([confirmed])
  })

  it('supports pending confirmation and cancellation but rejects confirmed redraw and terminal transitions directly', async () => {
    const database = await openTestDatabase('winner-transitions')
    const fixture = makeDrawHistoryFixture()
    await seedStartedFixture(database, fixture)
    const first = makeWinner(fixture, 0, 1)
    const second = makeWinner(fixture, 1, 2)
    await database.winner_records.bulkAdd([first, second])
    const repository = new DexieWinnerRepository(database)

    await repository.transitionStatus(
      first.id,
      'pending',
      'confirmed',
      TIME_3,
    )
    await repository.transitionStatus(
      second.id,
      'pending',
      'cancelled',
      TIME_4,
    )
    const confirmed = await database.winner_records.get(first.id)
    const cancelled = await database.winner_records.get(second.id)
    expect(confirmed).toMatchObject({
      id: first.id,
      participantId: first.participantId,
      ticketNumber: first.ticketNumber,
      status: 'confirmed',
      confirmedAt: TIME_3,
      updatedAt: TIME_3,
    })
    expect(cancelled).toMatchObject({
      id: second.id,
      status: 'cancelled',
      cancelledAt: TIME_4,
    })
    await expect(
      repository.transitionStatus(
        first.id,
        'confirmed',
        'cancelled',
        TIME_4,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      repository.transitionStatus(
        second.id,
        'cancelled',
        'confirmed',
        TIME_4,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('DexieRedrawRepository', () => {
  it('queries by DrawSession and original winner with deterministic ordering and null misses', async () => {
    const database = await openTestDatabase('redraw-reads')
    const fixture = makeDrawHistoryFixture()
    await seedStartedFixture(database, fixture)
    const original = makeWinner(fixture, 0, 1, {
      status: 'cancelled',
      cancelledAt: TIME_2,
    })
    const replacement = makeWinner(fixture, 1, 2)
    const redraw = makeRedraw(fixture, original, replacement)
    await database.winner_records.bulkAdd([original, replacement])
    await database.redraw_records.add(redraw)
    const repository = new DexieRedrawRepository(database)

    expect(
      await repository.findByDrawSessionId(fixture.session.id),
    ).toEqual([redraw])
    expect(await repository.findByOriginalWinnerId(original.id)).toEqual(
      redraw,
    )
    expect(
      await repository.findByOriginalWinnerId(replacement.id),
    ).toBeNull()
  })

  it('appends only a valid cancelled-to-pending relationship and rejects a second redraw from one original', async () => {
    const database = await openTestDatabase('redraw-append')
    const fixture = makeDrawHistoryFixture()
    await seedStartedFixture(database, fixture)
    const original = makeWinner(fixture, 0, 1, {
      status: 'cancelled',
      cancelledAt: TIME_2,
    })
    const replacement = makeWinner(fixture, 1, 2)
    await database.winner_records.bulkAdd([original, replacement])
    const repository = new DexieRedrawRepository(database)
    const redraw = makeRedraw(fixture, original, replacement)

    await repository.append(redraw)
    const conflictingReplacement = makeWinner(fixture, 2, 3)
    await database.winner_records.add(conflictingReplacement)
    await expect(
      repository.append({
        ...redraw,
        id: makeRedraw(fixture, original, replacement).id,
        replacementWinnerRecordId: conflictingReplacement.id,
      }),
    ).rejects.toBeInstanceOf(DuplicateRecordError)
    expect(await database.redraw_records.toArray()).toEqual([redraw])
  })

  it('rejects identity, statuses, cross-session/Event, and missing other-note relationships without writing', async () => {
    const database = await openTestDatabase('redraw-invalid')
    const fixture = makeDrawHistoryFixture()
    await seedStartedFixture(database, fixture)
    const cancelled = makeWinner(fixture, 0, 1, {
      status: 'cancelled',
      cancelledAt: TIME_2,
    })
    const pending = makeWinner(fixture, 1, 2)
    const confirmed = makeWinner(fixture, 2, 3, {
      status: 'confirmed',
      confirmedAt: TIME_2,
    })
    await database.winner_records.bulkAdd([
      cancelled,
      pending,
      confirmed,
    ])
    const repository = new DexieRedrawRepository(database)

    const invalid = [
      makeRedraw(fixture, cancelled, pending, {
        replacementWinnerRecordId: cancelled.id,
      }),
      makeRedraw(fixture, pending, confirmed),
      makeRedraw(fixture, cancelled, confirmed),
      makeRedraw(fixture, cancelled, pending, {
        eventId: fixture.otherEvent.id,
      }),
      makeRedraw(fixture, cancelled, pending, {
        drawSessionId: createDrawSessionId(),
      }),
      makeRedraw(fixture, cancelled, pending, {
        reason: 'other',
      }),
    ]
    for (const redraw of invalid) {
      await expect(repository.append(redraw)).rejects.toBeInstanceOf(
        Error,
      )
    }
    expect(await database.redraw_records.count()).toBe(0)
  })
})

describe('DexieAuditRepository', () => {
  it('appends valid structured-clone-safe detail and returns isolated chronological records with an ID tie-breaker', async () => {
    const database = await openTestDatabase('audit')
    const fixture = makeDrawHistoryFixture()
    await database.events.bulkAdd([fixture.event, fixture.otherEvent])
    const repository = new DexieAuditRepository(database)
    const later = makeAudit(fixture, 'winner-confirmed', {
      timestamp: TIME_3,
      detail: { ticket: '00042', values: [1, true, null] },
    })
    const tieA = makeAudit(fixture)
    const tieB = makeAudit(fixture)
    const other = makeAudit(fixture, 'event-created', {
      eventId: fixture.otherEvent.id,
      timestamp: TIME_1,
    })
    await repository.append(later)
    await repository.append(tieB)
    await repository.append(tieA)
    await repository.append(other)

    expect(await repository.findByEventId(fixture.event.id)).toEqual([
      ...[tieA, tieB].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      later,
    ])
  })

  it('rejects duplicate IDs, missing Events, and invalid details without overwriting or partial writes', async () => {
    const database = await openTestDatabase('audit-invalid')
    const fixture = makeDrawHistoryFixture()
    await database.events.add(fixture.event)
    const repository = new DexieAuditRepository(database)
    const audit = makeAudit(fixture)
    await repository.append(audit)

    await expect(repository.append(audit)).rejects.toBeInstanceOf(
      DuplicateRecordError,
    )
    await expect(repository.append({ ...audit, action: 'event-created' })).rejects.toBeInstanceOf(
      DuplicateRecordError,
    )
    await expect(
      repository.append(
        makeAudit(fixture, 'event-created', {
          eventId: fixture.otherEvent.id,
        }),
      ),
    ).rejects.toBeInstanceOf(RelationshipMismatchError)
    const cyclic: { [key: string]: AuditDetailValue } = {}
    cyclic.self = cyclic
    await expect(
      repository.append(
        makeAudit(fixture, 'event-created', {
          detail: cyclic,
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(await database.audit_records.toArray()).toEqual([audit])
  })

  it('exposes append-only capability without update or delete methods', () => {
    for (const repository of [DexieDrawSessionRepository, DexieWinnerRepository, DexieRedrawRepository, DexieAuditRepository]) {
      const methods = Object.getOwnPropertyNames(repository.prototype)
      expect(methods, repository.name).not.toContain('put')
      expect(methods, repository.name).not.toContain('update')
      expect(methods, repository.name).not.toContain('delete')
      expect(methods, repository.name).not.toContain('remove')
    }
    expect(Object.getOwnPropertyNames(DexieAuditRepository.prototype)).toContain('append')
  })
})

describe('Slice 5 source boundaries', () => {
  const contractSources = import.meta.glob(
    [
      '../../../application/persistence/repositories/draw-session-repository.interface.ts',
      '../../../application/persistence/repositories/winner-repository.interface.ts',
      '../../../application/persistence/repositories/redraw-repository.interface.ts',
      '../../../application/persistence/repositories/audit-repository.interface.ts',
      '../../../application/persistence/draw-persistence-unit-of-work.interface.ts',
    ],
    {
      eager: true,
      import: 'default',
      query: '?raw',
    },
  )
  const implementationSources = import.meta.glob(
    [
      './draw-session.repository.ts',
      './winner.repository.ts',
      './redraw.repository.ts',
      './audit.repository.ts',
      '../transactions/dexie-draw-persistence-unit-of-work.ts',
    ],
    {
      eager: true,
      import: 'default',
      query: '?raw',
    },
  )
  const presentationSources = import.meta.glob(
    [
      '../../../main.tsx',
      '../../../app/**/*.{ts,tsx}',
      '../../../pages/**/*.{ts,tsx}',
      '../../../prototype/**/*.{ts,tsx}',
      '../../../shared/**/*.{ts,tsx}',
      '../../../ui/**/*.{ts,tsx}',
    ],
    {
      eager: true,
      import: 'default',
      query: '?raw',
    },
  )

  it('keeps application contracts domain-only', () => {
    for (const [path, source] of Object.entries(contractSources)) {
      expect(source, path).toEqual(expect.any(String))
      if (typeof source !== 'string') {
        continue
      }
      expect(source, path).not.toMatch(
        /dexie|indexedDB|react|prototype|route|page/i,
      )
      for (const match of source.matchAll(
        /from\s+['"]([^'"]+)['"]/g,
      )) {
        expect(match[1], path).toContain('/domain/')
      }
    }
  })

  it('contains persistence only, with no selection, eligibility calculation, lifecycle opening, or UI imports', () => {
    for (const [path, source] of Object.entries(
      implementationSources,
    )) {
      expect(source, path).toEqual(expect.any(String))
      if (typeof source !== 'string') {
        continue
      }
      expect(source, path).not.toMatch(
        /Math\.random|crypto\.getRandomValues|Fisher.Yates|BroadcastChannel/i,
      )
      expect(source, path).not.toMatch(
        /calculateEligibility|selectWinner|selectCandidates|constructCandidatePool/i,
      )
      expect(source, path).not.toMatch(
        /from\s+['"][^'"]*(?:react|prototype|pages|routes)/,
      )
      expect(source, path).not.toContain('new RaffleOSDatabase')
      expect(source, path).not.toMatch(
        /database\.open(?:Supported)?\s*\(/,
      )
    }
  })

  it('keeps React, routes, pages, UI, and prototype disconnected', () => {
    for (const [path, source] of Object.entries(
      presentationSources,
    )) {
      if (typeof source !== 'string') {
        continue
      }
      expect(source, path).not.toMatch(
        /(?:from\s+|import\s*\()['"][^'"]*(?:draw-session\.repository|winner\.repository|redraw\.repository|audit\.repository|draw-persistence-unit-of-work)/,
      )
    }
  })
})
