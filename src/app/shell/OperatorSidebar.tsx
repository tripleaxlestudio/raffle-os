import { useState } from 'react'
import { themeClass } from '../../shared/ui/ui-theme.ts'
import { NavLink } from 'react-router'
import { useProductionWorkspace } from '../workspace/ProductionWorkspaceContext.tsx'
import { PRODUCTION_SETUP_JOURNEY } from '../../shared/components/production-setup-journey.ts'
import { Icon, type IconName } from '../../shared/ui/index.ts'
import { productionSetupStageIndexForRoute, type ProductionSetupReadiness } from '../workspace/production-setup-readiness.ts'
import { ReportIssueModal } from '../../pages/operator/ReportIssueModal.tsx'

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
  { label: 'Log', icon: 'FileText', to: '/log' },
  { label: 'Settings', icon: 'Settings', to: '/settings/app' },
] as const

const productionUtilityItems = [
  { label: 'Yang Baru', icon: 'Sparkles' },
  { label: 'Panduan Pengguna', icon: 'BookOpen' },
] as const satisfies readonly { readonly label: string; readonly icon: IconName }[]

const productionSupportItems = ['Laporkan Masalah', 'Dokumentasi', 'Tentang Kocokan'] as const

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
  const [supportExpanded, setSupportExpanded] = useState(false)
  const [reportIssueOpen, setReportIssueOpen] = useState(false)
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
              {isEventScopedNavigationItem(item.to) && ((readiness !== null && !isProductionNavigationUnlocked(item.to, readiness, reachedStep)) || (readiness === null && disabled)) ? <span aria-disabled="true" className={shellClass("operator-nav__link operator-nav__link--disabled")} title="Selesaikan langkah pengaturan sebelumnya terlebih dahulu">
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
      {production ? <nav aria-label="Bantuan dan informasi" className={shellClass("operator-sidebar__utility")}>
        <ul className={shellClass("operator-sidebar__utility-list")}>
          {productionUtilityItems.map((item) => <li key={item.label}>
            <button className={shellClass("operator-sidebar__utility-button")} title={`${item.label} belum tersedia`} type="button">
              <span className={shellClass("operator-sidebar__utility-icon")}><Icon name={item.icon} size={17} /></span>
              <span>{item.label}</span>
            </button>
          </li>)}
          <li>
            <button
              aria-controls="operator-sidebar-support-menu"
              aria-expanded={supportExpanded}
              className={shellClass("operator-sidebar__utility-button operator-sidebar__utility-button--disclosure")}
              onClick={() => setSupportExpanded((expanded) => !expanded)}
              type="button"
            >
              <span className={shellClass("operator-sidebar__utility-icon")}><Icon name="LifeBuoy" size={17} /></span>
              <span>Dukungan</span>
              <span aria-hidden="true" className={shellClass("operator-sidebar__utility-chevron")}><Icon name="ChevronDown" size={15} /></span>
            </button>
            {supportExpanded ? <ul className={shellClass("operator-sidebar__submenu")} id="operator-sidebar-support-menu">
              {productionSupportItems.map((label) => <li key={label}>
                <button
                  className={shellClass("operator-sidebar__submenu-button")}
                  onClick={label === 'Laporkan Masalah' ? () => setReportIssueOpen(true) : undefined}
                  title={label === 'Laporkan Masalah' ? undefined : `${label} belum tersedia`}
                  type="button"
                >{label}</button>
              </li>)}
            </ul> : null}
          </li>
        </ul>
      </nav> : null}
      <div className={shellClass("operator-sidebar__footer")}>
        <span className={shellClass("operator-sidebar__footer-label")}>
          {production ? 'KOCOKAN' : 'Static prototype'}
        </span>
        <span>{production ? 'Versi pengembangan' : 'Phase 2 Prototype'}</span>
      </div>
      {production ? <ReportIssueModal onClose={() => setReportIssueOpen(false)} open={reportIssueOpen} /> : null}
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

function isEventScopedNavigationItem(pathname: string): boolean {
  return pathname !== '/dashboard' && pathname !== '/log' && pathname !== '/settings/app'
}
