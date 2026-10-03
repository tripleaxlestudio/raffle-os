import type { PrizeImageAsset } from '../../domain/prizes/prize-asset.types.ts'
import { ALLOWED_PRIZE_IMAGE_TYPES, MAX_PRIZE_IMAGE_SIZE_BYTES } from '../../domain/prizes/prize.types.ts'

export interface PrizeImageBackupStore {
  readForBackup(ids: readonly string[]): Promise<readonly PrizeImageAsset[]>
  stageForRestore(assets: readonly PrizeImageAsset[]): Promise<ReadonlyMap<string, string>>
  discardStaged(ids: readonly string[]): Promise<void>
}

export interface SerializedPrizeImage {
  readonly id: string
  readonly name: string
  readonly type: string
  readonly size: number
  readonly createdAt: string
  readonly base64: string
  readonly sha256: string
}

// Bounds only this extension; other existing backup classes are not redesigned.
export const MAX_BACKUP_PRIZE_IMAGE_BYTES = 64 * 1024 * 1024

export function validatePrizeImageBackup(value: unknown, references: readonly unknown[]): string | null {
  if (!Array.isArray(value)) return 'Data gambar hadiah harus berupa array.'
  const ids = new Set<string>()
  let total = 0
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) return 'Data gambar hadiah tidak valid.'
    const image: Record<string, unknown> = raw
    if (typeof image.id !== 'string' || !image.id.trim() || ids.has(image.id) || typeof image.name !== 'string' || !image.name.trim()) return 'ID/nama gambar hadiah tidak valid atau duplikat.'
    if (typeof image.type !== 'string' || !(ALLOWED_PRIZE_IMAGE_TYPES as readonly string[]).includes(image.type)) return 'Format gambar hadiah tidak didukung.'
    if (typeof image.size !== 'number' || !Number.isInteger(image.size) || image.size <= 0 || image.size > MAX_PRIZE_IMAGE_SIZE_BYTES) return 'Ukuran gambar hadiah tidak valid (maksimal 5 MB per gambar).'
    total += image.size
    if (total > MAX_BACKUP_PRIZE_IMAGE_BYTES) return 'Total gambar hadiah backup melebihi batas 64 MB.'
    if (typeof image.createdAt !== 'string' || Number.isNaN(Date.parse(image.createdAt))) return 'Tanggal gambar hadiah tidak valid.'
    if (typeof image.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(image.sha256)) return 'Checksum gambar hadiah tidak valid.'
    if (typeof image.base64 !== 'string' || image.base64.length !== 4 * Math.ceil(image.size / 3) || /[^A-Za-z0-9+/=]/.test(image.base64)) return 'Encoding gambar hadiah tidak valid.'
    try { const decoded = atob(image.base64); if (decoded.length !== image.size || btoa(decoded) !== image.base64) return 'Ukuran atau encoding isi gambar hadiah tidak sesuai.' } catch { return 'Encoding gambar hadiah tidak valid.' }
    ids.add(image.id)
  }
  for (const id of references) if (typeof id !== 'string' || !ids.has(id)) return 'Referensi gambar hadiah tidak tersedia dalam backup.'
  return null
}

export async function prizeImageHash(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
