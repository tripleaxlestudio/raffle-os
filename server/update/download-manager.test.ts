// @vitest-environment node
import { createHash } from 'node:crypto'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DownloadError, downloadVerifiedInstaller, type DownloadFetch, type DownloadResponse } from './download-manager.ts'

let directory: string
const allowedHosts = new Set(['download.test'])
const sourceUrl = 'https://download.test/installer.exe'
const fileName = 'Kocokan-Setup-0.1.2.exe'

beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'kocokan-update-download-')) })
afterEach(async () => { await rm(directory, { recursive: true, force: true }) })

function response(chunks: readonly Uint8Array[], headers: Record<string, string> = {}, status = 200, fail = false): DownloadResponse {
  let index = 0
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    body: {
      getReader: () => ({
        read: async () => {
          if (fail && index === chunks.length) throw new Error('partial stream')
          if (index === chunks.length) return { done: true, value: undefined }
          return { done: false, value: chunks[index++]! }
        },
      }),
    },
  }
}

function options(fetcher: DownloadFetch, bytes: Uint8Array, overrides: Partial<Parameters<typeof downloadVerifiedInstaller>[0]> = {}) {
  return {
    sourceUrl,
    updateRoot: directory,
    version: '0.1.2',
    fileName,
    expectedBytes: bytes.byteLength,
    expectedSha256: createHash('sha256').update(bytes).digest('hex'),
    fetch: fetcher,
    allowedHosts,
    ...overrides,
  }
}

describe('downloadVerifiedInstaller', () => {
  it('streams progress and atomically finalizes a verified installer', async () => {
    const bytes = Buffer.from('verified installer bytes')
    const progress = vi.fn()
    const verifying = vi.fn()
    const result = await downloadVerifiedInstaller(options(async () => response([bytes.subarray(0, 8), bytes.subarray(8)], { 'content-length': String(bytes.length) }), bytes, { onProgress: progress, onVerifying: verifying }))
    expect(result).toMatchObject({ fileName, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
    expect(await readFile(join(directory, '0.1.2', fileName))).toEqual(bytes)
    expect(progress).toHaveBeenLastCalledWith({ downloadedBytes: bytes.length, totalBytes: bytes.length, percent: 100 })
    expect(verifying).toHaveBeenCalledOnce()
    await expect(access(join(directory, '0.1.2', `${fileName}.part`))).rejects.toThrow()
  })

  it('reports indeterminate progress without Content-Length', async () => {
    const bytes = Buffer.from('no length')
    const progress = vi.fn()
    await downloadVerifiedInstaller(options(async () => response([bytes]), bytes, { onProgress: progress }))
    expect(progress).toHaveBeenLastCalledWith({ downloadedBytes: bytes.length })
  })

  it('times out and cleans the partial file', async () => {
    const bytes = Buffer.from('timeout')
    const never: DownloadFetch = () => new Promise(() => undefined)
    await expect(downloadVerifiedInstaller(options(never, bytes, { timeoutMs: 5 }))).rejects.toMatchObject({ code: 'timeout' })
    await expect(access(join(directory, '0.1.2', `${fileName}.part`))).rejects.toThrow()
  })

  it('rejects partial streams, byte mismatches, and SHA256 mismatches with cleanup', async () => {
    const bytes = Buffer.from('expected')
    await expect(downloadVerifiedInstaller(options(async () => response([bytes.subarray(0, 3)], {}, 200, true), bytes))).rejects.toMatchObject({ code: 'stream-failed' })
    await expect(downloadVerifiedInstaller(options(async () => response([bytes.subarray(0, 3)]), bytes))).rejects.toMatchObject({ code: 'byte-count-mismatch' })
    await expect(downloadVerifiedInstaller(options(async () => response([bytes]), bytes, { expectedSha256: '0'.repeat(64) }))).rejects.toMatchObject({ code: 'checksum-mismatch' })
    await expect(access(join(directory, '0.1.2', `${fileName}.part`))).rejects.toThrow()
    await expect(access(join(directory, '0.1.2', fileName))).rejects.toThrow()
  })

  it('rejects unsafe redirect schemes and hosts', async () => {
    const bytes = Buffer.from('redirect')
    const insecure: DownloadFetch = async () => response([], { location: 'http://download.test/file' }, 302)
    await expect(downloadVerifiedInstaller(options(insecure, bytes))).rejects.toMatchObject({ code: 'unsafe-redirect' } satisfies Partial<DownloadError>)
    const foreign: DownloadFetch = async () => response([], { location: 'https://attacker.invalid/file' }, 302)
    await expect(downloadVerifiedInstaller(options(foreign, bytes))).rejects.toMatchObject({ code: 'unsafe-redirect' } satisfies Partial<DownloadError>)
  })
})
