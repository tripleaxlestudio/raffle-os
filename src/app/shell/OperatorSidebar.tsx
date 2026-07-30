import { NavLink } from 'react-router'

const navigationItems = [
  { label: 'Dashboard', marker: 'DB', to: '/dashboard' },
  { label: 'Participants', marker: 'PT', to: '/participants' },
  { label: 'Draw Setup', marker: 'DS', to: '/draw/setup' },
  { label: 'Live Draw', marker: 'LD', to: '/draw/live' },
  { label: 'Pending Results', marker: 'PR', to: '/draw/results' },
  { label: 'History', marker: 'HI', to: '/history' },
  { label: 'Settings', marker: 'ST', to: '/settings' },
] as const

export function OperatorSidebar() {
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
          Static prototype
        </span>
        <span>Phase 2 · Slice 1</span>
      </div>
    </aside>
  )
}
