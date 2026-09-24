import type { PrototypeImportStep } from '../../prototype/operator-types.ts'
import { useUiClass } from '../ui/ui-theme.ts'

export interface ProgressStep {
  id: PrototypeImportStep
  label: string
}

interface ProgressStepperProps {
  currentStep: PrototypeImportStep
  steps: readonly ProgressStep[]
  completed?: boolean
  locale?: 'en' | 'id'
}

export function ProgressStepper({
  currentStep,
  steps,
  completed = false,
  locale = 'en',
}: ProgressStepperProps) {
  const ui = useUiClass()
  const matchedIndex = steps.findIndex((step) => step.id === currentStep)
  const currentIndex = matchedIndex < 0 ? 0 : matchedIndex

  return (
    <nav aria-label={locale === 'id' ? 'Progres Impor Peserta' : 'Participant Import progress'} className={ui('progress-stepper')}>
      <ol>
        {steps.map((step, index) => {
          const state = completed || index < currentIndex
            ? 'complete'
            : index === currentIndex
              ? 'active'
              : 'upcoming'
          const stateLabel = locale === 'id'
            ? state === 'complete' ? 'Selesai' : state === 'active' ? 'Aktif' : 'Berikutnya'
            : state === 'complete' ? 'Complete' : state === 'active' ? 'Current' : 'Upcoming'

          return (
            <li
              aria-current={state === 'active' ? 'step' : undefined}
              data-state={state}
              key={step.id}
            >
              <span aria-hidden="true" className={ui('progress-stepper__marker')}>
                {state === 'complete' ? '✓' : index + 1}
              </span>
              <span className={ui('progress-stepper__copy')}>
                <span className={ui('progress-stepper__label')}>{step.label}</span>
                <span className={ui('progress-stepper__status')}>{stateLabel}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
