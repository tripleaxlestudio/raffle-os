// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ChecksumParserError, parseInstallerChecksum } from './checksum-parser.ts'

const fileName = 'Kocokan-Setup-0.1.2.exe'
const digest = 'A'.repeat(64)

describe('parseInstallerChecksum', () => {
  it('returns one normalized exact checksum match', () => {
    expect(parseInstallerChecksum(`${'b'.repeat(64)}  other.exe\r\n${digest}  ${fileName}\r\n`, fileName)).toBe('a'.repeat(64))
  })

  it('rejects a malformed digest', () => {
    expect(() => parseInstallerChecksum(`xyz  ${fileName}`, fileName)).toThrowError(expect.objectContaining<Partial<ChecksumParserError>>({ code: 'malformed-entry' }))
  })

  it('rejects duplicate exact entries', () => {
    expect(() => parseInstallerChecksum(`${digest}  ${fileName}\n${digest}  ${fileName}`, fileName)).toThrowError(expect.objectContaining<Partial<ChecksumParserError>>({ code: 'duplicate-entry' }))
  })

  it('does not accept a partial filename match', () => {
    expect(() => parseInstallerChecksum(`${digest}  prefix-${fileName}`, fileName)).toThrowError(expect.objectContaining<Partial<ChecksumParserError>>({ code: 'missing-entry' }))
  })

  it('rejects missing and case-ambiguous filenames', () => {
    expect(() => parseInstallerChecksum(`${digest}  another.exe`, fileName)).toThrowError(expect.objectContaining<Partial<ChecksumParserError>>({ code: 'missing-entry' }))
    expect(() => parseInstallerChecksum(`${digest}  kocokan-setup-0.1.2.exe`, fileName)).toThrowError(expect.objectContaining<Partial<ChecksumParserError>>({ code: 'ambiguous-entry' }))
  })
})
