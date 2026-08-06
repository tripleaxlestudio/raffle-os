import { Link, Outlet } from 'react-router'
import { useEffect, useRef, useState } from 'react'
import { ProductionWorkspaceProvider, useProductionWorkspace } from '../workspace/ProductionWorkspaceContext.tsx'
import { OperatorSidebar } from '../shell/OperatorSidebar.tsx'

function ProductionOperatorHeader() {
  const workspace = useProductionWorkspace()
  const [eventMenuOpen, setEventMenuOpen] = useState(false)
  const [popupBlocked, setPopupBlocked] = useState(false)
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
  const audienceState = workspace.status !== 'ready'
    ? workspace.status === 'error' ? 'Unavailable' : 'Setup required'
    : workspace.displayConfiguration === null ? 'Setup required' : 'Waiting'
  const audienceUrl = workspace.status === 'ready' && workspace.displayConfiguration !== null
    ? `/display?eventId=${encodeURIComponent(workspace.event.id)}&displayConfigurationId=${encodeURIComponent(workspace.displayConfiguration.id)}`
    : null
  const audienceDetail = audienceUrl === null ? 'Open Settings to configure the production display.' : 'Production display scope is ready; waiting for operator publication.'
  const openAudience = () => {
    if (audienceUrl === null) return
    const popup = window.open(audienceUrl, '_blank', 'noopener,noreferrer')
    setPopupBlocked(popup === null)
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
      {popupBlocked && audienceUrl !== null ? <span role="alert">Pop-up blocked. <a href={audienceUrl} target="_blank" rel="noreferrer">Open Audience Display</a></span> : null}
    </div>
  </header>
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
