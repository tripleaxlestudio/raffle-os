import type { DisplayFontAsset } from '../../../domain/display/display-font-asset.types.ts'

export interface DisplayFontAssetRepository {
  findById(id: string): Promise<DisplayFontAsset | null>
  save(asset: Omit<DisplayFontAsset, 'id' | 'createdAt'>): Promise<DisplayFontAsset>
  delete(id: string): Promise<void>
  close(): void
}

