import type {
  EventId,
  PrizeCategoryId,
} from '../shared/identifiers.ts'
import {
  failure,
  success,
  type Result,
} from '../shared/result.ts'
import {
  isIsoTimestamp,
  type IsoTimestamp,
} from '../shared/timestamps.ts'

export interface PrizeCategory {
  readonly id: PrizeCategoryId
  readonly eventId: EventId
  readonly name: string
  readonly prizeName: string
  readonly displayOrder: number
  readonly description?: string
  readonly sponsorName?: string
  readonly createdAt: IsoTimestamp
}

export function validatePrizeCategory(
  category: PrizeCategory,
): Result<PrizeCategory> {
  if (
    category.name.trim().length === 0 ||
    category.prizeName.trim().length === 0
  ) {
    return failure(
      'invalid-prize-category-name',
      'Prize category and prize names must be non-empty.',
    )
  }

  if (
    !Number.isInteger(category.displayOrder) ||
    category.displayOrder < 0
  ) {
    return failure(
      'invalid-prize-display-order',
      'Prize category display order must be a non-negative integer.',
    )
  }

  if (!isIsoTimestamp(category.createdAt)) {
    return failure(
      'invalid-prize-category-timestamp',
      'Prize category timestamp must be a valid ISO UTC value.',
    )
  }

  return success(category)
}
