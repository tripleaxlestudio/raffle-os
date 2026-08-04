import { parseCsv } from './csv-parser.ts'
import type {
  ImportFileMetadata,
  ParticipantImportSourceMetadata,
} from './participant-import-staging.types.ts'
import { validateParticipantImport } from './participant-import-staging.ts'
import { parseXlsx } from '../../infrastructure/import/xlsx-parser.adapter.ts'
import type {
  ParticipantImportParserOptions,
  ParticipantImportParserResult,
} from './participant-import-parser.types.ts'

export function parseParticipantImport(
  text: string,
  options: ParticipantImportParserOptions,
): ParticipantImportParserResult {
  const format = detectFormat(options.metadata)
  if (format === null) {
    return {
      ok: false,
      code: 'unsupported-format',
      message: 'Participant import file format is not supported.',
      diagnostics: [],
    }
  }
  if (format === 'xlsx') {
    return {
      ok: false,
      code: 'parser-not-implemented',
      format,
      message: 'XLSX parsing is reserved for a future parser adapter.',
      diagnostics: [],
    }
  }

  const fileMetadata: ImportFileMetadata = {
    fileName: options.metadata.fileName,
    fileType: 'csv',
    sizeBytes: options.metadata.sizeBytes ?? text.length,
    lastModifiedAt: options.metadata.lastModifiedAt,
    sheetName: options.metadata.sheetName,
  }
  const parsed = parseCsv(text, { ...options, fileMetadata })
  if (!parsed.ok) {
    return {
      ok: false,
      code: 'csv-parse-failed',
      format: 'csv',
      message: 'CSV could not be parsed.',
      diagnostics: parsed.diagnostics,
    }
  }
  return {
    ok: true,
    parsed: parsed.value,
    validation: validateParticipantImport(parsed.value.rows, options.mappings, options.strategy),
  }
}

export async function parseParticipantImportAsync(
  input: ArrayBuffer,
  options: import('./participant-import-parser.types.ts').ParticipantImportXlsxOptions,
) {
  const metadata: ImportFileMetadata = {
    fileName: options.metadata.fileName,
    fileType: 'xlsx',
    sizeBytes: options.metadata.sizeBytes ?? input.byteLength,
    lastModifiedAt: options.metadata.lastModifiedAt,
    sheetName: options.metadata.sheetName,
  }
  const parsed = await parseXlsx(input, { fileMetadata: metadata, worksheet: options.worksheet, limits: options })
  if (!parsed.ok) return parsed
  return { ok: true as const, parsed: parsed.value, validation: validateParticipantImport(parsed.value.rows, options.mappings, options.strategy) }
}

function detectFormat(metadata: ParticipantImportSourceMetadata): 'csv' | 'xlsx' | null {
  const extension = (metadata.extension ?? metadata.fileName.split('.').pop() ?? '').replace('.', '').toLowerCase()
  const mimeType = metadata.mimeType?.toLowerCase()
  if (extension === 'csv' || mimeType === 'text/csv') return 'csv'
  if (
    extension === 'xlsx' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) return 'xlsx'
  return null
}
