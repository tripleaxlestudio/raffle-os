import { themeClass } from '../../shared/ui/ui-theme.ts'
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
  { label: 'Dasbor', icon: 'LayoutDashboard', to: '/dashboard' },
  { label: PRODUCTION_SETUP_JOURNEY[1].label, icon: 'Trophy', to: PRODUCTION_SETUP_JOURNEY[1].to },
  { label: 'Peserta', icon: 'Users', to: '/participants' },
  { label: PRODUCTION_SETUP_JOURNEY[3].label, icon: 'MonitorCog', to: PRODUCTION_SETUP_JOURNEY[3].to },
  { label: 'Pengaturan Undian', icon: 'SlidersHorizontal', to: '/draw/setup' },
  { label: 'Undian', icon: 'Radio', to: '/draw/live' },
  { label: 'Hasil', icon: 'ClipboardCheck', to: '/draw/pending' },
  { label: 'Riwayat', icon: 'History', to: '/history' },
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
  const shellClass = (name: string) => themeClass(production ? 'kocokan' : 'legacy', name)
  return (
    <aside className={shellClass("operator-sidebar")} aria-label="Bilah samping Operator">
      <div className={shellClass("operator-sidebar__brand")}>
        <span aria-hidden="true" className={shellClass("operator-sidebar__monogram")}>
          {production ? 'K' : 'RO'}
        </span>
        <p className={shellClass("operator-sidebar__identity")}>
          <strong>{production ? 'KOCOKAN' : 'Raffle OS'}</strong>
          <span>Kontrol Operator</span>
        </p>
      </div>
      <p className={shellClass("operator-sidebar__section-label")}>Ruang kerja</p>
      <nav aria-label="Navigasi Operator">
        <ul className={shellClass("operator-nav")}>
          {navigationItems.map((item) => (
            <li key={item.to}>
              {item.to !== '/dashboard' && ((readiness !== null && !isProductionNavigationUnlocked(item.to, readiness, reachedStep)) || (readiness === null && disabled)) ? <span aria-disabled="true" className={shellClass("operator-nav__link operator-nav__link--disabled")} title="Selesaikan langkah pengaturan sebelumnya terlebih dahulu">
                <NavigationIcon item={item} production={production} />
                <span>{item.label}</span>
              </span> : <NavLink
                className={({ isActive }) => shellClass(isActive ? 'operator-nav__link operator-nav__link--active' : 'operator-nav__link')}
                end
                to={item.to}
              >
                <NavigationIcon item={item} production={production} />
                <span>{item.label}</span>
              </NavLink>}
            </li>
          ))}
        </ul>
      </nav>
      <div className={shellClass("operator-sidebar__footer")}>
        <span className={shellClass("operator-sidebar__footer-label")}>
          {production ? 'Ruang kerja produksi' : 'Static prototype'}
        </span>
        <span>{production ? 'Berjalan lokal' : 'Phase 2 Prototype'}</span>
      </div>
    </aside>
  )
}

function NavigationIcon({ item, production }: { readonly item: NavigationItem; readonly production: boolean }) {
  const shellClass = (name: string) => themeClass(production ? 'kocokan' : 'legacy', name)
  return item.icon === undefined
    ? <span aria-hidden="true" className={shellClass("operator-nav__marker")}>{item.marker}</span>
    : <span className={shellClass("operator-nav__icon")}><Icon name={item.icon} size={20} /></span>
}

function isProductionNavigationUnlocked(pathname: string, readiness: ProductionSetupReadiness, reachedStep = 0): boolean {
  const stageIndex = productionSetupStageIndexForRoute(pathname)
  if (stageIndex !== undefined) return stageIndex < reachedStep
  return reachedStep >= 5 && readiness.drawSetup
}
