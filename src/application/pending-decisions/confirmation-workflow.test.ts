import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommandId } from '../../domain/shared/identifiers.ts'
import type { ConfirmPendingWinnersCommand } from './command.types.ts'
import { ConfirmationService } from './confirmation-service.ts'
import { DexieCommandReceiptRepository } from '../../infrastructure/persistence/repositories/command-receipt.repository.ts'
import { DexieDrawPersistenceUnitOfWork } from '../../infrastructure/persistence/transactions/dexie-draw-persistence-unit-of-work.ts'
import { cleanupTestDatabases, makeDrawHistoryFixture, makeWinner, openTestDatabase, seedStartedFixture } from '../../infrastructure/persistence/test/draw-history-test-helpers.ts'

afterEach(cleanupTestDatabases)

function command(sessionId: ConfirmPendingWinnersCommand['drawSessionId'], winnerIds: readonly string[], id: string): ConfirmPendingWinnersCommand {
  return {
    actor: 'local-operator',
    commandId: id as CommandId,
    drawSessionId: sessionId,
    mode: 'live',
    operation: 'confirm-pending-winners',
    targets: winnerIds.map((winnerId) => ({ expectedStatus: 'pending', winnerId: winnerId as never })),
  }
}

async function setup() {
  const database = await openTestDatabase('confirmation')
  const fixture = makeDrawHistoryFixture()
  await seedStartedFixture(database, fixture)
  const first = makeWinner(fixture, 0, 1)
  const second = makeWinner(fixture, 1, 2)
  await database.winner_records.bulkAdd([first, second])
  const persistence = new DexieDrawPersistenceUnitOfWork(database)
  const receipts = new DexieCommandReceiptRepository(database)
  return { database, fixture, first, second, service: new ConfirmationService(persistence, receipts) }
}

describe('Phase 8 Slice 3 confirmation workflow', () => {
  it('confirms selected winners, preserves exact tickets, and keeps partial sessions pending', async () => {
    const { database, fixture, first, second, service } = await setup()
    const result = await service.confirm(command(fixture.session.id, [first.id], 'confirm-one'))
    expect(result.status).toBe('committed')
    expect((await database.winner_records.get(first.id))?.status).toBe('confirmed')
    expect((await database.winner_records.get(first.id))?.ticketNumber).toBe('00042')
    expect(await database.winner_records.get(second.id)).toEqual(second)
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('pending-confirmation')
    expect(await database.audit_records.count()).toBe(1)
    expect((await database.audit_records.toArray())[0]?.actor).toEqual({ type: 'operator', name: 'local-operator' })
  })

  it('completes on final pending confirmation and replays the original result', async () => {
    const { database, fixture, first, second, service } = await setup()
    const confirmAll = command(fixture.session.id, [first.id, second.id], 'confirm-all')
    const committed = await service.confirm(confirmAll)
    const replay = await service.confirm({ ...confirmAll, targets: [...confirmAll.targets].reverse() })
    expect(committed.status).toBe('committed')
    expect(replay.status).toBe('idempotent-replay')
    expect(replay.status === 'idempotent-replay' && replay.outcome.committedAt).toBeDefined()
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('completed')
    expect(await database.audit_records.count()).toBe(3)
    expect(await database.command_receipts.count()).toBe(1)
  })

  it('rejects conflicting reuse and stale new commands without adding effects', async () => {
    const { database, fixture, first, second, service } = await setup()
    const original = command(fixture.session.id, [first.id], 'same-command')
    await service.confirm(original)
    const conflict = await service.confirm({ ...original, targets: [{ expectedStatus: 'pending', winnerId: second.id }] })
    expect(conflict.status).toBe('conflict')
    const stale = await service.confirm(command(fixture.session.id, [first.id], 'new-command'))
    expect(stale.status).toBe('stale')
    expect(await database.command_receipts.count()).toBe(1)
    expect(await database.audit_records.count()).toBe(1)
  })

  it('rolls back official state and receipt on transaction failure, allowing a retry', async () => {
    const { database, fixture, first, service } = await setup()
    vi.spyOn(database.audit_records, 'add').mockRejectedValueOnce(new Error('simulated storage failure'))
    const confirm = command(fixture.session.id, [first.id], 'retry-after-abort')
    const failed = await service.confirm(confirm)
    expect(failed.status).toBe('storage-failure')
    expect((await database.winner_records.get(first.id))?.status).toBe('pending')
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('pending-confirmation')
    expect(await database.audit_records.count()).toBe(0)
    expect(await database.command_receipts.count()).toBe(0)
    expect((await service.confirm(confirm)).status).toBe('committed')
  })

  it('allows one winner per concurrent command and does not duplicate audit evidence', async () => {
    const { database, fixture, first, service } = await setup()
    const results = await Promise.all([
      service.confirm(command(fixture.session.id, [first.id], 'race-a')),
      service.confirm(command(fixture.session.id, [first.id], 'race-b')),
    ])
    expect(results.filter((result) => result.status === 'committed')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'stale')).toHaveLength(1)
    expect((await database.winner_records.get(first.id))?.status).toBe('confirmed')
    expect(await database.audit_records.count()).toBe(1)
    expect(await database.command_receipts.count()).toBe(1)
  })
})
