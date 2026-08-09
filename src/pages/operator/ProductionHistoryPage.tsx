import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import { reconstructOfficialHistoryForEvent, type HistoryReadRepositories, type HistoryReconstruction, type ReconstructedHistorySession, type ReconstructedWinner } from '../../application/history/history-read-model.ts'
import { filterOfficialHistory, filterOfficialWinners, readHistoryQuery, writeHistoryQuery, HISTORY_STATUSES, type HistoryQuery } from '../../application/history/history-query.ts'
import { projectAuditTimeline } from '../../application/history/audit-timeline.ts'
import { useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Badge, Button, ButtonLink, Card, Icon, Select, Table, type IconName } from '../../shared/ui/index.ts'
import { ProductionLoadingState, ProductionSetupRequired } from '../../shared/components/ProductionWorkspaceState.tsx'

type LoadState = { readonly status: 'loading' } | { readonly status: 'ready'; readonly sessions: readonly HistoryReconstruction[] } | { readonly status: 'error'; readonly message: string }
type SessionStatus = ReconstructedHistorySession['session']['status']

function label(value: string): string { return value.replaceAll('-', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) }
function statusVariant(status: SessionStatus): 'pending' | 'confirmed' | 'danger' | 'neutral' { return status === 'pending-confirmation' || status === 'drawing' ? 'pending' : status === 'completed' ? 'confirmed' : status === 'cancelled' ? 'danger' : 'neutral' }
function winnerVariant(status: ReconstructedWinner['status']): 'pending' | 'confirmed' | 'danger' { return status === 'pending' ? 'pending' : status === 'confirmed' ? 'confirmed' : 'danger' }
function statusIcon(status: SessionStatus): IconName | null { return status === 'completed' ? 'CircleCheck' : status === 'cancelled' ? 'CircleX' : status === 'pending-confirmation' || status === 'drawing' ? 'Clock' : null }
function winnerStatusIcon(status: ReconstructedWinner['status']): IconName { return status === 'pending' ? 'Clock' : status === 'confirmed' ? 'CircleCheck' : 'CircleX' }
function SessionStatusIcon({ status }: { readonly status: SessionStatus }): ReactNode { const icon = statusIcon(status); return icon === null ? null : <Icon name={icon} size={16} /> }
function timestamp(value: string | undefined): string {
  if (value === undefined) return '—'
  const date = new Date(value)
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}`
}
function counts(item: ReconstructedHistorySession) {
  return {
    confirmed: item.winners.filter((winner) => winner.status === 'confirmed').length,
    pending: item.winners.filter((winner) => winner.status === 'pending').length,
    cancelled: item.winners.filter((winner) => winner.status === 'cancelled').length,
  }
}
function categoryName(item: ReconstructedHistorySession): string { return item.summary.categoryName ?? item.category?.name ?? 'Prize category unavailable' }
function prizeName(item: ReconstructedHistorySession): string { return item.summary.prizeName ?? item.category?.prizeName ?? 'Related prize unavailable' }

function readRepositories(services: ReturnType<typeof createDrawSetupProductionServices>): HistoryReadRepositories {
  return { audits: services.audits ?? { findByEventId: async () => [] }, categories: services.categories, configurations: services.configurations, events: services.events, redraws: services.redraws ?? { findByDrawSessionId: async () => [] }, sessions: services.sessions, winners: services.winners }
}

export function ProductionHistoryPage() {
  const workspace = useProductionWorkspace()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const repositories = useMemo(() => readRepositories(services), [services])
  const [searchParams, setSearchParams] = useSearchParams()
  const { drawSessionId } = useParams<{ drawSessionId: string }>()
  const location = useLocation()
  const allWinners = location.pathname.endsWith('/history/winners')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const query = readHistoryQuery(searchParams)
  const updateQuery = (next: Partial<HistoryQuery>) => setSearchParams(writeHistoryQuery({ ...query, ...next }), { replace: true })

  const load = useCallback(async () => {
    if (workspace.status !== 'ready') return
    setState({ status: 'loading' })
    try {
      await services.open()
      const projection = await reconstructOfficialHistoryForEvent(workspace.event.id, repositories)
      setState({ status: 'ready', sessions: projection.sessions })
    } catch (cause: unknown) {
      setState({ status: 'error', message: cause instanceof Error && /version/i.test(cause.message) ? 'This local database is newer than the supported application version.' : 'Official history could not be read safely. Retry the local read.' })
    }
  }, [repositories, services, workspace])

  useEffect(() => { void Promise.resolve().then(load) }, [load])

  if (workspace.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Official records" headingId="history-title" title="History" description="Reading the selected Event…" /><ProductionLoadingState description="Reading the selected Event…" /></section>
  if (workspace.status === 'empty' || workspace.status === 'invalid-reference') return <section aria-labelledby="history-title"><PageHeader eyebrow="Official records" headingId="history-title" title="History" description="An active Event is required to read official history." /><ProductionSetupRequired title="No active Event" description="Select an Event to view its official draw history." /></section>
  if (workspace.status === 'error') return <section aria-labelledby="history-title"><PageHeader eyebrow="Official records" headingId="history-title" title="History unavailable" description="The selected Event could not be read." /><StatusBanner badge="Storage error" title="Official history was not changed" tone="warning">{workspace.message}</StatusBanner></section>
  if (state.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Official records" headingId="history-title" title="History" description={`Reading official history for ${workspace.event.name}…`} /><ProductionLoadingState description={`Reading official history for ${workspace.event.name}…`} /></section>
  if (state.status === 'error') return <section aria-labelledby="history-title"><PageHeader eyebrow="Official records" headingId="history-title" title="History unavailable" description={state.message} /><StatusBanner badge="Read-only recovery" title="No decision or mutation was run" tone="warning">Retry the local read.</StatusBanner><Button icon={<Icon name="RefreshCw" />} onClick={() => void load()}>Retry read</Button></section>

  const filtered = filterOfficialHistory(state.sessions, query)
  if (drawSessionId !== undefined) {
    const selected = state.sessions.find((item) => item.value.session.id === drawSessionId) ?? null
    return <section aria-labelledby="history-title" className="history-page history-detail-page"><PageHeader eyebrow="Official records" headingId="history-title" title="Session Detail" description={selected === null ? 'The requested official session could not be found.' : `${prizeName(selected.value)} · ${workspace.event.name}`} />{selected === null ? <StatusBanner badge="Not found" title="DrawSession unavailable" tone="warning">This session does not belong to the selected Event or no longer exists.</StatusBanner> : <HistoryDetail reconstruction={selected} />}</section>
  }
  if (allWinners) return <AllWinners sessions={state.sessions} eventName={workspace.event.name} query={query} onQueryChange={updateQuery} />

  const actions = state.sessions.length === 0 ? undefined : <><ButtonLink icon={<Icon name="Radio" />} variant="secondary" to="/draw/live">Open Draw Sessions</ButtonLink><ButtonLink icon={<Icon name="Trophy" />} variant="secondary" to="/history/winners">All Winners</ButtonLink></>
  return <section aria-labelledby="history-title" className="history-page"><PageHeader eyebrow="Official records" headingId="history-title" title="Session History" description={`Authoritative Live draw sessions for ${workspace.event.name}.`} actions={actions} />{state.sessions.length > 0 ? <HistoryFilters sessions={state.sessions} query={query} onChange={updateQuery} /> : null}{filtered.length === 0 ? <Card className="history-empty-state" padding="lg"><p>{state.sessions.length === 0 ? 'Official history' : 'Session history'}</p><div><h2>{state.sessions.length === 0 ? 'No official draws yet' : 'No official sessions'}</h2><p>{state.sessions.length === 0 ? 'This Event does not have any persisted Live draw results yet.' : 'No sessions match the active filters.'}</p>{state.sessions.length === 0 ? <p>Completed official draws will appear here automatically.</p> : null}</div>{state.sessions.length === 0 ? <ButtonLink icon={<Icon name="SlidersHorizontal" />} to="/draw/setup">Open Draw Setup</ButtonLink> : <Button onClick={() => setSearchParams('', { replace: true })} icon={<Icon name="SlidersHorizontal" />}>Reset filters</Button>}</Card> : <HistoryTable items={filtered} />}</section>
}

function HistoryFilters({ sessions, query, onChange }: { readonly sessions: readonly HistoryReconstruction[]; readonly query: HistoryQuery; readonly onChange: (next: Partial<HistoryQuery>) => void }) {
  const categories = [...new Map(sessions.map((item) => [item.value.summary.categoryId, item.value.summary.categoryName ?? 'Unavailable'])).entries()].filter(([id]) => id !== null)
  return <div className="history-filters" aria-label="History filters"><label className="ui-field"><span className="ui-field__label">Search</span><input className="ui-input" aria-label="Search official history" value={query.search} placeholder="Ticket, category, prize, or session ID" onChange={(event) => onChange({ search: event.target.value })} /></label><Select label="Status" aria-label="Filter by status" value={query.status} onChange={(event) => onChange({ status: event.target.value as HistoryQuery['status'] })}><option value="all">All statuses</option>{HISTORY_STATUSES.map((item) => <option key={item} value={item}>{label(item)}</option>)}</Select><Select label="Mode" aria-label="Filter by mode" value="live" disabled><option value="live">Live / Official</option></Select><Select label="Category" aria-label="Filter by category" value={query.category} onChange={(event) => onChange({ category: event.target.value })}><option value="">All categories</option>{categories.map(([id, name]) => <option key={id} value={id as string}>{name}</option>)}</Select><label className="ui-field"><span className="ui-field__label">From</span><input className="ui-input" aria-label="History from date" type="date" value={query.from} onChange={(event) => onChange({ from: event.target.value })} /></label><label className="ui-field"><span className="ui-field__label">To</span><input className="ui-input" aria-label="History to date" type="date" value={query.to} onChange={(event) => onChange({ to: event.target.value })} /></label><Badge variant="live">Official Live only</Badge><Button variant="quiet" onClick={() => onChange({ category: '', from: '', search: '', status: 'all', to: '' })}>Reset</Button></div>
}

export function HistoryTable({ items }: { readonly items: readonly HistoryReconstruction[] }) {
  return <div className="history-table-panel"><Table aria-label="Official history sessions" caption="Official Live draw history"><thead><tr><th scope="col">Draw timestamp</th><th scope="col">Category / prize</th><th scope="col">Requested</th><th scope="col">Confirmed</th><th scope="col">Pending</th><th scope="col">Cancelled</th><th scope="col">Completion</th><th scope="col">Mode / status</th><th scope="col">Action</th></tr></thead><tbody>{items.map((item) => <HistoryTableRow item={item.value} incomplete={item.kind === 'incomplete'} key={item.value.session.id} />)}</tbody></Table></div>
}

function HistoryTableRow({ item, incomplete }: { readonly item: ReconstructedHistorySession; readonly incomplete: boolean }) {
  const count = counts(item)
  const action = item.session.status === 'pending-confirmation' ? <ButtonLink className="history-table__action" icon={<Icon name="ClipboardCheck" />} size="sm" to={`/draw/pending/${item.session.id}`}>Review pending</ButtonLink> : <ButtonLink className="history-table__action" icon={<Icon name="ArrowRight" />} size="sm" to={`/history/${item.session.id}`} variant="secondary">View Details</ButtonLink>
  return <tr className="history-table__row"><td className="history-table__date">{timestamp(item.summary.drawTimestamp)}</td><td><span className="history-table__secondary">{categoryName(item)}</span><small className="history-table__event">{prizeName(item)}</small></td><td><strong className="history-table__count">{item.summary.requestedWinnerCount ?? '—'}</strong></td><td><Badge variant="confirmed">{count.confirmed}</Badge></td><td><Badge variant="pending">{count.pending}</Badge></td><td><Badge variant="danger">{count.cancelled}</Badge></td><td className="history-table__date">{timestamp(item.summary.completionTimestamp)}</td><td><div className="history-table__status"><Badge variant="live">Live</Badge><Badge variant={statusVariant(item.summary.sessionStatus)}><SessionStatusIcon status={item.summary.sessionStatus} />{label(item.summary.sessionStatus)}</Badge>{incomplete ? <Badge variant="danger">Incomplete</Badge> : null}</div></td><td className="history-table__action-cell">{action}</td></tr>
}

function Metadata({ item }: { readonly item: ReconstructedHistorySession }) {
  const fields = [['Event', item.event?.name || 'Unavailable'], ['Draw Session ID', item.session.id], ['Mode', label(item.summary.mode)], ['Category', categoryName(item)], ['Prize', prizeName(item)], ['Draw timestamp', timestamp(item.summary.drawTimestamp)], ['Completion timestamp', timestamp(item.summary.completionTimestamp)], ['Session status', label(item.summary.sessionStatus)], ['Eligible-pool count', item.summary.eligibleCount ?? 'Unavailable'], ['Requested winner count', item.summary.requestedWinnerCount ?? 'Unavailable']] as const
  return <dl className="history-detail__summary-grid">{fields.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{name === 'Session status' ? <Badge variant={statusVariant(item.summary.sessionStatus)}>{value}</Badge> : value}</dd></div>)}</dl>
}

function HistoryDetailContent({ reconstruction }: { readonly reconstruction: HistoryReconstruction }) {
  const item = reconstruction.value
  const lineageByOriginal = new Map(item.lineages.map((lineage) => [lineage.originalWinnerRecordId, lineage]))
  return <div className="history-detail"><ButtonLink icon={<Icon name="ArrowLeft" />} to="/history" variant="quiet">Back to History</ButtonLink>{reconstruction.kind === 'incomplete' ? <StatusBanner badge="Incomplete record" title="Official record is incomplete or inconsistent" tone="warning">Trustworthy persisted evidence remains visible below. Missing relationships are not fabricated.</StatusBanner> : null}<Card className="history-detail__summary" padding="none"><div className="history-detail__audit-heading"><p>Official Live session · read-only evidence</p><h2>Session metadata</h2></div><Metadata item={item} /></Card><Card className="history-detail__winner-records" padding="none"><div className="history-detail__audit-heading"><h2>Winner records</h2><p>Every retained WinnerRecord is shown, including cancelled originals.</p></div><div className="history-detail__table-scroll"><Table caption="Official WinnerRecords"><thead><tr><th>Sequence</th><th>Ticket</th><th>Status</th><th>Confirmed</th><th>Cancelled</th><th>Replacement context</th></tr></thead><tbody>{item.winners.length === 0 ? <tr><td colSpan={6}>No WinnerRecords are associated with this session.</td></tr> : item.winners.map((winner) => <WinnerRow key={winner.winnerRecordId} winner={winner} lineage={lineageByOriginal.get(winner.winnerRecordId)} />)}</tbody></Table></div></Card>{item.session.status === 'pending-confirmation' ? <p><ButtonLink icon={<Icon name="ClipboardCheck" />} to={`/draw/pending/${item.session.id}`}>Review pending results</ButtonLink></p> : null}</div>
}

export function HistoryDetail({ reconstruction }: { readonly reconstruction: HistoryReconstruction }) {
  return <><HistoryDetailContent reconstruction={reconstruction} /><AuditTimeline reconstruction={reconstruction} /></>
}

export function AuditTimeline({ reconstruction }: { readonly reconstruction: HistoryReconstruction }) {
  const entries = projectAuditTimeline(reconstruction)
  return <Card className="history-audit-timeline" padding="none"><div className="history-detail__audit-heading"><h2>Audit Timeline</h2><p>Persisted chronological evidence for this Live session.</p></div>{entries.length === 0 ? <p>No persisted audit entries are associated with this session.</p> : <ol>{entries.map((entry) => <li key={entry.id}><time dateTime={entry.timestamp}>{timestamp(entry.timestamp)}</time><strong>{entry.action}</strong><span>{entry.actor ?? 'Actor unavailable'}</span>{entry.ticketNumber ? <code className="result-ticket">{entry.ticketNumber}</code> : null}{entry.originalTicketNumber && entry.replacementTicketNumber ? <span><code>{entry.originalTicketNumber}</code> → <code>{entry.replacementTicketNumber}</code></span> : null}{entry.reason ? <span>Reason: {label(entry.reason)}</span> : null}{entry.note ? <span>Note: {entry.note}</span> : null}</li>)}</ol>}</Card>
}

function WinnerRow({ winner, lineage }: { readonly winner: ReconstructedWinner; readonly lineage: ReconstructedHistorySession['lineages'][number] | undefined }) {
  return <tr><td>#{winner.sequence}</td><td><code className="result-ticket">{winner.ticketNumber}</code></td><td><Badge variant={winnerVariant(winner.status)}><Icon name={winnerStatusIcon(winner.status)} size={16} />{label(winner.status)}</Badge></td><td>{timestamp(winner.confirmationTimestamp)}</td><td>{timestamp(winner.cancellationTimestamp)}</td><td>{lineage === undefined ? 'Original selection retained' : <span><code>{lineage.originalTicketNumber}</code> <Icon name="ArrowRight" size={16} /> <code>{lineage.replacementTicketNumber}</code><small> · {label(lineage.reason)}{lineage.reasonNote ? ` · ${lineage.reasonNote}` : ''}</small></span>}</td></tr>
}

export function AllWinners({ sessions, eventName, query = { category: '', from: '', search: '', status: 'all', to: '' }, onQueryChange = () => undefined }: { readonly sessions: readonly HistoryReconstruction[]; readonly eventName: string; readonly query?: HistoryQuery; readonly onQueryChange?: (next: Partial<HistoryQuery>) => void }) {
  const rows = filterOfficialWinners(sessions, query)
  return <section aria-labelledby="history-title" className="history-page"><PageHeader eyebrow="Official records" headingId="history-title" title="All Winners" description={`Every retained WinnerRecord across Live sessions for ${eventName}.`} actions={<ButtonLink icon={<Icon name="ArrowLeft" />} variant="secondary" to="/history">Session History</ButtonLink>} />{sessions.some((item) => item.kind === 'incomplete') ? <StatusBanner badge="Incomplete record" title="Some official records need attention" tone="warning">Surviving winner evidence is shown. Incomplete relationships are not presented as complete.</StatusBanner> : null}<HistoryFilters sessions={sessions} query={query} onChange={onQueryChange} />{rows.length === 0 ? <Card padding="md"><h2>{sessions.length === 0 ? 'No official winners yet' : 'No winners match the active filters'}</h2><p>Persisted Live WinnerRecords are read-only evidence.</p></Card> : <Card className="history-table-panel" padding="none"><Table aria-label="All official winners" caption="All official Live winners"><thead><tr><th>Ticket</th><th>Status</th><th>Category</th><th>Prize</th><th>Draw Session</th><th>Sequence</th><th>Draw timestamp</th><th>Confirmed</th><th>Cancelled</th><th>Lineage</th></tr></thead><tbody>{rows.map(({ reconstruction, winner }, index) => { const item = reconstruction.value; const lineage = item.lineages.find((candidate) => candidate.originalWinnerRecordId === winner.winnerRecordId); return <tr key={`${item.session.id}:${winner.winnerRecordId}:${index}`}><td><code className="result-ticket">{winner.ticketNumber}</code></td><td><Badge variant={winnerVariant(winner.status)}>{label(winner.status)}</Badge></td><td>{categoryName(item)}</td><td>{prizeName(item)}</td><td><ButtonLink size="sm" to={`/history/${item.session.id}`} variant="quiet">{item.session.id}</ButtonLink></td><td>#{winner.sequence}</td><td>{timestamp(item.summary.drawTimestamp)}</td><td>{timestamp(winner.confirmationTimestamp)}</td><td>{timestamp(winner.cancellationTimestamp)}</td><td>{lineage === undefined ? 'Original selection' : <><code>{lineage.originalTicketNumber}</code> <Icon name="ArrowRight" size={16} /> <code>{lineage.replacementTicketNumber}</code></>}</td></tr> })}</tbody></Table></Card>}</section>
}
