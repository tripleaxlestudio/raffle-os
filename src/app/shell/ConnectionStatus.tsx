import type { DisplayConnectionStatus } from '../../domain/types/index.ts'
import { Badge, type BadgeVariant } from '../../shared/ui/index.ts'

interface ConnectionStatusProps {
  status: DisplayConnectionStatus
}

const connectionLabels: Record<DisplayConnectionStatus, string> = {
  disconnected: 'Audience Display: Disconnected',
  connecting: 'Audience Display: Connecting',
  connected: 'Audience Display: Connected',
}

const connectionVariants: Record<
  DisplayConnectionStatus,
  BadgeVariant
> = {
  disconnected: 'neutral',
  connecting: 'warning',
  connected: 'success',
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  return (
    <Badge
      aria-label={connectionLabels[status]}
      className="connection-status"
      data-connection-status={status}
      indicator
      role="status"
      variant={connectionVariants[status]}
    >
      {connectionLabels[status]}
    </Badge>
  )
}
