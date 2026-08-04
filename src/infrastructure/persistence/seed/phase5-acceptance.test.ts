import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import { validateDrawSession } from '../../../domain/draws/draw.invariants.ts'
import { RaffleOSDatabase } from '../db.ts'
import { ImmutableRecordError } from '../errors/persistence-errors.ts'
import { ACCEPTANCE_SEED_IDS, SEED_EVENT_IDS, SEED_ISO_TIMESTAMPS } from './dev-seed-fixtures.ts'
import { seedDevelopmentDatabase } from './dev-seed.ts'
import { installAcceptanceBrowserApi } from './phase5-acceptance-browser.ts'

describe('Phase 5 browser acceptance seed', () => {
  let counter = 0
  const databases: RaffleOSDatabase[] = []

  function createDatabase(): RaffleOSDatabase {
    counter += 1
    const database = new RaffleOSDatabase(`RaffleOS_Phase5Acceptance_${Date.now()}_${counter}`, { IDBKeyRange, indexedDB })
    databases.push(database)
    return database
  }

  afterEach(() => {
    for (const database of databases) database.close()
    databases.length = 0
    globalThis.__raffleAcceptance = undefined
  })

  it('seeds valid relationships and both ready modes without official history or snapshots', async () => {
    const database = createDatabase()
    await database.openSupported()
    await seedDevelopmentDatabase({ database, profile: 'phase5-acceptance' })

    const event = await database.events.get(SEED_EVENT_IDS.acceptance)
    const category = await database.prize_categories.get(ACCEPTANCE_SEED_IDS.category)
    const configuration = await database.draw_configurations.get(ACCEPTANCE_SEED_IDS.configuration)
    const sessions = await database.draw_sessions.toArray()
    const participants = await database.participants.toArray()

    expect(event?.status).toBe('live')
    expect(category?.eventId).toBe(event?.id)
    expect(configuration?.eventId).toBe(event?.id)
    expect(configuration?.prizeCategoryId).toBe(category?.id)
    expect(sessions.map((session) => [session.mode, session.status])).toEqual([
      ['practice', 'ready'],
      ['live', 'ready'],
    ])
    for (const session of sessions) {
      expect(validateDrawSession(session).ok).toBe(true)
      expect(session.configurationSnapshot).toBeNull()
      expect(session.candidatePoolSnapshot).toBeNull()
      expect(session.configurationId).toBe(configuration?.id)
      expect(session.eventId).toBe(event?.id)
    }
    expect(participants.length).toBeGreaterThanOrEqual(configuration?.requestedWinners ?? 0)
    expect(participants.filter((participant) => participant.isCheckedIn)).not.toHaveLength(0)
    expect(participants.filter((participant) => !participant.isCheckedIn)).not.toHaveLength(0)
    expect(new Set(participants.map((participant) => participant.group)).size).toBeGreaterThan(1)
    expect(new Set(participants.map((participant) => participant.ticketNumber))).toEqual(new Set(['00042', '42', '00043', '00044', '00045', '00046']))
    expect(await database.preferences.get('activeEventId')).toMatchObject({ value: event?.id })
    expect(await database.winner_records.count()).toBe(0)
    expect(await database.redraw_records.count()).toBe(0)
    expect(await database.audit_records.count()).toBe(0)
  })

  it('requires the console reset boundary before seeding and refuses a non-empty database', async () => {
    const database = createDatabase()
    const api = installAcceptanceBrowserApi({ enabled: true, createDatabase: () => database })
    expect(api).toBeDefined()
    await database.openSupported()
    await database.events.add({
      createdAt: SEED_ISO_TIMESTAMPS.t0,
      id: SEED_EVENT_IDS.acceptance,
      name: 'Existing event',
      status: 'live',
      updatedAt: SEED_ISO_TIMESTAMPS.t0,
    })

    await expect(api?.seed()).rejects.toThrow('Run window.__raffleAcceptance.reset() before seed().')
    await expect(seedDevelopmentDatabase({ database, profile: 'phase5-acceptance' })).rejects.toThrow(ImmutableRecordError)
  })

  it('switches only the seeded ready session preference between Practice and Live', async () => {
    const database = createDatabase()
    await database.openSupported()
    await seedDevelopmentDatabase({ database, profile: 'phase5-acceptance' })
    const api = installAcceptanceBrowserApi({ enabled: true, createDatabase: () => database })
    if (api === undefined) throw new Error('Acceptance API was not installed.')

    await expect(api.useLive()).resolves.toMatchObject({ mode: 'live', sessionId: ACCEPTANCE_SEED_IDS.liveSession })
    await database.openSupported()
    expect((await database.preferences.get('lastOperatorMode'))?.value).toBe('live')
    await expect(api.usePractice()).resolves.toMatchObject({ mode: 'practice', sessionId: ACCEPTANCE_SEED_IDS.practiceSession })
    await database.openSupported()
    expect((await database.preferences.get('lastOperatorMode'))?.value).toBe('practice')
    expect(await database.winner_records.count()).toBe(0)
    expect(await database.audit_records.count()).toBe(0)
  })

  it('does not install the browser helper when disabled', () => {
    expect(installAcceptanceBrowserApi({ enabled: false })).toBeUndefined()
    expect(globalThis.__raffleAcceptance).toBeUndefined()
  })
})
