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
import { resolvePrototypeDrawMode } from '../../prototype/scenario-query.ts'
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
  const isProductionParticipantPreview =
    location.pathname === '/participants' &&
    searchParams.get('workflow') === 'production-preview'
  const mode =
    location.pathname === '/draw/setup' ||
    location.pathname === '/draw/live'
      ? resolvePrototypeDrawMode(searchParams.get('mode'))
      : prototype.mode

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
          eventName={
            isProductionParticipantPreview
              ? 'Production Preview Event'
              : prototype.event.name
          }
          eventSchedule={
            isProductionParticipantPreview
              ? 'Resolved in import workspace'
              : prototype.event.schedule
          }
          mode={mode}
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
