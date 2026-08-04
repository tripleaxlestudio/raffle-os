import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import { parseTicketNumber } from '../../../domain/participants/participant.invariants.ts'
import type { AuditRecord } from '../../../domain/audit/audit.types.ts'
import type { Event } from '../../../domain/events/event.types.ts'
import { createAuditRecordId, createEventId, createParticipantId } from '../../../domain/shared/identifiers.ts'
import { parseIsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type { Participant } from '../../../domain/participants/participant.types.ts'
import { RaffleOSDatabase } from '../db.ts'
import { DexieParticipantImportUnitOfWork } from './dexie-participant-import-unit-of-work.ts'

const timestampResult = parseIsoTimestamp('2026-08-04T10:00:00.000Z')
if (!timestampResult.ok) throw new Error(timestampResult.error.message)
const timestamp = timestampResult.value
const opened: RaffleOSDatabase[] = []
const names: string[] = []

function database(): RaffleOSDatabase {
  const name = `participant-import-${crypto.randomUUID()}`
  const result = new RaffleOSDatabase(name, { indexedDB, IDBKeyRange })
  opened.push(result)
  names.push(name)
  return result
}

function event(id = createEventId(), status: Event['status'] = 'draft'): Event {
  return { id, name: 'Import Event', status, createdAt: timestamp, updatedAt: timestamp }
}

function participant(eventId: Event['id'], ticket: string, name = 'Existing'): Participant {
  const ticketResult = parseTicketNumber(ticket)
  if (!ticketResult.ok) throw new Error(ticketResult.error.message)
  return { id: createParticipantId(), eventId, ticketNumber: ticketResult.value, name, isCheckedIn: false, createdAt: timestamp, updatedAt: timestamp }
}

function audit(eventId: Event['id'], action: AuditRecord['action'] = 'participant-import-committed'): AuditRecord {
  return { id: createAuditRecordId(), eventId, action, actor: { type: 'system' }, detail: { operationId: 'import-1' }, timestamp }
}

async function input(eventId: Event['id'], strategy: 'replace' | 'merge', tickets: string[], auditRecord = audit(eventId)) {
  return { eventId, strategy, participants: tickets.map((ticket) => participant(eventId, ticket, 'Imported')), auditRecord }
}

afterEach(async () => {
  for (const db of opened) db.close()
  for (const name of names) {
    const cleanup = new RaffleOSDatabase(name, { indexedDB, IDBKeyRange })
    await cleanup.delete()
    cleanup.close()
  }
  opened.length = 0
  names.length = 0
})

describe('DexieParticipantImportUnitOfWork', () => {
  it('atomically replaces only the selected draft Event and appends one audit record', async () => {
    const db = database()
    const selected = event()
    const other = event()
    await db.openSupported()
    await db.events.bulkAdd([selected, other])
    await db.participants.bulkAdd([participant(selected.id, 'old-1'), participant(selected.id, 'old-2'), participant(other.id, '00042')])
    const result = await new DexieParticipantImportUnitOfWork(db).commitParticipantImport(await input(selected.id, 'replace', ['00042', '42']))
    expect(result).toEqual({ removedCount: 2, unchangedCount: 0 })
    expect(await db.participants.where('eventId').equals(selected.id).toArray()).toHaveLength(2)
    expect((await db.participants.where('eventId').equals(selected.id).toArray()).map((item) => item.ticketNumber).sort()).toEqual(['00042', '42'])
    expect(await db.participants.where('eventId').equals(other.id).count()).toBe(1)
    expect(await db.audit_records.where('eventId').equals(selected.id).count()).toBe(1)
    const reopenedName = db.name
    db.close()
    const reopened = new RaffleOSDatabase(reopenedName, { indexedDB, IDBKeyRange })
    opened.push(reopened)
    await reopened.openSupported()
    expect((await reopened.participants.where('eventId').equals(selected.id).toArray()).map((item) => item.ticketNumber).sort()).toEqual(['00042', '42'])
  })

  it('merges without updating existing records and rejects exact conflicts before writes', async () => {
    const db = database()
    const selected = event()
    await db.openSupported()
    const existing = participant(selected.id, '00042', 'Keep me')
    await db.events.add(selected)
    await db.participants.add(existing)
    const result = await new DexieParticipantImportUnitOfWork(db).commitParticipantImport(await input(selected.id, 'merge', ['42']))
    expect(result).toEqual({ removedCount: 0, unchangedCount: 1 })
    expect(await db.participants.where('eventId').equals(selected.id).count()).toBe(2)
    expect((await db.participants.get(existing.id))?.name).toBe('Keep me')
    await expect(new DexieParticipantImportUnitOfWork(db).commitParticipantImport(await input(selected.id, 'merge', ['42', '00042']))).rejects.toMatchObject({ code: 'duplicate-record' })
    expect(await db.participants.where('eventId').equals(selected.id).count()).toBe(2)
  })

  it('rolls back replacement when audit validation fails', async () => {
    const db = database()
    const selected = event()
    const old = participant(selected.id, '00042')
    await db.openSupported()
    await db.events.add(selected)
    await db.participants.add(old)
    const badAudit = audit(selected.id, 'unsupported-action' as AuditRecord['action'])
    await expect(new DexieParticipantImportUnitOfWork(db).commitParticipantImport(await input(selected.id, 'replace', ['new'], badAudit))).rejects.toMatchObject({ code: 'validation-failed' })
    expect(await db.participants.get(old.id)).toEqual(old)
    expect(await db.participants.where('eventId').equals(selected.id).count()).toBe(1)
    expect(await db.audit_records.where('eventId').equals(selected.id).count()).toBe(0)
  })

  it('rejects immutable Events without changing Participants', async () => {
    const db = database()
    const selected = event(createEventId(), 'ready')
    await db.openSupported()
    const old = participant(selected.id, 'old')
    await db.events.add(selected)
    await db.participants.add(old)
    await expect(new DexieParticipantImportUnitOfWork(db).commitParticipantImport(await input(selected.id, 'replace', ['new']))).rejects.toMatchObject({ code: 'immutable-record' })
    expect(await db.participants.get(old.id)).toEqual(old)
  })
})
