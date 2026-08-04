import { useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  MAX_PARTICIPANT_IMPORT_FILE_BYTES,
  PARTICIPANT_IMPORT_FIELDS,
  preventDuplicateSourceMappings,
  readParticipantImportFile,
  parseParticipantImportAsync,
  suggestColumnMappings,
} from '../../../application/participant-import/index.ts'
import { parseParticipantImport } from '../../../application/participant-import/participant-import-parser.ts'
import { validateParticipantImport } from '../../../application/participant-import/participant-import-staging.ts'
import type {
  ColumnMapping,
  ParticipantImportValidationResult,
  ParsedCsvFile,
  XlsxParsedFile,
} from '../../../application/participant-import/index.ts'

export const MAX_PREVIEW_ROWS = 20
export const MAX_ISSUE_ROWS_SHOWN = 20

type ParsedImportFile = ParsedCsvFile | XlsxParsedFile
type PreviewState =
  | { readonly status: 'idle' }
  | { readonly status: 'reading'; readonly fileName: string }
  | { readonly status: 'unsupported' | 'parse-error'; readonly message: string }
  | { readonly status: 'mapping' | 'validation-ready'; readonly parsed: ParsedImportFile; readonly mappings: readonly ColumnMapping[]; readonly validation: ParticipantImportValidationResult }

export function ProductionParticipantImportPreview() {
  const inputRef = useRef<HTMLInputElement>(null)
  const readVersion = useRef(0)
  const [state, setState] = useState<PreviewState>({ status: 'idle' })
  const [fileInfo, setFileInfo] = useState<{ name: string; type: string; size: number } | null>(null)
  const xlsxBuffer = useRef<ArrayBuffer | null>(null)
  const xlsxMetadata = useRef<Parameters<typeof parseParticipantImportAsync>[1] | null>(null)

  async function selectFile(file: File | undefined) {
    if (!file) return
    const version = readVersion.current + 1
    readVersion.current = version
    setFileInfo({ name: file.name, type: file.type || 'Browser did not provide a MIME type', size: file.size })
    setState({ status: 'reading', fileName: file.name })
    const result = await readParticipantImportFile(file)
    if (version !== readVersion.current) return
    if (!result.ok) {
      setState({ status: result.code === 'unsupported-format' ? 'unsupported' : 'parse-error', message: result.message })
      return
    }
    if (result.arrayBuffer) {
      xlsxBuffer.current = result.arrayBuffer
      xlsxMetadata.current = { metadata: result.metadata, mappings: [], strategy: 'replace' }
      const parsedResult = await parseParticipantImportAsync(result.arrayBuffer, xlsxMetadata.current)
      if (version !== readVersion.current) return
      if (!parsedResult.ok) { setState({ status: 'parse-error', message: parsedResult.diagnostics[0]?.message ?? 'XLSX could not be parsed.' }); return }
      setStateForMapping(parsedResult.parsed, suggestColumnMappings(parsedResult.parsed.headers))
      return
    }
    if (!result.text) return
    const parsedResult = parseParticipantImport(result.text, {
      metadata: result.metadata,
      mappings: [],
      strategy: 'replace',
    })
    if (version !== readVersion.current) return
    if (!parsedResult.ok) {
      setState({ status: 'parse-error', message: parsedResult.message })
      return
    }
    setStateForMapping(parsedResult.parsed, suggestColumnMappings(parsedResult.parsed.headers))
  }

  function setStateForMapping(parsed: ParsedImportFile, mappings: readonly ColumnMapping[]) {
    const validation = validateParticipantImport(parsed.rows, mappings, 'replace')
    setState({ status: mappings.some((mapping) => mapping.targetField === 'ticketNumber' && mapping.sourceColumn !== null) ? 'validation-ready' : 'mapping', parsed, mappings, validation })
  }

  function changeMapping(field: ColumnMapping['targetField'], sourceColumn: string | null) {
    if (state.status !== 'mapping' && state.status !== 'validation-ready') return
    const mappings = preventDuplicateSourceMappings(state.mappings, field, sourceColumn)
    setStateForMapping(state.parsed, mappings)
  }

  function clearFile() {
    readVersion.current += 1
    setState({ status: 'idle' })
    setFileInfo(null)
    xlsxBuffer.current = null
    xlsxMetadata.current = null
    if (inputRef.current) inputRef.current.value = ''
  }

  const parsedState = state.status === 'mapping' || state.status === 'validation-ready' ? state : null
  const selectedXlsx = parsedState?.parsed.format === 'xlsx' ? parsedState.parsed : null
  return (
    <section className="participant-import production-import-preview" aria-labelledby="production-import-title" data-workflow-state={state.status}>
      <div className="prototype-notice" role="note"><span aria-hidden="true">PREVIEW</span>Production preview only. No Participant data has been saved yet.</div>
      <header className="page-header">
        <div className="page-header__copy"><p className="page-header__eyebrow">Participant operations · production preview</p><h1 id="production-import-title">Preview participant file</h1><p className="page-header__description">Select a CSV, review its rows, map columns, and inspect validation before a future import step.</p></div>
        <Link className="ui-button ui-button--secondary" to="/participants">Return to prototype</Link>
      </header>

      <div className="production-import-preview__upload">
        <label htmlFor="participant-file">Choose participant file</label>
        <input ref={inputRef} id="participant-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void selectFile(file) }} />
        <p>Supported formats: bounded CSV and XLSX preview. Maximum file size: {MAX_PARTICIPANT_IMPORT_FILE_BYTES / (1024 * 1024)} MB.</p>
        {fileInfo ? <div role="status"><strong>{fileInfo.name}</strong><span> · {fileInfo.type} · {formatBytesForUi(fileInfo.size)}</span><button type="button" onClick={clearFile}>Remove file</button></div> : null}
      </div>

      {state.status === 'reading' ? <p role="status">Reading {state.fileName}…</p> : null}
      {state.status === 'unsupported' || state.status === 'parse-error' ? <div className="status-banner status-banner--warning" role="alert"><div className="status-banner__copy"><h2>{state.status === 'unsupported' ? 'Unsupported file' : 'File could not be parsed'}</h2><p>{state.message}</p></div></div> : null}

      {parsedState ? <>
        <section aria-labelledby="mapping-title" className="production-import-preview__section">
          <h2 id="mapping-title">Map columns</h2>
          <p>Suggestions are reviewable only. Unmapped source columns remain ignored. Ticket Number is required; Participant Name is optional.</p>
          {selectedXlsx ? <p role="status">Selected worksheet: {selectedXlsx.sheetName}</p> : null}
          <div className="production-import-preview__mapping">
            {PARTICIPANT_IMPORT_FIELDS.map((field) => {
              const mapping = parsedState.mappings.find((item) => item.targetField === field.field)
              return <label key={field.field} htmlFor={`mapping-${field.field}`}><span>{field.label} — {field.requirement === 'required' ? 'Required' : 'Optional'}</span><select id={`mapping-${field.field}`} aria-label={`${field.label} — ${field.requirement}`} value={mapping?.sourceColumn ?? ''} onChange={(event) => changeMapping(field.field, event.target.value || null)}><option value="">Not mapped</option>{parsedState.parsed.headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>
            })}
          </div>
          {selectedXlsx && selectedXlsx.worksheets.filter((sheet) => sheet.visibility === 'visible').length > 1 ? <label htmlFor="xlsx-worksheet"><span>Worksheet</span><select id="xlsx-worksheet" value={selectedXlsx.sheetName} onChange={(event) => { const buffer = xlsxBuffer.current; const metadata = xlsxMetadata.current; if (!buffer || !metadata) return; void parseParticipantImportAsync(buffer, { ...metadata, worksheet: { kind: 'named', name: event.target.value } }).then((result) => { if (result.ok) setStateForMapping(result.parsed, suggestColumnMappings(result.parsed.headers)); else setState({ status: 'parse-error', message: result.diagnostics[0]?.message ?? 'Worksheet could not be parsed.' }) }) }}><option value={selectedXlsx.sheetName}>{selectedXlsx.sheetName}</option>{selectedXlsx.worksheets.filter((sheet) => sheet.visibility === 'visible' && sheet.name !== selectedXlsx.sheetName).map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name}</option>)}</select></label> : null}
          <p>Ignored source columns: {parsedState.parsed.headers.filter((header) => !parsedState.mappings.some((mapping) => mapping.sourceColumn === header)).join(', ') || 'none'}</p>
          {parsedState.mappings.some((mapping) => mapping.targetField === 'ticketNumber' && mapping.sourceColumn === null) ? <p role="alert">Map exactly one source column to Ticket Number before validation is ready.</p> : null}
        </section>
        <PreviewTable parsed={parsedState.parsed} />
        {parsedState.status === 'validation-ready' ? <ValidationPanel validation={parsedState.validation} /> : null}
      </> : null}
    </section>
  )
}

function PreviewTable({ parsed }: { parsed: ParsedImportFile }) {
  const rows = parsed.rows.slice(0, MAX_PREVIEW_ROWS)
  return <section aria-labelledby="raw-preview-title" className="production-import-preview__section"><h2 id="raw-preview-title">Raw row preview</h2><p>Showing the first {rows.length} of {parsed.rows.length} data rows; values are displayed exactly as read.</p><table><caption>Parsed participant file rows</caption><thead><tr><th scope="col">Source row</th>{parsed.headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.rowNumber}><th scope="row">{row.rowNumber}</th>{parsed.headers.map((header) => <td key={header}>{String(row.values[header] ?? '')}</td>)}</tr>)}</tbody></table></section>
}

function ValidationPanel({ validation }: { validation: ParticipantImportValidationResult }) {
  const issues = validation.rows.flatMap((row) => row.issues).slice(0, MAX_ISSUE_ROWS_SHOWN)
  return <section aria-labelledby="validation-title" className="production-import-preview__section"><h2 id="validation-title">Validation preview</h2><div role="region" aria-label="Participant validation summary"><p>Total rows: {validation.summary.totalRows}</p><p>Valid rows: {validation.summary.validRows}</p><p>Invalid rows: {validation.summary.invalidRows}</p><p>Duplicate count: {validation.summary.duplicateRows}</p><p>Empty-ticket count: {validation.summary.emptyTicketRows}</p><p>Malformed count: {validation.summary.malformedRows}</p><p>Issue count: {validation.summary.issueCount}</p></div><table><caption>Validation result by source row</caption><thead><tr><th scope="col">Source row</th><th scope="col">Ticket Number</th><th scope="col">Result</th></tr></thead><tbody>{validation.rows.slice(0, MAX_PREVIEW_ROWS).map((row) => <tr key={row.normalized.rowNumber}><th scope="row">{row.normalized.rowNumber}</th><td>{row.normalized.ticketNumber ?? '—'}</td><td>{row.participantDraft ? 'Valid' : 'Invalid'}</td></tr>)}</tbody></table><h3>Validation issues</h3>{issues.length ? <ul>{issues.map((issue) => <li key={`${issue.rowNumber}-${issue.code}`}>Source row {issue.rowNumber}: {issue.message}</li>)}</ul> : <p role="status">All previewed rows are valid.</p>}{validation.summary.issueCount > MAX_ISSUE_ROWS_SHOWN ? <p>Only the first {MAX_ISSUE_ROWS_SHOWN} issues are displayed.</p> : null}<p>No Participant data has been saved yet.</p></section>
}

function formatBytesForUi(bytes: number): string { return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB` }
