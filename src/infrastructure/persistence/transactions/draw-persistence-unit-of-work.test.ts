import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
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
  seedReadyFixture,
  seedStartedFixture,
  ticket,
  TIME_2,
  TIME_3,
  TIME_4,
} from '../test/draw-history-test-helpers.ts'
import { DexieDrawPersistenceUnitOfWork } from './dexie-draw-persistence-unit-of-work.ts'

afterEach(cleanupTestDatabases)

describe('DexieDrawPersistenceUnitOfWork.persistStartedDraw', () => {
  it('atomically attaches snapshots, appends supplied pending winners and audit, and ends pending confirmation', async () => {
    const database = await openTestDatabase('uow-start')
    const fixture = makeDrawHistoryFixture()
    await seedReadyFixture(database, fixture)
    const winners = [
      makeWinner(fixture, 0, 1),
      makeWinner(fixture, 1, 2),
    ]
    const audit = makeAudit(fixture)
    const unit = new DexieDrawPersistenceUnitOfWork(database)

    await unit.persistStartedDraw({
      drawSessionId: fixture.session.id,
      expectedStatus: 'ready',
      snapshots: fixture.snapshots,
      winners,
      auditRecord: audit,
      at: TIME_3,
    })

    const session = await database.draw_sessions.get(fixture.session.id)
    expect(session?.status).toBe('pending-confirmation')
    expect(session?.updatedAt).toBe(TIME_3)
    expect(session?.configurationSnapshot).toEqual(
      fixture.snapshots.configurationSnapshot,
    )
    expect(
      session?.candidatePoolSnapshot?.candidateEntries[0]?.ticketNumber,
    ).toBe('00042')
    expect(
      await database.winner_records
        .where('drawSessionId')
        .equals(fixture.session.id)
        .sortBy('sequenceNumber'),
    ).toEqual(winners)
    expect(await database.audit_records.toArray()).toEqual([audit])
  })

  it('rolls back snapshots, status, winners, and audit for invalid snapshots', async () => {
    const database = await openTestDatabase('uow-start-snapshot-fail')
    const fixture = makeDrawHistoryFixture()
    await seedReadyFixture(database, fixture)
    const unit = new DexieDrawPersistenceUnitOfWork(database)
    const invalidSnapshots = {
      ...fixture.snapshots,
      candidatePoolSnapshot: {
        ...fixture.snapshots.candidatePoolSnapshot,
        eligibleSnapshotCount: 99,
      },
    }

    await expect(
      unit.persistStartedDraw({
        drawSessionId: fixture.session.id,
        expectedStatus: 'ready',
        snapshots: invalidSnapshots,
        winners: [
          makeWinner(fixture, 0, 1),
          makeWinner(fixture, 1, 2),
        ],
        auditRecord: makeAudit(fixture),
        at: TIME_3,
      }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(await database.draw_sessions.get(fixture.session.id)).toEqual(
      fixture.session,
    )
    expect(await database.winner_records.count()).toBe(0)
    expect(await database.audit_records.count()).toBe(0)
  })

  it('rolls back completely for invalid winners, duplicate sequence, invalid audit, and requested count mismatch', async () => {
    const cases = [
      'invalid-winner',
      'duplicate-sequence',
      'invalid-audit',
      'count-mismatch',
    ] as const

    for (const testCase of cases) {
      const database = await openTestDatabase(`uow-start-${testCase}`)
      const fixture = makeDrawHistoryFixture()
      await seedReadyFixture(database, fixture)
      const unit = new DexieDrawPersistenceUnitOfWork(database)
      const first = makeWinner(fixture, 0, 1)
      const second = makeWinner(fixture, 1, 2)
      const input = {
        drawSessionId: fixture.session.id,
        expectedStatus: 'ready' as const,
        snapshots: fixture.snapshots,
        winners:
          testCase === 'count-mismatch'
            ? [first]
            : testCase === 'duplicate-sequence'
              ? [first, { ...second, sequenceNumber: 1 }]
              : testCase === 'invalid-winner'
                ? [
                    first,
                    { ...second, eventId: fixture.otherEvent.id },
                  ]
                : [first, second],
        auditRecord:
          testCase === 'invalid-audit'
            ? makeAudit(fixture, 'winner-confirmed')
            : makeAudit(fixture),
        at: TIME_3,
      }

      await expect(unit.persistStartedDraw(input)).rejects.toBeInstanceOf(
        Error,
      )
      expect(
        await database.draw_sessions.get(fixture.session.id),
      ).toEqual(fixture.session)
      expect(await database.winner_records.count()).toBe(0)
      expect(await database.audit_records.count()).toBe(0)
    }
  })

  it.each([
    'snapshot-write',
    'session-transition',
    'winner-write',
    'partial-winner-write',
    'audit-write',
  ] as const)('rolls back every storage stage for a %s failure', async (stage) => {
    const database = await openTestDatabase(`uow-start-stage-${stage}`)
    const fixture = makeDrawHistoryFixture()
    await seedReadyFixture(database, fixture)
    const unit = new DexieDrawPersistenceUnitOfWork(database)
    const winners = [makeWinner(fixture, 0, 1), makeWinner(fixture, 1, 2)]
    const originalSessionPut = database.draw_sessions.put.bind(database.draw_sessions)
    const originalWinnerBulkAdd = database.winner_records.bulkAdd.bind(database.winner_records)

    if (stage === 'snapshot-write') {
      vi.spyOn(database.draw_sessions, 'put').mockRejectedValueOnce(new Error('snapshot write failed'))
    }
    if (stage === 'session-transition') {
      vi.spyOn(database.draw_sessions, 'put')
        .mockImplementationOnce((value) => originalSessionPut(value))
        .mockRejectedValueOnce(new Error('session transition failed'))
    }
    if (stage === 'winner-write') {
      vi.spyOn(database.winner_records, 'bulkAdd').mockRejectedValueOnce(new Error('winner write failed'))
    }
    if (stage === 'partial-winner-write') {
      vi.spyOn(database.winner_records, 'bulkAdd').mockImplementationOnce((records) => (
        originalWinnerBulkAdd([records[0]]).then(() => {
          throw new Error('later winner write failed')
        })
      ))
    }
    if (stage === 'audit-write') {
      vi.spyOn(database.audit_records, 'add').mockRejectedValueOnce(new Error('audit write failed'))
    }

    await expect(unit.persistStartedDraw({
      drawSessionId: fixture.session.id,
      expectedStatus: 'ready',
      snapshots: fixture.snapshots,
      winners,
      auditRecord: makeAudit(fixture),
      at: TIME_3,
    })).rejects.toBeInstanceOf(Error)

    expect(await database.draw_sessions.get(fixture.session.id)).toEqual(fixture.session)
    expect(await database.winner_records.count()).toBe(0)
    expect(await database.audit_records.count()).toBe(0)
  })

  it('rolls back transaction-time relationship validation after snapshot attachment', async () => {
    const database = await openTestDatabase('uow-start-relationship-transaction')
    const fixture = makeDrawHistoryFixture()
    await seedReadyFixture(database, fixture)
    const unit = new DexieDrawPersistenceUnitOfWork(database)
    const invalidWinner = { ...makeWinner(fixture, 0, 1), ticketNumber: ticket('99999') }

    await expect(unit.persistStartedDraw({
      drawSessionId: fixture.session.id,
      expectedStatus: 'ready',
      snapshots: fixture.snapshots,
      winners: [invalidWinner, makeWinner(fixture, 1, 2)],
      auditRecord: makeAudit(fixture),
      at: TIME_3,
    })).rejects.toBeInstanceOf(RelationshipMismatchError)

    expect(await database.draw_sessions.get(fixture.session.id)).toEqual(fixture.session)
    expect(await database.winner_records.count()).toBe(0)
    expect(await database.audit_records.count()).toBe(0)
  })

  it('rejects a pre-existing conflicting winner inside the transaction and rolls back snapshots', async () => {
    const database = await openTestDatabase('uow-start-duplicate-transaction')
    const fixture = makeDrawHistoryFixture()
    await seedReadyFixture(database, fixture)
    await database.winner_records.add(makeWinner(fixture, 0, 7))
    const unit = new DexieDrawPersistenceUnitOfWork(database)

    await expect(unit.persistStartedDraw({
      drawSessionId: fixture.session.id,
      expectedStatus: 'ready',
      snapshots: fixture.snapshots,
      winners: [makeWinner(fixture, 0, 1), makeWinner(fixture, 1, 2)],
      auditRecord: makeAudit(fixture),
      at: TIME_3,
    })).rejects.toBeInstanceOf(DuplicateRecordError)

    expect(await database.draw_sessions.get(fixture.session.id)).toEqual(fixture.session)
    expect(await database.winner_records.count()).toBe(1)
    expect(await database.audit_records.count()).toBe(0)
  })
})

describe('DexieDrawPersistenceUnitOfWork.transitionWinnersWithAudit', () => {
  it('confirms multiple pending winners and optionally completes the session atomically', async () => {
    const database = await openTestDatabase('uow-transition')
    const fixture = makeDrawHistoryFixture()
    await seedStartedFixture(database, fixture)
    const first = makeWinner(fixture, 0, 1)
    const second = makeWinner(fixture, 1, 2)
    await database.winner_records.bulkAdd([first, second])
    const audits = [
      makeAudit(fixture, 'winner-confirmed'),
      makeAudit(fixture, 'winner-confirmed'),
    ]
    const unit = new DexieDrawPersistenceUnitOfWork(database)

    await unit.transitionWinnersWithAudit({
      drawSessionId: fixture.session.id,
      transitions: [
        {
          winnerId: first.id,
          from: 'pending',
          to: 'confirmed',
          at: TIME_3,
        },
        {
          winnerId: second.id,
          from: 'pending',
          to: 'confirmed',
          at: TIME_3,
        },
      ],
      auditRecords: audits,
      sessionTransition: {
        from: 'pending-confirmation',
        to: 'completed',
        at: TIME_4,
      },
    })

    expect(
      (await database.winner_records.get(first.id))?.status,
    ).toBe('confirmed')
    expect(
      (await database.winner_records.get(second.id))?.confirmedAt,
    ).toBe(TIME_3)
    expect(
      (await database.draw_sessions.get(fixture.session.id))?.status,
    ).toBe('completed')
    expect(await database.audit_records.count()).toBe(2)
  })

  it('rolls back all winner changes for mixed stale statuses and rejects confirmed cancellation', async () => {
    const database = await openTestDatabase('uow-transition-status')
    const fixture = makeDrawHistoryFixture()
    await seedStartedFixture(database, fixture)
    const pending = makeWinner(fixture, 0, 1)
    const confirmed = makeWinner(fixture, 1, 2, {
      status: 'confirmed',
      confirmedAt: TIME_2,
    })
    await database.winner_records.bulkAdd([pending, confirmed])
    const unit = new DexieDrawPersistenceUnitOfWork(database)

    await expect(
      unit.transitionWinnersWithAudit({
        drawSessionId: fixture.session.id,
        transitions: [
          {
            winnerId: pending.id,
            from: 'pending',
            to: 'confirmed',
            at: TIME_3,
          },
          {
            winnerId: confirmed.id,
            from: 'pending',
            to: 'confirmed',
            at: TIME_3,
          },
        ],
        auditRecords: [makeAudit(fixture, 'winner-confirmed')],
      }),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    expect(await database.winner_records.get(pending.id)).toEqual(pending)
    expect(await database.winner_records.get(confirmed.id)).toEqual(
      confirmed,
    )
    expect(await database.audit_records.count()).toBe(0)

    await expect(
      unit.transitionWinnersWithAudit({
        drawSessionId: fixture.session.id,
        transitions: [
          {
            winnerId: confirmed.id,
            from: 'confirmed',
            to: 'cancelled',
            at: TIME_3,
          },
        ],
        auditRecords: [makeAudit(fixture, 'winner-cancelled')],
      }),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
  })

  it('rolls back winners and audit when an audit or optional session transition fails', async () => {
    for (const testCase of ['audit', 'session'] as const) {
      const database = await openTestDatabase(
        `uow-transition-${testCase}`,
      )
      const fixture = makeDrawHistoryFixture()
      await seedStartedFixture(database, fixture)
      const winner = makeWinner(fixture, 0, 1)
      await database.winner_records.add(winner)
      const audit = makeAudit(fixture, 'winner-confirmed')
      const unit = new DexieDrawPersistenceUnitOfWork(database)

      await expect(
        unit.transitionWinnersWithAudit({
          drawSessionId: fixture.session.id,
          transitions: [
            {
              winnerId: winner.id,
              from: 'pending',
              to: 'confirmed',
              at: TIME_3,
            },
          ],
          auditRecords:
            testCase === 'audit' ? [audit, audit] : [audit],
          ...(testCase === 'session'
            ? {
                sessionTransition: {
                  from: 'pending-confirmation' as const,
                  to: 'ready' as const,
                  at: TIME_4,
                },
              }
            : {}),
        }),
      ).rejects.toBeInstanceOf(
        testCase === 'audit'
          ? DuplicateRecordError
          : ValidationError,
      )
      expect(await database.winner_records.get(winner.id)).toEqual(
        winner,
      )
      expect(await database.audit_records.count()).toBe(0)
      expect(
        (await database.draw_sessions.get(fixture.session.id))?.status,
      ).toBe('pending-confirmation')
    }
  })
})

describe('DexieDrawPersistenceUnitOfWork.recordRedrawReplacement', () => {
  it.each(['pending', 'confirmed'] as const)(
    'cancels a %s original and appends its distinct pending replacement, lineage, and audits atomically',
    async (originalStatus) => {
      const database = await openTestDatabase(
        `uow-redraw-${originalStatus}`,
      )
      const fixture = makeDrawHistoryFixture()
      await seedStartedFixture(database, fixture)
      const original = makeWinner(fixture, 0, 1, {
        status: originalStatus,
        ...(originalStatus === 'confirmed'
          ? { confirmedAt: TIME_2 }
          : {}),
      })
      const existing = makeWinner(fixture, 1, 2)
      const replacement = makeWinner(fixture, 2, 3)
      await database.winner_records.bulkAdd([original, existing])
      const redraw = makeRedraw(fixture, original, replacement)
      const audits = [
        makeAudit(fixture, 'winner-cancelled'),
        makeAudit(fixture, 'redraw-recorded'),
      ]
      const unit = new DexieDrawPersistenceUnitOfWork(database)

      await unit.recordRedrawReplacement({
        drawSessionId: fixture.session.id,
        originalWinnerId: original.id,
        expectedOriginalStatus: originalStatus,
        replacementWinner: replacement,
        redrawRecord: redraw,
        auditRecords: audits,
        at: TIME_3,
      })

      expect(
        await database.winner_records.get(original.id),
      ).toMatchObject({
        id: original.id,
        participantId: original.participantId,
        ticketNumber: original.ticketNumber,
        status: 'cancelled',
        cancelledAt: TIME_3,
      })
      expect(
        await database.winner_records.get(replacement.id),
      ).toEqual(replacement)
      expect(await database.redraw_records.toArray()).toEqual([redraw])
      expect(await database.audit_records.count()).toBe(2)
    },
  )

  it('rolls back original cancellation for duplicate replacement ID and invalid candidate membership', async () => {
    for (const testCase of ['duplicate', 'candidate'] as const) {
      const database = await openTestDatabase(
        `uow-redraw-${testCase}`,
      )
      const fixture = makeDrawHistoryFixture()
      await seedStartedFixture(database, fixture)
      const original = makeWinner(fixture, 0, 1)
      const existing = makeWinner(fixture, 1, 2)
      await database.winner_records.bulkAdd([original, existing])
      const baseReplacement = makeWinner(fixture, 2, 3)
      const replacement =
        testCase === 'duplicate'
          ? { ...baseReplacement, id: existing.id }
          : {
              ...baseReplacement,
              ticketNumber: original.ticketNumber,
            }
      const unit = new DexieDrawPersistenceUnitOfWork(database)

      await expect(
        unit.recordRedrawReplacement({
          drawSessionId: fixture.session.id,
          originalWinnerId: original.id,
          expectedOriginalStatus: 'pending',
          replacementWinner: replacement,
          redrawRecord: makeRedraw(
            fixture,
            original,
            replacement,
          ),
          auditRecords: [
            makeAudit(fixture, 'redraw-recorded'),
          ],
          at: TIME_3,
        }),
      ).rejects.toBeInstanceOf(
        testCase === 'duplicate'
          ? DuplicateRecordError
          : RelationshipMismatchError,
      )
      expect(await database.winner_records.get(original.id)).toEqual(
        original,
      )
      expect(await database.winner_records.count()).toBe(2)
      expect(await database.redraw_records.count()).toBe(0)
      expect(await database.audit_records.count()).toBe(0)
    }
  })

  it('rolls back all stores for invalid RedrawRecord, audit, or optional session transition', async () => {
    for (const testCase of ['redraw', 'audit', 'session'] as const) {
      const database = await openTestDatabase(
        `uow-redraw-invalid-${testCase}`,
      )
      const fixture = makeDrawHistoryFixture()
      await seedStartedFixture(database, fixture)
      const original = makeWinner(fixture, 0, 1)
      const existing = makeWinner(fixture, 1, 2)
      const replacement = makeWinner(fixture, 2, 3)
      await database.winner_records.bulkAdd([original, existing])
      const audit = makeAudit(fixture, 'redraw-recorded')
      const unit = new DexieDrawPersistenceUnitOfWork(database)

      await expect(
        unit.recordRedrawReplacement({
          drawSessionId: fixture.session.id,
          originalWinnerId: original.id,
          expectedOriginalStatus: 'pending',
          replacementWinner: replacement,
          redrawRecord: makeRedraw(fixture, original, replacement, {
            ...(testCase === 'redraw'
              ? { reason: 'other' as const }
              : {}),
          }),
          auditRecords:
            testCase === 'audit' ? [audit, audit] : [audit],
          at: TIME_3,
          ...(testCase === 'session'
            ? {
                sessionTransition: {
                  from: 'pending-confirmation' as const,
                  to: 'ready' as const,
                  at: TIME_4,
                },
              }
            : {}),
        }),
      ).rejects.toBeInstanceOf(Error)
      expect(await database.winner_records.get(original.id)).toEqual(
        original,
      )
      expect(
        await database.winner_records.get(replacement.id),
      ).toBeUndefined()
      expect(await database.redraw_records.count()).toBe(0)
      expect(await database.audit_records.count()).toBe(0)
      expect(
        (await database.draw_sessions.get(fixture.session.id))?.status,
      ).toBe('pending-confirmation')
    }
  })

  it('rejects a second direct redraw while allowing a chained redraw from the prior replacement', async () => {
    const database = await openTestDatabase('uow-redraw-chain')
    const fixture = makeDrawHistoryFixture([
      '00042',
      '00043',
      '00044',
      '00045',
    ])
    await seedStartedFixture(database, fixture)
    const original = makeWinner(fixture, 0, 1)
    const replacement = makeWinner(fixture, 1, 2)
    await database.winner_records.add(original)
    const unit = new DexieDrawPersistenceUnitOfWork(database)

    await unit.recordRedrawReplacement({
      drawSessionId: fixture.session.id,
      originalWinnerId: original.id,
      expectedOriginalStatus: 'pending',
      replacementWinner: replacement,
      redrawRecord: makeRedraw(fixture, original, replacement),
      auditRecords: [makeAudit(fixture, 'redraw-recorded')],
      at: TIME_3,
    })

    const duplicateReplacement = makeWinner(fixture, 2, 3)
    await expect(
      unit.recordRedrawReplacement({
        drawSessionId: fixture.session.id,
        originalWinnerId: original.id,
        expectedOriginalStatus: 'pending',
        replacementWinner: duplicateReplacement,
        redrawRecord: makeRedraw(
          fixture,
          original,
          duplicateReplacement,
        ),
        auditRecords: [makeAudit(fixture, 'redraw-recorded')],
        at: TIME_4,
      }),
    ).rejects.toBeInstanceOf(ImmutableRecordError)

    const chainedReplacement = makeWinner(fixture, 2, 3)
    await unit.recordRedrawReplacement({
      drawSessionId: fixture.session.id,
      originalWinnerId: replacement.id,
      expectedOriginalStatus: 'pending',
      replacementWinner: chainedReplacement,
      redrawRecord: makeRedraw(
        fixture,
        replacement,
        chainedReplacement,
      ),
      auditRecords: [makeAudit(fixture, 'redraw-recorded')],
      at: TIME_4,
    })

    expect(await database.redraw_records.count()).toBe(2)
    expect(
      (await database.winner_records.get(replacement.id))?.status,
    ).toBe('cancelled')
    expect(
      (await database.winner_records.get(chainedReplacement.id))
        ?.sequenceNumber,
    ).toBe(3)
  })
})
