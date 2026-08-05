import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { projectLivePresentationResult, type PresentationResultProjection } from '../../application/workflow/presentation-projection.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Card } from '../../shared/ui/index.ts'

type LoadState = { status: 'loading' } | { status: 'ready'; result: PresentationResultProjection; eventName: string; prizeName: string; categoryName: string } | { status: 'error'; message: string }

export function ProductionPendingResultsPage() {
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const { drawSessionId } = useParams<{ drawSessionId: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const load = useCallback(async () => {
    if (drawSessionId === undefined) { setState({ status: 'error', message: 'Pending DrawSession was not specified.' }); return }
    try {
      await services.open()
      const session = await services.sessions.findById(drawSessionId as never)
      if (session === null) { setState({ status: 'error', message: 'Pending DrawSession was not found.' }); return }
      if (session.status !== 'pending-confirmation' || session.mode !== 'live') { setState({ status: 'error', message: 'This DrawSession is not a pending-confirmation Live result.' }); return }
      const winners = await services.winners.findByDrawSessionId(session.id)
      const event = await services.events.findById(session.eventId)
      const category = session.configurationSnapshot === null ? null : await services.categories.findById(session.configurationSnapshot.prizeCategoryId)
      if (event === null || category === null) { setState({ status: 'error', message: 'The pending result relationships could not be verified.' }); return }
      setState({ status: 'ready', result: projectLivePresentationResult(session.id, winners), eventName: event.name, categoryName: category.name, prizeName: category.prizeName })
    } catch { setState({ status: 'error', message: 'Pending results could not be read safely. Retry the local read.' }) }
  }, [drawSessionId, services])
  useEffect(() => { void Promise.resolve().then(load) }, [load])
  if (state.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Pending confirmation" headingId="pending-title" title="Pending Results" description="Reading the authoritative local result…" /></section>
  if (state.status === 'error') return <section><PageHeader eyebrow="Pending confirmation" headingId="pending-title" title="Pending Results unavailable" description={state.message} /><StatusBanner badge="Read-only recovery" title={state.message} tone="warning">Retry the read or return to Draw Setup. No draw command was run.</StatusBanner><button type="button" onClick={() => void load()}>Retry read</button></section>
  return <section aria-labelledby="pending-title" className="draw-setup"><PageHeader eyebrow="Production · read-only" headingId="pending-title" title="Pending Results" description={`${state.eventName} · ${state.categoryName} · ${state.prizeName}`} /><StatusBanner badge="Pending confirmation" title="Official result is preserved" tone="info">Confirmation and redraw actions will be available in Phase 8.</StatusBanner><Card padding="md"><ol aria-label="Official winners">{state.result.winners.map((winner) => <li key={winner.winnerId}><span>#{winner.sequence}</span> <code>{winner.ticketNumber}</code></li>)}</ol></Card><p><Link to="/draw/setup">Return to Draw Setup</Link></p></section>
}
