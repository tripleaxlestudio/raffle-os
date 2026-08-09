import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, ButtonLink, Card, Icon } from '../../shared/ui/index.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { queryDrawSessionQueue, type DrawSessionQueueResult } from '../../application/draw/draw-session-queue.ts'
import { useProductionAudiencePublisher, useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { groupDrawSessionQueueDecks, presentDrawSessionQueueItem, selectCurrentOperationalQueueItems, type DrawSessionQueueDeck } from '../../ui/operator/draw/draw-session-queue-view-model.ts'
import { presentAudienceConnection } from '../../ui/operator/draw/audience-connection-view-model.ts'
import { ProductionLoadingState, ProductionSetupRequired } from '../../shared/components/ProductionWorkspaceState.tsx'

function audienceUrl(eventId: string, displayConfigurationId: string): string {
  return `/display?eventId=${encodeURIComponent(eventId)}&displayConfigurationId=${encodeURIComponent(displayConfigurationId)}`
}

function formatAcknowledgedAt(value: string | undefined): string {
  if (value === undefined) return 'Last public snapshot acknowledged.'
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return 'Last public snapshot acknowledged.'
  return `Last snapshot acknowledged: ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp)}`
}

export function DrawSessionQueuePage() {
  const workspace = useProductionWorkspace()
  const audience = useProductionAudiencePublisher()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; queue: DrawSessionQueueResult }>({ status: 'loading' })
  const [audienceStatus, setAudienceStatus] = useState(audience.status)
  const [selectedModes, setSelectedModes] = useState<Readonly<Record<string, 'practice' | 'live'>>>({})
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
  useEffect(() => audience.subscribe(setAudienceStatus), [audience])

  if (workspace.status === 'loading' || state.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="LIVE OPERATIONS" headingId="draw-queue-title" title="Live Draw" description="Reading authoritative local sessions…" /><ProductionLoadingState description="Reading authoritative local sessions…" /></section>
  if (workspace.status === 'empty' || workspace.status === 'invalid-reference') return <section aria-labelledby="draw-queue-title"><PageHeader eyebrow="LIVE OPERATIONS" headingId="draw-queue-title" title="Live Draw" description="An active Event is required." /><ProductionSetupRequired title="Event required for Live Draw" description="Select or create an Event before operating Live Draw." /></section>
  if (workspace.status === 'error') return <section aria-labelledby="draw-queue-title"><PageHeader eyebrow="LIVE OPERATIONS" headingId="draw-queue-title" title="Live Draw" description="The production queue is unavailable." /><StatusBanner badge="Storage error" title="Could not read DrawSessions" tone="warning">{workspace.message}</StatusBanner></section>
  if (state.status === 'error') return <section aria-labelledby="draw-queue-title"><PageHeader eyebrow="LIVE OPERATIONS" headingId="draw-queue-title" title="Live Draw" description="The production queue is unavailable." /><StatusBanner badge="Read failure" title="Could not read DrawSessions" tone="warning">{state.message}</StatusBanner><Button icon={<Icon name="RefreshCw" />} onClick={() => void load()}>Retry read</Button></section>

  const decks = groupDrawSessionQueueDecks(selectCurrentOperationalQueueItems(state.queue.items))
  const displayUrl = workspace.displayConfiguration === null ? null : audienceUrl(workspace.event.id, workspace.displayConfiguration.id)
  const connection = presentAudienceConnection(audienceStatus, audience.getDiagnostics())
  const hasPersistedSessions = state.queue.items.length > 0
  return <section aria-labelledby="draw-queue-title" className="draw-live-queue">
    <PageHeader eyebrow="LIVE OPERATIONS" headingId="draw-queue-title" title="Live Draw" description="Operate the ready DrawSession for the selected Event." />
    {decks.length === 0 ? <Card padding="md"><h2>{hasPersistedSessions ? 'No current Live Draw' : 'No DrawSessions yet'}</h2><p>{hasPersistedSessions ? 'Previous completed or cancelled draws remain available in History. Create the next draw from Draw Setup when you are ready.' : 'Create a configuration in Draw Setup; the saved session will appear here immediately.'}</p><div className="draw-action-bar__actions"><ButtonLink to="/draw/setup">{hasPersistedSessions ? 'Start Next Draw' : 'Create DrawSession'}</ButtonLink>{hasPersistedSessions ? <ButtonLink icon={<Icon name="History" />} to="/history" variant="secondary">View History</ButtonLink> : null}</div></Card> : <div className="draw-control-decks" aria-label="Draw control decks">{decks.map((deck) => <DrawControlDeck connection={connection} deck={deck} displayUrl={displayUrl} key={deck.key} selectedMode={selectedModes[deck.key] ?? deck.defaultMode} setSelectedMode={(mode) => setSelectedModes((current) => ({ ...current, [deck.key]: mode }))} />)}</div>}
  </section>
}

export function DrawControlDeck({ connection, deck, displayUrl, selectedMode, setSelectedMode }: { readonly connection: ReturnType<typeof presentAudienceConnection>; readonly deck: DrawSessionQueueDeck; readonly displayUrl: string | null; readonly selectedMode: 'practice' | 'live'; readonly setSelectedMode: (mode: 'practice' | 'live') => void }) {
  const selected = deck.sessions[selectedMode]
  const selectedPresentation = selected === undefined ? null : presentDrawSessionQueueItem(selected)
  const selectedAction = selected?.action ?? null
  const canAct = selectedAction !== null && selectedPresentation?.actionLabel !== null
  const selectedActionIcon = selectedAction?.kind === 'run'
    ? <Icon name="Play" />
    : selectedAction?.kind === 'pending'
      ? <Icon name="ClipboardCheck" />
      : undefined
  const liveSelected = selectedMode === 'live'
  const unavailableReason = selectedMode === 'live' ? 'No persisted Live session exists for this draw.' : 'No persisted Practice session exists for this draw.'
  const audienceWarning = liveSelected && connection.label !== 'Connected' ? <StatusBanner badge="Audience attention" title="Audience acknowledgement is not confirmed" tone="warning">{connection.detail} Confirm the public display before starting the official Live draw.</StatusBanner> : null
  return <Card className={`draw-control-deck draw-control-deck--${liveSelected ? 'live' : 'practice'}`} padding="none">
    <div className="draw-control-deck__header">
      <div className="draw-control-deck__mode">
        <div className="draw-control-deck__mode-heading"><span>Operating mode</span></div>
        <p className="draw-control-deck__mode-description">{selected === undefined ? unavailableReason : liveSelected ? 'Official run — eligible to create an official result after confirmation.' : 'Rehearsal run — results will not be saved as official.'}</p>
      </div>
      <div className="draw-mode-selector" role="group" aria-label={`${deck.categoryName} mode`}><button type="button" aria-pressed={!liveSelected} className={!liveSelected ? 'is-selected' : undefined} disabled={deck.sessions.practice === undefined} onClick={() => setSelectedMode('practice')}>Practice</button><button type="button" aria-pressed={liveSelected} className={liveSelected ? 'is-selected' : undefined} disabled={deck.sessions.live === undefined} onClick={() => setSelectedMode('live')}>Live</button></div>
    </div>
    <div className="draw-control-deck__body">
      <div className="draw-control-deck__summary"><div><span>Event</span><strong>{deck.eventName}</strong></div><div><span>Draw / prize</span><strong>{deck.categoryName}<small>{deck.prizeName}</small></strong></div><div><span>Winners</span><strong>{deck.winnerCount}</strong></div><div><span>Readiness</span><strong>{selectedPresentation?.checkpointLabel ?? unavailableReason}</strong></div></div>
      {selectedPresentation?.relationLabel === null || selectedPresentation === null ? null : <StatusBanner badge="Blocked" title={selectedPresentation.relationLabel} tone="warning">This persisted session remains visible, but no action is offered until its production relationship is available.</StatusBanner>}
      {selected === undefined ? <StatusBanner badge="Unavailable" title={`${selectedMode === 'live' ? 'Live' : 'Practice'} mode is unavailable`} tone="info">{unavailableReason}</StatusBanner> : null}
      <div className="draw-control-deck__audience"><div className="draw-control-deck__audience-heading"><div><span>Audience Display</span><strong><span aria-hidden="true" className={`draw-control-deck__connection-dot draw-control-deck__connection-dot--${connection.tone}`} />{connection.label}</strong><p>{connection.acknowledged ? formatAcknowledgedAt(connection.acknowledgedAt) : connection.detail}</p></div></div><div className="draw-control-deck__audience-actions">{displayUrl === null ? <Button disabled icon={<Icon name="ExternalLink" />} iconAfter variant="secondary">Open Audience Display</Button> : <ButtonLink icon={<Icon name="ExternalLink" />} iconAfter to={displayUrl} target="_blank" rel="noreferrer" variant="secondary">Open Audience Display</ButtonLink>}</div></div>
      {audienceWarning}
      <div className="draw-control-deck__actions">
        <section className="draw-control-deck__action-panel draw-control-deck__action-panel--practice" aria-labelledby={`practice-action-${deck.key}`}>
          <div><span className="operator-eyebrow">{liveSelected ? 'LIVE DRAW' : 'PRACTICE'}</span><h3 id={`practice-action-${deck.key}`}>{liveSelected ? 'Ready to start' : 'Ready for rehearsal'}</h3></div>
          <div className="draw-control-deck__action-panel-button">{canAct ? <ButtonLink icon={selectedActionIcon} size="lg" variant={liveSelected ? 'danger' : 'primary'} to={selectedAction.to}>{liveSelected && selectedAction.kind === 'run' ? 'Start Live Draw' : selectedPresentation?.actionLabel}</ButtonLink> : null}{selectedAction !== null && selectedPresentation?.historical ? <ButtonLink to={`/history/${selected?.session.id}`} variant="quiet">View session details</ButtonLink> : null}</div>
        </section>
        <section className={`draw-control-deck__action-panel draw-control-deck__action-panel--official${liveSelected ? '' : ' draw-control-deck__action-panel--inactive'}`} aria-labelledby={`live-guidance-${deck.key}`}>
          <div><span className="operator-eyebrow">OFFICIAL LIVE</span><h3 id={`live-guidance-${deck.key}`}>{liveSelected ? 'Live mode is active' : 'Live mode is not active'}</h3></div>
          <div className="draw-control-deck__action-panel-button"><ButtonLink className={!liveSelected ? 'draw-control-deck__live-setup-action' : undefined} size="lg" to="/draw/setup" variant="secondary">Open Draw Setup</ButtonLink></div>
        </section>
      </div>
    </div>
  </Card>
}
