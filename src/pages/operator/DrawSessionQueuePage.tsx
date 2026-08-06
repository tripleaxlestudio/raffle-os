import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Button, ButtonLink, Card } from '../../shared/ui/index.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { queryDrawSessionQueue, type DrawSessionQueueResult } from '../../application/draw/draw-session-queue.ts'
import { useProductionAudiencePublisher, useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { groupDrawSessionQueueDecks, presentDrawSessionQueueItem, type DrawSessionQueueDeck } from '../../ui/operator/draw/draw-session-queue-view-model.ts'
import { presentAudienceConnection } from '../../ui/operator/draw/audience-connection-view-model.ts'

function audienceUrl(eventId: string, displayConfigurationId: string): string {
  return `/display?eventId=${encodeURIComponent(eventId)}&displayConfigurationId=${encodeURIComponent(displayConfigurationId)}`
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

  if (workspace.status === 'loading' || state.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="LIVE OPERATIONS" headingId="draw-queue-title" title="Live Draw" description="Reading authoritative local sessions…" /></section>
  if (workspace.status === 'empty' || workspace.status === 'invalid-reference') return <section aria-labelledby="draw-queue-title"><PageHeader eyebrow="LIVE OPERATIONS" headingId="draw-queue-title" title="Live Draw" description="An active Event is required." /><StatusBanner badge="Setup required" title="Select or create an Event first" tone="warning">Sessions are scoped to the selected Event and are never inferred.</StatusBanner><ButtonLink to="/events">Open Event management</ButtonLink></section>
  if (workspace.status === 'error') return <section aria-labelledby="draw-queue-title"><PageHeader eyebrow="LIVE OPERATIONS" headingId="draw-queue-title" title="Live Draw" description="The production queue is unavailable." /><StatusBanner badge="Storage error" title="Could not read DrawSessions" tone="warning">{workspace.message}</StatusBanner></section>
  if (state.status === 'error') return <section aria-labelledby="draw-queue-title"><PageHeader eyebrow="LIVE OPERATIONS" headingId="draw-queue-title" title="Live Draw" description="The production queue is unavailable." /><StatusBanner badge="Read failure" title="Could not read DrawSessions" tone="warning">{state.message}</StatusBanner><Button onClick={() => void load()}>Retry read</Button></section>

  const decks = groupDrawSessionQueueDecks(state.queue.items)
  const actionRequired = state.queue.items.filter((item) => item.session.status === 'drawing' || item.session.status === 'pending-confirmation').length
  const displayUrl = workspace.displayConfiguration === null ? null : audienceUrl(workspace.event.id, workspace.displayConfiguration.id)
  const connection = presentAudienceConnection(audienceStatus, audience.getDiagnostics())
  return <section aria-labelledby="draw-queue-title" className="draw-live-queue">
    <PageHeader eyebrow="LIVE OPERATIONS" headingId="draw-queue-title" title="Live Draw" description="Review the draw, connect the Audience Display, and begin presentation." actions={<ButtonLink size="lg" to="/draw/setup">Open Draw Setup</ButtonLink>} />
    <StatusBanner badge={actionRequired > 0 ? 'Action required' : 'Queue ready'} title={actionRequired > 0 ? `${actionRequired} session${actionRequired === 1 ? '' : 's'} need attention` : 'Draw control deck ready'} tone={actionRequired > 0 ? 'warning' : 'info'}>Practice is rehearsal-only. Live results remain pending until an explicit decision is recorded.</StatusBanner>
    {decks.length === 0 ? <Card padding="md"><h2>No DrawSessions yet</h2><p>Create a configuration in Draw Setup; the saved session will appear here immediately.</p><ButtonLink to="/draw/setup">Create DrawSession</ButtonLink></Card> : <div className="draw-control-decks" aria-label="Draw control decks">{decks.map((deck) => <DrawControlDeck connection={connection} deck={deck} displayUrl={displayUrl} key={deck.key} selectedMode={selectedModes[deck.key] ?? deck.defaultMode} setSelectedMode={(mode) => setSelectedModes((current) => ({ ...current, [deck.key]: mode }))} />)}</div>}
  </section>
}

function DrawControlDeck({ connection, deck, displayUrl, selectedMode, setSelectedMode }: { readonly connection: ReturnType<typeof presentAudienceConnection>; readonly deck: DrawSessionQueueDeck; readonly displayUrl: string | null; readonly selectedMode: 'practice' | 'live'; readonly setSelectedMode: (mode: 'practice' | 'live') => void }) {
  const selected = deck.sessions[selectedMode]
  const selectedPresentation = selected === undefined ? null : presentDrawSessionQueueItem(selected)
  const selectedAction = selected?.action ?? null
  const canAct = selectedAction !== null && selectedPresentation?.actionLabel !== null
  const liveSelected = selectedMode === 'live'
  const unavailableReason = selectedMode === 'live' ? 'No persisted Live session exists for this draw.' : 'No persisted Practice session exists for this draw.'
  const audienceWarning = liveSelected && connection.label !== 'Connected' ? <StatusBanner badge="Audience attention" title="Audience acknowledgement is not confirmed" tone="warning">{connection.detail} Confirm the public display before starting the official Live draw.</StatusBanner> : null
  return <Card className="draw-control-deck" padding="none"><div className="draw-control-deck__header"><div className="draw-control-deck__mode"><span>Draw mode</span><div className="draw-mode-selector" role="group" aria-label={`${deck.categoryName} mode`}><button type="button" aria-pressed={!liveSelected} className={!liveSelected ? 'is-selected' : undefined} disabled={deck.sessions.practice === undefined} onClick={() => setSelectedMode('practice')}>Practice</button><button type="button" aria-pressed={liveSelected} className={liveSelected ? 'is-selected' : undefined} disabled={deck.sessions.live === undefined} onClick={() => setSelectedMode('live')}>Live</button></div><p className="draw-control-deck__mode-help">{selected === undefined ? unavailableReason : liveSelected ? 'Official result; explicit confirmation is required.' : 'Rehearsal only; no official result is created.'}</p></div>{selectedPresentation === null ? <Badge variant="neutral">Unavailable</Badge> : <Badge variant={selectedPresentation.lifecycleTone}>{selectedPresentation.lifecycleLabel}</Badge>}</div>
    <div className="draw-control-deck__body"><p className="operator-eyebrow">{deck.eventName}</p><h2>{deck.categoryName}</h2><p className="draw-control-deck__prize">{deck.prizeName}</p><dl className="draw-control-deck__metadata"><div><dt>Winner count</dt><dd>{deck.winnerCount} {deck.winnerCount === 1 ? 'winner' : 'winners'}</dd></div><div><dt>Updated</dt><dd>{selectedPresentation?.updatedLabel ?? 'Unavailable'}</dd></div><div><dt>Presentation</dt><dd>{selectedPresentation?.checkpointLabel ?? unavailableReason}</dd></div></dl>{selectedPresentation?.relationLabel === null || selectedPresentation === null ? null : <StatusBanner badge="Blocked" title={selectedPresentation.relationLabel} tone="warning">This persisted session remains visible, but no action is offered until its production relationship is available.</StatusBanner>}{selected === undefined ? <StatusBanner badge="Unavailable" title={`${selectedMode === 'live' ? 'Live' : 'Practice'} mode is unavailable`} tone="info">{unavailableReason}</StatusBanner> : null}<div className="draw-control-deck__audience"><div><div className="draw-control-deck__audience-heading"><div><span>Audience Display</span><strong>{connection.label}</strong></div><Badge variant={connection.tone}>{connection.acknowledged ? 'Acknowledged' : 'Not acknowledged'}</Badge></div><p>{connection.detail}</p>{displayUrl === null ? <small>Audience Display configuration is unavailable.</small> : <code>{displayUrl}</code>}</div><div className="draw-control-deck__audience-actions">{displayUrl === null ? <Button disabled variant="secondary">Open Audience Display</Button> : <ButtonLink to={displayUrl} target="_blank" rel="noreferrer" variant="secondary">Open Audience Display</ButtonLink>}</div></div>{audienceWarning}<div className="draw-control-deck__actions">{canAct ? <ButtonLink to={selectedAction.to}>{liveSelected && selectedAction.kind === 'run' ? 'Start Live Draw' : selectedPresentation?.actionLabel}</ButtonLink> : null}{selectedAction !== null && selectedPresentation?.historical ? <ButtonLink to={`/history/${selected?.session.id}`} variant="quiet">View session details</ButtonLink> : null}</div></div></Card>
}
