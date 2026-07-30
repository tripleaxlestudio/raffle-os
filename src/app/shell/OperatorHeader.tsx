import { ConnectionStatus } from './ConnectionStatus.tsx'
import { ModeBadge } from './ModeBadge.tsx'

export function OperatorHeader() {
  return (
    <header className="operator-header">
      <div className="operator-header__event">
        <span className="operator-header__label">Current event</span>
        <strong>Event not selected</strong>
      </div>
      <div className="operator-header__status" aria-label="Operator status">
        <ModeBadge mode="practice" />
        <ConnectionStatus status="disconnected" />
      </div>
    </header>
  )
}
