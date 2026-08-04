import {
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router'
import { useEffect, useState } from 'react'
import {
  getDashboardPrototype,
  resolveDashboardPrototypeScenario,
  type DashboardPrototypeScenario,
} from '../../prototype/dashboard.ts'
import { resolvePrototypeDrawMode } from '../../prototype/scenario-query.ts'
import { OperatorHeader } from '../shell/OperatorHeader.tsx'
import { OperatorSidebar } from '../shell/OperatorSidebar.tsx'
import { createParticipantImportProductionServices } from '../../application/participant-import/participant-import-production-services.ts'
import { resolveParticipantWorkflow } from '../../pages/operator/participant-workflow.ts'
import type { Event } from '../../domain/events/event.types.ts'

export function OperatorLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [productionEvent, setProductionEvent] = useState<Event | null>(null)
  const [productionEventLoading, setProductionEventLoading] = useState(false)
  const scenario =
    location.pathname === '/dashboard'
      ? resolveDashboardPrototypeScenario(searchParams)
      : 'ready'
  const prototype = getDashboardPrototype(scenario)
  const isProductionParticipantRoute =
    location.pathname === '/participants' &&
    resolveParticipantWorkflow(searchParams) === 'production'
  const isProductionDrawSetupRoute = location.pathname === '/draw/setup'
  const isProductionEventRoute = isProductionParticipantRoute || isProductionDrawSetupRoute
  const mode =
    location.pathname === '/draw/setup' ||
    location.pathname === '/draw/live'
      ? resolvePrototypeDrawMode(searchParams.get('mode'))
      : prototype.mode

  useEffect(() => {
    if (!isProductionEventRoute) return

    let active = true
    const services = createParticipantImportProductionServices()
    void (async () => {
      try {
        await services.database.openSupported()
        const activeEventId = await services.preferences.get('activeEventId')
        const event = activeEventId === null ? null : await services.events.findById(activeEventId)
        if (active) setProductionEvent(event)
      } catch {
        if (active) setProductionEvent(null)
      } finally {
        if (active) setProductionEventLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [isProductionEventRoute])

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
      <OperatorSidebar production={isProductionEventRoute} />
      <div className="operator-workspace">
        <OperatorHeader
          connectionStatus={prototype.connectionStatus}
          eventName={isProductionEventRoute ? productionEvent?.name ?? 'No Event selected' : prototype.event.name}
          eventSchedule={isProductionEventRoute
            ? productionEventLoading
              ? 'Resolving active Event'
              : productionEvent
                ? `Status: ${productionEvent.status}`
                : 'No active Event selected'
            : prototype.event.schedule}
          mode={mode}
          onScenarioChange={handleScenarioChange}
          scenario={scenario}
          showPrototypeControls={!isProductionParticipantRoute}
        />
        <main className="operator-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
