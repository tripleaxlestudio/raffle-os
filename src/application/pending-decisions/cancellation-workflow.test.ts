import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CancelPendingWinnersCommand } from './command.types.ts'
import type { CommandId } from '../../domain/shared/identifiers.ts'
import { CancellationService } from './cancellation-service.ts'
import { DexieCommandReceiptRepository } from '../../infrastructure/persistence/repositories/command-receipt.repository.ts'
import { DexieDrawPersistenceUnitOfWork } from '../../infrastructure/persistence/transactions/dexie-draw-persistence-unit-of-work.ts'
import { cleanupTestDatabases, makeDrawHistoryFixture, makeWinner, openTestDatabase, seedStartedFixture } from '../../infrastructure/persistence/test/draw-history-test-helpers.ts'

afterEach(cleanupTestDatabases)

function command(sessionId: CancelPendingWinnersCommand['drawSessionId'], winnerIds: readonly string[], id: string, reason: CancelPendingWinnersCommand['reason'] = 'operator-error', note?: string): CancelPendingWinnersCommand {
  return {
    actor: 'local-operator', commandId: id as CommandId, drawSessionId: sessionId, mode: 'live', operation: 'cancel-pending-winners', reason,
    ...(note === undefined ? {} : { note }), targets: winnerIds.map((winnerId) => ({ expectedStatus: 'pending', winnerId: winnerId as never })),
  }
}

async function setup(count = 2) {
  const database = await openTestDatabase('cancellation')
  const fixture = makeDrawHistoryFixture()
  await seedStartedFixture(database, fixture)
  const winners = Array.from({ length: count }, (_, index) => makeWinner(fixture, index, index + 1))
  await database.winner_records.bulkAdd(winners)
  const persistence = new DexieDrawPersistenceUnitOfWork(database)
  const receipts = new DexieCommandReceiptRepository(database)
  return { database, fixture, winners, service: new CancellationService(persistence, receipts) }
}

describe('Phase 8 Slice 4 audited cancellation workflow', () => {
  it('cancels one pending winner, preserves exact ticket text, and keeps partial sessions pending', async () => {
    const { database, fixture, winners, service } = await setup()
    const result = await service.cancel(command(fixture.session.id, [winners[0].id], 'cancel-one'))
    expect(result.status).toBe('committed')
    const stored = await database.winner_records.get(winners[0].id)
    expect(stored?.status).toBe('cancelled')
    expect(stored?.ticketNumber).toBe('00042')
    expect(await database.winner_records.get(winners[1].id)).toEqual(winners[1])
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('pending-confirmation')
    expect(await database.audit_records.count()).toBe(1)
    expect((await database.audit_records.toArray())[0]?.actor).toEqual({ type: 'operator', name: 'local-operator' })
  })

  it('cancels multiple winners and resolves an all-cancelled session', async () => {
    const { database, fixture, winners, service } = await setup()
    const result = await service.cancel(command(fixture.session.id, winners.map((winner) => winner.id), 'cancel-all', 'other', '  ticket was invalid  '))
    expect(result.status).toBe('committed')
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('cancelled')
    expect((await database.winner_records.toArray()).every((winner) => winner.status === 'cancelled')).toBe(true)
    expect(await database.redraw_records.count()).toBe(0)
    const audit = (await database.audit_records.toArray()).find((record) => record.action === 'winner-cancelled')
    expect(audit?.detail).toMatchObject({ reason: 'other', normalizedNote: 'ticket was invalid', resultingSessionStatus: 'cancelled' })
    expect((await database.command_receipts.get('cancel-all' as CommandId))?.canonicalPayload).toContain('ticket was invalid')
  })

  it('completes when the final pending winner is cancelled beside a confirmed winner', async () => {
    const { database, fixture, winners, service } = await setup()
    await database.winner_records.put({ ...winners[0], status: 'confirmed', confirmedAt: winners[0].createdAt })
    const result = await service.cancel(command(fixture.session.id, [winners[1].id], 'cancel-final'))
    expect(result.status).toBe('committed')
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('completed')
    expect(await database.winner_records.get(winners[0].id)).toMatchObject({ status: 'confirmed', ticketNumber: '00042' })
  })

  it('rejects confirmed targets, invalid notes, duplicate targets, and stale retries', async () => {
    const { database, fixture, winners, service } = await setup()
    await database.winner_records.put({ ...winners[0], status: 'confirmed', confirmedAt: winners[0].createdAt })
    expect((await service.cancel(command(fixture.session.id, [winners[0].id], 'confirmed-target'))).status).toBe('stale')
    expect((await service.cancel(command(fixture.session.id, [winners[1].id], 'missing-note', 'other'))).status).toBe('invalid')
    const duplicate = command(fixture.session.id, [winners[1].id, winners[1].id], 'duplicate')
    expect((await service.cancel(duplicate)).status).toBe('invalid')
    const first = command(fixture.session.id, [winners[1].id], 'cancel-once')
    expect((await service.cancel(first)).status).toBe('committed')
    expect((await service.cancel(command(fixture.session.id, [winners[1].id], 'cancel-again'))).status).toBe('stale')
    expect(await database.command_receipts.count()).toBe(1)
  })

  it('replays equivalent commands, conflicts on changed payload, and rolls back on abort', async () => {
    const { database, fixture, winners, service } = await setup()
    const first = command(fixture.session.id, [winners[0].id], 'retry', 'other', '  checked  ')
    vi.spyOn(database.audit_records, 'add').mockRejectedValueOnce(new Error('simulated storage failure'))
    expect((await service.cancel(first)).status).toBe('storage-failure')
    expect((await database.winner_records.get(winners[0].id))?.status).toBe('pending')
    expect(await database.command_receipts.count()).toBe(0)
    const committed = await service.cancel(first)
    const replay = await service.cancel({ ...first, targets: [...first.targets].reverse() })
    const conflict = await service.cancel({ ...first, reason: 'absent' })
    expect(committed.status).toBe('committed')
    expect(replay.status).toBe('idempotent-replay')
    expect(conflict.status).toBe('conflict')
    expect(await database.audit_records.count()).toBe(1)
  })

  it('allows one overlapping cancellation effect and commits disjoint cancellations safely', async () => {
    const overlapping = await setup()
    const overlapResults = await Promise.all([
      overlapping.service.cancel(command(overlapping.fixture.session.id, [overlapping.winners[0].id], 'overlap-a')),
      overlapping.service.cancel(command(overlapping.fixture.session.id, [overlapping.winners[0].id], 'overlap-b')),
    ])
    expect(overlapResults.filter((result) => result.status === 'committed')).toHaveLength(1)
    expect(overlapResults.filter((result) => result.status === 'stale')).toHaveLength(1)
    expect(await overlapping.database.audit_records.count()).toBe(1)

    const disjoint = await setup()
    const disjointResults = await Promise.all([
      disjoint.service.cancel(command(disjoint.fixture.session.id, [disjoint.winners[0].id], 'disjoint-a')),
      disjoint.service.cancel(command(disjoint.fixture.session.id, [disjoint.winners[1].id], 'disjoint-b')),
    ])
    expect(disjointResults.every((result) => result.status === 'committed')).toBe(true)
    expect((await disjoint.database.draw_sessions.get(disjoint.fixture.session.id))?.status).toBe('cancelled')
    expect(await disjoint.database.audit_records.count()).toBe(3)
  })
})
