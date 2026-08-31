import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, ButtonLink, Card, Icon } from '../../shared/ui/index.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { queryDrawSessionQueue, type DrawSessionQueueResult } from '../../application/draw/draw-session-queue.ts'
import { useProductionAudiencePublisher, useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { groupDrawSessionQueueDecks, presentDrawSessionQueueItem, selectCurrentOperationalQueueItems, type DrawSessionQueueDeck } from '../../ui/operator/draw/draw-session-queue-view-model.ts'
import { presentAudienceConnection } from '../../ui/operator/draw/audience-connection-view-model.ts'
import { ProductionLoadingState, ProductionSetupRequired } from '../../shared/components/ProductionWorkspaceState.tsx'
import { AudienceDisplayButton } from '../../shared/components/AudienceDisplayButton.tsx'
import { formatProductionTime } from '../../shared/localization/production-locale.ts'

function audienceUrl(eventId: string, displayConfigurationId: string): string {
  return `/display?eventId=${encodeURIComponent(eventId)}&displayConfigurationId=${encodeURIComponent(displayConfigurationId)}`
}

function formatAcknowledgedAt(value: string | undefined): string {
  if (value === undefined) return 'Snapshot publik terakhir telah dikonfirmasi.'
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return 'Snapshot publik terakhir telah dikonfirmasi.'
  return `Snapshot terakhir dikonfirmasi: ${formatProductionTime(timestamp)}`
}

export function DrawSessionQueuePage() {
  const workspace = useProductionWorkspace()
  const audience = useProductionAudiencePublisher()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; queue: DrawSessionQueueResult }>({ status: 'loading' })
  const [audienceStatus, setAudienceStatus] = useState(audience.status)
  const [selectedModes, setSelectedModes] = useState<Readonly<Record<string, 'practice' | 'live'>>>({})
  const load = useCallback(async () => {
    if (workspace.status !== 'ready') return
    setState({ status: 'loading' })
    try {
      await services.open()
      const queue = await queryDrawSessionQueue(workspace.event.id, services)
      if (queue === null) setState({ status: 'error', message: 'Acara aktif tidak dapat dibaca kembali dari penyimpanan lokal.' })
      else setState({ status: 'ready', queue })
    } catch (cause: unknown) {
      setState({ status: 'error', message: cause instanceof Error ? cause.message : 'Sesi undian tidak dapat dibaca dengan aman.' })
    }
  }, [services, workspace])

  useEffect(() => { void Promise.resolve().then(load) }, [load])
  useEffect(() => audience.subscribe(setAudienceStatus), [audience])

  if (workspace.status === 'loading' || state.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="OPERASI LIVE" headingId="draw-queue-title" title="Undian" description="Membaca sesi lokal resmi…" /><ProductionLoadingState description="Membaca sesi lokal resmi…" /></section>
  if (workspace.status === 'empty' || workspace.status === 'invalid-reference') return <section aria-labelledby="draw-queue-title"><PageHeader eyebrow="OPERASI LIVE" headingId="draw-queue-title" title="Undian" description="Acara aktif diperlukan." /><ProductionSetupRequired title="Acara diperlukan untuk Undian" description="Pilih atau buat Acara sebelum menjalankan Undian." /></section>
  if (workspace.status === 'error') return <section aria-labelledby="draw-queue-title"><PageHeader eyebrow="OPERASI LIVE" headingId="draw-queue-title" title="Undian" description="Antrean produksi tidak tersedia." /><StatusBanner badge="Kesalahan penyimpanan" title="Sesi undian tidak dapat dibaca" tone="warning">{workspace.message}</StatusBanner></section>
  if (state.status === 'error') return <section aria-labelledby="draw-queue-title"><PageHeader eyebrow="OPERASI LIVE" headingId="draw-queue-title" title="Undian" description="Antrean produksi tidak tersedia." /><StatusBanner badge="Gagal membaca" title="Sesi undian tidak dapat dibaca" tone="warning">{state.message}</StatusBanner><Button icon={<Icon name="RefreshCw" />} onClick={() => void load()}>Coba baca lagi</Button></section>

  const decks = groupDrawSessionQueueDecks(selectCurrentOperationalQueueItems(state.queue.items))
  const displayUrl = workspace.displayConfiguration === null ? null : audienceUrl(workspace.event.id, workspace.displayConfiguration.id)
  const connection = presentAudienceConnection(audienceStatus, audience.getDiagnostics())
  const hasPersistedSessions = state.queue.items.length > 0
  return <section aria-labelledby="draw-queue-title" className="draw-live-queue">
    <PageHeader eyebrow="OPERASI LIVE" headingId="draw-queue-title" title="Undian" description="Jalankan sesi undian siap untuk Acara yang dipilih." />
    {decks.length === 0 ? <Card padding="md"><h2>{hasPersistedSessions ? 'Tidak ada Undian aktif' : 'Belum ada sesi undian'}</h2><p>{hasPersistedSessions ? 'Undian sebelumnya yang selesai atau dibatalkan tetap tersedia di Riwayat. Buat undian berikutnya dari Pengaturan Undian saat siap.' : 'Buat konfigurasi di Pengaturan Undian; sesi tersimpan akan langsung muncul di sini.'}</p><div className="draw-action-bar__actions"><ButtonLink to="/draw/setup">{hasPersistedSessions ? 'Mulai Undian Berikutnya' : 'Buat Sesi Undian'}</ButtonLink>{hasPersistedSessions ? <ButtonLink icon={<Icon name="History" />} to="/history" variant="secondary">Lihat Riwayat</ButtonLink> : null}</div></Card> : <div className="draw-control-decks" aria-label="Panel kontrol undian">{decks.map((deck) => <DrawControlDeck connection={connection} deck={deck} displayUrl={displayUrl} key={deck.key} selectedMode={selectedModes[deck.key] ?? deck.defaultMode} setSelectedMode={(mode) => setSelectedModes((current) => ({ ...current, [deck.key]: mode }))} />)}</div>}
  </section>
}

export function DrawControlDeck({ connection, deck, displayUrl, selectedMode, setSelectedMode }: { readonly connection: ReturnType<typeof presentAudienceConnection>; readonly deck: DrawSessionQueueDeck; readonly displayUrl: string | null; readonly selectedMode: 'practice' | 'live'; readonly setSelectedMode: (mode: 'practice' | 'live') => void }) {
  const selected = deck.sessions[selectedMode]
  const selectedPresentation = selected === undefined ? null : presentDrawSessionQueueItem(selected)
  const selectedAction = selected?.action ?? null
  const canAct = selectedAction !== null && selectedPresentation?.actionLabel !== null
  const selectedActionIcon = selectedAction?.kind === 'run'
    ? <Icon name="Play" />
    : selectedAction?.kind === 'pending'
      ? <Icon name="ClipboardCheck" />
      : undefined
  const liveSelected = selectedMode === 'live'
  const unavailableReason = selectedMode === 'live' ? 'Tidak ada sesi Live tersimpan untuk undian ini.' : 'Tidak ada sesi Latihan tersimpan untuk undian ini.'
  const audienceWarning = liveSelected && connection.label !== 'Terhubung' ? <StatusBanner badge="Perhatian Tampilan Audiens" title="Konfirmasi Tampilan Audiens belum diterima" tone="warning">{connection.detail} Pastikan tampilan publik siap sebelum memulai undian Live resmi.</StatusBanner> : null
  return <Card className={`draw-control-deck draw-control-deck--${liveSelected ? 'live' : 'practice'}`} padding="none">
    <div className="draw-control-deck__header">
      <div className="draw-control-deck__mode">
        <div className="draw-control-deck__mode-heading"><span>Mode operasi</span></div>
        <p className="draw-control-deck__mode-description">{selected === undefined ? unavailableReason : liveSelected ? 'Proses resmi — dapat membuat hasil resmi setelah konfirmasi.' : 'Proses latihan — hasil tidak disimpan sebagai hasil resmi.'}</p>
      </div>
      <div className="draw-mode-selector" role="group" aria-label={`Mode ${deck.categoryName}`}><button type="button" aria-pressed={!liveSelected} className={!liveSelected ? 'is-selected' : undefined} disabled={deck.sessions.practice === undefined} onClick={() => setSelectedMode('practice')}>Latihan</button><button type="button" aria-pressed={liveSelected} className={liveSelected ? 'is-selected' : undefined} disabled={deck.sessions.live === undefined} onClick={() => setSelectedMode('live')}>Live</button></div>
    </div>
    <div className="draw-control-deck__body">
      <div className="draw-control-deck__summary"><div><span>Acara</span><strong>{deck.eventName}</strong></div><div><span>Undian / hadiah</span><strong>{deck.categoryName}<small>{deck.prizeName}</small></strong></div><div><span>Pemenang</span><strong>{deck.winnerCount}</strong></div><div><span>Kesiapan</span><strong>{selectedPresentation?.checkpointLabel ?? unavailableReason}</strong></div></div>
      {selectedPresentation?.relationLabel === null || selectedPresentation === null ? null : <StatusBanner badge="Diblokir" title={selectedPresentation.relationLabel} tone="warning">Sesi tersimpan tetap terlihat, tetapi tindakan tidak tersedia sampai relasi produksinya tersedia.</StatusBanner>}
      {selected === undefined ? <StatusBanner badge="Tidak tersedia" title={`Mode ${selectedMode === 'live' ? 'Live' : 'Latihan'} tidak tersedia`} tone="info">{unavailableReason}</StatusBanner> : null}
      <div className="draw-control-deck__audience"><div className="draw-control-deck__audience-heading"><div><span>Tampilan Audiens</span><strong><span aria-hidden="true" className={`draw-control-deck__connection-dot draw-control-deck__connection-dot--${connection.tone}`} />{connection.label}</strong><p>{connection.acknowledged ? formatAcknowledgedAt(connection.acknowledgedAt) : connection.detail}</p></div></div><div className="draw-control-deck__audience-actions">{displayUrl === null ? <Button disabled icon={<Icon name="ExternalLink" />} iconAfter variant="secondary">Buka Tampilan Audiens</Button> : <AudienceDisplayButton displayUrl={displayUrl} variant="secondary" />}</div></div>
      {audienceWarning}
      <div className="draw-control-deck__actions">
        <section className="draw-control-deck__action-panel draw-control-deck__action-panel--practice" aria-labelledby={`practice-action-${deck.key}`}>
          <div><span className="operator-eyebrow">{liveSelected ? 'UNDIAN LIVE' : 'LATIHAN'}</span><h3 id={`practice-action-${deck.key}`}>{liveSelected ? 'Siap dimulai' : 'Siap untuk latihan'}</h3></div>
          <div className="draw-control-deck__action-panel-button">{canAct ? <ButtonLink icon={selectedActionIcon} size="lg" variant={liveSelected ? 'danger' : 'primary'} to={selectedAction.to}>{liveSelected && selectedAction.kind === 'run' ? 'Mulai Undian' : selectedPresentation?.actionLabel}</ButtonLink> : null}{selectedAction !== null && selectedPresentation?.historical ? <ButtonLink to={`/history/${selected?.session.id}`} variant="quiet">Lihat detail sesi</ButtonLink> : null}</div>
        </section>
        <section className={`draw-control-deck__action-panel draw-control-deck__action-panel--official${liveSelected ? '' : ' draw-control-deck__action-panel--inactive'}`} aria-labelledby={`live-guidance-${deck.key}`}>
          <div><span className="operator-eyebrow">LIVE RESMI</span><h3 id={`live-guidance-${deck.key}`}>{liveSelected ? 'Mode Live aktif' : 'Mode Live tidak aktif'}</h3></div>
          <div className="draw-control-deck__action-panel-button"><ButtonLink className={!liveSelected ? 'draw-control-deck__live-setup-action' : undefined} size="lg" to="/draw/setup" variant="secondary">Buka Pengaturan Undian</ButtonLink></div>
        </section>
      </div>
    </div>
  </Card>
}
