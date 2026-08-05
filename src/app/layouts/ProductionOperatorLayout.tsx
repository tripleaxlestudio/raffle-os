import { Outlet } from 'react-router'
import { ProductionWorkspaceProvider, useProductionWorkspace } from '../workspace/ProductionWorkspaceContext.tsx'
import { OperatorSidebar } from '../shell/OperatorSidebar.tsx'

function ProductionOperatorHeader() {
  const workspace = useProductionWorkspace()
  const eventLabel = workspace.status === 'loading'
    ? 'Reading active Event'
    : workspace.status === 'ready'
      ? workspace.event.name
      : workspace.status === 'empty'
        ? 'No active Event'
        : 'Workspace unavailable'
  const detail = workspace.status === 'ready'
    ? `Status: ${workspace.event.status}${workspace.unresolvedSession === null ? '' : ' · unresolved Live session'}`
    : workspace.status === 'invalid-reference'
      ? 'Invalid saved Event reference'
      : workspace.status === 'error'
        ? 'Storage failure'
        : workspace.status === 'empty'
          ? 'Setup required'
          : 'Loading'
  return <header className="operator-header">
    <div className="operator-header__event">
      <span className="operator-header__label">Current event</span>
      <strong>{eventLabel}</strong>
      <span className="operator-header__schedule">{detail}</span>
    </div>
    <div className="operator-header__status" aria-label="Production status"><span className="operator-header__schedule">Local-first runtime</span></div>
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
