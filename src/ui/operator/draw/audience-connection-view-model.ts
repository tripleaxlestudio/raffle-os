import type { OperatorPublisherDiagnostics, PublisherStatus } from '../../../application/display-transport/operator-publisher.ts'
import type { BadgeVariant } from '../../../shared/ui/Badge.tsx'

export interface AudienceConnectionPresentation {
  readonly label: 'Connected' | 'Waiting' | 'Unavailable' | 'Publication failed'
  readonly tone: BadgeVariant
  readonly detail: string
  readonly acknowledged: boolean
}

export function presentAudienceConnection(status: PublisherStatus, diagnostics: OperatorPublisherDiagnostics | undefined): AudienceConnectionPresentation {
  const acknowledged = diagnostics?.lastAcknowledgement !== undefined
  if (status.kind === 'transport-error' || status.kind === 'projection-error' || status.kind === 'closed') return { label: status.kind === 'transport-error' ? 'Publication failed' : 'Unavailable', tone: 'danger', detail: 'The Audience Display cannot currently receive a trusted public snapshot.', acknowledged }
  if (status.kind === 'audience-presence' && status.status === 'connected' && acknowledged) return { label: 'Connected', tone: 'success', detail: 'Audience presence is active and the last public snapshot was acknowledged.', acknowledged: true }
  if (status.kind === 'snapshot-applied' && acknowledged) return { label: 'Connected', tone: 'success', detail: 'The last public snapshot was applied and acknowledged by the Audience Display.', acknowledged: true }
  if (acknowledged) return { label: 'Connected', tone: 'success', detail: 'The last public snapshot was acknowledged; waiting for the next live presence update.', acknowledged: true }
  return { label: 'Waiting', tone: 'warning', detail: 'Transport is ready, but no Audience acknowledgement has been received yet.', acknowledged: false }
}
