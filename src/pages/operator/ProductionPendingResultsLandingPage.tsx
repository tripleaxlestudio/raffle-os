import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, ButtonLink, Card } from '../../shared/ui/index.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { queryDrawSessionQueue, type DrawSessionQueueResult } from '../../application/draw/draw-session-queue.ts'
import { useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'

type LandingState = { readonly status: 'loading' } | { readonly status: 'error'; readonly message: string } | { readonly status: 'ready'; readonly queue: DrawSessionQueueResult }

export function ProductionPendingResultsLandingPage() {
  const workspace = useProductionWorkspace()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const [state, setState] = useState<LandingState>({ status: 'loading' })
  const load = useCallback(async () => {
    if (workspace.status !== 'ready') return
    setState({ status: 'loading' })
    try {
      await services.open()
      const queue = await queryDrawSessionQueue(workspace.event.id, services)
      setState(queue === null ? { status: 'error', message: 'The active Event could not be read back from local persistence.' } : { status: 'ready', queue })
    } catch (cause: unknown) {
      setState({ status: 'error', message: cause instanceof Error ? cause.message : 'Pending DrawSessions could not be read safely.' })
    }
  }, [services, workspace])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  if (workspace.status === 'loading' || state.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Production operations" headingId="pending-landing-title" title="Pending Results" description="Reading authoritative pending sessions…" /></section>
  if (workspace.status !== 'ready') return <section aria-labelledby="pending-landing-title"><PageHeader eyebrow="Production operations" headingId="pending-landing-title" title="Pending Results" description="An active Event is required." /><StatusBanner badge="Setup required" title="Select or create an Event first" tone="warning">Pending results are scoped to the authoritative active Event.</StatusBanner><ButtonLink to="/events">Open Event management</ButtonLink></section>
  if (state.status === 'error') return <section aria-labelledby="pending-landing-title"><PageHeader eyebrow="Production operations" headingId="pending-landing-title" title="Pending Results" description="The production pending list is unavailable." /><StatusBanner badge="Read failure" title="Could not read pending sessions" tone="warning">{state.message}</StatusBanner><Button onClick={() => void load()}>Retry read</Button></section>

  const pending = state.queue.items.filter((item) => item.session.mode === 'live' && item.session.status === 'pending-confirmation')
  return <section aria-labelledby="pending-landing-title">
    <PageHeader eyebrow="Production operations" headingId="pending-landing-title" title="Pending Results" description={`${state.queue.event.name} · unresolved Live sessions`} />
    {pending.length === 0 ? <Card padding="md"><h2>No pending results</h2><p>There are no unresolved Live results for this Event.</p><div className="button-row"><ButtonLink to="/draw/live">Open Live Draw</ButtonLink><ButtonLink variant="secondary" to="/history">Open History</ButtonLink></div></Card> : pending.length === 1 ? <Card padding="md"><StatusBanner badge="Action required" title="One result needs confirmation" tone="warning">Review the authoritative result before it can enter official History.</StatusBanner><ButtonLink size="lg" to={`/draw/pending/${pending[0].session.id}`}>Review Pending Result</ButtonLink></Card> : <div className="draw-session-queue" aria-label="Pending DrawSessions">{pending.map((item) => <Card key={item.session.id} padding="md" className="draw-session-queue__item"><p className="operator-eyebrow">{item.category?.name ?? 'Prize category unavailable'}</p><h2>{item.category?.prizeName ?? 'Prize unavailable'}</h2><p>Updated {item.session.updatedAt}</p><ButtonLink to={`/draw/pending/${item.session.id}`}>Review this result</ButtonLink></Card>)}</div>}
  </section>
}
