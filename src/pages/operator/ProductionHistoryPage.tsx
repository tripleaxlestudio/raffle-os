import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import { reconstructOfficialHistoryForEvent, type HistoryReadRepositories, type HistoryReconstruction, type ReconstructedHistorySession, type ReconstructedWinner } from '../../application/history/history-read-model.ts'
import { canShowCompletedResultOnAudience, projectCompletedResultForAudience } from '../../application/history/completed-result-projection.ts'
import { filterOfficialHistory, filterOfficialWinners, readHistoryQuery, writeHistoryQuery, HISTORY_STATUSES, type HistoryQuery } from '../../application/history/history-query.ts'
import { projectAuditTimeline } from '../../application/history/audit-timeline.ts'
import { useProductionAudiencePublisher, useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Badge, Button, ButtonLink, Card, Icon, Select, Table, type IconName } from '../../shared/ui/index.ts'
import { ProductionLoadingState, ProductionSetupRequired } from '../../shared/components/ProductionWorkspaceState.tsx'
import { parseDrawSessionId } from '../../domain/shared/identifiers.ts'
import { createConfirmedResultsFilename, downloadExport, projectConfirmedResults, serializeConfirmedResultsCsv, serializeConfirmedResultsXlsx } from '../../application/history/confirmed-results-export.ts'
import { formatProductionDateTime, productionDomainLabel } from '../../shared/localization/production-locale.ts'

type LoadState = { readonly status: 'loading' } | { readonly status: 'ready'; readonly sessions: readonly HistoryReconstruction[] } | { readonly status: 'error'; readonly message: string }
type SessionStatus = ReconstructedHistorySession['session']['status']

function label(value: string): string { return productionDomainLabel(value) }
function statusVariant(status: SessionStatus): 'pending' | 'confirmed' | 'danger' | 'neutral' { return status === 'pending-confirmation' || status === 'drawing' ? 'pending' : status === 'completed' ? 'confirmed' : status === 'cancelled' ? 'danger' : 'neutral' }
function winnerVariant(status: ReconstructedWinner['status']): 'pending' | 'confirmed' | 'danger' { return status === 'pending' ? 'pending' : status === 'confirmed' ? 'confirmed' : 'danger' }
function statusIcon(status: SessionStatus): IconName | null { return status === 'completed' ? 'CircleCheck' : status === 'cancelled' ? 'CircleX' : status === 'pending-confirmation' || status === 'drawing' ? 'Clock' : null }
function winnerStatusIcon(status: ReconstructedWinner['status']): IconName { return status === 'pending' ? 'Clock' : status === 'confirmed' ? 'CircleCheck' : 'CircleX' }
function SessionStatusIcon({ status }: { readonly status: SessionStatus }): ReactNode { const icon = statusIcon(status); return icon === null ? null : <Icon name={icon} size={16} /> }
function timestamp(value: string | undefined): string {
  if (value === undefined) return '—'
  return formatProductionDateTime(value).replace(' pukul ', ' · ')
}
function counts(item: ReconstructedHistorySession) {
  return {
    confirmed: item.winners.filter((winner) => winner.status === 'confirmed').length,
    pending: item.winners.filter((winner) => winner.status === 'pending').length,
    cancelled: item.winners.filter((winner) => winner.status === 'cancelled').length,
  }
}
function categoryName(item: ReconstructedHistorySession): string { return item.summary.categoryName ?? item.category?.name ?? 'Kategori hadiah tidak tersedia' }
function prizeName(item: ReconstructedHistorySession): string { return item.summary.prizeName ?? item.category?.prizeName ?? 'Hadiah terkait tidak tersedia' }

function readRepositories(services: ReturnType<typeof createDrawSetupProductionServices>): HistoryReadRepositories {
  return { audits: services.audits ?? { findByEventId: async () => [] }, categories: services.categories, configurations: services.configurations, events: services.events, redraws: services.redraws ?? { findByDrawSessionId: async () => [] }, sessions: services.sessions, winners: services.winners }
}

function ShowCompletedResultAction({ reconstruction }: { readonly reconstruction: HistoryReconstruction }) {
  const workspace = useProductionWorkspace()
  const audience = useProductionAudiencePublisher()
  const [message, setMessage] = useState<string | null>(null)
  const [, setAudienceRevision] = useState(0)
  useEffect(() => audience.subscribeSnapshot?.(() => setAudienceRevision((revision) => revision + 1)) ?? (() => undefined), [audience])
  const activeSnapshot = audience.getSnapshot?.()
  const isShown = activeSnapshot?.stage === 'pending-handoff' && activeSnapshot.verificationState === 'verified' && activeSnapshot.drawSessionId === reconstruction.value.session.id

  function showResult(): void {
    if (workspace.status !== 'ready') return
    if (isShown) {
      const parsedAcaraId = parseDrawSessionId(workspace.event.id)
      if (!parsedAcaraId.ok || workspace.displayConfiguration === null) return
      const settings = workspace.eventSettings
      audience.publish({
        drawSessionId: parsedAcaraId.value,
        stage: 'standby',
        blackoutRequested: false,
        displayTest: false,
        eventName: settings.displayName,
        eventSubtitle: settings.subtitle,
        primaryColor: settings.primaryColor,
        accentColor: settings.accentColor,
        logo: settings.logo === undefined ? undefined : { type: settings.logo.type, blob: settings.logo.blob },
        background: settings.background === undefined ? undefined : { type: settings.background.type, blob: settings.background.blob },
        blackoutAppearance: workspace.displayConfiguration.blackoutAppearance,
        safeAreaMargin: workspace.displayConfiguration.safeAreaMargin,
      })
      setMessage('Tampilan Audiens kembali ke status siaga.')
      return
    }
    const result = projectCompletedResultForAudience({
      reconstruction,
      eventSettings: workspace.eventSettings,
      displayConfiguration: workspace.displayConfiguration,
      stageStartedAt: new Date().toISOString() as ReconstructedHistorySession['session']['createdAt'],
    })
    if (!result.ok) {
      setMessage('Hasil selesai ini tidak tersedia untuk tampilan publik.')
      return
    }
    const published = audience.publish(result.source)
    setMessage(published.ok ? 'Hasil terkonfirmasi kini ditampilkan pada Tampilan Audiens.' : 'Hasil tidak dapat ditampilkan. Periksa koneksi Tampilan Audiens lalu coba lagi.')
  }

  return <div className="history-table__show-action"><Button className={`history-table__action${isShown ? ' history-table__action--active' : ''}`} icon={<Icon name={isShown ? 'Monitor' : 'MonitorCheck'} />} size="sm" variant={isShown ? 'primary' : 'secondary'} onClick={showResult}>{isShown ? 'Sembunyikan' : 'Tampilkan'}</Button>{message ? <span role="status">{message}</span> : null}</div>
}

export function ProductionHistoryPage() {
  const workspace = useProductionWorkspace()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const repositories = useMemo(() => readRepositories(services), [services])
  const [searchParams, setSearchParams] = useSearchParams()
  const { drawSessionId } = useParams<{ drawSessionId: string }>()
  const location = useLocation()
  const allWinners = location.pathname.endsWith('/history/winners')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const query = readHistoryQuery(searchParams)
  const updateQuery = (next: Partial<HistoryQuery>) => setSearchParams(writeHistoryQuery({ ...query, ...next }), { replace: true })

  const load = useCallback(async () => {
    if (workspace.status !== 'ready') return
    setState({ status: 'loading' })
    try {
      await services.open()
      const projection = await reconstructOfficialHistoryForEvent(workspace.event.id, repositories)
      setState({ status: 'ready', sessions: projection.sessions })
    } catch (cause: unknown) {
      setState({ status: 'error', message: cause instanceof Error && /version/i.test(cause.message) ? 'Database lokal lebih baru daripada versi aplikasi yang didukung.' : 'Riwayat resmi tidak dapat dibaca dengan aman. Coba baca ulang data lokal.' })
    }
  }, [repositories, services, workspace])

  useEffect(() => { void Promise.resolve().then(load) }, [load])

  if (workspace.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Record resmi" headingId="history-title" title="Riwayat" description="Membaca Acara yang dipilih…" /><ProductionLoadingState description="Membaca Acara yang dipilih…" /></section>
  if (workspace.status === 'empty' || workspace.status === 'invalid-reference') return <section aria-labelledby="history-title"><PageHeader eyebrow="Record resmi" headingId="history-title" title="Riwayat" description="Acara aktif diperlukan untuk membaca Riwayat resmi." /><ProductionSetupRequired title="Tidak ada Acara aktif" description="Pilih Acara untuk melihat Riwayat undian resminya." /></section>
  if (workspace.status === 'error') return <section aria-labelledby="history-title"><PageHeader eyebrow="Record resmi" headingId="history-title" title="Riwayat tidak tersedia" description="Acara yang dipilih tidak dapat dibaca." /><StatusBanner badge="Kesalahan penyimpanan" title="Riwayat resmi tidak diubah" tone="warning">{workspace.message}</StatusBanner></section>
  if (state.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Record resmi" headingId="history-title" title="Riwayat" description={`Membaca Riwayat resmi untuk ${workspace.event.name}…`} /><ProductionLoadingState description={`Membaca Riwayat resmi untuk ${workspace.event.name}…`} /></section>
  if (state.status === 'error') return <section aria-labelledby="history-title"><PageHeader eyebrow="Record resmi" headingId="history-title" title="Riwayat tidak tersedia" description={state.message} /><StatusBanner badge="Pemulihan hanya baca" title="Tidak ada keputusan atau mutasi yang dijalankan" tone="warning">Coba baca ulang data lokal.</StatusBanner><Button icon={<Icon name="RefreshCw" />} onClick={() => void load()}>Coba baca lagi</Button></section>

  const filtered = filterOfficialHistory(state.sessions, query)
  if (drawSessionId !== undefined) {
    const selected = state.sessions.find((item) => item.value.session.id === drawSessionId) ?? null
    return <section aria-labelledby="history-title" className="history-page history-detail-page"><PageHeader eyebrow="Record resmi" headingId="history-title" title="Detail Sesi" description={selected === null ? 'Sesi resmi yang diminta tidak ditemukan.' : `${prizeName(selected.value)} · ${workspace.event.name}`} />{selected === null ? <StatusBanner badge="Tidak ditemukan" title="Sesi undian tidak tersedia" tone="warning">Sesi ini bukan milik Acara yang dipilih atau sudah tidak tersedia.</StatusBanner> : <HistoryDetail reconstruction={selected} />}</section>
  }
  if (allWinners) return <AllWinners sessions={state.sessions} eventName={workspace.event.name} query={query} onQueryChange={updateQuery} />

  const actions = <>{state.sessions.length > 0 ? <><ButtonLink icon={<Icon name="Radio" />} variant="secondary" to="/draw/live">Buka Sesi Undian</ButtonLink><ButtonLink icon={<Icon name="Trophy" />} variant="secondary" to="/history/winners">Semua Pemenang</ButtonLink></> : null}<ConfirmedResultsExport eventId={workspace.event.id} eventName={workspace.event.name} sessions={state.sessions} /></>
  return <section aria-labelledby="history-title" className="history-page"><PageHeader eyebrow="Record resmi" headingId="history-title" title="Riwayat Sesi" description={`Sesi Undian resmi untuk ${workspace.event.name}.`} actions={actions} />{state.sessions.length > 0 ? <HistoryFilters sessions={state.sessions} query={query} onChange={updateQuery} /> : null}{filtered.length === 0 ? <Card className="history-empty-state" padding="lg"><p className="history-empty-state__label">{state.sessions.length === 0 ? 'Riwayat resmi' : 'Riwayat sesi'}</p><div className="history-empty-state__copy"><h2>{state.sessions.length === 0 ? 'Belum ada undian resmi' : 'Tidak ada sesi resmi'}</h2><p>{state.sessions.length === 0 ? 'Acara ini belum memiliki hasil Undian tersimpan.' : 'Tidak ada sesi yang sesuai dengan filter aktif.'}</p>{state.sessions.length === 0 ? <p>Undian resmi yang selesai akan muncul otomatis di sini.</p> : null}</div>{state.sessions.length === 0 ? <ButtonLink icon={<Icon name="SlidersHorizontal" />} to="/draw/setup">Buka Pengaturan Undian</ButtonLink> : <Button onClick={() => setSearchParams('', { replace: true })} icon={<Icon name="SlidersHorizontal" />}>Reset filter</Button>}</Card> : <HistoryTable items={filtered} />}</section>
}

function ConfirmedResultsExport({ eventId, eventName, sessions }: { readonly eventId: string; readonly eventName: string; readonly sessions: readonly HistoryReconstruction[] }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => projectConfirmedResults({ eventId, sessions }), [eventId, sessions])
  useEffect(() => {
    if (!open) return undefined
    queueMicrotask(() => menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus())
    const closeOnOutsidePointer = (event: PointerEvent) => { if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => { document.removeEventListener('pointerdown', closeOnOutsidePointer) }
  }, [open])
  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || items.length === 0) return
    event.preventDefault()
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length
    items[next]?.focus()
  }
  const exportFile = async (format: 'csv' | 'xlsx') => {
    setOpen(false)
    try {
      const exportedAt = new Date().toISOString()
      const filename = createConfirmedResultsFilename(eventName, exportedAt, format)
      if (format === 'csv') downloadExport(serializeConfirmedResultsCsv(rows), 'text/csv;charset=utf-8', filename)
      else downloadExport(await serializeConfirmedResultsXlsx({ eventId, eventName, exportedAt, rows }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename)
      setMessage(`${rows.length} hasil terkonfirmasi diekspor sebagai ${format.toUpperCase()}.`)
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? `Ekspor gagal: ${cause.message}` : 'Ekspor gagal. Coba unduh lagi.')
    }
  }
  return <div ref={containerRef} className="history-export"><Button ref={triggerRef} icon={<Icon name="ExternalLink" />} variant="secondary" aria-controls={open ? menuId : undefined} aria-expanded={open} aria-haspopup="menu" onClick={() => { setOpen((current) => !current); setMessage(null) }}>Ekspor <span className="history-export__count">({rows.length})</span></Button>{open ? <div ref={menuRef} id={menuId} className="history-export__menu" role="menu" aria-label="Ekspor hasil terkonfirmasi" onKeyDown={handleMenuKeyDown}><p className="history-export__menu-note">Acara aktif · hanya hasil terkonfirmasi</p><button className="history-export__menu-item" role="menuitem" onClick={() => void exportFile('csv')}><Icon name="FileText" size={18} /><span className="history-export__menu-item-copy"><strong>CSV</strong><small>Nilai dipisahkan koma</small></span></button><button className="history-export__menu-item" role="menuitem" onClick={() => void exportFile('xlsx')}><Icon name="FileSpreadsheet" size={18} /><span className="history-export__menu-item-copy"><strong>XLSX</strong><small>Workbook Excel</small></span></button></div> : null}{message ? <span className="history-export__message" role="status">{message}</span> : null}</div>
}

function HistoryFilters({ sessions, query, onChange }: { readonly sessions: readonly HistoryReconstruction[]; readonly query: HistoryQuery; readonly onChange: (next: Partial<HistoryQuery>) => void }) {
  const categories = [...new Map(sessions.map((item) => [item.value.summary.categoryId, item.value.summary.categoryName ?? 'Tidak tersedia'])).entries()].filter(([id]) => id !== null)
  return <div className="history-filters" aria-label="Filter Riwayat"><label className="ui-field"><span className="ui-field__label">Cari</span><input className="ui-input" aria-label="Cari Riwayat resmi" value={query.search} placeholder="Tiket, kategori, hadiah, atau ID sesi" onChange={(event) => onChange({ search: event.target.value })} /></label><Select label="Status" aria-label="Filter berdasarkan status" value={query.status} onChange={(event) => onChange({ status: event.target.value as HistoryQuery['status'] })}><option value="all">Semua status</option>{HISTORY_STATUSES.map((item) => <option key={item} value={item}>{label(item)}</option>)}</Select><Select label="Mode" aria-label="Filter berdasarkan mode" value="live" disabled><option value="live">Live / Resmi</option></Select><Select label="Kategori" aria-label="Filter berdasarkan kategori" value={query.category} onChange={(event) => onChange({ category: event.target.value })}><option value="">Semua kategori</option>{categories.map(([id, name]) => <option key={id} value={id as string}>{name}</option>)}</Select><label className="ui-field"><span className="ui-field__label">Dari</span><input className="ui-input" aria-label="Tanggal awal Riwayat" type="date" value={query.from} onChange={(event) => onChange({ from: event.target.value })} /></label><label className="ui-field"><span className="ui-field__label">Sampai</span><input className="ui-input" aria-label="Tanggal akhir Riwayat" type="date" value={query.to} onChange={(event) => onChange({ to: event.target.value })} /></label><Badge variant="live">Hanya Live resmi</Badge><Button variant="quiet" onClick={() => onChange({ category: '', from: '', search: '', status: 'all', to: '' })}>Reset</Button></div>
}

export function HistoryTable({ items }: { readonly items: readonly HistoryReconstruction[] }) {
  return <div className="history-table-panel"><Table aria-label="Sesi Riwayat resmi" caption="Riwayat Undian resmi"><thead><tr><th scope="col">Waktu undian</th><th scope="col">Kategori / hadiah</th><th scope="col">Diminta</th><th scope="col">Dikonfirmasi</th><th scope="col">Menunggu</th><th scope="col">Dibatalkan</th><th scope="col">Selesai</th><th scope="col">Mode / status</th><th scope="col">Tindakan</th></tr></thead><tbody>{items.map((reconstruction) => <HistoryTableRow reconstruction={reconstruction} key={reconstruction.value.session.id} />)}</tbody></Table></div>
}

function HistoryTableRow({ reconstruction }: { readonly reconstruction: HistoryReconstruction }) {
  const item = reconstruction.value
  const count = counts(item)
  const incomplete = reconstruction.kind === 'incomplete'
  const action = <div className="history-table__actions">{canShowCompletedResultOnAudience(reconstruction) ? <ShowCompletedResultAction reconstruction={reconstruction} /> : null}{item.session.status === 'pending-confirmation' ? <ButtonLink className="history-table__action" icon={<Icon name="ClipboardCheck" />} size="sm" to={`/draw/pending/${item.session.id}`}>Tinjau hasil</ButtonLink> : <ButtonLink className="history-table__action" icon={<Icon name="ArrowRight" />} size="sm" to={`/history/${item.session.id}`} variant="secondary">Lihat Detail</ButtonLink>}</div>
  return <tr className="history-table__row"><td className="history-table__date">{timestamp(item.summary.drawTimestamp)}</td><td><span className="history-table__secondary">{categoryName(item)}</span><small className="history-table__event">{prizeName(item)}</small></td><td><strong className="history-table__count">{item.summary.requestedWinnerCount ?? '—'}</strong></td><td><Badge variant="confirmed">{count.confirmed}</Badge></td><td><Badge variant="pending">{count.pending}</Badge></td><td><Badge variant="danger">{count.cancelled}</Badge></td><td className="history-table__date">{timestamp(item.summary.completionTimestamp)}</td><td><div className="history-table__status"><Badge variant="live">Live</Badge><Badge variant={statusVariant(item.summary.sessionStatus)}><SessionStatusIcon status={item.summary.sessionStatus} />{label(item.summary.sessionStatus)}</Badge>{incomplete ? <Badge variant="danger">Tidak lengkap</Badge> : null}</div></td><td className="history-table__action-cell">{action}</td></tr>
}

function Metadata({ item }: { readonly item: ReconstructedHistorySession }) {
  const fields = [['Acara', item.event?.name || 'Tidak tersedia'], ['ID Sesi Undian', item.session.id], ['Mode', label(item.summary.mode)], ['Kategori', categoryName(item)], ['Hadiah', prizeName(item)], ['Waktu undian', timestamp(item.summary.drawTimestamp)], ['Waktu selesai', timestamp(item.summary.completionTimestamp)], ['Status sesi', label(item.summary.sessionStatus)], ['Jumlah pool yang memenuhi syarat', item.summary.eligibleCount ?? 'Tidak tersedia'], ['Jumlah pemenang diminta', item.summary.requestedWinnerCount ?? 'Tidak tersedia']] as const
  return <dl className="history-detail__summary-grid">{fields.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{name === 'Status sesi' ? <Badge variant={statusVariant(item.summary.sessionStatus)}>{value}</Badge> : value}</dd></div>)}</dl>
}

function HistoryDetailContent({ reconstruction }: { readonly reconstruction: HistoryReconstruction }) {
  const item = reconstruction.value
  const lineageByOriginal = new Map(item.lineages.map((lineage) => [lineage.originalWinnerRecordId, lineage]))
  return <div className="history-detail"><ButtonLink icon={<Icon name="ArrowLeft" />} to="/history" variant="quiet">Kembali ke Riwayat</ButtonLink>{reconstruction.kind === 'incomplete' ? <StatusBanner badge="Record tidak lengkap" title="Record resmi tidak lengkap atau tidak konsisten" tone="warning">Bukti tersimpan yang dapat dipercaya tetap terlihat di bawah. Hubungan yang hilang tidak direkayasa.</StatusBanner> : null}<Card className="history-detail__summary" padding="none"><div className="history-detail__audit-heading"><p>Sesi Live resmi · bukti hanya baca</p><h2>Metadata sesi</h2></div><Metadata item={item} /></Card><Card className="history-detail__winner-records" padding="none"><div className="history-detail__audit-heading"><h2>Record pemenang</h2><p>Setiap WinnerRecord yang dipertahankan ditampilkan, termasuk record asli yang dibatalkan.</p></div><div className="history-detail__table-scroll"><Table caption="WinnerRecord resmi"><thead><tr><th>Urutan</th><th>Tiket</th><th>Status</th><th>Dikonfirmasi</th><th>Dibatalkan</th><th>Konteks pengganti</th></tr></thead><tbody>{item.winners.length === 0 ? <tr><td colSpan={6}>Tidak ada WinnerRecord yang terkait dengan sesi ini.</td></tr> : item.winners.map((winner) => <WinnerRow key={winner.winnerRecordId} winner={winner} lineage={lineageByOriginal.get(winner.winnerRecordId)} />)}</tbody></Table></div></Card>{item.session.status === 'pending-confirmation' ? <p><ButtonLink icon={<Icon name="ClipboardCheck" />} to={`/draw/pending/${item.session.id}`}>Tinjau hasil tertunda</ButtonLink></p> : null}</div>
}

export function HistoryDetail({ reconstruction }: { readonly reconstruction: HistoryReconstruction }) {
  return <><HistoryDetailContent reconstruction={reconstruction} /><AuditTimeline reconstruction={reconstruction} /></>
}

export function AuditTimeline({ reconstruction }: { readonly reconstruction: HistoryReconstruction }) {
  const entries = projectAuditTimeline(reconstruction)
  return <Card className="history-audit-timeline" padding="none"><div className="history-detail__audit-heading"><h2>Linimasa Audit</h2><p>Bukti kronologis tersimpan untuk sesi Live ini.</p></div>{entries.length === 0 ? <p>Tidak ada entri audit tersimpan yang terkait dengan sesi ini.</p> : <ol>{entries.map((entry) => <li key={entry.id}><time dateTime={entry.timestamp}>{timestamp(entry.timestamp)}</time><strong>{entry.action}</strong><span>{entry.actor ?? 'Aktor tidak tersedia'}</span>{entry.ticketNumber ? <code className="result-ticket">{entry.ticketNumber}</code> : null}{entry.originalTicketNumber && entry.replacementTicketNumber ? <span><code>{entry.originalTicketNumber}</code> → <code>{entry.replacementTicketNumber}</code></span> : null}{entry.reason ? <span>Alasan: {label(entry.reason)}</span> : null}{entry.note ? <span>Catatan: {entry.note}</span> : null}</li>)}</ol>}</Card>
}

function WinnerRow({ winner, lineage }: { readonly winner: ReconstructedWinner; readonly lineage: ReconstructedHistorySession['lineages'][number] | undefined }) {
  return <tr><td>#{winner.sequence}</td><td><code className="result-ticket">{winner.ticketNumber}</code></td><td><Badge variant={winnerVariant(winner.status)}><Icon name={winnerStatusIcon(winner.status)} size={16} />{label(winner.status)}</Badge></td><td>{timestamp(winner.confirmationTimestamp)}</td><td>{timestamp(winner.cancellationTimestamp)}</td><td>{lineage === undefined ? 'Pilihan asli dipertahankan' : <span><code>{lineage.originalTicketNumber}</code> <Icon name="ArrowRight" size={16} /> <code>{lineage.replacementTicketNumber}</code><small> · {label(lineage.reason)}{lineage.reasonNote ? ` · ${lineage.reasonNote}` : ''}</small></span>}</td></tr>
}

export function AllWinners({ sessions, eventName, query = { category: '', from: '', search: '', status: 'all', to: '' }, onQueryChange = () => undefined }: { readonly sessions: readonly HistoryReconstruction[]; readonly eventName: string; readonly query?: HistoryQuery; readonly onQueryChange?: (next: Partial<HistoryQuery>) => void }) {
  const rows = filterOfficialWinners(sessions, query)
  return <section aria-labelledby="history-title" className="history-page"><PageHeader eyebrow="Record resmi" headingId="history-title" title="Semua Pemenang" description={`Setiap WinnerRecord yang dipertahankan di seluruh sesi Live untuk ${eventName}.`} actions={<ButtonLink icon={<Icon name="ArrowLeft" />} variant="secondary" to="/history">Riwayat Sesi</ButtonLink>} />{sessions.some((item) => item.kind === 'incomplete') ? <StatusBanner badge="Record tidak lengkap" title="Beberapa record resmi perlu perhatian" tone="warning">Bukti pemenang yang tersisa ditampilkan. Hubungan yang tidak lengkap tidak disajikan sebagai lengkap.</StatusBanner> : null}<HistoryFilters sessions={sessions} query={query} onChange={onQueryChange} />{rows.length === 0 ? <Card padding="md"><h2>{sessions.length === 0 ? 'Belum ada pemenang resmi' : 'Tidak ada pemenang yang sesuai dengan filter aktif'}</h2><p>WinnerRecord Live tersimpan merupakan bukti hanya baca.</p></Card> : <Card className="history-table-panel" padding="none"><Table aria-label="Semua pemenang resmi" caption="Semua pemenang Live resmi"><thead><tr><th>Tiket</th><th>Status</th><th>Kategori</th><th>Hadiah</th><th>Sesi Undian</th><th>Urutan</th><th>Waktu undian</th><th>Dikonfirmasi</th><th>Dibatalkan</th><th>Hubungan</th></tr></thead><tbody>{rows.map(({ reconstruction, winner }, index) => { const item = reconstruction.value; const lineage = item.lineages.find((candidate) => candidate.originalWinnerRecordId === winner.winnerRecordId); return <tr key={`${item.session.id}:${winner.winnerRecordId}:${index}`}><td><code className="result-ticket">{winner.ticketNumber}</code></td><td><Badge variant={winnerVariant(winner.status)}>{label(winner.status)}</Badge></td><td>{categoryName(item)}</td><td>{prizeName(item)}</td><td><ButtonLink size="sm" to={`/history/${item.session.id}`} variant="quiet">{item.session.id}</ButtonLink></td><td>#{winner.sequence}</td><td>{timestamp(item.summary.drawTimestamp)}</td><td>{timestamp(winner.confirmationTimestamp)}</td><td>{timestamp(winner.cancellationTimestamp)}</td><td>{lineage === undefined ? 'Pilihan asli' : <><code>{lineage.originalTicketNumber}</code> <Icon name="ArrowRight" size={16} /> <code>{lineage.replacementTicketNumber}</code></>}</td></tr> })}</tbody></Table></Card>}</section>
}
