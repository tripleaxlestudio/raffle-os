import { Link, useSearchParams } from 'react-router'
import { historyFixture } from '../../prototype/data/index.ts'
import type {
  PrototypeHistoryView,
  PrototypeResultStatus,
} from '../../prototype/operator-types.ts'
import { resolvePrototypeHistoryView } from '../../prototype/scenario-query.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { SummaryList } from '../../shared/components/SummaryList.tsx'
import {
  Badge,
  type BadgeVariant,
  Button,
  ButtonLink,
  Card,
  Table,
} from '../../shared/ui/index.ts'

const historyViews = [
  { label: 'Draw Sessions', value: 'sessions' },
  { label: 'All Winners', value: 'winners' },
  { label: 'Audit Log', value: 'audit' },
] as const

const winnerStatusVariants: Record<PrototypeResultStatus, BadgeVariant> = {
  pending: 'pending',
  confirmed: 'confirmed',
  cancelled: 'danger',
  replaced: 'info',
}

function HistoryTabs({ view }: { view: PrototypeHistoryView }) {
  const selectedView = view === 'session-detail' ? 'sessions' : view

  return (
    <nav aria-label="History views" className="history-tabs">
      <div role="tablist">
        {historyViews.map((item) => (
          <Link
            aria-selected={selectedView === item.value}
            className={
              selectedView === item.value
                ? 'history-tab history-tab--active'
                : 'history-tab'
            }
            key={item.value}
            role="tab"
            to={`/history?view=${item.value}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <span>Static timestamps · Fictional records</span>
    </nav>
  )
}

function SessionsView() {
  return (
    <Card className="history-panel" padding="none">
      <div className="results-panel-heading">
        <div>
          <p>Session index</p>
          <h2>Draw Sessions</h2>
        </div>
        <Badge variant="neutral">{historyFixture.sessions.length} fixtures</Badge>
      </div>
      <Table caption="Prototype draw sessions">
        <thead>
          <tr>
            <th scope="col">Date &amp; Time</th>
            <th scope="col">Category</th>
            <th scope="col">Prize</th>
            <th scope="col">Mode</th>
            <th scope="col">Winners</th>
            <th scope="col">Status</th>
            <th scope="col">Operator</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {historyFixture.sessions.map((session) => (
            <tr key={session.id}>
              <td>
                <time>{session.dateTime}</time>
                <small className="history-record-id">{session.id}</small>
              </td>
              <td>{session.category}</td>
              <td>{session.prize}</td>
              <td>
                <Badge
                  variant={session.mode === 'Live' ? 'live' : 'practice'}
                >
                  {session.mode}
                </Badge>
              </td>
              <td>{session.winnerCount}</td>
              <td>{session.status}</td>
              <td>{session.operator}</td>
              <td>
                <ButtonLink
                  size="sm"
                  to="/history?view=session-detail"
                  variant="quiet"
                >
                  Open detail
                </ButtonLink>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}

function WinnersView() {
  return (
    <Card className="history-panel" padding="none">
      <div className="results-panel-heading">
        <div>
          <p>Cross-session index</p>
          <h2>All Winners</h2>
        </div>
        <Badge variant="neutral">Operator-only details</Badge>
      </div>
      <Table caption="Prototype winner history">
        <thead>
          <tr>
            <th scope="col">Ticket Number</th>
            <th scope="col">Participant</th>
            <th scope="col">Category</th>
            <th scope="col">Prize</th>
            <th scope="col">Status</th>
            <th scope="col">Replacement relationship</th>
          </tr>
        </thead>
        <tbody>
          {historyFixture.winners.map((winner) => (
            <tr data-result-status={winner.status} key={winner.ticketNumber}>
              <td>
                <code className="result-ticket">{winner.ticketNumber}</code>
              </td>
              <td>{winner.participantName}</td>
              <td>Grand Prize</td>
              <td>Electric Scooter</td>
              <td>
                <Badge variant={winnerStatusVariants[winner.status]}>
                  {winner.status[0]?.toUpperCase()}
                  {winner.status.slice(1)}
                </Badge>
              </td>
              <td>
                {winner.replacementTicket === undefined ? (
                  <span className="row-action-static">No replacement</span>
                ) : (
                  <span className="history-relationship">
                    <code>{winner.ticketNumber}</code>
                    <span>cancelled → replaced by</span>
                    <code>{winner.replacementTicket}</code>
                  </span>
                )}
                {winner.status === 'replaced' ? (
                  <span className="history-relationship">
                    <code>004216</code>
                    <span>original → replacement</span>
                    <code>{winner.ticketNumber}</code>
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}

function AuditView() {
  return (
    <Card className="history-panel" padding="none">
      <div className="results-panel-heading">
        <div>
          <p>Chronological presentation</p>
          <h2>Audit Log</h2>
        </div>
        <Badge variant="warning">Not persisted</Badge>
      </div>
      <ol className="audit-timeline">
        {historyFixture.auditEntries.map((entry, index) => (
          <li key={`${entry.timestamp}-${entry.action}`}>
            <span aria-hidden="true" className="audit-timeline__index">
              {String(index + 1).padStart(2, '0')}
            </span>
            <time>{entry.timestamp}</time>
            <div>
              <strong>{entry.action}</strong>
              <p>{entry.detail}</p>
            </div>
            <small>{entry.actor}</small>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function SessionDetailView() {
  const detail = historyFixture.sessionDetail
  const relationship = detail.relationship

  return (
    <div className="history-detail">
      <div className="history-detail__toolbar">
        <ButtonLink to="/history?view=sessions" variant="secondary">
          Back to Draw Sessions
        </ButtonLink>
        <div>
          <Button disabled variant="secondary">
            Export CSV · Prototype only
          </Button>
          <Button disabled variant="secondary">
            Export XLSX · Prototype only
          </Button>
        </div>
      </div>

      <Card className="history-detail__summary" padding="none">
        <div className="results-panel-heading">
          <div>
            <p>{detail.session.id}</p>
            <h2>{detail.session.prize}</h2>
          </div>
          <Badge variant="live">Live fixture</Badge>
        </div>
        <div className="history-detail__summary-grid">
          <SummaryList
            items={[
              { label: 'Date & time', value: detail.session.dateTime },
              { label: 'Category', value: detail.session.category },
              { label: 'Operator', value: detail.session.operator },
              { label: 'Status', value: detail.session.status },
            ]}
          />
          <div className="pool-snapshot">
            <span>Eligible pool snapshot</span>
            <strong>{detail.eligiblePoolSnapshot.toLocaleString('en-US')}</strong>
            <small>Predetermined prototype count</small>
          </div>
        </div>
      </Card>

      <div className="history-detail__grid">
        <Card padding="none">
          <div className="results-panel-heading">
            <div>
              <p>Frozen configuration</p>
              <h2>Configuration summary</h2>
            </div>
          </div>
          <SummaryList items={detail.configuration} />
        </Card>
        <Card padding="none">
          <div className="results-panel-heading">
            <div>
              <p>Original result retained</p>
              <h2>Cancellation &amp; replacement</h2>
            </div>
          </div>
          <div className="history-linkage">
            <div>
              <span>Cancelled</span>
              <code>{relationship.originalTicket}</code>
              <strong>{relationship.originalParticipant}</strong>
            </div>
            <span>linked to</span>
            <div>
              <span>Replacement</span>
              <code>{relationship.replacementTicket}</code>
              <strong>{relationship.replacementParticipant}</strong>
            </div>
            <p>
              Reason: <strong>{relationship.reason}</strong>
            </p>
          </div>
        </Card>
      </div>

      <Card className="history-original-results" padding="none">
        <div className="results-panel-heading">
          <div>
            <p>Session result records</p>
            <h2>Original results</h2>
          </div>
          <Badge variant="neutral">4 representative rows</Badge>
        </div>
        <Table caption="Representative original result records">
          <thead>
            <tr>
              <th scope="col">Ticket Number</th>
              <th scope="col">Participant</th>
              <th scope="col">Status</th>
              <th scope="col">Relationship</th>
            </tr>
          </thead>
          <tbody>
            {historyFixture.winners.map((winner) => (
              <tr key={winner.ticketNumber}>
                <td><code className="result-ticket">{winner.ticketNumber}</code></td>
                <td>{winner.participantName}</td>
                <td>{winner.status}</td>
                <td>
                  {winner.replacementTicket === undefined
                    ? 'Original result'
                    : `Replacement: ${winner.replacementTicket}`}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

export function HistoryPage() {
  const [searchParams] = useSearchParams()
  const view = resolvePrototypeHistoryView(searchParams)

  return (
    <section
      aria-labelledby="history-title"
      className="history-page"
      data-history-view={view}
    >
      <div className="prototype-notice" role="note">
        <span aria-hidden="true">PROTO</span>
        Fictional, deterministic history presentation. No record is official,
        persisted, exported, created, changed, or deleted.
      </div>
      <PageHeader
        actions={
          <Button disabled size="lg" variant="secondary">
            Export disabled · Prototype only
          </Button>
        }
        description="Review static session, winner, and audit relationships without modifying official data."
        eyebrow="Operator records"
        headingId="history-title"
        title="History"
      />
      <HistoryTabs view={view} />
      {view === 'sessions' ? <SessionsView /> : null}
      {view === 'winners' ? <WinnersView /> : null}
      {view === 'audit' ? <AuditView /> : null}
      {view === 'session-detail' ? <SessionDetailView /> : null}
    </section>
  )
}
