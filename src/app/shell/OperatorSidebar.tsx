import { NavLink } from 'react-router'
import { useProductionWorkspace } from '../workspace/ProductionWorkspaceContext.tsx'
import { PRODUCTION_SETUP_JOURNEY } from '../../shared/components/production-setup-journey.ts'
import { Icon, type IconName } from '../../shared/ui/index.ts'
import { productionSetupStageIndexForRoute, type ProductionSetupReadiness } from '../workspace/production-setup-readiness.ts'

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
  { label: 'Dashboard', icon: 'LayoutDashboard', to: '/dashboard' },
  { label: PRODUCTION_SETUP_JOURNEY[1].label, icon: 'Trophy', to: PRODUCTION_SETUP_JOURNEY[1].to },
  { label: 'Participants', icon: 'Users', to: '/participants' },
  { label: PRODUCTION_SETUP_JOURNEY[3].label, icon: 'MonitorCog', to: PRODUCTION_SETUP_JOURNEY[3].to },
  { label: 'Draw Setup', icon: 'SlidersHorizontal', to: '/draw/setup' },
  { label: 'Live Draw', icon: 'Radio', to: '/draw/live' },
  { label: 'Pending Results', icon: 'ClipboardCheck', to: '/draw/pending' },
  { label: 'History', icon: 'History', to: '/history' },
] as const

type NavigationItem = {
  readonly label: string
  readonly marker?: string
  readonly icon?: IconName
  readonly to: string
}

export function OperatorSidebar({ eventScopedNavigationDisabled, production = false }: { readonly eventScopedNavigationDisabled?: boolean; readonly production?: boolean }) {
  if (production && eventScopedNavigationDisabled !== undefined) return <OperatorSidebarContent disabled={eventScopedNavigationDisabled} navigationItems={productionNavigationItems} production />
  if (production) return <ProductionOperatorSidebar />
  return <OperatorSidebarContent navigationItems={prototypeNavigationItems} />
}

function ProductionOperatorSidebar() {
  const workspace = useProductionWorkspace()
  const eventScopedNavigationDisabled = workspace.status === 'empty' || workspace.status === 'invalid-reference'
  return <OperatorSidebarContent disabled={eventScopedNavigationDisabled} readiness={workspace.status === 'ready' ? workspace.setupReadiness : null} reachedStep={workspace.status === 'ready' ? workspace.setupJourneyReachedStep : undefined} navigationItems={productionNavigationItems} production />
}

function OperatorSidebarContent({
  disabled = false,
  navigationItems,
  production = false,
  readiness = null,
  reachedStep,
}: {
  readonly disabled?: boolean
  readonly navigationItems: readonly NavigationItem[]
  readonly production?: boolean
  readonly readiness?: ProductionSetupReadiness | null
  readonly reachedStep?: number
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
              {item.to !== '/dashboard' && ((readiness !== null && !isProductionNavigationUnlocked(item.to, readiness, reachedStep)) || (readiness === null && disabled)) ? <span aria-disabled="true" className="operator-nav__link operator-nav__link--disabled" title="Complete the previous setup step first">
                <NavigationIcon item={item} />
                <span>{item.label}</span>
              </span> : <NavLink
                className={({ isActive }) => isActive ? 'operator-nav__link operator-nav__link--active' : 'operator-nav__link'}
                end
                to={item.to}
              >
                <NavigationIcon item={item} />
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

function NavigationIcon({ item }: { readonly item: NavigationItem }) {
  return item.icon === undefined
    ? <span aria-hidden="true" className="operator-nav__marker">{item.marker}</span>
    : <span className="operator-nav__icon"><Icon name={item.icon} size={20} /></span>
}

function isProductionNavigationUnlocked(pathname: string, readiness: ProductionSetupReadiness, reachedStep = 0): boolean {
  const stageIndex = productionSetupStageIndexForRoute(pathname)
  if (stageIndex !== undefined) return stageIndex < reachedStep
  return reachedStep >= 5 && readiness.drawSetup
}
