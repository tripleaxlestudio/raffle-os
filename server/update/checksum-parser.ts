export type ChecksumParserErrorCode = 'malformed-entry' | 'missing-entry' | 'duplicate-entry' | 'ambiguous-entry'

export class ChecksumParserError extends Error {
  readonly code: ChecksumParserErrorCode

  constructor(code: ChecksumParserErrorCode) {
    super(`Checksum parsing failed: ${code}`)
    this.name = 'ChecksumParserError'
    this.code = code
  }
}

export function parseInstallerChecksum(contents: string, installerFileName: string): string {
  const matches: string[] = []
  for (const line of contents.split(/\r?\n/)) {
    if (line === '') continue
    const match = /^([0-9a-fA-F]{64}) {2}(\S(?:.*\S)?)$/.exec(line)
    if (match === null) throw new ChecksumParserError('malformed-entry')
    const fileName = match[2]!
    if (fileName.toLowerCase() === installerFileName.toLowerCase() && fileName !== installerFileName) throw new ChecksumParserError('ambiguous-entry')
    if (fileName === installerFileName) matches.push(match[1]!.toLowerCase())
  }
  if (matches.length === 0) throw new ChecksumParserError('missing-entry')
  if (matches.length !== 1) throw new ChecksumParserError('duplicate-entry')
  return matches[0]!
}
