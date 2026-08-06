import { Link, Outlet } from 'react-router'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getDisplayConnectionStatus, subscribeDisplayConnectionStatus, type DisplayConnectionStatus } from '../../application/display-transport/connection-status.ts'
import { ProductionWorkspaceProvider, useProductionWorkspace } from '../workspace/ProductionWorkspaceContext.tsx'
import { OperatorSidebar } from '../shell/OperatorSidebar.tsx'

function ProductionOperatorHeader() {
  const workspace = useProductionWorkspace()
  const [eventMenuOpen, setEventMenuOpen] = useState(false)
  const eventButtonRef = useRef<HTMLButtonElement>(null)
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
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [eventMenuOpen])
  return <header className="operator-header">
    <div className="operator-header__event">
      <button ref={eventButtonRef} type="button" className="operator-header__event-control" aria-haspopup="menu" aria-expanded={eventMenuOpen} onClick={() => setEventMenuOpen((open) => !open)}>
        <span className="operator-header__label">Current Event</span>
        <strong title={eventLabel}>{eventLabel}</strong>
        <span className="operator-event-status">{eventStatus}</span>
        <span aria-hidden="true">⌄</span>
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

function statusLabel(status: ReturnType<typeof getDisplayConnectionStatus>): string {
  return status === 'setup-required' ? 'Setup required' : status === 'publication-failed' ? 'Publication failed' : status.charAt(0).toUpperCase() + status.slice(1)
}

export function ProductionOperatorLayout() {
  return <ProductionWorkspaceProvider>
    <div className="operator-layout" data-interface="operator" data-operator-shell>
      <OperatorSidebar production />
      <div className="operator-workspace">
        <ProductionOperatorHeader />
          <main className="operator-main"><Outlet /></main>
      </div>
    </div>
  </ProductionWorkspaceProvider>
}
