import { Server as HttpServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocket, WebSocketServer } from 'ws'
import { decodeDisplayWireEnvelope, MAX_DISPLAY_WIRE_BYTES, MAX_PUBLIC_ASSET_BYTES } from '../src/application/display-transport/wire-codec.ts'
import type { ProtocolEnvelope, ProtocolScope } from '../src/application/display-transport/protocol.ts'

const MAX_ASSET_CACHE_BYTES = 64 * 1024 * 1024
const MAX_ASSET_COUNT = 64
const ASSET_ID = /^[a-zA-Z0-9._:-]{1,160}$/

type Role = 'operator' | 'audience'
type ClientContext = Readonly<{ role: Role; scope: ProtocolScope; roomKey: string }>
type Room = {
  operator?: WebSocket
  readonly audiences: Set<WebSocket>
  latestPublicState?: string
}
type StoredAsset = Readonly<{ bytes: Uint8Array; type: string; storedAt: number }>

function isLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address?.startsWith('::ffff:127.') === true
}

function parseClient(request: IncomingMessage): ClientContext | undefined {
  if (!isLoopback(request.socket.remoteAddress)) return undefined
  let url: URL
  try {
    url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`)
  } catch {
    return undefined
  }
  if (url.pathname !== '/ws/display') return undefined
  const role = url.searchParams.get('role')
  const eventId = url.searchParams.get('eventId')
  const displayId = url.searchParams.get('displayId')
  if ((role !== 'operator' && role !== 'audience') || eventId === null || displayId === null || eventId.length < 1 || eventId.length > 160 || displayId.length < 1 || displayId.length > 160) return undefined
  const origin = request.headers.origin
  if (origin !== undefined) {
    try {
      if (new URL(origin).host !== request.headers.host) return undefined
    } catch {
      return undefined
    }
  }
  return { role, scope: { eventId, displayId }, roomKey: `${eventId}:${displayId}` }
}

function sameScope(envelope: ProtocolEnvelope, scope: ProtocolScope): boolean {
  return envelope.scope.eventId === scope.eventId && envelope.scope.displayId === scope.displayId
}

function messageAllowed(role: Role, envelope: ProtocolEnvelope): boolean {
  if (role === 'operator') return envelope.sender.kind === 'operator' && (envelope.message.type === 'display-state' || envelope.message.type === 'display-heartbeat')
  return envelope.sender.kind === 'display' && envelope.message.type !== 'display-state'
}

export type DisplayRealtimeHub = Readonly<{
  middleware: (request: IncomingMessage, response: ServerResponse, next: () => void) => void
  dispose: () => Promise<void>
}>

export function attachDisplayRealtimeHub(httpServer: HttpServer, shutdownTimeoutMs = 1000): DisplayRealtimeHub {
  const rooms = new Map<string, Room>()
  const assets = new Map<string, StoredAsset>()
  const clients = new WeakMap<WebSocket, ClientContext>()
  let assetBytes = 0
  const webSockets = new WebSocketServer({ noServer: true, maxPayload: MAX_DISPLAY_WIRE_BYTES })
  let disposed = false
  let disposal: Promise<void> | undefined

  const roomFor = (key: string): Room => {
    const room = rooms.get(key) ?? { audiences: new Set<WebSocket>() }
    rooms.set(key, room)
    return room
  }
  const storeAsset = (id: string, asset: StoredAsset): void => {
    const previous = assets.get(id)
    if (previous !== undefined) assetBytes -= previous.bytes.byteLength
    assets.delete(id)
    assets.set(id, asset)
    assetBytes += asset.bytes.byteLength
    while (assets.size > MAX_ASSET_COUNT || assetBytes > MAX_ASSET_CACHE_BYTES) {
      const oldest = assets.entries().next().value as [string, StoredAsset] | undefined
      if (oldest === undefined) break
      assets.delete(oldest[0])
      assetBytes -= oldest[1].bytes.byteLength
    }
  }
  const sendPresence = (room: Room): void => {
    if (room.operator?.readyState === WebSocket.OPEN) room.operator.send(JSON.stringify({ type: 'transport-presence', audienceCount: room.audiences.size }))
  }

  const middleware: DisplayRealtimeHub['middleware'] = (request, response, next) => {
    if (disposed) { next(); return }
    let url: URL
    try { url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`) }
    catch { response.statusCode = 400; response.end(); return }
    if (!url.pathname.startsWith('/display-assets/')) { next(); return }
    if (!isLoopback(request.socket.remoteAddress)) { response.statusCode = 403; response.end(); return }
    let id: string
    try {
      id = decodeURIComponent(url.pathname.slice('/display-assets/'.length))
    } catch {
      response.statusCode = 400
      response.end()
      return
    }
    if (!ASSET_ID.test(id)) { response.statusCode = 400; response.end(); return }
    if (request.method === 'GET') {
      const asset = assets.get(id)
      if (asset === undefined) { response.statusCode = 404; response.end(); return }
      response.statusCode = 200
      response.setHeader('Content-Type', asset.type)
      response.setHeader('Content-Length', asset.bytes.byteLength)
      response.setHeader('Cache-Control', 'private, max-age=3600')
      response.end(asset.bytes)
      return
    }
    if (request.method !== 'PUT') { response.statusCode = 405; response.end(); return }
    const type = request.headers['content-type']?.split(';', 1)[0] ?? ''
    const declaredLength = Number(request.headers['content-length'] ?? 0)
    if (!type.startsWith('image/') || !Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_PUBLIC_ASSET_BYTES) { response.statusCode = 413; response.end(); return }
    const chunks: Uint8Array[] = []
    let received = 0
    request.on('data', (chunk: Uint8Array) => {
      received += chunk.byteLength
      if (received <= MAX_PUBLIC_ASSET_BYTES) chunks.push(new Uint8Array(chunk))
      else request.destroy()
    })
    request.on('end', () => {
      if (disposed) { response.statusCode = 503; response.end(); return }
      if (received > MAX_PUBLIC_ASSET_BYTES) return
      const bytes = new Uint8Array(received)
      let offset = 0
      chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.byteLength })
      storeAsset(id, { bytes, type, storedAt: Date.now() })
      response.statusCode = 204
      response.end()
    })
    request.on('error', () => { if (!response.headersSent) { response.statusCode = 400; response.end() } })
  }

  webSockets.on('connection', (socket: WebSocket) => {
    const client = clients.get(socket)
    if (client === undefined) { socket.close(1008, 'Missing display client context'); return }
    const room = roomFor(client.roomKey)
    if (client.role === 'operator') {
      if (room.operator !== undefined && room.operator !== socket) room.operator.close(4001, 'Operator replaced')
      room.operator = socket
      sendPresence(room)
    } else {
      room.audiences.add(socket)
      sendPresence(room)
      if (room.latestPublicState !== undefined) socket.send(room.latestPublicState)
    }
    let processing = Promise.resolve()
    socket.on('message', (data: import('ws').RawData, isBinary: boolean) => {
      if (isBinary) { socket.close(1003, 'Text frames only'); return }
      const wire = data.toString()
      processing = processing.then(async () => {
        if (disposed) return
        const envelope = await decodeDisplayWireEnvelope(wire, async ({ id, type, size }) => {
          const asset = assets.get(id)
          if (asset === undefined || asset.type !== type || asset.bytes.byteLength !== size) throw new Error('Referenced public asset is unavailable.')
          return new Blob([asset.bytes], { type: asset.type })
        })
        if (disposed) return
        if (!sameScope(envelope, client.scope) || !messageAllowed(client.role, envelope)) throw new Error('Display envelope role or scope mismatch.')
        if (client.role === 'operator') {
          if (envelope.message.type === 'display-state') room.latestPublicState = wire
          room.audiences.forEach((audience) => { if (audience.readyState === WebSocket.OPEN) audience.send(wire) })
        } else if (room.operator?.readyState === WebSocket.OPEN) {
          room.operator.send(wire)
        }
      }).catch(() => socket.close(1008, 'Invalid public display envelope'))
    })
    socket.on('close', () => {
      if (client.role === 'operator') {
        if (room.operator === socket) room.operator = undefined
      } else {
        room.audiences.delete(socket)
        sendPresence(room)
      }
    })
  })

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
    if (disposed || socket.destroyed) return
    const client = parseClient(request)
    if (client === undefined) {
      // Leave unrelated upgrade paths (including Vite HMR) to their owner.
      if (request.url?.split('?', 1)[0] === '/ws/display') socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
      return
    }
    webSockets.handleUpgrade(request, socket, head, (webSocket) => { clients.set(webSocket, client); webSockets.emit('connection', webSocket, request) })
  }
  httpServer.on('upgrade', onUpgrade)
  const onServerClose = (): void => { void dispose() }
  const dispose = (): Promise<void> => {
    if (disposal !== undefined) return disposal
    disposed = true
    httpServer.off('upgrade', onUpgrade)
    httpServer.off('close', onServerClose)
    disposal = new Promise<void>((resolve) => {
      const deadline = setTimeout(() => {
        webSockets.clients.forEach((socket) => socket.terminate())
      }, shutdownTimeoutMs)
      webSockets.close(() => {
        clearTimeout(deadline)
        rooms.clear()
        assets.clear()
        assetBytes = 0
        resolve()
      })
      webSockets.clients.forEach((socket) => socket.close(1001, 'Server shutting down'))
    })
    return disposal
  }
  httpServer.once('close', onServerClose)
  return { middleware, dispose }
}
