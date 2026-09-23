import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { projectRecentActivity, type RecentActivityItem, type RecentActivityKind } from '../../application/dashboard/recent-activity.ts'
import { getDisplayConnectionStatus, subscribeDisplayConnectionStatus, type DisplayConnectionStatus } from '../../application/display-transport/connection-status.ts'
import type { PublicDisplaySnapshot } from '../../application/display-transport/public-projection.ts'
import { queryDrawSessionQueue, type DrawSessionQueueItem } from '../../application/draw/draw-session-queue.ts'
import type { StartupRecoveryResult } from '../../application/workflow/startup-recovery-arbiter.ts'
import { useProductionAudiencePublisher, useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import type { ProductionSetupReadiness } from '../../app/workspace/production-setup-readiness.ts'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { AudienceDisplayButton } from '../../shared/components/AudienceDisplayButton.tsx'
import { AudienceConnectionStatus } from '../../shared/components/AudienceConnectionStatus.tsx'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { ProductionLoadingState, ProductionSetupRequired } from '../../shared/components/ProductionWorkspaceState.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { formatProductionDateTime, productionDomainLabel } from '../../shared/localization/production-locale.ts'
import { ButtonLink, Card, Icon, type IconName } from '../../shared/ui/index.ts'
import { useUiClass } from '../../shared/ui/ui-theme.ts'
import { AudiencePresentation } from '../../ui/audience/AudiencePresentation.tsx'

type DrawState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly items: readonly DrawSessionQueueItem[] }

type RecentActivityState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly eventId: string }
  | { readonly status: 'ready'; readonly eventId: string; readonly items: readonly RecentActivityItem[] }

export function ProductionDashboardPage() {
  const ui = useUiClass()
  const workspace = useProductionWorkspace()
  const audience = useProductionAudiencePublisher()
  const audienceSnapshot = useSyncExternalStore(audience.subscribeSnapshot, audience.getSnapshot, audience.getSnapshot)
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const audienceStatusKey = workspace.status === 'ready' && workspace.displayConfiguration !== null ? `${workspace.event.id}:${workspace.displayConfiguration.id}` : 'unconfigured'
  const subscribedAudienceStatus = useSyncExternalStore((listener) => subscribeDisplayConnectionStatus(audienceStatusKey, listener), (): DisplayConnectionStatus => getDisplayConnectionStatus(audienceStatusKey), (): DisplayConnectionStatus => 'waiting')
  const [drawState, setDrawState] = useState<DrawState>({ status: 'loading' })
  const [recentActivity, setRecentActivity] = useState<RecentActivityState>({ status: 'loading' })

  const loadDraws = useCallback(async () => {
    if (workspace.status !== 'ready') return
    setDrawState({ status: 'loading' })
    try {
      await services.open()
      const queue = await queryDrawSessionQueue(workspace.event.id, services)
      setDrawState({ status: 'ready', items: queue?.items ?? [] })
    } catch {
      setDrawState({ status: 'error' })
    }
  }, [services, workspace])

  useEffect(() => { void Promise.resolve().then(loadDraws) }, [loadDraws])
  useEffect(() => {
    if (workspace.status !== 'ready') return
    let active = true
    void (async () => {
      try {
        await services.open()
        if (services.audits === undefined) throw new Error('Audit repository is unavailable.')
        const records = await services.audits.findByEventId(workspace.event.id)
        if (active) setRecentActivity({ status: 'ready', eventId: workspace.event.id, items: projectRecentActivity(records, 4) })
      } catch {
        if (active) setRecentActivity({ status: 'error', eventId: workspace.event.id })
      }
    })()
    return () => { active = false }
  }, [services, workspace])

  if (workspace.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Ruang kerja produksi" headingId="dashboard-title" title="Dasbor" description="Membaca data ruang kerja lokal resmi…" /><ProductionLoadingState description="Membaca data ruang kerja lokal resmi…" /></section>
  if (workspace.status === 'empty') return <section aria-labelledby="dashboard-title"><PageHeader eyebrow="Ruang kerja produksi" headingId="dashboard-title" title="Dasbor" description="Tidak ada Acara aktif yang dipilih." /><ProductionSetupRequired /></section>
  if (workspace.status === 'invalid-reference') return <section aria-labelledby="dashboard-title"><PageHeader eyebrow="Ruang kerja produksi" headingId="dashboard-title" title="Dasbor" description="Referensi Acara aktif tersimpan tidak valid." /><StatusBanner badge="Perlu pemulihan" title="Pilih Acara tersimpan yang valid" tone="warning">Referensi Acara {workspace.eventId} tidak ditemukan. Tidak ada data operasional yang disimpulkan.</StatusBanner><p><ButtonLink icon={<Icon name="Calendar" />} to="/events">Pilih Acara</ButtonLink></p></section>
  if (workspace.status === 'error') return <section aria-labelledby="dashboard-title"><PageHeader eyebrow="Ruang kerja produksi" headingId="dashboard-title" title="Dasbor" description="Data ruang kerja resmi tidak dapat dibaca." /><StatusBanner badge="Kesalahan penyimpanan" title="Ruang kerja tidak tersedia" tone="warning">{workspace.message}</StatusBanner></section>

  const audienceStatus: DisplayConnectionStatus = workspace.displayConfiguration === null ? 'setup-required' : subscribedAudienceStatus
  const displayUrl = workspace.displayConfiguration === null ? null : `/display?eventId=${encodeURIComponent(workspace.event.id)}&displayConfigurationId=${encodeURIComponent(workspace.displayConfiguration.id)}`
  const presentationState = audienceSnapshot === undefined ? 'Menyiapkan output' : audienceSnapshotLabel(audienceSnapshot)
  const headerDescription = `${productionDomainLabel(workspace.event.status)} • Audience ${audienceConnectionLabel(audienceStatus)} • ${presentationState} • ${dashboardDrawLabel(drawState, workspace.sessionCounts['pending-confirmation'], workspace.startupRecovery)}`

  return <section aria-labelledby="dashboard-title" className={ui('dashboard')}>
    <PageHeader description={headerDescription} eyebrow="Ruang kerja produksi" headingId="dashboard-title" title={workspace.event.name} />
    <DashboardOperations audienceSnapshot={audienceSnapshot} audienceStatus={audienceStatus} checkedInParticipantCount={workspace.checkedInParticipantCount} participantCount={workspace.participantCount} prizeCategoryCount={workspace.prizeCategoryCount} displayConfiguration={workspace.displayConfiguration} displayUrl={displayUrl} drawState={drawState} pendingCount={workspace.sessionCounts['pending-confirmation']} recovery={workspace.startupRecovery} setupReadiness={workspace.setupReadiness} />
    <DashboardAttentionCenter audienceStatus={audienceStatus} displayConfigured={workspace.displayConfiguration !== null} drawState={drawState} pendingCount={workspace.sessionCounts['pending-confirmation']} recovery={workspace.startupRecovery} />
    <DashboardRecentActivity state={recentActivity.status === 'loading' || recentActivity.eventId === workspace.event.id ? recentActivity : { status: 'loading' }} />
  </section>
}

function dashboardDrawLabel(drawState: DrawState, pendingCount: number, recovery: StartupRecoveryResult): string {
  if (!recoveryIsClear(recovery)) return 'Sesi perlu dipulihkan'
  if (pendingCount > 0) return 'Verifikasi tertunda'
  if (drawState.status === 'loading') return 'Memeriksa undian'
  if (drawState.status === 'error') return 'Status undian tidak tersedia'
  if (validItems(drawState).some((item) => item.session.status === 'drawing')) return 'Undian sedang berjalan'
  if (validItems(drawState).some((item) => item.session.status === 'ready')) return 'Undian siap'
  return 'Undian belum disiapkan'
}

function DashboardOperations({ audienceSnapshot, audienceStatus, checkedInParticipantCount, displayConfiguration, displayUrl, drawState, participantCount, pendingCount, prizeCategoryCount, recovery, setupReadiness }: { readonly audienceSnapshot: PublicDisplaySnapshot | undefined; readonly audienceStatus: DisplayConnectionStatus; readonly checkedInParticipantCount: number; readonly displayConfiguration: DisplayConfiguration | null; readonly displayUrl: string | null; readonly drawState: DrawState; readonly participantCount: number; readonly pendingCount: number; readonly prizeCategoryCount: number; readonly recovery: StartupRecoveryResult; readonly setupReadiness: ProductionSetupReadiness }) {
  const ui = useUiClass()
  const items = validItems(drawState)
  const action = dashboardPrimaryAction({ audienceStatus, displayUrl, drawState, pendingCount, recovery, setupReadiness })
  const checks = [
    { label: 'Acara aktif', ready: setupReadiness.event },
    { label: 'Data peserta tersedia', ready: participantCount > 0 },
    { label: 'Hadiah tersedia', ready: prizeCategoryCount > 0 },
    { label: 'Konfigurasi tampilan tersedia', ready: displayConfiguration !== null },
    { label: 'Audience Display terhubung', ready: audienceStatus === 'connected' },
    { label: 'Undian siap', ready: items.some((item) => item.session.status === 'ready') },
  ] as const
  const readyCount = checks.filter((check) => check.ready).length
  const upcoming = items.filter((item) => item.session.status === 'ready' || item.session.status === 'draft').slice(0, 3)

  return <section aria-label="Operasi Dasbor" className={ui('production-dashboard__operations')}>
    <div className={ui('production-dashboard__command-column')}><Card className={ui('production-dashboard__next-draw')} padding="md" tone="raised">
      <div className={ui('production-dashboard__panel-heading')}><div><h2>Langkah Berikutnya</h2><p>Satu prioritas utama berdasarkan kondisi acara saat ini.</p></div></div>
      <div aria-label="Tindakan utama acara" className={ui('production-dashboard__primary-action')} data-tone={action.tone}>
        <span className={ui('production-dashboard__primary-action-icon')}><Icon name={action.icon} size={24} /></span>
        <div><span>{action.eyebrow}</span><strong>{action.title}</strong><small>{action.description}</small></div>
        <div className={ui('production-dashboard__primary-action-button')}>{action.kind === 'audience' ? <AudienceDisplayButton displayUrl={action.displayUrl} size="lg" /> : <ButtonLink icon={<Icon name={action.icon} />} size="lg" to={action.to}>{action.label}</ButtonLink>}</div>
      </div>
      <div className={ui('production-dashboard__support-grid')}>
        <section aria-labelledby="dashboard-system-check-title" className={ui('production-dashboard__system-check')}>
          <div className={ui('production-dashboard__subheading')}><div><span>Preflight</span><h3 id="dashboard-system-check-title">System Check</h3></div><strong>{readyCount}/{checks.length} aman</strong></div>
          <ul>{checks.map((check) => <li data-state={check.ready ? 'ready' : 'attention'} key={check.label}><Icon name={check.ready ? 'CircleCheck' : 'CircleAlert'} size={16} /><span>{check.label}</span></li>)}</ul>
        </section>
        <section aria-labelledby="dashboard-upcoming-title" className={ui('production-dashboard__upcoming')}>
          <div className={ui('production-dashboard__subheading')}><div><span>Queue tersimpan</span><h3 id="dashboard-upcoming-title">Undian Berikutnya</h3></div>{upcoming.length > 0 ? <strong>{upcoming.length} item</strong> : null}</div>
          {drawState.status === 'loading' ? <p className={ui('production-dashboard__compact-empty')}>Membaca sesi tersimpan…</p> : drawState.status === 'error' ? <p className={ui('production-dashboard__compact-empty')}>Sesi belum dapat dibaca.</p> : upcoming.length === 0 ? <div className={ui('production-dashboard__upcoming-empty')}><p>Belum ada undian yang disiapkan.</p><ButtonLink size="sm" to="/draw/setup" variant="quiet">Siapkan Undian</ButtonLink></div> : <ol>{upcoming.map((item) => <li key={item.session.id}><Link to={item.action?.to ?? '/draw/setup'}><span><strong>{item.category?.prizeName ?? item.category?.name ?? 'Undian'}</strong><small>{item.winnerCount} pemenang · {item.session.mode === 'live' ? 'Live' : 'Latihan'}{item.session.candidatePoolSnapshot === null ? '' : ` · ${item.session.candidatePoolSnapshot.eligibleSnapshotCount} eligible`}</small></span><b data-state={item.session.status}>{item.session.status === 'ready' ? 'READY' : 'DRAFT'}</b></Link></li>)}</ol>}
        </section>
      </div>
    </Card>
    <DashboardOperationalOverview checkedInParticipantCount={checkedInParticipantCount} drawState={drawState} participantCount={participantCount} pendingCount={pendingCount} prizeCategoryCount={prizeCategoryCount} />
    </div>
    <DashboardAudienceMonitor audienceSnapshot={audienceSnapshot} audienceStatus={audienceStatus} displayConfiguration={displayConfiguration} displayUrl={displayUrl} />
  </section>
}

type DashboardPrimaryAction =
  | { readonly kind: 'link'; readonly description: string; readonly eyebrow: string; readonly icon: IconName; readonly label: string; readonly title: string; readonly to: string; readonly tone: 'attention' | 'active' | 'ready' | 'neutral' }
  | { readonly kind: 'audience'; readonly description: string; readonly displayUrl: string; readonly eyebrow: string; readonly icon: IconName; readonly title: string; readonly tone: 'attention' }

function dashboardPrimaryAction({ audienceStatus, displayUrl, drawState, pendingCount, recovery, setupReadiness }: { readonly audienceStatus: DisplayConnectionStatus; readonly displayUrl: string | null; readonly drawState: DrawState; readonly pendingCount: number; readonly recovery: StartupRecoveryResult; readonly setupReadiness: ProductionSetupReadiness }): DashboardPrimaryAction {
  const items = validItems(drawState)
  const pending = items.find((item) => item.session.status === 'pending-confirmation')
  const drawing = items.find((item) => item.session.status === 'drawing')
  const ready = items.find((item) => item.session.status === 'ready')
  if (!recoveryIsClear(recovery)) return { kind: 'link', description: recoveryDetail(recovery), eyebrow: 'Pemulihan prioritas', icon: 'RefreshCw', label: 'Pulihkan Sesi', title: 'Sesi undian perlu dipulihkan', to: recovery.kind === 'recover-session' || recovery.kind === 'conflicting-sessions' ? recovery.recommendedRoute : '/draw/pending', tone: 'attention' }
  if (pendingCount > 0 || pending !== undefined) return { kind: 'link', description: pending?.category === null || pending === undefined ? 'Selesaikan keputusan operator sebelum memulai sesi lain.' : `${pending.category.prizeName} · ${pending.winnerCount} pemenang`, eyebrow: 'Perlu tindakan', icon: 'ClipboardCheck', label: 'Lanjutkan Verifikasi', title: `${Math.max(pendingCount, 1)} hasil undian menunggu konfirmasi`, to: pending?.action?.to ?? '/draw/pending', tone: 'attention' }
  if (drawing !== undefined) return { kind: 'link', description: `${drawing.category?.prizeName ?? 'Undian'} · ${drawing.winnerCount} pemenang`, eyebrow: 'Sesi aktif', icon: 'Radio', label: 'Kembali ke Undian', title: 'Undian sedang berjalan', to: drawing.action?.to ?? '/draw/live', tone: 'active' }
  if (!setupReadiness.prize) return { kind: 'link', description: 'Tambahkan kategori dan hadiah sebelum membuat sesi undian.', eyebrow: 'Persiapan acara', icon: 'Trophy', label: 'Atur Hadiah', title: 'Hadiah belum tersedia', to: '/prize-categories', tone: 'attention' }
  if (!setupReadiness.participants) return { kind: 'link', description: 'Impor dataset peserta yang akan digunakan pada acara ini.', eyebrow: 'Persiapan acara', icon: 'Upload', label: 'Impor Peserta', title: 'Peserta belum tersedia', to: '/participants', tone: 'attention' }
  if (!setupReadiness.displaySettings) return { kind: 'link', description: 'Atur output yang akan dilihat Audience selama pengundian.', eyebrow: 'Persiapan output', icon: 'MonitorCog', label: 'Siapkan Tampilan', title: 'Tampilan Audience belum disiapkan', to: '/settings', tone: 'attention' }
  if (audienceStatus !== 'connected' && displayUrl !== null) return { kind: 'audience', description: 'Buka atau fokuskan jendela produksi hingga statusnya Terhubung.', displayUrl, eyebrow: 'Preflight output', icon: 'MonitorCheck', title: 'Hubungkan Audience Display', tone: 'attention' }
  if (ready !== undefined) return { kind: 'link', description: `${ready.winnerCount} pemenang · ${ready.session.candidatePoolSnapshot === null ? (ready.session.mode === 'live' ? 'Mode Live' : 'Mode Latihan') : `${ready.session.candidatePoolSnapshot.eligibleSnapshotCount} eligible`}`, eyebrow: 'Undian siap', icon: 'Play', label: ready.session.mode === 'live' ? 'Mulai Undian' : 'Mulai Latihan', title: `${ready.category?.prizeName ?? 'Undian'} siap dijalankan`, to: ready.action?.to ?? '/draw/live', tone: 'ready' }
  if (drawState.status === 'loading') return { kind: 'link', description: 'Sistem sedang membaca sesi tersimpan untuk acara aktif.', eyebrow: 'Sinkronisasi lokal', icon: 'Clock', label: 'Buka Undian', title: 'Memeriksa undian berikutnya', to: '/draw/live', tone: 'neutral' }
  if (drawState.status === 'error') return { kind: 'link', description: 'Buka halaman Undian untuk memeriksa sesi tersimpan.', eyebrow: 'Data belum tersedia', icon: 'CircleAlert', label: 'Periksa Undian', title: 'Undian berikutnya tidak dapat dibaca', to: '/draw/live', tone: 'attention' }
  return { kind: 'link', description: 'Buat sesi, pilih hadiah, lalu tentukan jumlah pemenang dan mode.', eyebrow: 'Belum ada sesi', icon: 'SlidersHorizontal', label: 'Siapkan Undian', title: 'Belum ada undian yang siap dijalankan', to: '/draw/setup', tone: 'neutral' }
}

function DashboardOperationalOverview({ checkedInParticipantCount, drawState, participantCount, pendingCount, prizeCategoryCount }: { readonly checkedInParticipantCount: number; readonly drawState: DrawState; readonly participantCount: number; readonly pendingCount: number; readonly prizeCategoryCount: number }) {
  const ui = useUiClass()
  const liveItems = validItems(drawState).filter((item) => item.session.mode === 'live' && item.session.status !== 'cancelled')
  const count = (status: DrawSessionQueueItem['session']['status']) => liveItems.filter((item) => item.session.status === status).length
  const completed = count('completed')
  const total = liveItems.length
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100)
  const stats = [
    { label: 'Peserta', value: participantCount, to: '/participants' },
    { label: 'Check-in', value: checkedInParticipantCount, to: '/participants' },
    { label: 'Hadiah', value: prizeCategoryCount, to: '/prize-categories' },
    { label: 'Siap', value: count('ready'), to: '/draw/live' },
    { label: 'Pending', value: pendingCount, to: '/draw/pending', warning: pendingCount > 0 },
    { label: 'Selesai', value: completed, to: '/history' },
  ]
  return <Card className={ui('production-dashboard__overview')} padding="none" tone="raised">
    <section aria-labelledby="dashboard-progress-title" className={ui('production-dashboard__progress')}>
      <div><span>Progres undian tersimpan</span><h2 id="dashboard-progress-title">{total === 0 ? 'Belum ada sesi Live' : `${completed} dari ${total} selesai`}</h2></div>
      {total === 0 ? <p>Progres muncul setelah sesi Live disiapkan.</p> : <><div aria-label={`${progress}% undian Live selesai`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress} className={ui('production-dashboard__progress-track')} role="progressbar"><span style={{ width: `${progress}%` }} /></div><p>{count('ready')} siap · {count('drawing')} berjalan · {count('pending-confirmation')} pending · {count('draft')} draf</p></>}
    </section>
    <nav aria-label="Statistik operasional" className={ui('production-dashboard__stat-strip')}>{stats.map((stat) => <Link data-warning={stat.warning ? 'true' : undefined} key={stat.label} to={stat.to}><strong>{stat.value}</strong><span>{stat.label}</span></Link>)}</nav>
  </Card>
}

function DashboardAttentionCenter({ audienceStatus, displayConfigured, drawState, pendingCount, recovery }: { readonly audienceStatus: DisplayConnectionStatus; readonly displayConfigured: boolean; readonly drawState: DrawState; readonly pendingCount: number; readonly recovery: StartupRecoveryResult }) {
  const ui = useUiClass()
  const items: { readonly detail: string; readonly icon: IconName; readonly title: string }[] = []
  if (!recoveryIsClear(recovery)) items.push({ title: 'Pemulihan sesi diperlukan', detail: recoveryDetail(recovery), icon: 'RefreshCw' })
  if (pendingCount > 0) items.push({ title: `${pendingCount} hasil menunggu konfirmasi`, detail: 'Tinjau keputusan operator sebelum memulai sesi lain', icon: 'ClipboardCheck' })
  if (displayConfigured && audienceStatus !== 'connected') items.push({ title: 'Audience Display belum terhubung', detail: 'Buka jendela produksi dan pastikan statusnya Terhubung', icon: 'MonitorCheck' })
  if (drawState.status === 'error') items.push({ title: 'Kesiapan undian gagal dibaca', detail: 'Buka halaman Undian untuk memeriksa sesi tersimpan', icon: 'CircleAlert' })
  if (items.length === 0) return null
  return <section aria-labelledby="dashboard-attention-title" className={ui('production-dashboard__attention-center')}><div className={ui('production-dashboard__attention-heading')}><span><Icon name="CircleAlert" size={20} /></span><div><h2 id="dashboard-attention-title">Perlu Tindakan</h2><p>Tangani kondisi operasional berikut.</p></div></div><ul>{items.map((entry) => <li key={entry.title}><Icon name={entry.icon} size={18} /><span><strong>{entry.title}</strong><small>{entry.detail}</small></span></li>)}</ul></section>
}

function DashboardAudienceMonitor({ audienceSnapshot, audienceStatus, displayConfiguration, displayUrl }: { readonly audienceSnapshot: PublicDisplaySnapshot | undefined; readonly audienceStatus: DisplayConnectionStatus; readonly displayConfiguration: DisplayConfiguration | null; readonly displayUrl: string | null }) {
  const ui = useUiClass()
  const stageLabel = audienceSnapshot === undefined ? 'Menyiapkan' : audienceSnapshotLabel(audienceSnapshot)
  return <Card className={ui('production-dashboard__operations-panel production-dashboard__audience-monitor')} padding="md" tone="raised">
    <div className={ui('production-dashboard__panel-heading')}><div><h2>Audience Output</h2><p>Monitor produksi dari snapshot publik aktif</p></div>{displayConfiguration === null ? null : <span className={ui('production-dashboard__panel-state')} data-state={audienceSnapshot?.blackoutRequested ? 'blackout' : audienceSnapshot?.stage}>{stageLabel.toUpperCase()}</span>}</div>
    {displayConfiguration === null ? <div className={ui('production-dashboard__monitor-empty')}><Icon name="MonitorCog" size={28} /><div><strong>Tampilan Audience belum disiapkan</strong><p>Atur tampilan sebelum acara dimulai.</p></div></div> : audienceSnapshot === undefined ? <div aria-label="Monitor Audience sedang disiapkan" className={ui('production-dashboard__monitor-loading')} role="status"><span /><p>Menyiapkan output Audience…</p></div> : <div aria-label={`Monitor Audience: ${stageLabel}`} className={`${ui('production-dashboard__monitor-preview')} production-preview`} data-public-stage={audienceSnapshot.blackoutRequested ? 'blackout' : audienceSnapshot.stage} role="img"><div className="production-preview__viewport"><AudiencePresentation displayConfiguration={displayConfiguration} preview snapshot={audienceSnapshot} /></div></div>}
    <div className={ui('production-dashboard__monitor-status')}><span>Koneksi Audience</span><AudienceConnectionStatus state={audienceStatus} /></div>
    <div className={ui('production-dashboard__operation-actions')}>{displayUrl === null ? <ButtonLink icon={<Icon name="MonitorCog" />} variant="secondary" to="/settings">Siapkan Tampilan</ButtonLink> : <><AudienceDisplayButton displayUrl={displayUrl} variant="secondary" /><ButtonLink icon={<Icon name="SlidersHorizontal" />} variant="quiet" to="/settings">Pengaturan Tampilan</ButtonLink></>}</div>
  </Card>
}

function DashboardRecentActivity({ state }: { readonly state: RecentActivityState }) {
  const ui = useUiClass()
  return <Card className={ui('production-dashboard__activity')} padding="none" tone="raised"><div className={ui('production-dashboard__activity-heading')}><div><h2>Aktivitas Terakhir</h2><p>Riwayat resmi paling baru.</p></div><ButtonLink icon={<Icon name="History" />} size="sm" to="/history" variant="quiet">Lihat Riwayat</ButtonLink></div>{state.status === 'loading' ? <div aria-live="polite" className={ui('production-dashboard__activity-state')} role="status"><Icon name="Clock" /><span>Membaca aktivitas resmi…</span></div> : state.status === 'error' ? <div className={ui('production-dashboard__activity-state production-dashboard__activity-state--error')} role="alert"><Icon name="CircleAlert" /><span>Aktivitas belum dapat dibaca. Riwayat resmi tidak berubah.</span></div> : state.items.length === 0 ? <div className={ui('production-dashboard__activity-state')}><Icon name="History" /><span>Belum ada aktivitas resmi untuk acara ini.</span></div> : <ol aria-label="Aktivitas resmi terbaru" className={ui('production-dashboard__activity-list')}>{state.items.map((item) => <li key={item.id}><Link to={item.to}><span className={ui('production-dashboard__activity-icon')} data-kind={item.kind}><Icon name={activityIcon(item.kind)} size={18} /></span><span className={ui('production-dashboard__activity-copy')}><strong>{item.title}</strong><small>{item.detail}</small></span><time dateTime={item.timestamp}>{formatProductionDateTime(item.timestamp)}</time><Icon className={ui('production-dashboard__activity-arrow')} name="ArrowRight" size={17} /></Link></li>)}</ol>}</Card>
}

function activityIcon(kind: RecentActivityKind): IconName {
  if (kind === 'import') return 'Upload'
  if (kind === 'confirmation') return 'CircleCheck'
  if (kind === 'cancellation') return 'CircleX'
  if (kind === 'redraw') return 'RotateCcw'
  if (kind === 'event') return 'Calendar'
  return 'Trophy'
}

function validItems(drawState: DrawState): readonly DrawSessionQueueItem[] {
  return drawState.status === 'ready' ? drawState.items.filter((item) => item.relation === 'valid') : []
}

function recoveryIsClear(recovery: StartupRecoveryResult): boolean {
  return recovery.kind === 'normal'
}

function recoveryDetail(recovery: StartupRecoveryResult): string {
  if (recovery.kind === 'conflicting-sessions') return `${recovery.sessions.length} sesi Live perlu ditinjau`
  if (recovery.kind === 'recover-session') return recovery.decision.kind === 'resume-setup' ? 'Sesi Live perlu kembali ke pengaturan' : 'Sesi Live tersimpan perlu dilanjutkan'
  if (recovery.kind === 'storage-failure') return 'Penyimpanan lokal perlu dipulihkan'
  return 'Status pemulihan belum tersedia'
}

function audienceConnectionLabel(status: DisplayConnectionStatus): string {
  if (status === 'connected') return 'Terhubung'
  if (status === 'waiting') return 'Menunggu'
  if (status === 'reconnecting') return 'Menghubungkan ulang'
  if (status === 'setup-required') return 'Perlu pengaturan'
  if (status === 'publication-failed') return 'Publikasi gagal'
  return 'Tidak tersedia'
}

function audienceSnapshotLabel(snapshot: PublicDisplaySnapshot): string {
  if (snapshot.blackoutRequested) return 'Blackout'
  if (snapshot.displayTest === true) return 'Uji Tampilan'
  if (snapshot.stage === 'standby') return 'Standby'
  if (snapshot.stage === 'countdown') return 'Countdown'
  if (snapshot.stage === 'rolling') return 'Rolling'
  if (snapshot.stage === 'reveal') return 'Reveal'
  return 'Terkonfirmasi'
}
