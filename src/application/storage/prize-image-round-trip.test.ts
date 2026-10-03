// @vitest-environment node
import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RaffleOSDatabase } from '../../infrastructure/persistence/db.ts'
import { DexiePrizeImageAssetRepository } from '../../infrastructure/persistence/repositories/prize-image-asset.repository.ts'
import { createBackup, executeRestore, previewBackup, validateBackupEnvelope, validateBackupPrizeImages } from './storage-service.ts'
import { prizeImageHash, validatePrizeImageBackup } from './prize-image-backup.ts'
import { KOCOKAN_APP_VERSION } from '../../config/app-version.ts'
import type { EventId, PrizeCategoryId } from '../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'

vi.mock('../../app/workspace/ProductionWorkspaceContext.tsx', () => ({ signalProductionWorkspaceChanged: vi.fn() }))

describe('Portable prize image backup and restore', () => {
  const options = { indexedDB, IDBKeyRange }
  const opened: Array<{ close(): void }> = []
  let count = 0
  function database() { const db = new RaffleOSDatabase(`StorageAB-${Date.now()}-${++count}`, options); opened.push(db); return db }
  function assets(name = `AssetsAB-${Date.now()}-${++count}`) { const store = new DexiePrizeImageAssetRepository(name, options); opened.push(store); return store }
  const eventId = 'event-ab' as EventId
  const date = '2026-10-03T00:00:00.000Z' as IsoTimestamp
  async function seed(db: RaffleOSDatabase, ids: readonly (string | undefined)[]) {
    await db.openSupported()
    await db.events.add({ id: eventId, name: 'Isolated fixture', status: 'draft', createdAt: date, updatedAt: date })
    await db.prize_categories.bulkAdd(ids.map((id, index) => ({ id: `category-${index}` as PrizeCategoryId, eventId, name: `Hadiah ${index}`, prizeName: `Prize ${index}`, displayOrder: index, createdAt: date, ...(id === undefined ? {} : { prizeImageAssetId: id }) })))
  }
  async function image(store: DexiePrizeImageAssetRepository, bytes = [0, 1, 127, 128, 254, 255]) {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    return store.save({ name: 'fixture.png', type: blob.type, size: blob.size, blob })
  }
  afterEach(() => { for (const resource of opened.splice(0)) resource.close(); vi.restoreAllMocks() })

  it('keeps schema v1 separate from current version and restores a prize without image', async () => {
    const db = database(); await seed(db, [undefined])
    const backup = await createBackup(db, KOCOKAN_APP_VERSION)
    expect(backup.appVersion).toBe(KOCOKAN_APP_VERSION)
    expect(backup.version).toBe(1)
    const target = database(); await executeRestore(target, backup)
    expect(await target.prize_categories.count()).toBe(1)
  })

  it('preserves distinct bytes, shared associations and persistence after reopen', async () => {
    const source = database(); const store = assets()
    const first = await image(store); const second = await image(store, [9, 8, 7, 6])
    await seed(source, [first.id, second.id, first.id])
    // React StrictMode can close the owned adapter during effect replay.
    store.close()
    const backup = await createBackup(source, KOCOKAN_APP_VERSION, store)
    expect(backup.data.prizeImageAssets).toHaveLength(2)
    const parsed = validateBackupEnvelope(JSON.stringify(backup)); if (!parsed.ok) throw new Error(parsed.error)
    expect(previewBackup(parsed.value).prizeImageCount).toBe(2)
    const target = database(); const targetName = `RestoredAssets-${Date.now()}-${++count}`; const targetStore = assets(targetName)
    await executeRestore(target, parsed.value, targetStore)
    target.close(); await target.openSupported(); targetStore.close()
    const reopened = assets(targetName); const categories = await target.prize_categories.toArray()
    expect(categories[0].prizeImageAssetId).toBe(categories[2].prizeImageAssetId)
    expect(categories[0].prizeImageAssetId).not.toBe(categories[1].prizeImageAssetId)
    for (const [index, expected] of [first, second].entries()) {
      const restored = await reopened.findById(categories[index].prizeImageAssetId!)
      expect(restored?.name).toBe(expected.name)
      expect(restored?.type).toBe(expected.type)
      expect(restored?.size).toBe(expected.size)
      expect(await prizeImageHash(restored!.blob)).toBe(await prizeImageHash(expected.blob))
    }
  })

  it('fails backup when a referenced asset is missing instead of exporting a broken reference', async () => {
    const db = database(); await seed(db, ['missing'])
    await expect(createBackup(db, KOCOKAN_APP_VERSION, assets())).rejects.toThrow('tidak tersedia')
  })

  it('accepts a 5 MiB encoding without recursive regex overflow and rejects over 64 MiB aggregate', () => {
    const entry = { id: 'large', name: 'large.png', type: 'image/png', size: 5 * 1024 * 1024, createdAt: date, base64: btoa('a'.repeat(5 * 1024 * 1024)), sha256: '0'.repeat(64) }
    expect(validatePrizeImageBackup([entry], ['large'])).toBeNull()
    expect(validatePrizeImageBackup(Array.from({ length: 13 }, (_, index) => ({ ...entry, id: `large-${index}` })), [])).toContain('64 MB')
  })

  it('leaves current data untouched if asset staging fails', async () => {
    const db = database(); const store = assets(); const saved = await image(store); await seed(db, [saved.id])
    const backup = await createBackup(db, KOCOKAN_APP_VERSION, store)
    vi.spyOn(store, 'stageForRestore').mockRejectedValue(new Error('Isolated asset write failure'))
    await expect(executeRestore(db, backup, store)).rejects.toThrow('asset write failure')
    expect((await db.prize_categories.toArray())[0].prizeImageAssetId).toBe(saved.id)
    expect(await store.findById(saved.id)).not.toBeNull()
  })

  it('restores legacy appVersion 0.1.0 and warns/detaches references absent from legacy files', async () => {
    const db = database(); await seed(db, [undefined])
    const current = await createBackup(db, '0.1.0')
    const { prizeImageAssets: omitted, ...data } = current.data
    expect(omitted).toEqual([])
    const legacy = { ...current, data: { ...data, prizeCategories: data.prizeCategories.map((category) => ({ ...category, prizeImageAssetId: 'old-unportable-reference' })) } }
    const result = validateBackupEnvelope(JSON.stringify(legacy)); expect(result.ok).toBe(true)
    expect(previewBackup(legacy).missingPrizeImageCount).toBe(1)
    const target = database(); await executeRestore(target, legacy)
    expect((await target.prize_categories.toArray())[0].prizeImageAssetId).toBeUndefined()
  })

  it.each(['missing', 'encoding', 'size', 'duplicate', 'mime'])('rejects invalid %s asset data before restore', async (kind) => {
    const db = database(); const store = assets(); const saved = await image(store); await seed(db, [saved.id])
    const backup = await createBackup(db, KOCOKAN_APP_VERSION, store)
    const entry = backup.data.prizeImageAssets![0]
    const changed = kind === 'missing' ? [] : kind === 'duplicate' ? [entry, entry] : [{ ...entry, ...(kind === 'encoding' ? { base64: '!' } : kind === 'size' ? { size: 6 * 1024 * 1024 } : { type: 'text/html' }) }]
    const bad = { ...backup, data: { ...backup.data, prizeImageAssets: changed } }
    expect(validateBackupEnvelope(JSON.stringify(bad)).ok).toBe(false)
    await expect(executeRestore(db, bad, store)).rejects.toThrow()
    expect(await db.events.count()).toBe(1)
    expect(await store.findById(saved.id)).not.toBeNull()
  })

  it('rejects same-length byte corruption through checksum before database replacement', async () => {
    const db = database(); const store = assets(); const saved = await image(store); await seed(db, [saved.id])
    const backup = await createBackup(db, KOCOKAN_APP_VERSION, store)
    const bad = { ...backup, data: { ...backup.data, prizeImageAssets: backup.data.prizeImageAssets!.map((entry) => ({ ...entry, base64: btoa('abcdef') })) } }
    await expect(validateBackupPrizeImages(bad)).rejects.toThrow('Checksum')
    await expect(executeRestore(db, bad, store)).rejects.toThrow('Checksum')
    expect((await db.prize_categories.toArray())[0].prizeImageAssetId).toBe(saved.id)
  })

  it('rolls back the main transaction and discards newly staged assets when a write fails', async () => {
    const db = database(); const store = assets(); const saved = await image(store); await seed(db, [saved.id])
    const backup = await createBackup(db, KOCOKAN_APP_VERSION, store)
    const stage = vi.spyOn(store, 'stageForRestore'); const discard = vi.spyOn(store, 'discardStaged')
    const broken = { ...backup, data: { ...backup.data, events: [...backup.data.events, ...backup.data.events] } }
    await expect(executeRestore(db, broken, store)).rejects.toThrow()
    const mapping = await stage.mock.results[0].value
    expect(discard).toHaveBeenCalledWith([...mapping.values()])
    for (const id of mapping.values()) expect(await store.findById(id)).toBeNull()
    expect(await db.events.count()).toBe(1)
    expect((await db.prize_categories.toArray())[0].prizeImageAssetId).toBe(saved.id)
    expect(await store.findById(saved.id)).not.toBeNull()
  })
})
