import type { PrizeImageAsset } from '../../../domain/prizes/prize-asset.types.ts'

export interface PrizeImageAssetRepository {
  findById(id: string): Promise<PrizeImageAsset | null>
  save(asset: {
    readonly name: string
    readonly type: string
    readonly size: number
    readonly blob: Blob
  }): Promise<PrizeImageAsset>
  delete(id: string): Promise<void>
}
