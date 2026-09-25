import type { IncomingMessage, ServerResponse } from 'node:http'
import { parseInstallerChecksum, ChecksumParserError } from './checksum-parser.ts'
import { downloadText, downloadVerifiedInstaller, DownloadError, type DownloadProgress } from './download-manager.ts'
import { resolveLatestUpdateRelease, ReleaseResolverError, type ResolvedUpdateRelease } from './release-resolver.ts'
import type { UpdateInstallResult } from './update-result.ts'

export type UpdateCapability = 'development' | 'portable' | 'installed'
export type UpdateJobState = 'idle' | 'preparing' | 'downloading' | 'verifying' | 'ready-to-install' | 'installing' | 'error'
export type PublicUpdateErrorCode = 'release-unavailable' | 'release-invalid' | 'download-failed' | 'checksum-invalid' | 'storage-failed' | 'install-handoff-failed'

export interface PublicUpdateStatus {
  readonly state: UpdateJobState
  readonly version?: string
  readonly progress?: Readonly<{ downloadedBytes: number; totalBytes?: number; percent?: number }>
  readonly error?: PublicUpdateErrorCode
}

export interface UpdatePreparationServices {
  resolve(currentVersion: string, targetVersion: string): Promise<ResolvedUpdateRelease>
  fetchChecksum(release: ResolvedUpdateRelease): Promise<string>
  download(release: ResolvedUpdateRelease, sha256: string, onProgress: (progress: DownloadProgress) => void, onVerifying: () => void): Promise<void>
}

export interface UpdateApiOptions {
  readonly currentVersion: string
  readonly capability: UpdateCapability
  readonly mutationToken?: string
  readonly services?: UpdatePreparationServices
  readonly canonicalOrigin: () => string
  readonly requestInstall?: (version: string) => void
  readonly lastInstallResult?: UpdateInstallResult
}

export interface UpdateApi {
  readonly isPath: (path: string) => boolean
  readonly handle: (request: IncomingMessage, response: ServerResponse, path: string) => Promise<void>
  readonly getStatus: () => PublicUpdateStatus
}

export function createDefaultUpdatePreparationServices(updateRoot: string): UpdatePreparationServices {
  return {
    resolve: (currentVersion, targetVersion) => resolveLatestUpdateRelease(currentVersion, targetVersion),
    fetchChecksum: (release) => downloadText({ sourceUrl: release.checksum.downloadUrl, maximumBytes: release.checksum.size }),
    download: async (release, sha256, onProgress, onVerifying) => {
      await downloadVerifiedInstaller({
        sourceUrl: release.installer.downloadUrl,
        updateRoot,
        version: release.version,
        fileName: release.installer.name,
        expectedBytes: release.installer.size,
        expectedSha256: sha256,
        onProgress,
        onVerifying,
      })
    },
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const declared = request.headers['content-length']
  if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > 1024)) throw new Error('body-too-large')
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += bytes.length
    if (length > 1024) throw new Error('body-too-large')
    chunks.push(bytes)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new Error('invalid-json') }
}

function prepareVersion(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  const keys = Object.keys(body)
  if (keys.length !== 1 || keys[0] !== 'version' || !('version' in body) || typeof body.version !== 'string') return null
  return /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(body.version) ? body.version : null
}

function safeError(cause: unknown): PublicUpdateErrorCode {
  if (cause instanceof ChecksumParserError) return 'checksum-invalid'
  if (cause instanceof DownloadError) return cause.code === 'checksum-mismatch' ? 'checksum-invalid' : cause.code === 'stream-failed' ? 'storage-failed' : 'download-failed'
  if (cause instanceof ReleaseResolverError) return ['request-failed', 'timeout', 'http-error'].includes(cause.code) ? 'release-unavailable' : 'release-invalid'
  return 'storage-failed'
}

export function createUpdateApi(options: UpdateApiOptions): UpdateApi {
  let status: PublicUpdateStatus = { state: 'idle' }
  const canPrepare = options.capability === 'installed' && options.mutationToken !== undefined && options.services !== undefined
  const canInstall = canPrepare && options.requestInstall !== undefined
  let installRequested = false
  const active = (): boolean => ['preparing', 'downloading', 'verifying', 'ready-to-install', 'installing'].includes(status.state)

  const prepare = async (version: string): Promise<void> => {
    status = { state: 'preparing', version }
    try {
      const release = await options.services!.resolve(options.currentVersion, version)
      const checksumText = await options.services!.fetchChecksum(release)
      const sha256 = parseInstallerChecksum(checksumText, release.installer.name)
      status = { state: 'downloading', version, progress: { downloadedBytes: 0 } }
      await options.services!.download(
        release,
        sha256,
        (progress) => { status = { state: 'downloading', version, progress } },
        () => { status = { state: 'verifying', version } },
      )
      // The download service only resolves after streaming SHA256 verification
      // and atomic finalization have completed.
      status = { state: 'ready-to-install', version }
    } catch (cause: unknown) {
      status = { state: 'error', version, error: safeError(cause) }
    }
  }

  return {
    isPath: (path) => path === '/api/update/bootstrap' || path === '/api/update/capabilities' || path === '/api/update/prepare' || path === '/api/update/install' || path === '/api/update/status' || path === '/api/update/result',
    getStatus: () => status,
    async handle(request, response, path) {
      if (path === '/api/update/capabilities') {
        if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); sendJson(response, 405, { error: 'method-not-allowed' }); return }
        sendJson(response, 200, {
          environment: options.capability,
          currentVersion: options.currentVersion,
          prepareSupported: canPrepare,
          installSupported: canInstall,
          ...(!canPrepare ? { reason: options.capability !== 'installed' ? 'installed-environment-required' : 'launcher-authorization-required' } : {}),
        })
        return
      }
      if (path === '/api/update/status') {
        if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); sendJson(response, 405, { error: 'method-not-allowed' }); return }
        sendJson(response, 200, status)
        return
      }
      if (path === '/api/update/result') {
        if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); sendJson(response, 405, { error: 'method-not-allowed' }); return }
        sendJson(response, 200, { result: options.lastInstallResult ?? null })
        return
      }
      if (path === '/api/update/bootstrap') {
        if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); sendJson(response, 405, { error: 'method-not-allowed' }); return }
        if (request.headers.origin !== options.canonicalOrigin()) { sendJson(response, 403, { error: 'origin-required' }); return }
        if (!canPrepare) { sendJson(response, 503, { error: 'bootstrap-unavailable' }); return }
        sendJson(response, 200, { mutationToken: options.mutationToken })
        return
      }
      if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); sendJson(response, 405, { error: 'method-not-allowed' }); return }
      if (request.headers.origin !== options.canonicalOrigin()) { sendJson(response, 403, { error: 'origin-required' }); return }
      if (request.headers['x-kocokan-update-token'] !== options.mutationToken || options.mutationToken === undefined) { sendJson(response, 403, { error: 'authorization-required' }); return }
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '')) { sendJson(response, 415, { error: 'unsupported-media-type' }); return }
      if (path === '/api/update/install' && !canInstall) { sendJson(response, 503, { error: 'install-unavailable' }); return }
      if (path === '/api/update/prepare' && !canPrepare) { sendJson(response, 503, { error: 'prepare-unavailable' }); return }
      let body: unknown
      try { body = await readJsonBody(request) } catch { sendJson(response, 400, { error: 'invalid-body' }); return }
      const version = prepareVersion(body)
      if (version === null) { sendJson(response, 400, { error: 'invalid-request' }); return }
      if (path === '/api/update/install') {
        if (installRequested) { sendJson(response, 409, { error: 'install-already-requested' }); return }
        if (status.state !== 'ready-to-install') { sendJson(response, 409, { error: 'update-not-ready' }); return }
        if (status.version !== version) { sendJson(response, 409, { error: 'version-mismatch' }); return }
        installRequested = true
        status = { state: 'installing', version }
        sendJson(response, 202, status)
        setTimeout(() => {
          try { options.requestInstall!(version) } catch { status = { state: 'error', version, error: 'install-handoff-failed' } }
        }, 25)
        return
      }
      if (active()) { sendJson(response, 409, { error: 'update-in-progress' }); return }
      status = { state: 'preparing', version }
      sendJson(response, 202, status)
      void prepare(version)
    },
  }
}
