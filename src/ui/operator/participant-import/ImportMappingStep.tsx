import type {
  PrototypeColumnMapping,
  PrototypeSourceColumn,
} from '../../../prototype/operator-types.ts'
import { FieldGroup } from '../../../shared/components/FieldGroup.tsx'
import {
  Badge,
  ButtonLink,
  Card,
  Select,
  Table,
} from '../../../shared/ui/index.ts'

interface ImportMappingStepProps {
  backPath: string
  mappings: readonly PrototypeColumnMapping[]
  nextPath: string
  sourceColumns: readonly PrototypeSourceColumn[]
}

export function ImportMappingStep({
  backPath,
  mappings,
  nextPath,
  sourceColumns,
}: ImportMappingStepProps) {
  return (
    <>
      <Card
        aria-labelledby="mapping-panel-title"
        className="import-panel import-panel--primary"
        padding="none"
      >
        <div className="import-panel__header">
          <div>
            <p className="import-panel__eyebrow">Step 2 of 4</p>
            <h2 id="mapping-panel-title">Map spreadsheet columns</h2>
          </div>
          <Badge variant="warning">5 of 6 mapped</Badge>
        </div>

        <div className="import-panel__body">
          <div className="leading-zero-notice" role="note">
            <span aria-hidden="true">000</span>
            <p>
              Ticket values remain strings in this prototype. Leading zeroes
              such as <code>000123</code>, <code>004216</code>, and{' '}
              <code>010039</code> are preserved exactly.
            </p>
          </div>

          <FieldGroup
            description="Choose the fictional source column shown for each participant field. Required status is communicated in every label."
            legend="Column assignments"
          >
            <div className="mapping-grid">
              {mappings.map((mapping) => (
                <div className="mapping-row" key={mapping.targetField}>
                  <Select
                    defaultValue={mapping.sourceColumn ?? ''}
                    description={`Preview: ${mapping.sourcePreview.join(' · ')}`}
                    label={`${mapping.targetField} — ${
                      mapping.requirement === 'required'
                        ? 'Required *'
                        : 'Optional'
                    }`}
                  >
                    <option value="">Not mapped</option>
                    {sourceColumns.map((column) => (
                      <option key={column.heading} value={column.heading}>
                        {column.heading}
                      </option>
                    ))}
                  </Select>
                  <span
                    className="mapping-row__state"
                    data-mapped={mapping.sourceColumn !== null}
                  >
                    {mapping.sourceColumn === null
                      ? 'Unmapped'
                      : `Mapped from ${mapping.sourceColumn}`}
                  </span>
                </div>
              ))}
            </div>
          </FieldGroup>

          <div className="mapping-summary" role="status">
            <strong>Mapping summary</strong>
            <span>1 required field mapped</span>
            <span>4 optional fields mapped</span>
            <span>1 optional field left unmapped</span>
          </div>
        </div>

        <div className="import-panel__actions">
          <ButtonLink to={backPath} variant="secondary">
            Return to upload
          </ButtonLink>
          <ButtonLink size="lg" to={nextPath}>
            Validate participant data
          </ButtonLink>
        </div>
      </Card>

      <Card
        aria-labelledby="source-preview-title"
        className="import-context-panel"
        padding="none"
        tone="raised"
      >
        <div className="import-context-panel__header">
          <p className="import-panel__eyebrow">Source preview</p>
          <h2 id="source-preview-title">Detected spreadsheet columns</h2>
        </div>
        <Table caption="Fictional source column preview">
          <thead>
            <tr>
              <th scope="col">Column</th>
              <th scope="col">Sample value</th>
            </tr>
          </thead>
          <tbody>
            {sourceColumns.map((column) => (
              <tr key={column.heading}>
                <th scope="row">{column.heading}</th>
                <td>{column.samples[0]}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="import-context-panel__footnote">
          Preview values are fixed fixtures. No spreadsheet was inspected.
        </p>
      </Card>
    </>
  )
}
