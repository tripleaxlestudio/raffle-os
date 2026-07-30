import { Link } from 'react-router'
import { prototypeNavigationItems } from '../../prototype/scenarios.ts'

export function PrototypeNavigator() {
  return (
    <details className="prototype-navigator">
      <summary>Prototype navigation</summary>
      <nav aria-label="Prototype navigation scenarios">
        <p>Direct links — static states only</p>
        <ul>
          {prototypeNavigationItems.map((item) => (
            <li key={item.to}>
              <Link to={item.to}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  )
}
