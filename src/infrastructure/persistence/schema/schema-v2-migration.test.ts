import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { RaffleOSDatabase } from '../db.ts'
import type { EventId } from '../../../domain/shared/identifiers.ts'
import { SCHEMA_V1, SCHEMA_V2 } from './schema-v1.ts'

describe('schema v1 to v2 additive migration', () => {
  it('preserves seeded official v1 data and adds no fabricated checkpoint', async () => {
    const name = `raffle-os-v1-upgrade-${crypto.randomUUID()}`
    const v1 = new Dexie(name, { autoOpen: false, IDBKeyRange, indexedDB })
    v1.version(1).stores(SCHEMA_V1)
    await v1.open()
    const event = { id: '40000000-0000-4000-8000-000000000001', name: 'Legacy', status: 'draft', createdAt: '2026-08-05T01:00:00.000Z', updatedAt: '2026-08-05T01:00:00.000Z' }
    await v1.table('events').add(event)
    v1.close()

    const v2 = new RaffleOSDatabase(name, { IDBKeyRange, indexedDB })
    await v2.openSupported()
    expect(await v2.events.get(event.id as EventId)).toEqual(event)
    expect(v2.tables.map((table) => table.name)).toContain('presentation_checkpoints')
    expect(await v2.presentation_checkpoints.count()).toBe(0)
    v2.close()

    const reopened = new RaffleOSDatabase(name, { IDBKeyRange, indexedDB })
    await reopened.openSupported()
    expect(await reopened.events.get(event.id as EventId)).toEqual(event)
    expect(await reopened.presentation_checkpoints.count()).toBe(0)
    reopened.close()
    const cleanup = new Dexie(name, { autoOpen: false, IDBKeyRange, indexedDB })
    await cleanup.delete()
  })

  it('does not change the official v1 schema declarations while adding v2', () => {
    expect(SCHEMA_V1.events).toBe('id, name, status, createdAt')
    expect(SCHEMA_V2.presentation_checkpoints).toBe('drawSessionId, stage, persistedAt')
  })
})
