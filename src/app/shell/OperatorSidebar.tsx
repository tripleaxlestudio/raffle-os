import { NavLink } from 'react-router'

const navigationItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Participants', to: '/participants' },
  { label: 'Draw Setup', to: '/draw/setup' },
  { label: 'Live Draw', to: '/draw/live' },
  { label: 'Pending Results', to: '/draw/results' },
  { label: 'History', to: '/history' },
  { label: 'Settings', to: '/settings' },
] as const

export function OperatorSidebar() {
  return (
    <aside className="operator-sidebar" aria-label="Operator sidebar">
      <p className="operator-sidebar__identity">Raffle OS</p>
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
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
