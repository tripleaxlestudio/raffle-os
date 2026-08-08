import type { PrototypeImportStep } from '../../prototype/operator-types.ts'

export interface ProgressStep {
  id: PrototypeImportStep
  label: string
}

interface ProgressStepperProps {
  currentStep: PrototypeImportStep
  steps: readonly ProgressStep[]
  completed?: boolean
}

export function ProgressStepper({
  currentStep,
  steps,
  completed = false,
}: ProgressStepperProps) {
  const matchedIndex = steps.findIndex((step) => step.id === currentStep)
  const currentIndex = matchedIndex < 0 ? 0 : matchedIndex

  return (
    <nav aria-label="Participant Import progress" className="progress-stepper">
      <ol>
        {steps.map((step, index) => {
          const state = completed || index < currentIndex
            ? 'complete'
            : index === currentIndex
              ? 'active'
              : 'upcoming'
          const stateLabel =
            state === 'complete'
              ? 'Complete'
              : state === 'active'
                ? 'Current'
                : 'Upcoming'

          return (
            <li
              aria-current={state === 'active' ? 'step' : undefined}
              data-state={state}
              key={step.id}
            >
              <span aria-hidden="true" className="progress-stepper__marker">
                {state === 'complete' ? '✓' : index + 1}
              </span>
              <span className="progress-stepper__copy">
                <span className="progress-stepper__label">{step.label}</span>
                <span className="progress-stepper__status">{stateLabel}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
