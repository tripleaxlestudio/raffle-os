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

describe('request → present → complete redraw workflow', () => {
  it.each([1, 3, 5, 6])('requests and completes exactly %i replacement winner(s)', async (selectedCount) => {
    const { database, fixture, originals, service } = await setupSixPendingWinners()
    const result = await service.redraw(pendingCommand(fixture.session.id, originals.slice(0, selectedCount).map((winner) => winner.id), `redraw-six-${selectedCount}`))
    expect(result.status).toBe('committed')
    if (result.status !== 'committed') return
    expect(result.outcome.replacementWinnerIds).toEqual([])
    expect(result.outcome.replacementTickets).toEqual([])
    expect(await database.redraw_records.count()).toBe(0)
    expect(await database.winner_records.count()).toBe(6)
    const requested = await database.redraw_requests.get(result.outcome.commandId)
    expect(requested).toMatchObject({ status: 'pending', replacementCount: selectedCount })
    const running = await service.start(result.outcome.commandId)
    expect(running.selections).toHaveLength(selectedCount)
    expect(await database.redraw_records.count()).toBe(0)
    expect(await database.winner_records.count()).toBe(6)
    await service.complete(result.outcome.commandId)
    expect(await database.redraw_records.count()).toBe(selectedCount)
    const winners = await database.winner_records.where('drawSessionId').equals(fixture.session.id).toArray()
    const redrawRecords = await database.redraw_records.where('drawSessionId').equals(fixture.session.id).toArray()
    const selectedOriginalIds = new Set(originals.slice(0, selectedCount).map((winner) => winner.id))
    expect(winners.filter((winner) => winner.status === 'pending')).toHaveLength(6)
    expect(winners.filter((winner) => selectedOriginalIds.has(winner.id)).every((winner) => winner.status === 'cancelled')).toBe(true)
    expect(new Set(winners.filter((winner) => !selectedOriginalIds.has(winner.id) && originals.some((original) => original.id === winner.id)).map((winner) => winner.ticketNumber))).toEqual(new Set(originals.slice(selectedCount).map((winner) => winner.ticketNumber)))
    const replacementTickets = running.selections?.map((selection) => selection.ticketNumber) ?? []
    expect(new Set(replacementTickets).size).toBe(selectedCount)
    expect(replacementTickets.every((ticket) => !originals.some((winner) => winner.ticketNumber === ticket))).toBe(true)
    expect(projectLiveDrawRun(fixture.session.id, winners, redrawRecords).result.winners).toHaveLength(6)
  })

  it('replaces pending originals with distinct pending winners and preserves lineage', async () => {
    const { database, fixture, original, service } = await setup()
    const result = await service.redraw(pendingCommand(fixture.session.id, [original.id], 'redraw-pending', '  ticket was invalid  '))
    expect(result.status).toBe('committed')
    if (result.status !== 'committed') return
    expect(result.outcome.replacementTickets).toEqual([])
    expect(await database.redraw_records.count()).toBe(0)
    const running = await service.start(result.outcome.commandId)
    const replacementTicket = running.selections?.[0]?.ticketNumber
    expect(['00044', '00045']).toContain(replacementTicket)
    expect((await database.winner_records.get(original.id))?.status).toBe('cancelled')
    expect(await database.winner_records.count()).toBe(2)
    await service.complete(result.outcome.commandId)
    const replacements = (await database.winner_records.toArray()).filter((winner) => winner.id !== original.id)
    expect(replacements.find((winner) => winner.ticketNumber === replacementTicket)).toMatchObject({ status: 'pending' })
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('pending-confirmation')
    expect(await database.redraw_records.count()).toBe(1)
    expect((await database.redraw_records.toArray())[0]).toMatchObject({ originalWinnerRecordId: original.id, replacementWinnerRecordId: running.selections?.[0]?.winnerRecordId, reason: 'other', reasonNote: 'ticket was invalid' })
    expect((await database.audit_records.toArray()).map((audit) => audit.action)).toEqual(expect.arrayContaining(['winner-cancelled', 'redraw-recorded']))
  })

  it('excludes every prior winner when quick redraws are chained in one session', async () => {
    const { database, fixture, original, service } = await setup()
    const first = await service.redraw(pendingCommand(fixture.session.id, [original.id], 'redraw-chain-first'))
    expect(first.status).toBe('committed')
    if (first.status !== 'committed') return
    const firstRunning = await service.start(first.outcome.commandId)
    const firstReplacementId = firstRunning.selections?.[0]?.winnerRecordId
    if (firstReplacementId === undefined) return
    await service.complete(first.outcome.commandId)

    const second = await service.redraw(pendingCommand(fixture.session.id, [firstReplacementId], 'redraw-chain-second'))
    expect(second.status).toBe('committed')
    if (second.status !== 'committed') return
    const secondRunning = await service.start(second.outcome.commandId)
    const secondReplacementId = secondRunning.selections?.[0]?.winnerRecordId
    await service.complete(second.outcome.commandId)
    const winners = await database.winner_records.toArray()
    const firstReplacement = winners.find((winner) => winner.id === firstReplacementId)
    const secondReplacement = winners.find((winner) => winner.id === secondReplacementId)

    expect(firstReplacement).toMatchObject({ status: 'cancelled' })
    expect(secondReplacement).toMatchObject({ status: 'pending' })
    expect(secondReplacement?.ticketNumber).not.toBe(original.ticketNumber)
    expect(secondReplacement?.ticketNumber).not.toBe(firstReplacement?.ticketNumber)
    expect(await database.redraw_records.count()).toBe(2)
  })

  it('uses each current target batch for sequential 1 -> 6 -> 1 redraws and retains prior audit lineage', async () => {
    const database = await openTestDatabase('redraw-changing-batches')
    const tickets = Array.from({ length: 30 }, (_, index) => String(index + 1).padStart(5, '0'))
    const fixture = makeDrawHistoryFixture(tickets)
    await seedStartedFixture(database, fixture, 'pending-confirmation')
    const initialWinners = Array.from({ length: 10 }, (_, index) => makeWinner(fixture, index, index + 1))
    await database.winner_records.bulkAdd(initialWinners)
    const service = new RedrawService(
      new DexieDrawPersistenceUnitOfWork(database, { randomSource: { nextUint32: () => 0 } }),
      new DexieCommandReceiptRepository(database),
    )

    const runBatch = async (winnerIds: readonly string[], commandId: string) => {
      const result = await service.redraw(pendingCommand(fixture.session.id, winnerIds, commandId))
      expect(result.status).toBe('committed')
      if (result.status !== 'committed') throw new Error('Expected redraw request to commit.')
      const requested = await database.redraw_requests.get(result.outcome.commandId)
      expect(requested?.targets).toHaveLength(winnerIds.length)
      expect(new Set(requested?.targets.map((target) => target.winnerId))).toEqual(new Set(winnerIds))
      expect(requested?.replacementCount).toBe(winnerIds.length)
      const running = await service.start(result.outcome.commandId)
      expect(running.selections).toHaveLength(winnerIds.length)
      await service.complete(result.outcome.commandId)
    }

    await runBatch([initialWinners[0]!.id], 'redraw-changing-batches-1')
    const afterOne = (await database.winner_records.where('drawSessionId').equals(fixture.session.id).toArray()).filter((winner) => winner.status === 'pending')
    await runBatch(afterOne.slice(0, 6).map((winner) => winner.id), 'redraw-changing-batches-6')
    const afterSix = (await database.winner_records.where('drawSessionId').equals(fixture.session.id).toArray()).filter((winner) => winner.status === 'pending')
    await runBatch([afterSix[0]!.id], 'redraw-changing-batches-1-again')

    const requests = await database.redraw_requests.where('drawSessionId').equals(fixture.session.id).toArray()
    expect(new Map(requests.map((request) => [request.id, request.replacementCount]))).toEqual(new Map([
      ['redraw-changing-batches-1', 1],
      ['redraw-changing-batches-6', 6],
      ['redraw-changing-batches-1-again', 1],
    ]))
    expect(requests.every((request) => request.status === 'completed')).toBe(true)
    expect(await database.redraw_records.count()).toBe(8)
    expect((await database.audit_records.toArray()).filter((audit) => audit.action === 'winner-cancelled')).toHaveLength(8)
    expect((await database.audit_records.toArray()).filter((audit) => audit.action === 'redraw-recorded')).toHaveLength(8)
  })

  it('redraws a confirmed original only through the dedicated command and reopens completed', async () => {
    const { database, fixture, original, other, service } = await setup('completed')
    const result = await service.redraw(confirmedCommand(fixture.session.id, original.id))
    expect(result.status).toBe('committed')
    expect((await database.winner_records.get(original.id))?.status).toBe('cancelled')
    expect((await database.winner_records.get(other.id))?.status).toBe('confirmed')
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('pending-confirmation')
    expect((await database.winner_records.toArray()).find((winner) => winner.id !== original.id && winner.id !== other.id)).toBeUndefined()
    const running = result.status === 'committed' ? await service.start(result.outcome.commandId) : undefined
    if (running !== undefined) await service.complete(running.id)
    expect((await database.winner_records.toArray()).find((winner) => winner.id !== original.id && winner.id !== other.id)?.status).toBe('pending')
  })

  it('replays the committed request without selecting a replacement', async () => {
    const { database, fixture, original, service } = await setup()
    const command = pendingCommand(fixture.session.id, [original.id], 'redraw-replay')
    const first = await service.redraw(command)
    const random = vi.spyOn(Math, 'random')
    const replay = await service.redraw(command)
    expect(replay.status).toBe('idempotent-replay')
    expect(replay.status === 'idempotent-replay' && first.status === 'committed' ? replay.outcome : undefined).toEqual(first.status === 'committed' ? first.outcome : undefined)
    expect(random).not.toHaveBeenCalled()
    expect(await database.redraw_records.count()).toBe(0)
    expect(await database.redraw_requests.count()).toBe(1)
  })

  it('restores the same secure selection after refresh instead of selecting again', async () => {
    const { database, fixture, original, service } = await setup()
    const request = await service.redraw(pendingCommand(fixture.session.id, [original.id], 'redraw-refresh'))
    if (request.status !== 'committed') return
    const running = await service.start(request.outcome.commandId)
    const randomSource = { nextUint32: vi.fn(() => 1) }
    const restoredService = new RedrawService(new DexieDrawPersistenceUnitOfWork(database, { randomSource }), new DexieCommandReceiptRepository(database))
    const restored = await restoredService.start(request.outcome.commandId)
    expect(restored.selections).toEqual(running.selections)
    expect(randomSource.nextUint32).not.toHaveBeenCalled()
    expect(await database.winner_records.count()).toBe(2)
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
