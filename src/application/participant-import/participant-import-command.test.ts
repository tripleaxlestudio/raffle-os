import { describe, expect, it, vi } from 'vitest'
import { commitParticipantImport, type CommitParticipantImportCommand } from './participant-import-command.ts'
import type { ParticipantImportUnitOfWork } from '../persistence/participant-import-unit-of-work.interface.ts'
import type { ParticipantId, AuditRecordId } from '../../domain/shared/identifiers.ts'
import { parseTicketNumber } from '../../domain/participants/participant.invariants.ts'

const eventId = '11111111-1111-4111-8111-111111111111'
const timestamp = '2026-08-04T10:00:00.000Z'
function parsedTicket(value: string) {
  const result = parseTicketNumber(value)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}
const ticket = parsedTicket('00042')

function command(overrides: Partial<CommitParticipantImportCommand> = {}): CommitParticipantImportCommand {
  return {
    eventId,
    strategy: 'replace',
    source: { fileName: 'participants.csv', extension: 'csv', mimeType: 'text/csv', sizeBytes: 42 },
    mapping: [{ targetField: 'ticketNumber', sourceColumn: 'Ticket Number', requirement: 'required' }],
    drafts: [{ ticketNumber: ticket, isCheckedIn: false }],
    summary: { totalRows: 1, validRows: 1, invalidRows: 0, emptyTicketRows: 0, malformedRows: 0, duplicateRows: 0, issueCount: 0, strategy: 'replace' },
    ...overrides,
  }
}

function dependencies(unitOfWork: ParticipantImportUnitOfWork) {
  let participantIndex = 0
  return {
    unitOfWork,
    createParticipantId: () => `22222222-2222-4222-8222-22222222222${++participantIndex}` as ParticipantId,
    createAuditRecordId: () => '33333333-3333-4333-8333-333333333333' as AuditRecordId,
    createOperationId: () => 'import-1',
    now: () => timestamp,
  }
}

describe('commitParticipantImport command boundary', () => {
  it('rejects invalid commands without invoking persistence', async () => {
    const unitOfWork = { commitParticipantImport: vi.fn() }
    const result = await commitParticipantImport(command({ drafts: [], summary: { ...command().summary, totalRows: 0, validRows: 0 } }), dependencies(unitOfWork))
    expect(result).toMatchObject({ ok: false, code: 'empty-import' })
    expect(unitOfWork.commitParticipantImport).not.toHaveBeenCalled()
  })

  it.each([
    ['numeric ticket', [{ ticketNumber: 42, isCheckedIn: false }]],
    ['empty ticket', [{ ticketNumber: '', isCheckedIn: false }]],
  ])('rejects %s drafts', async (_label, drafts) => {
    const unitOfWork = { commitParticipantImport: vi.fn() }
    const result = await commitParticipantImport(command({ drafts: drafts as never, summary: { ...command().summary } }), dependencies(unitOfWork))
    expect(result).toMatchObject({ ok: false, code: 'invalid-command' })
    expect(unitOfWork.commitParticipantImport).not.toHaveBeenCalled()
  })

  it('rejects duplicate tickets, summary mismatch, unsupported strategy, and invalid mapping', async () => {
    const unitOfWork = { commitParticipantImport: vi.fn() }
    const duplicate = await commitParticipantImport(command({ drafts: [{ ticketNumber: parsedTicket('00042'), isCheckedIn: false }, { ticketNumber: parsedTicket('00042'), isCheckedIn: true }], summary: { ...command().summary, totalRows: 2, validRows: 2 } }), dependencies(unitOfWork))
    const mismatch = await commitParticipantImport(command({ summary: { ...command().summary, validRows: 2 } }), dependencies(unitOfWork))
    const strategy = await commitParticipantImport(command({ strategy: 'invalid' as never }), dependencies(unitOfWork))
    const mapping = await commitParticipantImport(command({ mapping: [] }), dependencies(unitOfWork))
    expect(duplicate).toMatchObject({ ok: false, code: 'duplicate-ticket-in-batch' })
    expect(mismatch).toMatchObject({ ok: false, code: 'summary-mismatch' })
    expect(strategy).toMatchObject({ ok: false, code: 'invalid-command' })
    expect(mapping).toMatchObject({ ok: false, code: 'invalid-command' })
    expect(unitOfWork.commitParticipantImport).not.toHaveBeenCalled()
  })

  it('creates exact-string participants with injected identity and time and does not mutate drafts', async () => {
    const unitOfWork = { commitParticipantImport: vi.fn().mockResolvedValue({ removedCount: 2, unchangedCount: 0 }) }
    const drafts = [{ ticketNumber: ticket, name: 'Ada', isCheckedIn: true }]
    const result = await commitParticipantImport(command({ drafts, summary: { ...command().summary } }), dependencies(unitOfWork))
    expect(result).toMatchObject({ ok: true, insertedCount: 1, removedCount: 2, completedAt: timestamp })
    expect(unitOfWork.commitParticipantImport).toHaveBeenCalledWith(expect.objectContaining({
      participants: [expect.objectContaining({ ticketNumber: '00042', eventId, createdAt: timestamp, updatedAt: timestamp })],
      auditRecord: expect.objectContaining({ action: 'participant-import-committed' }),
    }))
    expect(drafts).toEqual([{ ticketNumber: '00042', name: 'Ada', isCheckedIn: true }])
  })

  it('commits only validated drafts when the reconciled preview contains invalid rows', async () => {
    const unitOfWork = { commitParticipantImport: vi.fn().mockResolvedValue({ removedCount: 0, unchangedCount: 0 }) }
    const result = await commitParticipantImport(command({
      strategy: 'merge',
      summary: { totalRows: 2, validRows: 1, invalidRows: 1, emptyTicketRows: 1, malformedRows: 0, duplicateRows: 0, issueCount: 1, strategy: 'merge' },
    }), dependencies(unitOfWork))
    expect(result).toMatchObject({ ok: true, insertedCount: 1 })
    expect(unitOfWork.commitParticipantImport).toHaveBeenCalledWith(expect.objectContaining({ participants: [expect.objectContaining({ ticketNumber: '00042' })] }))
  })

  it('normalizes typed persistence failures without exposing raw errors', async () => {
    const unitOfWork = { commitParticipantImport: vi.fn().mockRejectedValue({ code: 'immutable-record', stack: 'secret' }) }
    const result = await commitParticipantImport(command(), dependencies(unitOfWork))
    expect(result).toEqual({ ok: false, code: 'event-not-mutable', message: 'The selected Event does not permit participant import.' })
    expect(JSON.stringify(result)).not.toContain('secret')
  })
})
