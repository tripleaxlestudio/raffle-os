import type { ReactNode } from 'react'

interface EmptyStateProps {
  action?: ReactNode
  description: string
  marker?: string
  title: string
}

export function EmptyState({
  action,
  description,
  marker = '—',
  title,
}: EmptyStateProps) {
  return (
    <div className="ui-empty-state">
      <span aria-hidden="true" className="ui-empty-state__marker">
        {marker}
      </span>
      <div className="ui-empty-state__copy">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {action === undefined ? null : (
        <div className="ui-empty-state__action">{action}</div>
      )}
    </div>
  )
}
