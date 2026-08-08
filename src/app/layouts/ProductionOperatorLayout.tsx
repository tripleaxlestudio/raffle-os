import { Link, Outlet, useLocation } from 'react-router'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getDisplayConnectionStatus, subscribeDisplayConnectionStatus, type DisplayConnectionStatus } from '../../application/display-transport/connection-status.ts'
import { ProductionWorkspaceProvider, useProductionAudiencePublisher, useProductionWorkspace } from '../workspace/ProductionWorkspaceContext.tsx'
import { OperatorSidebar } from '../shell/OperatorSidebar.tsx'
import { RuntimeDiagnosticsPanel } from '../../application/display-transport/RuntimeDiagnostics.tsx'
import { appendRuntimeTrace } from '../../application/display-transport/runtime-trace.ts'
import { productionSetupStageIndexForRoute } from '../workspace/production-setup-readiness.ts'
import { ProductionSetupContinuation } from '../../shared/components/ProductionSetupContinuation.tsx'

function ProductionOperatorHeader() {
  const workspace = useProductionWorkspace()
  const [eventMenuOpen, setEventMenuOpen] = useState(false)
  const eventButtonRef = useRef<HTMLButtonElement>(null)
  const eventPopoverRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const eventLabel = workspace.status === 'loading'
    ? 'Reading active Event'
    : workspace.status === 'ready'
      ? workspace.event.name
      : workspace.status === 'empty'
        ? 'No active Event'
        : 'Workspace unavailable'
  const eventStatus = workspace.status === 'ready'
    ? workspace.event.status.charAt(0).toUpperCase() + workspace.event.status.slice(1)
    : workspace.status === 'empty' ? 'Setup required' : workspace.status === 'loading' ? 'Loading' : 'Unavailable'
  const audienceStatusKey = workspace.status === 'ready' && workspace.displayConfiguration !== null ? `${workspace.event.id}:${workspace.displayConfiguration.id}` : 'unconfigured'
  const subscribedAudienceState = useSyncExternalStore((listener) => subscribeDisplayConnectionStatus(audienceStatusKey, listener), (): DisplayConnectionStatus => getDisplayConnectionStatus(audienceStatusKey), (): DisplayConnectionStatus => 'waiting')
  const audienceState = workspace.status !== 'ready'
    ? workspace.status === 'error' ? 'Unavailable' : 'Setup required'
    : workspace.displayConfiguration === null ? 'Setup required' : statusLabel(subscribedAudienceState)
  const audienceUrl = workspace.status === 'ready' && workspace.displayConfiguration !== null
    ? `/display?eventId=${encodeURIComponent(workspace.event.id)}&displayConfigurationId=${encodeURIComponent(workspace.displayConfiguration.id)}`
    : null
  const audienceDetail = audienceUrl === null ? 'Open Settings to configure the production display.' : 'Production display scope is ready; waiting for operator publication.'
  const openAudience = () => {
    if (audienceUrl === null) return
    window.open(audienceUrl, '_blank', 'noopener,noreferrer')
  }
  useEffect(() => {
    if (!eventMenuOpen) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEventMenuOpen(false)
        eventButtonRef.current?.focus()
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
        const current = items.indexOf(document.activeElement as HTMLElement)
        const next = event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length
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
  return <header className="operator-header">
    <div ref={eventPopoverRef} className="operator-header__event">
      <button ref={eventButtonRef} type="button" className="operator-header__event-control" aria-haspopup="menu" aria-expanded={eventMenuOpen} onClick={() => setEventMenuOpen((open) => !open)}>
        <span className="operator-header__label">Current Event</span>
        <strong title={eventLabel}>{eventLabel}</strong>
        <span className="operator-event-status">{eventStatus}</span>
        <span className="operator-header__chevron" aria-hidden="true" />
      </button>
      {eventMenuOpen ? <div ref={menuRef} className="operator-header__menu" role="menu" aria-label="Current Event actions">
        <Link role="menuitem" to="/events" onClick={() => setEventMenuOpen(false)}>Switch / Manage Events</Link>
        <Link role="menuitem" to="/prize-categories" onClick={() => setEventMenuOpen(false)}>Manage Prize Categories</Link>
      </div> : null}
    </div>
    <div className="operator-header__status" aria-label="Operator utilities">
      {workspace.status === 'ready' && workspace.currentMode !== null ? <span className="mode-badge" data-mode={workspace.currentMode}>{workspace.currentMode === 'live' ? 'Live Mode' : 'Practice Mode'}</span> : null}
      {audienceUrl === null ? <Link className="operator-display-indicator" title={audienceDetail} aria-label="Audience: Setup required" to="/settings"><span aria-hidden="true" className="operator-status-marker" />Audience: Setup required</Link> : <button type="button" className="operator-display-indicator" title={audienceDetail} aria-label={`Audience: ${audienceState}`} onClick={openAudience}><span aria-hidden="true" className="operator-status-marker" />Audience: {audienceState}</button>}
    </div>
  </header>
}

function ProductionAudienceDiagnostics() {
  const audience = useProductionAudiencePublisher()
  const location = useLocation()
  const diagnostics = audience.getDiagnostics()
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
  if (!import.meta.env.DEV) return null
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

function statusLabel(status: ReturnType<typeof getDisplayConnectionStatus>): string {
  return status === 'setup-required' ? 'Setup required' : status === 'publication-failed' ? 'Publication failed' : status.charAt(0).toUpperCase() + status.slice(1)
}

export function ProductionOperatorLayout() {
  const location = useLocation()
  useEffect(() => {
    appendRuntimeTrace({ side: 'Operator', publisherControllerInstanceId: 'operator-shell' }, { messageType: 'operator-shell-mount', direction: 'local' })
    return () => { appendRuntimeTrace({ side: 'Operator', publisherControllerInstanceId: 'operator-shell' }, { messageType: 'operator-shell-unmount', direction: 'local', cleanupDisposeReason: 'operator-shell-unmounted' }) }
  }, [])
  return <ProductionWorkspaceProvider>
    <div className="operator-layout" data-interface="operator" data-operator-shell>
      <OperatorSidebar production />
      <div className="operator-workspace">
        <ProductionOperatorHeader />
        <main className="operator-main"><Outlet />{productionSetupStageIndexForRoute(location.pathname) !== undefined ? <ProductionSetupContinuation /> : null}<ProductionAudienceDiagnostics /></main>
      </div>
    </div>
  </ProductionWorkspaceProvider>
}
