import type { EventId } from '../shared/identifiers.ts'

export type BlackoutAppearance = 'pure-black' | 'event-surface'
export type LocalAssetKind = 'image' | 'audio'
export type LocalAsset = Readonly<{ name: string; type: string; size: number; blob: Blob }>

export interface EventSettings {
  readonly eventId: EventId
  readonly displayName: string
  readonly subtitle: string
  readonly primaryColor: string
  readonly accentColor: string
  readonly safeAreaMargin: number
  readonly blackoutAppearance: BlackoutAppearance
  readonly audioEnabled: boolean
  readonly masterVolume: number
  readonly logo?: LocalAsset
  readonly background?: LocalAsset
  readonly revealCue?: LocalAsset
  readonly updatedAt: string
}

export const DEFAULT_EVENT_SETTINGS = {
  displayName: '', subtitle: '', primaryColor: '#7567FF', accentColor: '#F2A93B', safeAreaMargin: 48,
  blackoutAppearance: 'pure-black' as const, audioEnabled: false, masterVolume: 72,
}

export function validateHexColor(value: string): boolean { return /^#[0-9a-f]{6}$/i.test(value) }
export function validateAsset(asset: LocalAsset | undefined, kind: LocalAssetKind): string | null {
  if (asset === undefined) return null
  const max = kind === 'audio' ? 10 * 1024 * 1024 : 5 * 1024 * 1024
  const allowed = kind === 'audio' ? asset.type.startsWith('audio/') : asset.type.startsWith('image/')
  if (!allowed) return kind === 'audio' ? 'Cue audio must be an audio file.' : 'Branding assets must be image files.'
  if (asset.size > max) return `The ${kind} asset must be ${max / 1024 / 1024} MB or smaller.`
  return null
}
