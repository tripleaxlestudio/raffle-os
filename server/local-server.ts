import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import { attachDisplayRealtimeHub } from './display-realtime-hub.ts'
import { loadProductionAssets, type ProductionAsset } from './production-assets.ts'
import { createUpdateApi, type UpdateApiOptions, type UpdateCapability, type UpdatePreparationServices } from './update/update-api.ts'
import type { UpdateInstallResult } from './update/update-result.ts'

export const PILOT_HOST = '127.0.0.1'
export const PILOT_PORT = 47882
export const PILOT_ORIGIN = `http://${PILOT_HOST}:${PILOT_PORT}`

export type LocalServer = Readonly<{
  origin: string
  status: () => 'running' | 'stopping' | 'stopped'
  close: () => Promise<void>
}>

type LocalServerOptions = Readonly<{
  webRoot: string
  version: string
  // Injection for isolated automated tests only. The production CLI exposes no
  // host/port override and never searches for an available port.
  testPort?: number
  shutdownTimeoutMs?: number
  update?: Readonly<{
    capability?: UpdateCapability
    mutationToken?: string
    services?: UpdatePreparationServices
    requestInstall?: (version: string) => void
    lastInstallResult?: UpdateInstallResult
  }>
}>

function end(response: ServerResponse, status: number, message: string): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.end(message)
}

function requestPath(request: IncomingMessage): string | undefined {
  const raw = request.url ?? '/'
  if (!raw.startsWith('/') || raw.startsWith('//')) return undefined
  try {
    const decoded = decodeURIComponent(raw.split('?', 1)[0] ?? '/')
    if (/[\\:]/.test(decoded) || [...decoded].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || decoded.split('/').some((part) => part.startsWith('.'))) return undefined
    return decoded
  } catch { return undefined }
}

function sendAsset(request: IncomingMessage, response: ServerResponse, asset: ProductionAsset): void {
  response.setHeader('Content-Type', asset.contentType)
  response.setHeader('Content-Length', asset.bytes.length)
  // Revalidation across updates is more important than caching for this pilot.
  response.setHeader('Cache-Control', 'no-cache')
  response.end(request.method === 'HEAD' ? undefined : asset.bytes)
}

export async function startLocalServer(options: LocalServerOptions): Promise<LocalServer> {
  const assets = await loadProductionAssets(options.webRoot)
  const index = assets.get('/index.html')
  if (index === undefined) throw new Error('Production index.html is unavailable.')
  let state: 'running' | 'stopping' | 'stopped' = 'stopped'
  let authority = `${PILOT_HOST}:${options.testPort ?? PILOT_PORT}`
  let closing: Promise<void> | undefined
  const sockets = new Set<Socket>()
  const timeout = options.shutdownTimeoutMs ?? 1500
  const updateOptions: UpdateApiOptions = {
    currentVersion: options.version,
    capability: options.update?.capability ?? 'portable',
    canonicalOrigin: () => `http://${authority}`,
    ...(options.update?.mutationToken === undefined ? {} : { mutationToken: options.update.mutationToken }),
    ...(options.update?.services === undefined ? {} : { services: options.update.services }),
    ...(options.update?.requestInstall === undefined ? {} : { requestInstall: options.update.requestInstall }),
    ...(options.update?.lastInstallResult === undefined ? {} : { lastInstallResult: options.update.lastInstallResult }),
  }
  const updateApi = createUpdateApi(updateOptions)
  const server = createServer((request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('Cache-Control', 'no-store')
    if (request.headers.host !== authority) { end(response, 421, 'Unexpected Host. Use the canonical Kocokan URL.'); return }
    if (request.headers.origin !== undefined && request.headers.origin !== `http://${authority}`) { end(response, 403, 'Cross-origin request rejected.'); return }
    if (state !== 'running') { end(response, 503, 'Kocokan is stopping.'); return }
    const path = requestPath(request)
    if (path === undefined) { end(response, 400, 'Invalid request path.'); return }
    hub.middleware(request, response, () => {
      if (updateApi.isPath(path)) { void updateApi.handle(request, response, path); return }
      if (request.method !== 'GET' && request.method !== 'HEAD') { response.setHeader('Allow', 'GET, HEAD'); end(response, 405, 'Method not allowed.'); return }
      if (path === '/health') {
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ application: 'kocokan', version: options.version, status: 'running', ready: true }))
        return
      }
      const asset = assets.get(path)
      if (asset !== undefined) { sendAsset(request, response, asset); return }
      const reserved = /^\/(?:api|assets|display-assets|ws|health)(?:\/|$)/.test(path)
      const acceptsHtml = /(?:text\/html|\*\/\*)/.test(request.headers.accept ?? '*/*')
      if (!reserved && !path.includes('.') && acceptsHtml) { sendAsset(request, response, index); return }
      end(response, 404, 'Not found.')
    })
  })
  server.requestTimeout = 15_000
  server.headersTimeout = 10_000
  server.keepAliveTimeout = 5000
  server.on('connection', (socket) => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)) })
  // This listener precedes the hub: reject unknown upgrade paths and authorities
  // without interfering with the shared display wire protocol.
  server.on('upgrade', (request, socket) => {
    if (state !== 'running' || request.headers.host !== authority || requestPath(request) !== '/ws/display' || (request.headers.origin !== undefined && request.headers.origin !== `http://${authority}`)) {
      socket.destroy()
    }
  })
  const hub = attachDisplayRealtimeHub(server, timeout)
  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => { reject(error) }
      server.once('error', onError)
      server.listen({ host: PILOT_HOST, port: options.testPort ?? PILOT_PORT, exclusive: true }, () => {
        server.off('error', onError)
        resolve()
      })
    })
  } catch (error: unknown) {
    await hub.dispose()
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'EADDRINUSE') {
      throw new Error(`Kocokan cannot start: ${authority} is already in use. Close the other instance or resolve the port conflict, then retry. No alternative port was selected.`, { cause: error })
    }
    throw error
  }
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('Kocokan did not bind a TCP port.')
  authority = `${PILOT_HOST}:${address.port}`
  state = 'running'
  return {
    origin: `http://${authority}`,
    status: () => state,
    close() {
      if (closing !== undefined) return closing
      state = 'stopping'
      closing = (async () => {
        const deadline = setTimeout(() => { sockets.forEach((socket) => socket.destroy()) }, timeout)
        try {
          // Stop accepting requests while the hub sends close frames. Force only
          // this server's remaining connections after the bounded grace period.
          await Promise.all([
            hub.dispose(),
            new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error))),
          ])
        } finally {
          clearTimeout(deadline)
          state = 'stopped'
        }
      })()
      return closing
    },
  }
}
