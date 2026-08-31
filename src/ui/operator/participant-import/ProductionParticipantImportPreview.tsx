import { useUiClass } from '../../../shared/ui/ui-theme.ts'
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
import { formatProductionNumber, productionDomainLabel } from '../../../shared/localization/production-locale.ts'

export const MAX_ISSUE_ROWS_SHOWN = 20
export const MAX_PREVIEW_ROWS = 20

const productionImportProgressSteps = [
  { id: 'upload', label: 'Unggah File' },
  { id: 'mapping', label: 'Petakan Kolom' },
  { id: 'validation', label: 'Validasi Data' },
  { id: 'summary', label: 'Konfirmasi Impor' },
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
  'invalid-command': 'Impor yang disiapkan belum lengkap atau tidak didukung. Tinjau file dan pemetaan sebelum mencoba lagi.',
  'event-not-found': 'Acara yang dipilih tidak ditemukan. Pilih Acara sebelum mengimpor.',
  'event-not-mutable': 'Acara ini tidak dapat diubah. Impor Peserta hanya tersedia untuk Acara draf yang belum direferensikan.',
  'existing-ticket-conflict': 'Impor ditolak karena Nomor Tiket sudah ada dalam Acara ini. Tidak ada record yang berubah.',
  'persistence-unavailable': 'Penyimpanan lokal tidak tersedia. Impor yang disiapkan tetap tersedia untuk dicoba lagi.',
  'quota-storage-failure': 'Penyimpanan browser penuh. Impor dibatalkan dan tidak ada record yang berubah.',
  'transaction-failed': 'Transaksi impor gagal dan dibatalkan. Tidak ada keberhasilan parsial.',
  'relationship-violation': 'Impor memuat relasi Acara yang tidak valid. Tidak ada record yang berubah.',
  'uniqueness-violation': 'Impor melanggar batas keunikan record. Tidak ada record yang berubah.',
  'summary-mismatch': 'Ringkasan impor tidak lagi sesuai dengan baris yang divalidasi. Tinjau kembali data yang disiapkan.',
  'empty-import': 'Setidaknya satu draf Peserta valid diperlukan sebelum mengimpor.',
}

export function ProductionParticipantImportPreview({ services: providedServices }: ProductionParticipantImportPreviewProps = {}) {
  const ui = useUiClass()
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
      if (version === eventReadVersion.current) setVerification({ status: 'failure', message: 'Peserta tersimpan tidak dapat dibaca dengan aman. Muat ulang halaman untuk mencoba lagi.' })
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
            setEventError('Tidak ada Acara aktif yang dipilih. Pilih Acara sebelum mengimpor Peserta.')
          }
          return
        }
        const current = await services.events.findById(activeId)
        if (current?.id !== previousEventId) resetStagedImport()
        if (active) {
          eventRef.current = current
          setEvent(current)
          setEventError(current === null ? 'Acara aktif tidak dapat ditemukan. Tidak ada target impor yang tersedia.' : null)
          if (current !== null && services.sessions !== undefined) {
            const sessions = await services.sessions.findByEventId(current.id)
            const lockedSession = sessions.find((session) => session.mode === 'live' && (session.status === 'drawing' || session.status === 'pending-confirmation'))
            setMutationLockReason(lockedSession === undefined ? null : `Impor Peserta tidak tersedia selama sesi Undian ${lockedSession.id} berstatus ${productionDomainLabel(lockedSession.status)}. Selesaikan sesi tersebut sebelum mengimpor.`)
          } else setMutationLockReason(null)
        }
        if (current !== null) await loadPersistedVerification(current.id)
        else if (active) {
          setCurrentParticipantCount(null)
          setVerification({ status: 'empty' })
        }
      } catch {
        if (active) {
          setEventError('Penyimpanan lokal tidak tersedia. Impor Peserta diblokir sampai Acara dapat ditemukan.')
          setMutationLockReason(null)
          setVerification({ status: 'failure', message: 'Peserta tersimpan tidak dapat dibaca dengan aman. Muat ulang halaman untuk mencoba lagi.' })
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
    setFileInfo({ name: file.name, type: file.type || 'Tipe MIME tidak tersedia', size: file.size })
    setState({ status: 'reading', fileName: file.name }); setConfirmOpen(false); setReplaceAcknowledged(false)
    const result = await readParticipantImportFile(file)
    if (version !== readVersion.current) return
    if (!result.ok) { setState({ status: result.code === 'unsupported-format' ? 'unsupported' : 'parse-error', message: result.message }); return }
    if (result.arrayBuffer) {
      xlsxBuffer.current = result.arrayBuffer; xlsxSource.current = { metadata: result.metadata, mappings: [], strategy: 'replace' }
      const parsed = await parseParticipantImportAsync(result.arrayBuffer, xlsxSource.current)
      if (version !== readVersion.current) return
      if (!parsed.ok) { setState({ status: 'parse-error', message: parsed.diagnostics[0]?.message ?? 'File XLSX tidak dapat dibaca.' }); return }
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
    if (!result.ok) { commitInFlight.current = false; setState({ status: 'commit-failure', staged, strategy, message: FRIENDLY_ERRORS[result.code] ?? 'Impor gagal dengan aman. Tidak ada record yang berubah.' }); return }
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
  if (!eventLoading && event === null && (eventError?.includes('Tidak ada Acara aktif') === true || eventError?.includes('Acara aktif tidak dapat ditemukan') === true)) return <section className="participant-import production-import-preview" aria-labelledby="production-import-title"><header className={`${ui('page-header')} production-import-preview__header`}><div className={ui('page-header__copy')}><p className={ui('page-header__eyebrow')}>Operasi Peserta</p><h1 id="production-import-title">Impor Peserta</h1><p className={ui('page-header__description')}>Impor Peserta ke Acara aktif.</p></div></header><ProductionSetupRequired title="Acara diperlukan untuk impor Peserta" description="Pilih atau buat Acara sebelum mengimpor Peserta." /></section>
  return <section className="participant-import production-import-preview" aria-label="Impor file Peserta" data-workflow-state={state.status}>
    <header className={`${ui('page-header')} production-import-preview__header`}><div className={ui('page-header__copy')}><p className={ui('page-header__eyebrow')}>Operasi Peserta</p><div className="production-import-preview__title-row"><h1 id="production-import-title">Impor Peserta</h1></div><p className={ui('page-header__description')}>Siapkan, validasi, dan impor Peserta secara atomik ke Acara aktif.</p></div></header>
    <ProgressStepper currentStep={progressStep} steps={productionImportProgressSteps} completed={state.status === 'commit-success'} locale="id" />
    {showPreparation ? <div className="production-import-preview__workspace" aria-label="Ruang kerja validasi">
      <div className="production-import-preview__main">
        {showPreparation ? <>
        <EventPanel event={event} loading={eventLoading} error={eventError ?? mutationLockReason} />
        <UploadPanel inputRef={inputRef} fileInfo={fileInfo} committing={state.status === 'committing'} onFile={(file) => { if (inputRef.current) inputRef.current.value = ''; void selectFile(file) }} onRemove={clearFile} />
        {state.status === 'reading' || state.status === 'committing' ? <p className="production-import-preview__progress" role="status" aria-live="polite">{state.status === 'reading' ? `Membaca ${state.fileName}…` : 'Menyimpan impor Peserta secara atomik…'}</p> : null}
        {state.status === 'unsupported' || state.status === 'parse-error' || state.status === 'commit-failure' ? <div role="alert"><StatusBanner badge="Perlu tindakan" title={state.status === 'commit-failure' ? 'Impor gagal dengan aman' : state.status === 'unsupported' ? 'File tidak didukung' : 'File tidak dapat dibaca'} tone="warning">{state.message}</StatusBanner>{state.status === 'commit-failure' ? <Button icon={<Icon name="RefreshCw" />} variant="secondary" onClick={() => setState({ status: 'validation-ready', staged: state.staged, strategy: state.strategy })}>Tinjau ulang</Button> : null}</div> : null}
        {staged ? <><MappingAndPreview staged={staged} disabled={state.status === 'committing' || state.status === 'confirmation'} onMappingChange={changeMapping} onWorksheetChange={(name) => { const buffer = xlsxBuffer.current; const source = xlsxSource.current; if (!buffer || !source) return; void parseParticipantImportAsync(buffer, { ...source, worksheet: { kind: 'named', name } }).then((parsed) => { if (parsed.ok) stage(parsed.parsed, suggestColumnMappings(parsed.parsed.headers), { ...staged.source, sheetName: name }, staged.fileName); else setState({ status: 'parse-error', message: parsed.diagnostics[0]?.message ?? 'Worksheet could not be parsed.' }) }) }} /><PaginatedPreviewTable parsed={staged.parsed} /></> : null}
        </> : null}
      </div>
      <aside className="production-import-preview__side">
        <PersistedParticipantSection event={event} verification={verification} />
        {showPreparation && staged ? <><ValidationPanel validation={staged.validation} /><div className="production-import-preview__final-workflow"><StrategyPanel strategy={strategy} disabled={state.status === 'committing' || state.status === 'confirmation' || !mutable} onChoose={chooseStrategy} /><Card className="production-import-preview__action-card" padding="md"><div><p className="production-import-preview__action-kicker">Siap untuk dilanjutkan</p><h2>Konfirmasi impor</h2><p>Tinjau batch tervalidasi dan strategi yang dipilih sebelum membuka konfirmasi akhir.</p></div><Button icon={<Icon name="ClipboardCheck" />} disabled={!ready || state.status === 'committing' || state.status === 'confirmation'} isLoading={state.status === 'committing'} onClick={() => { if ('staged' in state && state.strategy) { setState({ status: 'confirmation', staged: state.staged, strategy: state.strategy }); setConfirmOpen(true) } }}>Tinjau dan konfirmasi impor</Button></Card></div></> : null}
      </aside>
    </div> : <div className="production-import-preview__success-layout" aria-label="Impor Peserta selesai">
      {state.status === 'commit-success' ? <div className="production-import-preview__success-state"><SuccessPanel event={event} state={state} /><Button icon={<Icon name="Upload" />} variant="secondary" size="sm" onClick={resetStagedImport}>Impor File Lain</Button></div> : null}
      <PersistedParticipantSection event={event} verification={verification} />
    </div>}
    <ConfirmationDialog cancelIcon={<Icon name="X" />} confirmIcon={<Icon name="CircleCheck" />} open={confirmOpen && strategy === 'merge'} title="Konfirmasi impor Gabung" confirmLabel="Konfirmasi Gabung atomik" consequence={<ConfirmationContents event={event} staged={staged} strategy="merge" currentParticipantCount={currentParticipantCount} />} onCancel={() => { setConfirmOpen(false); if ('staged' in state && state.strategy) setState({ status: 'strategy-selection', staged: state.staged, strategy: state.strategy }) }} onConfirm={() => void commit()} />
    <Modal open={confirmOpen && strategy === 'replace'} title="Konfirmasi impor Ganti" onClose={() => { setConfirmOpen(false); if ('staged' in state && state.strategy) setState({ status: 'strategy-selection', staged: state.staged, strategy: state.strategy }) }} footer={<><Button icon={<Icon name="X" />} variant="secondary" onClick={() => setConfirmOpen(false)}>Batal</Button><Button icon={<Icon name="CircleCheck" />} disabled={!replaceAcknowledged} onClick={() => void commit()}>Konfirmasi Ganti</Button></>}><ConfirmationContents event={event} staged={staged} strategy="replace" currentParticipantCount={currentParticipantCount} /><label><input type="checkbox" checked={replaceAcknowledged} onChange={(e) => setReplaceAcknowledged(e.target.checked)} /> Saya memahami bahwa Peserta saat ini dalam Acara akan dihapus dan diganti secara atomik.</label></Modal>
  </section>
}

function EventPanel({ event, loading, error }: { event: Event | null; loading: boolean; error: string | null }) { return <Card className="production-import-preview__summary-card" tone="raised" aria-labelledby="selected-event-title"><div className="production-import-preview__card-heading"><div><p className="production-import-preview__card-kicker">Target impor</p><h2 id="selected-event-title">Acara yang Dipilih</h2></div>{event ? <Badge variant={event.status === 'draft' ? 'success' : 'danger'}>{productionDomainLabel(event.status)}</Badge> : <Badge variant="warning">Diblokir</Badge>}</div>{loading ? <p role="status">Mencari Acara aktif…</p> : error ? <p role="alert">{error}</p> : event ? <><p className="production-import-preview__event-name">{event.name}</p><p className="production-import-preview__mutability">{event.status !== 'draft' ? 'Acara ini tidak mengizinkan impor Peserta karena tidak dapat diubah.' : 'Acara draf · target impor dapat diubah.'}</p></> : null}</Card> }

function UploadPanel({ inputRef, fileInfo, committing, onFile, onRemove }: { inputRef: RefObject<HTMLInputElement | null>; fileInfo: { name: string; type: string; size: number } | null; committing: boolean; onFile: (file: File | undefined) => void; onRemove: () => void }) { return <Card className="production-import-preview__upload" tone="raised" aria-labelledby="upload-title"><div className="production-import-preview__card-heading"><div><p className="production-import-preview__card-kicker">Langkah 1</p><h2 id="upload-title">Unggah file Peserta</h2></div><div className="production-import-preview__badges"><Badge variant="info">CSV</Badge><Badge variant="info">XLSX</Badge></div></div><div className="production-import-preview__file-picker"><span className={`production-import-preview__file-name${fileInfo ? '' : ' is-empty'}`} title={fileInfo?.name}>{fileInfo?.name ?? 'Belum ada file dipilih'}</span><input aria-label="File Peserta" ref={inputRef} id="participant-file" className="production-import-preview__file-input" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={committing} onChange={(e) => onFile(e.currentTarget.files?.[0])} /><Button icon={<Icon name="FolderOpen" />} variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={committing}>Pilih file</Button></div><p className="production-import-preview__hint">CSV atau XLSX · gunakan file di bawah 10 MB agar pratinjau lancar.</p>{fileInfo ? <div className="production-import-preview__file-meta" role="status"><div><strong>{fileInfo.name}</strong><span>{fileInfo.type} · {formatBytes(fileInfo.size)}</span></div><Button icon={<Icon name="FileX" />} variant="quiet" size="sm" onClick={onRemove} disabled={committing}>Hapus file</Button></div> : null}</Card> }

function MappingAndPreview({ staged, disabled, onMappingChange, onWorksheetChange }: { staged: StagedImport; disabled: boolean; onMappingChange: (field: ColumnMapping['targetField'], value: string | null) => void; onWorksheetChange: (name: string) => void }) { const xlsx = staged.parsed.format === 'xlsx' ? staged.parsed : null; return <Card className="production-import-preview__mapping" tone="raised" aria-labelledby="mapping-title"><div className="production-import-preview__card-heading"><div><p className="production-import-preview__card-kicker">Langkah 2</p><h2 id="mapping-title">Petakan kolom sumber</h2></div></div><p className="production-import-preview__hint">Petakan setiap kolom sumber ke field Peserta. Perubahan pemetaan menghapus konfirmasi dan status berhasil sebelumnya.</p><div className="production-import-preview__mapping-grid">{PARTICIPANT_IMPORT_FIELDS.map((field) => { const mapping = staged.mappings.find((item) => item.targetField === field.field); return <Select key={field.field} id={`mapping-${field.field}`} label={`${participantFieldLabel(field.field)} · ${field.requirement === 'required' ? 'Wajib' : 'Opsional'}`} description={field.field === 'ticketNumber' ? 'Nilai tiket tetap berupa string persis.' : undefined} disabled={disabled} value={mapping?.sourceColumn ?? ''} onChange={(e) => onMappingChange(field.field, e.target.value || null)}><option value="">Tidak dipetakan</option>{staged.parsed.headers.filter(Boolean).map((header) => <option key={header} value={header}>{header}</option>)}</Select> })}{xlsx && xlsx.worksheets.filter((sheet) => sheet.visibility === 'visible').length > 1 ? <Select id="xlsx-worksheet" label="Lembar kerja" disabled={disabled} value={xlsx.sheetName} onChange={(e) => onWorksheetChange(e.target.value)}>{xlsx.worksheets.filter((sheet) => sheet.visibility === 'visible').map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name}</option>)}</Select> : null}</div></Card> }

function PaginatedPreviewTable({ parsed }: { parsed: ParsedImportFile }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const totalPages = Math.max(1, Math.ceil(parsed.rows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const rows = parsed.rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  return <Card className="production-import-preview__table-card" tone="raised" aria-labelledby="raw-preview-title"><div className="production-import-preview__card-heading"><div><p className="production-import-preview__card-kicker">Data sumber</p><h2 id="raw-preview-title">Pratinjau baris mentah</h2><p className="production-import-preview__hint">{formatProductionNumber(parsed.rows.length)} baris. Nilai ditampilkan persis seperti saat dibaca.</p></div></div><Table caption="Baris Peserta hasil pembacaan"><thead><tr><TableHeader>Baris sumber</TableHeader>{parsed.headers.map((header) => <TableHeader key={header}>{header}</TableHeader>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.rowNumber}><th scope="row">{row.rowNumber}</th>{parsed.headers.map((header) => <td key={header} className={header.toLowerCase().includes('ticket') ? 'production-import-preview__ticket' : undefined}>{typeof row.values[header] === 'string' ? row.values[header] : String(row.values[header] ?? '')}</td>)}</tr>)}</tbody></Table><Pagination label="Navigasi halaman baris mentah" page={safePage} pageSize={pageSize} totalItems={parsed.rows.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} /></Card>
}
export function PreviewTable({ parsed }: { parsed: ParsedImportFile }) { const rows = parsed.rows.slice(0, MAX_PREVIEW_ROWS); return <Card className="production-import-preview__table-card" tone="raised" aria-labelledby="raw-preview-title"><div className="production-import-preview__card-heading"><div><p className="production-import-preview__card-kicker">Data sumber</p><h2 id="raw-preview-title">Pratinjau baris mentah</h2><p className="production-import-preview__hint">Menampilkan {rows.length} dari {parsed.rows.length} baris. Nilai ditampilkan persis seperti saat dibaca.</p></div></div>{rows.length < parsed.rows.length ? <p className="production-import-preview__truncation">Pratinjau dibatasi hingga {MAX_PREVIEW_ROWS} baris.</p> : null}<Table caption="Baris Peserta hasil pembacaan"><thead><tr><TableHeader>Baris sumber</TableHeader>{parsed.headers.map((header) => <TableHeader key={header}>{header}</TableHeader>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.rowNumber}><th scope="row">{row.rowNumber}</th>{parsed.headers.map((header) => <td key={header} className={header.toLowerCase().includes('ticket') ? 'production-import-preview__ticket' : undefined}>{typeof row.values[header] === 'string' ? row.values[header] : String(row.values[header] ?? '')}</td>)}</tr>)}</tbody></Table></Card> }
function ValidationPanel({ validation }: { validation: ParticipantImportValidationResult }) { const issues = validation.rows.flatMap((row) => row.issues).slice(0, MAX_ISSUE_ROWS_SHOWN); return <Card className="production-import-preview__validation" tone="raised" aria-labelledby="validation-title"><div className="production-import-preview__card-heading"><div><p className="production-import-preview__card-kicker">Langkah 3</p><h2 id="validation-title">Diagnostik dan ringkasan validasi</h2></div><Badge variant={validation.summary.invalidRows === 0 ? 'success' : 'warning'}>{validation.summary.invalidRows === 0 ? 'Siap' : 'Tinjau masalah'}</Badge></div><div className="production-import-preview__metrics" aria-label="Metrik validasi"><Metric label="Total baris" value={validation.summary.totalRows} /><Metric label="Draf valid" value={validation.summary.validRows} /><Metric label="Baris tidak valid" value={validation.summary.invalidRows} /><Metric label="Duplikat" value={validation.summary.duplicateRows} /><Metric label="Masalah pemblokir" value={validation.summary.issueCount} /></div><p className="production-import-preview__metric-summary">Total baris: {validation.summary.totalRows} · Draf valid: {validation.summary.validRows} · Baris tidak valid: {validation.summary.invalidRows} · Baris duplikat: {validation.summary.duplicateRows}</p><div className="production-import-preview__issue-list"><p>Diagnostik baris</p><Table caption="Validasi per baris sumber"><thead><tr><TableHeader>Baris</TableHeader><TableHeader>Nomor Tiket</TableHeader><TableHeader>Hasil</TableHeader></tr></thead><tbody>{validation.rows.slice(0, MAX_PREVIEW_ROWS).map((row) => <tr key={row.normalized.rowNumber}><th scope="row">{row.normalized.rowNumber}</th><td className="production-import-preview__ticket">{row.normalized.ticketNumber ?? '—'}</td><td>{row.participantDraft ? 'Draf valid' : 'Tidak valid — tidak dikirim ke penyimpanan'}</td></tr>)}</tbody></Table>{issues.length > 0 ? <ul>{issues.map((issue) => <li key={`${issue.rowNumber}-${issue.code}`}>Baris {issue.rowNumber}: {issue.message}</li>)}</ul> : <p>Tidak ditemukan masalah baris.</p>}{validation.summary.issueCount > MAX_ISSUE_ROWS_SHOWN ? <p>Hanya {MAX_ISSUE_ROWS_SHOWN} masalah pertama yang ditampilkan.</p> : null}</div><p className="production-import-preview__safe-note">Belum ada data Peserta yang disimpan.</p></Card> }
function Metric({ label, value }: { label: string; value: number }) { return <div><span>{label}</span><strong>{formatProductionNumber(value)}</strong></div> }
function StrategyPanel({ strategy, disabled, onChoose }: { strategy: ImportStrategy | null; disabled: boolean; onChoose: (strategy: ImportStrategy) => void }) { return <Card className="production-import-preview__strategy" tone="raised" aria-labelledby="strategy-title"><fieldset disabled={disabled}><legend id="strategy-title">Langkah 4 · Strategi impor</legend><p className="production-import-preview__hint">Pilih satu strategi. Tidak ada pilihan otomatis.</p><label className={`production-import-preview__strategy-option production-import-preview__strategy-option--replace${strategy === 'replace' ? ' is-selected' : ''}`}><input aria-label="Ganti" type="radio" name="import-strategy" checked={strategy === 'replace'} onChange={() => onChoose('replace')} /><span><strong>Ganti</strong><small>Hapus Peserta saat ini untuk Acara, lalu masukkan batch tervalidasi.</small><small>Rollback atomik saat gagal; record yang ada akan diganti.</small></span></label><label className={`production-import-preview__strategy-option production-import-preview__strategy-option--merge${strategy === 'merge' ? ' is-selected' : ''}`}><input aria-label="Gabung" type="radio" name="import-strategy" checked={strategy === 'merge'} onChange={() => onChoose('merge')} /><span><strong>Gabung</strong><small>Pertahankan Peserta yang ada dan masukkan batch tanpa konflik.</small><small>Konflik tiket persis menolak seluruh operasi secara atomik.</small></span></label></fieldset></Card> }
function ConfirmationContents({ event, staged, strategy, currentParticipantCount }: { event: Event | null; staged: StagedImport | null; strategy: ImportStrategy; currentParticipantCount: number | null }) { const summary = staged?.validation.summary; return <div><p>Acara: <strong>{event?.name ?? 'Tidak tersedia'}</strong> · status: {event === null ? 'tidak diketahui' : productionDomainLabel(event.status)}</p><p>Sumber: {staged?.fileName} · {staged?.parsed.format.toUpperCase()}{staged?.worksheet ? ` · lembar kerja ${staged.worksheet}` : ''}</p><p>Strategi: {strategy === 'replace' ? 'Ganti' : 'Gabung'} · draf valid: {summary?.validRows ?? 0} · baris tidak valid: {summary?.invalidRows ?? 0} · duplikat: {summary?.duplicateRows ?? 0}</p><p>Peserta saat ini: {currentParticipantCount === null ? 'tidak tersedia' : currentParticipantCount} · perkiraan dimasukkan: {summary?.validRows ?? 0}</p>{strategy === 'replace' ? <p><strong>Ganti akan menghapus Peserta saat ini untuk Acara ini.</strong></p> : <p>Gabung mempertahankan record yang ada; konflik tiket persis akan menolak seluruh operasi.</p>}<p>Operasi ini bersifat atomik: selesai sepenuhnya atau dibatalkan seluruhnya.</p></div> }
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
  return <Card className="production-import-preview__summary-card" tone="raised" aria-labelledby="persisted-participants-title">
    <h2 id="persisted-participants-title">Peserta Tersimpan</h2>
    <p>Acara: <strong>{event?.name ?? 'Belum ada Acara dipilih'}</strong></p>
    {verification.status === 'loading' ? <p role="status">Membaca Peserta tersimpan…</p> : null}
    {verification.status === 'failure' ? <p role="alert">{verification.message}</p> : null}
    {verification.status === 'empty' ? <p>Belum ada Peserta yang tersimpan untuk Acara ini.</p> : null}
    {verification.status === 'ready' ? <>
      <p>Total Peserta tersimpan: {formatProductionNumber(verification.result.totalCount)}</p>
      <p>{formatProductionNumber(verification.result.totalCount)} peserta · {formatProductionNumber(checkedInCount ?? 0)} sudah check-in</p>
      <Table caption="Peserta tersimpan"><thead><tr><TableHeader>Nomor Tiket</TableHeader><TableHeader>Nama</TableHeader><TableHeader>Grup</TableHeader><TableHeader>Check-in</TableHeader></tr></thead><tbody>{visibleRecords.map((record) => <tr key={record.id}><th scope="row" className="production-import-preview__ticket"><code>{record.ticketNumber}</code></th><td>{record.name ?? '—'}</td><td>{record.group ?? '—'}</td><td>{record.isCheckedIn ? 'Sudah check-in' : 'Belum check-in'}</td></tr>)}</tbody></Table>
      <Pagination label="Navigasi halaman Peserta tersimpan" page={safePage} pageSize={pageSize} totalItems={totalCount} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
    </> : null}
  </Card>
}

function SuccessPanel({ event, state }: { event: Event | null; state: Extract<ProductionState, { status: 'commit-success' }> }) { return <Card className="production-import-preview__success" tone="raised" role="status" aria-live="polite"><StatusBanner badge="Selesai" title="Impor Peserta selesai" tone="success">Disimpan ke {event?.name ?? 'Acara yang dipilih'} dengan strategi {state.strategy === 'replace' ? 'Ganti' : 'Gabung'}.</StatusBanner><div className="production-import-preview__success-metrics"><Metric label="Dimasukkan" value={state.result.insertedCount} /><Metric label="Dihapus / diganti" value={state.result.removedCount} /><Metric label="Tidak berubah" value={state.result.unchangedCount} /></div><p className="production-import-preview__metric-summary">Dimasukkan: {formatProductionNumber(state.result.insertedCount)} · Dihapus/diganti: {formatProductionNumber(state.result.removedCount)} · Tidak berubah: {formatProductionNumber(state.result.unchangedCount)}</p><p>Selesai: {state.result.completedAt} · Operasi: {state.result.operationId}</p><Button icon={<Icon name="CircleCheck" />} onClick={() => window.location.reload()}>Mulai Impor Baru</Button></Card> }
function participantFieldLabel(field: ColumnMapping['targetField']): string {
  switch (field) {
    case 'ticketNumber': return 'Nomor Tiket'
    case 'name': return 'Nama Peserta'
    case 'isCheckedIn': return 'Status check-in'
    case 'group': return 'Grup'
    case 'notes': return 'Catatan'
  }
}
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB` }
