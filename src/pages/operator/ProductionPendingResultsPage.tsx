import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactSelect, { type StylesConfig } from 'react-select'
import { ThemedSelectMenu } from '../../shared/ui/ThemedSelectMenu.tsx'
import { Link, useParams } from 'react-router'
import { useProductionAudiencePublisher } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { RedrawReason, RedrawRecord } from '../../domain/winners/redraw.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { CommandId } from '../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import { calculateReplacementCapacity, LOCAL_OPERATOR, type PendingDecisionCommand } from '../../application/pending-decisions/index.ts'
import { projectCommittedAudienceState } from '../../application/display-transport/authoritative-projection.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Badge, Button, ButtonLink, Card, ConfirmationDialog, Icon, Modal } from '../../shared/ui/index.ts'

type Decision = 'confirm' | 'cancel' | 'redraw-pending' | 'redraw-confirmed'
type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly title: string; readonly message: string }
  | { readonly status: 'ready'; readonly session: DrawSession; readonly event: Event; readonly category: PrizeCategory; readonly displayConfiguration: import('../../domain/display/display-configuration.types.ts').DisplayConfiguration; readonly winners: readonly WinnerRecord[]; readonly redraws: readonly RedrawRecord[]; readonly blackoutRequested: boolean }

const reasons: readonly { value: RedrawReason; label: string }[] = [
  { value: 'absent', label: 'Tidak Hadir' },
  { value: 'invalid-ticket', label: 'Tiket tidak valid' },
  { value: 'ineligible', label: 'Tidak memenuhi syarat' },
  { value: 'previous-winner', label: 'Pemenang sebelumnya' },
  { value: 'operator-error', label: 'Kesalahan Operator' },
  { value: 'other', label: 'Lainnya' },
]

type ReasonOption = (typeof reasons)[number]

const reasonSelectStyles: StylesConfig<ReasonOption, false> = {
  container: (base) => ({ ...base, width: '100%' }),
  control: (base, state) => ({
    ...base,
    minHeight: '2.75rem',
    height: '2.75rem',
    borderColor: state.isFocused ? 'var(--accent-hover)' : 'var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--surface-raised)',
    boxShadow: state.isFocused
      ? '0 0 0 0.15rem color-mix(in srgb, var(--accent-hover) 55%, transparent)'
      : 'inset 0 0 0 1px rgb(255 255 255 / 4%)',
    '&:hover': { borderColor: 'var(--accent-hover)' },
  }),
  valueContainer: (base) => ({ ...base, padding: '0 var(--control-inline-padding)' }),
  singleValue: (base) => ({ ...base, color: 'var(--text-primary)' }),
  placeholder: (base) => ({ ...base, color: 'var(--text-muted)' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? 'var(--accent-hover)' : 'var(--text-secondary)',
    padding: '0 var(--control-inline-padding) 0 var(--space-2)',
  }),
  menuPortal: (base) => ({ ...base, zIndex: 2000 }),
  menu: (base) => ({
    ...base,
    marginTop: 'var(--space-2)',
    border: '1px solid #3a4150',
    borderRadius: 'var(--radius-md)',
    backgroundColor: '#1d212b',
    boxShadow: '0 0.75rem 2rem rgb(0 0 0 / 45%)',
    overflow: 'hidden',
  }),
  menuList: (base) => ({
    ...base,
    backgroundColor: '#1d212b',
    padding: 'var(--space-1) 0',
  }),
  option: (base, state) => ({
    ...base,
    padding: 'var(--space-3) var(--space-3)',
    backgroundColor: state.isSelected
      ? '#7567ff'
      : state.isFocused
        ? '#2b3140'
        : '#1d212b',
    color: '#f4f6fa',
    cursor: 'pointer',
    '&:active': { backgroundColor: '#7567ff' },
  }),
}

function ReasonSelect({ id, reason, busy, onChange }: { readonly id: string; readonly reason: RedrawReason; readonly busy: boolean; readonly onChange: (reason: RedrawReason) => void }) {
  const selected = reasons.find((option) => option.value === reason) ?? reasons[0]
  return <div className="ui-field pending-results__reason-field"><span className="ui-field__label" id={`${id}-label`}>Alasan</span><ReactSelect<ReasonOption, false> components={{ Menu: ThemedSelectMenu }} aria-labelledby={`${id}-label`} classNamePrefix="raffle-reason-select" inputId={id} isClearable={false} isDisabled={busy} isSearchable={false} menuPortalTarget={document.body} menuPosition="fixed" onChange={(option) => { if (option !== null) onChange(option.value) }} options={reasons} styles={reasonSelectStyles} value={selected} /></div>
}

function commandId(): CommandId {
  return crypto.randomUUID() as CommandId
}

function statusLabel(status: WinnerRecord['status']): string {
  return status === 'pending' ? 'Tertunda' : status === 'confirmed' ? 'Dikonfirmasi' : 'Dibatalkan'
}

function formatOperatorDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

function CancelWinnerDialog({ selectedWinners, reason, note, busy, onReasonChange, onNoteChange, onCancel, onConfirm }: { readonly selectedWinners: readonly WinnerRecord[]; readonly reason: RedrawReason; readonly note: string; readonly busy: boolean; readonly onReasonChange: (reason: RedrawReason) => void; readonly onNoteChange: (note: string) => void; readonly onCancel: () => void; readonly onConfirm: () => void }) {
  const count = selectedWinners.length
  const winnerLabel = `${count} ${count === 1 ? 'pemenang' : 'pemenang'}`
  const ticketContext = count === 1 ? `Tiket ${selectedWinners[0]?.ticketNumber ?? ''}` : `${count} pemenang dipilih`
  const consequence = count === 1 ? 'Pemenang ini akan dicatat sebagai dibatalkan dalam riwayat resmi. Pengganti tidak akan diundi otomatis.' : 'Pemenang ini akan dicatat sebagai dibatalkan dalam riwayat resmi. Pengganti tidak akan diundi otomatis.'
  return <Modal headerIcon={<Icon name="CircleX" />} headerIconTone="danger" open eyebrow="KONFIRMASI OPERATOR" title={count === 1 ? 'Batalkan pemenang' : `Batalkan ${winnerLabel}`} showCloseButton={false} onClose={onCancel} footer={<><Button icon={<Icon name="ArrowLeft" />} variant="secondary" onClick={onCancel}>Kembali</Button><Button className="pending-results__cancel-submit" icon={<Icon name="CircleX" />} variant="danger" disabled={busy || (reason === 'other' && note.trim() === '')} isLoading={busy} onClick={onConfirm}>Batalkan secara resmi</Button></>}>
    <div className="pending-results__cancel-body">
      <strong className="pending-results__cancel-context">{ticketContext}</strong>
      <p className="pending-results__cancel-consequence">{consequence}</p>
      <ReasonSelect id="cancel-reason" reason={reason} busy={busy} onChange={onReasonChange} />
      <label className="ui-field" htmlFor="cancel-note"><span className="ui-field__label">Catatan (opsional)</span><textarea className="ui-input pending-results__cancel-note" id="cancel-note" rows={3} disabled={busy} onChange={(event) => onNoteChange(event.target.value)} placeholder="Tambahkan konteks untuk record audit…" value={note} /></label>
    </div>
  </Modal>
}

export function ProductionPendingResultsPage() {
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const audience = useProductionAudiencePublisher()
  const { drawSessionId } = useParams<{ drawSessionId: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [decision, setDecision] = useState<Decision | null>(null)
  const [reason, setReason] = useState<RedrawReason>('absent')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const commandRef = useRef<{ id: CommandId; command: PendingDecisionCommand } | null>(null)

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    setSelected(new Set())
    if (drawSessionId === undefined || drawSessionId.trim() === '') {
      setState({ status: 'error', title: 'Sesi Undian tidak valid', message: 'Pengenal Sesi Undian yang diminta tidak ada atau tidak valid.' })
      return
    }
    try {
      await services.open()
      const session = await services.sessions.findById(drawSessionId as never)
      if (session === null) { setState({ status: 'error', title: 'Sesi Undian tidak ditemukan', message: 'Hasil lokal yang diminta tidak ada.' }); return }
      if (session.mode !== 'live') { setState({ status: 'error', title: 'Hasil Live diperlukan', message: 'Keputusan produksi hanya tersedia untuk sesi Undian dalam Mode Live.' }); return }
      if (!['pending-confirmation', 'completed', 'cancelled'].includes(session.status)) { setState({ status: 'error', title: 'Status hasil tidak didukung', message: `Hasil ini berstatus ${session.status} dan tidak dapat diputuskan di sini.` }); return }
      if (session.configurationSnapshot === null) { setState({ status: 'error', title: 'Hasil tidak lengkap', message: 'Snapshot konfigurasi otoritatif tidak tersedia.' }); return }
      const [event, category, winners, redraws] = await Promise.all([
        services.events.findById(session.eventId),
        services.categories.findById(session.configurationSnapshot.prizeCategoryId),
        services.winners.findByDrawSessionId(session.id),
        services.redraws?.findByDrawSessionId(session.id) ?? Promise.resolve([] as RedrawRecord[]),
      ])
      if (event === null) { setState({ status: 'error', title: 'Acara tidak tersedia', message: 'Acara terkait tidak dapat dimuat dengan aman.' }); return }
      if (category === null) { setState({ status: 'error', title: 'Kategori hadiah tidak tersedia', message: 'Kategori Hadiah terkait tidak dapat dimuat dengan aman.' }); return }
      const snapshotCategory: PrizeCategory = { ...category, name: session.configurationSnapshot.categoryName, prizeName: session.configurationSnapshot.prizeName }
      const displayConfiguration = services.displayConfigurations === undefined ? null : await services.displayConfigurations.findByEventId(event.id)
      if (displayConfiguration === null || displayConfiguration === undefined) { setState({ status: 'error', title: 'Konfigurasi tampilan tidak tersedia', message: 'Simpan konfigurasi tampilan Acara aktif sebelum menampilkan hasil resmi.' }); return }
      const checkpoint = services.presentationCheckpoints === undefined ? null : await services.presentationCheckpoints.findByDrawSessionId(session.id)
      setState({ status: 'ready', session, event, category: snapshotCategory, displayConfiguration, winners: winners.sort((a, b) => a.sequenceNumber - b.sequenceNumber), redraws, blackoutRequested: checkpoint?.blackoutRequested ?? false })
    } catch (error: unknown) {
      const text = error instanceof Error && /version/i.test(error.message) ? 'Database lokal ini lebih baru daripada versi aplikasi yang didukung.' : 'Hasil produksi otoritatif tidak dapat dibaca dengan aman. Coba baca ulang data lokal.'
      setState({ status: 'error', title: 'Hasil produksi tidak tersedia', message: text })
    }
  }, [drawSessionId, services])

  useEffect(() => { void Promise.resolve().then(load) }, [load])
  useEffect(() => audience.subscribe((status) => {
    if (status.kind === 'transport-error') setMessage(status.error.kind === 'transport-unavailable' || status.error.kind === 'transport-closed' ? 'Hasil resmi tersimpan, tetapi Tampilan Audiens terputus. Coba publikasi lagi saat tersedia.' : 'Hasil resmi tersimpan, tetapi proyeksi Audiens tidak dapat dipublikasikan.')
  }), [audience])
  useEffect(() => {
    if (state.status !== 'ready') return
    const result = projectCommittedAudienceState({
      session: state.session,
      winners: state.winners,
      stageStartedAt: (state.session.updatedAt ?? new Date().toISOString()) as IsoTimestamp,
      blackoutRequested: state.blackoutRequested,
    })
    if (audience.publisher === null) return
    audience.publish(result)
  }, [audience, state])

  if (state.status === 'loading') return <section aria-busy="true" aria-live="polite"><PageHeader eyebrow="Produksi Live" headingId="pending-title" title="Hasil Tertunda" description="Membaca hasil lokal otoritatif…" /></section>
  if (state.status === 'error') return <section aria-live="polite"><PageHeader eyebrow="Produksi Live" headingId="pending-title" title={state.title} description={state.message} /><StatusBanner badge="Pemulihan hanya baca" title={state.title} tone="warning">Tidak ada keputusan atau pemilihan acak yang dijalankan. Coba baca ulang atau kembali ke Pengaturan Undian.</StatusBanner><Button icon={<Icon name="RefreshCw" />} onClick={() => void load()}>Coba baca lagi</Button></section>

  const { session, event, category, winners, redraws } = state
  const pending = winners.filter((winner) => winner.status === 'pending')
  const confirmed = winners.filter((winner) => winner.status === 'confirmed')
  const cancelled = winners.filter((winner) => winner.status === 'cancelled')
  const selectedWinners = winners.filter((winner) => selected.has(winner.id))
  const allPendingSelected = pending.length > 0 && pending.every((winner) => selected.has(winner.id))
  const bulkSelectionLabel = allPendingSelected ? 'Batalkan Pilihan Semua' : 'Pilih Semua yang Tertunda'
  const canDecide = selectedWinners.length > 0 && !busy
  const replacementCapacity = calculateReplacementCapacity({ candidatePoolSnapshot: session.candidatePoolSnapshot, drawSessionId: session.id, requestedReplacementCount: selectedWinners.length || 1, targetWinnerIds: selectedWinners.map((winner) => winner.id), winners }).eligibleCandidateCount
  const capacityEnough = replacementCapacity >= selectedWinners.length
  const displayedReplacementCapacity = calculateReplacementCapacity({ candidatePoolSnapshot: session.candidatePoolSnapshot, drawSessionId: session.id, requestedReplacementCount: pending.length || 1, targetWinnerIds: pending.map((winner) => winner.id), winners }).eligibleCandidateCount

  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  function toggleAllPending() {
    setSelected((current) => {
      const next = new Set(current)
      if (allPendingSelected) pending.forEach((winner) => next.delete(winner.id))
      else pending.forEach((winner) => next.add(winner.id))
      return next
    })
  }
  function openDecision(next: Decision) { setMessage(null); setReason('absent'); setNote(''); setDecision(next) }

  async function submit() {
    if (decision === null || selectedWinners.length === 0 || services.pendingDecisions === undefined) return
    if (decision !== 'confirm' && note.trim().length === 0 && reason === 'other') { setMessage('Catatan yang tidak kosong diperlukan untuk alasan Lainnya.'); return }
    const id = commandRef.current?.id ?? commandId()
    const base = { actor: LOCAL_OPERATOR, commandId: id, drawSessionId: session.id, mode: 'live' as const }
    setBusy(true)
    try {
      if (decision === 'confirm') {
        const command = { ...base, operation: 'confirm-pending-winners' as const, targets: selectedWinners.map((winner) => ({ winnerId: winner.id, expectedStatus: 'pending' as const })) }
        commandRef.current = { id, command }
        const result = await services.pendingDecisions.confirmation.confirm(command)
        if (result.status === 'unknown') { setMessage('Hasil perintah tidak diketahui. Muat ulang record otoritatif sebelum mencoba lagi dengan ID perintah yang sama.'); return }
        if ('error' in result) { setMessage(result.error.message); return }
        setDecision(null); commandRef.current = null; setMessage(result.status === 'idempotent-replay' ? 'Tanda terima tersimpan diputar ulang dengan aman.' : 'Hasil resmi diperbarui.'); await load(); return
      }
      if (decision === 'cancel') {
        const command = { ...base, operation: 'cancel-pending-winners' as const, reason, ...(note.trim() ? { note: note.trim() } : {}), targets: selectedWinners.map((winner) => ({ winnerId: winner.id, expectedStatus: 'pending' as const })) }
        commandRef.current = { id, command }
        const result = await services.pendingDecisions.cancellation.cancel(command)
        if (result.status === 'unknown') { setMessage('Hasil perintah tidak diketahui. Muat ulang record otoritatif sebelum mencoba lagi dengan ID perintah yang sama.'); return }
        if ('error' in result) { setMessage(result.error.message); return }
        setDecision(null); commandRef.current = null; setMessage(result.status === 'idempotent-replay' ? 'Tanda terima tersimpan diputar ulang dengan aman.' : 'Hasil resmi diperbarui.'); await load(); return
      }
      const command = decision === 'redraw-confirmed'
        ? { ...base, operation: 'redraw-confirmed-winners' as const, reason, ...(note.trim() ? { note: note.trim() } : {}), targets: selectedWinners.map((winner) => ({ winnerId: winner.id, expectedStatus: 'confirmed' as const })) }
        : { ...base, operation: 'redraw-pending-winners' as const, reason, ...(note.trim() ? { note: note.trim() } : {}), targets: selectedWinners.map((winner) => ({ winnerId: winner.id, expectedStatus: 'pending' as const })) }
      commandRef.current = { id, command }
      const result = await services.pendingDecisions.redraw.redraw(command)
      if (result.status === 'unknown') { setMessage('Hasil perintah tidak diketahui. Muat ulang record otoritatif sebelum mencoba lagi dengan ID perintah yang sama.'); return }
      if ('error' in result) { setMessage(result.error.message); return }
      setDecision(null); commandRef.current = null; setMessage(result.status === 'idempotent-replay' ? 'Tanda terima tersimpan diputar ulang dengan aman.' : 'Hasil resmi diperbarui.'); await load()
    } catch { setMessage('Perintah tidak dapat disimpan dengan aman. Muat ulang record otoritatif sebelum mencoba lagi.') }
    finally { setBusy(false) }
  }

  const isReadOnly = session.status === 'cancelled'
  const dialogTitle = decision === 'confirm' ? `Konfirmasi ${selectedWinners.length} pemenang` : decision === 'cancel' ? `Batalkan ${selectedWinners.length} pemenang` : decision === 'redraw-confirmed' ? 'Undi ulang pemenang terkonfirmasi' : 'Undi ulang pemenang tertunda'
  const remainingPending = Math.max(0, pending.length - selectedWinners.filter((winner) => winner.status === 'pending').length)
  const replacements = winners.filter((winner) => winner.sequenceNumber > (session.configurationSnapshot?.requestedWinners ?? Number.MAX_SAFE_INTEGER))
  return <section aria-labelledby="pending-title" className={`pending-results pending-results--production${session.status === 'completed' ? ' pending-results--completed' : ''}`}>
    <PageHeader eyebrow={session.status === 'completed' ? 'UNDIAN SELESAI · LIVE' : 'Live · produksi resmi'} headingId="pending-title" title={session.status === 'completed' ? 'Hasil Akhir' : 'Tinjau Pemenang'} description={`${category.prizeName} · ${category.name}`} />
    {message === null || session.status === 'completed' ? null : <StatusBanner badge="Tindakan Operator" title="Rekonsiliasi diperlukan" tone="warning">{message}</StatusBanner>}
    {isReadOnly ? <StatusBanner badge="Dibatalkan" title="Hasil terselesaikan · hanya baca" tone="warning">Sesi ini tetap berada dalam riwayat resmi dan tidak dapat diubah di sini.</StatusBanner> : session.status === 'completed' ? <div className="pending-results__completion-state" role="status"><div className="pending-results__completion-copy"><span>UNDIAN SELESAI</span><strong>Peninjauan pemenang selesai</strong><p>Semua {confirmed.length} pemenang telah dikonfirmasi dan siap untuk undian berikutnya.</p></div><div className="pending-results__completion-actions"><ButtonLink icon={<Icon name="Play" />} size="lg" to="/draw/setup" variant="primary">Mulai Undian Berikutnya</ButtonLink><ButtonLink icon={<Icon name="History" />} to="/history" variant="secondary">Lihat Riwayat</ButtonLink></div></div> : null}
    <div className="pending-results__summary" aria-label="Ringkasan hasil">
      {([['Total pemenang', winners.length, ''], ['Tertunda', pending.length, 'pending'], ['Dikonfirmasi', confirmed.length, 'confirmed'], ['Dibatalkan', cancelled.length, 'cancelled'], ['Pengganti', replacements.length, 'replacements']] as const).map(([label, value, tone]) => <div className={`pending-results__metric ${tone === '' ? '' : `pending-results__metric--${tone}`}`} key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <div className="pending-results__workspace">
      {!isReadOnly && pending.length > 0 ? <Card padding="none" className="pending-results__queue"><div className="pending-results__section-heading"><div><p className="operator-eyebrow">Keputusan pemenang</p><h2>Pilih pemenang</h2><p>Pilih pemenang, lalu konfirmasi, batalkan, atau undi ulang sesuai kebutuhan.</p></div><Button icon={selectedWinners.length === pending.length ? <Icon name="ListX" /> : <Icon name="ListChecks" />} onClick={toggleAllPending} variant="secondary" disabled={busy || pending.length === 0}>{bulkSelectionLabel}</Button></div><div className="pending-results__selection-status" aria-live="polite"><strong>{pending.length} pending</strong><span>{selectedWinners.length > 0 ? `${selectedWinners.length} dipilih` : 'Belum ada pemenang dipilih'}</span></div><ul aria-label="Pemenang tertunda" className="pending-results__winner-list">{winners.map((winner) => <li className="pending-results__winner-row" data-result-status={winner.status} key={winner.id}><label><input checked={selected.has(winner.id)} disabled={winner.status !== 'pending' || busy} onChange={() => toggle(winner.id)} type="checkbox" /><span className="pending-results__winner-sequence">#{winner.sequenceNumber}</span><code className="pending-results__winner-ticket">{winner.ticketNumber}</code><Badge variant={winner.status === 'pending' ? 'pending' : winner.status === 'confirmed' ? 'confirmed' : 'danger'}>{statusLabel(winner.status)}</Badge>{winner.status === 'cancelled' ? <small>Dipertahankan dalam riwayat resmi</small> : null}</label></li>)}</ul><div className="pending-results__action-bar"><div><strong>Tindakan keputusan</strong><span>{selectedWinners.length > 0 ? `Terapkan ke ${selectedWinners.length} pemenang yang dipilih.` : 'Pilih satu atau beberapa pemenang tertunda untuk melanjutkan.'}</span></div><div className="pending-results__actions"><Button className="pending-results__action pending-results__action--confirm" icon={<Icon name="CircleCheck" />} disabled={!canDecide} onClick={() => openDecision('confirm')}>Konfirmasi{selectedWinners.length > 0 ? ` ${selectedWinners.length}` : ''}</Button><Button className="pending-results__action pending-results__action--cancel" icon={<Icon name="CircleX" />} disabled={!canDecide} onClick={() => openDecision('cancel')} variant="danger">Batalkan{selectedWinners.length > 0 ? ` ${selectedWinners.length}` : ''}</Button><Button className="pending-results__action pending-results__action--redraw" icon={<Icon name="RotateCcw" />} disabled={!canDecide || !capacityEnough} onClick={() => openDecision('redraw-pending')} variant="secondary">Undi Ulang{selectedWinners.length > 0 ? ` ${selectedWinners.length}` : ''}</Button></div></div></Card> : null}
      <Card padding="md" className="pending-results__details"><div className="pending-results__section-heading"><div><p className="operator-eyebrow">Konteks Operator</p><h2>Detail Hasil</h2></div><Badge variant="live">Live</Badge></div><dl className="pending-results__details-list"><div><dt>Acara</dt><dd>{event.name}</dd></div><div><dt>Kategori hadiah</dt><dd>{category.name}</dd></div><div><dt>Hadiah</dt><dd>{category.prizeName}</dd></div><div><dt>Jumlah pemenang</dt><dd>{winners.length}</dd></div><div><dt>Pool yang memenuhi syarat</dt><dd>{session.candidatePoolSnapshot?.eligibleSnapshotCount ?? '—'}</dd></div><div><dt>Waktu undian</dt><dd>{formatOperatorDateTime(session.createdAt)}</dd></div></dl><div className="pending-results__capacity"><span>Kapasitas undian ulang</span><strong>{displayedReplacementCapacity} pengganti yang memenuhi syarat tersedia</strong><small>Identitas pengganti tidak dipilih sampai undian ulang diminta.</small></div></Card>
    </div>
    {session.status === 'completed' && confirmed.length > 0 ? <Card padding="sm" className="pending-results__completed-actions"><div className="pending-results__correction-actions"><div><p className="operator-eyebrow">Koreksi / Pemulihan</p><h2>Perlu mengoreksi hasil ini?</h2></div><Button icon={<Icon name="RotateCcw" />} disabled={busy} onClick={() => { setSelected(new Set(confirmed.map((winner) => winner.id))); openDecision('redraw-confirmed') }} variant="danger">Undi ulang pemenang terkonfirmasi</Button></div></Card> : null}
    <details className="pending-results__audit"><summary>Record pemenang otoritatif <span>{winners.length} record</span></summary><div><ol aria-label="Pemenang resmi">{winners.map((winner) => { const redraw = redraws.find((candidate) => candidate.originalWinnerRecordId === winner.id); const replacement = redraw === undefined ? undefined : winners.find((candidate) => candidate.id === redraw.replacementWinnerRecordId); return <li key={winner.id}><code>{winner.ticketNumber}</code> <Badge variant={winner.status === 'pending' ? 'pending' : winner.status === 'confirmed' ? 'confirmed' : 'danger'}>{statusLabel(winner.status)}</Badge>{winner.confirmedAt ? ` · dikonfirmasi ${winner.confirmedAt}` : ''}{winner.cancelledAt ? ` · dibatalkan ${winner.cancelledAt}` : ''}{redraw === undefined ? null : <> · pengganti <code>{replacement?.ticketNumber ?? 'tidak tersedia'}</code> ({replacement?.status ?? 'tidak tersedia'})</>}</li> })}</ol><p><small>WinnerRecord asli tetap terlihat untuk peninjauan audit dan hubungan pengganti.</small></p></div></details>
    {session.status === 'completed' ? null : <nav className="pending-results__navigation" aria-label="Navigasi hasil tertunda"><Link to="/history"><Icon name="History" />Buka riwayat resmi</Link><Link to="/draw/setup"><Icon name="ArrowLeft" />Kembali ke Pengaturan Undian</Link></nav>}
    {decision === 'cancel' ? <CancelWinnerDialog selectedWinners={selectedWinners} reason={reason} note={note} busy={busy} onReasonChange={setReason} onNoteChange={setNote} onCancel={() => { if (!busy) setDecision(null) }} onConfirm={() => void submit()} /> : <ConfirmationDialog headerIcon={decision === 'confirm' ? <Icon name="CircleCheck" /> : <Icon name="RotateCcw" />} headerIconTone={decision === 'confirm' ? 'success' : 'danger'} cancelLabel="Kembali" consequenceLabel={null} confirmDisabled={busy || (decision === 'redraw-pending' && !capacityEnough) || (decision !== 'confirm' && reason === 'other' && note.trim() === '')} confirmLabel={decision === 'confirm' ? 'Konfirmasi secara resmi' : 'Undi ulang secara resmi'} confirmLoading={busy} consequence={<div className="pending-results__decision-content"><div className="pending-results__decision-consequence"><p>{decision === 'confirm' ? <>Pemenang ini akan ditambahkan ke hasil resmi.{remainingPending > 0 ? ` ${remainingPending} pemenang akan tetap tertunda.` : ''}</> : <>Ini adalah tindakan Live resmi yang destruktif. Hasil asli yang dipilih tetap terlihat dan pengganti akan tertunda setelah disimpan. Kapasitas tersedia: {replacementCapacity}.</>}{decision === 'redraw-confirmed' ? ' Hasil yang selesai akan kembali menjadi menunggu konfirmasi; pemenang terkonfirmasi yang tidak terdampak tetap terkonfirmasi.' : ''}</p></div>{decision === 'confirm' ? null : <div className="pending-results__decision-form"><ReasonSelect id="reason" reason={reason} busy={busy} onChange={setReason} /><label className="ui-field" htmlFor="note"><span className="ui-field__label">Catatan {reason === 'other' ? '(wajib)' : '(opsional)'}</span><textarea className="ui-input pending-results__note" id="note" disabled={busy} onChange={(event) => setNote(event.target.value)} placeholder="Tambahkan konteks untuk record audit…" value={note} /></label></div>}</div>} onCancel={() => { if (!busy) setDecision(null) }} onConfirm={() => void submit()} open={decision !== null} title={dialogTitle} tone={decision === 'confirm' ? 'warning' : 'danger'} />}
  </section>
}
