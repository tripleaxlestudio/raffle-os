import { compareStableVersions, normalizeStableVersion } from '../../src/application/update/update-checker.ts'

export const KOCOKAN_LATEST_RELEASE_ENDPOINT = 'https://api.github.com/repos/tripleaxlestudio/raffle-os/releases/latest'
export const DEFAULT_RELEASE_RESOLVE_TIMEOUT_MS = 5_000
export const MIN_INSTALLER_BYTES = 1 * 1024 * 1024
export const MAX_INSTALLER_BYTES = 512 * 1024 * 1024
export const MAX_CHECKSUM_BYTES = 1 * 1024 * 1024

export type ReleaseResolverErrorCode =
  | 'request-failed'
  | 'timeout'
  | 'http-error'
  | 'invalid-response'
  | 'unstable-release'
  | 'invalid-tag'
  | 'target-mismatch'
  | 'not-newer'
  | 'missing-installer'
  | 'duplicate-installer'
  | 'missing-checksum'
  | 'duplicate-checksum'
  | 'invalid-asset'

export class ReleaseResolverError extends Error {
  readonly code: ReleaseResolverErrorCode

  constructor(code: ReleaseResolverErrorCode) {
    super(`Release resolution failed: ${code}`)
    this.name = 'ReleaseResolverError'
    this.code = code
  }
}

export interface ResolvedReleaseAsset {
  readonly name: string
  readonly size: number
  readonly downloadUrl: string
}

export interface ResolvedUpdateRelease {
  readonly version: string
  readonly tagName: string
  readonly installer: ResolvedReleaseAsset
  readonly checksum: ResolvedReleaseAsset
}

interface ReleaseResponse {
  readonly ok: boolean
  json(): Promise<unknown>
}

export type ReleaseFetch = (url: string, init: RequestInit) => Promise<ReleaseResponse>

export interface ReleaseResolverOptions {
  readonly fetch?: ReleaseFetch
  readonly timeoutMs?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseAsset(value: unknown, minimumBytes: number, maximumBytes: number): ResolvedReleaseAsset {
  if (!isRecord(value)) throw new ReleaseResolverError('invalid-asset')
  const { name, size, browser_download_url: downloadUrl } = value
  if (typeof name !== 'string' || name.length === 0 || typeof size !== 'number' || !Number.isSafeInteger(size) || size < minimumBytes || size > maximumBytes || typeof downloadUrl !== 'string') {
    throw new ReleaseResolverError('invalid-asset')
  }
  try {
    const parsed = new URL(downloadUrl)
    if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '') throw new ReleaseResolverError('invalid-asset')
  } catch (cause: unknown) {
    if (cause instanceof ReleaseResolverError) throw cause
    throw new ReleaseResolverError('invalid-asset')
  }
  return { name, size, downloadUrl }
}

function oneAsset(
  assets: readonly unknown[],
  expectedName: string,
  minimumBytes: number,
  maximumBytes: number,
  missingCode: ReleaseResolverErrorCode,
  duplicateCode: ReleaseResolverErrorCode,
): ResolvedReleaseAsset {
  const matches = assets.filter((asset) => isRecord(asset) && asset.name === expectedName)
  if (matches.length === 0) throw new ReleaseResolverError(missingCode)
  if (matches.length !== 1) throw new ReleaseResolverError(duplicateCode)
  return parseAsset(matches[0], minimumBytes, maximumBytes)
}

function requireOfficialReleaseUrl(asset: ResolvedReleaseAsset, tagName: string): ResolvedReleaseAsset {
  const url = new URL(asset.downloadUrl)
  const expectedPath = `/tripleaxlestudio/raffle-os/releases/download/${tagName}/${asset.name}`
  if (url.hostname !== 'github.com' || url.port !== '' || url.pathname !== expectedPath || url.search !== '' || url.hash !== '') throw new ReleaseResolverError('invalid-asset')
  return asset
}

export async function resolveLatestUpdateRelease(
  currentVersion: string,
  targetVersion: string,
  options: ReleaseResolverOptions = {},
): Promise<ResolvedUpdateRelease> {
  const normalizedCurrent = normalizeStableVersion(currentVersion)
  const normalizedTarget = normalizeStableVersion(targetVersion)
  if (normalizedCurrent === null || normalizedTarget === null || normalizedTarget !== targetVersion) throw new ReleaseResolverError('target-mismatch')

  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const releaseFetch = options.fetch ?? ((url, init) => globalThis.fetch(url, init))
  try {
    const response = await Promise.race([
      releaseFetch(KOCOKAN_LATEST_RELEASE_ENDPOINT, {
        method: 'GET',
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        redirect: 'error',
        signal: controller.signal,
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => { controller.abort(); reject(new ReleaseResolverError('timeout')) }, options.timeoutMs ?? DEFAULT_RELEASE_RESOLVE_TIMEOUT_MS)
      }),
    ])
    if (!response.ok) throw new ReleaseResolverError('http-error')
    let payload: unknown
    try { payload = await response.json() } catch { throw new ReleaseResolverError('invalid-response') }
    if (!isRecord(payload) || typeof payload.draft !== 'boolean' || typeof payload.prerelease !== 'boolean' || !Array.isArray(payload.assets)) throw new ReleaseResolverError('invalid-response')
    if (payload.draft || payload.prerelease) throw new ReleaseResolverError('unstable-release')
    if (typeof payload.tag_name !== 'string' || !/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(payload.tag_name)) throw new ReleaseResolverError('invalid-tag')
    if (payload.tag_name !== `v${normalizedTarget}`) throw new ReleaseResolverError('target-mismatch')
    const comparison = compareStableVersions(normalizedCurrent, normalizedTarget)
    if (!comparison.ok || comparison.comparison >= 0) throw new ReleaseResolverError('not-newer')

    const installerName = `Kocokan-Setup-${normalizedTarget}.exe`
    const tagName = payload.tag_name
    return {
      version: normalizedTarget,
      tagName,
      installer: requireOfficialReleaseUrl(oneAsset(payload.assets, installerName, MIN_INSTALLER_BYTES, MAX_INSTALLER_BYTES, 'missing-installer', 'duplicate-installer'), tagName),
      checksum: requireOfficialReleaseUrl(oneAsset(payload.assets, 'checksums.txt', 1, MAX_CHECKSUM_BYTES, 'missing-checksum', 'duplicate-checksum'), tagName),
    }
  } catch (cause: unknown) {
    if (cause instanceof ReleaseResolverError) throw cause
    if (controller.signal.aborted) throw new ReleaseResolverError('timeout')
    throw new ReleaseResolverError('request-failed')
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
  }
}
