// @vitest-environment node
import { once } from 'node:events'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createServer, preview, type PreviewServer, type ViteDevServer } from 'vite'
import { WebSocket } from 'ws'
import { createDisplayRealtimeHubPlugin } from './display-realtime-vite-plugin.ts'

let server: ViteDevServer | PreviewServer | undefined
let fixture: string | undefined
afterEach(async () => {
  await server?.close()
  server = undefined
  if (fixture !== undefined) await rm(fixture, { recursive: true, force: true })
})

describe.each(['dev', 'preview'] as const)('Vite %s adapter lifecycle', (mode) => {
  it('serves the web UI and disposes active display peers before closing HTTP', async () => {
    fixture = await mkdtemp(join(tmpdir(), 'kocokan-vite-test-'))
    await writeFile(join(fixture, 'index.html'), '<!doctype html><html><div id="root">Vite fixture</div></html>')
    await mkdir(join(fixture, 'web'))
    await writeFile(join(fixture, 'web/index.html'), '<!doctype html><html><div id="root">Vite fixture</div></html>')
    const config = { configFile: false as const, root: fixture, plugins: [createDisplayRealtimeHubPlugin()], build: { outDir: 'web' }, logLevel: 'silent' as const }
    if (mode === 'dev') {
      server = await createServer({ ...config, server: { host: '127.0.0.1', port: 0 } })
      await server.listen()
    } else server = await preview({ ...config, preview: { host: '127.0.0.1', port: 0 } })
    const address = server.httpServer?.address()
    if (address === null || address === undefined || typeof address === 'string') throw new Error('Expected TCP server')
    const origin = `http://127.0.0.1:${address.port}`
    const response = await fetch(`${origin}/display?eventId=e&displayConfigurationId=d`)
    const page = await response.text()
    expect(page).toContain('Vite fixture')
    if (mode === 'dev') {
      expect(page).toContain('/@vite/client')
      expect((await fetch(`${origin}/@vite/client`)).status).toBe(200)
    }
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/display?role=audience&eventId=e&displayId=d`)
    await once(socket, 'open')
    const closed = once(socket, 'close')
    await server.close()
    expect((await closed)[0]).toBe(1001)
    await expect(fetch(origin)).rejects.toThrow()
  })
})
