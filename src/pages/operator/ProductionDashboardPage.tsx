import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { ButtonLink, Card, Icon } from '../../shared/ui/index.ts'
import { MetricCard } from '../../shared/components/MetricCard.tsx'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { queryDrawSessionQueue, type DrawSessionQueueItem } from '../../application/draw/draw-session-queue.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { getDisplayConnectionStatus, subscribeDisplayConnectionStatus, type DisplayConnectionStatus } from '../../application/display-transport/connection-status.ts'
import { ProductionLoadingState, ProductionSetupRequired } from '../../shared/components/ProductionWorkspaceState.tsx'
import { AudienceDisplayButton } from '../../shared/components/AudienceDisplayButton.tsx'
import { AudienceConnectionStatus } from '../../shared/components/AudienceConnectionStatus.tsx'

export function ProductionDashboardPage() {
  const workspace = useProductionWorkspace()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const audienceStatusKey = workspace.status === 'ready' && workspace.displayConfiguration !== null ? `${workspace.event.id}:${workspace.displayConfiguration.id}` : 'unconfigured'
  const audienceStatus = useSyncExternalStore((listener) => subscribeDisplayConnectionStatus(audienceStatusKey, listener), (): DisplayConnectionStatus => getDisplayConnectionStatus(audienceStatusKey), (): DisplayConnectionStatus => 'waiting')
  const [drawState, setDrawState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ready'; item: DrawSessionQueueItem | null }>({ status: 'loading' })
  const loadNextDraw = useCallback(async () => {
    if (workspace.status !== 'ready') return
    setDrawState({ status: 'loading' })
    try {
      await services.open()
      const queue = await queryDrawSessionQueue(workspace.event.id, services)
      const item = queue?.items.find((candidate) => candidate.session.status === 'ready' && candidate.relation === 'valid') ?? null
      setDrawState({ status: 'ready', item })
    } catch {
      setDrawState({ status: 'error' })
    }
  }, [services, workspace])
  useEffect(() => { void Promise.resolve().then(loadNextDraw) }, [loadNextDraw])
  if (workspace.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Ruang kerja produksi" headingId="dashboard-title" title="Dasbor" description="Membaca data ruang kerja lokal resmi…" /><ProductionLoadingState description="Membaca data ruang kerja lokal resmi…" /></section>
  if (workspace.status === 'empty') return <section aria-labelledby="dashboard-title"><PageHeader eyebrow="Ruang kerja produksi" headingId="dashboard-title" title="Dasbor" description="Tidak ada Acara aktif yang dipilih." /><ProductionSetupRequired /></section>
  if (workspace.status === 'invalid-reference') return <section aria-labelledby="dashboard-title"><PageHeader eyebrow="Ruang kerja produksi" headingId="dashboard-title" title="Dasbor" description="Referensi Acara aktif tersimpan tidak valid." /><StatusBanner badge="Perlu pemulihan" title="Pilih Acara tersimpan yang valid" tone="warning">Referensi Acara {workspace.eventId} tidak ditemukan. Tidak ada data operasional yang disimpulkan.</StatusBanner><p><ButtonLink icon={<Icon name="Calendar" />} to="/events">Pilih Acara</ButtonLink></p></section>
  if (workspace.status === 'error') return <section aria-labelledby="dashboard-title"><PageHeader eyebrow="Ruang kerja produksi" headingId="dashboard-title" title="Dasbor" description="Data ruang kerja resmi tidak dapat dibaca." /><StatusBanner badge="Kesalahan penyimpanan" title="Ruang kerja tidak tersedia" tone="warning">{workspace.message}</StatusBanner></section>

  const actions = <div className="production-dashboard__secondary-actions"><ButtonLink icon={<Icon name="Upload" />} variant="secondary" to="/participants">Impor Peserta</ButtonLink><ButtonLink icon={<Icon name="SlidersHorizontal" />} variant="secondary" to="/draw/setup">Pengaturan Undian</ButtonLink></div>
  return <section aria-labelledby="dashboard-title" className="dashboard">
    <PageHeader actions={actions} description={`Status Acara: ${workspace.event.status}${workspace.unresolvedSession === null ? ' · Siap untuk undian berikutnya' : ' · Sesi Live perlu perhatian'}`} eyebrow="Ruang kerja produksi" headingId="dashboard-title" title={workspace.event.name} />
    <section aria-label="Metrik Acara" className="dashboard-metrics dashboard-metrics--production">
      <MetricCard to="/participants" label="Peserta" value={String(workspace.participantCount)} detail={`${workspace.checkedInParticipantCount} sudah check-in`} tone="info" />
      <MetricCard to="/prize-categories" label="Hadiah" value={String(workspace.prizeCategoryCount)} detail={`${workspace.prizeCategoryCount} sudah diatur`} tone="neutral" />
      <MetricCard to="/draw/live" label="Undian Siap" value={String(workspace.sessionCounts.ready)} detail={`${workspace.sessionCounts.ready} siap dijalankan`} tone="info" />
      <MetricCard to="/draw/pending" label="Menunggu Konfirmasi" value={String(workspace.sessionCounts['pending-confirmation'])} detail={workspace.sessionCounts['pending-confirmation'] === 0 ? 'Tidak perlu peninjauan' : `${workspace.sessionCounts['pending-confirmation']} perlu ditinjau`} tone="warning" />
      <MetricCard to="/history" label="Undian Resmi" value={String(workspace.liveSessionCount)} detail={workspace.liveSessionCount === 0 ? 'Belum ada undian resmi' : `${workspace.liveSessionCount} undian resmi`} tone="neutral" />
    </section>
    <DashboardOperations drawState={drawState} audienceStatus={workspace.displayConfiguration === null ? 'setup-required' : audienceStatus} displayUrl={workspace.displayConfiguration === null ? null : `/display?eventId=${encodeURIComponent(workspace.event.id)}&displayConfigurationId=${encodeURIComponent(workspace.displayConfiguration.id)}`} pendingCount={workspace.sessionCounts['pending-confirmation']} />
  </section>
}

function DashboardOperations({ audienceStatus, displayUrl, drawState, pendingCount }: { readonly audienceStatus: DisplayConnectionStatus; readonly displayUrl: string | null; readonly drawState: { status: 'loading' } | { status: 'error' } | { status: 'ready'; item: DrawSessionQueueItem | null }; readonly pendingCount: number }) {
  const item = drawState.status === 'ready' ? drawState.item : null
  return <section aria-label="Operasi Dasbor" className="production-dashboard__operations">
    <Card className="production-dashboard__next-draw" padding="md"><div className="production-dashboard__panel-heading"><div><p className="operator-eyebrow">UNDIAN BERIKUTNYA</p></div><span className="production-dashboard__panel-state">{drawState.status === 'loading' ? 'MEMBACA' : item === null ? 'TIDAK ADA UNDIAN SIAP' : 'SIAP'}</span></div>{item === null ? <p className="production-dashboard__empty-copy">{drawState.status === 'loading' ? 'Membaca sesi undian siap berikutnya…' : drawState.status === 'error' ? 'Sesi undian siap berikutnya tidak dapat dibaca.' : 'Buat atau selesaikan undian di Pengaturan Undian untuk menyiapkan presentasi berikutnya.'}</p> : <><div className="production-dashboard__next-draw-identity"><h3>{item.category?.prizeName ?? 'Hadiah tidak tersedia'}</h3><p>{item.category?.name ?? 'Kategori hadiah tidak tersedia'} · {item.winnerCount} pemenang</p></div><p className="production-dashboard__next-draw-state">{item.session.mode === 'live' ? 'Live' : 'Latihan'} · Siap dimulai</p></>}<ButtonLink icon={<Icon name="Play" />} size="lg" to="/draw/live">{item === null ? 'Buka Undian' : item.session.mode === 'live' ? 'Mulai Undian' : 'Mulai Latihan'}</ButtonLink></Card>
    <Card className="production-dashboard__operations-panel" padding="md"><div className="production-dashboard__panel-heading"><div><p className="operator-eyebrow">OPERASI</p></div></div><dl className="production-dashboard__operation-list"><div><dt>Tampilan Audiens</dt><dd><AudienceConnectionStatus state={audienceStatus} /></dd></div><div><dt>Menunggu Konfirmasi</dt><dd>{pendingCount}</dd></div></dl><div className="production-dashboard__operation-actions">{displayUrl === null ? <ButtonLink icon={<Icon name="MonitorCog" />} variant="secondary" to="/settings">Buka Pengaturan Tampilan</ButtonLink> : <AudienceDisplayButton displayUrl={displayUrl} variant="secondary" />}{pendingCount > 0 ? <ButtonLink icon={<Icon name="ClipboardCheck" />} variant="secondary" to="/draw/pending">Buka Hasil</ButtonLink> : null}</div></Card>
  </section>
}
