import {
  normalizeStableVersion,
  type StableRelease,
  type UpdateReleaseClient,
} from '../../application/update/update-checker.ts'

export const GITHUB_LATEST_RELEASE_ENDPOINT = 'https://api.github.com/repos/tripleaxlestudio/raffle-os/releases/latest'
export const DEFAULT_UPDATE_CHECK_TIMEOUT_MS = 5_000

type GithubReleaseClientErrorCode =
  | 'request-failed'
  | 'timeout'
  | 'http-error'
  | 'invalid-response'
  | 'unstable-release'

export class GithubReleaseClientError extends Error {
  readonly code: GithubReleaseClientErrorCode

  constructor(code: GithubReleaseClientErrorCode) {
    super(`GitHub release check failed: ${code}`)
    this.name = 'GithubReleaseClientError'
    this.code = code
  }
}

interface ReleaseResponse {
  readonly ok: boolean
  readonly status: number
  json(): Promise<unknown>
}

export type ReleaseFetch = (url: string, init: RequestInit) => Promise<ReleaseResponse>

interface GithubReleaseClientOptions {
  readonly fetch?: ReleaseFetch
  readonly timeoutMs?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return null
    return url.href
  } catch {
    return null
  }
}

function parsePublishedAt(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  return Number.isNaN(Date.parse(value)) ? null : value
}

function parseStableRelease(payload: unknown): StableRelease {
  if (!isRecord(payload)) throw new GithubReleaseClientError('invalid-response')

  const { tag_name: tagName, html_url: htmlUrl, draft, prerelease, published_at: publishedAt } = payload
  if (typeof draft !== 'boolean' || typeof prerelease !== 'boolean') {
    throw new GithubReleaseClientError('invalid-response')
  }
  if (draft || prerelease) throw new GithubReleaseClientError('unstable-release')
  if (typeof tagName !== 'string') throw new GithubReleaseClientError('invalid-response')

  const version = normalizeStableVersion(tagName)
  const releaseUrl = parseHttpsUrl(htmlUrl)
  const releasePublishedAt = parsePublishedAt(publishedAt)
  if (version === null || releaseUrl === null || releasePublishedAt === null) {
    throw new GithubReleaseClientError('invalid-response')
  }

  return {
    tagName,
    version,
    htmlUrl: releaseUrl,
    publishedAt: releasePublishedAt,
  }
}

export class GithubReleaseClient implements UpdateReleaseClient {
  readonly #fetch: ReleaseFetch
  readonly #timeoutMs: number

  constructor(options: GithubReleaseClientOptions = {}) {
    this.#fetch = options.fetch ?? ((url, init) => globalThis.fetch(url, init))
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_UPDATE_CHECK_TIMEOUT_MS
  }

  async getLatestStableRelease(): Promise<StableRelease> {
    const controller = new AbortController()
    const timeoutHandle = globalThis.setTimeout(() => controller.abort(), this.#timeoutMs)

    try {
      const response = await this.#fetch(GITHUB_LATEST_RELEASE_ENDPOINT, {
        method: 'GET',
        credentials: 'omit',
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        cache: 'no-store',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      })
      if (!response.ok) throw new GithubReleaseClientError('http-error')

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new GithubReleaseClientError('invalid-response')
      }
      return parseStableRelease(payload)
    } catch (cause: unknown) {
      if (cause instanceof GithubReleaseClientError) throw cause
      if (controller.signal.aborted) throw new GithubReleaseClientError('timeout')
      throw new GithubReleaseClientError('request-failed')
    } finally {
      globalThis.clearTimeout(timeoutHandle)
    }
  }
}

export const githubReleaseClient = new GithubReleaseClient()
