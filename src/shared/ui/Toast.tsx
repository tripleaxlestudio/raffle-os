import { Button } from './Button.tsx'
import { joinClassNames } from './class-names.ts'

export type ToastVariant = 'neutral' | 'success' | 'warning' | 'danger'

interface ToastProps {
  description?: string
  dismissLabel?: string
  onDismiss?: () => void
  title: string
  urgent?: boolean
  variant?: ToastVariant
}

export function Toast({
  description,
  dismissLabel = 'Dismiss notification',
  onDismiss,
  title,
  urgent = false,
  variant = 'neutral',
}: ToastProps) {
  return (
    <section
      aria-label={title}
      className={joinClassNames('ui-toast', `ui-toast--${variant}`)}
      role={urgent ? 'alert' : 'status'}
    >
      <span aria-hidden="true" className="ui-toast__marker" />
      <div className="ui-toast__copy">
        <strong>{title}</strong>
        {description === undefined ? null : <p>{description}</p>}
      </div>
      {onDismiss === undefined ? null : (
        <Button
          aria-label={dismissLabel}
          onClick={onDismiss}
          size="sm"
          variant="quiet"
        >
          Dismiss
        </Button>
      )}
    </section>
  )
}
