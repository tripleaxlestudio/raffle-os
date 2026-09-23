import { once } from 'node:events'
import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import { WebSocket } from 'ws'
import { createProtocolEnvelope } from '../src/application/display-transport/protocol.ts'
import { encodeDisplayWireEnvelope } from '../src/application/display-transport/wire-codec.ts'
import { createDisplayRealtimeHubPlugin } from './display-realtime-vite-plugin.ts'

let server: ViteDevServer | undefined
const sockets: WebSocket[] = []
const inboxes = new WeakMap<WebSocket, unknown[]>()

afterEach(async () => {
  sockets.splice(0).forEach((socket) => socket.close())
  await server?.close()
  server = undefined
})

async function connect(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url)
  sockets.push(socket)
  const inbox: unknown[] = []
  inboxes.set(socket, inbox)
  socket.on('message', (data) => { inbox.push(JSON.parse(data.toString()) as unknown) })
  await once(socket, 'open')
  return socket
}

async function nextFrame(socket: WebSocket, predicate: (value: unknown) => boolean): Promise<unknown> {
  const inbox = inboxes.get(socket)
  if (inbox === undefined) throw new Error('Missing socket inbox.')
  const deadline = Date.now() + 3000
  while (Date.now() < deadline) {
    const index = inbox.findIndex(predicate)
    if (index >= 0) return inbox.splice(index, 1)[0]
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for realtime hub frame.')
}

describe('local display realtime hub', () => {
  it('retains the latest public snapshot, bootstraps multiple audiences, and reports actual peer count', async () => {
    server = await createServer({ configFile: false, plugins: [createDisplayRealtimeHubPlugin()], server: { host: '127.0.0.1', port: 0 } })
    await server.listen()
    const address = server.httpServer?.address()
    if (address === null || address === undefined || typeof address === 'string') throw new Error('Expected a TCP test server.')
    const publicAssetId = 'public-prize-image'
    const publicAssetBytes = new Uint8Array([137, 80, 78, 71])
    const assetPut = await fetch(`http://127.0.0.1:${address.port}/display-assets/${publicAssetId}`, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: publicAssetBytes })
    expect(assetPut.status).toBe(204)
    const assetGet = await fetch(`http://127.0.0.1:${address.port}/display-assets/${publicAssetId}`)
    expect(assetGet.status).toBe(200)
    expect(assetGet.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await assetGet.arrayBuffer())).toEqual(publicAssetBytes)
    const base = `ws://127.0.0.1:${address.port}/ws/display?eventId=event-hub&displayId=display-hub`
    const operator = await connect(`${base}&role=operator`)
    await expect(nextFrame(operator, (value) => typeof value === 'object' && value !== null && 'type' in value && value.type === 'transport-presence')).resolves.toMatchObject({ audienceCount: 0 })

    const envelope = createProtocolEnvelope({
      sender: { kind: 'operator', id: 'operator-hub' },
      scope: { eventId: 'event-hub', displayId: 'display-hub' },
      drawSessionId: '00000000-0000-4000-8000-000000000001',
      epoch: 7,
      sequence: 1,
      emittedAt: '2026-09-08T00:00:00.000Z',
      message: { type: 'display-state', stage: 'rolling', stageStartedAt: '2026-09-08T00:00:00.000Z', blackoutRequested: false, rollingSlotCount: 1, presentationSeed: 'public-seed' },
    })
    operator.send(await encodeDisplayWireEnvelope(envelope, async () => undefined))

    const firstPresence = nextFrame(operator, (value) => typeof value === 'object' && value !== null && 'audienceCount' in value && value.audienceCount === 1)
    const first = await connect(`${base}&role=audience`)
    const firstBootstrap = await nextFrame(first, (value) => typeof value === 'object' && value !== null && 'messageId' in value)
    await expect(firstPresence).resolves.toMatchObject({ audienceCount: 1 })
    expect(firstBootstrap).toMatchObject({ messageId: envelope.messageId, message: { type: 'display-state', stage: 'rolling' } })

    const secondPresence = nextFrame(operator, (value) => typeof value === 'object' && value !== null && 'audienceCount' in value && value.audienceCount === 2)
    const second = await connect(`${base}&role=audience`)
    const secondBootstrap = await nextFrame(second, (value) => typeof value === 'object' && value !== null && 'messageId' in value)
    await expect(secondPresence).resolves.toMatchObject({ audienceCount: 2 })
    expect(secondBootstrap).toMatchObject({ messageId: envelope.messageId })

    second.close()
    await once(second, 'close')
    const reconnect = await connect(`${base}&role=audience`)
    const reconnectBootstrap = await nextFrame(reconnect, (value) => typeof value === 'object' && value !== null && 'messageId' in value)
    expect(reconnectBootstrap).toMatchObject({ messageId: envelope.messageId, sequence: 1 })
  })
})
