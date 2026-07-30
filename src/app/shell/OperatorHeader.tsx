import type {
  AppMode,
  DisplayConnectionStatus,
} from '../../domain/types/index.ts'
import type { DashboardPrototypeScenario } from '../../prototype/dashboard.ts'
import { PrototypeNavigator } from '../../shared/components/PrototypeNavigator.tsx'
import { Select } from '../../shared/ui/index.ts'
import { ConnectionStatus } from './ConnectionStatus.tsx'
import { ModeBadge } from './ModeBadge.tsx'

interface OperatorHeaderProps {
  connectionStatus: DisplayConnectionStatus
  eventName: string
  eventSchedule: string
  mode: AppMode
  onScenarioChange: (scenario: DashboardPrototypeScenario) => void
  scenario: DashboardPrototypeScenario
}

export function OperatorHeader({
  connectionStatus,
  eventName,
  eventSchedule,
  mode,
  onScenarioChange,
  scenario,
}: OperatorHeaderProps) {
  return (
    <header className="operator-header">
      <div className="operator-header__event">
        <span className="operator-header__label">Current event</span>
        <strong>{eventName}</strong>
        <span className="operator-header__schedule">{eventSchedule}</span>
      </div>
      <div className="operator-header__status" aria-label="Operator status">
        <Select
          containerClassName="prototype-scenario-select"
          label="Prototype scenario"
          onChange={(event) => {
            const nextScenario =
              event.target.value === 'attention' ? 'attention' : 'ready'
            onScenarioChange(nextScenario)
          }}
          value={scenario}
        >
          <option value="ready">Ready state</option>
          <option value="attention">Needs attention</option>
        </Select>
        <PrototypeNavigator />
        <ModeBadge mode={mode} />
        <ConnectionStatus status={connectionStatus} />
      </div>
    </header>
  )
}
