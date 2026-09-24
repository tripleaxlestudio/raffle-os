import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_UPDATE_CHECK_TIMEOUT_MS,
  GITHUB_LATEST_RELEASE_ENDPOINT,
  GithubReleaseClient,
  GithubReleaseClientError,
  type ReleaseFetch,
} from './github-release-client.ts'

const stablePayload = {
  tag_name: 'v0.1.0',
  html_url: 'https://github.com/tripleaxlestudio/raffle-os/releases/tag/v0.1.0',
  draft: false,
  prerelease: false,
  published_at: '2026-09-24T02:29:48Z',
}

function responseWith(payload: unknown): Awaited<ReturnType<ReleaseFetch>> {
  return { ok: true, status: 200, json: async () => payload }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('GithubReleaseClient', () => {
  it('returns a validated stable release through the fixed anonymous GET endpoint', async () => {
    const fetchMock = vi.fn<ReleaseFetch>(async () => responseWith(stablePayload))
    const client = new GithubReleaseClient({ fetch: fetchMock })

    await expect(client.getLatestStableRelease()).resolves.toEqual({
      tagName: 'v0.1.0',
      version: '0.1.0',
      htmlUrl: stablePayload.html_url,
      publishedAt: stablePayload.published_at,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(GITHUB_LATEST_RELEASE_ENDPOINT, expect.objectContaining({
      method: 'GET',
      credentials: 'omit',
      signal: expect.any(AbortSignal),
    }))
    const request = fetchMock.mock.calls[0]?.[1]
    expect(request?.headers).not.toHaveProperty('Authorization')
  })

  it('maps a network failure to a controlled error', async () => {
    const client = new GithubReleaseClient({ fetch: async () => { throw new TypeError('offline') } })
    await expect(client.getLatestStableRelease()).rejects.toMatchObject({ code: 'request-failed' })
  })

  it('aborts a request after the configured timeout', async () => {
    vi.useFakeTimers()
    const fetchMock: ReleaseFetch = async (_url, init) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })
    const client = new GithubReleaseClient({ fetch: fetchMock, timeoutMs: DEFAULT_UPDATE_CHECK_TIMEOUT_MS })
    const expectation = expect(client.getLatestStableRelease()).rejects.toMatchObject({ code: 'timeout' })

    await vi.advanceTimersByTimeAsync(DEFAULT_UPDATE_CHECK_TIMEOUT_MS)
    await expectation
  })

  it('rejects malformed JSON and malformed response shapes', async () => {
    const invalidJsonClient = new GithubReleaseClient({
      fetch: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json') } }),
    })
    const malformedClient = new GithubReleaseClient({ fetch: async () => responseWith([]) })

    await expect(invalidJsonClient.getLatestStableRelease()).rejects.toBeInstanceOf(GithubReleaseClientError)
    await expect(malformedClient.getLatestStableRelease()).rejects.toMatchObject({ code: 'invalid-response' })
  })

  it('rejects a response missing tag_name', async () => {
    const payload = {
      html_url: stablePayload.html_url,
      draft: stablePayload.draft,
      prerelease: stablePayload.prerelease,
      published_at: stablePayload.published_at,
    }
    const client = new GithubReleaseClient({ fetch: async () => responseWith(payload) })
    await expect(client.getLatestStableRelease()).rejects.toMatchObject({ code: 'invalid-response' })
  })

  it('rejects draft releases', async () => {
    const client = new GithubReleaseClient({ fetch: async () => responseWith({ ...stablePayload, draft: true }) })
    await expect(client.getLatestStableRelease()).rejects.toMatchObject({ code: 'unstable-release' })
  })

  it('rejects prereleases', async () => {
    const client = new GithubReleaseClient({ fetch: async () => responseWith({ ...stablePayload, prerelease: true }) })
    await expect(client.getLatestStableRelease()).rejects.toMatchObject({ code: 'unstable-release' })
  })

  it('rejects a non-HTTPS release URL', async () => {
    const client = new GithubReleaseClient({
      fetch: async () => responseWith({ ...stablePayload, html_url: 'http://github.com/tripleaxlestudio/raffle-os/releases/tag/v0.1.0' }),
    })
    await expect(client.getLatestStableRelease()).rejects.toMatchObject({ code: 'invalid-response' })
  })
})
