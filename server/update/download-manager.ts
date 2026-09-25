import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { once } from 'node:events'

const DEFAULT_ALLOWED_DOWNLOAD_HOSTS = new Set(['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com'])
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export type DownloadErrorCode =
  | 'invalid-url'
  | 'unsafe-redirect'
  | 'too-many-redirects'
  | 'http-error'
  | 'timeout'
  | 'missing-body'
  | 'invalid-content-length'
  | 'byte-count-mismatch'
  | 'checksum-mismatch'
  | 'stream-failed'

export class DownloadError extends Error {
  readonly code: DownloadErrorCode

  constructor(code: DownloadErrorCode) {
    super(`Update download failed: ${code}`)
    this.name = 'DownloadError'
    this.code = code
  }
}

export interface DownloadBodyReader {
  read(): Promise<{ readonly done: false; readonly value: Uint8Array } | { readonly done: true; readonly value?: undefined }>
  cancel?(): Promise<void>
}

export interface DownloadResponse {
  readonly status: number
  readonly ok: boolean
  readonly headers: { get(name: string): string | null }
  readonly body: { getReader(): DownloadBodyReader } | null
}

export type DownloadFetch = (url: string, init: RequestInit) => Promise<DownloadResponse>

export interface DownloadProgress {
  readonly downloadedBytes: number
  readonly totalBytes?: number
  readonly percent?: number
}

interface RedirectOptions {
  readonly fetch?: DownloadFetch
  readonly timeoutMs?: number
  readonly maxRedirects?: number
  readonly allowedHosts?: ReadonlySet<string>
}

export interface DownloadInstallerOptions extends RedirectOptions {
  readonly sourceUrl: string
  readonly updateRoot: string
  readonly version: string
  readonly fileName: string
  readonly expectedBytes: number
  readonly expectedSha256: string
  readonly onProgress?: (progress: DownloadProgress) => void
  readonly onVerifying?: () => void
}

export interface DownloadTextOptions extends RedirectOptions {
  readonly sourceUrl: string
  readonly maximumBytes: number
}

function validateUrl(value: string, allowedHosts: ReadonlySet<string>, redirect: boolean): URL {
  let url: URL
  try { url = new URL(value) } catch { throw new DownloadError(redirect ? 'unsafe-redirect' : 'invalid-url') }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || !allowedHosts.has(url.hostname)) throw new DownloadError(redirect ? 'unsafe-redirect' : 'invalid-url')
  return url
}

async function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => { controller.abort(); reject(new DownloadError('timeout')) }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
  }
}

async function fetchFollowingRedirects(sourceUrl: string, options: RedirectOptions, signal: AbortSignal): Promise<DownloadResponse> {
  const fetcher = options.fetch ?? ((url, init) => globalThis.fetch(url, init))
  const allowedHosts = options.allowedHosts ?? DEFAULT_ALLOWED_DOWNLOAD_HOSTS
  let current = validateUrl(sourceUrl, allowedHosts, false)
  const maximum = options.maxRedirects ?? 5
  for (let redirects = 0; ; redirects += 1) {
    const response = await fetcher(current.href, { method: 'GET', redirect: 'manual', signal })
    if (!REDIRECT_STATUSES.has(response.status)) {
      if (!response.ok) throw new DownloadError('http-error')
      return response
    }
    await response.body?.getReader().cancel?.()
    if (redirects >= maximum) throw new DownloadError('too-many-redirects')
    const location = response.headers.get('location')
    if (location === null) throw new DownloadError('unsafe-redirect')
    current = validateUrl(new URL(location, current).href, allowedHosts, true)
  }
}

function contentLength(response: DownloadResponse): number | undefined {
  const raw = response.headers.get('content-length')
  if (raw === null) return undefined
  if (!/^\d+$/.test(raw)) throw new DownloadError('invalid-content-length')
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) throw new DownloadError('invalid-content-length')
  return value
}

async function readChunks(response: DownloadResponse, consume: (chunk: Uint8Array) => Promise<void> | void): Promise<number> {
  if (response.body === null) throw new DownloadError('missing-body')
  const reader = response.body.getReader()
  let bytes = 0
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) return bytes
      bytes += result.value.byteLength
      await consume(result.value)
    }
  } catch (cause: unknown) {
    if (cause instanceof DownloadError) throw cause
    throw new DownloadError('stream-failed')
  }
}

export async function downloadText(options: DownloadTextOptions): Promise<string> {
  return withTimeout(async (signal) => {
    const response = await fetchFollowingRedirects(options.sourceUrl, options, signal)
    const declared = contentLength(response)
    if (declared !== undefined && declared > options.maximumBytes) throw new DownloadError('byte-count-mismatch')
    const chunks: Uint8Array[] = []
    const received = await readChunks(response, (chunk) => {
      if (chunks.reduce((total, entry) => total + entry.byteLength, 0) + chunk.byteLength > options.maximumBytes) throw new DownloadError('byte-count-mismatch')
      chunks.push(chunk)
    })
    if (declared !== undefined && received !== declared) throw new DownloadError('byte-count-mismatch')
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8')
  }, options.timeoutMs ?? 30_000)
}

export async function downloadVerifiedInstaller(options: DownloadInstallerOptions): Promise<{ readonly fileName: string; readonly bytes: number; readonly sha256: string }> {
  const versionDirectory = join(options.updateRoot, options.version)
  const finalPath = join(versionDirectory, options.fileName)
  const partialPath = `${finalPath}.part`
  await mkdir(versionDirectory, { recursive: true })
  await rm(partialPath, { force: true })
  try {
    return await withTimeout(async (signal) => {
      const response = await fetchFollowingRedirects(options.sourceUrl, options, signal)
      const declared = contentLength(response)
      if (declared !== undefined && declared !== options.expectedBytes) throw new DownloadError('byte-count-mismatch')
      const hash = createHash('sha256')
      const output = createWriteStream(partialPath, { flags: 'wx' })
      let received = 0
      try {
        await readChunks(response, async (chunk) => {
          received += chunk.byteLength
          if (received > options.expectedBytes) throw new DownloadError('byte-count-mismatch')
          hash.update(chunk)
          if (!output.write(chunk)) await once(output, 'drain')
          const progress: DownloadProgress = declared === undefined
            ? { downloadedBytes: received }
            : { downloadedBytes: received, totalBytes: declared, percent: declared === 0 ? 100 : Math.min(100, Math.floor((received / declared) * 100)) }
          options.onProgress?.(progress)
        })
        output.end()
        await once(output, 'close')
      } catch (cause: unknown) {
        output.destroy()
        throw cause
      }
      if (received !== options.expectedBytes || (await stat(partialPath)).size !== options.expectedBytes) throw new DownloadError('byte-count-mismatch')
      options.onVerifying?.()
      const digest = hash.digest('hex')
      if (digest.toLowerCase() !== options.expectedSha256.toLowerCase()) throw new DownloadError('checksum-mismatch')
      await rm(finalPath, { force: true })
      await rename(partialPath, finalPath)
      return { fileName: options.fileName, bytes: received, sha256: digest }
    }, options.timeoutMs ?? 15 * 60_000)
  } catch (cause: unknown) {
    await rm(partialPath, { force: true }).catch(() => undefined)
    if (cause instanceof DownloadError) throw cause
    throw new DownloadError('stream-failed')
  }
}
