import { Link, Outlet, useLocation } from 'react-router'
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getDisplayConnectionStatus, subscribeDisplayConnectionStatus, type DisplayConnectionStatus } from '../../application/display-transport/connection-status.ts'
import { ProductionWorkspaceProvider, signalProductionWorkspaceChanged, useProductionAudiencePublisher, useProductionWorkspace } from '../workspace/ProductionWorkspaceContext.tsx'
import { OperatorSidebar } from '../shell/OperatorSidebar.tsx'
import { RuntimeDiagnosticsPanel } from '../../application/display-transport/RuntimeDiagnostics.tsx'
import { appendRuntimeTrace } from '../../application/display-transport/runtime-trace.ts'
import { productionSetupStageIndexForRoute } from '../workspace/production-setup-readiness.ts'
import { ProductionSetupContinuation } from '../../shared/components/ProductionSetupContinuation.tsx'
import { createEventSetupProductionServices } from '../../infrastructure/composition/event-setup-production.ts'
import type { Event as RaffleEvent } from '../../domain/events/event.types.ts'
import { parseDrawSessionId } from '../../domain/shared/identifiers.ts'
import { Icon } from '../../shared/ui/index.ts'
import { StartupRecoveryGate } from '../workspace/StartupRecoveryGate.tsx'
import { openManagedAudienceDisplay } from '../../infrastructure/browser/managed-audience-display.ts'
import { AudienceConnectionStatus } from '../../shared/components/AudienceConnectionStatus.tsx'

function ProductionOperatorHeader() {
  const workspace = useProductionWorkspace()
  const audience = useProductionAudiencePublisher()
  const eventServices = useMemo(() => createEventSetupProductionServices(), [])
  const [eventMenuOpen, setEventMenuOpen] = useState(false)
  const [availableEvents, setAvailableEvents] = useState<readonly RaffleEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventSwitching, setEventSwitching] = useState(false)
  const [eventMenuError, setEventMenuError] = useState<string | null>(null)
  const eventMenuId = useId()
  const eventButtonRef = useRef<HTMLButtonElement>(null)
  const eventPopoverRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const loadAvailableEvents = useCallback(async () => {
    setEventsLoading(true)
    try {
      await eventServices.open()
      setAvailableEvents((await eventServices.events.findAll()).filter((event) => event.status !== 'archived'))
      setEventMenuError(null)
    } catch (cause: unknown) {
      setEventMenuError(cause instanceof Error ? cause.message : 'Acara tidak dapat dibaca dengan aman.')
    } finally {
      setEventsLoading(false)
    }
  }, [eventServices])
  const eventLabel = workspace.status === 'loading'
    ? 'Membaca Acara aktif'
    : workspace.status === 'ready'
      ? workspace.event.name
      : workspace.status === 'empty'
        ? 'Tidak ada Acara aktif'
        : 'Ruang kerja tidak tersedia'
  const eventStatus = workspace.status === 'ready'
    ? workspace.event.status.charAt(0).toUpperCase() + workspace.event.status.slice(1)
    : workspace.status === 'empty' ? 'Perlu pengaturan' : workspace.status === 'loading' ? 'Memuat' : 'Tidak tersedia'
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
  const selectEvent = async (event: RaffleEvent) => {
    if (eventSwitching) return
    setEventMenuError(null)
    if (workspace.status === 'ready' && workspace.event.id === event.id) {
      setEventMenuOpen(false)
      return
    }
    setEventSwitching(true)
    try {
      await eventServices.service.selectEvent(event.id)
      signalProductionWorkspaceChanged()
      setEventMenuOpen(false)
    } catch (cause: unknown) {
      setEventMenuError(cause instanceof Error ? cause.message : 'Acara tidak dapat dipilih.')
    } finally {
      setEventSwitching(false)
    }
  }
  const openAudience = () => {
    if (audienceUrl === null) return
    openManagedAudienceDisplay(audienceUrl)
  }
  useEffect(() => {
    if (!eventMenuOpen) return
    queueMicrotask(() => {
      const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')
      ;(firstItem ?? menuRef.current)?.focus()
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEventMenuOpen(false)
        eventButtonRef.current?.focus()
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
        if (items.length === 0) return
        const current = items.indexOf(document.activeElement as HTMLElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length
        items[next]?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const onPointerDown = (event: PointerEvent) => {
      if (!eventPopoverRef.current?.contains(event.target as Node)) setEventMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [eventMenuOpen])
  useEffect(() => {
    if (!eventMenuOpen || eventsLoading || availableEvents.length === 0) return
    const menu = menuRef.current
    if (menu !== null && document.activeElement === menu) {
      menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    }
  }, [availableEvents.length, eventMenuOpen, eventsLoading])
  return <header className="operator-header">
    <div ref={eventPopoverRef} className="operator-header__event">
      <button ref={eventButtonRef} type="button" className="operator-header__event-control" aria-controls={eventMenuOpen ? eventMenuId : undefined} aria-haspopup="menu" aria-expanded={eventMenuOpen} onClick={() => { const nextOpen = !eventMenuOpen; setEventMenuOpen(nextOpen); if (nextOpen) void loadAvailableEvents() }}>
        <span className="operator-header__label">Acara aktif</span>
        <strong title={eventLabel}>{eventLabel}</strong>
        <span className="operator-event-status">{eventStatus}</span>
        <span className="operator-header__chevron" aria-hidden="true" />
      </button>
      {eventMenuOpen ? <div ref={menuRef} id={eventMenuId} className="operator-header__menu" role="menu" aria-busy={eventsLoading || undefined} aria-label="Pemilih Acara aktif" tabIndex={-1}>
        {eventsLoading ? <span className="operator-header__menu-status" role="status">Memuat Acara…</span> : null}
        {eventMenuError === null ? availableEvents.map((event) => {
          const isCurrent = workspace.status === 'ready' && workspace.event.id === event.id
          return <div className={`operator-header__event-option${isCurrent ? ' operator-header__event-option--current' : ''}`} key={event.id}>
            <button type="button" role="menuitem" className="operator-header__event-switch" aria-current={isCurrent ? 'true' : undefined} disabled={eventSwitching} onClick={() => void selectEvent(event)}>
              <span className="operator-header__event-option-copy"><strong>{event.name}</strong><span>{statusLabel(event.status)}</span></span>
              {isCurrent ? <span className="operator-header__event-current">Aktif</span> : null}
            </button>
            <Link role="menuitem" className="operator-header__event-manage" aria-label={`Kelola ${event.name}`} to={`/events?eventId=${encodeURIComponent(event.id)}`} onClick={() => setEventMenuOpen(false)}><span aria-hidden="true">⚙</span></Link>
          </div>
        }) : <span className="operator-header__menu-status" role="alert">{eventMenuError}</span>}
        {!eventsLoading && eventMenuError === null && availableEvents.length === 0 ? <span className="operator-header__menu-status">Tidak ada Acara yang tersedia.</span> : null}
      </div> : null}
    </div>
    <div className="operator-header__status" aria-label="Utilitas Operator">
      {workspace.status === 'ready' && workspace.currentMode !== null ? <span className="mode-badge" data-mode={workspace.currentMode}>{workspace.currentMode === 'live' ? 'Mode Live' : 'Mode Latihan'}</span> : null}
      {audienceUrl === null ? <Link className="operator-display-indicator" title={audienceDetail} aria-label={`Tampilan Audiens: ${statusLabel(audienceState)}`} to="/settings"><AudienceConnectionStatus state={audienceState} prefix /></Link> : <button type="button" className="operator-display-indicator" title={audienceDetail} aria-label={`Tampilan Audiens: ${statusLabel(audienceState)}`} onClick={openAudience}><AudienceConnectionStatus state={audienceState} prefix /></button>}
      <button type="button" className="operator-standby-control" title={standbyUnavailableReason ?? 'Kembalikan Tampilan Audiens ke presentasi siaga normal dengan branding.'} aria-label="Kembalikan Tampilan Audiens ke Siaga" disabled={standbyUnavailableReason !== null} onClick={publishStandby}><Icon name="StopCircle" size={16} />Siaga</button>
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
  return <div className="operator-layout" data-interface="operator" data-operator-shell>
    <a className="skip-link" href="#operator-main">Lewati ke konten utama</a>
    <OperatorSidebar production />
    <div className="operator-workspace">
      <ProductionOperatorHeader />
      <main className="operator-main operator-main--production" data-production-content-scroll="true" id="operator-main" tabIndex={-1}><StartupRecoveryGate recovery={workspace.status === 'ready' ? workspace.startupRecovery : undefined} /><Outlet /><ProductionAudienceDiagnostics />{productionSetupStageIndexForRoute(location.pathname) !== undefined ? <ProductionSetupContinuation /> : null}</main>
    </div>
  </div>
}

export function ProductionOperatorLayout() {
  useEffect(() => {
    appendRuntimeTrace({ side: 'Operator', publisherControllerInstanceId: 'operator-shell' }, { messageType: 'operator-shell-mount', direction: 'local' })
    return () => { appendRuntimeTrace({ side: 'Operator', publisherControllerInstanceId: 'operator-shell' }, { messageType: 'operator-shell-unmount', direction: 'local', cleanupDisposeReason: 'operator-shell-unmounted' }) }
  }, [])
  return <ProductionWorkspaceProvider><ProductionOperatorContent /></ProductionWorkspaceProvider>
}
