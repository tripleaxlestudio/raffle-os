import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommandId } from '../../domain/shared/identifiers.ts'
import type { RedrawPendingWinnersCommand, RedrawConfirmedWinnersCommand } from './command.types.ts'
import { RedrawService } from './redraw-service.ts'
import { projectLiveDrawRun } from '../workflow/presentation-projection.ts'
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

async function setupSixPendingWinners() {
  const database = await openTestDatabase('redraw-six-winners')
  const fixture = makeDrawHistoryFixture(['00001', '00002', '00003', '00004', '00005', '00006', '00007', '00008', '00009', '00010', '00011', '00012'])
  await seedStartedFixture(database, fixture, 'pending-confirmation')
  const originals = Array.from({ length: 6 }, (_, index) => makeWinner(fixture, index, index + 1))
  await database.winner_records.bulkAdd(originals)
  const persistence = new DexieDrawPersistenceUnitOfWork(database, { randomSource: { nextUint32: () => 0 } })
  const service = new RedrawService(persistence, new DexieCommandReceiptRepository(database))
  return { database, fixture, originals, service }
}

describe('Phase 8 Slice 5 redraw/replacement workflow', () => {
  it.each([1, 3, 5, 6])('draws exactly %i replacement winner(s) for a partial six-winner selection', async (selectedCount) => {
    const { database, fixture, originals, service } = await setupSixPendingWinners()
    const result = await service.redraw(pendingCommand(fixture.session.id, originals.slice(0, selectedCount).map((winner) => winner.id), `redraw-six-${selectedCount}`))
    expect(result.status).toBe('committed')
    if (result.status !== 'committed') return
    expect(result.outcome.replacementWinnerIds).toHaveLength(selectedCount)
    expect(result.outcome.replacementTickets).toHaveLength(selectedCount)
    expect(await database.redraw_records.count()).toBe(selectedCount)
    const winners = await database.winner_records.where('drawSessionId').equals(fixture.session.id).toArray()
    const redrawRecords = await database.redraw_records.where('drawSessionId').equals(fixture.session.id).toArray()
    const selectedOriginalIds = new Set(originals.slice(0, selectedCount).map((winner) => winner.id))
    expect(winners.filter((winner) => winner.status === 'pending')).toHaveLength(6)
    expect(winners.filter((winner) => selectedOriginalIds.has(winner.id)).every((winner) => winner.status === 'cancelled')).toBe(true)
    expect(new Set(winners.filter((winner) => !selectedOriginalIds.has(winner.id) && originals.some((original) => original.id === winner.id)).map((winner) => winner.ticketNumber))).toEqual(new Set(originals.slice(selectedCount).map((winner) => winner.ticketNumber)))
    expect(new Set(result.outcome.replacementTickets).size).toBe(selectedCount)
    expect(result.outcome.replacementTickets?.every((ticket) => !originals.some((winner) => winner.ticketNumber === ticket))).toBe(true)
    expect(projectLiveDrawRun(fixture.session.id, winners, redrawRecords).result.winners).toHaveLength(6)
  })

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

  it('excludes every prior winner when quick redraws are chained in one session', async () => {
    const { database, fixture, original, service } = await setup()
    const first = await service.redraw(pendingCommand(fixture.session.id, [original.id], 'redraw-chain-first'))
    expect(first.status).toBe('committed')
    if (first.status !== 'committed') return
    const firstReplacementId = first.outcome.replacementWinnerIds?.[0]
    if (firstReplacementId === undefined) return

    const second = await service.redraw(pendingCommand(fixture.session.id, [firstReplacementId], 'redraw-chain-second'))
    expect(second.status).toBe('committed')
    if (second.status !== 'committed') return
    const winners = await database.winner_records.toArray()
    const secondReplacementId = second.outcome.replacementWinnerIds?.[0]
    const firstReplacement = winners.find((winner) => winner.id === firstReplacementId)
    const secondReplacement = winners.find((winner) => winner.id === secondReplacementId)

    expect(firstReplacement).toMatchObject({ status: 'cancelled' })
    expect(secondReplacement).toMatchObject({ status: 'pending' })
    expect(secondReplacement?.ticketNumber).not.toBe(original.ticketNumber)
    expect(secondReplacement?.ticketNumber).not.toBe(firstReplacement?.ticketNumber)
    expect(await database.redraw_records.count()).toBe(2)
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
