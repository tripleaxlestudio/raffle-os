import type { DisplayConnectionStatus } from '../../domain/types/index.ts'

interface ConnectionStatusProps {
  status: DisplayConnectionStatus
}

const connectionLabels: Record<DisplayConnectionStatus, string> = {
  disconnected: 'Audience Display: Disconnected',
  connecting: 'Audience Display: Connecting',
  connected: 'Audience Display: Connected',
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  return (
    <span
      aria-label={connectionLabels[status]}
      className="connection-status"
      data-connection-status={status}
      role="status"
    >
      {connectionLabels[status]}
    </span>
  )
}
