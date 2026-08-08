import { Card } from '../ui/index.ts'
import { Link } from 'react-router'

type MetricTone = 'neutral' | 'success' | 'warning' | 'info'

interface MetricCardProps {
  detail: string
  label: string
  to?: string
  tone?: MetricTone
  value: string
}

export function MetricCard({
  detail,
  label,
  to,
  tone = 'neutral',
  value,
}: MetricCardProps) {
  const content = <>
    <p className="metric-card__label">{label}</p>
    <strong className="metric-card__value">{value}</strong>
    <p className="metric-card__detail">{detail}</p>
  </>
  if (to !== undefined) return <Link className="ui-card ui-card--default ui-card--padding-sm metric-card" data-tone={tone} to={to}>{content}</Link>
  return (
    <Card className="metric-card" data-tone={tone} padding="sm">
      {content}
    </Card>
  )
}
