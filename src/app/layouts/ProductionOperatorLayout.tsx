import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import type { Event } from '../../domain/events/event.types.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { OperatorSidebar } from '../shell/OperatorSidebar.tsx'
import { createBroadcastChannelTransport } from '../../application/display-transport/transport.ts'
import type { ProtocolScope } from '../../application/display-transport/protocol.ts'

function ProductionDisplayIndicator() {
  const scope: ProtocolScope = useMemo(() => ({ eventId: 'production-event', displayId: 'public-display' }), [])
  const transport = useMemo(() => createBroadcastChannelTransport('raffle-os-display', scope), [scope])
  const [status, setStatus] = useState<'waiting' | 'ready' | 'unavailable'>(() => transport.capability.transport === 'available' ? 'waiting' : 'unavailable')
  useEffect(() => {
    if (transport.capability.transport !== 'available') return () => undefined
    const unsubscribe = transport.subscribe((envelope) => {
      if (envelope.sender.kind === 'display' && envelope.message.type === 'display-ready' && envelope.scope.eventId === scope.eventId && envelope.scope.displayId === scope.displayId) setStatus('ready')
    })
    return () => { unsubscribe(); transport.close() }
  }, [scope, transport])
  return <span className="operator-display-indicator" role="status" data-display-status={status}>{status === 'ready' ? 'Display responded' : status === 'waiting' ? 'Waiting for display' : 'Display unavailable'}</span>
}

function ProductionOperatorHeader({ event, loading }: { event: Event | null; loading: boolean }) {
  return (
    <header className="operator-header">
      <div className="operator-header__event">
        <span className="operator-header__label">Current event</span>
        <strong>{loading ? 'Resolving active Event' : event?.name ?? 'No Event selected'}</strong>
        <span className="operator-header__schedule">
          {event === null ? 'Production runtime' : `Status: ${event.status}`}
        </span>
      </div>
      <div className="operator-header__status" aria-label="Production status">
        <span className="operator-header__schedule">Local-first runtime</span>
      </div>
    </header>
  )
}

export function ProductionOperatorLayout() {
  const location = useLocation()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const services = createDrawSetupProductionServices()
    void (async () => {
      try {
        await services.open()
        const routeMatch = location.pathname.match(/^\/draw\/(?:run|pending)\/([^/]+)$/)
        if (routeMatch?.[1] !== undefined) {
          const session = await services.sessions.findById(routeMatch[1] as never)
          const routedEvent = session === null ? null : await services.events.findById(session.eventId)
          if (active) setEvent(routedEvent)
        } else {
          const activeEventId = await services.preferences.get('activeEventId')
          const activeEvent = activeEventId === null ? null : await services.events.findById(activeEventId)
          if (active) setEvent(activeEvent)
        }
      } catch {
        if (active) setEvent(null)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [location.pathname])

  return (
    <div className="operator-layout" data-interface="operator" data-operator-shell>
      <OperatorSidebar production />
      <div className="operator-workspace">
        <ProductionOperatorHeader event={event} loading={loading} />
        <ProductionDisplayIndicator />
        <main className="operator-main"><Outlet /></main>
      </div>
    </div>
  )
}
