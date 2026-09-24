import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DexieDisplayFontAssetRepository } from './display-font-asset.repository.ts'

describe('DexieDisplayFontAssetRepository', () => {
  let repository: DexieDisplayFontAssetRepository
  const dbName = `RaffleOS_DisplayFonts_Test_${Date.now()}`

  beforeEach(() => { repository = new DexieDisplayFontAssetRepository(dbName, { indexedDB, IDBKeyRange }) })
  afterEach(() => repository.close())

  it('persists an offline font blob by stable asset ID and deletes it explicitly', async () => {
    const blob = new Blob(['font-bytes'], { type: 'font/woff2' })
    const saved = await repository.save({ name: 'event.woff2', type: blob.type, size: blob.size, blob })
    expect(await repository.findById(saved.id)).toMatchObject({ id: saved.id, name: 'event.woff2', type: 'font/woff2', size: blob.size })
    await repository.delete(saved.id)
    expect(await repository.findById(saved.id)).toBeNull()
  })
})
