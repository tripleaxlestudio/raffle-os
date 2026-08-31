import { useLocation, useNavigate } from 'react-router'
import { useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { Button, ButtonLink } from '../ui/index.ts'
import { productionSetupJourneyComplete, productionSetupStageComplete, productionSetupStageIndexForRoute } from '../../app/workspace/production-setup-readiness.ts'
import { PRODUCTION_SETUP_JOURNEY } from './production-setup-journey.ts'

export function ProductionSetupContinuation() {
  const workspace = useProductionWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const readiness = workspace.status === 'ready' ? (workspace.setupReadiness ?? { event: true, prize: false, participants: false, displaySettings: false, drawSetup: false }) : { event: false, prize: false, participants: false, displaySettings: false, drawSetup: false }
  if (workspace.status === 'ready' && productionSetupJourneyComplete(readiness)) return null
  const currentIndex = productionSetupStageIndexForRoute(location.pathname) ?? 0
  const currentStep = PRODUCTION_SETUP_JOURNEY[currentIndex]
  const complete = productionSetupStageComplete(readiness, currentIndex)
  const reachedStep = workspace.status === 'ready' ? (workspace.setupJourneyReachedStep ?? 1) : 0
  const admittedThrough = reachedStep - 1
  const unlocked = workspace.status !== 'ready' ? currentIndex === 0 : currentIndex <= admittedThrough
  const nextStep = PRODUCTION_SETUP_JOURNEY[currentIndex + 1]
  const previousStep = PRODUCTION_SETUP_JOURNEY[currentIndex - 1]
  const hasNext = unlocked && complete && nextStep !== undefined
  const stateLabel = complete ? 'SELESAI' : unlocked ? 'SEDANG DIKERJAKAN' : 'TERKUNCI'
  const supportingCopy = workspace.status !== 'ready' ? 'Pilih satu Acara sebagai acara aktif untuk melanjutkan.' : !unlocked ? 'Selesaikan langkah pengaturan sebelumnya untuk melanjutkan.' : currentIndex === 1 && !complete ? 'Buat setidaknya satu kategori hadiah untuk melanjutkan.' : complete ? `Pengaturan ${currentStep.label} selesai.` : `Selesaikan pengaturan ${currentStep.label} untuk melanjutkan.`

  return <section className="production-setup-continuation" data-setup-journey-surface="sticky" aria-labelledby="setup-journey-title">
    <div className="production-setup-continuation__progress">
      <p className="production-setup-continuation__eyebrow">ALUR PENGATURAN · LANGKAH {currentIndex + 1} DARI {PRODUCTION_SETUP_JOURNEY.length} · {currentStep.label.toUpperCase()} {stateLabel}</p>
      <h2 id="setup-journey-title">Pengaturan {currentStep.label}</h2>
      <p className="production-setup-continuation__copy">{supportingCopy}{workspace.status === 'ready' ? ` · ${workspace.event.name}` : ''}</p>
      <ol className="production-setup-continuation__steps" aria-label="Langkah pengaturan produksi">
        {PRODUCTION_SETUP_JOURNEY.map((step, index) => <li className={productionSetupStageComplete(readiness, index) ? 'is-complete' : index === currentIndex ? 'is-current' : 'is-locked'} aria-current={index === currentIndex ? 'step' : undefined} key={step.to}>{step.label}</li>)}
      </ol>
    </div>
    <div className="production-setup-continuation__actions">
      {previousStep === undefined ? <ButtonLink to="/dashboard" variant="secondary" size="sm">Kembali ke Dasbor</ButtonLink> : <Button type="button" variant="secondary" size="sm" onClick={() => navigate(previousStep.to)}>Sebelumnya</Button>}
      <Button type="button" disabled={!hasNext} onClick={() => { if (nextStep !== undefined && workspace.status === 'ready') { workspace.advanceSetupJourney?.(currentIndex + 2); navigate(nextStep.to) } }}>Berikutnya: {nextStep?.label ?? 'Selesai'} <span aria-hidden="true">→</span></Button>
    </div>
  </section>
}
