import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { commitParticipantImport, PARTICIPANT_IMPORT_FIELDS, preventDuplicateSourceMappings, readParticipantImportFile, parseParticipantImportAsync, suggestColumnMappings } from '../../../application/participant-import/index.ts'
import { parseParticipantImport } from '../../../application/participant-import/participant-import-parser.ts'
import { validateParticipantImport } from '../../../application/participant-import/participant-import-staging.ts'
import type { ColumnMapping, ImportStrategy, ParticipantImportValidationResult, XlsxParsedFile } from '../../../application/participant-import/index.ts'
import type { Event } from '../../../domain/events/event.types.ts'
import { ConfirmationDialog } from '../../../shared/ui/ConfirmationDialog.tsx'
import { Modal } from '../../../shared/ui/Modal.tsx'
import { Badge, Button, Card, Icon, Pagination, Select, Table, TableHeader } from '../../../shared/ui/index.ts'
import { ProgressStepper, type ProgressStep } from '../../../shared/components/ProgressStepper.tsx'
import { StatusBanner } from '../../../shared/components/StatusBanner.tsx'
import { createParticipantImportProductionServices } from '../../../application/participant-import/participant-import-production-services.ts'
import type { ParticipantImportProductionServices } from '../../../application/participant-import/participant-import-production-services.ts'
import type { PersistedParticipantPreview } from '../../../application/participant-import/participant-import-verification.ts'
import type { EventId } from '../../../domain/shared/identifiers.ts'
import { signalProductionWorkspaceChanged } from '../../../app/workspace/ProductionWorkspaceContext.tsx'
import { ProductionSetupRequired } from '../../../shared/components/ProductionWorkspaceState.tsx'

export const MAX_ISSUE_ROWS_SHOWN = 20
export const MAX_PREVIEW_ROWS = 20

const productionImportProgressSteps = [
  { id: 'upload', label: 'Upload File' },
  { id: 'mapping', label: 'Map Columns' },
  { id: 'validation', label: 'Validate Data' },
  { id: 'summary', label: 'Confirm Import' },
] as const satisfies readonly ProgressStep[]

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
  | { readonly status: 'commit-success'; readonly staged: StagedImport; readonly strategy: ImportStrategy; readonly result: Extract<Awaited<ReturnType<typeof commitParticipantImport>>, { ok: true }> }
  | { readonly status: 'commit-failure'; readonly staged: StagedImport; readonly strategy: ImportStrategy; readonly message: string }

type VerificationState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly result: PersistedParticipantPreview }
  | { readonly status: 'failure'; readonly message: string }
  | { readonly status: 'empty' }

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
  const services = servicesRef.current ?? providedServices ?? createParticipantImportProductionServices()
  const inputRef = useRef<HTMLInputElement>(null)
  const readVersion = useRef(0)
  const [state, setState] = useState<ProductionState>({ status: 'idle' })
  const [event, setEvent] = useState<Event | null>(null)
  const [eventError, setEventError] = useState<string | null>(null)
  const [mutationLockReason, setMutationLockReason] = useState<string | null>(null)
  const [eventLoading, setEventLoading] = useState(true)
  const [currentParticipantCount, setCurrentParticipantCount] = useState<number | null>(null)
  const [fileInfo, setFileInfo] = useState<{ name: string; type: string; size: number } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [replaceAcknowledged, setReplaceAcknowledged] = useState(false)
  const [verification, setVerification] = useState<VerificationState>({ status: 'loading' })
  const xlsxBuffer = useRef<ArrayBuffer | null>(null)
  const xlsxSource = useRef<Parameters<typeof parseParticipantImportAsync>[1] | null>(null)
  const commitInFlight = useRef(false)
  const eventReadVersion = useRef(0)
  const eventRef = useRef<Event | null>(null)

  const resetStagedImport = useCallback(() => {
    ++readVersion.current
    setState({ status: 'idle' })
    setFileInfo(null)
    xlsxBuffer.current = null
    xlsxSource.current = null
    setConfirmOpen(false)
    setReplaceAcknowledged(false)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const loadPersistedVerification = useCallback(async (eventId: EventId) => {
    const version = ++eventReadVersion.current
    setVerification({ status: 'loading' })
    try {
      const result = await services.getPersistedParticipantsForEvent(eventId)
      if (version !== eventReadVersion.current) return
      setCurrentParticipantCount(result.totalCount)
      setVerification(result.totalCount === 0 ? { status: 'empty' } : { status: 'ready', result })
    } catch {
      if (version === eventReadVersion.current) setVerification({ status: 'failure', message: 'Persisted Participants could not be read safely. Reload this page to retry.' })
    }
  }, [services])

  useEffect(() => {
    let active = true
    const loadActiveEvent = async () => {
      try {
        await services.database.openSupported()
        const activeId = await services.preferences.get('activeEventId')
        const previousEventId = eventRef.current?.id ?? null
        if (activeId !== previousEventId) resetStagedImport()
        if (activeId === null) {
          if (active) {
            eventRef.current = null
            setEvent(null)
            setMutationLockReason(null)
            setCurrentParticipantCount(null)
            setVerification({ status: 'empty' })
            setEventError('No current Event is selected. Select a real Event before importing participants.')
          }
          return
        }
        const current = await services.events.findById(activeId)
        if (current?.id !== previousEventId) resetStagedImport()
        if (active) {
          eventRef.current = current
          setEvent(current)
          setEventError(current === null ? 'The current Event could not be found. No import target is available.' : null)
          if (current !== null && services.sessions !== undefined) {
            const sessions = await services.sessions.findByEventId(current.id)
            const lockedSession = sessions.find((session) => session.mode === 'live' && (session.status === 'drawing' || session.status === 'pending-confirmation'))
            setMutationLockReason(lockedSession === undefined ? null : `Participant import is unavailable while Live DrawSession ${lockedSession.id} is ${lockedSession.status}. Resolve or complete that session before importing.`)
          } else setMutationLockReason(null)
        }
        if (current !== null) await loadPersistedVerification(current.id)
        else if (active) {
          setCurrentParticipantCount(null)
          setVerification({ status: 'empty' })
        }
      } catch {
        if (active) {
          setEventError('Local persistence is unavailable. Participant import is blocked until an Event can be resolved.')
          setMutationLockReason(null)
          setVerification({ status: 'failure', message: 'Persisted Participants could not be read safely. Reload this page to retry.' })
        }
      } finally { if (active) setEventLoading(false) }
    }
    void loadActiveEvent()
    const onFocus = () => { void loadActiveEvent() }
    const onWorkspaceChanged = () => { void loadActiveEvent() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('raffle-os:workspace-changed', onWorkspaceChanged)
    return () => { active = false; window.removeEventListener('focus', onFocus); window.removeEventListener('raffle-os:workspace-changed', onWorkspaceChanged) }
  }, [loadPersistedVerification, resetStagedImport, services])

  async function selectFile(file: File | undefined) {
    if (!file) return
    const version = ++readVersion.current
    setFileInfo({ name: file.name, type: file.type || 'MIME type unavailable', size: file.size })
    setState({ status: 'reading', fileName: file.name }); setConfirmOpen(false); setReplaceAcknowledged(false)
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
    await loadPersistedVerification(eventId)
    setState({ status: 'commit-success', staged, strategy, result })
    signalProductionWorkspaceChanged()
    commitInFlight.current = false
  }

  const staged = 'staged' in state ? state.staged : null
  const strategy = 'strategy' in state ? state.strategy : null
  const mutable = event?.status === 'draft'
  const blocked = eventLoading || eventError !== null || mutationLockReason !== null || event === null || !mutable
  const hasBlockingParserDiagnostics = staged?.parsed.format === 'xlsx' && staged.parsed.diagnostics.length > 0
  const hasBlockingCellDiagnostics = staged?.validation.rows.some((row) => row.issues.some((issue) => issue.code === 'formula-cell' || issue.code === 'numeric-ticket-ambiguous' || issue.code === 'date-cell' || issue.code === 'boolean-cell' || issue.code === 'error-cell' || issue.code === 'rich-text-cell' || issue.code === 'unsupported-cell' || issue.code === 'merged-cell')) ?? false
  const hasBlockingDiagnostics = hasBlockingParserDiagnostics || hasBlockingCellDiagnostics
  const ready = staged !== null && staged.validation.summary.validRows > 0 && staged.validation.summary.totalRows === staged.validation.summary.validRows + staged.validation.summary.invalidRows && !hasBlockingDiagnostics && strategy !== null && !blocked
  const showPreparation = state.status !== 'commit-success'
  const progressStep = state.status === 'idle' || state.status === 'reading' || state.status === 'unsupported' || state.status === 'parse-error'
    ? 'upload'
    : state.status === 'mapping'
      ? 'mapping'
      : state.status === 'validation-ready' || state.status === 'commit-failure' || staged === null || staged.validation.summary.validRows === 0 || hasBlockingDiagnostics || strategy === null
        ? 'validation'
        : 'summary'
  if (!eventLoading && event === null && (eventError?.includes('No current Event') === true || eventError?.includes('current Event could not be found') === true)) return <section className="participant-import production-import-preview" aria-labelledby="production-import-title"><header className="page-header production-import-preview__header"><div className="page-header__copy"><p className="page-header__eyebrow">Participant Operations</p><h1 id="production-import-title">Participant Import</h1><p className="page-header__description">Import Participants into the current Event.</p></div></header><ProductionSetupRequired title="Event required for participant import" description="Select or create an Event before importing participants." /></section>
  return <section className="participant-import production-import-preview" aria-label="Participant file import" data-workflow-state={state.status}>
    <header className="page-header production-import-preview__header"><div className="page-header__copy"><p className="page-header__eyebrow">Participant Operations</p><div className="production-import-preview__title-row"><h1 id="production-import-title">Participant Import</h1></div><p className="page-header__description">Stage, validate, and atomically import Participants into the current Event.</p></div></header>
    <ProgressStepper currentStep={progressStep} steps={productionImportProgressSteps} completed={state.status === 'commit-success'} />
    {showPreparation ? <div className="production-import-preview__workspace" aria-label="Validation workspace">
      <div className="production-import-preview__main">
        {showPreparation ? <>
        <EventPanel event={event} loading={eventLoading} error={eventError ?? mutationLockReason} />
        <UploadPanel inputRef={inputRef} fileInfo={fileInfo} committing={state.status === 'committing'} onFile={(file) => { if (inputRef.current) inputRef.current.value = ''; void selectFile(file) }} onRemove={clearFile} />
        {state.status === 'reading' || state.status === 'committing' ? <p className="production-import-preview__progress" role="status" aria-live="polite">{state.status === 'reading' ? `Reading ${state.fileName}…` : 'Committing atomic Participant import…'}</p> : null}
        {state.status === 'unsupported' || state.status === 'parse-error' || state.status === 'commit-failure' ? <div role="alert"><StatusBanner badge="Action needed" title={state.status === 'commit-failure' ? 'Import failed safely' : state.status === 'unsupported' ? 'Unsupported file' : 'File could not be parsed'} tone="warning">{state.message}</StatusBanner>{state.status === 'commit-failure' ? <Button icon={<Icon name="RefreshCw" />} variant="secondary" onClick={() => setState({ status: 'validation-ready', staged: state.staged, strategy: state.strategy })}>Retry review</Button> : null}</div> : null}
        {staged ? <><MappingAndPreview staged={staged} disabled={state.status === 'committing' || state.status === 'confirmation'} onMappingChange={changeMapping} onWorksheetChange={(name) => { const buffer = xlsxBuffer.current; const source = xlsxSource.current; if (!buffer || !source) return; void parseParticipantImportAsync(buffer, { ...source, worksheet: { kind: 'named', name } }).then((parsed) => { if (parsed.ok) stage(parsed.parsed, suggestColumnMappings(parsed.parsed.headers), { ...staged.source, sheetName: name }, staged.fileName); else setState({ status: 'parse-error', message: parsed.diagnostics[0]?.message ?? 'Worksheet could not be parsed.' }) }) }} /><PaginatedPreviewTable parsed={staged.parsed} /></> : null}
        </> : null}
      </div>
      <aside className="production-import-preview__side">
        <PersistedParticipantSection event={event} verification={verification} />
        {showPreparation && staged ? <><ValidationPanel validation={staged.validation} /><div className="production-import-preview__final-workflow"><StrategyPanel strategy={strategy} disabled={state.status === 'committing' || state.status === 'confirmation' || !mutable} onChoose={chooseStrategy} /><Card className="production-import-preview__action-card" padding="md"><div><p className="production-import-preview__action-kicker">Ready when you are</p><h2>Confirm the import</h2><p>Review the validated batch and selected strategy before opening the final confirmation.</p></div><Button icon={<Icon name="ClipboardCheck" />} disabled={!ready || state.status === 'committing' || state.status === 'confirmation'} isLoading={state.status === 'committing'} onClick={() => { if ('staged' in state && state.strategy) { setState({ status: 'confirmation', staged: state.staged, strategy: state.strategy }); setConfirmOpen(true) } }}>Review and confirm import</Button></Card></div></> : null}
      </aside>
    </div> : <div className="production-import-preview__success-layout" aria-label="Participant import completed">
      {state.status === 'commit-success' ? <div className="production-import-preview__success-state"><SuccessPanel event={event} state={state} /><Button icon={<Icon name="Upload" />} variant="secondary" size="sm" onClick={resetStagedImport}>Import Another File</Button></div> : null}
      <PersistedParticipantSection event={event} verification={verification} />
    </div>}
    <ConfirmationDialog cancelIcon={<Icon name="X" />} confirmIcon={<Icon name="CircleCheck" />} open={confirmOpen && strategy === 'merge'} title="Confirm Merge import" confirmLabel="Confirm atomic Merge" consequence={<ConfirmationContents event={event} staged={staged} strategy="merge" currentParticipantCount={currentParticipantCount} />} onCancel={() => { setConfirmOpen(false); if ('staged' in state && state.strategy) setState({ status: 'strategy-selection', staged: state.staged, strategy: state.strategy }) }} onConfirm={() => void commit()} />
    <Modal open={confirmOpen && strategy === 'replace'} title="Confirm Replace import" onClose={() => { setConfirmOpen(false); if ('staged' in state && state.strategy) setState({ status: 'strategy-selection', staged: state.staged, strategy: state.strategy }) }} footer={<><button type="button" onClick={() => setConfirmOpen(false)}><Icon name="X" />Cancel</button><button type="button" disabled={!replaceAcknowledged} onClick={() => void commit()}><Icon name="CircleCheck" />Confirm Replace</button></>}><ConfirmationContents event={event} staged={staged} strategy="replace" currentParticipantCount={currentParticipantCount} /><label><input type="checkbox" checked={replaceAcknowledged} onChange={(e) => setReplaceAcknowledged(e.target.checked)} /> I understand that current Participants in this Event will be removed and replaced atomically.</label></Modal>
  </section>
}

function EventPanel({ event, loading, error }: { event: Event | null; loading: boolean; error: string | null }) { return <Card className="production-import-preview__summary-card" aria-labelledby="selected-event-title"><div className="production-import-preview__card-heading"><div><p className="production-import-preview__card-kicker">Import target</p><h2 id="selected-event-title">Selected Event</h2></div>{event ? <Badge variant={event.status === 'draft' ? 'success' : 'danger'}>{event.status}</Badge> : <Badge variant="warning">Blocked</Badge>}</div>{loading ? <p role="status">Resolving the current Event…</p> : error ? <p role="alert">{error}</p> : event ? <><p className="production-import-preview__event-name">{event.name}</p><p className="production-import-preview__mutability">{event.status !== 'draft' ? 'This Event does not permit participant import because it is immutable.' : 'Draft Event · mutable import target.'}</p></> : null}</Card> }

function UploadPanel({ inputRef, fileInfo, committing, onFile, onRemove }: { inputRef: RefObject<HTMLInputElement | null>; fileInfo: { name: string; type: string; size: number } | null; committing: boolean; onFile: (file: File | undefined) => void; onRemove: () => void }) { return <Card className="production-import-preview__upload" aria-labelledby="upload-title"><div className="production-import-preview__card-heading"><div><p className="production-import-preview__card-kicker">Step 1</p><h2 id="upload-title">Upload participant file</h2></div><div className="production-import-preview__badges"><Badge variant="info">CSV</Badge><Badge variant="info">XLSX</Badge></div></div><div className="production-import-preview__file-picker"><span className={`production-import-preview__file-name${fileInfo ? '' : ' is-empty'}`} title={fileInfo?.name}>{fileInfo?.name ?? 'No file selected'}</span><input aria-label="Participant file" ref={inputRef} id="participant-file" className="production-import-preview__file-input" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={committing} onChange={(e) => onFile(e.currentTarget.files?.[0])} /><Button icon={<Icon name="FolderOpen" />} variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={committing}>Browse</Button></div><p className="production-import-preview__hint">CSV or XLSX · keep files under 10 MB for a smooth preview.</p>{fileInfo ? <div className="production-import-preview__file-meta" role="status"><div><strong>{fileInfo.name}</strong><span>{fileInfo.type} · {formatBytes(fileInfo.size)}</span></div><Button icon={<Icon name="FileX" />} variant="quiet" size="sm" onClick={onRemove} disabled={committing}>Remove file</Button></div> : null}</Card> }

function MappingAndPreview({ staged, disabled, onMappingChange, onWorksheetChange }: { staged: StagedImport; disabled: boolean; onMappingChange: (field: ColumnMapping['targetField'], value: string | null) => void; onWorksheetChange: (name: string) => void }) { const xlsx = staged.parsed.format === 'xlsx' ? staged.parsed : null; return <Card className="production-import-preview__mapping" aria-labelledby="mapping-title"><div className="production-import-preview__card-heading"><div><p className="production-import-preview__card-kicker">Step 2</p><h2 id="mapping-title">Map source columns</h2></div></div><p className="production-import-preview__hint">Map each source column to a Participant field. Mapping changes clear prior confirmation and success.</p><div className="production-import-preview__mapping-grid">{PARTICIPANT_IMPORT_FIELDS.map((field) => { const mapping = staged.mappings.find((item) => item.targetField === field.field); return <Select key={field.field} id={`mapping-${field.field}`} label={`${field.label} · ${field.requirement === 'required' ? 'Required' : 'Optional'}`} description={field.field === 'ticketNumber' ? 'Ticket values remain exact strings.' : undefined} disabled={disabled} value={mapping?.sourceColumn ?? ''} onChange={(e) => onMappingChange(field.field, e.target.value || null)}><option value="">Not mapped</option>{staged.parsed.headers.filter(Boolean).map((header) => <option key={header} value={header}>{header}</option>)}</Select> })}{xlsx && xlsx.worksheets.filter((sheet) => sheet.visibility === 'visible').length > 1 ? <Select id="xlsx-worksheet" label="Worksheet" disabled={disabled} value={xlsx.sheetName} onChange={(e) => onWorksheetChange(e.target.value)}>{xlsx.worksheets.filter((sheet) => sheet.visibility === 'visible').map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name}</option>)}</Select> : null}</div></Card> }

function PaginatedPreviewTable({ parsed }: { parsed: ParsedImportFile }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const totalPages = Math.max(1, Math.ceil(parsed.rows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const rows = parsed.rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  return <Card className="production-import-preview__table-card" aria-labelledby="raw-preview-title"><div className="production-import-preview__card-heading"><div><p className="production-import-preview__card-kicker">Source data</p><h2 id="raw-preview-title">Raw-row preview</h2><p className="production-import-preview__hint">{parsed.rows.length} rows. Values are displayed exactly as read.</p></div></div><Table caption="Parsed participant rows"><thead><tr><TableHeader>Source row</TableHeader>{parsed.headers.map((header) => <TableHeader key={header}>{header}</TableHeader>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.rowNumber}><th scope="row">{row.rowNumber}</th>{parsed.headers.map((header) => <td key={header} className={header.toLowerCase().includes('ticket') ? 'production-import-preview__ticket' : undefined}>{typeof row.values[header] === 'string' ? row.values[header] : String(row.values[header] ?? '')}</td>)}</tr>)}</tbody></Table><Pagination label="Raw-row pagination" page={safePage} pageSize={pageSize} totalItems={parsed.rows.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} /></Card>
}
export function PreviewTable({ parsed }: { parsed: ParsedImportFile }) { const rows = parsed.rows.slice(0, MAX_PREVIEW_ROWS); return <Card className="production-import-preview__table-card" aria-labelledby="raw-preview-title"><div className="production-import-preview__card-heading"><div><p className="production-import-preview__card-kicker">Source data</p><h2 id="raw-preview-title">Raw-row preview</h2><p className="production-import-preview__hint">Showing {rows.length} of {parsed.rows.length} rows. Values are displayed exactly as read.</p></div></div>{rows.length < parsed.rows.length ? <p className="production-import-preview__truncation">Preview truncated to {MAX_PREVIEW_ROWS} rows.</p> : null}<Table caption="Parsed participant rows"><thead><tr><TableHeader>Source row</TableHeader>{parsed.headers.map((header) => <TableHeader key={header}>{header}</TableHeader>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.rowNumber}><th scope="row">{row.rowNumber}</th>{parsed.headers.map((header) => <td key={header} className={header.toLowerCase().includes('ticket') ? 'production-import-preview__ticket' : undefined}>{typeof row.values[header] === 'string' ? row.values[header] : String(row.values[header] ?? '')}</td>)}</tr>)}</tbody></Table></Card> }
function ValidationPanel({ validation }: { validation: ParticipantImportValidationResult }) { const issues = validation.rows.flatMap((row) => row.issues).slice(0, MAX_ISSUE_ROWS_SHOWN); return <Card className="production-import-preview__validation" aria-labelledby="validation-title"><div className="production-import-preview__card-heading"><div><p className="production-import-preview__card-kicker">Step 3</p><h2 id="validation-title">Validation diagnostics and summary</h2></div><Badge variant={validation.summary.invalidRows === 0 ? 'success' : 'warning'}>{validation.summary.invalidRows === 0 ? 'Ready' : 'Review issues'}</Badge></div><div className="production-import-preview__metrics" aria-label="Validation metrics"><Metric label="Total rows" value={validation.summary.totalRows} /><Metric label="Valid drafts" value={validation.summary.validRows} /><Metric label="Invalid rows" value={validation.summary.invalidRows} /><Metric label="Duplicates" value={validation.summary.duplicateRows} /><Metric label="Blocking issues" value={validation.summary.issueCount} /></div><p className="production-import-preview__metric-summary">Total rows: {validation.summary.totalRows} · Valid drafts: {validation.summary.validRows} · Invalid rows: {validation.summary.invalidRows} · Duplicate rows: {validation.summary.duplicateRows}</p><div className="production-import-preview__issue-list"><p>Row diagnostics</p><Table caption="Validation by source row"><thead><tr><TableHeader>Row</TableHeader><TableHeader>Ticket Number</TableHeader><TableHeader>Result</TableHeader></tr></thead><tbody>{validation.rows.slice(0, MAX_PREVIEW_ROWS).map((row) => <tr key={row.normalized.rowNumber}><th scope="row">{row.normalized.rowNumber}</th><td className="production-import-preview__ticket">{row.normalized.ticketNumber ?? '—'}</td><td>{row.participantDraft ? 'Valid draft' : 'Invalid — not sent to persistence'}</td></tr>)}</tbody></Table>{issues.length > 0 ? <ul>{issues.map((issue) => <li key={`${issue.rowNumber}-${issue.code}`}>Row {issue.rowNumber}: {issue.message}</li>)}</ul> : <p>No row issues found.</p>}{validation.summary.issueCount > MAX_ISSUE_ROWS_SHOWN ? <p>Only the first {MAX_ISSUE_ROWS_SHOWN} issues are displayed.</p> : null}</div><p className="production-import-preview__safe-note">No Participant data has been saved yet.</p></Card> }
function Metric({ label, value }: { label: string; value: number }) { return <div><span>{label}</span><strong>{value}</strong></div> }
function StrategyPanel({ strategy, disabled, onChoose }: { strategy: ImportStrategy | null; disabled: boolean; onChoose: (strategy: ImportStrategy) => void }) { return <Card className="production-import-preview__strategy" aria-labelledby="strategy-title"><fieldset disabled={disabled}><legend id="strategy-title">Step 4 · Import strategy</legend><p className="production-import-preview__hint">Choose one strategy. Nothing is selected automatically.</p><label className={`production-import-preview__strategy-option production-import-preview__strategy-option--replace${strategy === 'replace' ? ' is-selected' : ''}`}><input aria-label="Replace" type="radio" name="import-strategy" checked={strategy === 'replace'} onChange={() => onChoose('replace')} /><span><strong>Replace</strong><small>Remove current Participants for this Event, then insert the validated batch.</small><small>Atomic rollback on failure; existing records are replaced.</small></span></label><label className={`production-import-preview__strategy-option production-import-preview__strategy-option--merge${strategy === 'merge' ? ' is-selected' : ''}`}><input aria-label="Merge" type="radio" name="import-strategy" checked={strategy === 'merge'} onChange={() => onChoose('merge')} /><span><strong>Merge</strong><small>Preserve existing Participants and insert the non-conflicting batch.</small><small>Exact ticket conflicts reject the complete operation atomically.</small></span></label></fieldset></Card> }
function ConfirmationContents({ event, staged, strategy, currentParticipantCount }: { event: Event | null; staged: StagedImport | null; strategy: ImportStrategy; currentParticipantCount: number | null }) { const summary = staged?.validation.summary; return <div><p>Event: <strong>{event?.name ?? 'Unavailable'}</strong> · status: {event?.status ?? 'unknown'}</p><p>Source: {staged?.fileName} · {staged?.parsed.format.toUpperCase()}{staged?.worksheet ? ` · worksheet ${staged.worksheet}` : ''}</p><p>Strategy: {strategy} · valid drafts: {summary?.validRows ?? 0} · invalid rows: {summary?.invalidRows ?? 0} · duplicates: {summary?.duplicateRows ?? 0}</p><p>Current Participants: {currentParticipantCount === null ? 'unavailable' : currentParticipantCount} · expected inserted: {summary?.validRows ?? 0}</p>{strategy === 'replace' ? <p><strong>Replace removes the current Participants for this Event.</strong></p> : <p>Merge preserves existing records; any exact ticket conflict rejects the complete operation.</p>}<p>This operation is atomic: it either completes fully or rolls back.</p></div> }
function PersistedParticipantSection({ event, verification }: { event: Event | null; verification: VerificationState }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const totalCount = verification.status === 'ready' ? verification.result.totalCount : 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(page, totalPages)
  const records = verification.status === 'ready' ? verification.result.records : []
  const visibleRecords = records.slice((safePage - 1) * pageSize, safePage * pageSize)
  const checkedInCount = verification.status === 'ready'
    ? records.filter((record) => record.isCheckedIn).length
    : null
  return <Card className="production-import-preview__summary-card" aria-labelledby="persisted-participants-title">
    <h2 id="persisted-participants-title">Persisted Participants</h2>
    <p>Event: <strong>{event?.name ?? 'No Event selected'}</strong></p>
    {verification.status === 'loading' ? <p role="status">Reading persisted Participants…</p> : null}
    {verification.status === 'failure' ? <p role="alert">{verification.message}</p> : null}
    {verification.status === 'empty' ? <p>No Participants are persisted for this Event.</p> : null}
    {verification.status === 'ready' ? <>
      <p>Total stored Participants: {verification.result.totalCount}</p>
      <p>{verification.result.totalCount} participants · {checkedInCount} checked in</p>
      <Table caption="Persisted Participants"><thead><tr><TableHeader>Ticket Number</TableHeader><TableHeader>Name</TableHeader><TableHeader>Group</TableHeader><TableHeader>Check-in</TableHeader></tr></thead><tbody>{visibleRecords.map((record) => <tr key={record.id}><th scope="row" className="production-import-preview__ticket"><code>{record.ticketNumber}</code></th><td>{record.name ?? '—'}</td><td>{record.group ?? '—'}</td><td>{record.isCheckedIn ? 'Checked in' : 'Not checked in'}</td></tr>)}</tbody></Table>
      <Pagination label="Persisted participant pagination" page={safePage} pageSize={pageSize} totalItems={totalCount} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
    </> : null}
  </Card>
}

function SuccessPanel({ event, state }: { event: Event | null; state: Extract<ProductionState, { status: 'commit-success' }> }) { return <Card className="production-import-preview__success" role="status" aria-live="polite"><StatusBanner badge="Complete" title="Participant import complete" tone="success">Committed to {event?.name ?? 'the selected Event'} using {state.strategy}.</StatusBanner><div className="production-import-preview__success-metrics"><Metric label="Inserted" value={state.result.insertedCount} /><Metric label="Removed / replaced" value={state.result.removedCount} /><Metric label="Unchanged" value={state.result.unchangedCount} /></div><p className="production-import-preview__metric-summary">Inserted: {state.result.insertedCount} · Removed/replaced: {state.result.removedCount} · Unchanged: {state.result.unchangedCount}</p><p>Completed: {state.result.completedAt} · Operation: {state.result.operationId}</p><Button icon={<Icon name="CircleCheck" />} onClick={() => window.location.reload()}>Start New Import</Button></Card> }
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB` }
