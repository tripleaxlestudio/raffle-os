import { useCallback, useEffect, useMemo, useState } from 'react'
import { ButtonLink, Card } from '../../shared/ui/index.ts'
import { MetricCard } from '../../shared/components/MetricCard.tsx'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { queryDrawSessionQueue, type DrawSessionQueueItem } from '../../application/draw/draw-session-queue.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { useProductionAudiencePublisher, useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { presentAudienceConnection } from '../../ui/operator/draw/audience-connection-view-model.ts'
import { ProductionLoadingState, ProductionSetupRequired } from '../../shared/components/ProductionWorkspaceState.tsx'

export function ProductionDashboardPage() {
  const workspace = useProductionWorkspace()
  const audience = useProductionAudiencePublisher()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const [audienceStatus, setAudienceStatus] = useState(audience.status)
  const [drawState, setDrawState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ready'; item: DrawSessionQueueItem | null }>({ status: 'loading' })
  const loadNextDraw = useCallback(async () => {
    if (workspace.status !== 'ready') return
    setDrawState({ status: 'loading' })
    try {
      await services.open()
      const queue = await queryDrawSessionQueue(workspace.event.id, services)
      const item = queue?.items.find((candidate) => candidate.session.status === 'ready' && candidate.relation === 'valid') ?? null
      setDrawState({ status: 'ready', item })
    } catch {
      setDrawState({ status: 'error' })
    }
  }, [services, workspace])
  useEffect(() => { void Promise.resolve().then(loadNextDraw) }, [loadNextDraw])
  useEffect(() => audience.subscribe(setAudienceStatus), [audience])
  if (workspace.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Production workspace" headingId="dashboard-title" title="Dashboard" description="Reading authoritative local workspace data…" /><ProductionLoadingState description="Reading authoritative local workspace data…" /></section>
  if (workspace.status === 'empty') return <section aria-labelledby="dashboard-title"><PageHeader eyebrow="Production workspace" headingId="dashboard-title" title="Dashboard" description="No active Event is selected." /><ProductionSetupRequired /></section>
  if (workspace.status === 'invalid-reference') return <section aria-labelledby="dashboard-title"><PageHeader eyebrow="Production workspace" headingId="dashboard-title" title="Dashboard" description="The saved active Event reference is invalid." /><StatusBanner badge="Recovery required" title="Select a valid persisted Event" tone="warning">Stored Event reference {workspace.eventId} does not resolve to an Event. No operational data was inferred.</StatusBanner><p><ButtonLink to="/events">Choose Event</ButtonLink></p></section>
  if (workspace.status === 'error') return <section aria-labelledby="dashboard-title"><PageHeader eyebrow="Production workspace" headingId="dashboard-title" title="Dashboard" description="Authoritative workspace data could not be read." /><StatusBanner badge="Storage error" title="Workspace unavailable" tone="warning">{workspace.message}</StatusBanner></section>

  const actions = <div className="production-dashboard__secondary-actions"><ButtonLink variant="secondary" to="/participants">Import Participants</ButtonLink><ButtonLink variant="secondary" to="/draw/setup">Draw Setup</ButtonLink></div>
  return <section aria-labelledby="dashboard-title" className="dashboard">
    <PageHeader actions={actions} description={`Event status: ${workspace.event.status}${workspace.unresolvedSession === null ? ' · Ready for the next draw' : ' · Live session needs attention'}`} eyebrow="Production workspace" headingId="dashboard-title" title={workspace.event.name} />
    <section aria-label="Event metrics" className="dashboard-metrics dashboard-metrics--production">
      <MetricCard to="/participants" label="Participants" value={String(workspace.participantCount)} detail={`${workspace.checkedInParticipantCount} checked in`} tone="info" />
      <MetricCard to="/prize-categories" label="Prizes" value={String(workspace.prizeCategoryCount)} detail={`${workspace.prizeCategoryCount} configured`} tone="neutral" />
      <MetricCard to="/draw/live" label="Ready Draws" value={String(workspace.sessionCounts.ready)} detail={`${workspace.sessionCounts.ready} ready to run`} tone="info" />
      <MetricCard to="/draw/pending" label="Pending Results" value={String(workspace.sessionCounts['pending-confirmation'])} detail={workspace.sessionCounts['pending-confirmation'] === 0 ? 'No review required' : `${workspace.sessionCounts['pending-confirmation']} require review`} tone="warning" />
      <MetricCard to="/history" label="Official Draws" value={String(workspace.liveSessionCount)} detail={workspace.liveSessionCount === 0 ? 'No official draws yet' : `${workspace.liveSessionCount} official draws`} tone="neutral" />
    </section>
    <DashboardOperations drawState={drawState} audienceStatus={presentAudienceConnection(audienceStatus, audience.getDiagnostics())} displayUrl={workspace.displayConfiguration === null ? null : `/display?eventId=${encodeURIComponent(workspace.event.id)}&displayConfigurationId=${encodeURIComponent(workspace.displayConfiguration.id)}`} pendingCount={workspace.sessionCounts['pending-confirmation']} />
  </section>
}

function DashboardOperations({ audienceStatus, displayUrl, drawState, pendingCount }: { readonly audienceStatus: ReturnType<typeof presentAudienceConnection>; readonly displayUrl: string | null; readonly drawState: { status: 'loading' } | { status: 'error' } | { status: 'ready'; item: DrawSessionQueueItem | null }; readonly pendingCount: number }) {
  const item = drawState.status === 'ready' ? drawState.item : null
  return <section aria-label="Dashboard operations" className="production-dashboard__operations">
    <Card className="production-dashboard__next-draw" padding="md"><div className="production-dashboard__panel-heading"><div><p className="operator-eyebrow">NEXT DRAW</p></div><span className="production-dashboard__panel-state">{drawState.status === 'loading' ? 'READING' : item === null ? 'NO READY DRAW' : 'READY'}</span></div>{item === null ? <p className="production-dashboard__empty-copy">{drawState.status === 'loading' ? 'Reading the next ready DrawSession…' : drawState.status === 'error' ? 'The next ready DrawSession could not be read.' : 'Create or finish a draw in Draw Setup to prepare the next presentation.'}</p> : <><div className="production-dashboard__next-draw-identity"><h3>{item.category?.prizeName ?? 'Prize unavailable'}</h3><p>{item.category?.name ?? 'Prize category unavailable'} · {item.winnerCount} {item.winnerCount === 1 ? 'winner' : 'winners'}</p></div><p className="production-dashboard__next-draw-state">{item.session.mode === 'live' ? 'Live' : 'Practice'} · Ready to start</p></>}<ButtonLink size="lg" to="/draw/live">{item === null ? 'Open Live Draw' : item.session.mode === 'live' ? 'Start Live Draw' : 'Start Practice'}</ButtonLink></Card>
    <Card className="production-dashboard__operations-panel" padding="md"><div className="production-dashboard__panel-heading"><div><p className="operator-eyebrow">OPERATIONS</p></div></div><dl className="production-dashboard__operation-list"><div><dt>Audience Display</dt><dd><span className={`production-dashboard__status-dot production-dashboard__status-dot--${audienceStatus.tone}`} />{audienceStatus.label}</dd></div><div><dt>Pending Results</dt><dd>{pendingCount}</dd></div></dl><div className="production-dashboard__operation-actions">{displayUrl === null ? <ButtonLink variant="secondary" to="/settings">Open Display Settings</ButtonLink> : <ButtonLink variant="secondary" to={displayUrl} target="_blank" rel="noreferrer">Open Audience Display</ButtonLink>}{pendingCount > 0 ? <ButtonLink variant="secondary" to="/draw/pending">Open Pending Results</ButtonLink> : null}</div></Card>
  </section>
}
