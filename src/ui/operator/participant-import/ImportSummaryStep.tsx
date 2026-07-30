import type {
  PrototypeImportFile,
  PrototypeImportSummary,
} from '../../../prototype/operator-types.ts'
import { SummaryList } from '../../../shared/components/SummaryList.tsx'
import {
  Badge,
  ButtonLink,
  Card,
} from '../../../shared/ui/index.ts'

interface ImportSummaryStepProps {
  dashboardPath: string
  file: PrototypeImportFile
  reviewPath: string
  summary: PrototypeImportSummary
}

export function ImportSummaryStep({
  dashboardPath,
  file,
  reviewPath,
  summary,
}: ImportSummaryStepProps) {
  const totals = [
    { label: 'Selected file', value: file.fileName },
    {
      label: 'Total rows',
      value: summary.totalRows.toLocaleString('en-US'),
    },
    {
      label: 'Valid rows',
      value: summary.validRows.toLocaleString('en-US'),
    },
    {
      label: 'Skipped duplicates',
      value: summary.duplicateRows.toLocaleString('en-US'),
    },
    {
      label: 'Rejected invalid rows',
      value: summary.invalidRows.toLocaleString('en-US'),
    },
    { label: 'Event target', value: summary.eventTarget },
  ]

  return (
    <>
      <Card
        aria-labelledby="summary-panel-title"
        className="import-panel import-panel--primary"
        padding="none"
      >
        <div className="import-panel__header">
          <div>
            <p className="import-panel__eyebrow">Step 4 of 4</p>
            <h2 id="summary-panel-title">Review import summary</h2>
          </div>
          <Badge variant="practice">Presentation only</Badge>
        </div>

        <div className="import-panel__body import-summary-body">
          <div className="import-warning" role="alert">
            <span aria-hidden="true">!</span>
            <div>
              <strong>No participant data has actually been imported.</strong>
              <p>
                This screen is presentation-only and creates no success record,
                participant dataset, or history entry.
              </p>
            </div>
          </div>

          <section aria-labelledby="summary-totals-title">
            <h3 id="summary-totals-title">Prototype totals</h3>
            <SummaryList items={totals} />
          </section>

          <section aria-labelledby="mapped-fields-title">
            <div className="import-section-heading">
              <h3 id="mapped-fields-title">Mapped fields</h3>
              <Badge variant="neutral">
                {summary.mappedFields.length} fields
              </Badge>
            </div>
            <ul className="mapped-field-list">
              {summary.mappedFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="import-panel__actions">
          <ButtonLink to={reviewPath} variant="secondary">
            Review validation
          </ButtonLink>
          <ButtonLink size="lg" to={dashboardPath}>
            Return to Dashboard
          </ButtonLink>
        </div>
      </Card>

      <Card
        aria-labelledby="strategy-title"
        className="import-context-panel"
        padding="md"
        tone="raised"
      >
        <p className="import-panel__eyebrow">Strategy preview</p>
        <h2 id="strategy-title">{summary.strategyLabel}</h2>
        <div className="strategy-preview" data-strategy={summary.strategy}>
          <span aria-hidden="true">R</span>
          <div>
            <strong>Replace strategy selected</strong>
            <p>
              A future production flow would require explicit confirmation
              before changing the event dataset.
            </p>
          </div>
        </div>
        <p className="import-context-panel__footnote">
          No replace or merge operation is available in this prototype.
        </p>
      </Card>
    </>
  )
}
