import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  pendingResultsFixtures,
  redrawFixture,
} from '../../prototype/data/index.ts'
import type {
  PrototypePendingResultsScenario,
  PrototypeRedrawReason,
  PrototypeResultStatus,
  PrototypeWinnerRecord,
} from '../../prototype/operator-types.ts'
import {
  getPrototypePendingResultsPath,
  resolvePrototypePendingResultsQuery,
} from '../../prototype/scenario-query.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import {
  Badge,
  type BadgeVariant,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  ConfirmationDialog,
  Input,
  Select,
  SidePanel,
  Table,
  Toggle,
} from '../../shared/ui/index.ts'

type ConfirmationAction = 'selected' | 'all' | 'cancel' | null

const statusPresentation: Record<
  PrototypeResultStatus,
  { label: string; variant: BadgeVariant }
> = {
  pending: { label: 'Pending', variant: 'pending' },
  confirmed: { label: 'Confirmed', variant: 'confirmed' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  replaced: { label: 'Replaced', variant: 'info' },
}

function isPrototypeRedrawReason(
  value: string,
): value is PrototypeRedrawReason {
  return redrawFixture.reasons.some((reason) => reason === value)
}

function ResultStatus({ status }: { status: PrototypeResultStatus }) {
  const presentation = statusPresentation[status]
  return (
    <Badge variant={presentation.variant}>{presentation.label}</Badge>
  )
}

function WinnerIdentity({
  compact = false,
  winner,
}: {
  compact?: boolean
  winner: PrototypeWinnerRecord
}) {
  return (
    <div className="winner-identity" data-compact={compact || undefined}>
      <code>{winner.ticketNumber}</code>
      <span>
        <strong>{winner.participantName}</strong>
        <small>{winner.group}</small>
      </span>
    </div>
  )
}

function RedrawPanel({
  onClose,
  panel,
  scenario,
  selection,
}: ReturnType<typeof resolvePrototypePendingResultsQuery> & {
  onClose: () => void
}) {
  const [reason, setReason] =
    useState<PrototypeRedrawReason>('Participant absent')
  const originals =
    selection === 'multiple'
      ? redrawFixture.multipleOriginals
      : [redrawFixture.singleOriginal]
  const relationship = redrawFixture.relationship
  const replacementOpen = panel === 'replacement'

  return (
    <SidePanel
      description="Deterministic presentation only. No eligibility, result, or history record is changed or stored."
      footer={
        <>
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          {replacementOpen ? (
            <>
              <ButtonLink
                to={getPrototypePendingResultsPath({ scenario })}
                variant="secondary"
              >
                Return to Pending Results
              </ButtonLink>
              <ButtonLink to="/history?view=session-detail">
                Review in History
              </ButtonLink>
            </>
          ) : (
            <ButtonLink
              to={getPrototypePendingResultsPath({
                panel: 'replacement',
                scenario,
              })}
            >
              Preview replacement
            </ButtonLink>
          )}
        </>
      }
      onClose={onClose}
      open={panel !== 'summary'}
      title={
        replacementOpen
          ? 'Replacement relationship preview'
          : selection === 'multiple'
            ? 'Redraw 2 selected winners'
            : 'Redraw selected winner'
      }
    >
      {replacementOpen ? (
        <div className="replacement-preview">
          <div className="replacement-preview__record">
            <span>Cancelled original</span>
            <code>{relationship.originalTicket}</code>
            <strong>{relationship.originalParticipant}</strong>
            <Badge variant="danger">Cancelled</Badge>
          </div>
          <span aria-hidden="true" className="replacement-preview__link">
            replaced by
          </span>
          <div className="replacement-preview__record">
            <span>Predetermined replacement</span>
            <code>{relationship.replacementTicket}</code>
            <strong>{relationship.replacementParticipant}</strong>
            <Badge variant="info">Replaced</Badge>
          </div>
          <dl className="replacement-preview__detail">
            <div>
              <dt>Reason</dt>
              <dd>{relationship.reason}</dd>
            </div>
            <div>
              <dt>Relationship</dt>
              <dd>{relationship.relationshipText}</dd>
            </div>
          </dl>
          <p className="prototype-safety-copy">
            This replacement is a fixed fixture. No selection logic or redraw
            has run.
          </p>
        </div>
      ) : (
        <div className="redraw-form">
          <section aria-labelledby="selected-originals-title">
            <div className="results-panel-heading">
              <div>
                <p>Selected records</p>
                <h3 id="selected-originals-title">
                  Original winner{originals.length === 1 ? '' : 's'}
                </h3>
              </div>
              <Badge variant="neutral">
                {originals.length} selected
              </Badge>
            </div>
            <div className="redraw-originals">
              {originals.map((winner) => (
                <WinnerIdentity compact key={winner.ticketNumber} winner={winner} />
              ))}
            </div>
          </section>

          <Select
            label="Redraw reason"
            onChange={(event) => {
              if (isPrototypeRedrawReason(event.target.value)) {
                setReason(event.target.value)
              }
            }}
            value={reason}
          >
            {redrawFixture.reasons.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </Select>

          <Input
            description={
              reason === 'Other'
                ? 'Required appearance for the Other reason in this prototype.'
                : 'Optional operator context. Nothing is stored.'
            }
            label={reason === 'Other' ? 'Reason note (required)' : 'Optional note'}
            placeholder={
              reason === 'Other'
                ? 'Describe the redraw reason'
                : 'Add a presentation-only note'
            }
            required={reason === 'Other'}
          />

          <Toggle
            defaultChecked
            description="Visual preference only; the eligible pool is unchanged."
            label="Return original participant to pool"
          />

          <dl className="redraw-counts">
            <div>
              <dt>Original records</dt>
              <dd>{originals.length}</dd>
            </div>
            <div>
              <dt>Replacement count</dt>
              <dd>{originals.length}</dd>
            </div>
          </dl>

          <div className="redraw-preview-cue">
            <span aria-hidden="true">PREVIEW</span>
            <div>
              <strong>Predetermined replacement available</strong>
              <p>
                Ticket {relationship.replacementTicket} will appear only in
                the next static preview.
              </p>
            </div>
          </div>
        </div>
      )}
    </SidePanel>
  )
}

function ResultsContent({
  panel,
  scenario,
  selection,
}: ReturnType<typeof resolvePrototypePendingResultsQuery>) {
  const navigate = useNavigate()
  const fixture = pendingResultsFixtures[scenario]
  const [confirmationAction, setConfirmationAction] =
    useState<ConfirmationAction>(null)
  const [selectedTickets, setSelectedTickets] = useState<readonly string[]>(
    fixture.winners
      .filter((winner) => winner.status === 'pending')
      .slice(0, 2)
      .map((winner) => winner.ticketNumber),
  )

  function setTicketSelected(ticketNumber: string, checked: boolean) {
    setSelectedTickets((current) =>
      checked
        ? [...current.filter((ticket) => ticket !== ticketNumber), ticketNumber]
        : current.filter((ticket) => ticket !== ticketNumber),
    )
  }

  function confirmPrototypeAction() {
    const targetScenario: PrototypePendingResultsScenario =
      confirmationAction === 'all' ? 'confirmed' : 'partial'
    const target =
      confirmationAction === 'cancel'
        ? getPrototypePendingResultsPath({
            panel: 'redraw',
            scenario,
            selection: 'single',
          })
        : getPrototypePendingResultsPath({ scenario: targetScenario })

    setConfirmationAction(null)
    void navigate(target)
  }

  const selectionCount = selectedTickets.length
  const summaryItems = [
    ['Draw session', fixture.summary.drawSession],
    ['Prize', fixture.summary.prize],
    [
      'Total result records',
      String(fixture.summary.totalResultRecords),
    ],
    ['Pending', String(fixture.summary.pending)],
    ['Confirmed', String(fixture.summary.confirmed)],
    ['Cancelled', String(fixture.summary.cancelled)],
    ['Replaced', String(fixture.summary.replaced)],
    [
      'Eligible pool snapshot',
      fixture.summary.eligiblePoolSnapshot.toLocaleString('en-US'),
    ],
  ] as const

  return (
    <section
      aria-labelledby="pending-results-title"
      className="pending-results"
      data-results-panel={panel}
      data-results-scenario={scenario}
    >
      <div className="prototype-notice" role="note">
        <span aria-hidden="true">PROTO</span>
        Predetermined Operator-only records for static review. No official
        result, eligibility, or history data is changed or stored.
      </div>

      <PageHeader
        actions={
          scenario === 'confirmed' ? (
            <ButtonLink size="lg" to="/history?view=session-detail">
              Review static history
            </ButtonLink>
          ) : (
            <Button
              disabled={selectionCount === 0}
              onClick={() => setConfirmationAction('selected')}
              size="lg"
            >
              Confirm selected ({selectionCount})
            </Button>
          )
        }
        description="Nusantara Tech Gala 2026 · Grand Prize · Electric Scooter"
        eyebrow="Live context · Results under verification"
        headingId="pending-results-title"
        title="Pending Results"
      />

      <StatusBanner
        badge={`${fixture.summary.pending} pending`}
        title={
          scenario === 'pending'
            ? 'All ten result records await review'
            : scenario === 'partial'
              ? 'Mixed statuses shown from a predetermined fixture'
              : 'All records shown as confirmed prototype rows'
        }
        tone={scenario === 'confirmed' ? 'success' : 'warning'}
      >
        Visible status changes only when navigating between static query
        scenarios. No production workflow is active.
      </StatusBanner>

      <Card className="results-summary" padding="none">
        <div className="results-panel-heading">
          <div>
            <p>Session snapshot</p>
            <h2>Result summary</h2>
          </div>
          <Badge variant="live">LIVE CONTEXT · PROTOTYPE</Badge>
        </div>
        <dl>
          {summaryItems.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="results-table-panel" padding="none">
        <div className="results-panel-heading">
          <div>
            <p>Operator-only participant detail</p>
            <h2>Winner review queue</h2>
          </div>
          <div className="results-panel-heading__actions">
            <Button
              disabled={scenario === 'confirmed'}
              onClick={() => setConfirmationAction('all')}
              size="sm"
              variant="secondary"
            >
              Confirm all
            </Button>
            <ButtonLink
              size="sm"
              to={getPrototypePendingResultsPath({
                panel: 'redraw',
                scenario,
                selection: 'multiple',
              })}
              variant="secondary"
            >
              Open redraw
            </ButtonLink>
          </div>
        </div>

        <Table caption={`Prototype winner records for ${scenario} scenario`}>
          <thead>
            <tr>
              <th scope="col">Select</th>
              <th scope="col">Ticket Number</th>
              <th scope="col">Participant</th>
              <th scope="col">Group</th>
              <th scope="col">Check-in</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fixture.winners.map((winner) => {
              const selectable = winner.status === 'pending'
              return (
                <tr
                  data-result-status={winner.status}
                  key={winner.ticketNumber}
                >
                  <td>
                    <Checkbox
                      checked={selectedTickets.includes(winner.ticketNumber)}
                      disabled={!selectable}
                      label={
                        <span className="sr-only">
                          Select ticket {winner.ticketNumber}
                        </span>
                      }
                      onChange={(event) =>
                        setTicketSelected(
                          winner.ticketNumber,
                          event.target.checked,
                        )
                      }
                    />
                  </td>
                  <td>
                    <code className="result-ticket">
                      {winner.ticketNumber}
                    </code>
                  </td>
                  <td>{winner.participantName}</td>
                  <td>{winner.group}</td>
                  <td>{winner.checkIn}</td>
                  <td>
                    <ResultStatus status={winner.status} />
                    {winner.replacementTicket === undefined ? null : (
                      <small className="replacement-inline">
                        Replaced by {winner.replacementTicket}
                      </small>
                    )}
                  </td>
                  <td>
                    {selectable ? (
                      <Button
                        onClick={() => setConfirmationAction('cancel')}
                        size="sm"
                        variant="quiet"
                      >
                        Cancel winner
                      </Button>
                    ) : (
                      <span className="row-action-static">No action</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>

      <div className="results-action-bar">
        <div>
          <strong>{selectionCount} visual selections</strong>
          <span>Fixture records remain frozen and unchanged.</span>
        </div>
        <div>
          <ButtonLink to="/draw/live?state=running&mode=live&stage=rolling" variant="secondary">
            Return to Live Draw
          </ButtonLink>
          <Button
            disabled={scenario === 'confirmed' || selectionCount === 0}
            onClick={() => setConfirmationAction('selected')}
          >
            Confirm selected
          </Button>
        </div>
      </div>

      <ConfirmationDialog
        confirmLabel={
          confirmationAction === 'all'
            ? 'Show confirmed scenario'
            : confirmationAction === 'cancel'
              ? 'Open redraw prototype'
              : 'Show partial scenario'
        }
        consequence="This only changes the visible prototype scenario. No official result, eligibility, or history is changed, and no data is stored."
        onCancel={() => setConfirmationAction(null)}
        onConfirm={confirmPrototypeAction}
        open={confirmationAction !== null}
        title={
          confirmationAction === 'all'
            ? 'Confirm all winners?'
            : confirmationAction === 'cancel'
              ? 'Cancel this winner?'
              : 'Confirm selected winners?'
        }
        tone={confirmationAction === 'cancel' ? 'danger' : 'warning'}
      />

      <RedrawPanel
        onClose={() =>
          void navigate(getPrototypePendingResultsPath({ scenario }))
        }
        panel={panel}
        scenario={scenario}
        selection={selection}
      />
    </section>
  )
}

export function PendingResultsPage() {
  const [searchParams] = useSearchParams()
  const query = resolvePrototypePendingResultsQuery(searchParams)

  return <ResultsContent key={query.scenario} {...query} />
}
