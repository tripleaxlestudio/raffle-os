import { useUiClass } from '../../shared/ui/ui-theme.ts'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { isDrawAuthoringDraftDirty, type DrawAuthoringDraft, type DrawAuthoringRecord } from '../../application/draw/draw-authoring.types.ts'
import { isDrawSessionAuthoringLocked } from '../../domain/draws/draw-session.types.ts'
import { normalizeDrawPresentationConfiguration, type DrawPresentationConfiguration } from '../../domain/draws/draw-presentation.types.ts'
import type { DrawSetupProductionServices } from '../../application/draw/draw-setup-query.types.ts'
import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import { queryDrawReadiness } from '../../application/draw/draw-readiness-query.ts'
import type { DrawReadinessResult } from '../../application/draw/draw-readiness.types.ts'
import { DrawAuthoringError } from '../../application/draw/draw-authoring-errors.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Badge, Button, ButtonLink, Card, Checkbox, ConfirmationDialog, Icon, Input, Modal, Select } from '../../shared/ui/index.ts'
import { signalProductionWorkspaceChanged } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { DrawPresentationSettings } from '../../ui/operator/draw/DrawPresentationSettings.tsx'
import { ProductionLoadingState, ProductionSetupRequired } from '../../shared/components/ProductionWorkspaceState.tsx'

type FormState = {
  eventId: string
  prizeCategoryId: string
  requestedWinners: string
  winningRule: string
  requireCheckIn: boolean
  eligibleGroupFilter: string
  mode: string
  presentation: DrawPresentationConfiguration
  configurationId?: string
  sessionId?: string
}

const emptyForm: FormState = { eventId: '', prizeCategoryId: '', requestedWinners: '1', winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: '', mode: 'practice', presentation: normalizeDrawPresentationConfiguration(undefined) }
const QUICK_WINNER_COUNTS = [1, 3, 6, 10, 20, 50] as const
type PrizeSelectorStatus = 'available' | 'ready' | 'active' | 'completed'
const PRIZE_SELECTOR_STATUS_LABELS: Record<PrizeSelectorStatus, string> = { available: 'TERSEDIA', ready: 'SIAP', active: 'AKTIF', completed: 'SELESAI' }

function getPrizeSelectorStatus(category: PrizeCategory, configurations: readonly DrawConfiguration[], sessions: readonly DrawSession[]): PrizeSelectorStatus {
  const configurationIds = new Set(configurations.filter((configuration) => configuration.prizeCategoryId === category.id).map((configuration) => configuration.id))
  const categorySessions = sessions.filter((session) => configurationIds.has(session.configurationId))
  if (categorySessions.some((session) => session.mode === 'live' && (session.status === 'drawing' || session.status === 'pending-confirmation'))) return 'active'
  if (categorySessions.some((session) => session.status === 'ready')) return 'ready'
  if (categorySessions.some((session) => session.mode === 'live' && session.status === 'completed')) return 'completed'
  return 'available'
}

function groupPrizeCategories(categories: readonly PrizeCategory[], configurations: readonly DrawConfiguration[], sessions: readonly DrawSession[]): Readonly<Record<PrizeSelectorStatus, readonly PrizeCategory[]>> {
  const grouped: Record<PrizeSelectorStatus, PrizeCategory[]> = { available: [], ready: [], active: [], completed: [] }
  for (const category of categories) grouped[getPrizeSelectorStatus(category, configurations, sessions)].push(category)
  return grouped
}

function formFromRecord(record: DrawAuthoringRecord | null, eventId: string): FormState {
  if (record === null) return { ...emptyForm, eventId }
  return { eventId: record.event.id, prizeCategoryId: record.category.id, requestedWinners: String(record.configuration.requestedWinners), winningRule: record.configuration.winningRule, requireCheckIn: record.configuration.requireCheckIn, eligibleGroupFilter: record.configuration.eligibleGroupFilter ?? '', mode: record.session.mode, presentation: normalizeDrawPresentationConfiguration(record.configuration.presentation), configurationId: record.configuration.id, sessionId: record.session.id }
}

function errorText(error: DrawAuthoringError): string {
  return error.message
}

function draftFromForm(form: FormState): DrawAuthoringDraft {
  return { ...form, eligibleGroupFilter: form.eligibleGroupFilter === '' ? null : form.eligibleGroupFilter, presentation: form.presentation }
}

function PendingReviewModal({ record, open }: { readonly record: DrawAuthoringRecord; readonly open: boolean }) {
  const uiClass = useUiClass()
  const winnerLabel = `${record.configuration.requestedWinners} pemenang`
  return <Modal open={open} closeOnEscape={false} showCloseButton={false} eyebrow="PERLU TINDAKAN" title="Pemenang menunggu peninjauan" onClose={() => undefined} footer={<ButtonLink icon={<Icon name="ClipboardCheck" />} to={`/draw/pending/${record.session.id}`}>Tinjau Hasil</ButtonLink>}>
    <div className={uiClass("draw-setup-pending-modal__body")}>
      <strong className={uiClass("draw-setup-pending-modal__prize")}>{record.category.prizeName}</strong>
      <p className={uiClass("draw-setup-pending-modal__meta")}>{record.category.name} · <strong>{winnerLabel}</strong></p>
      <p>Selesaikan peninjauan pemenang sebelum menyiapkan undian resmi berikutnya.</p>
    </div>
  </Modal>
}

export function DrawSetupPage({ services: suppliedServices }: { services?: DrawSetupProductionServices } = {}) {
  const uiClass = useUiClass()
  const services = useMemo(() => suppliedServices ?? createDrawSetupProductionServices(), [suppliedServices])
  const navigate = useNavigate()
  const handoffTriggerRef = useRef<HTMLButtonElement>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [record, setRecord] = useState<DrawAuthoringRecord | null>(null)
  const [categories, setCategories] = useState<DrawAuthoringRecord['category'][]>([])
  const [prizeStatuses, setPrizeStatuses] = useState<Readonly<Record<PrizeSelectorStatus, readonly PrizeCategory[]>>>({ available: [], ready: [], active: [], completed: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<DrawAuthoringError | null>(null)
  const [saved, setSaved] = useState(false)
  const [eventMissing, setEventMissing] = useState(false)
  const [readiness, setReadiness] = useState<DrawReadinessResult | null>(null)
  const [confirmLive, setConfirmLive] = useState(false)
  const [handoffBusy, setHandoffBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await services.open()
      if (services.authoringService === undefined) { setError(new DrawAuthoringError('persistence-unavailable', 'Layanan penyusunan undian tidak tersedia.', { retryable: true })); return }
      const activeEventId = await services.preferences.get('activeEventId')
      const result = await services.authoringService.load({ eventId: activeEventId ?? undefined })
      if (!result.ok) { setError(result.error); return }
      setEventMissing(result.event === null)
      setCategories(result.categories as DrawAuthoringRecord['category'][])
      const eventId = result.event?.id ?? activeEventId
      if (eventId === null) setPrizeStatuses({ available: [], ready: [], active: [], completed: [] })
      else {
        const [configurations, sessions] = await Promise.all([services.configurations.findByEventId(eventId), services.sessions.findByEventId(eventId)])
        setPrizeStatuses(groupPrizeCategories(result.categories, configurations, sessions))
      }
      setRecord(result.record)
      setForm(formFromRecord(result.record, result.event?.id ?? activeEventId ?? ''))
      if (result.record !== null && services.checkStorage !== undefined && services.checkCrypto !== undefined) setReadiness(await queryDrawReadiness(result.record.session.id, { ...services, checkStorage: services.checkStorage, checkCrypto: services.checkCrypto }))
      else setReadiness(null)
    } catch (cause: unknown) {
      setError(new DrawAuthoringError('read-failure', 'Data resmi Pengaturan Undian tidak dapat dibaca.', { retryable: true, cause }))
    } finally { setLoading(false) }
  }, [services])

  useEffect(() => { void Promise.resolve().then(load) }, [load])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setSaved(false); setError(null); setForm((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    if (saving) return
    setSaving(true); setSaved(false); setError(null)
    const draft = draftFromForm(form)
    if (services.authoringService === undefined) { setError(new DrawAuthoringError('persistence-unavailable', 'Layanan penyusunan undian tidak tersedia.', { retryable: true })); setSaving(false); return }
    const result = await services.authoringService.save(draft)
    if (result.ok) { setRecord(result.record); setForm(formFromRecord(result.record, result.record.event.id)); setPrizeStatuses((current) => ({ ...current, ready: current.ready.some((category) => category.id === result.record.category.id) ? current.ready : [...current.ready, result.record.category], available: current.available.filter((category) => category.id !== result.record.category.id), active: current.active.filter((category) => category.id !== result.record.category.id), completed: current.completed.filter((category) => category.id !== result.record.category.id) })); setSaved(true); signalProductionWorkspaceChanged(); if (services.checkStorage !== undefined && services.checkCrypto !== undefined) setReadiness(await queryDrawReadiness(result.record.session.id, { ...services, checkStorage: services.checkStorage, checkCrypto: services.checkCrypto })) }
    else setError(result.error)
    setSaving(false)
  }

  const selectedCategory = categories.find((category) => category.id === form.prizeCategoryId)
  const prizeGroups: readonly PrizeSelectorStatus[] = ['available', 'ready', 'active', 'completed']
  const refreshReadiness = async () => {
    if (record === null || services.checkStorage === undefined || services.checkCrypto === undefined) return
    setReadiness(await queryDrawReadiness(record.session.id, { ...services, checkStorage: services.checkStorage, checkCrypto: services.checkCrypto }))
  }
  const handoff = async () => {
    if (handoffBusy || dirty || record === null || readiness?.state !== 'ready') return
    setHandoffBusy(true)
    const latest = services.checkStorage !== undefined && services.checkCrypto !== undefined ? await queryDrawReadiness(record.session.id, { ...services, checkStorage: services.checkStorage, checkCrypto: services.checkCrypto }) : readiness
    setReadiness(latest)
    if (latest.state === 'ready' && latest.data !== undefined) navigate(`/draw/run/${latest.data.session.id}`)
    setHandoffBusy(false)
  }

  if (loading) return <section className={uiClass("draw-setup")} aria-busy="true"><PageHeader eyebrow="Penyusunan undian" headingId="draw-setup-title" title="Pengaturan Undian" description="Memuat Acara dan konfigurasi tersimpan…" /><ProductionLoadingState description="Membaca status pengaturan resmi…" /></section>
  if (eventMissing || form.eventId === '') return <section className={uiClass("draw-setup")}><PageHeader eyebrow="Penyusunan undian" headingId="draw-setup-title" title="Pengaturan Undian" description="Tidak ada Acara tersimpan" /><ProductionSetupRequired description="Pilih atau buat Acara sebelum mengatur undian." />{error?.retryable ? <Button icon={<Icon name="RefreshCw" />} onClick={() => void load()}>Coba lagi</Button> : null}</section>

  const started = record !== null && isDrawSessionAuthoringLocked(record.session)
  const dirty = isDrawAuthoringDraftDirty(draftFromForm(form), record)
  const readinessBlocked = readiness !== null && readiness.state !== 'ready'
  const eligibilityNotEvaluated = readiness?.state === 'session-conflict'
  const capacity = dirty ? undefined : readiness?.data
  const readinessTitle = readiness?.state === 'ready' ? 'Undian siap dilanjutkan' : readiness?.state === 'insufficient-capacity' ? 'Jumlah peserta memenuhi syarat tidak cukup' : readiness?.state === 'session-conflict' ? 'Sesi Live lain harus diselesaikan' : readiness?.state === 'session-not-ready' ? 'Sesi undian belum siap' : readiness?.state === 'storage-unavailable' ? 'Penyimpanan lokal tidak tersedia' : readiness?.state === 'crypto-unavailable' ? 'Web Crypto aman tidak tersedia' : readiness?.state === undefined ? 'Kesiapan belum dievaluasi' : 'Kelanjutan undian diblokir'
  const readinessBadge = readiness?.state === 'ready' ? 'Siap' : dirty ? 'Perlu disimpan' : 'Diblokir'
  const readinessTone = readiness?.state === 'ready' ? 'success' : dirty ? 'info' : 'warning'
  const pendingReviewRequired = record?.session.mode === 'live' && record.session.status === 'pending-confirmation'

  return <section aria-labelledby="draw-setup-title" className={uiClass("draw-setup")}>
    <PageHeader eyebrow="Penyusunan undian" headingId="draw-setup-title" title="Pengaturan Undian" description={record?.event.name ?? 'Buat sesi siap yang tersimpan'} />
    {saved ? <StatusBanner badge="Tersimpan" title="Sesi undian siap telah disimpan" tone="success">Nilai di bawah berhasil dibaca kembali dari penyimpanan lokal. Tidak ada pemenang, checkpoint, atau audit mulai-undian yang dibuat.</StatusBanner> : null}
    {error ? <StatusBanner badge={error.retryable ? 'Dapat dicoba lagi' : 'Kesalahan validasi'} title="Pengaturan Undian tidak dapat disimpan" tone="warning">{errorText(error)}{error.retryable ? ' Anda dapat mencoba lagi tanpa kehilangan nilai formulir.' : ''}</StatusBanner> : null}
    {started ? <StatusBanner badge="Terkunci" title="Sesi undian ini tidak dapat diedit" tone="warning">Sesi tersimpan berstatus {record?.session.status.replace('-', ' ')}. Sesi tidak direset ke siap dan data resminya tetap tidak berubah.</StatusBanner> : null}
    {categories.length === 0 ? <StatusBanner badge="Kategori diperlukan" title="Buat Kategori Hadiah sebelum mengatur undian" tone="warning"><ButtonLink icon={<Icon name="Trophy" />} to="/prize-categories">Buka pengelolaan Kategori Hadiah</ButtonLink></StatusBanner> : null}
    <Card className={uiClass("draw-panel")} padding="md" tone="raised">
      <form onSubmit={(event) => { event.preventDefault(); void save() }}>
        <section className={uiClass("draw-setup-capacity-section")} aria-labelledby="capacity-summary-title">
          <div className={uiClass("draw-setup-section__heading")}><div><p className={uiClass("operator-eyebrow")}>Kapasitas</p><h2 id="capacity-summary-title">Ringkasan peserta memenuhi syarat</h2></div></div>
          <dl aria-label="Metrik peserta memenuhi syarat" className={uiClass("eligible-pool-metrics draw-setup-capacity-metrics")}>
            <div><dt>Total peserta</dt><dd>{capacity?.totalParticipantCount ?? '—'}</dd></div>
            <div><dt>Peserta sudah check-in</dt><dd>{capacity?.checkedInParticipantCount ?? '—'}</dd></div>
            <div><dt>Pemenang sebelumnya dikecualikan</dt><dd>{capacity?.previousWinnerExcludedCount ?? '—'}</dd></div>
            <div className={uiClass("eligible-pool-metrics__highlight")}><dt>Memenuhi syarat</dt><dd>{capacity?.authoritativeEligibleCount ?? '—'}</dd></div>
            <div className={uiClass("eligible-pool-metrics__highlight eligible-pool-metrics__highlight--secondary")}><dt>Pemenang diminta</dt><dd>{capacity?.requestedWinnerCount ?? '—'}</dd></div>
          </dl>
          <div className={uiClass("draw-setup-capacity-readiness")}>
            <StatusBanner badge={readinessBadge} title={readinessTitle} tone={readinessTone}>{dirty ? 'Simpan perubahan untuk mengevaluasi kelayakan dan kesiapan.' : readiness?.state === 'ready' ? `Penyimpanan dan Web Crypto aman siap. Tersedia ${readiness.data?.authoritativeEligibleCount} peserta memenuhi syarat untuk ${readiness.data?.requestedWinnerCount} pemenang yang diminta.` : readiness?.reason ?? 'Kesiapan sedang diperiksa.'}{eligibilityNotEvaluated ? ' Kelayakan tidak dievaluasi karena sesi Live aktif atau menunggu konfirmasi harus diselesaikan terlebih dahulu.' : null}{!dirty && readiness?.retryable ? ' Coba periksa kesiapan lagi setelah masalah diperbaiki.' : null}</StatusBanner>
          </div>
        </section>
        <div className={uiClass("draw-setup__layout")}>
          <div className={uiClass("draw-setup__main")}>
            <section className={uiClass("draw-setup-section")} aria-labelledby="draw-identity-title">
              <div className={uiClass("draw-setup-section__heading")}><div><p className={uiClass("operator-eyebrow")}>Identitas undian</p><h2 id="draw-identity-title">Acara dan hadiah</h2></div><Badge variant={form.mode === 'live' ? 'live' : 'practice'}>{form.mode === 'live' ? 'LIVE' : 'LATIHAN'}</Badge></div>
              <div className={uiClass("draw-field-grid")}>
                <Select label="Acara" value={form.eventId} onChange={(event) => update('eventId', event.target.value)} disabled><option value={form.eventId}>{record?.event.name ?? form.eventId}</option></Select>
                <Select label="Hadiah" value={form.prizeCategoryId} onChange={(event) => update('prizeCategoryId', event.target.value)} disabled={started}><option value="">Pilih hadiah</option>{prizeGroups.map((status) => prizeStatuses[status].length === 0 ? null : <optgroup key={status} label={PRIZE_SELECTOR_STATUS_LABELS[status]}>{prizeStatuses[status].map((category) => <option key={category.id} value={category.id}>{category.prizeName} · {category.name} · {PRIZE_SELECTOR_STATUS_LABELS[status]}</option>)}</optgroup>)}</Select>
                <Input label="Kategori" value={selectedCategory?.name ?? ''} readOnly description="Kategori terikat pada Hadiah tersimpan." />
              </div>
            </section>
            <section className={uiClass("draw-setup-section")} aria-labelledby="winner-quantity-title">
              <div className={uiClass("draw-setup-section__heading")}><h2 id="winner-quantity-title">Jumlah pemenang</h2><span className={uiClass("draw-setup-section__hint")}>Disimpan ke DrawConfiguration</span></div>
              <div className={uiClass("winner-count-controls")}><div className={uiClass("winner-count-controls__presets")}><div className={uiClass("winner-count-choices")} aria-label="Pilihan cepat jumlah pemenang">{QUICK_WINNER_COUNTS.map((count) => <Button key={count} type="button" size="sm" variant={form.requestedWinners === String(count) ? 'primary' : 'secondary'} aria-pressed={form.requestedWinners === String(count)} onClick={() => update('requestedWinners', String(count))} disabled={started}>{count}</Button>)}</div><span className={uiClass("draw-setup-section__hint")}>Pilih preset atau masukkan 1–100. Simpan untuk menghitung ulang kesiapan.</span></div><Input label="Jumlah pemenang khusus" type="number" min={1} max={100} step={1} value={form.requestedWinners} onChange={(event) => update('requestedWinners', event.target.value)} disabled={started} /></div>
            </section>
            <DrawPresentationSettings configuration={form.presentation} winnerCount={Number(form.requestedWinners)} disabled={started} onChange={(presentation) => update('presentation', presentation)} />
            <section className={uiClass("draw-setup-section")} aria-labelledby="eligibility-rules-title">
              <div className={uiClass("draw-setup-section__heading")}><h2 id="eligibility-rules-title">Aturan kelayakan</h2></div>
              <div className={uiClass("eligibility-control-grid")}>
                <Select label="Aturan kemenangan" value={form.winningRule} onChange={(event) => update('winningRule', event.target.value)} disabled={started}><option value="once-per-event">Sekali per Acara</option><option value="once-per-category">Sekali per kategori</option><option value="allow-repeat">Boleh menang lagi</option></Select>
                <Input label="Filter grup memenuhi syarat" value={form.eligibleGroupFilter} onChange={(event) => update('eligibleGroupFilter', event.target.value)} disabled={started} description="Kosongkan untuk menyertakan semua grup." />
                <Checkbox label="Wajib check-in" checked={form.requireCheckIn} onChange={(event) => update('requireCheckIn', event.target.checked)} disabled={started} description="Hanya Peserta yang sudah check-in yang memenuhi syarat." />
              </div>
            </section>
          </div>
          <div className={uiClass("draw-setup__aside")}>
            <Card className={uiClass("draw-setup-support-card")} padding="md">
            <fieldset className={uiClass("draw-mode-options")}><legend>Mode penyusunan</legend><div className={uiClass("draw-mode-options__list")}>
              <label className={uiClass("draw-mode-option")}><input id="draw-mode-practice" type="radio" name="draw-mode" value="practice" aria-labelledby="draw-mode-practice-label" aria-describedby="draw-mode-practice-description" checked={form.mode === 'practice'} onChange={() => update('mode', 'practice')} disabled={started} /><span className={uiClass("draw-mode-option__copy")}><strong id="draw-mode-practice-label">Latihan</strong><small id="draw-mode-practice-description">Hanya simulasi. Tidak ada hasil resmi yang dibuat.</small></span></label>
              <label className={uiClass("draw-mode-option")}><input id="draw-mode-live" type="radio" name="draw-mode" value="live" aria-labelledby="draw-mode-live-label" aria-describedby="draw-mode-live-description" checked={form.mode === 'live'} onChange={() => update('mode', 'live')} disabled={started} /><span className={uiClass("draw-mode-option__copy")}><strong id="draw-mode-live-label">Live</strong><small id="draw-mode-live-description">Sesi resmi. Konfirmasi diperlukan sebelum memulai.</small></span></label>
            </div></fieldset>
            <p>{form.mode === 'live' ? 'Mode Live membuka gerbang mulai resmi. Undian belum dimulai di sini.' : 'Mode Latihan hanya simulasi dan tidak membuat hasil resmi.'} Mode disimpan pada sesi undian siap; parameter URL tidak dapat menggantinya.</p>
            <div className={uiClass("draw-setup-actions")}>
              <Button icon={<Icon name="Save" />} type="submit" size="lg" variant={record === null || dirty ? 'primary' : 'secondary'} isLoading={saving} disabled={started || !dirty || form.prizeCategoryId === ''}>{record === null ? 'Simpan konfigurasi siap' : 'Simpan perubahan'}</Button>
              {saved ? <ButtonLink icon={<Icon name="Radio" />} size="lg" variant="secondary" to="/draw/live">Buka Sesi Undian</ButtonLink> : null}
              {record !== null ? <Button icon={<Icon name="ArrowRight" />} iconAfter ref={handoffTriggerRef} type="button" size="lg" variant={!dirty && !readinessBlocked && readiness !== null ? 'primary' : 'secondary'} disabled={saving || handoffBusy || dirty || readinessBlocked || readiness === null} isLoading={handoffBusy} onClick={() => { if (form.mode === 'live') setConfirmLive(true); else void handoff() }}>{form.mode === 'live' ? 'Lanjutkan ke gerbang mulai Live' : 'Buka gerbang mulai Latihan'}</Button> : null}
              {readiness?.retryable ? <Button icon={<Icon name="RefreshCw" />} type="button" variant="secondary" onClick={() => void refreshReadiness()}>Periksa kesiapan lagi</Button> : null}
            </div>
            </Card>
          </div>
        </div>
      </form>
    </Card>
    <ConfirmationDialog headerIcon={<Icon name="ShieldAlert" />} headerIconTone="warning" open={confirmLive} title="Konfirmasi kelanjutan Mode Live" confirmLabel="Konfirmasi kelanjutan Live" onCancel={() => { setConfirmLive(false); handoffTriggerRef.current?.focus() }} onConfirm={() => { setConfirmLive(false); void handoff() }} consequence={record === null || readiness?.data === undefined ? 'Sesi Live tersimpan akan divalidasi ulang sebelum dilanjutkan.' : <span>Acara: {readiness.data?.event.name}. Hadiah: {readiness.data?.category.prizeName}. Pemenang: {readiness.data?.requestedWinnerCount}. Memenuhi syarat: {readiness.data?.authoritativeEligibleCount}. Mode: Live. Tindakan ini hanya membuka gerbang mulai; belum memilih pemenang.</span>} />
    {record === null ? null : <PendingReviewModal record={record} open={pendingReviewRequired} />}
  </section>
}
