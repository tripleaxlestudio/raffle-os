import type {
  PrototypeImportSummary,
  PrototypeParticipantRow,
} from '../../../prototype/operator-types.ts'
import { MetricCard } from '../../../shared/components/MetricCard.tsx'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Table,
} from '../../../shared/ui/index.ts'

interface ImportValidationStepProps {
  backPath: string
  nextPath: string
  rows: readonly PrototypeParticipantRow[]
  summary: PrototypeImportSummary
}

const statusBadgeVariant = {
  valid: 'success',
  duplicate: 'warning',
  invalid: 'danger',
} as const

export function ImportValidationStep({
  backPath,
  nextPath,
  rows,
  summary,
}: ImportValidationStepProps) {
  const metrics = [
    {
      detail: 'Rows in the fictional workbook',
      label: 'Total rows',
      tone: 'info',
      value: summary.totalRows.toLocaleString('en-US'),
    },
    {
      detail: 'Ready for summary review',
      label: 'Valid',
      tone: 'success',
      value: summary.validRows.toLocaleString('en-US'),
    },
    {
      detail: 'Would be skipped',
      label: 'Duplicates',
      tone: 'warning',
      value: summary.duplicateRows.toLocaleString('en-US'),
    },
    {
      detail: 'Would be rejected',
      label: 'Invalid',
      tone: 'warning',
      value: summary.invalidRows.toLocaleString('en-US'),
    },
  ] as const

  return (
    <Card
      aria-labelledby="validation-panel-title"
      className="import-panel import-panel--primary import-panel--wide"
      padding="none"
    >
      <div className="import-panel__header">
        <div>
          <p className="import-panel__eyebrow">Step 3 of 4</p>
          <h2 id="validation-panel-title">Review validation results</h2>
        </div>
        <Badge variant="warning">64 rows need review</Badge>
      </div>

      <div className="import-panel__body">
        <section
          aria-label="Participant validation totals"
          className="import-validation-metrics"
        >
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </section>

        <div className="validation-toolbar">
          <div aria-label="Validation row filters" className="filter-segments">
            <Button aria-pressed="true" disabled size="sm" variant="secondary">
              All
            </Button>
            <Button aria-pressed="false" disabled size="sm" variant="quiet">
              Valid
            </Button>
            <Button aria-pressed="false" disabled size="sm" variant="quiet">
              Duplicates
            </Button>
            <Button aria-pressed="false" disabled size="sm" variant="quiet">
              Invalid
            </Button>
          </div>
          <Button disabled size="sm" variant="secondary">
            Download issues
          </Button>
        </div>

        <Table caption="Representative participant validation rows">
          <thead>
            <tr>
              <th scope="col">Row</th>
              <th scope="col">Ticket Number</th>
              <th scope="col">Participant</th>
              <th scope="col">Email</th>
              <th scope="col">Group</th>
              <th scope="col">Status</th>
              <th scope="col">Issue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowNumber}>
                <td>{row.rowNumber}</td>
                <td>
                  <code>
                    {row.ticketNumber === ''
                      ? '— Empty —'
                      : row.ticketNumber}
                  </code>
                </td>
                <td>
                  {row.participantName === ''
                    ? '— Missing name —'
                    : row.participantName}
                </td>
                <td>{row.email}</td>
                <td>{row.group}</td>
                <td>
                  <Badge variant={statusBadgeVariant[row.status]}>
                    {row.status}
                  </Badge>
                </td>
                <td>
                  {row.issues.length === 0
                    ? 'No issue'
                    : row.issues.map((issue) => issue.message).join(' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="validation-strategy">
          <div>
            <strong>Dataset strategy preview</strong>
            <p>
              These controls are disabled because this static prototype cannot
              replace, merge, download, or mutate participant data.
            </p>
          </div>
          <div className="validation-strategy__actions">
            <Button disabled variant="danger">
              Replace existing dataset
            </Button>
            <Button disabled variant="secondary">
              Merge with existing dataset
            </Button>
          </div>
        </div>
      </div>

      <div className="import-panel__actions">
        <ButtonLink to={backPath} variant="secondary">
          Return to mapping
        </ButtonLink>
        <ButtonLink size="lg" to={nextPath}>
          Review import summary
        </ButtonLink>
      </div>
    </Card>
  )
}
