import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { commitParticipantImport, PARTICIPANT_IMPORT_FIELDS, preventDuplicateSourceMappings, readParticipantImportFile, parseParticipantImportAsync, suggestColumnMappings } from '../../../application/participant-import/index.ts'
import { parseParticipantImport } from '../../../application/participant-import/participant-import-parser.ts'
import { validateParticipantImport } from '../../../application/participant-import/participant-import-staging.ts'
import type { ColumnMapping, ImportStrategy, ParticipantImportValidationResult, XlsxParsedFile } from '../../../application/participant-import/index.ts'
import type { Event } from '../../../domain/events/event.types.ts'
import { ConfirmationDialog } from '../../../shared/ui/ConfirmationDialog.tsx'
import { Modal } from '../../../shared/ui/Modal.tsx'
import { createParticipantImportProductionServices } from '../../../application/participant-import/participant-import-production-services.ts'
import type { ParticipantImportProductionServices } from '../../../application/participant-import/participant-import-production-services.ts'

export const MAX_PREVIEW_ROWS = 20
export const MAX_ISSUE_ROWS_SHOWN = 20
export const MAX_PERSISTED_RECORDS_SHOWN = 50

export interface ProductionParticipantImportPreviewProps {
  readonly services?: ParticipantImportProductionServices
}

type ParsedImportFile = import('../../../application/participant-import/index.ts').ParsedCsvFile | XlsxParsedFile
type StagedImport = { readonly parsed: ParsedImportFile; readonly mappings: readonly ColumnMapping[]; readonly validation: ParticipantImportValidationResult; readonly source: import('../../../application/participant-import/index.ts').ParticipantImportSourceMetadata; readonly fileName: string; readonly worksheet?: string }
type ProductionState =
  | { readonly status: 'idle' }
  | { readonly status: 'reading'; readonly fileName: string }
  | { readonly status: 'unsupported' | 'parse-error'; readonly message: string }
  | { readonly status: 'mapping' | 'validation-ready' | 'strategy-selection' | 'confirmation' | 'committing'; readonly staged: StagedImport; readonly strategy: ImportStrategy | null }
  | { readonly status: 'commit-success'; readonly staged: StagedImport; readonly strategy: ImportStrategy; readonly result: Extract<Awaited<ReturnType<typeof commitParticipantImport>>, { ok: true }>; readonly records: readonly import('../../../domain/participants/participant.types.ts').Participant[]; readonly totalPersisted: number }
  | { readonly status: 'commit-failure'; readonly staged: StagedImport; readonly strategy: ImportStrategy; readonly message: string }

const FRIENDLY_ERRORS: Record<string, string> = {
  'invalid-command': 'The staged import is incomplete or unsupported. Review the file and mapping before retrying.',
  'event-not-found': 'The selected Event was not found. Choose an Event before importing.',
  'event-not-mutable': 'This Event is not mutable. Participant imports are limited to an unreferenced draft Event.',
  'existing-ticket-conflict': 'The import was rejected because a Ticket Number already exists in this Event. No records changed.',
  'persistence-unavailable': 'Local persistence is unavailable. The staged import remains available for retry.',
  'quota-storage-failure': 'Browser storage is full. The import was rolled back and no records changed.',
  'transaction-failed': 'The import transaction failed and was rolled back. No partial success occurred.',
  'relationship-violation': 'The import contained an invalid Event relationship. No records changed.',
  'uniqueness-violation': 'The import violated a unique record constraint. No records changed.',
  'summary-mismatch': 'The import summary no longer matches its validated rows. Review the staged data again.',
  'empty-import': 'At least one valid Participant draft is required before importing.',
}

export function ProductionParticipantImportPreview({ services: providedServices }: ProductionParticipantImportPreviewProps = {}) {
  const servicesRef = useRef<ParticipantImportProductionServices | null>(null)
  if (servicesRef.current === null) servicesRef.current = providedServices ?? createParticipantImportProductionServices()
  const services = servicesRef.current
  if (services === null) throw new Error('Participant import services were not initialized.')
  const inputRef = useRef<HTMLInputElement>(null)
  const readVersion = useRef(0)
  const [state, setState] = useState<ProductionState>({ status: 'idle' })
  const [event, setEvent] = useState<Event | null>(null)
  const [eventError, setEventError] = useState<string | null>(null)
  const [eventLoading, setEventLoading] = useState(true)
  const [currentParticipantCount, setCurrentParticipantCount] = useState<number | null>(null)
  const [fileInfo, setFileInfo] = useState<{ name: string; type: string; size: number } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [replaceAcknowledged, setReplaceAcknowledged] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const xlsxBuffer = useRef<ArrayBuffer | null>(null)
  const xlsxSource = useRef<Parameters<typeof parseParticipantImportAsync>[1] | null>(null)
  const commitInFlight = useRef(false)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        await services.database.openSupported()
        const activeId = await services.preferences.get('activeEventId')
        if (activeId === null) { if (active) setEventError('No current Event is selected. Select a real Event before importing participants.'); return }
        const current = await services.events.findById(activeId)
        if (active) setEvent(current)
        if (current !== null && active) setCurrentParticipantCount(await services.participants.countByEventId(current.id))
        if (current === null && active) setEventError('The current Event could not be found. No import target is available.')
      } catch { if (active) setEventError('Local persistence is unavailable. The production preview is blocked until an Event can be resolved.') }
      finally { if (active) setEventLoading(false) }
    })()
    return () => { active = false }
  }, [services])

  async function selectFile(file: File | undefined) {
    if (!file) return
    const version = ++readVersion.current
    setFileInfo({ name: file.name, type: file.type || 'MIME type unavailable', size: file.size })
    setState({ status: 'reading', fileName: file.name }); setConfirmOpen(false); setReplaceAcknowledged(false); setVerificationError(null)
    const result = await readParticipantImportFile(file)
    if (version !== readVersion.current) return
    if (!result.ok) { setState({ status: result.code === 'unsupported-format' ? 'unsupported' : 'parse-error', message: result.message }); return }
    if (result.arrayBuffer) {
      xlsxBuffer.current = result.arrayBuffer; xlsxSource.current = { metadata: result.metadata, mappings: [], strategy: 'replace' }
      const parsed = await parseParticipantImportAsync(result.arrayBuffer, xlsxSource.current)
      if (version !== readVersion.current) return
      if (!parsed.ok) { setState({ status: 'parse-error', message: parsed.diagnostics[0]?.message ?? 'The XLSX file could not be parsed.' }); return }
      stage(parsed.parsed, suggestColumnMappings(parsed.parsed.headers), result.metadata, file.name)
      return
    }
    if (!result.text) return
    const parsed = parseParticipantImport(result.text, { metadata: result.metadata, mappings: [], strategy: 'replace' })
    if (version !== readVersion.current) return
    if (!parsed.ok) { setState({ status: 'parse-error', message: parsed.message }); return }
    stage(parsed.parsed, suggestColumnMappings(parsed.parsed.headers), result.metadata, file.name)
  }

  function stage(parsed: ParsedImportFile, mappings: readonly ColumnMapping[], source: StagedImport['source'], fileName: string) {
    const validation = validateParticipantImport(parsed.rows, mappings, 'replace')
    setState({ status: mappings.some((m) => m.targetField === 'ticketNumber' && m.sourceColumn !== null) ? 'validation-ready' : 'mapping', staged: { parsed, mappings, validation, source, fileName, worksheet: parsed.format === 'xlsx' ? parsed.sheetName : undefined }, strategy: null })
    setConfirmOpen(false); setReplaceAcknowledged(false)
  }

  function changeMapping(field: ColumnMapping['targetField'], sourceColumn: string | null) {
    if (!('staged' in state)) return
    const mappings = preventDuplicateSourceMappings(state.staged.mappings, field, sourceColumn)
    const validation = validateParticipantImport(state.staged.parsed.rows, mappings, 'replace')
    setState({ status: mappings.some((m) => m.targetField === 'ticketNumber' && m.sourceColumn !== null) ? 'validation-ready' : 'mapping', staged: { ...state.staged, mappings, validation }, strategy: null })
    setConfirmOpen(false); setReplaceAcknowledged(false)
  }

  function chooseStrategy(strategy: ImportStrategy) {
    if (!('staged' in state)) return
    setState({ status: 'strategy-selection', staged: state.staged, strategy }); setConfirmOpen(false); setReplaceAcknowledged(false)
  }

  function clearFile() { ++readVersion.current; setState({ status: 'idle' }); setFileInfo(null); xlsxBuffer.current = null; xlsxSource.current = null; setConfirmOpen(false); if (inputRef.current) inputRef.current.value = '' }

  async function commit() {
    if (commitInFlight.current || !('staged' in state) || !event || !state.strategy || state.staged.validation.summary.validRows === 0 || (state.strategy === 'replace' && !replaceAcknowledged)) return
    commitInFlight.current = true
    const staged = state.staged; const strategy = state.strategy
    setConfirmOpen(false); setState({ status: 'committing', staged, strategy })
    const eventId = event.id
    const result = await commitParticipantImport({ eventId, strategy, source: { ...staged.source, sheetName: staged.worksheet }, mapping: staged.mappings, drafts: staged.validation.rows.flatMap((row) => row.participantDraft === null ? [] : [row.participantDraft]), summary: { ...staged.validation.summary, strategy } }, services)
    if (!result.ok) { commitInFlight.current = false; setState({ status: 'commit-failure', staged, strategy, message: FRIENDLY_ERRORS[result.code] ?? 'The import failed safely. No records were changed.' }); return }
    try {
      const records = await services.participants.findByEventId(eventId, { limit: MAX_PERSISTED_RECORDS_SHOWN, offset: 0 })
      const totalPersisted = await services.participants.countByEventId(eventId)
      setState({ status: 'commit-success', staged, strategy, result, records, totalPersisted })
    } catch { setVerificationError('The import succeeded, but persisted-record verification is temporarily unavailable. Reload to retry verification.'); setState({ status: 'commit-success', staged, strategy, result, records: [], totalPersisted: 0 }) }
    commitInFlight.current = false
  }

  const staged = 'staged' in state ? state.staged : null
  const strategy = 'strategy' in state ? state.strategy : null
  const mutable = event?.status === 'draft'
  const blocked = eventLoading || eventError !== null || event === null || !mutable
  const ready = staged !== null && staged.validation.summary.validRows > 0 && staged.validation.summary.totalRows === staged.validation.summary.validRows + staged.validation.summary.invalidRows && strategy !== null && !blocked
  return <section className="participant-import production-import-preview" aria-label="Preview participant file" data-workflow-state={state.status}>
    <div className="prototype-notice" role="note"><span aria-hidden="true">PREVIEW</span>Persistence is enabled for preview verification. Final Chrome and Edge acceptance remains pending; Phase 4 is not fully accepted.</div>
    <header className="page-header"><div className="page-header__copy"><p className="page-header__eyebrow">Participant operations · production preview</p><h1 id="production-import-title">Participant Import</h1><p className="page-header__description">Stage, validate, and atomically import Participants into the current Event.</p></div><Link className="ui-button ui-button--secondary" to="/participants">Return to prototype</Link></header>
    <EventPanel event={event} loading={eventLoading} error={eventError} />
    <div className="production-import-preview__upload"><label htmlFor="participant-file">Choose participant file</label><input ref={inputRef} id="participant-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={state.status === 'committing'} onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void selectFile(file) }} /><p>Supported formats: CSV and XLSX. File selection remains keyboard accessible.</p>{fileInfo ? <div role="status"><strong>{fileInfo.name}</strong><span> · {fileInfo.type} · {formatBytes(fileInfo.size)}</span><button type="button" onClick={clearFile} disabled={state.status === 'committing'}>Remove file</button></div> : null}</div>
    {state.status === 'reading' || state.status === 'committing' ? <p role="status" aria-live="polite">{state.status === 'reading' ? `Reading ${state.fileName}…` : 'Committing atomic Participant import…'}</p> : null}
    {state.status === 'unsupported' || state.status === 'parse-error' || state.status === 'commit-failure' ? <div className="status-banner status-banner--warning" role="alert"><h2>{state.status === 'commit-failure' ? 'Import failed safely' : state.status === 'unsupported' ? 'Unsupported file' : 'File could not be parsed'}</h2><p>{state.message}</p>{state.status === 'commit-failure' ? <button type="button" onClick={() => setState({ status: 'validation-ready', staged: state.staged, strategy: state.strategy })}>Retry review</button> : null}</div> : null}
    {staged ? <><MappingAndPreview staged={staged} disabled={state.status === 'committing' || state.status === 'confirmation'} onMappingChange={changeMapping} onWorksheetChange={(name) => { const buffer = xlsxBuffer.current; const source = xlsxSource.current; if (!buffer || !source) return; void parseParticipantImportAsync(buffer, { ...source, worksheet: { kind: 'named', name } }).then((parsed) => { if (parsed.ok) stage(parsed.parsed, suggestColumnMappings(parsed.parsed.headers), { ...staged.source, sheetName: name }, staged.fileName); else setState({ status: 'parse-error', message: parsed.diagnostics[0]?.message ?? 'Worksheet could not be parsed.' }) }) }} /><ValidationPanel validation={staged.validation} /><StrategyPanel strategy={strategy} disabled={state.status === 'committing' || state.status === 'confirmation' || !mutable} onChoose={chooseStrategy} /><div className="production-import-preview__actions"><button type="button" disabled={!ready || state.status === 'committing' || state.status === 'confirmation'} onClick={() => { if ('staged' in state && state.strategy) { setState({ status: 'confirmation', staged: state.staged, strategy: state.strategy }); setConfirmOpen(true) } }}>Review and confirm import</button></div></> : null}
    {state.status === 'commit-success' ? <SuccessPanel event={event} state={state} verificationError={verificationError} /> : null}
    <ConfirmationDialog open={confirmOpen && strategy === 'merge'} title="Confirm Merge import" confirmLabel="Confirm atomic Merge" consequence={<ConfirmationContents event={event} staged={staged} strategy="merge" currentParticipantCount={currentParticipantCount} />} onCancel={() => { setConfirmOpen(false); if ('staged' in state && state.strategy) setState({ status: 'strategy-selection', staged: state.staged, strategy: state.strategy }) }} onConfirm={() => void commit()} />
    <Modal open={confirmOpen && strategy === 'replace'} title="Confirm Replace import" onClose={() => { setConfirmOpen(false); if ('staged' in state && state.strategy) setState({ status: 'strategy-selection', staged: state.staged, strategy: state.strategy }) }} footer={<><button type="button" onClick={() => setConfirmOpen(false)}>Cancel</button><button type="button" disabled={!replaceAcknowledged} onClick={() => void commit()}>Confirm Replace</button></>}><ConfirmationContents event={event} staged={staged} strategy="replace" currentParticipantCount={currentParticipantCount} /><label><input type="checkbox" checked={replaceAcknowledged} onChange={(e) => setReplaceAcknowledged(e.target.checked)} /> I understand that current Participants in this Event will be removed and replaced atomically.</label></Modal>
  </section>
}

function EventPanel({ event, loading, error }: { event: Event | null; loading: boolean; error: string | null }) { return <section aria-labelledby="selected-event-title"><h2 id="selected-event-title">Selected Event</h2>{loading ? <p role="status">Resolving the current Event…</p> : error ? <p role="alert">{error}</p> : event ? <p><strong>{event.name}</strong> · status: <span>{event.status}</span> {event.status !== 'draft' ? '— imports are blocked for this immutable Event.' : '— ready for participant import.'}</p> : null}</section> }

function MappingAndPreview({ staged, disabled, onMappingChange, onWorksheetChange }: { staged: StagedImport; disabled: boolean; onMappingChange: (field: ColumnMapping['targetField'], value: string | null) => void; onWorksheetChange: (name: string) => void }) { const xlsx = staged.parsed.format === 'xlsx' ? staged.parsed : null; return <><section aria-labelledby="mapping-title" className="production-import-preview__section"><h2 id="mapping-title">Map source columns</h2><p>Ticket Number requires exactly one source column. Mapping changes clear prior confirmation and success.</p>{PARTICIPANT_IMPORT_FIELDS.map((field) => { const mapping = staged.mappings.find((item) => item.targetField === field.field); return <label key={field.field} htmlFor={`mapping-${field.field}`}><span>{field.label} — {field.requirement}</span><select id={`mapping-${field.field}`} disabled={disabled} value={mapping?.sourceColumn ?? ''} onChange={(e) => onMappingChange(field.field, e.target.value || null)}><option value="">Not mapped</option>{staged.parsed.headers.filter(Boolean).map((header) => <option key={header} value={header}>{header}</option>)}</select></label> })}{xlsx && xlsx.worksheets.filter((sheet) => sheet.visibility === 'visible').length > 1 ? <label htmlFor="xlsx-worksheet">Worksheet<select id="xlsx-worksheet" disabled={disabled} value={xlsx.sheetName} onChange={(e) => onWorksheetChange(e.target.value)}>{xlsx.worksheets.filter((sheet) => sheet.visibility === 'visible').map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name}</option>)}</select></label> : null}</section><PreviewTable parsed={staged.parsed} /></> }
function PreviewTable({ parsed }: { parsed: ParsedImportFile }) { const rows = parsed.rows.slice(0, MAX_PREVIEW_ROWS); return <section aria-labelledby="raw-preview-title"><h2 id="raw-preview-title">Raw-row preview</h2><p>Showing {rows.length} of {parsed.rows.length} rows. Values are displayed exactly as read.</p><table><caption>Parsed participant rows</caption><thead><tr><th>Source row</th>{parsed.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.rowNumber}><th>{row.rowNumber}</th>{parsed.headers.map((header) => <td key={header}>{typeof row.values[header] === 'string' ? row.values[header] : String(row.values[header] ?? '')}</td>)}</tr>)}</tbody></table></section> }
function ValidationPanel({ validation }: { validation: ParticipantImportValidationResult }) { const issues = validation.rows.flatMap((row) => row.issues).slice(0, MAX_ISSUE_ROWS_SHOWN); return <section aria-labelledby="validation-title"><h2 id="validation-title">Validation diagnostics and summary</h2><p>Total rows: {validation.summary.totalRows} · Valid drafts: {validation.summary.validRows} · Invalid rows: {validation.summary.invalidRows} · Duplicate rows: {validation.summary.duplicateRows}</p><p><span>Invalid</span>: {validation.summary.invalidRows} rows are shown with their issues and are not sent to persistence.</p><table><caption>Validation by source row</caption><thead><tr><th>Row</th><th>Ticket Number</th><th>Result</th></tr></thead><tbody>{validation.rows.slice(0, MAX_PREVIEW_ROWS).map((row) => <tr key={row.normalized.rowNumber}><th>{row.normalized.rowNumber}</th><td>{row.normalized.ticketNumber ?? '—'}</td><td>{row.participantDraft ? 'Valid draft' : 'Invalid — not sent to persistence'}</td></tr>)}</tbody></table><ul>{issues.map((issue) => <li key={`${issue.rowNumber}-${issue.code}`}>Row {issue.rowNumber}: {issue.message}</li>)}</ul>{validation.summary.issueCount > MAX_ISSUE_ROWS_SHOWN ? <p>Only the first {MAX_ISSUE_ROWS_SHOWN} issues are displayed.</p> : null}<p>No Participant data has been saved yet.</p></section> }
function StrategyPanel({ strategy, disabled, onChoose }: { strategy: ImportStrategy | null; disabled: boolean; onChoose: (strategy: ImportStrategy) => void }) { return <fieldset disabled={disabled}><legend>Import strategy</legend><label><input type="radio" name="import-strategy" checked={strategy === 'replace'} onChange={() => onChoose('replace')} /> Replace</label><p>Removes current Participants only from the selected Event, then inserts the complete validated batch. It does not affect another Event and rolls back fully on failure.</p><label><input type="radio" name="import-strategy" checked={strategy === 'merge'} onChange={() => onChoose('merge')} /> Merge</label><p>Preserves existing Participants and inserts the complete non-conflicting batch. Exact ticket conflicts reject the complete operation; optional fields are not updated.</p></fieldset> }
function ConfirmationContents({ event, staged, strategy, currentParticipantCount }: { event: Event | null; staged: StagedImport | null; strategy: ImportStrategy; currentParticipantCount: number | null }) { const summary = staged?.validation.summary; return <div><p>Event: <strong>{event?.name ?? 'Unavailable'}</strong> · status: {event?.status ?? 'unknown'}</p><p>Source: {staged?.fileName} · {staged?.parsed.format.toUpperCase()}{staged?.worksheet ? ` · worksheet ${staged.worksheet}` : ''}</p><p>Strategy: {strategy} · valid drafts: {summary?.validRows ?? 0} · invalid rows: {summary?.invalidRows ?? 0} · duplicates: {summary?.duplicateRows ?? 0}</p><p>Current Participants: {currentParticipantCount === null ? 'unavailable' : currentParticipantCount} · expected inserted: {summary?.validRows ?? 0}</p>{strategy === 'replace' ? <p><strong>Replace removes the current Participants for this Event.</strong></p> : <p>Merge preserves existing records; any exact ticket conflict rejects the complete operation.</p>}<p>This operation is atomic: it either completes fully or rolls back.</p></div> }
function SuccessPanel({ event, state, verificationError }: { event: Event | null; state: Extract<ProductionState, { status: 'commit-success' }>; verificationError: string | null }) { return <section role="status" aria-live="polite"><h2>Participant import complete</h2><p>Committed to {event?.name ?? 'the selected Event'}.</p><p>Inserted: {state.result.insertedCount} · Removed/replaced: {state.result.removedCount} · Unchanged: {state.result.unchangedCount}</p><p>Completed: {state.result.completedAt} · Operation: {state.result.operationId}</p>{verificationError ? <p role="alert">{verificationError}</p> : <><p>Persisted Participants: {state.totalPersisted}</p><ul>{state.records.map((record) => <li key={record.id}><code>{record.ticketNumber}</code>{record.name ? ` · ${record.name}` : ''}</li>)}</ul>{state.totalPersisted > state.records.length ? <p>Verification list truncated to {state.records.length} records.</p> : null}</>}</section> }
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB` }
