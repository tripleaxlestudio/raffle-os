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
  readonly prizeImageAssetId?: string
  readonly createdAt: IsoTimestamp
}

export const ALLOWED_PRIZE_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

export const MAX_PRIZE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export function validatePrizeImageFile(
  file: { readonly type: string; readonly size: number },
): string | null {
  const isAllowed = (ALLOWED_PRIZE_IMAGE_TYPES as readonly string[]).includes(file.type)
  if (!isAllowed) {
    return 'Format file tidak didukung. Gunakan PNG, JPG, atau WebP.'
  }
  if (file.size > MAX_PRIZE_IMAGE_SIZE_BYTES) {
    return 'Ukuran file melebihi batas maksimal 5 MB.'
  }
  return null
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
