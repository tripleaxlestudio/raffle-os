import { useNavigate } from 'react-router'
import { useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { Button, ButtonLink } from '../ui/index.ts'
import { PRODUCTION_SETUP_JOURNEY } from './production-setup-journey.ts'

export function ProductionSetupContinuation() {
  const workspace = useProductionWorkspace()
  const navigate = useNavigate()
  const hasCurrentEvent = workspace.status === 'ready'
  const supportingCopy = hasCurrentEvent ? 'Event selected' : 'Select an Event as Current to continue.'

  return <section className="production-setup-continuation" aria-labelledby="setup-journey-title">
    <div className="production-setup-continuation__progress">
      <p className="production-setup-continuation__eyebrow">Setup journey · Step 1 of {PRODUCTION_SETUP_JOURNEY.length}</p>
      <h2 id="setup-journey-title">Event setup</h2>
      <p className="production-setup-continuation__copy">{supportingCopy}{workspace.status === 'ready' ? ` · ${workspace.event.name}` : ''}</p>
      <ol className="production-setup-continuation__steps" aria-label="Production setup steps">
        {PRODUCTION_SETUP_JOURNEY.map((step, index) => <li aria-current={index === 0 ? 'step' : undefined} key={step.to}>{step.label}</li>)}
      </ol>
    </div>
    <div className="production-setup-continuation__actions">
      <ButtonLink to="/dashboard" variant="secondary" size="sm">Back to Dashboard</ButtonLink>
      <Button type="button" disabled={!hasCurrentEvent} onClick={() => navigate('/prize-categories')}>Next: Prize <span aria-hidden="true">→</span></Button>
    </div>
  </section>
}
