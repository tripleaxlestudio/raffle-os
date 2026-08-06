import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Button, ButtonLink, Card } from '../../shared/ui/index.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { queryDrawSessionQueue, type DrawSessionQueueResult } from '../../application/draw/draw-session-queue.ts'
import { useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { groupDrawSessionQueueItems, presentDrawSessionQueueItem, type DrawSessionQueuePriority } from '../../ui/operator/draw/draw-session-queue-view-model.ts'

const priorityHeadings: Record<DrawSessionQueuePriority, { readonly eyebrow: string; readonly title: string; readonly description: string }> = {
  'action-required': { eyebrow: 'Live operations', title: 'Action required', description: 'Resume an active presentation or resolve an official result.' },
  ready: { eyebrow: 'Next sessions', title: 'Ready sessions', description: 'Persisted sessions available to start from the current Event.' },
  historical: { eyebrow: 'Reference', title: 'Completed or cancelled', description: 'Resolved sessions remain available without competing with live operations.' },
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
  const groups = groupDrawSessionQueueItems(queue.items)
  const unresolved = groups['action-required'].length
  const renderGroup = (priority: DrawSessionQueuePriority) => {
    const items = groups[priority]
    if (items.length === 0) return null
    const heading = priorityHeadings[priority]
    return <section aria-labelledby={`draw-queue-${priority}`} className={`draw-session-queue__group draw-session-queue__group--${priority}`}>
      <div className="draw-session-queue__group-heading"><div><p className="operator-eyebrow">{heading.eyebrow}</p><h2 id={`draw-queue-${priority}`}>{heading.title}</h2><p>{heading.description}</p></div><Badge variant={priority === 'action-required' ? 'warning' : priority === 'historical' ? 'neutral' : 'info'}>{items.length} {items.length === 1 ? 'session' : 'sessions'}</Badge></div>
      <div className="draw-session-queue__items">{items.map((item) => <DrawSessionQueueCard item={item} eventName={queue.event.name} key={item.session.id} />)}</div>
    </section>
  }

  return <section aria-labelledby="draw-queue-title" className="draw-setup">
    <PageHeader eyebrow="Production operations" headingId="draw-queue-title" title="Draw Sessions" description={`${queue.event.name} · authoritative Event queue`} actions={<ButtonLink size="lg" to="/draw/setup">Open Draw Setup</ButtonLink>} />
    <StatusBanner badge={unresolved > 0 ? 'Action required' : 'Queue ready'} title={unresolved > 0 ? `${unresolved} session${unresolved === 1 ? '' : 's'} need attention` : 'Choose the next persisted session'} tone={unresolved > 0 ? 'warning' : 'info'}>Practice is rehearsal-only. Live results remain pending until an explicit decision is recorded.</StatusBanner>
    {queue.items.length === 0 ? <Card padding="md"><h2>No DrawSessions yet</h2><p>Create a configuration in Draw Setup; the saved session will appear here immediately.</p><ButtonLink to="/draw/setup">Create DrawSession</ButtonLink></Card> : <div className="draw-session-queue" aria-label="DrawSession queue">{renderGroup('action-required')}{renderGroup('ready')}{renderGroup('historical')}</div>}
  </section>
}

function DrawSessionQueueCard({ item, eventName }: { readonly item: DrawSessionQueueResult['items'][number]; readonly eventName: string }) {
  const presentation = presentDrawSessionQueueItem(item)
  return <Card className={`draw-session-queue__item${presentation.historical ? ' draw-session-queue__item--historical' : ''}`} padding="md">
    <div className="draw-session-queue__heading"><div><p className="operator-eyebrow">{eventName}</p><h3>{item.category?.name ?? 'Prize category unavailable'}</h3><p className="draw-session-queue__prize">{item.category?.prizeName ?? 'Related prize unavailable'}</p></div><div className="draw-session-queue__badges"><Badge variant={presentation.modeTone}>{presentation.modeLabel}</Badge><Badge variant={presentation.lifecycleTone}>{presentation.lifecycleLabel}</Badge></div></div>
    <dl className="draw-session-queue__metadata"><div><dt>Winner count</dt><dd>{item.winnerCount} {item.winnerCount === 1 ? 'winner' : 'winners'}</dd></div><div><dt>Updated</dt><dd>{presentation.updatedLabel}</dd></div></dl>
    <p className="draw-session-queue__checkpoint"><span>Presentation</span><strong>{presentation.checkpointLabel}</strong></p>
    {presentation.relationLabel === null ? null : <StatusBanner badge="Blocked" title={presentation.relationLabel} tone="warning">This persisted session remains visible, but its related production setup is unavailable. No session action is offered.</StatusBanner>}
    <div className="draw-session-queue__actions">{item.action === null || presentation.actionLabel === null ? null : <ButtonLink to={item.action.to}>{presentation.actionLabel}</ButtonLink>}{presentation.historical && item.action !== null ? <ButtonLink to={`/history/${item.session.id}`} variant="quiet">View session details</ButtonLink> : null}</div>
  </Card>
}
