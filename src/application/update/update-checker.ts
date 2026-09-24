export interface StableRelease {
  readonly tagName: string
  readonly version: string
  readonly htmlUrl: string
  readonly publishedAt: string
}

export interface UpdateReleaseClient {
  getLatestStableRelease(): Promise<StableRelease>
}

export type VersionComparison = -1 | 0 | 1

export type VersionComparisonResult =
  | {
      readonly ok: true
      readonly comparison: VersionComparison
      readonly currentVersion: string
      readonly latestVersion: string
    }
  | {
      readonly ok: false
      readonly reason: 'invalid-current-version' | 'invalid-latest-version'
    }

export type UpdateState =
  | { readonly status: 'idle' }
  | { readonly status: 'checking' }
  | {
      readonly status: 'up-to-date'
      readonly currentVersion: string
      readonly latestVersion: string
    }
  | {
      readonly status: 'update-available'
      readonly currentVersion: string
      readonly latestVersion: string
      readonly releaseUrl: string
    }
  | { readonly status: 'error' }

const STABLE_VERSION_PATTERN = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

function parseStableVersion(version: string): readonly [number, number, number] | null {
  const match = STABLE_VERSION_PATTERN.exec(version)
  if (match === null) return null

  const parts = match.slice(1).map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isSafeInteger(part))) return null
  return [parts[0]!, parts[1]!, parts[2]!]
}

export function normalizeStableVersion(version: string): string | null {
  const parsed = parseStableVersion(version)
  return parsed === null ? null : parsed.join('.')
}

export function compareStableVersions(currentVersion: string, latestVersion: string): VersionComparisonResult {
  const current = parseStableVersion(currentVersion)
  if (current === null) return { ok: false, reason: 'invalid-current-version' }

  const latest = parseStableVersion(latestVersion)
  if (latest === null) return { ok: false, reason: 'invalid-latest-version' }

  for (let index = 0; index < current.length; index += 1) {
    if (current[index]! < latest[index]!) {
      return {
        ok: true,
        comparison: -1,
        currentVersion: current.join('.'),
        latestVersion: latest.join('.'),
      }
    }
    if (current[index]! > latest[index]!) {
      return {
        ok: true,
        comparison: 1,
        currentVersion: current.join('.'),
        latestVersion: latest.join('.'),
      }
    }
  }

  return {
    ok: true,
    comparison: 0,
    currentVersion: current.join('.'),
    latestVersion: latest.join('.'),
  }
}

export async function checkForUpdate(
  currentVersion: string,
  client: UpdateReleaseClient,
): Promise<Exclude<UpdateState, { status: 'idle' | 'checking' }>> {
  try {
    const release = await client.getLatestStableRelease()
    const comparison = compareStableVersions(currentVersion, release.version)
    if (!comparison.ok) return { status: 'error' }

    if (comparison.comparison < 0) {
      return {
        status: 'update-available',
        currentVersion: comparison.currentVersion,
        latestVersion: comparison.latestVersion,
        releaseUrl: release.htmlUrl,
      }
    }

    return {
      status: 'up-to-date',
      currentVersion: comparison.currentVersion,
      latestVersion: comparison.latestVersion,
    }
  } catch {
    return { status: 'error' }
  }
}
