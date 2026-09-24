import { UiThemeContext } from '../../shared/ui/ui-theme.ts'
import { Link, Outlet, useLocation } from 'react-router'
import { useEffect, useSyncExternalStore } from 'react'
import { getDisplayConnectionStatus, subscribeDisplayConnectionStatus, type DisplayConnectionStatus } from '../../application/display-transport/connection-status.ts'
import { ProductionWorkspaceProvider, useProductionAudiencePublisher, useProductionWorkspace, type ProductionWorkspaceState } from '../workspace/ProductionWorkspaceContext.tsx'
import { OperatorSidebar } from '../shell/OperatorSidebar.tsx'
import { RuntimeDiagnosticsPanel } from '../../application/display-transport/RuntimeDiagnostics.tsx'
import { appendRuntimeTrace } from '../../application/display-transport/runtime-trace.ts'
import { productionSetupStageIndexForRoute } from '../workspace/production-setup-readiness.ts'
import { ProductionSetupContinuation } from '../../shared/components/ProductionSetupContinuation.tsx'
import { parseDrawSessionId } from '../../domain/shared/identifiers.ts'
import { Icon } from '../../shared/ui/index.ts'
import { StartupRecoveryGate } from '../workspace/StartupRecoveryGate.tsx'
import { openManagedAudienceDisplay } from '../../infrastructure/browser/managed-audience-display.ts'
import { AudienceConnectionStatus } from '../../shared/components/AudienceConnectionStatus.tsx'
import { BackToTopButton } from '../../shared/components/BackToTopButton.tsx'

type OperatorEventStatus = {
  readonly key: 'ready' | 'live' | 'pending' | 'completed' | 'interrupted' | 'draft' | 'archived' | 'loading' | 'setup-required' | 'unavailable'
  readonly label: string
}

function operatorEventStatus(workspace: ProductionWorkspaceState): OperatorEventStatus {
  if (workspace.status === 'loading') return { key: 'loading', label: 'Memuat' }
  if (workspace.status === 'empty') return { key: 'setup-required', label: 'Perlu pengaturan' }
  if (workspace.status !== 'ready') return { key: 'unavailable', label: 'Tidak tersedia' }

  const recoveryInterrupted = workspace.startupRecovery.kind === 'conflicting-sessions'
    || (workspace.startupRecovery.kind === 'recover-session'
      && (workspace.startupRecovery.decision.kind === 'resume-setup' || workspace.startupRecovery.decision.kind === 'safe-acknowledgement-required'))
  if (recoveryInterrupted) return { key: 'interrupted', label: 'Terganggu' }
  if (workspace.unresolvedSession?.status === 'drawing') return { key: 'live', label: 'Live' }
  if (workspace.unresolvedSession?.status === 'pending-confirmation') return { key: 'pending', label: 'Pending' }

  const eventStatuses: Readonly<Record<typeof workspace.event.status, OperatorEventStatus>> = {
    archived: { key: 'archived', label: 'Diarsipkan' },
    completed: { key: 'completed', label: 'Selesai' },
    draft: { key: 'draft', label: 'Draf' },
    live: { key: 'live', label: 'Live' },
    ready: { key: 'ready', label: 'Ready' },
  }
  return eventStatuses[workspace.event.status]
}

function ProductionOperatorHeader() {
  const workspace = useProductionWorkspace()
  const audience = useProductionAudiencePublisher()
  const eventLabel = workspace.status === 'loading'
    ? 'Membaca Acara aktif'
    : workspace.status === 'ready'
      ? workspace.event.name
      : workspace.status === 'empty'
        ? 'Tidak ada Acara aktif'
        : 'Ruang kerja tidak tersedia'
  const eventStatus = operatorEventStatus(workspace)
  const audienceStatusKey = workspace.status === 'ready' && workspace.displayConfiguration !== null ? `${workspace.event.id}:${workspace.displayConfiguration.id}` : 'unconfigured'
  const subscribedAudienceState = useSyncExternalStore((listener) => subscribeDisplayConnectionStatus(audienceStatusKey, listener), (): DisplayConnectionStatus => getDisplayConnectionStatus(audienceStatusKey), (): DisplayConnectionStatus => 'waiting')
  const audienceState: DisplayConnectionStatus = workspace.status !== 'ready'
    ? workspace.status === 'error' ? 'unavailable' : 'setup-required'
    : workspace.displayConfiguration === null ? 'setup-required' : subscribedAudienceState
  const audienceUrl = workspace.status === 'ready' && workspace.displayConfiguration !== null
    ? `/display?eventId=${encodeURIComponent(workspace.event.id)}&displayConfigurationId=${encodeURIComponent(workspace.displayConfiguration.id)}`
    : null
  const audienceDetail = audienceUrl === null ? 'Buka Pengaturan untuk mengatur tampilan produksi.' : 'Buka atau fokuskan jendela Tampilan Audiens.'
  const standbyUnavailableReason = workspace.status !== 'ready'
    ? 'Acara aktif belum siap.'
    : workspace.displayConfiguration === null
      ? 'Atur Tampilan Audiens di Pengaturan terlebih dahulu.'
      : workspace.unresolvedSession !== null || workspace.sessionCounts.drawing > 0
        ? 'Siaga tidak tersedia saat undian sedang aktif atau menunggu verifikasi.'
        : parseDrawSessionId(workspace.event.id).ok ? null : 'Identitas Acara aktif tidak valid.'
  const publishStandby = () => {
    if (standbyUnavailableReason !== null || workspace.status !== 'ready' || workspace.displayConfiguration === null) return
    const parsedEventId = parseDrawSessionId(workspace.event.id)
    if (!parsedEventId.ok) return
    const settings = workspace.eventSettings
    audience.publish({
      drawSessionId: parsedEventId.value,
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
  }
  const openAudience = () => {
    if (audienceUrl === null) return
    openManagedAudienceDisplay(audienceUrl)
  }
  return <header className="kc-operator-header">
    <div className="kc-operator-header__event">
      <Link className="kc-operator-header__event-control" to="/events">
        <span className="kc-operator-header__label">Acara aktif</span>
        <strong title={eventLabel}>{eventLabel}</strong>
        <span className="kc-operator-event-status" data-status={eventStatus.key}>{eventStatus.label}</span>
      </Link>
    </div>
    <div className="kc-operator-header__status" aria-label="Utilitas Operator">
      {workspace.status === 'ready' && workspace.currentMode !== null ? <span className="kc-mode-badge" data-mode={workspace.currentMode}>{workspace.currentMode === 'live' ? 'Mode Live' : 'Mode Latihan'}</span> : null}
      {audienceUrl === null ? <Link className="kc-operator-display-indicator" title={audienceDetail} aria-label={`Tampilan Audiens: ${statusLabel(audienceState)}`} to="/settings"><AudienceConnectionStatus state={audienceState} prefix /></Link> : <button type="button" className="kc-operator-display-indicator" title={audienceDetail} aria-label={`Tampilan Audiens: ${statusLabel(audienceState)}`} onClick={openAudience}><AudienceConnectionStatus state={audienceState} prefix /></button>}
      <button type="button" className="kc-operator-standby-control" title={standbyUnavailableReason ?? 'Kembalikan Tampilan Audiens ke presentasi siaga normal dengan branding.'} aria-label="Kembalikan Tampilan Audiens ke Siaga" disabled={standbyUnavailableReason !== null} onClick={publishStandby}><Icon name="StopCircle" size={16} />Siaga</button>
    </div>
  </header>
}

function ProductionAudienceDiagnostics() {
  const audience = useProductionAudiencePublisher()
  const location = useLocation()
  const diagnostics = audience.getDiagnostics()
  const diagnosticsDebugEnabled = import.meta.env.DEV && new URLSearchParams(location.search).get('debug') === 'audience-transport'
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const base = diagnostics === undefined ? { side: 'Operator' as const, publisherControllerInstanceId: 'unavailable', route: () => location.pathname } : { side: 'Operator' as const, publisherControllerInstanceId: diagnostics.publisherInstanceId, scope: { eventId: diagnostics.channelName.split(':')[1] ?? 'unknown', displayId: diagnostics.channelName.split(':')[2] ?? 'unknown' }, route: () => location.pathname }
    appendRuntimeTrace(base, { messageType: 'operator-shell-rerender', direction: 'local' })
  }, [diagnostics, location.pathname])
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const base = diagnostics === undefined ? { side: 'Operator' as const, publisherControllerInstanceId: 'unavailable', route: () => location.pathname } : { side: 'Operator' as const, publisherControllerInstanceId: diagnostics.publisherInstanceId, scope: { eventId: diagnostics.channelName.split(':')[1] ?? 'unknown', displayId: diagnostics.channelName.split(':')[2] ?? 'unknown' }, route: () => location.pathname }
    appendRuntimeTrace(base, { messageType: 'route-change', direction: 'local' })
    if (location.pathname === '/settings') appendRuntimeTrace(base, { messageType: 'settings-mounted', direction: 'local' })
    if (location.pathname === '/dashboard') appendRuntimeTrace(base, { messageType: 'dashboard-mounted', direction: 'local' })
    if (location.pathname === '/draw/live') appendRuntimeTrace(base, { messageType: 'live-draw-mounted', direction: 'local' })
    if (location.pathname.includes('/draw/pending')) appendRuntimeTrace(base, { messageType: 'pending-results-mounted', direction: 'local' })
    return () => { if (location.pathname === '/settings') appendRuntimeTrace(base, { messageType: 'settings-unmounted', direction: 'local', cleanupDisposeReason: 'route-change' }) }
  }, [diagnostics, location.pathname])
  if (!diagnosticsDebugEnabled) return null
  return <RuntimeDiagnosticsPanel side="Operator" title="Audience publisher diagnostics" summary={<dl>
    <div><dt>Publisher owner</dt><dd>Production workspace shell</dd></div>
    <div><dt>Operator route</dt><dd>{location.pathname}</dd></div>
    <div><dt>Publisher instance</dt><dd>{diagnostics?.publisherInstanceId ?? '—'}</dd></div>
    <div><dt>Scope</dt><dd>{diagnostics === undefined ? '—' : `${diagnostics.channelName}`}</dd></div>
    <div><dt>Epoch / sequence</dt><dd>{diagnostics === undefined ? '—' : `${diagnostics.epoch} / ${diagnostics.sequence}`}</dd></div>
    <div><dt>Retained public state</dt><dd>{diagnostics?.retainedPublicState ?? '—'}</dd></div>
    <div><dt>Settings test-active</dt><dd>{diagnostics?.retainedPublicState === 'display-test' ? 'yes' : 'no'}</dd></div>
    <div><dt>Last snapshot sent</dt><dd>{diagnostics?.lastEnvelopeSent === undefined ? '—' : `${diagnostics.lastEnvelopeSent.publicState} @ ${diagnostics.lastEnvelopeSent.epoch}/${diagnostics.lastEnvelopeSent.sequence}`}</dd></div>
    <div><dt>Last applied acknowledgement</dt><dd>{diagnostics?.lastAcknowledgement === undefined ? '—' : `${diagnostics.lastAcknowledgement.publicState} @ ${diagnostics.lastAcknowledgement.epoch}/${diagnostics.lastAcknowledgement.sequence}`}</dd></div>
    <div><dt>Heartbeat count</dt><dd>{diagnostics?.heartbeatCount ?? 0}</dd></div>
    <div><dt>Heartbeat sent</dt><dd>{diagnostics?.heartbeatCount ?? 0}</dd></div>
    <div><dt>Heartbeat interval</dt><dd>{diagnostics?.heartbeatIntervalMs ?? 0} ms</dd></div>
    <div><dt>Active heartbeat timers</dt><dd>{diagnostics?.activeHeartbeatTimerCount ?? 0}</dd></div>
    <div><dt>Heartbeat received</dt><dd>{diagnostics?.heartbeatReceivedCount ?? 0}</dd></div>
    <div><dt>Hello count</dt><dd>{diagnostics?.helloCount ?? 0}</dd></div>
    <div><dt>Restore-request count</dt><dd>{diagnostics?.restoreRequestCount ?? 0}</dd></div>
    <div><dt>Retained snapshot resends</dt><dd>{diagnostics?.retainedSnapshotResendCount ?? 0}</dd></div>
    <div><dt>Last heartbeat</dt><dd>{diagnostics?.lastHeartbeatTimestamp ?? '—'}</dd></div>
    <div><dt>Audience liveness timeout</dt><dd>{diagnostics?.audienceLivenessTimeoutMs ?? 0} ms</dd></div>
    <div><dt>Audience liveness deadline</dt><dd>{diagnostics?.audienceLivenessDeadline ?? '—'}</dd></div>
    <div><dt>Active Audience subscribers</dt><dd>{diagnostics?.activeAudienceSubscriberCount ?? 0}</dd></div>
    <div><dt>Subscriber runtime IDs</dt><dd>{diagnostics?.audienceSubscriberRuntimeIds.join(', ') || '—'}</dd></div>
    <div><dt>Last Audience activity</dt><dd>{diagnostics?.lastAudienceActivity ?? '—'}</dd></div>
    <div><dt>Last Audience heartbeat</dt><dd>{diagnostics?.lastAudienceHeartbeat ?? '—'}</dd></div>
    <div><dt>Subscriber expiry reason</dt><dd>{diagnostics?.mostRecentSubscriberExpiryReason ?? '—'}</dd></div>
  </dl>} />
}

function statusLabel(status: string): string {
  const labels: Readonly<Record<string, string>> = { active: 'Aktif', archived: 'Diarsipkan', draft: 'Draf', waiting: 'Menunggu', connected: 'Terhubung', disconnected: 'Terputus', reconnecting: 'Menghubungkan ulang', unavailable: 'Tidak tersedia' }
  return status === 'setup-required' ? 'Perlu pengaturan' : status === 'publication-failed' ? 'Publikasi gagal' : labels[status] ?? status
}

function ProductionOperatorContent() {
  const location = useLocation()
  const workspace = useProductionWorkspace()
  return <div className="operator-layout kc-operator-layout" data-interface="operator" data-ui-theme="kocokan" data-operator-shell>
    <a className="skip-link kc-skip-link" href="#operator-main">Lewati ke konten utama</a>
    <OperatorSidebar production />
    <div className="operator-workspace kc-operator-workspace">
      <ProductionOperatorHeader />
      <main className="operator-main operator-main--production kc-operator-main" data-production-content-scroll="true" id="operator-main" tabIndex={-1}><StartupRecoveryGate recovery={workspace.status === 'ready' ? workspace.startupRecovery : undefined} /><Outlet /><ProductionAudienceDiagnostics />{productionSetupStageIndexForRoute(location.pathname) !== undefined ? <ProductionSetupContinuation /> : null}</main>
      <BackToTopButton />
    </div>
  </div>
}

export function ProductionOperatorLayout() {
  useEffect(() => {
    appendRuntimeTrace({ side: 'Operator', publisherControllerInstanceId: 'operator-shell' }, { messageType: 'operator-shell-mount', direction: 'local' })
    return () => { appendRuntimeTrace({ side: 'Operator', publisherControllerInstanceId: 'operator-shell' }, { messageType: 'operator-shell-unmount', direction: 'local', cleanupDisposeReason: 'operator-shell-unmounted' }) }
  }, [])
  return <ProductionWorkspaceProvider><UiThemeContext value="kocokan"><ProductionOperatorContent /></UiThemeContext></ProductionWorkspaceProvider>
}
