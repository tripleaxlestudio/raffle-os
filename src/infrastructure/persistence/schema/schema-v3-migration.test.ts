import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { RaffleOSDatabase } from '../db.ts'
import type { CommandId, DrawConfigurationId, DrawSessionId, ParticipantId } from '../../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'
import { SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4 } from './schema-v1.ts'

const names: string[] = []
const legacy = {
  audit_records: { id: 'audit-1', eventId: 'event-1', action: 'seed', timestamp: '2026-08-05T01:00:00.000Z' },
  display_configurations: { id: 'display-1', eventId: 'event-1' },
  draw_configurations: { id: 'configuration-1', eventId: 'event-1', prizeCategoryId: 'prize-1' },
  draw_sessions: { id: 'session-1', eventId: 'event-1', configurationId: 'configuration-1', mode: 'live', status: 'ready', createdAt: '2026-08-05T01:00:00.000Z' },
  events: { id: 'event-1', name: 'Legacy', status: 'draft', createdAt: '2026-08-05T01:00:00.000Z' },
  participants: { id: 'participant-1', eventId: 'event-1', ticketNumber: '00042', isCheckedIn: true, group: 'A' },
  preferences: { key: 'activeEventId', value: 'event-1' },
  prize_categories: { id: 'prize-1', eventId: 'event-1', displayOrder: 0 },
  redraw_records: { id: 'redraw-1', eventId: 'event-1', drawSessionId: 'session-1', originalWinnerRecordId: 'winner-1', replacementWinnerRecordId: 'winner-2', createdAt: '2026-08-05T01:00:00.000Z' },
  winner_records: { id: 'winner-1', eventId: 'event-1', prizeCategoryId: 'prize-1', drawSessionId: 'session-1', participantId: 'participant-1', ticketNumber: '00042', status: 'pending', sequenceNumber: 1 },
} as const

afterEach(async () => {
  for (const name of names) {
    const database = new Dexie(name, { autoOpen: false, IDBKeyRange, indexedDB })
    await database.delete()
    database.close()
  }
  names.length = 0
})

async function makeLegacyDatabase(version: 1 | 2): Promise<string> {
  const name = `raffle-os-v${version}-to-v3-${crypto.randomUUID()}`
  names.push(name)
  const database = new Dexie(name, { autoOpen: false, IDBKeyRange, indexedDB })
  database.version(1).stores(SCHEMA_V1)
  if (version === 2) database.version(2).stores(SCHEMA_V2)
  await database.open()
  for (const [store, value] of Object.entries(legacy)) await database.table(store).add(value)
  if (version === 2) await database.table('presentation_checkpoints').add({ drawSessionId: 'session-1', stage: 'rolling', persistedAt: '2026-08-05T01:00:00.000Z' })
  database.close()
  return name
}

describe('schema v3 additive migration', () => {
  it.each([1, 2] as const)('upgrades v%s data without rewriting legacy records', async (version) => {
    const name = await makeLegacyDatabase(version)
    const database = new RaffleOSDatabase(name, { IDBKeyRange, indexedDB })
    await database.openSupported()
    expect(database.verno).toBe(6)
    for (const [store, value] of Object.entries(legacy)) {
      const key = 'id' in value ? value.id : value.key
      if (store === 'draw_configurations') {
        expect(await database.table(store).get(key)).toMatchObject({
          ...value,
          presentation: {
            presentationMode: 'instant-reveal',
            rollStopMode: 'timed',
            rollDurationSeconds: 8,
            rollSpeedPerSecond: 12,
            revealMode: 'all-together',
          },
        })
      } else {
        expect(await database.table(store).get(key)).toEqual(value)
      }
    }
    expect(await database.participants.get('participant-1' as ParticipantId)).toMatchObject({ ticketNumber: '00042' })
    expect(await database.command_receipts.count()).toBe(0)
    expect(await database.event_settings.count()).toBe(0)
    if (version === 2) expect(await database.presentation_checkpoints.get('session-1' as DrawSessionId)).toEqual({ drawSessionId: 'session-1', stage: 'rolling', persistedAt: '2026-08-05T01:00:00.000Z' })
    database.close()
  })

  it('creates v3 directly and reopens existing receipt data', async () => {
    const name = `raffle-os-fresh-v3-${crypto.randomUUID()}`
    names.push(name)
    const database = new RaffleOSDatabase(name, { IDBKeyRange, indexedDB })
    await database.openSupported()
    expect(database.tables.map((table) => table.name)).toContain('command_receipts')
    expect(SCHEMA_V3.command_receipts).toContain('&commandId')
    await database.command_receipts.add({ commandId: 'command-1' as CommandId, drawSessionId: 'session-1' as DrawSessionId, operation: 'confirm-pending-winners', actor: 'local-operator', canonicalPayload: '{}', status: 'unknown', outcomeStatus: 'unknown', affectedWinnerIds: [], createdAt: '2026-08-05T01:00:00.000Z' as IsoTimestamp })
    database.close()
    const reopened = new RaffleOSDatabase(name, { IDBKeyRange, indexedDB })
    await reopened.openSupported()
    expect(await reopened.command_receipts.get('command-1' as CommandId)).toMatchObject({ canonicalPayload: '{}', status: 'unknown' })
    reopened.close()
  })

  it('adds the immutable presentation snapshot to an existing started session', async () => {
    const name = `raffle-os-v4-to-v5-${crypto.randomUUID()}`
    names.push(name)
    const legacyDatabase = new Dexie(name, { autoOpen: false, IDBKeyRange, indexedDB })
    legacyDatabase.version(1).stores(SCHEMA_V1)
    legacyDatabase.version(2).stores(SCHEMA_V2)
    legacyDatabase.version(3).stores(SCHEMA_V3)
    legacyDatabase.version(4).stores(SCHEMA_V4)
    await legacyDatabase.open()
    await legacyDatabase.table('draw_configurations').add({ id: 'configuration-1', eventId: 'event-1', prizeCategoryId: 'prize-1', requestedWinners: 1, winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: null, createdAt: '2026-08-05T01:00:00.000Z', updatedAt: '2026-08-05T01:00:00.000Z' })
    await legacyDatabase.table('draw_sessions').add({ id: 'session-1', eventId: 'event-1', configurationId: 'configuration-1', mode: 'live', status: 'pending-confirmation', configurationSnapshot: { snapshotFormatVersion: 1, configurationId: 'configuration-1', prizeCategoryId: 'prize-1', categoryName: 'Prize', prizeName: 'Prize', requestedWinners: 1, winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: null, capturedAt: '2026-08-05T01:00:00.000Z' }, candidatePoolSnapshot: { snapshotFormatVersion: 1, eventId: 'event-1', configurationId: 'configuration-1', prizeCategoryId: 'prize-1', mode: 'live', capturedAt: '2026-08-05T01:00:00.000Z', winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: null, candidateEntries: [], eligibleSnapshotCount: 0 }, createdAt: '2026-08-05T01:00:00.000Z', updatedAt: '2026-08-05T01:00:00.000Z' })
    legacyDatabase.close()

    const database = new RaffleOSDatabase(name, { IDBKeyRange, indexedDB })
    await database.openSupported()
    expect(await database.draw_configurations.get('configuration-1' as DrawConfigurationId)).toMatchObject({
      requestedWinners: 1,
      presentation: { presentationMode: 'instant-reveal', rollStopMode: 'timed', rollDurationSeconds: 8, rollSpeedPerSecond: 12, revealMode: 'all-together' },
    })
    expect((await database.draw_sessions.get('session-1' as DrawSessionId))?.configurationSnapshot?.presentation).toEqual({
      presentationMode: 'instant-reveal',
      rollStopMode: 'timed',
      rollDurationSeconds: 8,
      rollSpeedPerSecond: 12,
      revealMode: 'all-together',
    })
    database.close()
  })
})
