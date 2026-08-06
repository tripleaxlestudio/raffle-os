import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, ButtonLink, Card } from '../../shared/ui/index.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { queryDrawSessionQueue, type DrawSessionQueueResult } from '../../application/draw/draw-session-queue.ts'
import { useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'

function statusLabel(status: DrawSessionQueueResult['items'][number]['session']['status']): string {
  return status === 'pending-confirmation' ? 'Pending confirmation' : status.replace('-', ' ')
}

function modeLabel(mode: DrawSessionQueueResult['items'][number]['session']['mode']): string {
  return mode === 'live' ? 'Live · official' : 'Practice · rehearsal'
}

export function DrawSessionQueuePage() {
  const workspace = useProductionWorkspace()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; queue: DrawSessionQueueResult }>({ status: 'loading' })
  const load = useCallback(async () => {
    if (workspace.status !== 'ready') return
    setState({ status: 'loading' })
    try {
      await services.open()
      const queue = await queryDrawSessionQueue(workspace.event.id, services)
      if (queue === null) setState({ status: 'error', message: 'The active Event could not be read back from local persistence.' })
      else setState({ status: 'ready', queue })
    } catch (cause: unknown) {
      setState({ status: 'error', message: cause instanceof Error ? cause.message : 'DrawSessions could not be read safely.' })
    }
  }, [services, workspace])

  useEffect(() => { void Promise.resolve().then(load) }, [load])

  if (workspace.status === 'loading' || state.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Production operations" headingId="draw-queue-title" title="Draw Sessions" description="Reading authoritative local sessions…" /></section>
  if (workspace.status === 'empty' || workspace.status === 'invalid-reference') return <section aria-labelledby="draw-queue-title"><PageHeader eyebrow="Production operations" headingId="draw-queue-title" title="Draw Sessions" description="An active Event is required." /><StatusBanner badge="Setup required" title="Select or create an Event first" tone="warning">Sessions are scoped to the selected Event and are never inferred.</StatusBanner><ButtonLink to="/events">Open Event management</ButtonLink></section>
  if (workspace.status === 'error') return <section aria-labelledby="draw-queue-title"><PageHeader eyebrow="Production operations" headingId="draw-queue-title" title="Draw Sessions" description="The production queue is unavailable." /><StatusBanner badge="Storage error" title="Could not read DrawSessions" tone="warning">{workspace.message}</StatusBanner></section>
  if (state.status === 'error') return <section aria-labelledby="draw-queue-title"><PageHeader eyebrow="Production operations" headingId="draw-queue-title" title="Draw Sessions" description="The production queue is unavailable." /><StatusBanner badge="Read failure" title="Could not read DrawSessions" tone="warning">{state.message}</StatusBanner><Button onClick={() => void load()}>Retry read</Button></section>

  const { queue } = state
  const unresolved = queue.items.filter((item) => item.session.status === 'drawing' || item.session.status === 'pending-confirmation').length
  return <section aria-labelledby="draw-queue-title" className="draw-setup">
    <PageHeader eyebrow="Production operations" headingId="draw-queue-title" title="Draw Sessions" description={`${queue.event.name} · authoritative Event queue`} actions={<ButtonLink size="lg" to="/draw/setup">Open Draw Setup</ButtonLink>} />
    <StatusBanner badge={unresolved > 0 ? 'Action required' : 'Queue ready'} title={unresolved > 0 ? `${unresolved} session${unresolved === 1 ? '' : 's'} need attention` : 'Choose the next persisted session'} tone={unresolved > 0 ? 'warning' : 'info'}>Practice is rehearsal-only. Live results remain pending until an explicit decision is recorded.</StatusBanner>
    {queue.items.length === 0 ? <Card padding="md"><h2>No DrawSessions yet</h2><p>Create a configuration in Draw Setup; the saved session will appear here immediately.</p><ButtonLink to="/draw/setup">Create DrawSession</ButtonLink></Card> : <div className="draw-session-queue" aria-label="DrawSession queue">{queue.items.map((item) => <Card key={item.session.id} padding="md" className="draw-session-queue__item"><div className="draw-session-queue__heading"><div><p className="operator-eyebrow">{item.event?.name ?? queue.event.name}</p><h2>{item.category?.name ?? 'Prize category unavailable'}</h2><p>{item.category?.prizeName ?? 'Related prize unavailable'}</p></div><div className="draw-session-queue__badges"><span>{modeLabel(item.session.mode)}</span><span>{statusLabel(item.session.status)}</span></div></div><dl className="summary-list"><div className="summary-list__item"><dt>Winner count</dt><dd>{item.winnerCount}</dd></div><div className="summary-list__item"><dt>Updated</dt><dd>{item.session.updatedAt}</dd></div><div className="summary-list__item"><dt>Presentation</dt><dd>{item.checkpoint === null ? 'No checkpoint' : `Recover at ${item.checkpoint.stage}`}</dd></div></dl>{item.relation !== 'valid' ? <StatusBanner badge="Blocked" title="Related setup is unavailable" tone="warning">This session cannot be opened because its persisted {item.relation.replace('missing-', '')} relation is unavailable or belongs to another Event.</StatusBanner> : null}<div className="button-row">{item.action?.kind === 'setup' ? <ButtonLink to={item.action.to}>Open Draw Setup</ButtonLink> : null}{item.action?.kind === 'run' ? <ButtonLink to={item.action.to}>{item.session.status === 'drawing' ? 'Resume presentation' : item.session.mode === 'live' ? 'Start Live' : 'Start Practice'}</ButtonLink> : null}{item.action?.kind === 'pending' ? <ButtonLink to={item.action.to}>Review Pending Results</ButtonLink> : null}{item.action?.kind === 'history' ? <ButtonLink to={item.action.to}>View official History</ButtonLink> : null}</div></Card>)}</div>}
  </section>
}
