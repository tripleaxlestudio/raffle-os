export interface ReadinessChecklistItem {
  detail: string
  label: string
  status: 'ready' | 'warning' | 'offline'
}

interface ReadinessChecklistProps {
  items: readonly ReadinessChecklistItem[]
}

const statusLabels: Record<ReadinessChecklistItem['status'], string> = {
  ready: 'Ready',
  warning: 'Needs attention',
  offline: 'Offline',
}

export function ReadinessChecklist({ items }: ReadinessChecklistProps) {
  return (
    <ul className="readiness-list">
      {items.map((item) => (
        <li className="readiness-list__item" key={item.label}>
          <span
            aria-hidden="true"
            className="readiness-list__marker"
            data-status={item.status}
          />
          <span className="readiness-list__copy">
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </span>
          <span className="readiness-list__status">
            {statusLabels[item.status]}
          </span>
        </li>
      ))}
    </ul>
  )
}
