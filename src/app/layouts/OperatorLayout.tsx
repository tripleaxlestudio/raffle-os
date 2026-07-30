import {
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router'
import {
  getDashboardPrototype,
  resolveDashboardPrototypeScenario,
  type DashboardPrototypeScenario,
} from '../../prototype/dashboard.ts'
import { OperatorHeader } from '../shell/OperatorHeader.tsx'
import { OperatorSidebar } from '../shell/OperatorSidebar.tsx'

export function OperatorLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const scenario =
    location.pathname === '/dashboard'
      ? resolveDashboardPrototypeScenario(searchParams)
      : 'ready'
  const prototype = getDashboardPrototype(scenario)

  function handleScenarioChange(
    nextScenario: DashboardPrototypeScenario,
  ) {
    void navigate(`/dashboard?scenario=${nextScenario}`)
  }

  return (
    <div
      className="operator-layout"
      data-interface="operator"
      data-operator-shell
    >
      <OperatorSidebar />
      <div className="operator-workspace">
        <OperatorHeader
          connectionStatus={prototype.connectionStatus}
          eventName={prototype.event.name}
          eventSchedule={prototype.event.schedule}
          mode={prototype.mode}
          onScenarioChange={handleScenarioChange}
          scenario={scenario}
        />
        <main className="operator-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
