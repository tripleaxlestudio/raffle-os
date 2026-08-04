import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { queryDrawSetup } from '../../application/draw/draw-setup-query.ts'
import type { DrawSetupProductionServices, DrawSetupReadyViewModel, DrawSetupViewModel } from '../../application/draw/draw-setup-query.types.ts'
import type { DrawCommandResult } from '../../application/draw/draw-command.types.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { mapDrawSetupError } from '../../ui/operator/draw/draw-setup-error-mapper.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Badge, Button, ButtonLink, Card, ConfirmationDialog } from '../../shared/ui/index.ts'

function modeFromQuery(value: string | null): AppMode {
  return value === 'live' ? 'live' : 'practice'
}

function formatWinningRule(rule: DrawSetupReadyViewModel['configuration']['winningRule']) {
  return rule === 'once-per-event' ? 'Once per event' : rule === 'once-per-category' ? 'Once per category' : 'Allow repeat'
}

function SetupSummary({ view }: { view: DrawSetupReadyViewModel }) {
  return <div className="draw-setup-production__summary">
    <Card padding="sm"><span>Event</span><strong>{view.event.name}</strong></Card>
    <Card padding="sm"><span>Prize category</span><strong>{view.category.name} · {view.category.prizeName}</strong></Card>
    <Card padding="sm"><span>Mode</span><strong>{view.mode === 'live' ? 'Live draw' : 'Practice rehearsal'}</strong></Card>
    <Card padding="sm"><span>Winning rule</span><strong>{formatWinningRule(view.configuration.winningRule)}</strong></Card>
    <Card padding="sm"><span>Check-in requirement</span><strong>{view.configuration.requireCheckIn ? 'Checked-in participants only' : 'All participants'}</strong></Card>
    <Card padding="sm"><span>Group filter</span><strong>{view.configuration.eligibleGroupFilter ?? 'All groups'}</strong></Card>
  </div>
}

function Capacity({ view }: { view: Pick<DrawSetupReadyViewModel, 'totalParticipantCount' | 'eligibleCandidateCount' | 'excludedCount' | 'configuration' | 'exclusionCounts'> }) {
  return <Card className="draw-panel" padding="md">
    <div className="draw-panel__heading"><p>Readiness</p><h2>Eligible pool capacity</h2></div>
    <dl aria-label="Eligible pool summary" className="eligible-pool-metrics">
      <div><dt>Total participants</dt><dd>{view.totalParticipantCount}</dd></div>
      <div><dt>Eligible candidates</dt><dd>{view.eligibleCandidateCount}</dd></div>
      <div><dt>Excluded</dt><dd>{view.excludedCount}</dd></div>
      <div className="eligible-pool-metrics__highlight"><dt>Requested winners</dt><dd>{view.configuration.requestedWinners}</dd></div>
    </dl>
    {Object.keys(view.exclusionCounts).length > 0 ? <div className="draw-setup-production__exclusions"><strong>Exclusion summary</strong>{Object.entries(view.exclusionCounts).map(([reason, count]) => <span key={reason}>{reason.replaceAll('-', ' ')}: {count}</span>)}</div> : null}
  </Card>
}

function Confirmation({ mode, view, onCancel, onConfirm, busy }: { mode: AppMode; view: DrawSetupReadyViewModel; onCancel: () => void; onConfirm: () => void; busy: boolean }) {
  return <ConfirmationDialog confirmDisabled={busy} confirmLabel={busy ? 'Starting…' : mode === 'live' ? 'Confirm live draw' : 'Run practice'} confirmLoading={busy} consequence={mode === 'live' ? <>Event <strong>{view.event.name}</strong>, category <strong>{view.category.name}</strong>, <strong>{view.configuration.requestedWinners}</strong> requested winners, and <strong>{view.eligibleCandidateCount}</strong> eligible candidates will use the frozen eligibility snapshot and record an official pending draw.</> : <>This is a rehearsal only. No official WinnerRecords, DrawSession mutation, or AuditRecord will be written.</>} onCancel={onCancel} onConfirm={onConfirm} open title={mode === 'live' ? 'Confirm live draw start' : 'Run practice rehearsal'} />
}

type DrawSetupSuccess = { readonly state: 'practice-success' | 'live-success'; readonly result: DrawCommandResult }

function PendingResult({ view, onReturn }: { view: DrawSetupSuccess; onReturn: () => void }) {
  return <Card className="draw-panel" padding="md"><div aria-live="polite" role="status"><p className="draw-setup-production__eyebrow">{view.state === 'live-success' ? 'Live draw started' : 'Practice result'}</p><h2>Pending winners</h2><p>{view.state === 'live-success' ? 'These winners are pending confirmation in the later workflow.' : 'This rehearsal result is in memory only and is not official.'}</p></div><ol className="draw-setup-production__winners">{view.result.pendingWinners.map((winner) => <li key={winner.id}><span>Sequence {winner.sequenceNumber}</span><strong>{winner.ticketNumber}</strong><Badge variant="pending">pending</Badge></li>)}</ol><Button onClick={onReturn} variant="secondary">Return to ready</Button></Card>
}

type PageState = DrawSetupViewModel | DrawSetupSuccess

export function DrawSetupPage({ services: suppliedServices }: { services?: DrawSetupProductionServices } = {}) {
  const [searchParams] = useSearchParams()
  const mode = modeFromQuery(searchParams.get('mode'))
  const services = useMemo(() => suppliedServices ?? createDrawSetupProductionServices(), [suppliedServices])
  const [view, setView] = useState<PageState>({ state: 'loading' })
  const [confirmation, setConfirmation] = useState(false)
  const [executing, setExecuting] = useState(false)

  async function load() {
    setView({ state: 'loading' })
    try { await services.open(); setView(await queryDrawSetup(mode, services)) } catch (cause: unknown) { setView({ state: 'query-failure', mode, error: { code: 'persistence-failed', message: 'Authoritative draw setup data could not be loaded.', cause } }) }
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await services.open()
        const next = await queryDrawSetup(mode, services)
        if (!cancelled) setView(next)
      } catch (cause: unknown) {
        if (!cancelled) setView({ state: 'query-failure', mode, error: { code: 'persistence-failed', message: 'Authoritative draw setup data could not be loaded.', cause } })
      }
    })()
    return () => { cancelled = true }
  }, [mode, services])

  async function start() {
    if (executing || view.state !== 'ready') return
    setExecuting(true)
    const result = await services.command.execute({ eventId: view.event.id, drawSessionId: view.session.id, configurationId: view.configuration.id, prizeCategoryId: view.category.id, mode, expectedStatus: 'ready' })
    setExecuting(false)
    setConfirmation(false)
    if (result.ok) setView({ state: mode === 'live' ? 'live-success' : 'practice-success', result: result.value })
    else setView({ state: 'query-failure', mode, error: { code: 'persistence-failed', message: result.error.message, cause: result.error } })
  }

  if (view.state === 'loading') return <section className="draw-setup" aria-busy="true"><PageHeader eyebrow="Draw configuration" headingId="draw-setup-title" title="Draw Setup" description="Loading authoritative Event, configuration, category, session, and Participant readiness…" /><StatusBanner badge="Loading" title="Preparing draw readiness" tone="info">Practice and Live execution are disabled until persisted data is ready.</StatusBanner></section>
  if (view.state === 'practice-success' || view.state === 'live-success') return <section className="draw-setup"><PageHeader eyebrow="Draw configuration" headingId="draw-setup-title" title="Draw Setup" description={view.result.event.name} /><PendingResult view={view} onReturn={() => void load()} /></section>
  if (view.state === 'no-active-event') return <section className="draw-setup"><PageHeader eyebrow="Draw configuration" headingId="draw-setup-title" title="Draw Setup" description="No active Event selected" /><StatusBanner badge="Blocked" title="Select or create an Event first" tone="warning">Draw Setup uses only the active persisted Event. Go to the Dashboard or Event setup to select one.</StatusBanner><ButtonLink to="/dashboard" variant="secondary">Return to Dashboard</ButtonLink></section>
  if (view.state === 'no-configuration') return <section className="draw-setup"><PageHeader eyebrow="Draw configuration" headingId="draw-setup-title" title="Draw Setup" description={view.event.name} /><StatusBanner badge="Configuration required" title="Complete Draw Setup configuration" tone="warning">No valid DrawConfiguration exists for this Event. Create the configuration before starting a draw.</StatusBanner><ButtonLink to="/settings" variant="secondary">Open Settings</ButtonLink></section>
  if (view.state === 'invalid-category') return <section className="draw-setup"><PageHeader eyebrow="Draw configuration" headingId="draw-setup-title" title="Draw Setup" description={view.event.name} /><StatusBanner badge="Blocked" title="The selected prize category is unavailable" tone="warning">The DrawConfiguration does not reference a valid category owned by this Event. No category was selected automatically.</StatusBanner></section>
  if (view.state === 'no-participants') return <section className="draw-setup"><PageHeader eyebrow="Draw configuration" headingId="draw-setup-title" title="Draw Setup" description={view.event.name} /><StatusBanner badge="Participants required" title="Import valid Participants for this Event" tone="warning">There are no persisted Participants for the active Event, so neither Practice nor Live can start.</StatusBanner><ButtonLink to="/participants" variant="secondary">Import Participants</ButtonLink></section>
  if (view.state === 'query-failure') { const error = mapDrawSetupError(view.error); return <section className="draw-setup"><PageHeader eyebrow="Draw configuration" headingId="draw-setup-title" title="Draw Setup" description="Readiness unavailable" /><StatusBanner badge={error.retryable ? 'Recoverable error' : 'Blocked'} title={error.title} tone="warning">{error.explanation} {error.suggestedAction ?? ''}</StatusBanner>{error.retryable ? <Button onClick={() => void load()}>Retry</Button> : null}</section> }
  if (view.state === 'no-session') return <section className="draw-setup"><PageHeader eyebrow="Draw configuration" headingId="draw-setup-title" title="Draw Setup" description={view.event.name} /><StatusBanner badge="DrawSession required" title="No startable DrawSession exists" tone="warning">A valid ready DrawSession must exist for this Event, category, and configuration. No draw has occurred. Refresh after a ready session is created.</StatusBanner><Capacity view={view} /><Button onClick={() => void load()} variant="secondary">Refresh readiness</Button></section>
  if (view.state === 'blocked') return <section className="draw-setup"><PageHeader eyebrow="Draw configuration" headingId="draw-setup-title" title="Draw Setup" description={view.event.name} /><StatusBanner badge="Proceeding blocked" title="Draw cannot start from the current persisted state" tone="warning">{view.reason}</StatusBanner><Capacity view={view} /><Button onClick={() => void load()} variant="secondary">Refresh readiness</Button></section>
  if (view.state !== 'ready') return null

  return <section aria-labelledby="draw-setup-title" className="draw-setup" data-draw-mode={mode}>
    <PageHeader actions={<div className="draw-mode-context"><Badge variant={mode}>{mode === 'live' ? 'LIVE FLOW' : 'PRACTICE'}</Badge><span>{mode === 'live' ? 'Official draw' : 'Rehearsal only'}</span></div>} description={`${view.event.name} · ${view.category.name}`} eyebrow="Draw configuration" headingId="draw-setup-title" title="Draw Setup" />
    <StatusBanner badge="Ready" title="Eligibility and capacity are ready" tone="success">The final command will rebuild and validate the authoritative candidate snapshot at execution time.</StatusBanner>
    <SetupSummary view={view} />
    <Capacity view={view} />
    <div className="draw-action-bar"><div><strong>{mode === 'live' ? 'Start official Live draw' : 'Run Practice rehearsal'}</strong><span>{view.eligibleCandidateCount} eligible candidates · {view.configuration.requestedWinners} requested winners</span></div><div className="draw-action-bar__actions"><ButtonLink to="/dashboard" variant="secondary">Return to Dashboard</ButtonLink><Button disabled={executing} isLoading={executing} onClick={() => setConfirmation(true)} size="lg">{mode === 'live' ? 'Start Live draw' : 'Run Practice'}</Button></div></div>
    {confirmation ? <Confirmation busy={executing} mode={mode} onCancel={() => { if (!executing) setConfirmation(false) }} onConfirm={() => void start()} view={view} /> : null}
  </section>
}
