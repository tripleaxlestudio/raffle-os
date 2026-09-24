import { useUiClass } from './ui-theme.ts'
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
  const ui = useUiClass()
  return (
    <section
      aria-label={title}
      className={joinClassNames(ui('ui-toast'), ui(`ui-toast--${variant}`))}
      role={urgent ? 'alert' : 'status'}
    >
      <span aria-hidden="true" className={ui("ui-toast__marker")} />
      <div className={ui("ui-toast__copy")}>
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
