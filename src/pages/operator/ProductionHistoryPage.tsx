import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { buildOfficialHistorySession, type OfficialHistorySession } from '../../application/history/history-read-model.ts'
import { useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Badge, Button, ButtonLink, Card, Icon, Select, Table, type IconName } from '../../shared/ui/index.ts'
import { ProductionLoadingState, ProductionSetupRequired } from '../../shared/components/ProductionWorkspaceState.tsx'

type LoadState = { readonly status: 'loading' } | { readonly status: 'ready'; readonly sessions: readonly OfficialHistorySession[] } | { readonly status: 'error'; readonly message: string }
type SessionStatus = OfficialHistorySession['session']['status']

function label(value: string): string { return value.replaceAll('-', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) }
function statusVariant(status: SessionStatus): 'pending' | 'confirmed' | 'danger' | 'neutral' { return status === 'pending-confirmation' || status === 'drawing' ? 'pending' : status === 'completed' ? 'confirmed' : status === 'cancelled' ? 'danger' : 'neutral' }
function winnerVariant(status: 'pending' | 'confirmed' | 'cancelled'): 'pending' | 'confirmed' | 'danger' { return status === 'pending' ? 'pending' : status === 'confirmed' ? 'confirmed' : 'danger' }
function statusIcon(status: SessionStatus): IconName | null { return status === 'completed' ? 'CircleCheck' : status === 'cancelled' ? 'CircleX' : status === 'pending-confirmation' || status === 'drawing' ? 'Clock' : null }
function winnerStatusIcon(status: 'pending' | 'confirmed' | 'cancelled'): IconName { return status === 'pending' ? 'Clock' : status === 'confirmed' ? 'CircleCheck' : 'CircleX' }
function SessionStatusIcon({ status }: { readonly status: SessionStatus }): ReactNode { const icon = statusIcon(status); return icon === null ? null : <Icon name={icon} size={16} /> }
function timestamp(value: string | undefined, includeSeconds = false): string {
  if (value === undefined) return '—'
  const date = new Date(value)
  const datePart = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  const timePart = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', ...(includeSeconds ? { second: '2-digit' } : {}), hour12: false })
  return `${datePart} · ${timePart}`
}

export function ProductionHistoryPage() {
  const workspace = useProductionWorkspace()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const [searchParams, setSearchParams] = useSearchParams()
  const { drawSessionId } = useParams<{ drawSessionId: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [status, setStatus] = useState<string>(searchParams.get('status') ?? 'all')
  const [mode, setMode] = useState<string>(searchParams.get('mode') ?? 'all')

  const load = useCallback(async () => {
    if (workspace.status !== 'ready') return
    setState({ status: 'loading' })
    try {
      await services.open()
      const sessions: OfficialHistorySession[] = []
      for (const session of await services.sessions.findByEventId(workspace.event.id)) {
        if (session.mode !== 'live') continue
        const configuration = await services.configurations.findById(session.configurationId)
        const categoryId = session.configurationSnapshot?.prizeCategoryId ?? configuration?.prizeCategoryId
        const category = categoryId === undefined ? null : await services.categories.findById(categoryId)
        const [winners, redraws, audits] = await Promise.all([
          services.winners.findByDrawSessionId(session.id),
          services.redraws?.findByDrawSessionId(session.id) ?? Promise.resolve([]),
          services.audits?.findByEventId(workspace.event.id) ?? Promise.resolve([]),
        ])
        const relation = category === null ? 'missing-category' as const : 'valid' as const
        sessions.push(buildOfficialHistorySession(session, workspace.event, category, winners, redraws, relation, audits.filter((audit) => audit.detail !== null && typeof audit.detail === 'object' && 'drawSessionId' in audit.detail && audit.detail.drawSessionId === session.id)))
      }
      sessions.sort((left, right) => {
        const unresolved = (item: OfficialHistorySession) => item.session.status === 'drawing' || item.session.status === 'pending-confirmation' ? 0 : 1
        return unresolved(left) - unresolved(right) || right.session.updatedAt.localeCompare(left.session.updatedAt) || left.session.id.localeCompare(right.session.id)
      })
      setState({ status: 'ready', sessions })
    } catch (cause: unknown) {
      setState({ status: 'error', message: cause instanceof Error && /version/i.test(cause.message) ? 'This local database is newer than the supported application version.' : 'Official history could not be read safely. Retry the local read.' })
    }
  }, [services, workspace])

  useEffect(() => { void Promise.resolve().then(load) }, [load])

  if (workspace.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Official records" headingId="history-title" title="History" description="Reading the selected Event…" /><ProductionLoadingState description="Reading the selected Event…" /></section>
  if (workspace.status === 'empty' || workspace.status === 'invalid-reference') return <section aria-labelledby="history-title"><PageHeader eyebrow="Official records" headingId="history-title" title="History" description="An active Event is required to read official history." /><ProductionSetupRequired title="No active Event" description="Select an Event to view its official draw history." /></section>
  if (workspace.status === 'error') return <section aria-labelledby="history-title"><PageHeader eyebrow="Official records" headingId="history-title" title="History unavailable" description="The selected Event could not be read." /><StatusBanner badge="Storage error" title="Official history was not changed" tone="warning">{workspace.message}</StatusBanner></section>
  if (state.status === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Official records" headingId="history-title" title="History" description={`Reading official history for ${workspace.event.name}…`} /><ProductionLoadingState description={`Reading official history for ${workspace.event.name}…`} /></section>
  if (state.status === 'error') return <section aria-labelledby="history-title"><PageHeader eyebrow="Official records" headingId="history-title" title="History unavailable" description={state.message} /><StatusBanner badge="Read-only recovery" title="No decision or mutation was run" tone="warning">Retry the local read.</StatusBanner><Button icon={<Icon name="RefreshCw" />} onClick={() => void load()}>Retry read</Button></section>

  const filtered = state.sessions.filter((item) => (status === 'all' || item.session.status === status) && (mode === 'all' || item.session.mode === mode))
  const hasHistory = state.sessions.length > 0
  const updateFilter = (kind: 'status' | 'mode', value: string) => { if (kind === 'status') setStatus(value); else setMode(value); setSearchParams((current) => { current.set(kind, value); return current }, { replace: true }) }

  if (drawSessionId !== undefined) {
    const selected = state.sessions.find((item) => item.session.id === drawSessionId) ?? null
    return <section aria-labelledby="history-title" className="history-page history-detail-page">
      <PageHeader eyebrow="Official records" headingId="history-title" title="Official result" description={selected === null ? 'The requested official result could not be found.' : `${selected.category?.prizeName ?? selected.session.configurationSnapshot?.prizeName ?? 'Official result'} · ${workspace.event.name}`} />
      {selected === null ? <StatusBanner badge="Not found" title="DrawSession unavailable" tone="warning">This session does not belong to the selected Event or no longer exists.</StatusBanner> : <HistoryDetail item={selected} />}
    </section>
  }

  return <section aria-labelledby="history-title" className="history-page">
    <PageHeader eyebrow="Official records" headingId="history-title" title="History" description={`Authoritative Live DrawSessions for ${workspace.event.name}.`} actions={hasHistory ? <ButtonLink icon={<Icon name="Radio" />} variant="secondary" to="/draw/live">Open Draw Sessions</ButtonLink> : undefined} />
    {hasHistory ? <div className="history-filters" aria-label="History filters"><Select label="Status" aria-label="Filter by status" value={status} onChange={(event) => updateFilter('status', event.target.value)}><option value="all">All statuses</option>{(['draft', 'ready', 'drawing', 'pending-confirmation', 'completed', 'cancelled'] as const).map((item) => <option key={item} value={item}>{label(item)}</option>)}</Select><Select label="Mode" aria-label="Filter by mode" value={mode} onChange={(event) => updateFilter('mode', event.target.value)}><option value="all">All modes</option><option value="live">Live</option></Select></div> : null}
    {filtered.length === 0 && !hasHistory ? <Card className="history-empty-state" padding="lg"><p className="operator-eyebrow">Official history</p><div className="history-empty-state__copy"><h2>No official draws yet</h2><p>This Event does not have any persisted Live draw results yet.</p><p>Completed official draws will appear here automatically.</p></div><ButtonLink icon={<Icon name="SlidersHorizontal" />} size="lg" to="/draw/setup">Open Draw Setup</ButtonLink></Card> : filtered.length === 0 ? <Card padding="md"><h2>No official sessions</h2><p>No sessions match the selected filters.</p><ButtonLink icon={<Icon name="SlidersHorizontal" />} to="/draw/setup">Open Draw Setup</ButtonLink></Card> : <HistoryTable items={filtered} />}
  </section>
}

export function HistoryTable({ items }: { readonly items: readonly OfficialHistorySession[] }) {
  return <div className="history-table-panel"><Table aria-label="Official history sessions" caption="Official Live draw history"><thead><tr><th scope="col">Prize Category</th><th scope="col">Prize</th><th scope="col">Winners</th><th scope="col">Confirmed</th><th scope="col">Cancelled</th><th scope="col">Drawn</th><th scope="col">Completed</th><th scope="col">Mode / Status</th><th scope="col">Action</th></tr></thead><tbody>{items.map((item) => <HistoryTableRow item={item} key={item.session.id} />)}</tbody></Table></div>
}

function HistoryTableRow({ item }: { readonly item: OfficialHistorySession }) {
  const { session, category, records } = item
  const pending = records.filter((record) => record.winner.status === 'pending').length
  const confirmed = records.filter((record) => record.winner.status === 'confirmed').length
  const cancelled = records.filter((record) => record.winner.status === 'cancelled').length
  const action = session.status === 'pending-confirmation' ? <ButtonLink className="history-table__action" icon={<Icon name="ClipboardCheck" />} size="sm" to={`/draw/pending/${session.id}`}>Review pending</ButtonLink> : session.status === 'completed' || session.status === 'cancelled' ? <ButtonLink className="history-table__action" icon={<Icon name="ArrowRight" />} size="sm" to={`/history/${session.id}`} variant="secondary">View Details</ButtonLink> : <ButtonLink className="history-table__action" icon={<Icon name="Radio" />} size="sm" to="/draw/live" variant="secondary">Open sessions</ButtonLink>
  const categoryName = session.configurationSnapshot?.categoryName ?? category?.name ?? 'Prize category unavailable'
  const prizeName = session.configurationSnapshot?.prizeName ?? category?.prizeName ?? 'Related prize unavailable'
  return <tr className="history-table__row"><td><span className="history-table__secondary">{categoryName}</span><small className="history-table__event">{item.event.name}</small></td><th scope="row" className="history-table__prize"><strong>{prizeName}</strong></th><td><strong className="history-table__count">{records.length}</strong>{pending > 0 ? <Badge variant="pending">{pending} pending</Badge> : null}</td><td><Badge variant="confirmed">{confirmed}</Badge></td><td><Badge variant="danger">{cancelled}</Badge></td><td className="history-table__date">{timestamp(session.createdAt)}</td><td className="history-table__date">{timestamp(session.completedAt)}</td><td><div className="history-table__status"><Badge variant={session.mode === 'live' ? 'live' : 'practice'}>{label(session.mode)}</Badge><Badge variant={statusVariant(session.status)}><SessionStatusIcon status={session.status} />{label(session.status)}</Badge></div></td><td className="history-table__action-cell">{action}</td></tr>
}

export function HistoryDetail({ item }: { readonly item: OfficialHistorySession }) {
  return <Card className="history-detail" id={`history-details-${item.session.id}`} padding="none"><div className="history-detail__audit-heading"><ButtonLink icon={<Icon name="ArrowLeft" />} to="/history" variant="quiet">Back to History</ButtonLink><p>Official result details · append-only evidence</p><h2>Winner records</h2></div><div className="history-detail__winner-records"><div className="history-detail__table-scroll"><Table caption="Official WinnerRecords"><thead><tr><th>Ticket</th><th>Status</th><th>Confirmed</th><th>Cancelled</th><th>Audit / lineage</th><th>Actor</th></tr></thead><tbody>{item.records.length === 0 ? <tr><td colSpan={6}>No WinnerRecords are associated with this session.</td></tr> : item.records.map((record) => <tr key={record.winner.id}><td><code className="result-ticket">{record.winner.ticketNumber}</code></td><td><Badge variant={winnerVariant(record.winner.status)}><Icon name={winnerStatusIcon(record.winner.status)} size={16} />{label(record.winner.status)}</Badge></td><td>{timestamp(record.winner.confirmedAt, true)}</td><td>{timestamp(record.winner.cancelledAt, true)}</td><td>{auditSummary(record)}</td><td>{record.actor}</td></tr>)}</tbody></Table></div><p className="history-detail__note">Original WinnerRecords remain visible even when cancelled. Exact ticket strings and redraw lineage are retained.</p></div>{item.session.status === 'pending-confirmation' ? <p><ButtonLink icon={<Icon name="ClipboardCheck" />} to={`/draw/pending/${item.session.id}`}>Review pending results</ButtonLink></p> : null}</Card>
}

function auditSummary(record: OfficialHistorySession['records'][number]): ReactNode {
  const detail = record.cancellation?.detail
  const reason = detail !== null && detail !== undefined && typeof detail === 'object' && 'reason' in detail ? String(detail.reason) : null
  const note = detail !== null && detail !== undefined && typeof detail === 'object' && 'normalizedNote' in detail ? String(detail.normalizedNote) : null
  if (record.redraw === null && reason === null) return <>Original selection retained</>
  return <>{reason === null ? null : <>Cancellation: {reason}{note === null ? '' : ` — ${note}`}. </>}{record.redraw === null ? null : <>Redraw: {record.redraw.reason}{record.redraw.reasonNote ? ` — ${record.redraw.reasonNote}` : ''} · original <code>{record.winner.ticketNumber}</code> <Icon name="ArrowRight" size={16} /> replacement <code>{record.replacement?.ticketNumber ?? 'missing'}</code> ({record.replacement?.status ?? 'missing'})</>}</>
}
