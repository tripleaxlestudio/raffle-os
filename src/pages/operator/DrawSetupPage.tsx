import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { drawSetupFixtures } from '../../prototype/data/index.ts'
import type {
  PrototypeDrawMode,
  PrototypeWinningFrequency,
} from '../../prototype/operator-types.ts'
import {
  getPrototypeDrawSetupPath,
  resolvePrototypeDrawSetupQuery,
} from '../../prototype/scenario-query.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Input,
  SegmentedControl,
  Select,
  Toggle,
} from '../../shared/ui/index.ts'
import { AudiencePreview } from '../../ui/operator/draw/AudiencePreview.tsx'

const winnerCountOptions = ['1', '3', '6', '10', '20', '50'].map(
  (value) => ({ label: value, value }),
)

const winningFrequencyOptions = [
  { label: 'Once per event', value: 'event' },
  { label: 'Once per category', value: 'category' },
  { label: 'Unlimited', value: 'unlimited' },
] as const

const numberFormatter = new Intl.NumberFormat('en-US')

function formatCount(value: number) {
  return numberFormatter.format(value)
}

function isPrototypeWinningFrequency(
  value: string,
): value is PrototypeWinningFrequency {
  return (
    value === 'event' ||
    value === 'category' ||
    value === 'unlimited'
  )
}

function ModeContext({ mode }: { mode: PrototypeDrawMode }) {
  return (
    <div className="draw-mode-context">
      <Badge variant={mode}>{mode === 'live' ? 'LIVE FLOW' : 'PRACTICE'}</Badge>
      <span>
        {mode === 'live'
          ? 'Live-event review context'
          : 'Rehearsal-only review context'}
      </span>
    </div>
  )
}

function PanelHeading({
  eyebrow,
  title,
}: {
  eyebrow: string
  title: string
}) {
  return (
    <div className="draw-panel__heading">
      <p>{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  )
}

export function DrawSetupPage() {
  const [searchParams] = useSearchParams()
  const query = resolvePrototypeDrawSetupQuery(searchParams)

  return (
    <DrawSetupContent
      key={`${query.mode}-${query.scenario}`}
      mode={query.mode}
      scenario={query.scenario}
    />
  )
}

function DrawSetupContent({
  mode,
  scenario,
}: ReturnType<typeof resolvePrototypeDrawSetupQuery>) {
  const fixture = drawSetupFixtures[scenario]
  const [winnerCount, setWinnerCount] = useState(
    String(fixture.configuration.winnerCount),
  )
  const [winningFrequency, setWinningFrequency] =
    useState<PrototypeWinningFrequency>(
      fixture.configuration.winningFrequency,
    )
  const requestedWinnerCount =
    Number.parseInt(winnerCount, 10) || fixture.eligibility.requestedWinners
  const alternateMode: PrototypeDrawMode =
    mode === 'practice' ? 'live' : 'practice'
  const liveDrawReadyPath = `/draw/live?state=ready&mode=${mode}`

  return (
    <section
      aria-labelledby="draw-setup-title"
      className="draw-setup"
      data-draw-mode={mode}
      data-setup-scenario={scenario}
    >
      <div className="prototype-notice" role="note">
        <span aria-hidden="true">PROTO</span>
        Fictional setup data only. Nothing on this page is saved, filtered,
        validated, or made official.
      </div>

      <PageHeader
        actions={<ModeContext mode={mode} />}
        description={`${fixture.configuration.eventName} · ${fixture.configuration.category}`}
        eyebrow="Draw configuration"
        headingId="draw-setup-title"
        title="Draw Setup"
      />

      {scenario === 'insufficient' ? (
        <StatusBanner
          badge="Proceeding blocked"
          title="Requested winners exceed the eligible participant pool."
          tone="warning"
        >
          This deterministic scenario requests 20 winners from a static pool
          of 12. Change the prototype scenario to review a sufficient setup.
        </StatusBanner>
      ) : (
        <StatusBanner
          badge="Pool appears sufficient"
          title="Static configuration is ready for operator review"
          tone="success"
        >
          The displayed totals are frozen prototype values. No production
          eligibility engine has verified them.
        </StatusBanner>
      )}

      <div className="draw-setup__layout">
        <div className="draw-setup__main">
          <Card className="draw-panel" padding="none">
            <PanelHeading eyebrow="01 · Identity" title="Draw identity" />
            <div className="draw-panel__body draw-field-grid">
              <Select
                defaultValue={fixture.configuration.category}
                description="Prototype category selection only."
                label="Category"
              >
                <option>Grand Prize</option>
                <option>Door Prize</option>
                <option>Early Bird Prize</option>
              </Select>
              <Input
                defaultValue={fixture.configuration.prizeName}
                description="Editing this field does not save data."
                label="Prize name"
              />
              <Input
                containerClassName="draw-field-grid__wide"
                defaultValue={fixture.configuration.internalNote}
                description="Operator-only fictional note. It is never shown in the preview."
                label="Optional internal note"
              />
            </div>
          </Card>

          <Card className="draw-panel" padding="none">
            <PanelHeading eyebrow="02 · Quantity" title="Winner count" />
            <div className="draw-panel__body">
              <SegmentedControl
                label="Winner count presets"
                onChange={setWinnerCount}
                options={winnerCountOptions}
                value={winnerCount}
              />
              <div className="winner-count-detail">
                <Input
                  inputMode="numeric"
                  label="Custom winner count"
                  min="1"
                  onChange={(event) => setWinnerCount(event.target.value)}
                  type="number"
                  value={winnerCount}
                />
                <div aria-live="polite" className="winner-count-current">
                  <span>Currently selected</span>
                  <strong>{winnerCount || '—'}</strong>
                  <span>winner slots</span>
                </div>
              </div>
              <p className="draw-panel__note">
                Winner count is a visual prototype setting and is not
                validated by a production draw engine.
              </p>
            </div>
          </Card>

          <Card className="draw-panel" padding="none">
            <PanelHeading
              eyebrow="03 · Pool rules"
              title="Eligibility rules"
            />
            <div className="draw-panel__body">
              <div className="eligibility-control-grid">
                <Checkbox
                  defaultChecked
                  description="Visual rule only; no participant data is filtered."
                  label="Checked-in participants only"
                />
                <Checkbox
                  defaultChecked
                  description="Static previous-winner total remains unchanged."
                  label="Exclude previous winners"
                />
                <Select
                  defaultValue={fixture.eligibility.participantGroup}
                  description="Selecting a group does not alter the pool."
                  label="Participant group"
                >
                  <option>All checked-in participants</option>
                  <option>VIP finalists</option>
                  <option>General admission</option>
                </Select>
              </div>
              <div className="winning-frequency">
                <span className="winning-frequency__label">
                  Winning frequency
                </span>
                <SegmentedControl
                  label="Winning frequency"
                  onChange={(value) => {
                    if (isPrototypeWinningFrequency(value)) {
                      setWinningFrequency(value)
                    }
                  }}
                  options={winningFrequencyOptions}
                  value={winningFrequency}
                />
              </div>
              <p className="draw-panel__note">
                These controls do not calculate or filter real participant
                eligibility.
              </p>
            </div>
          </Card>

          <Card
            className="draw-panel"
            padding="none"
            tone={scenario === 'insufficient' ? 'warning' : 'default'}
          >
            <PanelHeading
              eyebrow="04 · Capacity"
              title="Eligible pool summary"
            />
            <div className="draw-panel__body">
              <dl
                aria-label="Eligible pool summary"
                className="eligible-pool-metrics"
              >
                <div>
                  <dt>Total participants</dt>
                  <dd>{formatCount(fixture.eligibility.totalParticipants)}</dd>
                </div>
                <div>
                  <dt>Checked-in participants</dt>
                  <dd>
                    {formatCount(
                      fixture.eligibility.checkedInParticipants,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Previous winners excluded</dt>
                  <dd>
                    {formatCount(
                      fixture.eligibility.excludedPreviousWinners,
                    )}
                  </dd>
                </div>
                <div className="eligible-pool-metrics__highlight">
                  <dt>Eligible pool</dt>
                  <dd>
                    {formatCount(
                      fixture.eligibility.eligibleParticipants,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Requested winners</dt>
                  <dd>{formatCount(requestedWinnerCount)}</dd>
                </div>
              </dl>
              {scenario === 'insufficient' ? (
                <div className="pool-warning" role="alert">
                  <span aria-hidden="true">!</span>
                  <div>
                    <strong>
                      Requested winners exceed the eligible participant pool.
                    </strong>
                    <p>
                      20 requested winners cannot proceed against the static
                      pool of 12 eligible participants.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="pool-ready">
                  <span aria-hidden="true">✓</span>
                  Sufficient static capacity: 3,814 eligible tickets for 1
                  requested winner.
                </p>
              )}
            </div>
          </Card>

          <Card className="draw-panel" padding="none">
            <PanelHeading
              eyebrow="05 · Presentation"
              title="Presentation sequence"
            />
            <div className="draw-panel__body presentation-grid">
              <Toggle
                defaultChecked={fixture.presentation.countdownEnabled}
                description={`${fixture.presentation.countdownSeconds} seconds · visual setting only`}
                label="Countdown enabled"
              />
              <Select
                defaultValue={String(
                  fixture.presentation.countdownSeconds,
                )}
                label="Countdown duration"
              >
                <option value="3">3 seconds</option>
                <option value="5">5 seconds</option>
                <option value="10">10 seconds</option>
              </Select>
              <Select
                defaultValue={String(fixture.presentation.rollingSeconds)}
                label="Rolling duration"
              >
                <option value="5">5 seconds</option>
                <option value="8">8 seconds</option>
                <option value="12">12 seconds</option>
              </Select>
              <Select
                defaultValue={fixture.presentation.revealStyle}
                label="Reveal style"
              >
                <option>Spotlight reveal</option>
                <option>Clean cut</option>
              </Select>
              <Select
                defaultValue={fixture.presentation.celebrationEffect}
                label="Celebration effect"
              >
                <option>Confetti burst (visual only)</option>
                <option>None</option>
              </Select>
              <Select
                defaultValue={fixture.presentation.audioCue}
                label="Audio cue"
              >
                <option>Grand reveal cue (silent prototype)</option>
                <option>No audio cue</option>
              </Select>
              <Toggle
                defaultChecked={fixture.presentation.reducedMotionSafe}
                description="Static safe-presentation preference."
                label="Reduced-motion safe presentation"
              />
              <p className="draw-panel__note presentation-grid__wide">
                No timer, rolling animation, celebration effect, or audio
                playback is implemented.
              </p>
            </div>
          </Card>
        </div>

        <aside className="draw-setup__aside">
          <AudiencePreview preview={fixture.audiencePreview} />
          <Card className="draw-mode-switch" padding="sm">
            <span>Review another mode</span>
            <strong>
              Current: {mode === 'live' ? 'Live flow' : 'Practice rehearsal'}
            </strong>
            <ButtonLink
              size="sm"
              to={getPrototypeDrawSetupPath({
                mode: alternateMode,
                scenario,
              })}
              variant="secondary"
            >
              Switch to {alternateMode === 'live' ? 'Live' : 'Practice'}
            </ButtonLink>
          </Card>
        </aside>
      </div>

      <div className="draw-action-bar">
        <div>
          <strong>
            {scenario === 'ready'
              ? 'Ready for deterministic review'
              : 'Setup correction required'}
          </strong>
          <span>
            {mode === 'live'
              ? 'Live-event prototype context'
              : 'Practice rehearsal context'}
          </span>
        </div>
        <div className="draw-action-bar__actions">
          <ButtonLink to="/dashboard" variant="secondary">
            Return to Dashboard
          </ButtonLink>
          {scenario === 'insufficient' ? (
            <Button disabled size="lg">
              Resolve pool shortage
            </Button>
          ) : (
            <ButtonLink size="lg" to={liveDrawReadyPath}>
              Review draw
            </ButtonLink>
          )}
        </div>
      </div>
    </section>
  )
}
