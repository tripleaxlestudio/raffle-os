export type NativeUpdateEnvironment = 'development' | 'portable' | 'installed'
export type NativeUpdateJobState = 'idle' | 'preparing' | 'downloading' | 'verifying' | 'ready-to-install' | 'installing' | 'error'
export type NativeUpdateErrorCode = 'release-unavailable' | 'release-invalid' | 'download-failed' | 'checksum-invalid' | 'storage-failed' | 'install-handoff-failed'
export type NativeUpdateInstallResultKind = 'success' | 'cancelled' | 'failed'
export interface NativeUpdateInstallResult { readonly version: string; readonly result: NativeUpdateInstallResultKind; readonly timestamp: string }

export interface NativeUpdateCapabilities {
  readonly environment: NativeUpdateEnvironment
  readonly currentVersion?: string
  readonly prepareSupported: boolean
  readonly installSupported: boolean
}

export interface NativeUpdateStatus {
  readonly state: NativeUpdateJobState
  readonly version?: string
  readonly progress?: Readonly<{ downloadedBytes: number; totalBytes?: number; percent?: number }>
  readonly error?: NativeUpdateErrorCode
}

export type LocalUpdateClientErrorCode = 'runtime-unavailable' | 'bootstrap-failed' | 'authorization-failed' | 'prepare-failed' | 'install-failed' | 'invalid-response'

export class LocalUpdateClientError extends Error {
  readonly code: LocalUpdateClientErrorCode

  constructor(code: LocalUpdateClientErrorCode) {
    super(`Native update request failed: ${code}`)
    this.name = 'LocalUpdateClientError'
    this.code = code
  }
}

type UpdateFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type Delay = (milliseconds: number, signal?: AbortSignal) => Promise<void>

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/
const JOB_STATES = new Set<NativeUpdateJobState>(['idle', 'preparing', 'downloading', 'verifying', 'ready-to-install', 'installing', 'error'])
const ERROR_CODES = new Set<NativeUpdateErrorCode>(['release-unavailable', 'release-invalid', 'download-failed', 'checksum-invalid', 'storage-failed', 'install-handoff-failed'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function json(response: Response): Promise<unknown> {
  try { return await response.json() } catch { throw new LocalUpdateClientError('invalid-response') }
}

function parseCapabilities(value: unknown): NativeUpdateCapabilities | null {
  if (!isRecord(value)) return null
  if (value.environment !== 'portable' && value.environment !== 'installed') return null
  if (typeof value.prepareSupported !== 'boolean' || typeof value.installSupported !== 'boolean') return null
  if (value.currentVersion !== undefined && typeof value.currentVersion !== 'string') return null
  return {
    environment: value.environment,
    prepareSupported: value.prepareSupported,
    installSupported: value.installSupported,
    ...(typeof value.currentVersion === 'string' ? { currentVersion: value.currentVersion } : {}),
  }
}

function parseStatus(value: unknown): NativeUpdateStatus {
  if (!isRecord(value) || typeof value.state !== 'string' || !JOB_STATES.has(value.state as NativeUpdateJobState)) throw new LocalUpdateClientError('invalid-response')
  const state = value.state as NativeUpdateJobState
  if (value.version !== undefined && typeof value.version !== 'string') throw new LocalUpdateClientError('invalid-response')
  if (value.error !== undefined && (typeof value.error !== 'string' || !ERROR_CODES.has(value.error as NativeUpdateErrorCode))) throw new LocalUpdateClientError('invalid-response')
  let progress: NativeUpdateStatus['progress']
  if (value.progress !== undefined) {
    if (!isRecord(value.progress) || typeof value.progress.downloadedBytes !== 'number' || !Number.isFinite(value.progress.downloadedBytes)) throw new LocalUpdateClientError('invalid-response')
    if (value.progress.totalBytes !== undefined && (typeof value.progress.totalBytes !== 'number' || !Number.isFinite(value.progress.totalBytes))) throw new LocalUpdateClientError('invalid-response')
    if (value.progress.percent !== undefined && (typeof value.progress.percent !== 'number' || !Number.isFinite(value.progress.percent))) throw new LocalUpdateClientError('invalid-response')
    progress = {
      downloadedBytes: value.progress.downloadedBytes,
      ...(typeof value.progress.totalBytes === 'number' ? { totalBytes: value.progress.totalBytes } : {}),
      ...(typeof value.progress.percent === 'number' ? { percent: value.progress.percent } : {}),
    }
  }
  return {
    state,
    ...(typeof value.version === 'string' ? { version: value.version } : {}),
    ...(progress === undefined ? {} : { progress }),
    ...(typeof value.error === 'string' ? { error: value.error as NativeUpdateErrorCode } : {}),
  }
}

const defaultDelay: Delay = (milliseconds, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted === true) { reject(new DOMException('Aborted', 'AbortError')); return }
  const handle = globalThis.setTimeout(resolve, milliseconds)
  signal?.addEventListener('abort', () => { globalThis.clearTimeout(handle); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
})

export class LocalUpdateClient {
  readonly #fetch: UpdateFetch
  readonly #delay: Delay
  #mutationToken: string | null = null

  constructor(options: { readonly fetch?: UpdateFetch; readonly delay?: Delay } = {}) {
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.#delay = options.delay ?? defaultDelay
  }

  clearRuntimeAuthorization(): void {
    this.#mutationToken = null
  }

  async detectCapabilities(): Promise<NativeUpdateCapabilities> {
    try {
      const response = await this.#fetch('/api/update/capabilities', { method: 'GET', cache: 'no-store', credentials: 'same-origin' })
      if (!response.ok) return { environment: 'development', prepareSupported: false, installSupported: false }
      return parseCapabilities(await response.json()) ?? { environment: 'development', prepareSupported: false, installSupported: false }
    } catch {
      return { environment: 'development', prepareSupported: false, installSupported: false }
    }
  }

  async prepare(version: string): Promise<NativeUpdateStatus> {
    if (!VERSION_PATTERN.test(version)) throw new LocalUpdateClientError('prepare-failed')
    let rebootstrapAllowed = true
    for (;;) {
      const token = await this.#getMutationToken()
      let response: Response
      try {
        response = await this.#fetch('/api/update/prepare', {
          method: 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-Kocokan-Update-Token': token },
          body: JSON.stringify({ version }),
        })
      } catch {
        this.clearRuntimeAuthorization()
        throw new LocalUpdateClientError('runtime-unavailable')
      }
      if ((response.status === 401 || response.status === 403) && rebootstrapAllowed) {
        this.clearRuntimeAuthorization()
        rebootstrapAllowed = false
        continue
      }
      if (response.status === 401 || response.status === 403) {
        this.clearRuntimeAuthorization()
        throw new LocalUpdateClientError('authorization-failed')
      }
      if (!response.ok) throw new LocalUpdateClientError('prepare-failed')
      return parseStatus(await json(response))
    }
  }

  async install(version: string): Promise<NativeUpdateStatus> {
    if (!VERSION_PATTERN.test(version)) throw new LocalUpdateClientError('install-failed')
    let rebootstrapAllowed = true
    for (;;) {
      const token = await this.#getMutationToken()
      let response: Response
      try {
        response = await this.#fetch('/api/update/install', { method: 'POST', cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Kocokan-Update-Token': token }, body: JSON.stringify({ version }) })
      } catch { this.clearRuntimeAuthorization(); throw new LocalUpdateClientError('runtime-unavailable') }
      if ((response.status === 401 || response.status === 403) && rebootstrapAllowed) { this.clearRuntimeAuthorization(); rebootstrapAllowed = false; continue }
      if (response.status === 401 || response.status === 403) { this.clearRuntimeAuthorization(); throw new LocalUpdateClientError('authorization-failed') }
      if (!response.ok) throw new LocalUpdateClientError('install-failed')
      return parseStatus(await json(response))
    }
  }

  async getInstallResult(): Promise<NativeUpdateInstallResult | null> {
    let response: Response
    try { response = await this.#fetch('/api/update/result', { method: 'GET', cache: 'no-store', credentials: 'same-origin' }) }
    catch { return null }
    if (!response.ok) return null
    const body = await json(response)
    if (!isRecord(body) || !('result' in body)) throw new LocalUpdateClientError('invalid-response')
    if (body.result === null) return null
    if (!isRecord(body.result) || Object.keys(body.result).length !== 3 || typeof body.result.version !== 'string' || !VERSION_PATTERN.test(body.result.version) ||
      (body.result.result !== 'success' && body.result.result !== 'cancelled' && body.result.result !== 'failed') || typeof body.result.timestamp !== 'string' || !Number.isFinite(Date.parse(body.result.timestamp))) throw new LocalUpdateClientError('invalid-response')
    return { version: body.result.version, result: body.result.result, timestamp: body.result.timestamp }
  }

  async getStatus(): Promise<NativeUpdateStatus> {
    let response: Response
    try {
      response = await this.#fetch('/api/update/status', { method: 'GET', cache: 'no-store', credentials: 'same-origin' })
    } catch {
      this.clearRuntimeAuthorization()
      throw new LocalUpdateClientError('runtime-unavailable')
    }
    if (!response.ok) throw new LocalUpdateClientError('runtime-unavailable')
    return parseStatus(await json(response))
  }

  async pollStatus(onStatus: (status: NativeUpdateStatus) => void, options: { readonly signal?: AbortSignal; readonly intervalMs?: number } = {}): Promise<NativeUpdateStatus> {
    const intervalMs = options.intervalMs ?? 750
    for (;;) {
      const status = await this.getStatus()
      onStatus(status)
      if (status.state === 'ready-to-install' || status.state === 'error') return status
      await this.#delay(intervalMs, options.signal)
    }
  }

  async #getMutationToken(): Promise<string> {
    if (this.#mutationToken !== null) return this.#mutationToken
    let response: Response
    try {
      response = await this.#fetch('/api/update/bootstrap', { method: 'POST', cache: 'no-store', credentials: 'same-origin' })
    } catch {
      throw new LocalUpdateClientError('runtime-unavailable')
    }
    if (!response.ok) throw new LocalUpdateClientError('bootstrap-failed')
    const body = await json(response)
    if (!isRecord(body) || typeof body.mutationToken !== 'string' || !TOKEN_PATTERN.test(body.mutationToken)) throw new LocalUpdateClientError('invalid-response')
    this.#mutationToken = body.mutationToken
    return this.#mutationToken
  }
}

export const localUpdateClient = new LocalUpdateClient()
