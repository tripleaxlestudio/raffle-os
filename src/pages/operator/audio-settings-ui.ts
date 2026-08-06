import { validateAsset, type LocalAsset } from '../../domain/settings/event-settings.types.ts'

export function isValidRevealCue(asset: LocalAsset | undefined): asset is LocalAsset {
  return asset !== undefined && validateAsset(asset, 'audio') === null
}

export function formatAudioAssetSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
