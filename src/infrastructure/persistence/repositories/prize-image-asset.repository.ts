import Dexie, { type Table, type DexieOptions } from 'dexie'
import type { PrizeImageAsset } from '../../../domain/prizes/prize-asset.types.ts'
import type { PrizeImageAssetRepository } from '../../../application/persistence/repositories/prize-image-asset-repository.interface.ts'

export const DEFAULT_PRIZE_ASSET_DATABASE_NAME = 'RaffleOS_PrizeAssets'

export interface DexiePrizeImageAssetRepositoryOptions {
  readonly indexedDB?: IDBFactory
  readonly IDBKeyRange?: typeof IDBKeyRange
}

class PrizeAssetDatabase extends Dexie {
  declare readonly prize_images: Table<PrizeImageAsset, string>

  constructor(
    databaseName = DEFAULT_PRIZE_ASSET_DATABASE_NAME,
    options: DexiePrizeImageAssetRepositoryOptions = {},
  ) {
    const dexieOptions: DexieOptions = {}
    if (options.IDBKeyRange !== undefined) {
      dexieOptions.IDBKeyRange = options.IDBKeyRange
    }
    if (options.indexedDB !== undefined) {
      dexieOptions.indexedDB = options.indexedDB
    }
    super(databaseName, dexieOptions)
    this.version(1).stores({
      prize_images: '&id, createdAt',
    })
    this.version(2).stores({
      prize_images: '&id, createdAt',
      display_fonts: '&id, createdAt',
    })
  }
}

export class DexiePrizeImageAssetRepository implements PrizeImageAssetRepository {
  private readonly db: PrizeAssetDatabase

  constructor(
    databaseName = DEFAULT_PRIZE_ASSET_DATABASE_NAME,
    options: DexiePrizeImageAssetRepositoryOptions = {},
  ) {
    this.db = new PrizeAssetDatabase(databaseName, options)
  }

  async findById(id: string): Promise<PrizeImageAsset | null> {
    try {
      const record = await this.db.prize_images.get(id)
      return record ?? null
    } catch {
      return null
    }
  }

  async save(asset: {
    readonly name: string
    readonly type: string
    readonly size: number
    readonly blob: Blob
  }): Promise<PrizeImageAsset> {
    const id = typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `asset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const record: PrizeImageAsset = {
      id,
      name: asset.name,
      type: asset.type,
      size: asset.size,
      blob: asset.blob,
      createdAt: new Date().toISOString(),
    }
    await this.db.prize_images.put(record)
    return record
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.prize_images.delete(id)
    } catch {
      // Ignore errors when deleting missing record
    }
  }

  close(): void {
    this.db.close()
  }
}
