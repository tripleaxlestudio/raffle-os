import { ButtonLink, Card } from '../../shared/ui/index.ts'
import { MetricCard } from '../../shared/components/MetricCard.tsx'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { SummaryList } from '../../shared/components/SummaryList.tsx'
import { useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'

export function ProductionDashboardPage() {
  const workspace = useProductionWorkspace()
  if (workspace.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Production workspace" headingId="dashboard-title" title="Dashboard" description="Reading authoritative local workspace data…" /></section>
  if (workspace.status === 'empty') return <section aria-labelledby="dashboard-title"><PageHeader eyebrow="Production workspace" headingId="dashboard-title" title="Dashboard" description="No active Event is selected." /><StatusBanner badge="Setup required" title="Select or create an Event before operating" tone="warning">No fictional Event or readiness values are shown.</StatusBanner><p><ButtonLink to="/events">Open Event management</ButtonLink></p></section>
  if (workspace.status === 'invalid-reference') return <section aria-labelledby="dashboard-title"><PageHeader eyebrow="Production workspace" headingId="dashboard-title" title="Dashboard" description="The saved active Event reference is invalid." /><StatusBanner badge="Recovery required" title="Select a valid persisted Event" tone="warning">Stored Event reference {workspace.eventId} does not resolve to an Event. No operational data was inferred.</StatusBanner><p><ButtonLink to="/events">Choose Event</ButtonLink></p></section>
  if (workspace.status === 'error') return <section aria-labelledby="dashboard-title"><PageHeader eyebrow="Production workspace" headingId="dashboard-title" title="Dashboard" description="Authoritative workspace data could not be read." /><StatusBanner badge="Storage error" title="Workspace unavailable" tone="warning">{workspace.message}</StatusBanner></section>

  const primary = workspace.unresolvedSession === null
    ? <ButtonLink size="lg" to="/draw/live">Open Draw Sessions</ButtonLink>
    : <ButtonLink size="lg" to="/draw/live">Resume active session</ButtonLink>
  return <section aria-labelledby="dashboard-title" className="dashboard">
    <PageHeader actions={primary} description={`Event status: ${workspace.event.status}`} eyebrow="Production workspace" headingId="dashboard-title" title={workspace.event.name} />
    <StatusBanner badge={workspace.unresolvedSession === null ? 'Ready for setup' : 'Action required'} title={workspace.unresolvedSession === null ? 'Authoritative Event loaded' : 'A Live session needs attention'} tone={workspace.unresolvedSession === null ? 'info' : 'warning'}>{workspace.unresolvedSession === null ? 'Counts below are read from local IndexedDB. Configure the next draw when ready.' : `Resume DrawSession ${workspace.unresolvedSession.id} from the authoritative pending route.`}</StatusBanner>
    <section aria-label="Event metrics" className="dashboard-metrics">
      <MetricCard label="Participants" value={String(workspace.participantCount)} detail={`${workspace.checkedInParticipantCount} checked in`} tone="info" />
      <MetricCard label="Prize categories" value={String(workspace.prizeCategoryCount)} detail="Persisted for this Event" tone="neutral" />
      <MetricCard label="Live sessions" value={String(workspace.liveSessionCount)} detail="Persisted official sessions" tone="neutral" />
      <MetricCard label="Mode" value={workspace.currentMode === null ? 'Not set' : workspace.currentMode} detail="From persisted operator preference" tone={workspace.currentMode === 'live' ? 'warning' : 'info'} />
      <MetricCard label="Ready sessions" value={String(workspace.sessionCounts.ready)} detail="Available to start" tone="info" />
      <MetricCard label="Pending decisions" value={String(workspace.sessionCounts['pending-confirmation'])} detail="Require operator review" tone="warning" />
    </section>
    <p><ButtonLink variant="secondary" to="/draw/live">Open Draw Sessions</ButtonLink> <ButtonLink variant="secondary" to="/events">Manage Events</ButtonLink> <ButtonLink variant="secondary" to="/prize-categories">Manage PrizeCategories</ButtonLink> <ButtonLink variant="secondary" to="/participants">Import Participants</ButtonLink></p>
    <Card aria-labelledby="workspace-state-title" className="dashboard-panel" padding="none"><div className="dashboard-panel__header"><div><p className="dashboard-panel__eyebrow">Authoritative context</p><h2 id="workspace-state-title">Current workspace</h2></div></div><div className="dashboard-panel__body"><SummaryList items={[{ label: 'Event', value: workspace.event.name }, { label: 'Status', value: workspace.event.status }, { label: 'Active sessions', value: String(workspace.sessionCounts.drawing) }, { label: 'Completed / cancelled', value: `${workspace.sessionCounts.completed} / ${workspace.sessionCounts.cancelled}` }]} /></div></Card>
  </section>
}
