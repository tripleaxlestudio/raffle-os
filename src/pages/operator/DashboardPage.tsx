import { useSearchParams } from 'react-router'
import {
  getDashboardPrototype,
  resolveDashboardPrototypeScenario,
} from '../../prototype/dashboard.ts'
import { MetricCard } from '../../shared/components/MetricCard.tsx'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { ReadinessChecklist } from '../../shared/components/ReadinessChecklist.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { SummaryList } from '../../shared/components/SummaryList.tsx'
import { Badge, ButtonLink, Card } from '../../shared/ui/index.ts'

export function DashboardPage() {
  const [searchParams] = useSearchParams()
  const scenario = resolveDashboardPrototypeScenario(searchParams)
  const prototype = getDashboardPrototype(scenario)

  return (
    <section
      aria-labelledby="dashboard-title"
      className="dashboard"
      data-prototype-scenario={scenario}
    >
      <div className="prototype-notice" role="note">
        <span aria-hidden="true">PROTO</span>
        Fictional data for static interface review. No raffle operations are
        active.
      </div>

      <PageHeader
        actions={
          <ButtonLink size="lg" to="/draw/setup">
            Set up next draw
          </ButtonLink>
        }
        description={`${prototype.event.venue} · ${prototype.event.schedule}`}
        eyebrow="Event command overview"
        headingId="dashboard-title"
        title={prototype.event.name}
      />

      <StatusBanner
        badge={prototype.status.badge}
        title={prototype.status.title}
        tone={prototype.status.tone}
      >
        {prototype.status.description}
      </StatusBanner>

      <section aria-label="Event metrics" className="dashboard-metrics">
        {prototype.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <div className="dashboard-grid">
        <Card
          aria-labelledby="readiness-title"
          className="dashboard-panel dashboard-panel--readiness"
          padding="none"
        >
          <div className="dashboard-panel__header">
            <div>
              <p className="dashboard-panel__eyebrow">Preflight</p>
              <h2 id="readiness-title">Operational readiness</h2>
            </div>
            <Badge
              variant={scenario === 'ready' ? 'success' : 'warning'}
            >
              {scenario === 'ready' ? '4 of 4 ready' : '2 items open'}
            </Badge>
          </div>
          <ReadinessChecklist items={prototype.readiness} />
        </Card>

        <Card
          aria-labelledby="next-draw-title"
          className="dashboard-panel dashboard-panel--next-draw"
          padding="none"
          tone="raised"
        >
          <div className="dashboard-panel__header">
            <div>
              <p className="dashboard-panel__eyebrow">Run of show</p>
              <h2 id="next-draw-title">Next draw</h2>
            </div>
            <Badge variant="practice">Preview only</Badge>
          </div>
          <div className="dashboard-panel__body">
            <SummaryList items={prototype.nextDraw} />
          </div>
        </Card>

        <Card
          aria-labelledby="activity-title"
          className="dashboard-panel dashboard-panel--activity"
          padding="none"
        >
          <div className="dashboard-panel__header">
            <div>
              <p className="dashboard-panel__eyebrow">Operator log</p>
              <h2 id="activity-title">Recent prototype activity</h2>
            </div>
            <Badge variant="neutral">Static records</Badge>
          </div>
          <ol className="activity-list">
            {prototype.recentActivity.map((activity) => (
              <li
                className="activity-list__item"
                key={`${activity.timestamp}-${activity.ticketNumber}`}
              >
                <time>{activity.timestamp}</time>
                <span className="activity-list__copy">
                  <strong>{activity.label}</strong>
                  <span>{activity.detail}</span>
                </span>
                <code>{activity.ticketNumber}</code>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </section>
  )
}
