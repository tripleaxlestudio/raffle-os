import type { EventId, PrizeCategoryId } from '../../../domain/shared/identifiers.ts'
import type { PrizeCategory } from '../../../domain/prizes/prize.types.ts'

export interface PrizeCategoryRepository {
  findById(id: PrizeCategoryId): Promise<PrizeCategory | null>
  /** Returns categories ordered by displayOrder, then id. */
  findByEventId(eventId: EventId): Promise<PrizeCategory[]>
  create(category: PrizeCategory): Promise<void>
  updateDraft(category: PrizeCategory): Promise<void>
  deleteDraft(id: PrizeCategoryId): Promise<void>
}
