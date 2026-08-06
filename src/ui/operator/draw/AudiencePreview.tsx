import { useId } from 'react'
import { Badge } from '../../../shared/ui/index.ts'

interface AudiencePreviewData {
  readonly eventName: string
  readonly prizeName: string
  readonly resolution: string
  readonly stateLabel: string
  readonly tickets: readonly string[]
  readonly winnerCount: number
}

interface AudiencePreviewProps {
  preview: AudiencePreviewData
}

export function AudiencePreview({ preview }: AudiencePreviewProps) {
  const headingId = useId()

  return (
    <section
      aria-labelledby={headingId}
      className="operator-audience-preview"
    >
      <div className="operator-audience-preview__toolbar">
        <div>
          <span>Operator preview</span>
          <h3 id={headingId}>Audience frame</h3>
        </div>
        <Badge variant="neutral">{preview.resolution}</Badge>
      </div>
      <div className="operator-audience-preview__frame">
        <div
          aria-hidden="true"
          className="operator-audience-preview__safe-area"
        >
          SAFE AREA
        </div>
        <p className="operator-audience-preview__event">
          {preview.eventName}
        </p>
        <p className="operator-audience-preview__state">
          {preview.stateLabel}
        </p>
        {preview.tickets.length === 0 ? (
          <strong>{preview.prizeName}</strong>
        ) : (
          <div
            aria-label="Static presentational ticket stream"
            className="operator-audience-preview__tickets"
          >
            {preview.tickets.map((ticket) => (
              <code key={ticket}>{ticket}</code>
            ))}
          </div>
        )}
        <p className="operator-audience-preview__meta">
          {preview.winnerCount}{' '}
          {preview.winnerCount === 1 ? 'winner' : 'winners'} ·{' '}
          {preview.prizeName}
        </p>
      </div>
      <p className="operator-audience-preview__note">
        Operator-only static preview. This is not the Audience Display.
      </p>
    </section>
  )
}
