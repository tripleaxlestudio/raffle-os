import { parseEnvelope, type ProtocolEnvelope, type ProtocolScope } from './protocol.ts'
import type { Transport, TransportListener, TransportStatus } from './transport.ts'
import { decodeDisplayWireEnvelope, encodeDisplayWireEnvelope, MAX_PUBLIC_ASSET_BYTES, type PublicAssetFetch, type PublicAssetUpload } from './wire-codec.ts'

export type DisplayClientRole = 'operator' | 'audience'

type WebSocketTransportOptions = Readonly<{
  readonly role: DisplayClientRole
  readonly scope: ProtocolScope
  readonly endpoint?: string
  readonly reconnectDelayMs?: number
  readonly resolvePrizeAsset?: (assetId: string) => Promise<Blob | null>
}>

type PresenceFrame = Readonly<{ readonly type: 'transport-presence'; readonly audienceCount: number }>

function isPresenceFrame(value: unknown): value is PresenceFrame {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'type' in value && value.type === 'transport-presence' && 'audienceCount' in value && typeof value.audienceCount === 'number' && Number.isSafeInteger(value.audienceCount) && value.audienceCount >= 0
}

function websocketUrl(options: WebSocketTransportOptions): string {
  if (options.endpoint !== undefined) return options.endpoint
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const query = new URLSearchParams({ role: options.role, eventId: options.scope.eventId, displayId: options.scope.displayId })
  return `${protocol}//${window.location.host}/ws/display?${query.toString()}`
}

function assetUrl(id: string): string {
  return `/display-assets/${encodeURIComponent(id)}`
}

export function createWebSocketDisplayTransport(options: WebSocketTransportOptions): Transport {
  const Constructor = globalThis.WebSocket
  if (typeof Constructor !== 'function') {
    const unavailable: TransportStatus = { connection: 'unavailable', authoritative: true, reason: 'WebSocket is unavailable.' }
    return {
      capability: { transport: 'unavailable', broadcastChannel: 'unavailable', fullscreen: 'unavailable' },
      publish: () => ({ ok: false, error: { kind: 'transport-unavailable', reason: unavailable.reason ?? 'WebSocket is unavailable.' } }),
      subscribe: () => () => undefined,
      getStatus: () => unavailable,
      subscribeStatus(listener) { listener(unavailable); return () => undefined },
      close: () => undefined,
    }
  }

  let socket: WebSocket | undefined
  let closed = false
  let reconnectHandle: number | undefined
  let status: TransportStatus = { connection: 'connecting', authoritative: true, ...(options.role === 'operator' ? { audienceCount: 0 } : {}) }
  const listeners = new Set<TransportListener>()
  const statusListeners = new Set<(next: TransportStatus) => void>()
  const closeListeners = new Set<() => void>()
  const pendingFrames: string[] = []
  let outbound = Promise.resolve()
  let inbound = Promise.resolve()
  let started = false

  const report = (next: TransportStatus): void => {
    status = next
    statusListeners.forEach((listener) => { try { listener(status) } catch { /* status observers are isolated */ } })
  }
  const upload: PublicAssetUpload = async ({ id, type, blob }) => {
    if (blob.size > MAX_PUBLIC_ASSET_BYTES) throw new Error('Public display asset exceeds the 5 MB limit.')
    const response = await fetch(assetUrl(id), { method: 'PUT', headers: { 'Content-Type': type }, body: blob })
    if (!response.ok) throw new Error(`Public display asset upload failed (${response.status}).`)
  }
  const fetchAsset: PublicAssetFetch = async ({ id, type, size }) => {
    const response = await fetch(assetUrl(id))
    if (!response.ok) throw new Error(`Public display asset fetch failed (${response.status}).`)
    const blob = await response.blob()
    if (blob.type !== type || blob.size !== size || blob.size > MAX_PUBLIC_ASSET_BYTES) throw new Error('Public display asset failed wire validation.')
    return blob
  }
  const flush = (): void => {
    if (socket?.readyState !== WebSocket.OPEN) return
    while (pendingFrames.length > 0) socket.send(pendingFrames.shift() as string)
  }
  const queueFrame = (frame: string): void => {
    if (pendingFrames.length >= 128) pendingFrames.shift()
    pendingFrames.push(frame)
    flush()
  }
  const scheduleReconnect = (): void => {
    if (closed || reconnectHandle !== undefined) return
    report({ ...status, connection: 'reconnecting', authoritative: true })
    reconnectHandle = globalThis.setTimeout(() => { reconnectHandle = undefined; connect() }, options.reconnectDelayMs ?? 500)
  }
  const connect = (): void => {
    if (closed) return
    report({ ...status, connection: status.connection === 'connecting' ? 'connecting' : 'reconnecting', authoritative: true })
    try {
      socket = new Constructor(websocketUrl(options))
    } catch (error: unknown) {
      report({ ...status, connection: 'disconnected', authoritative: true, reason: error instanceof Error ? error.message : 'WebSocket connection failed.' })
      scheduleReconnect()
      return
    }
    socket.addEventListener('open', () => { report({ ...status, connection: 'connected', authoritative: true, reason: undefined }); flush() })
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return
      inbound = inbound.then(async () => {
        const candidate = JSON.parse(event.data) as unknown
        if (isPresenceFrame(candidate)) {
          if (options.role === 'operator') report({ connection: 'connected', authoritative: true, audienceCount: candidate.audienceCount })
          return
        }
        const envelope = await decodeDisplayWireEnvelope(event.data, fetchAsset)
        listeners.forEach((listener) => { try { listener(envelope) } catch { /* one subscriber cannot break the transport */ } })
      }).catch(() => undefined)
    })
    socket.addEventListener('close', () => { if (!closed) { report({ ...status, connection: 'disconnected', authoritative: true }); scheduleReconnect() } })
    socket.addEventListener('error', () => { if (!closed) report({ ...status, connection: 'disconnected', authoritative: true, reason: 'WebSocket transport error.' }) })
  }
  const ensureStarted = (): void => {
    if (started || closed) return
    started = true
    connect()
  }

  return {
    capability: { transport: 'available', broadcastChannel: 'unavailable', fullscreen: typeof document !== 'undefined' && document.fullscreenEnabled ? 'available' : 'unavailable' },
    publish(envelope: ProtocolEnvelope) {
      if (closed) return { ok: false, error: { kind: 'transport-closed' } }
      ensureStarted()
      const parsed = parseEnvelope(envelope)
      if (!parsed.ok) return { ok: false, error: parsed.error }
      outbound = outbound.then(async () => {
        if (options.role === 'operator' && envelope.message.type === 'display-state' && envelope.message.prizeImageAssetId !== undefined && options.resolvePrizeAsset !== undefined) {
          const prize = await options.resolvePrizeAsset(envelope.message.prizeImageAssetId)
          if (prize !== null) await upload({ id: envelope.message.prizeImageAssetId, type: prize.type, blob: prize })
        }
        queueFrame(await encodeDisplayWireEnvelope(envelope, upload))
      }).catch((error: unknown) => report({ ...status, connection: socket?.readyState === WebSocket.OPEN ? 'connected' : 'disconnected', authoritative: true, reason: error instanceof Error ? error.message : 'Display wire encoding failed.' }))
      return { ok: true }
    },
    subscribe(listener) { if (closed) return () => undefined; ensureStarted(); listeners.add(listener); return () => listeners.delete(listener) },
    getStatus: () => status,
    subscribeStatus(listener) { if (closed) return () => undefined; ensureStarted(); statusListeners.add(listener); listener(status); return () => statusListeners.delete(listener) },
    onClose(listener) { if (closed) { listener(); return () => undefined } closeListeners.add(listener); return () => closeListeners.delete(listener) },
    close() {
      if (closed) return
      closed = true
      if (reconnectHandle !== undefined) globalThis.clearTimeout(reconnectHandle)
      socket?.close()
      listeners.clear()
      statusListeners.clear()
      closeListeners.forEach((listener) => { try { listener() } catch { /* close observers are isolated */ } })
      closeListeners.clear()
    },
  }
}
