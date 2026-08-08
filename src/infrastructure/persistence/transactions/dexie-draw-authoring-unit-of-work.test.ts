import Dexie from 'dexie'
import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DrawConfiguration } from '../../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../../domain/draws/draw-session.types.ts'
import type { Event } from '../../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../../domain/prizes/prize.types.ts'
import { RaffleOSDatabase } from '../db.ts'
import { DexieDrawAuthoringUnitOfWork } from './dexie-draw-authoring-unit-of-work.ts'

const databases: RaffleOSDatabase[] = []
const names: string[] = []
afterEach(async () => { for (const database of databases) database.close(); for (const name of names) { const cleanup = new Dexie(name, { autoOpen: false, IDBKeyRange, indexedDB }); await cleanup.delete(); cleanup.close() } databases.length = 0; names.length = 0; vi.restoreAllMocks() })

async function setup() {
  const name = `authoring-${crypto.randomUUID()}`
  const database = new RaffleOSDatabase(name, { indexedDB, IDBKeyRange })
  await database.openSupported(); databases.push(database); names.push(name)
  const event = { id: '11111111-1111-4111-8111-111111111111', name: 'Event', status: 'draft', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' } as unknown as Event
  const category = { id: '22222222-2222-4222-8222-222222222222', eventId: event.id, name: 'Prize', prizeName: 'Prize', displayOrder: 1, createdAt: event.createdAt } as unknown as PrizeCategory
  const configuration = { id: '33333333-3333-4333-8333-333333333333', eventId: event.id, prizeCategoryId: category.id, requestedWinners: 1, winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: null, createdAt: event.createdAt, updatedAt: event.updatedAt } as unknown as DrawConfiguration
  const session = { id: '44444444-4444-4444-8444-444444444444', eventId: event.id, configurationId: configuration.id, mode: 'practice', status: 'ready', configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: event.createdAt, updatedAt: event.updatedAt } as unknown as DrawSession
  await database.events.add(event); await database.prize_categories.add(category)
  return { database, configuration, session }
}

describe('DexieDrawAuthoringUnitOfWork', () => {
  it('creates configuration and ready session atomically and does not create official records', async () => {
    const { database, configuration, session } = await setup()
    await new DexieDrawAuthoringUnitOfWork(database).persistReadyAuthoring({ configuration, session })
    expect((await database.events.get(configuration.eventId))?.status).toBe('ready')
    expect(await database.draw_configurations.get(configuration.id)).toEqual(configuration)
    expect(await database.draw_sessions.get(session.id)).toEqual(session)
    expect(await database.winner_records.count()).toBe(0)
    expect(await database.presentation_checkpoints.count()).toBe(0)
    expect(await database.audit_records.count()).toBe(0)
  })

  it('rolls back configuration when session persistence fails', async () => {
    const { database, configuration, session } = await setup()
    vi.spyOn(database.draw_sessions, 'put').mockRejectedValueOnce(new Error('session write failed'))
    await expect(new DexieDrawAuthoringUnitOfWork(database).persistReadyAuthoring({ configuration, session })).rejects.toBeInstanceOf(Error)
    expect(await database.draw_configurations.count()).toBe(0)
    expect(await database.draw_sessions.count()).toBe(0)
  })

  it('rejects editing a started session without resetting it', async () => {
    const { database, configuration, session } = await setup()
    const started = { ...session, status: 'completed' } as DrawSession
    await database.draw_configurations.add(configuration); await database.draw_sessions.add(started)
    await expect(new DexieDrawAuthoringUnitOfWork(database).persistReadyAuthoring({ configuration: { ...configuration, requestedWinners: 2 }, session: { ...session, status: 'ready' }, existingConfigurationId: configuration.id, existingSessionId: session.id })).rejects.toMatchObject({ code: 'immutable-record' })
    expect((await database.draw_sessions.get(session.id))?.status).toBe('completed')
  })
})
