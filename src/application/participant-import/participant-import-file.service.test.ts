import { describe, expect, it, vi } from 'vitest'
import {
  MAX_PARTICIPANT_IMPORT_FILE_BYTES,
  readParticipantImportFile,
} from './participant-import-file.service.ts'

function makeFile(text: string, name = 'participants.csv', type = 'text/csv'): File {
  return new File([text], name, { type })
}

describe('browser participant import file boundary', () => {
  it('accepts a valid CSV File without changing its text', async () => {
    const result = await readParticipantImportFile(makeFile('Ticket Number\n00042'))
    expect(result).toMatchObject({ ok: true, text: 'Ticket Number\n00042' })
  })

  it('rejects an oversized file before reading', async () => {
    const file = makeFile('x')
    Object.defineProperty(file, 'size', { value: MAX_PARTICIPANT_IMPORT_FILE_BYTES + 1 })
    const read = vi.spyOn(file, 'text')
    const result = await readParticipantImportFile(file)
    expect(result).toMatchObject({ ok: false, code: 'file-too-large' })
    expect(read).not.toHaveBeenCalled()
  })

  it('rejects empty and unsupported files', async () => {
    expect(await readParticipantImportFile(makeFile('', 'empty.csv'))).toMatchObject({ ok: false, code: 'empty-file' })
    expect(await readParticipantImportFile(makeFile('x', 'participants.pdf', 'application/pdf'))).toMatchObject({ ok: false, code: 'unsupported-format' })
  })

  it('returns an explicit parser-not-implemented result for XLSX', async () => {
    const result = await readParticipantImportFile(makeFile('binary', 'participants.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.parserResult).toMatchObject({ ok: false, code: 'parser-not-implemented' })
  })

  it('normalizes browser read failures', async () => {
    const file = makeFile('x')
    vi.spyOn(file, 'text').mockRejectedValue(new Error('browser failure'))
    await expect(readParticipantImportFile(file)).resolves.toMatchObject({ ok: false, code: 'read-failed' })
  })
})
