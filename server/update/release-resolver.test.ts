// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ReleaseResolverError, resolveLatestUpdateRelease, type ReleaseFetch } from './release-resolver.ts'

const installerName = 'Kocokan-Setup-0.1.2.exe'
const installer = { name: installerName, size: 70_000_000, browser_download_url: `https://github.com/tripleaxlestudio/raffle-os/releases/download/v0.1.2/${installerName}` }
const checksum = { name: 'checksums.txt', size: 500, browser_download_url: 'https://github.com/tripleaxlestudio/raffle-os/releases/download/v0.1.2/checksums.txt' }

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { tag_name: 'v0.1.2', draft: false, prerelease: false, assets: [installer, checksum], ...overrides }
}

function client(value: unknown, ok = true): ReleaseFetch {
  return async () => ({ ok, json: async () => value })
}

async function codeFor(value: unknown, current = '0.1.1', target = '0.1.2'): Promise<string | undefined> {
  try { await resolveLatestUpdateRelease(current, target, { fetch: client(value) }) } catch (cause: unknown) { return cause instanceof ReleaseResolverError ? cause.code : undefined }
  return undefined
}

describe('resolveLatestUpdateRelease', () => {
  it('resolves one stable release with exact assets', async () => {
    await expect(resolveLatestUpdateRelease('0.1.1', '0.1.2', { fetch: client(payload()) })).resolves.toMatchObject({ version: '0.1.2', tagName: 'v0.1.2', installer: { name: installerName }, checksum: { name: 'checksums.txt' } })
  })

  it.each([
    ['draft', payload({ draft: true }), 'unstable-release'],
    ['prerelease', payload({ prerelease: true }), 'unstable-release'],
    ['invalid tag', payload({ tag_name: '0.1.2' }), 'invalid-tag'],
    ['missing installer', payload({ assets: [checksum] }), 'missing-installer'],
    ['duplicate installer', payload({ assets: [installer, installer, checksum] }), 'duplicate-installer'],
    ['missing checksum', payload({ assets: [installer] }), 'missing-checksum'],
    ['duplicate checksum', payload({ assets: [installer, checksum, checksum] }), 'duplicate-checksum'],
  ])('rejects %s', async (_label, release, code) => {
    expect(await codeFor(release)).toBe(code)
  })

  it('rejects same-version and downgrade targets', async () => {
    expect(await codeFor(payload({ tag_name: 'v0.1.1', assets: [{ ...installer, name: 'Kocokan-Setup-0.1.1.exe' }, checksum] }), '0.1.1', '0.1.1')).toBe('not-newer')
    expect(await codeFor(payload({ tag_name: 'v0.1.1', assets: [{ ...installer, name: 'Kocokan-Setup-0.1.1.exe' }, checksum] }), '0.1.2', '0.1.1')).toBe('not-newer')
  })

  it('maps HTTP and network failures without leaking their details', async () => {
    await expect(resolveLatestUpdateRelease('0.1.1', '0.1.2', { fetch: client({}, false) })).rejects.toMatchObject({ code: 'http-error' })
    await expect(resolveLatestUpdateRelease('0.1.1', '0.1.2', { fetch: async () => { throw new TypeError('private network detail') } })).rejects.toMatchObject({ code: 'request-failed' })
  })
})
