import { Card } from '../ui/index.ts'

type MetricTone = 'neutral' | 'success' | 'warning' | 'info'

interface MetricCardProps {
  detail: string
  label: string
  tone?: MetricTone
  value: string
}

export function MetricCard({
  detail,
  label,
  tone = 'neutral',
  value,
}: MetricCardProps) {
  return (
    <Card className="metric-card" data-tone={tone} padding="sm">
      <p className="metric-card__label">{label}</p>
      <strong className="metric-card__value">{value}</strong>
      <p className="metric-card__detail">{detail}</p>
    </Card>
  )
}
