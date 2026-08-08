import { useNavigate } from 'react-router'
import { useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { Button, ButtonLink } from '../ui/index.ts'

export function ProductionSetupContinuation() {
  const workspace = useProductionWorkspace()
  const navigate = useNavigate()
  const hasCurrentEvent = workspace.status === 'ready'
  const supportingCopy = hasCurrentEvent ? 'Event selected' : 'Select an Event as Current to continue.'

  return <section className="production-setup-continuation" aria-labelledby="setup-journey-title">
    <div className="production-setup-continuation__progress">
      <p className="production-setup-continuation__eyebrow">Setup journey · Step 1 of 4</p>
      <h2 id="setup-journey-title">Event setup</h2>
      <p className="production-setup-continuation__copy">{supportingCopy}</p>
      {workspace.status === 'ready' ? <strong className="production-setup-continuation__event">{workspace.event.name}</strong> : null}
      <ol className="production-setup-continuation__steps" aria-label="Production setup steps">
        <li aria-current="step">Event</li><li>Prize Categories</li><li>Participants</li><li>Draw Setup</li>
      </ol>
    </div>
    <div className="production-setup-continuation__actions">
      <ButtonLink to="/dashboard" variant="secondary" size="sm">Back to Dashboard</ButtonLink>
      <div className="production-setup-continuation__next">
        <span className="production-setup-continuation__next-copy">{hasCurrentEvent ? 'Continue with the selected Event.' : 'Select an Event as Current to continue.'}</span>
        <Button type="button" disabled={!hasCurrentEvent} onClick={() => navigate('/prize-categories')}>Next: Prize Categories <span aria-hidden="true">→</span></Button>
      </div>
    </div>
  </section>
}
