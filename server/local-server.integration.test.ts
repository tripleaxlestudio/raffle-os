// @vitest-environment node
import { once } from 'node:events'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { request } from 'node:http'
import { createConnection, createServer as createTcpServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { createProtocolEnvelope } from '../src/application/display-transport/protocol.ts'
import { encodeDisplayWireEnvelope } from '../src/application/display-transport/wire-codec.ts'
import { PILOT_HOST, PILOT_ORIGIN, PILOT_PORT, startLocalServer, type LocalServer } from './local-server.ts'

let directory: string
let runtime: LocalServer | undefined
const html = '<!doctype html><html><script type="module" src="/assets/app.js"></script><div id="root">Kocokan</div></html>'

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kocokan-server-test-'))
  await mkdir(join(directory, 'assets'))
  await writeFile(join(directory, 'index.html'), html)
  await writeFile(join(directory, 'assets/app.js'), 'console.log("packaged fixture")')
  await writeFile(join(directory, '.env'), 'PRIVATE')
  await writeFile(join(directory, 'assets/app.js.map'), 'PRIVATE SOURCE MAP')
})

afterEach(async () => {
  await runtime?.close()
  runtime = undefined
  // Only this test's freshly-created temporary fixture is removed.
  await rm(directory, { recursive: true, force: true })
})

async function start(): Promise<LocalServer> {
  runtime = await startLocalServer({ webRoot: directory, version: 'test-p1', testPort: 0, shutdownTimeoutMs: 100 })
  return runtime
}

function rawGet(origin: string, path: string, headers: Record<string, string> = {}): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const req = request(`${origin}/`, { path, headers }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)) })
    req.on('error', reject)
    req.end()
  })
}

describe('standalone production HTTP server', () => {
  it('pins the pilot origin, serves the root and reports readiness only after listening', async () => {
    expect(PILOT_HOST).toBe('127.0.0.1')
    expect(PILOT_PORT).toBe(47882)
    expect(PILOT_ORIGIN).toBe('http://127.0.0.1:47882')
    const server = await start()
    expect(server.status()).toBe('running')
    const root = await fetch(server.origin)
    expect(root.status).toBe(200)
    expect(root.headers.get('content-type')).toContain('text/html')
    expect(root.headers.get('cache-control')).toBe('no-cache')
    expect(await root.text()).toBe(html)
    const health = await fetch(`${server.origin}/health`)
    expect(health.headers.get('cache-control')).toBe('no-store')
    expect(await health.json()).toEqual({ application: 'kocokan', version: 'test-p1', status: 'running', ready: true })
  })

  it('serves SPA deep links and scoped Audience URLs including HEAD requests', async () => {
    const server = await start()
    for (const path of ['/dashboard', '/draw/run/session-1', '/display?eventId=e&displayConfigurationId=d']) {
      const response = await fetch(`${server.origin}${path}`, { headers: { Accept: 'text/html' } })
      expect(response.status).toBe(200)
      expect(await response.text()).toBe(html)
    }
    const head = await fetch(`${server.origin}/display`, { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(Number(head.headers.get('content-length'))).toBe(Buffer.byteLength(html))
    expect(await head.text()).toBe('')
  })

  it('serves static assets with correct MIME and never uses SPA HTML for missing assets', async () => {
    const server = await start()
    const asset = await fetch(`${server.origin}/assets/app.js`)
    expect(asset.headers.get('content-type')).toContain('text/javascript')
    expect(await asset.text()).toContain('packaged fixture')
    for (const path of ['/assets/missing.js', '/missing.png', '/assets/no-extension', '/ws/display', '/assets/app.js.map']) {
      const missing = await fetch(`${server.origin}${path}`)
      expect(missing.status).toBe(404)
      expect(await missing.text()).not.toContain('<html>')
    }
    expect((await fetch(`${server.origin}/unknown`, { headers: { Accept: 'application/json' } })).status).toBe(404)
  })

  it('does not list directories or expose dotfiles, traversal paths, other hosts or cross-origin writes', async () => {
    const server = await start()
    expect((await fetch(`${server.origin}/assets/`)).status).toBe(404)
    for (const path of ['/.env', '/%2e%2e/package.json', '/assets/..%5cpackage.json', '/C:%5cWindows', '/%ZZ']) {
      expect(await rawGet(server.origin, path)).toBe(400)
    }
    expect(await rawGet(server.origin, '/health', { Host: 'attacker.invalid' })).toBe(421)
    const foreign = await fetch(`${server.origin}/display-assets/image`, { method: 'PUT', headers: { Origin: 'http://attacker.invalid', 'Content-Type': 'image/png' }, body: 'image' })
    expect(foreign.status).toBe(403)
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull()
    expect((await fetch(`${server.origin}/dashboard`, { method: 'POST' })).status).toBe(405)
  })

  it('fails readiness before binding if index or its entry assets are missing', async () => {
    await writeFile(join(directory, 'index.html'), '<script src="/assets/absent.js"></script>')
    await expect(start()).rejects.toThrow('Production entry asset is missing')
    await rm(join(directory, 'index.html'))
    await expect(start()).rejects.toThrow('Production index.html is missing')
  })

  it('reports port conflict without changing port or stopping the existing process', async () => {
    const occupied = createTcpServer((socket) => socket.end('existing'))
    occupied.listen(0, PILOT_HOST)
    await once(occupied, 'listening')
    try {
      const address = occupied.address()
      if (address === null || typeof address === 'string') throw new Error('Expected TCP address')
      await expect(startLocalServer({ webRoot: directory, version: 'test', testPort: address.port })).rejects.toThrow('No alternative port was selected')
      expect(occupied.listening).toBe(true)
    } finally { await new Promise<void>((resolve, reject) => occupied.close((error) => error === undefined ? resolve() : reject(error))) }
  })

  it('preserves public asset PUT/GET semantics and returns missing images as 404', async () => {
    const server = await start()
    const bytes = new Uint8Array([137, 80, 78, 71])
    const url = `${server.origin}/display-assets/public-image`
    expect((await fetch(url)).status).toBe(404)
    expect((await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: bytes })).status).toBe(204)
    const image = await fetch(url)
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(bytes)
    expect((await fetch(url, { method: 'DELETE' })).status).toBe(405)
  })

  it('relays unchanged envelopes, replays state on reconnect, and closes live WebSockets gracefully', async () => {
    const server = await start()
    const base = `${server.origin.replace('http:', 'ws:')}/ws/display?eventId=event-test&displayId=display-test`
    const operator = new WebSocket(`${base}&role=operator`)
    const initialPresence = once(operator, 'message')
    await once(operator, 'open')
    expect(JSON.parse(String((await initialPresence)[0]))).toEqual({ type: 'transport-presence', audienceCount: 0 })
    const audience = new WebSocket(`${base}&role=audience`)
    await once(audience, 'open')
    const envelope = createProtocolEnvelope({ sender: { kind: 'operator', id: 'operator' }, scope: { eventId: 'event-test', displayId: 'display-test' }, drawSessionId: '00000000-0000-4000-8000-000000000001', epoch: 1, sequence: 1, emittedAt: '2026-09-23T00:00:00.000Z', message: { type: 'display-state', stage: 'standby', eventName: 'Public event' } })
    const wire = await encodeDisplayWireEnvelope(envelope, async () => undefined)
    const received = once(audience, 'message')
    operator.send(wire)
    expect(String((await received)[0])).toBe(wire)
    const gone = once(audience, 'close')
    audience.close()
    await gone
    const reconnect = new WebSocket(`${base}&role=audience`)
    const replay = once(reconnect, 'message')
    await once(reconnect, 'open')
    expect(String((await replay)[0])).toBe(wire)
    const operatorClosed = once(operator, 'close')
    const audienceClosed = once(reconnect, 'close')
    const closing = server.close()
    expect(server.status()).toBe('stopping')
    expect(server.close()).toBe(closing)
    await closing
    expect((await operatorClosed)[0]).toBe(1001)
    expect((await audienceClosed)[0]).toBe(1001)
    expect(server.status()).toBe('stopped')
    await expect(fetch(`${server.origin}/health`)).rejects.toThrow()
  })

  it('bounds shutdown of incomplete HTTP connections and releases the port', async () => {
    const server = await start()
    const port = Number(new URL(server.origin).port)
    const slow = createConnection({ host: PILOT_HOST, port })
    slow.on('error', () => undefined)
    await once(slow, 'connect')
    slow.write('GET / HTTP/1.1\r\n')
    const closed = once(slow, 'close')
    await server.close()
    await closed
    const restarted = await startLocalServer({ webRoot: directory, version: 'test', testPort: port })
    try { expect((await fetch(`${restarted.origin}/health`)).status).toBe(200) }
    finally { await restarted.close() }
  })
})
