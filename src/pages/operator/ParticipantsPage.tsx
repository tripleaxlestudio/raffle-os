import { useSearchParams } from 'react-router'
import { ProductionParticipantImportPreview } from '../../ui/operator/participant-import/ProductionParticipantImportPreview.tsx'
import { participantImportFixture } from '../../prototype/data/index.ts'
import {
  getPrototypeImportStepPath,
  resolvePrototypeImportStep,
} from '../../prototype/scenario-query.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import {
  ProgressStepper,
  type ProgressStep,
} from '../../shared/components/ProgressStepper.tsx'
import { ImportMappingStep } from '../../ui/operator/participant-import/ImportMappingStep.tsx'
import { ImportSummaryStep } from '../../ui/operator/participant-import/ImportSummaryStep.tsx'
import { ImportUploadStep } from '../../ui/operator/participant-import/ImportUploadStep.tsx'
import { ImportValidationStep } from '../../ui/operator/participant-import/ImportValidationStep.tsx'

const importProgressSteps = [
  { id: 'upload', label: 'Upload file' },
  { id: 'mapping', label: 'Map columns' },
  { id: 'validation', label: 'Validate data' },
  { id: 'summary', label: 'Import summary' },
] as const satisfies readonly ProgressStep[]

export function ParticipantsPage() {
  const [searchParams] = useSearchParams()
  if (searchParams.get('workflow') === 'production-preview') {
    return <ProductionParticipantImportPreview />
  }
  const step = resolvePrototypeImportStep(searchParams)

  return (
    <section
      aria-labelledby="participant-import-title"
      className="participant-import"
      data-import-step={step}
    >
      <div className="prototype-notice" role="note">
        <span aria-hidden="true">PROTO</span>
        Fictional participant data for static interface review. No file or
        participant record is read, changed, or stored.
      </div>

      <PageHeader
        description="Preview the future spreadsheet workflow while preserving ticket identifiers exactly as text."
        eyebrow="Participant operations"
        headingId="participant-import-title"
        title="Participant Import"
      />

      <ProgressStepper currentStep={step} steps={importProgressSteps} />

      <div
        className={`participant-import__layout participant-import__layout--${step}`}
      >
        {step === 'upload' ? (
          <ImportUploadStep
            file={participantImportFixture.file}
            nextPath={getPrototypeImportStepPath('mapping')}
          />
        ) : null}
        {step === 'mapping' ? (
          <ImportMappingStep
            backPath={getPrototypeImportStepPath('upload')}
            mappings={participantImportFixture.mappings}
            nextPath={getPrototypeImportStepPath('validation')}
            sourceColumns={participantImportFixture.sourceColumns}
          />
        ) : null}
        {step === 'validation' ? (
          <ImportValidationStep
            backPath={getPrototypeImportStepPath('mapping')}
            nextPath={getPrototypeImportStepPath('summary')}
            rows={participantImportFixture.rows}
            summary={participantImportFixture.summary}
          />
        ) : null}
        {step === 'summary' ? (
          <ImportSummaryStep
            dashboardPath="/dashboard"
            drawSetupPath="/draw/setup?mode=practice&scenario=ready"
            file={participantImportFixture.file}
            reviewPath={getPrototypeImportStepPath('validation')}
            summary={participantImportFixture.summary}
          />
        ) : null}
      </div>
    </section>
  )
}
