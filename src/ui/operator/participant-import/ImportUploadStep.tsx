import type { PrototypeImportFile } from '../../../prototype/operator-types.ts'
import { FieldGroup } from '../../../shared/components/FieldGroup.tsx'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
} from '../../../shared/ui/index.ts'

interface ImportUploadStepProps {
  file: PrototypeImportFile
  nextPath: string
}

export function ImportUploadStep({
  file,
  nextPath,
}: ImportUploadStepProps) {
  return (
    <>
      <Card
        aria-labelledby="upload-panel-title"
        className="import-panel import-panel--primary"
        padding="none"
      >
        <div className="import-panel__header">
          <div>
            <p className="import-panel__eyebrow">Step 1 of 4</p>
            <h2 id="upload-panel-title">Choose participant file</h2>
          </div>
          <Badge variant="info">XLSX · CSV</Badge>
        </div>

        <div className="import-panel__body">
          <div
            aria-label="Visual file drop area"
            className="import-drop-zone"
            role="group"
          >
            <span aria-hidden="true" className="import-drop-zone__marker">
              XLS
            </span>
            <div>
              <h3>Drop a spreadsheet here</h3>
              <p>
                Supported formats: XLSX and CSV. Maximum prototype file size:
                10 MB.
              </p>
            </div>
            <Button disabled variant="secondary">
              Browse file
            </Button>
            <p className="import-drop-zone__hint">
              Visual control only — no file picker or drag-and-drop handler is
              connected.
            </p>
          </div>

          <section
            aria-labelledby="selected-file-title"
            className="selected-import-file"
          >
            <span aria-hidden="true" className="selected-import-file__type">
              {file.fileType}
            </span>
            <div className="selected-import-file__copy">
              <h3 id="selected-file-title">{file.fileName}</h3>
              <p>
                {file.fileSize} · Sheet: {file.sheetName}
              </p>
            </div>
            <div className="selected-import-file__rows">
              <strong>{file.totalRows.toLocaleString('en-US')}</strong>
              <span>sample rows</span>
            </div>
          </section>
        </div>

        <div className="import-panel__actions import-panel__actions--end">
          <ButtonLink size="lg" to={nextPath}>
            Continue to column mapping
          </ButtonLink>
        </div>
      </Card>

      <Card
        aria-label="File preparation guidance"
        className="import-context-panel"
        padding="md"
        tone="raised"
      >
        <FieldGroup
          description="These rules describe the future import flow. This slice does not inspect a real file."
          legend="File preparation"
        >
          <ul className="import-guidance-list">
            <li>
              Keep ticket identifiers formatted as text to retain leading
              zeroes.
            </li>
            <li>Use one header row and one participant per spreadsheet row.</li>
            <li>
              Required prototype fields are Ticket Number and Participant Name.
            </li>
          </ul>
        </FieldGroup>
        <div className="import-context-note">
          <span aria-hidden="true">i</span>
          <p>
            The selected file is fictional and always appears in the same
            state for deterministic review.
          </p>
        </div>
      </Card>
    </>
  )
}
