import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommandId } from '../../domain/shared/identifiers.ts'
import type { RedrawPendingWinnersCommand, RedrawConfirmedWinnersCommand } from './command.types.ts'
import { RedrawService } from './redraw-service.ts'
import { DexieCommandReceiptRepository } from '../../infrastructure/persistence/repositories/command-receipt.repository.ts'
import { DexieDrawPersistenceUnitOfWork } from '../../infrastructure/persistence/transactions/dexie-draw-persistence-unit-of-work.ts'
import { cleanupTestDatabases, makeDrawHistoryFixture, makeWinner, openTestDatabase, seedStartedFixture } from '../../infrastructure/persistence/test/draw-history-test-helpers.ts'

afterEach(cleanupTestDatabases)

function pendingCommand(sessionId: RedrawPendingWinnersCommand['drawSessionId'], winnerIds: readonly string[], commandId: string, note = 'operator supplied note'): RedrawPendingWinnersCommand {
  return {
    actor: 'local-operator',
    commandId: commandId as CommandId,
    drawSessionId: sessionId,
    mode: 'live',
    operation: 'redraw-pending-winners',
    reason: 'other',
    ...(note === undefined ? {} : { note }),
    targets: winnerIds.map((winnerId) => ({ expectedStatus: 'pending', winnerId: winnerId as never })),
  }
}

function confirmedCommand(sessionId: RedrawConfirmedWinnersCommand['drawSessionId'], winnerId: string): RedrawConfirmedWinnersCommand {
  return {
    actor: 'local-operator',
    commandId: 'confirmed-redraw' as CommandId,
    drawSessionId: sessionId,
    mode: 'live',
    operation: 'redraw-confirmed-winners',
    reason: 'absent',
    targets: [{ expectedStatus: 'confirmed', winnerId: winnerId as never }],
  }
}

async function setup(status: 'pending-confirmation' | 'completed' = 'pending-confirmation') {
  const database = await openTestDatabase('redraw')
  const fixture = makeDrawHistoryFixture(['00042', '42', '00044', '00045'])
  await seedStartedFixture(database, fixture, status)
  const original = makeWinner(fixture, 0, 1, status === 'completed' ? { status: 'confirmed' } : {})
  const other = makeWinner(fixture, 1, 2, status === 'completed' ? { status: 'confirmed' } : {})
  await database.winner_records.bulkAdd([original, other])
  const persistence = new DexieDrawPersistenceUnitOfWork(database, { randomSource: { nextUint32: () => 0 } })
  const service = new RedrawService(persistence, new DexieCommandReceiptRepository(database))
  return { database, fixture, original, other, service }
}

describe('Phase 8 Slice 5 redraw/replacement workflow', () => {
  it('replaces pending originals with distinct pending winners and preserves lineage', async () => {
    const { database, fixture, original, service } = await setup()
    const result = await service.redraw(pendingCommand(fixture.session.id, [original.id], 'redraw-pending', '  ticket was invalid  '))
    expect(result.status).toBe('committed')
    if (result.status !== 'committed') return
    expect(result.outcome.replacementTickets).toHaveLength(1)
    const replacementTicket = result.outcome.replacementTickets?.[0]
    expect(['00044', '00045']).toContain(replacementTicket)
    expect((await database.winner_records.get(original.id))?.status).toBe('cancelled')
    const replacements = (await database.winner_records.toArray()).filter((winner) => winner.id !== original.id)
    expect(replacements.find((winner) => winner.ticketNumber === replacementTicket)).toMatchObject({ status: 'pending' })
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('pending-confirmation')
    expect(await database.redraw_records.count()).toBe(1)
    expect((await database.redraw_records.toArray())[0]).toMatchObject({ originalWinnerRecordId: original.id, replacementWinnerRecordId: result.outcome.replacementWinnerIds?.[0], reason: 'other', reasonNote: 'ticket was invalid' })
    expect((await database.audit_records.toArray()).map((audit) => audit.action)).toEqual(expect.arrayContaining(['winner-cancelled', 'redraw-recorded']))
  })

  it('redraws a confirmed original only through the dedicated command and reopens completed', async () => {
    const { database, fixture, original, other, service } = await setup('completed')
    const result = await service.redraw(confirmedCommand(fixture.session.id, original.id))
    expect(result.status).toBe('committed')
    expect((await database.winner_records.get(original.id))?.status).toBe('cancelled')
    expect((await database.winner_records.get(other.id))?.status).toBe('confirmed')
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('pending-confirmation')
    expect((await database.winner_records.toArray()).find((winner) => winner.id !== original.id && winner.id !== other.id)?.status).toBe('pending')
  })

  it('replays the committed replacement without invoking selection again', async () => {
    const { database, fixture, original, service } = await setup()
    const command = pendingCommand(fixture.session.id, [original.id], 'redraw-replay')
    const first = await service.redraw(command)
    const random = vi.spyOn(Math, 'random')
    const replay = await service.redraw(command)
    expect(replay.status).toBe('idempotent-replay')
    expect(replay.status === 'idempotent-replay' && first.status === 'committed' ? replay.outcome : undefined).toEqual(first.status === 'committed' ? first.outcome : undefined)
    expect(random).not.toHaveBeenCalled()
    expect(await database.redraw_records.count()).toBe(1)
  })

  it('rejects insufficient capacity before any mutation', async () => {
    const { database, fixture, original, other, service } = await setup()
    const third = makeWinner(fixture, 2, 3)
    await database.winner_records.add(third)
    const result = await service.redraw(pendingCommand(fixture.session.id, [original.id, other.id], 'redraw-insufficient'))
    expect(result.status).toBe('insufficient-capacity')
    expect((await database.winner_records.get(original.id))?.status).toBe('pending')
    expect((await database.winner_records.get(other.id))?.status).toBe('pending')
    expect(await database.winner_records.count()).toBe(3)
    expect(await database.redraw_records.count()).toBe(0)
    expect(await database.audit_records.count()).toBe(0)
    expect(await database.command_receipts.count()).toBe(0)
  })
})
