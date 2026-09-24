import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { liveDrawFixture } from '../../prototype/data/index.ts'
import type {
  PrototypeDrawMode,
  PrototypeSystemCheck,
} from '../../prototype/operator-types.ts'
import {
  getPrototypeLiveDrawPath,
  resolvePrototypeLiveDrawQuery,
} from '../../prototype/scenario-query.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { SummaryList } from '../../shared/components/SummaryList.tsx'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ConfirmationDialog,
} from '../../shared/ui/index.ts'
import { AudiencePreview } from '../../ui/operator/draw/AudiencePreview.tsx'

const numberFormatter = new Intl.NumberFormat('en-US')

const checkLabels: Record<PrototypeSystemCheck['status'], string> = {
  ready: 'Ready',
  warning: 'Warning',
  blocked: 'Blocked',
}

function modeLabel(mode: PrototypeDrawMode) {
  return mode === 'live' ? 'Live Mode' : 'Practice Mode'
}

function LockedConfiguration() {
  const { configuration, eligibility, presentation } = liveDrawFixture

  return (
    <Card className="locked-configuration" padding="none">
      <div className="locked-configuration__heading">
        <div>
          <p>LOCKED APPEARANCE</p>
          <h2>Configuration summary</h2>
        </div>
        <Badge variant="neutral">Static values</Badge>
      </div>
      <SummaryList
        items={[
          { label: 'Category', value: configuration.category },
          { label: 'Prize', value: configuration.prizeName },
          {
            label: 'Eligible pool',
            value: `${numberFormatter.format(
              eligibility.eligibleParticipants,
            )} tickets`,
          },
          {
            label: 'Presentation',
            value: `${presentation.countdownSeconds}s countdown · ${presentation.rollingSeconds}s rolling`,
          },
        ]}
      />
    </Card>
  )
}

function SystemChecks() {
  return (
    <ul className="system-check-list">
      {liveDrawFixture.systemChecks.map((check) => (
        <li data-status={check.status} key={check.label}>
          <span aria-hidden="true" className="system-check-list__marker" />
          <span>
            <strong>{check.label}</strong>
            <small>{check.detail}</small>
          </span>
          <b>{checkLabels[check.status]}</b>
        </li>
      ))}
    </ul>
  )
}

function LiveReadyState({ mode }: { mode: PrototypeDrawMode }) {
  const navigate = useNavigate()
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const { configuration, eligibility, presentation } = liveDrawFixture

  function confirmPrototypeStart() {
    setConfirmationOpen(false)
    void navigate(
      getPrototypeLiveDrawPath({
        mode,
        stage: 'countdown',
        state: 'running',
      }),
    )
  }

  return (
    <>
      <StatusBanner
        badge={mode === 'live' ? 'LIVE FLOW WARNING' : 'REHEARSAL ONLY'}
        title={
          mode === 'live'
            ? 'This represents a live-event start flow'
            : 'Practice results would be rehearsal-only'
        }
        tone={mode === 'live' ? 'warning' : 'info'}
      >
        {mode === 'live'
          ? 'The confirmation advances to a deterministic prototype screen. It does not start an actual draw or create an official result.'
          : 'Nothing here changes Live eligibility or official history. The confirmation advances only between static prototype states.'}
      </StatusBanner>

      <div className="live-ready__layout">
        <div className="live-ready__main">
          <Card className="live-panel" padding="none">
            <div className="live-panel__heading">
              <div>
                <p>Configuration recap</p>
                <h2>Grand Prize control deck</h2>
              </div>
              <Badge variant={mode}>{modeLabel(mode)}</Badge>
            </div>
            <div className="live-panel__body">
              <SummaryList
                items={[
                  { label: 'Category', value: configuration.category },
                  { label: 'Prize', value: configuration.prizeName },
                  {
                    label: 'Winner count',
                    value: `${configuration.winnerCount} winner`,
                  },
                  {
                    label: 'Eligible pool',
                    value: `${numberFormatter.format(
                      eligibility.eligibleParticipants,
                    )} tickets`,
                  },
                  {
                    label: 'Winning rule',
                    value: configuration.winningFrequencyLabel,
                  },
                  {
                    label: 'Presentation',
                    value: `${presentation.countdownSeconds}s countdown · ${presentation.rollingSeconds}s rolling`,
                  },
                ]}
              />
            </div>
          </Card>

          <Card className="live-panel" padding="none">
            <div className="live-panel__heading">
              <div>
                <p>Preflight</p>
                <h2>System readiness</h2>
              </div>
              <Badge variant="warning">2 prototype warnings</Badge>
            </div>
            <SystemChecks />
          </Card>
        </div>

        <aside className="live-ready__aside">
          <AudiencePreview preview={liveDrawFixture.audiencePreviews.ready} />
          <Card
            className="start-control"
            padding="md"
            tone={mode === 'live' ? 'warning' : 'accent'}
          >
            <span className="start-control__mode">{modeLabel(mode)}</span>
            <h2>Operator start gate</h2>
            <p>
              Visual hold-style control only. No hold duration is measured.
            </p>
            <Button
              className="start-control__button"
              onClick={() => setConfirmationOpen(true)}
              size="lg"
              variant={mode === 'live' ? 'danger' : 'primary'}
            >
              Hold to start draw
            </Button>
            <small>Click opens a confirmation dialog.</small>
          </Card>
        </aside>
      </div>

      <ConfirmationDialog
        confirmLabel="Show countdown prototype"
        consequence={
          <>
            No random selection will occur. This advances only to a
            deterministic prototype countdown state and creates no result.
          </>
        }
        onCancel={() => setConfirmationOpen(false)}
        onConfirm={confirmPrototypeStart}
        open={confirmationOpen}
        title={`Advance ${modeLabel(mode)} prototype?`}
        tone={mode === 'live' ? 'danger' : 'warning'}
      />
    </>
  )
}

function CountdownState({ mode }: { mode: PrototypeDrawMode }) {
  return (
    <div className="live-running__layout">
      <div className="live-running__stage">
        <Card className="countdown-control" padding="lg">
          <div className="countdown-control__topline">
            <Badge variant={mode}>{modeLabel(mode)}</Badge>
            <span>STATIC COUNTDOWN</span>
          </div>
          <p>Grand Prize · Electric Scooter</p>
          <strong aria-label="Static countdown value 3">
            {liveDrawFixture.staticCountdownValue}
          </strong>
          <p className="countdown-control__notice">
            No timer is running. This value will not change automatically.
          </p>
        </Card>
        <AudiencePreview
          preview={liveDrawFixture.audiencePreviews.countdown}
        />
      </div>
      <aside className="live-running__controls">
        <LockedConfiguration />
        <Card className="running-actions" padding="sm">
          <h2>Prototype controls</h2>
          <ButtonLink
            size="lg"
            to={getPrototypeLiveDrawPath({
              mode,
              stage: 'rolling',
              state: 'running',
            })}
          >
            Show rolling state
          </ButtonLink>
          <ButtonLink
            to={getPrototypeLiveDrawPath({
              mode,
              stage: 'countdown',
              state: 'ready',
            })}
            variant="danger"
          >
            Abort prototype
          </ButtonLink>
          <ButtonLink
            to={getPrototypeLiveDrawPath({
              mode,
              stage: 'countdown',
              state: 'ready',
            })}
            variant="secondary"
          >
            Return to ready state
          </ButtonLink>
        </Card>
      </aside>
    </div>
  )
}

function RollingState({ mode }: { mode: PrototypeDrawMode }) {
  return (
    <div className="live-running__layout">
      <div className="live-running__stage">
        <Card className="rolling-control" padding="lg">
          <div className="rolling-control__topline">
            <Badge variant={mode}>{modeLabel(mode)}</Badge>
            <span>STATIC TICKET STREAM</span>
          </div>
          <p>Presentational examples only</p>
          <div
            aria-label="Static ticket stream"
            className="rolling-ticket-stream"
          >
            {liveDrawFixture.ticketStream.map((ticket) => (
              <code key={ticket}>{ticket}</code>
            ))}
          </div>
          <p className="rolling-control__notice">
            Movement is not running. These strings are not candidates and do
            not imply eligibility, selection, or randomness.
          </p>
        </Card>
        <AudiencePreview preview={liveDrawFixture.audiencePreviews.rolling} />
      </div>
      <aside className="live-running__controls">
        <LockedConfiguration />
        <Card className="running-actions" padding="sm">
          <h2>Prototype controls</h2>
          <ButtonLink
            to={getPrototypeLiveDrawPath({
              mode,
              stage: 'countdown',
              state: 'running',
            })}
            variant="secondary"
          >
            Return to countdown
          </ButtonLink>
          <ButtonLink size="lg" to="/dev/prototypes/draw/results">
            Review Pending Results
          </ButtonLink>
          <p>No winner has been selected or declared.</p>
        </Card>
      </aside>
    </div>
  )
}

export function LiveDrawPage() {
  const [searchParams] = useSearchParams()
  const query = resolvePrototypeLiveDrawQuery(searchParams)
  const running = query.state === 'running'

  return (
    <section
      aria-labelledby="live-draw-title"
      className="live-draw"
      data-draw-mode={query.mode}
      data-live-stage={query.stage}
      data-live-state={query.state}
    >
      <div className="prototype-notice" role="note">
        <span aria-hidden="true">PROTO</span>
        Deterministic control-room prototype. No draw, timer, result, or
        Audience communication is active.
      </div>
      <PageHeader
        actions={
          <div className="live-state-marker">
            <Badge variant={query.mode}>{modeLabel(query.mode)}</Badge>
            <Badge variant={running ? 'warning' : 'success'}>
              {running ? `${query.stage} prototype` : 'ready for review'}
            </Badge>
          </div>
        }
        description={`${liveDrawFixture.configuration.eventName} · ${liveDrawFixture.configuration.category} · ${liveDrawFixture.configuration.prizeName}`}
        eyebrow={running ? 'Running-state prototype' : 'Pre-draw review'}
        headingId="live-draw-title"
        title="Live Draw"
      />

      {running ? (
        <>
          <div className="running-mode-warning" data-mode={query.mode}>
            <strong>{modeLabel(query.mode)} · Prototype state active</strong>
            <span>
              Configuration appears locked, but no production workflow is
              running.
            </span>
          </div>
          {query.stage === 'rolling' ? (
            <RollingState mode={query.mode} />
          ) : (
            <CountdownState mode={query.mode} />
          )}
        </>
      ) : (
        <LiveReadyState mode={query.mode} />
      )}
    </section>
  )
}
