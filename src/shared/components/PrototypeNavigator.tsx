import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router'
import { prototypeNavigationItems } from '../../prototype/scenarios.ts'

export function PrototypeNavigator() {
  const location = useLocation()
  const navigatorRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    navigatorRef.current?.removeAttribute('open')
  }, [location.pathname, location.search])

  return (
    <details className="prototype-navigator" ref={navigatorRef}>
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
