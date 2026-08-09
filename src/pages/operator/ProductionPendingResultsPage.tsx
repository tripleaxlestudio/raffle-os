import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactSelect, { type StylesConfig } from 'react-select'
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
import { Badge, Button, ButtonLink, Card, ConfirmationDialog, Icon, Modal } from '../../shared/ui/index.ts'

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

type ReasonOption = (typeof reasons)[number]

const reasonSelectStyles: StylesConfig<ReasonOption, false> = {
  container: (base) => ({ ...base, width: '100%' }),
  control: (base, state) => ({
    ...base,
    minHeight: '2.75rem',
    height: '2.75rem',
    borderColor: state.isFocused ? 'var(--accent-hover)' : 'var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--surface-raised)',
    boxShadow: state.isFocused
      ? '0 0 0 0.15rem color-mix(in srgb, var(--accent-hover) 55%, transparent)'
      : 'inset 0 0 0 1px rgb(255 255 255 / 4%)',
    '&:hover': { borderColor: 'var(--accent-hover)' },
  }),
  valueContainer: (base) => ({ ...base, padding: '0 var(--control-inline-padding)' }),
  singleValue: (base) => ({ ...base, color: 'var(--text-primary)' }),
  placeholder: (base) => ({ ...base, color: 'var(--text-muted)' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? 'var(--accent-hover)' : 'var(--text-secondary)',
    padding: '0 var(--control-inline-padding) 0 var(--space-2)',
  }),
  menuPortal: (base) => ({ ...base, zIndex: 2000 }),
  menu: (base) => ({
    ...base,
    marginTop: 'var(--space-2)',
    border: '1px solid #3a4150',
    borderRadius: 'var(--radius-md)',
    backgroundColor: '#1d212b',
    boxShadow: '0 0.75rem 2rem rgb(0 0 0 / 45%)',
    overflow: 'hidden',
  }),
  menuList: (base) => ({
    ...base,
    backgroundColor: '#1d212b',
    padding: 'var(--space-1) 0',
  }),
  option: (base, state) => ({
    ...base,
    padding: 'var(--space-3) var(--space-3)',
    backgroundColor: state.isSelected
      ? '#7567ff'
      : state.isFocused
        ? '#2b3140'
        : '#1d212b',
    color: '#f4f6fa',
    cursor: 'pointer',
    '&:active': { backgroundColor: '#7567ff' },
  }),
}

function ReasonSelect({ id, reason, busy, onChange }: { readonly id: string; readonly reason: RedrawReason; readonly busy: boolean; readonly onChange: (reason: RedrawReason) => void }) {
  const selected = reasons.find((option) => option.value === reason) ?? reasons[0]
  return <div className="ui-field pending-results__reason-field"><span className="ui-field__label" id={`${id}-label`}>Reason</span><ReactSelect<ReasonOption, false> aria-labelledby={`${id}-label`} classNamePrefix="raffle-reason-select" inputId={id} isClearable={false} isDisabled={busy} isSearchable={false} menuPortalTarget={document.body} menuPosition="fixed" onChange={(option) => { if (option !== null) onChange(option.value) }} options={reasons} styles={reasonSelectStyles} value={selected} /></div>
}

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

function CancelWinnerDialog({ selectedWinners, reason, note, busy, onReasonChange, onNoteChange, onCancel, onConfirm }: { readonly selectedWinners: readonly WinnerRecord[]; readonly reason: RedrawReason; readonly note: string; readonly busy: boolean; readonly onReasonChange: (reason: RedrawReason) => void; readonly onNoteChange: (note: string) => void; readonly onCancel: () => void; readonly onConfirm: () => void }) {
  const count = selectedWinners.length
  const winnerLabel = `${count} ${count === 1 ? 'winner' : 'winners'}`
  const ticketContext = count === 1 ? `Ticket ${selectedWinners[0]?.ticketNumber ?? ''}` : `${count} selected winners`
  const consequence = count === 1 ? 'This winner will be recorded as cancelled in official history. No replacement will be drawn automatically.' : 'These winners will be recorded as cancelled in official history. No replacement will be drawn automatically.'
  return <Modal headerIcon={<Icon name="CircleX" />} headerIconTone="danger" open eyebrow="OPERATOR CONFIRMATION" title={count === 1 ? 'Cancel winner' : `Cancel ${winnerLabel}`} showCloseButton={false} onClose={onCancel} footer={<><Button icon={<Icon name="ArrowLeft" />} variant="secondary" onClick={onCancel}>Back</Button><Button className="pending-results__cancel-submit" icon={<Icon name="CircleX" />} variant="danger" disabled={busy || (reason === 'other' && note.trim() === '')} isLoading={busy} onClick={onConfirm}>Cancel officially</Button></>}>
    <div className="pending-results__cancel-body">
      <strong className="pending-results__cancel-context">{ticketContext}</strong>
      <p className="pending-results__cancel-consequence">{consequence}</p>
      <ReasonSelect id="cancel-reason" reason={reason} busy={busy} onChange={onReasonChange} />
      <label className="ui-field" htmlFor="cancel-note"><span className="ui-field__label">Note (optional)</span><textarea className="ui-input pending-results__cancel-note" id="cancel-note" rows={3} disabled={busy} onChange={(event) => onNoteChange(event.target.value)} placeholder="Add context for the audit record…" value={note} /></label>
    </div>
  </Modal>
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
  if (state.status === 'error') return <section aria-live="polite"><PageHeader eyebrow="Live production" headingId="pending-title" title={state.title} description={state.message} /><StatusBanner badge="Read-only recovery" title={state.title} tone="warning">No decision or random selection was run. Retry the local read or return to Draw Setup.</StatusBanner><Button icon={<Icon name="RefreshCw" />} onClick={() => void load()}>Retry read</Button></section>

  const { session, event, category, winners, redraws } = state
  const pending = winners.filter((winner) => winner.status === 'pending')
  const confirmed = winners.filter((winner) => winner.status === 'confirmed')
  const cancelled = winners.filter((winner) => winner.status === 'cancelled')
  const selectedWinners = winners.filter((winner) => selected.has(winner.id))
  const allPendingSelected = pending.length > 0 && pending.every((winner) => selected.has(winner.id))
  const bulkSelectionLabel = allPendingSelected ? 'Deselect All' : 'Select All Pending'
  const canDecide = selectedWinners.length > 0 && !busy
  const replacementCapacity = calculateReplacementCapacity({ candidatePoolSnapshot: session.candidatePoolSnapshot, drawSessionId: session.id, requestedReplacementCount: selectedWinners.length || 1, targetWinnerIds: selectedWinners.map((winner) => winner.id), winners }).eligibleCandidateCount
  const capacityEnough = replacementCapacity >= selectedWinners.length
  const displayedReplacementCapacity = calculateReplacementCapacity({ candidatePoolSnapshot: session.candidatePoolSnapshot, drawSessionId: session.id, requestedReplacementCount: pending.length || 1, targetWinnerIds: pending.map((winner) => winner.id), winners }).eligibleCandidateCount

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
  const dialogTitle = decision === 'confirm' ? `Confirm ${selectedWinners.length} winner${selectedWinners.length === 1 ? '' : 's'}` : decision === 'cancel' ? `Cancel ${selectedWinners.length} winner${selectedWinners.length === 1 ? '' : 's'}` : decision === 'redraw-confirmed' ? 'Redraw confirmed winners' : 'Redraw pending winners'
  const remainingPending = Math.max(0, pending.length - selectedWinners.filter((winner) => winner.status === 'pending').length)
  const replacements = winners.filter((winner) => winner.sequenceNumber > (session.configurationSnapshot?.requestedWinners ?? Number.MAX_SAFE_INTEGER))
  return <section aria-labelledby="pending-title" className={`pending-results pending-results--production${session.status === 'completed' ? ' pending-results--completed' : ''}`}>
    <PageHeader eyebrow={session.status === 'completed' ? 'DRAW COMPLETED · LIVE' : 'Live · official production'} headingId="pending-title" title={session.status === 'completed' ? 'Final Result' : 'Review Winners'} description={`${category.prizeName} · ${category.name}`} />
    {message === null || session.status === 'completed' ? null : <StatusBanner badge="Operator action" title="Reconciliation required" tone="warning">{message}</StatusBanner>}
    {isReadOnly ? <StatusBanner badge="Cancelled" title="Resolved result · read only" tone="warning">This session remains in official history and cannot be changed here.</StatusBanner> : session.status === 'completed' ? <div className="pending-results__completion-state" role="status"><div className="pending-results__completion-copy"><span>DRAW COMPLETED</span><strong>Winner review complete</strong><p>All {confirmed.length} winners are confirmed and ready for the next draw.</p></div><div className="pending-results__completion-actions"><ButtonLink icon={<Icon name="Play" />} size="lg" to="/draw/setup" variant="primary">Start Next Draw</ButtonLink><ButtonLink icon={<Icon name="History" />} to="/history" variant="secondary">View History</ButtonLink></div></div> : null}
    <div className="pending-results__summary" aria-label="Result summary">
      {([['Total winners', winners.length, ''], ['Pending', pending.length, 'pending'], ['Confirmed', confirmed.length, 'confirmed'], ['Cancelled', cancelled.length, 'cancelled'], ['Replacements', replacements.length, 'replacements']] as const).map(([label, value, tone]) => <div className={`pending-results__metric ${tone === '' ? '' : `pending-results__metric--${tone}`}`} key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <div className="pending-results__workspace">
      {!isReadOnly && pending.length > 0 ? <Card padding="none" className="pending-results__queue"><div className="pending-results__section-heading"><div><p className="operator-eyebrow">Winner decisions</p><h2>Select winners</h2><p>Select winners, then confirm, cancel, or redraw as required.</p></div><Button icon={selectedWinners.length === pending.length ? <Icon name="ListX" /> : <Icon name="ListChecks" />} onClick={toggleAllPending} variant="secondary" disabled={busy || pending.length === 0}>{bulkSelectionLabel}</Button></div><div className="pending-results__selection-status" aria-live="polite"><strong>{pending.length} pending</strong><span>{selectedWinners.length > 0 ? `${selectedWinners.length} selected` : 'No winners selected'}</span></div><ul aria-label="Pending winners" className="pending-results__winner-list">{winners.map((winner) => <li className="pending-results__winner-row" data-result-status={winner.status} key={winner.id}><label><input checked={selected.has(winner.id)} disabled={winner.status !== 'pending' || busy} onChange={() => toggle(winner.id)} type="checkbox" /><span className="pending-results__winner-sequence">#{winner.sequenceNumber}</span><code className="pending-results__winner-ticket">{winner.ticketNumber}</code><Badge variant={winner.status === 'pending' ? 'pending' : winner.status === 'confirmed' ? 'confirmed' : 'danger'}>{statusLabel(winner.status)}</Badge>{winner.status === 'cancelled' ? <small>Preserved in official history</small> : null}</label></li>)}</ul><div className="pending-results__action-bar"><div><strong>Decision actions</strong><span>{selectedWinners.length > 0 ? `Apply to ${selectedWinners.length} selected winner${selectedWinners.length === 1 ? '' : 's'}.` : 'Select one or more pending winners to continue.'}</span></div><div className="pending-results__actions"><Button className="pending-results__action pending-results__action--confirm" icon={<Icon name="CircleCheck" />} disabled={!canDecide} onClick={() => openDecision('confirm')}>Confirm{selectedWinners.length > 0 ? ` ${selectedWinners.length}` : ''}</Button><Button className="pending-results__action pending-results__action--cancel" icon={<Icon name="CircleX" />} disabled={!canDecide} onClick={() => openDecision('cancel')} variant="danger">Cancel{selectedWinners.length > 0 ? ` ${selectedWinners.length}` : ''}</Button><Button className="pending-results__action pending-results__action--redraw" icon={<Icon name="RotateCcw" />} disabled={!canDecide || !capacityEnough} onClick={() => openDecision('redraw-pending')} variant="secondary">Redraw{selectedWinners.length > 0 ? ` ${selectedWinners.length}` : ''}</Button></div></div></Card> : null}
      <Card padding="md" className="pending-results__details"><div className="pending-results__section-heading"><div><p className="operator-eyebrow">Operator context</p><h2>Result Details</h2></div><Badge variant="live">Live</Badge></div><dl className="pending-results__details-list"><div><dt>Event</dt><dd>{event.name}</dd></div><div><dt>Prize category</dt><dd>{category.name}</dd></div><div><dt>Prize</dt><dd>{category.prizeName}</dd></div><div><dt>Winner count</dt><dd>{winners.length}</dd></div><div><dt>Eligible pool</dt><dd>{session.candidatePoolSnapshot?.eligibleSnapshotCount ?? '—'}</dd></div><div><dt>Draw time</dt><dd>{formatOperatorDateTime(session.createdAt)}</dd></div></dl><div className="pending-results__capacity"><span>Redraw capacity</span><strong>{displayedReplacementCapacity} eligible replacements available</strong><small>Replacement identities are not selected until a redraw is requested.</small></div></Card>
    </div>
    {session.status === 'completed' && confirmed.length > 0 ? <Card padding="sm" className="pending-results__completed-actions"><div className="pending-results__correction-actions"><div><p className="operator-eyebrow">Correction / Recovery</p><h2>Need to correct this result?</h2></div><Button icon={<Icon name="RotateCcw" />} disabled={busy} onClick={() => { setSelected(new Set(confirmed.map((winner) => winner.id))); openDecision('redraw-confirmed') }} variant="danger">Redraw confirmed winners</Button></div></Card> : null}
    <details className="pending-results__audit"><summary>Authoritative winner records <span>{winners.length} records</span></summary><div><ol aria-label="Official winners">{winners.map((winner) => { const redraw = redraws.find((candidate) => candidate.originalWinnerRecordId === winner.id); const replacement = redraw === undefined ? undefined : winners.find((candidate) => candidate.id === redraw.replacementWinnerRecordId); return <li key={winner.id}><code>{winner.ticketNumber}</code> <Badge variant={winner.status === 'pending' ? 'pending' : winner.status === 'confirmed' ? 'confirmed' : 'danger'}>{statusLabel(winner.status)}</Badge>{winner.confirmedAt ? ` · confirmed ${winner.confirmedAt}` : ''}{winner.cancelledAt ? ` · cancelled ${winner.cancelledAt}` : ''}{redraw === undefined ? null : <> · replacement <code>{replacement?.ticketNumber ?? 'unavailable'}</code> ({replacement?.status ?? 'unavailable'})</>}</li> })}</ol><p><small>Original WinnerRecords remain visible for audit and lineage review.</small></p></div></details>
    {session.status === 'completed' ? null : <nav className="pending-results__navigation" aria-label="Pending result navigation"><Link to="/history"><Icon name="History" />Open official history</Link><Link to="/draw/setup"><Icon name="ArrowLeft" />Return to Draw Setup</Link></nav>}
    {decision === 'cancel' ? <CancelWinnerDialog selectedWinners={selectedWinners} reason={reason} note={note} busy={busy} onReasonChange={setReason} onNoteChange={setNote} onCancel={() => { if (!busy) setDecision(null) }} onConfirm={() => void submit()} /> : <ConfirmationDialog headerIcon={decision === 'confirm' ? <Icon name="CircleCheck" /> : <Icon name="RotateCcw" />} headerIconTone={decision === 'confirm' ? 'success' : 'danger'} cancelLabel="Back" consequenceLabel={null} confirmDisabled={busy || (decision === 'redraw-pending' && !capacityEnough) || (decision !== 'confirm' && reason === 'other' && note.trim() === '')} confirmLabel={decision === 'confirm' ? 'Confirm officially' : 'Redraw officially'} confirmLoading={busy} consequence={<div className="pending-results__decision-content"><div className="pending-results__decision-consequence"><p>{decision === 'confirm' ? <>These winners will be added to the official result.{remainingPending > 0 ? ` ${remainingPending} winners will remain pending.` : ''}</> : <>This is an official destructive Live action. The selected original result will remain visible and the replacement will be pending after commit. Capacity available: {replacementCapacity}.</>}{decision === 'redraw-confirmed' ? ' A completed result will become pending-confirmation; unaffected confirmed winners remain confirmed.' : ''}</p></div>{decision === 'confirm' ? null : <div className="pending-results__decision-form"><ReasonSelect id="reason" reason={reason} busy={busy} onChange={setReason} /><label className="ui-field" htmlFor="note"><span className="ui-field__label">Note {reason === 'other' ? '(required)' : '(optional)'}</span><textarea className="ui-input pending-results__note" id="note" disabled={busy} onChange={(event) => setNote(event.target.value)} placeholder="Add context for the audit record…" value={note} /></label></div>}</div>} onCancel={() => { if (!busy) setDecision(null) }} onConfirm={() => void submit()} open={decision !== null} title={dialogTitle} tone={decision === 'confirm' ? 'warning' : 'danger'} />}
  </section>
}
