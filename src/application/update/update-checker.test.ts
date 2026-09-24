import { describe, expect, it } from 'vitest'
import {
  checkForUpdate,
  compareStableVersions,
  type StableRelease,
  type UpdateReleaseClient,
} from './update-checker.ts'

function release(version: string): StableRelease {
  return {
    tagName: `v${version}`,
    version,
    htmlUrl: `https://github.com/tripleaxlestudio/raffle-os/releases/tag/v${version}`,
    publishedAt: '2026-09-24T02:29:48Z',
  }
}

function clientWith(version: string): UpdateReleaseClient {
  return { getLatestStableRelease: async () => release(version) }
}

describe('compareStableVersions', () => {
  it('treats equal versions as equal', () => {
    expect(compareStableVersions('0.1.0', '0.1.0')).toMatchObject({ ok: true, comparison: 0 })
  })

  it('detects a patch update', () => {
    expect(compareStableVersions('0.1.0', '0.1.1')).toMatchObject({ ok: true, comparison: -1 })
  })

  it('detects a minor update', () => {
    expect(compareStableVersions('0.1.0', '0.2.0')).toMatchObject({ ok: true, comparison: -1 })
  })

  it('detects a major update', () => {
    expect(compareStableVersions('0.1.0', '1.0.0')).toMatchObject({ ok: true, comparison: -1 })
  })

  it('detects when the current version is newer', async () => {
    expect(compareStableVersions('0.1.1', '0.1.0')).toMatchObject({ ok: true, comparison: 1 })
    await expect(checkForUpdate('0.1.1', clientWith('0.1.0'))).resolves.toMatchObject({ status: 'up-to-date' })
  })

  it('accepts an optional leading v', () => {
    expect(compareStableVersions('v0.1.0', 'v0.1.1')).toEqual({
      ok: true,
      comparison: -1,
      currentVersion: '0.1.0',
      latestVersion: '0.1.1',
    })
  })

  it('returns a controlled error for a malformed current version', async () => {
    expect(compareStableVersions('development', '0.1.0')).toEqual({ ok: false, reason: 'invalid-current-version' })
    await expect(checkForUpdate('development', clientWith('0.1.0'))).resolves.toEqual({ status: 'error' })
  })

  it('returns a controlled error for a malformed latest version', () => {
    expect(compareStableVersions('0.1.0', '0.1')).toEqual({ ok: false, reason: 'invalid-latest-version' })
  })
})
