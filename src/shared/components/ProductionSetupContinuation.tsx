import { useNavigate } from 'react-router'
import { useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { Button, ButtonLink } from '../ui/index.ts'
import { getProductionSetupProgress } from '../../app/workspace/production-setup-readiness.ts'
import { PRODUCTION_SETUP_JOURNEY } from './production-setup-journey.ts'

export function ProductionSetupContinuation() {
  const workspace = useProductionWorkspace()
  const navigate = useNavigate()
  const readiness = workspace.status === 'ready' ? (workspace.setupReadiness ?? { event: true, prize: false, participants: false, displaySettings: false, drawSetup: false }) : { event: false, prize: false, participants: false, displaySettings: false, drawSetup: false }
  const progress = getProductionSetupProgress(readiness)
  const currentIndex = progress.completedIndex < 0 ? 0 : progress.completedIndex
  const currentStep = PRODUCTION_SETUP_JOURNEY[currentIndex]
  const nextStep = PRODUCTION_SETUP_JOURNEY[progress.nextIndex]
  const hasNext = workspace.status === 'ready' && progress.completedIndex < PRODUCTION_SETUP_JOURNEY.length - 1
  const supportingCopy = workspace.status === 'ready' ? `${currentStep.label} complete` : 'Select an Event as Current to continue.'

  return <section className="production-setup-continuation" aria-labelledby="setup-journey-title">
    <div className="production-setup-continuation__progress">
      <p className="production-setup-continuation__eyebrow">Setup journey · Step {currentIndex + 1} of {PRODUCTION_SETUP_JOURNEY.length}</p>
      <h2 id="setup-journey-title">{currentStep.label} setup</h2>
      <p className="production-setup-continuation__copy">{supportingCopy}{workspace.status === 'ready' ? ` · ${workspace.event.name}` : ''}</p>
      <ol className="production-setup-continuation__steps" aria-label="Production setup steps">
        {PRODUCTION_SETUP_JOURNEY.map((step, index) => <li aria-current={index === progress.completedIndex ? 'step' : undefined} key={step.to}>{step.label}</li>)}
      </ol>
    </div>
    <div className="production-setup-continuation__actions">
      <ButtonLink to="/dashboard" variant="secondary" size="sm">Back to Dashboard</ButtonLink>
      <Button type="button" disabled={!hasNext} onClick={() => navigate(nextStep.to)}>Next: {nextStep.label} <span aria-hidden="true">→</span></Button>
    </div>
  </section>
}
