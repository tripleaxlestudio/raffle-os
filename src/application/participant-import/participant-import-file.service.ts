import { parseParticipantImport } from './participant-import-parser.ts'
import type {
  ParticipantImportParserResult,
} from './participant-import-parser.types.ts'
import type { ParticipantImportSourceMetadata } from './participant-import-staging.types.ts'

export const MAX_PARTICIPANT_IMPORT_FILE_BYTES = 10 * 1024 * 1024

export type BrowserFileErrorCode =
  | 'unsupported-format'
  | 'file-too-large'
  | 'empty-file'
  | 'read-failed'

export interface BrowserFileError {
  readonly ok: false
  readonly code: BrowserFileErrorCode
  readonly message: string
}

export interface BrowserFileSuccess {
  readonly ok: true
  readonly metadata: ParticipantImportSourceMetadata
  readonly text?: string
  readonly parserResult?: ParticipantImportParserResult
}

export type BrowserFileResult = BrowserFileError | BrowserFileSuccess

const CSV_MIME_TYPES = new Set(['', 'text/csv', 'application/csv'])
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function readParticipantImportFile(
  file: File,
): Promise<BrowserFileResult> {
  const extension = getExtension(file.name)
  const metadata: ParticipantImportSourceMetadata = {
    extension,
    fileName: file.name,
    lastModifiedAt: file.lastModified
      ? new Date(file.lastModified).toISOString()
      : undefined,
    mimeType: file.type,
    sizeBytes: file.size,
  }

  if (extension !== 'csv' && extension !== 'xlsx') {
    return { ok: false, code: 'unsupported-format', message: 'Unsupported file. Choose a CSV or XLSX file.' }
  }
  if (extension === 'csv' && !CSV_MIME_TYPES.has(file.type.toLowerCase())) {
    return { ok: false, code: 'unsupported-format', message: 'This file type does not match its CSV extension.' }
  }
  if (extension === 'xlsx' && file.type && file.type.toLowerCase() !== XLSX_MIME) {
    return { ok: false, code: 'unsupported-format', message: 'This file type does not match its XLSX extension.' }
  }
  if (file.size > MAX_PARTICIPANT_IMPORT_FILE_BYTES) {
    return { ok: false, code: 'file-too-large', message: `File exceeds the ${formatBytes(MAX_PARTICIPANT_IMPORT_FILE_BYTES)} limit.` }
  }
  if (file.size === 0) {
    return { ok: false, code: 'empty-file', message: 'The selected file is empty.' }
  }
  if (extension === 'xlsx') {
    return { ok: true, metadata, parserResult: parseParticipantImport('', { metadata, mappings: [], strategy: 'replace' }) }
  }

  try {
    const text = await file.text()
    if (text.length === 0) {
      return { ok: false, code: 'empty-file', message: 'The selected file is empty.' }
    }
    return { ok: true, metadata, text }
  } catch {
    return { ok: false, code: 'read-failed', message: 'The browser could not read this file. Choose it again or try another CSV.' }
  }
}

export function formatBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase()
}
