import { parseEnvelope, type ProtocolEnvelope } from './protocol.ts'

export const MAX_PUBLIC_ASSET_BYTES = 5 * 1024 * 1024
export const MAX_DISPLAY_WIRE_BYTES = 512 * 1024

type PublicAssetReference = Readonly<{
  readonly __raffleOsPublicAsset: Readonly<{ readonly id: string; readonly type: string; readonly size: number }>
}>

export type PublicAssetUpload = (asset: Readonly<{ id: string; type: string; blob: Blob }>) => Promise<void>
export type PublicAssetFetch = (reference: Readonly<{ id: string; type: string; size: number }>) => Promise<Blob>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAssetReference(value: unknown): value is PublicAssetReference {
  if (!isRecord(value) || !isRecord(value.__raffleOsPublicAsset)) return false
  const reference = value.__raffleOsPublicAsset
  return typeof reference.id === 'string' && reference.id.length > 0 && typeof reference.type === 'string' && reference.type.startsWith('image/') && typeof reference.size === 'number' && Number.isSafeInteger(reference.size) && reference.size >= 0 && reference.size <= MAX_PUBLIC_ASSET_BYTES
}

async function stableAssetId(blob: Blob): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return `sha256-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

async function encodeValue(value: unknown, upload: PublicAssetUpload): Promise<unknown> {
  if (value instanceof Blob) {
    if (!value.type.startsWith('image/')) throw new Error('Only public image assets may use the display wire codec.')
    if (value.size > MAX_PUBLIC_ASSET_BYTES) throw new Error('Public display asset exceeds the 5 MB limit.')
    const id = await stableAssetId(value)
    await upload({ id, type: value.type, blob: value })
    return { __raffleOsPublicAsset: { id, type: value.type, size: value.size } } satisfies PublicAssetReference
  }
  if (Array.isArray(value)) return Promise.all(value.map((item) => encodeValue(item, upload)))
  if (!isRecord(value)) return value
  const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await encodeValue(item, upload)] as const))
  return Object.fromEntries(entries)
}

async function decodeValue(value: unknown, fetchAsset: PublicAssetFetch): Promise<unknown> {
  if (isAssetReference(value)) {
    const blob = await fetchAsset(value.__raffleOsPublicAsset)
    if (blob.size !== value.__raffleOsPublicAsset.size || blob.size > MAX_PUBLIC_ASSET_BYTES || blob.type !== value.__raffleOsPublicAsset.type) throw new Error('Public display asset response does not match its reference.')
    return blob
  }
  if (Array.isArray(value)) return Promise.all(value.map((item) => decodeValue(item, fetchAsset)))
  if (!isRecord(value)) return value
  const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await decodeValue(item, fetchAsset)] as const))
  return Object.fromEntries(entries)
}

export async function encodeDisplayWireEnvelope(envelope: ProtocolEnvelope, upload: PublicAssetUpload): Promise<string> {
  const parsed = parseEnvelope(envelope)
  if (!parsed.ok) throw new Error(`Cannot encode invalid display envelope: ${parsed.error.kind}`)
  const wire = JSON.stringify(await encodeValue(parsed.envelope, upload))
  if (new TextEncoder().encode(wire).byteLength > MAX_DISPLAY_WIRE_BYTES) throw new Error('Display wire envelope exceeds the 512 KB limit.')
  return wire
}

export async function decodeDisplayWireEnvelope(wire: string, fetchAsset: PublicAssetFetch): Promise<ProtocolEnvelope> {
  if (new TextEncoder().encode(wire).byteLength > MAX_DISPLAY_WIRE_BYTES) throw new Error('Display wire envelope exceeds the 512 KB limit.')
  const materialized = await decodeValue(JSON.parse(wire) as unknown, fetchAsset)
  const parsed = parseEnvelope(materialized)
  if (!parsed.ok) throw new Error(`Invalid display wire envelope: ${parsed.error.kind}`)
  return parsed.envelope
}
