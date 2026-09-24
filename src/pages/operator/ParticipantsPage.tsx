import type { ProductionParticipantImportPreviewProps } from '../../ui/operator/participant-import/ProductionParticipantImportPreview.tsx'
import { ProductionParticipantImportPreview } from '../../ui/operator/participant-import/ProductionParticipantImportPreview.tsx'

export function ParticipantsPage({ services }: ProductionParticipantImportPreviewProps = {}) {
  return <ProductionParticipantImportPreview services={services} />
}
