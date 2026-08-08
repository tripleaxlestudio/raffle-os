import { NavLink } from 'react-router'
import { useProductionWorkspace } from '../workspace/ProductionWorkspaceContext.tsx'
import { PRODUCTION_SETUP_JOURNEY } from '../../shared/components/production-setup-journey.ts'
import { productionSetupStageUnlocked, type ProductionSetupReadiness } from '../workspace/production-setup-readiness.ts'

const prototypeNavigationItems = [
  { label: 'Dashboard', marker: 'DB', to: '/dashboard' },
  { label: 'Participants', marker: 'PT', to: '/participants' },
  { label: 'Draw Setup', marker: 'DS', to: '/draw/setup' },
  { label: 'Live Draw', marker: 'LD', to: '/draw/live' },
  { label: 'Pending Results', marker: 'PR', to: '/draw/pending' },
  { label: 'History', marker: 'HI', to: '/history' },
  { label: 'Settings', marker: 'ST', to: '/settings' },
] as const

const productionNavigationItems = [
  { label: 'Dashboard', marker: 'DB', to: '/dashboard' },
  { label: PRODUCTION_SETUP_JOURNEY[1].label, marker: 'PR', to: PRODUCTION_SETUP_JOURNEY[1].to },
  { label: 'Participants', marker: 'PT', to: '/participants' },
  { label: PRODUCTION_SETUP_JOURNEY[3].label, marker: 'DV', to: PRODUCTION_SETUP_JOURNEY[3].to },
  { label: 'Draw Setup', marker: 'DS', to: '/draw/setup' },
  { label: 'Live Draw', marker: 'LD', to: '/draw/live' },
  { label: 'Pending Results', marker: 'PR', to: '/draw/pending' },
  { label: 'History', marker: 'HI', to: '/history' },
] as const

export function OperatorSidebar({ eventScopedNavigationDisabled, production = false }: { readonly eventScopedNavigationDisabled?: boolean; readonly production?: boolean }) {
  if (production && eventScopedNavigationDisabled !== undefined) return <OperatorSidebarContent disabled={eventScopedNavigationDisabled} navigationItems={productionNavigationItems} production />
  if (production) return <ProductionOperatorSidebar />
  return <OperatorSidebarContent navigationItems={prototypeNavigationItems} />
}

function ProductionOperatorSidebar() {
  const workspace = useProductionWorkspace()
  const eventScopedNavigationDisabled = workspace.status === 'empty' || workspace.status === 'invalid-reference'
  return <OperatorSidebarContent disabled={eventScopedNavigationDisabled} readiness={workspace.status === 'ready' ? workspace.setupReadiness : null} navigationItems={productionNavigationItems} production />
}

function OperatorSidebarContent({
  disabled = false,
  navigationItems,
  production = false,
  readiness = null,
}: {
  readonly disabled?: boolean
  readonly navigationItems: readonly { readonly label: string; readonly marker: string; readonly to: string }[]
  readonly production?: boolean
  readonly readiness?: ProductionSetupReadiness | null
}) {
  return (
    <aside className="operator-sidebar" aria-label="Operator sidebar">
      <div className="operator-sidebar__brand">
        <span aria-hidden="true" className="operator-sidebar__monogram">
          RO
        </span>
        <p className="operator-sidebar__identity">
          <strong>Raffle OS</strong>
          <span>Operator control</span>
        </p>
      </div>
      <p className="operator-sidebar__section-label">Workspace</p>
      <nav aria-label="Operator navigation">
        <ul className="operator-nav">
          {navigationItems.map((item) => (
            <li key={item.to}>
              {item.to !== '/dashboard' && ((readiness !== null && !productionSetupStageUnlocked(readiness, navigationItems.indexOf(item) - 1)) || (readiness === null && disabled)) ? <span aria-disabled="true" className="operator-nav__link operator-nav__link--disabled" title="Complete the previous setup step first">
                <span aria-hidden="true" className="operator-nav__marker">{item.marker}</span>
                <span>{item.label}</span>
              </span> : <NavLink
                className={({ isActive }) => isActive ? 'operator-nav__link operator-nav__link--active' : 'operator-nav__link'}
                end
                to={item.to}
              >
                <span aria-hidden="true" className="operator-nav__marker">{item.marker}</span>
                <span>{item.label}</span>
              </NavLink>}
            </li>
          ))}
        </ul>
      </nav>
      <div className="operator-sidebar__footer">
        <span className="operator-sidebar__footer-label">
          {production ? 'Production workspace' : 'Static prototype'}
        </span>
        <span>{production ? 'Local-first runtime' : 'Phase 2 Prototype'}</span>
      </div>
    </aside>
  )
}
