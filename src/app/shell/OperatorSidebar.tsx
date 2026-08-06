import { NavLink } from 'react-router'

const prototypeNavigationItems = [
  { label: 'Dashboard', marker: 'DB', to: '/dashboard' },
  { label: 'Participants', marker: 'PT', to: '/participants' },
  { label: 'Draw Setup', marker: 'DS', to: '/draw/setup' },
  { label: 'Live Draw', marker: 'LD', to: '/draw/live' },
  { label: 'Pending Results', marker: 'PR', to: '/draw/results' },
  { label: 'History', marker: 'HI', to: '/history' },
  { label: 'Settings', marker: 'ST', to: '/settings' },
] as const

const productionNavigationItems = [
  { label: 'Dashboard', marker: 'DB', to: '/dashboard' },
  { label: 'Events', marker: 'EV', to: '/events' },
  { label: 'PrizeCategories', marker: 'PC', to: '/prize-categories' },
  { label: 'Participants', marker: 'PT', to: '/participants' },
  { label: 'Draw Setup', marker: 'DS', to: '/draw/setup' },
  { label: 'History', marker: 'HI', to: '/history' },
  { label: 'Audience Display', marker: 'AD', to: '/display' },
] as const

export function OperatorSidebar({ production = false }: { production?: boolean }) {
  const navigationItems = production ? productionNavigationItems : prototypeNavigationItems
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
              <NavLink
                className={({ isActive }) =>
                  isActive
                    ? 'operator-nav__link operator-nav__link--active'
                    : 'operator-nav__link'
                }
                end
                to={item.to}
              >
                <span aria-hidden="true" className="operator-nav__marker">
                  {item.marker}
                </span>
                <span>{item.label}</span>
              </NavLink>
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
