import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DexiePrizeImageAssetRepository,
} from './prize-image-asset.repository.ts'

describe('DexiePrizeImageAssetRepository', () => {
  let repository: DexiePrizeImageAssetRepository
  const dbName = `RaffleOS_PrizeAssets_Test_${Date.now()}`

  beforeEach(() => {
    repository = new DexiePrizeImageAssetRepository(dbName, {
      indexedDB,
      IDBKeyRange,
    })
  })

  afterEach(() => {
    repository.close()
  })

  it('saves an image asset, retrieves it by ID, and preserves Blob contents', async () => {
    const blob = new Blob(['sample-image-bytes'], { type: 'image/png' })
    const saved = await repository.save({
      name: 'prize.png',
      type: 'image/png',
      size: blob.size,
      blob,
    })

    expect(saved.id).toBeDefined()
    expect(saved.name).toBe('prize.png')
    expect(saved.type).toBe('image/png')
    expect(saved.size).toBe(blob.size)

    const retrieved = await repository.findById(saved.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.id).toBe(saved.id)
    expect(retrieved?.name).toBe('prize.png')
    expect(retrieved?.size).toBe(blob.size)
    expect(retrieved?.blob).toBeDefined()
  })

  it('returns null for unknown asset ID', async () => {
    const result = await repository.findById('non-existent-id')
    expect(result).toBeNull()
  })

  it('deletes an existing asset by ID', async () => {
    const blob = new Blob(['bytes'], { type: 'image/webp' })
    const saved = await repository.save({
      name: 'delete-me.webp',
      type: 'image/webp',
      size: blob.size,
      blob,
    })

    await repository.delete(saved.id)
    const afterDelete = await repository.findById(saved.id)
    expect(afterDelete).toBeNull()
  })
})
