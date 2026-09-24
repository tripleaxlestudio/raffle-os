import { describe, expect, it } from 'vitest'
import {
  ALLOWED_PRIZE_IMAGE_TYPES,
  MAX_PRIZE_IMAGE_SIZE_BYTES,
  validatePrizeImageFile,
} from './prize.types.ts'

describe('validatePrizeImageFile', () => {
  it('accepts supported MIME types within size limit', () => {
    for (const type of ALLOWED_PRIZE_IMAGE_TYPES) {
      expect(validatePrizeImageFile({ type, size: 1024 })).toBeNull()
      expect(validatePrizeImageFile({ type, size: MAX_PRIZE_IMAGE_SIZE_BYTES })).toBeNull()
    }
  })

  it('rejects unsupported MIME types', () => {
    const invalidTypes = ['image/gif', 'application/pdf', 'text/plain', 'image/svg+xml']
    for (const type of invalidTypes) {
      const error = validatePrizeImageFile({ type, size: 1024 })
      expect(error).toBe('Format file tidak didukung. Gunakan PNG, JPG, atau WebP.')
    }
  })

  it('rejects files larger than 5 MB', () => {
    const error = validatePrizeImageFile({
      type: 'image/png',
      size: MAX_PRIZE_IMAGE_SIZE_BYTES + 1,
    })
    expect(error).toBe('Ukuran file melebihi batas maksimal 5 MB.')
  })
})
