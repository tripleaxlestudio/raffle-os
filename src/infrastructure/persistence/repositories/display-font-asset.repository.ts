import Dexie, { type DexieOptions, type Table } from 'dexie'
import type { DisplayFontAssetRepository } from '../../../application/persistence/repositories/display-font-asset-repository.interface.ts'
import type { DisplayFontAsset } from '../../../domain/display/display-font-asset.types.ts'
import type { PrizeImageAsset } from '../../../domain/prizes/prize-asset.types.ts'
import { DEFAULT_PRIZE_ASSET_DATABASE_NAME, type DexiePrizeImageAssetRepositoryOptions } from './prize-image-asset.repository.ts'

class DisplayAssetDatabase extends Dexie {
  declare readonly prize_images: Table<PrizeImageAsset, string>
  declare readonly display_fonts: Table<DisplayFontAsset, string>

  constructor(databaseName: string, options: DexiePrizeImageAssetRepositoryOptions) {
    const dexieOptions: DexieOptions = {}
    if (options.IDBKeyRange !== undefined) dexieOptions.IDBKeyRange = options.IDBKeyRange
    if (options.indexedDB !== undefined) dexieOptions.indexedDB = options.indexedDB
    super(databaseName, dexieOptions)
    this.version(1).stores({ prize_images: '&id, createdAt' })
    this.version(2).stores({ prize_images: '&id, createdAt', display_fonts: '&id, createdAt' })
  }
}

function createAssetId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  const bytes = new Uint32Array(2)
  globalThis.crypto?.getRandomValues?.(bytes)
  return `font-${Date.now()}-${bytes[0]?.toString(36) ?? '0'}${bytes[1]?.toString(36) ?? '0'}`
}

export class DexieDisplayFontAssetRepository implements DisplayFontAssetRepository {
  private readonly db: DisplayAssetDatabase

  constructor(databaseName = DEFAULT_PRIZE_ASSET_DATABASE_NAME, options: DexiePrizeImageAssetRepositoryOptions = {}) {
    this.db = new DisplayAssetDatabase(databaseName, options)
  }

  async findById(id: string): Promise<DisplayFontAsset | null> {
    try { return await this.db.display_fonts.get(id) ?? null } catch { return null }
  }

  async save(asset: Omit<DisplayFontAsset, 'id' | 'createdAt'>): Promise<DisplayFontAsset> {
    const record = { ...asset, id: createAssetId(), createdAt: new Date().toISOString() }
    await this.db.display_fonts.put(record)
    return record
  }

  async delete(id: string): Promise<void> {
    try { await this.db.display_fonts.delete(id) } catch { /* Missing assets are already deleted. */ }
  }

  close(): void { this.db.close() }
}

