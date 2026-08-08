import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useProductionAudiencePublisher } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { RedrawReason, RedrawRecord } from '../../domain/winners/redraw.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { CommandId } from '../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import { calculateReplacementCapacity, LOCAL_OPERATOR, type PendingDecisionCommand } from '../../application/pending-decisions/index.ts'
import { projectCommittedAudienceState } from '../../application/display-transport/authoritative-projection.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Badge, Button, Card, ConfirmationDialog, Select } from '../../shared/ui/index.ts'

type Decision = 'confirm' | 'cancel' | 'redraw-pending' | 'redraw-confirmed'
type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly title: string; readonly message: string }
  | { readonly status: 'ready'; readonly session: DrawSession; readonly event: Event; readonly category: PrizeCategory; readonly displayConfiguration: import('../../domain/display/display-configuration.types.ts').DisplayConfiguration; readonly winners: readonly WinnerRecord[]; readonly redraws: readonly RedrawRecord[]; readonly blackoutRequested: boolean }

const reasons: readonly { value: RedrawReason; label: string }[] = [
  { value: 'absent', label: 'Absent' },
  { value: 'invalid-ticket', label: 'Invalid ticket' },
  { value: 'ineligible', label: 'Ineligible' },
  { value: 'previous-winner', label: 'Previous winner' },
  { value: 'operator-error', label: 'Operator error' },
  { value: 'other', label: 'Other' },
]

function commandId(): CommandId {
  return crypto.randomUUID() as CommandId
}

function statusLabel(status: WinnerRecord['status']): string {
  return status === 'pending' ? 'Pending' : status === 'confirmed' ? 'Confirmed' : 'Cancelled'
}

function formatOperatorDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

export function ProductionPendingResultsPage() {
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const audience = useProductionAudiencePublisher()
  const { drawSessionId } = useParams<{ drawSessionId: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [decision, setDecision] = useState<Decision | null>(null)
  const [reason, setReason] = useState<RedrawReason>('absent')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const commandRef = useRef<{ id: CommandId; command: PendingDecisionCommand } | null>(null)

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    setSelected(new Set())
    if (drawSessionId === undefined || drawSessionId.trim() === '') {
      setState({ status: 'error', title: 'Invalid DrawSession', message: 'The requested DrawSession identifier is missing or invalid.' })
      return
    }
    try {
      await services.open()
      const session = await services.sessions.findById(drawSessionId as never)
      if (session === null) { setState({ status: 'error', title: 'DrawSession not found', message: 'The requested local result does not exist.' }); return }
      if (session.mode !== 'live') { setState({ status: 'error', title: 'Live result required', message: 'Production decisions are available only for Live DrawSessions.' }); return }
      if (!['pending-confirmation', 'completed', 'cancelled'].includes(session.status)) { setState({ status: 'error', title: 'Unsupported result state', message: `This result is ${session.status} and cannot be decided here.` }); return }
      if (session.configurationSnapshot === null) { setState({ status: 'error', title: 'Incomplete result', message: 'The authoritative configuration snapshot is missing.' }); return }
      const [event, category, winners, redraws] = await Promise.all([
        services.events.findById(session.eventId),
        services.categories.findById(session.configurationSnapshot.prizeCategoryId),
        services.winners.findByDrawSessionId(session.id),
        services.redraws?.findByDrawSessionId(session.id) ?? Promise.resolve([] as RedrawRecord[]),
      ])
      if (event === null) { setState({ status: 'error', title: 'Event unavailable', message: 'The related Event could not be loaded safely.' }); return }
      if (category === null) { setState({ status: 'error', title: 'Prize category unavailable', message: 'The related PrizeCategory could not be loaded safely.' }); return }
      const snapshotCategory: PrizeCategory = { ...category, name: session.configurationSnapshot.categoryName, prizeName: session.configurationSnapshot.prizeName }
      const displayConfiguration = services.displayConfigurations === undefined ? null : await services.displayConfigurations.findByEventId(event.id)
      if (displayConfiguration === null || displayConfiguration === undefined) { setState({ status: 'error', title: 'Display configuration unavailable', message: 'Save the active Event display configuration before presenting official results.' }); return }
      const checkpoint = services.presentationCheckpoints === undefined ? null : await services.presentationCheckpoints.findByDrawSessionId(session.id)
      setState({ status: 'ready', session, event, category: snapshotCategory, displayConfiguration, winners: winners.sort((a, b) => a.sequenceNumber - b.sequenceNumber), redraws, blackoutRequested: checkpoint?.blackoutRequested ?? false })
    } catch (error: unknown) {
      const text = error instanceof Error && /version/i.test(error.message) ? 'This local database is newer than the supported application version.' : 'Authoritative production results could not be read safely. Retry the local read.'
      setState({ status: 'error', title: 'Production result unavailable', message: text })
    }
  }, [drawSessionId, services])

  useEffect(() => { void Promise.resolve().then(load) }, [load])
  useEffect(() => audience.subscribe((status) => {
    if (status.kind === 'transport-error') setMessage(status.error.kind === 'transport-unavailable' || status.error.kind === 'transport-closed' ? 'Official result is saved, but the Audience display is disconnected. Retry publication when it is available.' : 'Official result is saved, but the Audience projection could not be published.')
  }), [audience])
  useEffect(() => {
    if (state.status !== 'ready') return
    const result = projectCommittedAudienceState({
      session: state.session,
      winners: state.winners,
      stageStartedAt: (state.session.updatedAt ?? new Date().toISOString()) as IsoTimestamp,
      blackoutRequested: state.blackoutRequested,
    })
    if (audience.publisher === null) return
    audience.publish(result)
  }, [audience, state])

  if (state.status === 'loading') return <section aria-busy="true" aria-live="polite"><PageHeader eyebrow="Live production" headingId="pending-title" title="Pending Results" description="Reading the authoritative local result…" /></section>
  if (state.status === 'error') return <section aria-live="polite"><PageHeader eyebrow="Live production" headingId="pending-title" title={state.title} description={state.message} /><StatusBanner badge="Read-only recovery" title={state.title} tone="warning">No decision or random selection was run. Retry the local read or return to Draw Setup.</StatusBanner><Button onClick={() => void load()}>Retry read</Button></section>

  const { session, event, category, winners, redraws } = state
  const pending = winners.filter((winner) => winner.status === 'pending')
  const confirmed = winners.filter((winner) => winner.status === 'confirmed')
  const cancelled = winners.filter((winner) => winner.status === 'cancelled')
  const selectedWinners = winners.filter((winner) => selected.has(winner.id))
  const allPendingSelected = pending.length > 0 && pending.every((winner) => selected.has(winner.id))
  const bulkSelectionLabel = allPendingSelected ? 'Deselect All' : 'Select All Pending'
  const canDecide = selectedWinners.length > 0 && !busy
  const replacementCapacity = calculateReplacementCapacity({ candidatePoolSnapshot: session.candidatePoolSnapshot, requestedReplacementCount: selectedWinners.length || 1, targetWinnerIds: selectedWinners.map((winner) => winner.id), winners }).eligibleCandidateCount
  const capacityEnough = replacementCapacity >= selectedWinners.length
  const displayedReplacementCapacity = calculateReplacementCapacity({ candidatePoolSnapshot: session.candidatePoolSnapshot, requestedReplacementCount: pending.length || 1, targetWinnerIds: pending.map((winner) => winner.id), winners }).eligibleCandidateCount

  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  function toggleAllPending() {
    setSelected((current) => {
      const next = new Set(current)
      if (allPendingSelected) pending.forEach((winner) => next.delete(winner.id))
      else pending.forEach((winner) => next.add(winner.id))
      return next
    })
  }
  function openDecision(next: Decision) { setMessage(null); setReason('absent'); setNote(''); setDecision(next) }

  async function submit() {
    if (decision === null || selectedWinners.length === 0 || services.pendingDecisions === undefined) return
    if (decision !== 'confirm' && note.trim().length === 0 && reason === 'other') { setMessage('A trimmed note is required for the Other reason.'); return }
    const id = commandRef.current?.id ?? commandId()
    const base = { actor: LOCAL_OPERATOR, commandId: id, drawSessionId: session.id, mode: 'live' as const }
    setBusy(true)
    try {
      if (decision === 'confirm') {
        const command = { ...base, operation: 'confirm-pending-winners' as const, targets: selectedWinners.map((winner) => ({ winnerId: winner.id, expectedStatus: 'pending' as const })) }
        commandRef.current = { id, command }
        const result = await services.pendingDecisions.confirmation.confirm(command)
        if (result.status === 'unknown') { setMessage('The command outcome is unknown. Reload authoritative records before retrying with the same command ID.'); return }
        if ('error' in result) { setMessage(result.error.message); return }
        setDecision(null); commandRef.current = null; setMessage(result.status === 'idempotent-replay' ? 'The committed receipt was replayed safely.' : 'Official result updated.'); await load(); return
      }
      if (decision === 'cancel') {
        const command = { ...base, operation: 'cancel-pending-winners' as const, reason, ...(note.trim() ? { note: note.trim() } : {}), targets: selectedWinners.map((winner) => ({ winnerId: winner.id, expectedStatus: 'pending' as const })) }
        commandRef.current = { id, command }
        const result = await services.pendingDecisions.cancellation.cancel(command)
        if (result.status === 'unknown') { setMessage('The command outcome is unknown. Reload authoritative records before retrying with the same command ID.'); return }
        if ('error' in result) { setMessage(result.error.message); return }
        setDecision(null); commandRef.current = null; setMessage(result.status === 'idempotent-replay' ? 'The committed receipt was replayed safely.' : 'Official result updated.'); await load(); return
      }
      const command = decision === 'redraw-confirmed'
        ? { ...base, operation: 'redraw-confirmed-winners' as const, reason, ...(note.trim() ? { note: note.trim() } : {}), targets: selectedWinners.map((winner) => ({ winnerId: winner.id, expectedStatus: 'confirmed' as const })) }
        : { ...base, operation: 'redraw-pending-winners' as const, reason, ...(note.trim() ? { note: note.trim() } : {}), targets: selectedWinners.map((winner) => ({ winnerId: winner.id, expectedStatus: 'pending' as const })) }
      commandRef.current = { id, command }
      const result = await services.pendingDecisions.redraw.redraw(command)
      if (result.status === 'unknown') { setMessage('The command outcome is unknown. Reload authoritative records before retrying with the same command ID.'); return }
      if ('error' in result) { setMessage(result.error.message); return }
      setDecision(null); commandRef.current = null; setMessage(result.status === 'idempotent-replay' ? 'The committed receipt was replayed safely.' : 'Official result updated.'); await load()
    } catch { setMessage('The command could not be persisted safely. Reload authoritative records before retrying.') }
    finally { setBusy(false) }
  }

  const isReadOnly = session.status === 'cancelled'
  const dialogTitle = decision === 'confirm' ? `Confirm ${selectedWinners.length} winner${selectedWinners.length === 1 ? '' : 's'}` : decision === 'cancel' ? `Cancel ${selectedWinners.length} pending winner${selectedWinners.length === 1 ? '' : 's'}` : decision === 'redraw-confirmed' ? 'Redraw confirmed winners' : 'Redraw pending winners'
  const replacements = winners.filter((winner) => winner.sequenceNumber > (session.configurationSnapshot?.requestedWinners ?? Number.MAX_SAFE_INTEGER))
  return <section aria-labelledby="pending-title" className="pending-results pending-results--production">
    <PageHeader eyebrow="Live · official production" headingId="pending-title" title="Pending Results" description={`${category.name} · ${category.prizeName}`} />
    <Card padding="md" className="pending-results__identity">
      <div>
        <p className="operator-eyebrow">Result under review</p>
        <h2>{category.name} <span aria-hidden="true">—</span> {category.prizeName}</h2>
        <p>{event.name} <span aria-hidden="true">·</span> Live draw</p>
      </div>
      <Badge variant="live">Live</Badge>
    </Card>
    {message === null ? null : <StatusBanner badge="Operator action" title="Reconciliation required" tone="warning">{message}</StatusBanner>}
    <StatusBanner badge={isReadOnly ? 'Cancelled' : session.status === 'completed' ? 'Completed' : 'Pending confirmation'} title={isReadOnly ? 'Resolved result · read only' : session.status === 'completed' ? 'All current winners are confirmed' : 'Official result is awaiting a decision'} tone={isReadOnly ? 'warning' : 'info'}>{isReadOnly ? 'This session remains in official history and cannot be changed here.' : 'Changes are persisted locally with an audit receipt.'}</StatusBanner>
    <div className="pending-results__summary" aria-label="Result summary">
      {([['Total winners', winners.length, ''], ['Pending', pending.length, 'pending'], ['Confirmed', confirmed.length, 'confirmed'], ['Cancelled', cancelled.length, 'cancelled'], ['Replacements', replacements.length, 'replacements']] as const).map(([label, value, tone]) => <div className={`pending-results__metric ${tone === '' ? '' : `pending-results__metric--${tone}`}`} key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <div className="pending-results__workspace">
      {!isReadOnly && pending.length > 0 ? <Card padding="none" className="pending-results__queue"><div className="pending-results__section-heading"><div><p className="operator-eyebrow">Primary operator workspace</p><h2>Decision Queue</h2><p>Review each selected winner before committing the Live result.</p></div><Button onClick={toggleAllPending} variant="secondary" disabled={busy || pending.length === 0}>{bulkSelectionLabel}</Button></div><div className="pending-results__selection-status" aria-live="polite"><strong>{selectedWinners.length > 0 ? `${selectedWinners.length} of ${winners.length} selected` : 'No winners selected'}</strong><span>{pending.length} pending</span></div><ul aria-label="Pending winners" className="pending-results__winner-list">{winners.map((winner) => <li className="pending-results__winner-row" data-result-status={winner.status} key={winner.id}><label><input checked={selected.has(winner.id)} disabled={winner.status !== 'pending' || busy} onChange={() => toggle(winner.id)} type="checkbox" /><span className="pending-results__winner-sequence">#{winner.sequenceNumber}</span><code className="pending-results__winner-ticket">{winner.ticketNumber}</code><Badge variant={winner.status === 'pending' ? 'pending' : winner.status === 'confirmed' ? 'confirmed' : 'danger'}>{statusLabel(winner.status)}</Badge>{winner.status === 'cancelled' ? <small>Preserved in official history</small> : null}</label></li>)}</ul><div className="pending-results__action-bar"><div><strong>Decision actions</strong><span>{selectedWinners.length > 0 ? `Apply to ${selectedWinners.length} selected winner${selectedWinners.length === 1 ? '' : 's'}.` : 'Select one or more pending winners to continue.'}</span></div><div className="pending-results__actions"><Button className="pending-results__action pending-results__action--confirm" disabled={!canDecide} onClick={() => openDecision('confirm')}>Confirm{selectedWinners.length > 0 ? ` ${selectedWinners.length}` : ''}</Button><Button className="pending-results__action pending-results__action--cancel" disabled={!canDecide} onClick={() => openDecision('cancel')} variant="danger">Cancel{selectedWinners.length > 0 ? ` ${selectedWinners.length}` : ''}</Button><Button className="pending-results__action pending-results__action--redraw" disabled={!canDecide || !capacityEnough} onClick={() => openDecision('redraw-pending')} variant="secondary">Redraw{selectedWinners.length > 0 ? ` ${selectedWinners.length}` : ''}</Button></div></div></Card> : null}
      <Card padding="md" className="pending-results__details"><div className="pending-results__section-heading"><div><p className="operator-eyebrow">Operator context</p><h2>Result Details</h2></div><Badge variant="live">Live</Badge></div><dl className="pending-results__details-list"><div><dt>Event</dt><dd>{event.name}</dd></div><div><dt>Prize category</dt><dd>{category.name}</dd></div><div><dt>Prize</dt><dd>{category.prizeName}</dd></div><div><dt>Winner count</dt><dd>{winners.length}</dd></div><div><dt>Eligible pool</dt><dd>{session.candidatePoolSnapshot?.eligibleSnapshotCount ?? '—'}</dd></div><div><dt>Draw time</dt><dd>{formatOperatorDateTime(session.createdAt)}</dd></div></dl><div className="pending-results__capacity"><span>Redraw capacity</span><strong>{displayedReplacementCapacity} eligible replacements available</strong><small>Replacement identities are not selected until a redraw is requested.</small></div></Card>
    </div>
    {session.status === 'completed' && confirmed.length > 0 ? <Card padding="md" className="pending-results__confirmed-actions"><p className="operator-eyebrow">Confirmed-result actions</p><h2>Redraw confirmed winners</h2><p>Reopen this confirmed result and create replacement winners.</p><Button disabled={busy} onClick={() => { setSelected(new Set(confirmed.map((winner) => winner.id))); openDecision('redraw-confirmed') }} variant="danger">Redraw confirmed winners</Button></Card> : null}
    <details className="pending-results__audit"><summary>Authoritative winner records <span>{winners.length} records</span></summary><div><ol aria-label="Official winners">{winners.map((winner) => { const redraw = redraws.find((candidate) => candidate.originalWinnerRecordId === winner.id); const replacement = redraw === undefined ? undefined : winners.find((candidate) => candidate.id === redraw.replacementWinnerRecordId); return <li key={winner.id}><code>{winner.ticketNumber}</code> <Badge variant={winner.status === 'pending' ? 'pending' : winner.status === 'confirmed' ? 'confirmed' : 'danger'}>{statusLabel(winner.status)}</Badge>{winner.confirmedAt ? ` · confirmed ${winner.confirmedAt}` : ''}{winner.cancelledAt ? ` · cancelled ${winner.cancelledAt}` : ''}{redraw === undefined ? null : <> · replacement <code>{replacement?.ticketNumber ?? 'unavailable'}</code> ({replacement?.status ?? 'unavailable'})</>}</li> })}</ol><p><small>Original WinnerRecords remain visible for audit and lineage review.</small></p></div></details>
    <nav className="pending-results__navigation" aria-label="Pending result navigation"><Link to="/history">Open official history</Link><Link to="/draw/setup">Return to Draw Setup</Link></nav>
    <ConfirmationDialog confirmDisabled={busy || (decision === 'redraw-pending' && !capacityEnough) || (decision !== 'confirm' && reason === 'other' && note.trim() === '')} confirmLabel={decision === 'confirm' ? 'Confirm officially' : decision === 'cancel' ? 'Cancel officially' : 'Redraw officially'} confirmLoading={busy} consequence={<div className="pending-results__decision-content"><div className="pending-results__decision-consequence"><p>{decision === 'confirm' ? <>Confirm {selectedWinners.length} winner{selectedWinners.length === 1 ? '' : 's'} in Live mode. Other winners remain pending.</> : decision === 'cancel' ? <>Cancellation remains in official history, does not draw a replacement, and cannot be undone by deleting the record.</> : <>This is an official destructive Live action. The selected original result will remain visible and the replacement will be pending after commit. Capacity available: {replacementCapacity}.</>}{decision === 'redraw-confirmed' ? ' A completed result will become pending-confirmation; unaffected confirmed winners remain confirmed.' : ''}</p></div>{decision === 'confirm' ? null : <div className="pending-results__decision-form"><Select id="reason" label="Reason" disabled={busy} onChange={(event) => setReason(event.target.value as RedrawReason)} value={reason}>{reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select><label className="ui-field" htmlFor="note"><span className="ui-field__label">Note {reason === 'other' ? '(required)' : '(optional)'}</span><textarea className="ui-input pending-results__note" id="note" disabled={busy} onChange={(event) => setNote(event.target.value)} placeholder="Add context for the audit record…" value={note} /></label></div>}</div>} onCancel={() => { if (!busy) setDecision(null) }} onConfirm={() => void submit()} open={decision !== null} title={dialogTitle} tone={decision === 'confirm' ? 'warning' : 'danger'} />
  </section>
}
