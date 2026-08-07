import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import type { CommandId, DrawSessionId, WinnerRecordId } from '../../../domain/shared/identifiers.ts'
import type { CanonicalDecisionPayload } from '../../../application/pending-decisions/command.types.ts'
import { RaffleOSDatabase } from '../db.ts'
import { DexieCommandReceiptRepository } from './command-receipt.repository.ts'

const names: string[] = []
const databases: Dexie[] = []
const session = '50000000-0000-4000-8000-000000000001' as DrawSessionId
const winner = '60000000-0000-4000-8000-000000000001' as WinnerRecordId
const command = '70000000-0000-4000-8000-000000000001' as CommandId
const payload: CanonicalDecisionPayload = {
  drawSessionId: session,
  operation: 'confirm-pending-winners',
  targets: [{ expectedStatus: 'pending', winnerId: winner }],
}

function open(name = `raffle-os-receipts-${crypto.randomUUID()}`): RaffleOSDatabase {
  names.push(name)
  const database = new RaffleOSDatabase(name, { IDBKeyRange, indexedDB })
  databases.push(database)
  return database
}

afterEach(async () => {
  for (const database of databases) database.close()
  for (const name of names) {
    const cleanup = new Dexie(name, { autoOpen: false, IDBKeyRange, indexedDB })
    await cleanup.delete()
    cleanup.close()
  }
  databases.length = 0
  names.length = 0
  vi.useRealTimers()
})

describe('schema v3 command receipts', () => {
  it('creates the additive receipt store with the exact idempotency indexes', async () => {
    const database = open()
    await database.openSupported()
    const schema = database.command_receipts.schema
    expect(database.verno).toBe(6)
    expect(schema.primKey.name).toBe('commandId')
    expect(schema.primKey.unique).toBe(true)
    expect(schema.indexes.map((index) => [index.name, index.unique])).toEqual([
      ['drawSessionId', false],
      ['operation', false],
      ['[drawSessionId+operation]', false],
      ['status', false],
      ['createdAt', false],
      ['committedAt', false],
    ])
  })

  it('returns a committed outcome for an equivalent retry and rejects a payload conflict', async () => {
    const database = open()
    await database.openSupported()
    const repository = new DexieCommandReceiptRepository(database)
    const started = await repository.create(command, 'local-operator', payload)
    expect(started).toMatchObject({ status: 'started', canonicalPayload: JSON.stringify(payload) })
    const committed = await repository.finalize(command, payload, {
      affectedWinnerIds: [winner], commandId: command, drawSessionId: session,
      operation: 'confirm-pending-winners', status: 'committed',
    })
    expect(committed.status).toBe('committed')
    expect(committed.committedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(await repository.create(command, 'local-operator', payload)).toEqual(committed)
    await expect(repository.create(command, 'local-operator', {
      ...payload, targets: [{ expectedStatus: 'pending', winnerId: '60000000-0000-4000-8000-000000000002' as WinnerRecordId }],
    })).rejects.toMatchObject({ code: 'duplicate-record' })
  })

  it('participates in a caller transaction and leaves no receipt after abort', async () => {
    const database = open()
    await database.openSupported()
    const repository = new DexieCommandReceiptRepository(database)
    await expect(database.transaction('rw', database.command_receipts, async (transaction) => {
      await repository.create(command, 'local-operator', payload, repository.inTransaction(transaction))
      throw new Error('simulated timeout')
    })).rejects.toThrow('simulated timeout')
    expect(await repository.read(command)).toBeUndefined()
    await repository.create(command, 'local-operator', payload)
    expect(await repository.read(command)).toMatchObject({ commandId: command })
  })

  it('reconciles missing, in-progress, committed, and conflicting receipts', async () => {
    const database = open()
    await database.openSupported()
    const repository = new DexieCommandReceiptRepository(database)
    expect(await repository.reconcile(command, payload)).toEqual({ kind: 'missing', retryable: true })
    await repository.create(command, 'local-operator', payload)
    expect((await repository.reconcile(command, payload)).kind).toBe('in-progress')
    const other = { ...payload, operation: 'cancel-pending-winners' as const, targets: payload.targets }
    expect((await repository.reconcile(command, other)).kind).toBe('conflict')
    await repository.finalize(command, payload, { affectedWinnerIds: [winner], commandId: command, drawSessionId: session, operation: payload.operation, status: 'committed' })
    expect((await repository.reconcile(command, payload)).kind).toBe('committed')
  })

  it('serializes concurrent equivalent creates to one command receipt', async () => {
    const database = open()
    await database.openSupported()
    const repository = new DexieCommandReceiptRepository(database)
    const results = await Promise.all([
      repository.create(command, 'local-operator', payload),
      repository.create(command, 'local-operator', payload),
    ])
    expect(new Set(results.map((result) => result.commandId)).size).toBe(1)
    expect(await database.command_receipts.count()).toBe(1)
  })

  it('keeps different command identities distinct when they target one session', async () => {
    const database = open()
    await database.openSupported()
    const repository = new DexieCommandReceiptRepository(database)
    const second = '70000000-0000-4000-8000-000000000002' as CommandId
    await Promise.all([
      repository.create(command, 'local-operator', payload),
      repository.create(second, 'local-operator', { ...payload, targets: payload.targets }),
    ])
    expect(await repository.findBySession(session)).toHaveLength(2)
    expect(await database.command_receipts.where('[drawSessionId+operation]').equals([session, payload.operation]).count()).toBe(2)
  })
})
