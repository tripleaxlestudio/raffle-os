// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startLocalServer, type LocalServer } from '../local-server.ts'
import type { ResolvedUpdateRelease } from './release-resolver.ts'
import type { UpdatePreparationServices } from './update-api.ts'

let directory: string
let runtime: LocalServer | undefined
const token = 'slice-1-test-token'
const release: ResolvedUpdateRelease = {
  version: '0.1.2',
  tagName: 'v0.1.2',
  installer: { name: 'Kocokan-Setup-0.1.2.exe', size: 70_000_000, downloadUrl: 'https://github.com/tripleaxlestudio/raffle-os/releases/download/v0.1.2/Kocokan-Setup-0.1.2.exe' },
  checksum: { name: 'checksums.txt', size: 100, downloadUrl: 'https://github.com/tripleaxlestudio/raffle-os/releases/download/v0.1.2/checksums.txt' },
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kocokan-update-api-'))
  await mkdir(join(directory, 'assets'))
  await writeFile(join(directory, 'index.html'), '<script src="/assets/app.js"></script>')
  await writeFile(join(directory, 'assets/app.js'), 'fixture')
})

afterEach(async () => {
  await runtime?.close()
  runtime = undefined
  await rm(directory, { recursive: true, force: true })
})

function services(download: UpdatePreparationServices['download'] = async () => undefined): UpdatePreparationServices {
  return {
    resolve: vi.fn(async () => release),
    fetchChecksum: vi.fn(async () => `${'a'.repeat(64)}  ${release.installer.name}\n`),
    download: vi.fn(download),
  }
}

async function start(updateServices?: UpdatePreparationServices, requestInstall?: (version: string) => void): Promise<LocalServer> {
  runtime = await startLocalServer({
    webRoot: directory,
    version: '0.1.1',
    testPort: 0,
    update: updateServices === undefined ? undefined : { capability: 'installed', mutationToken: token, services: updateServices, ...(requestInstall === undefined ? {} : { requestInstall }) },
  })
  return runtime
}

async function install(server: LocalServer, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${server.origin}/api/update/install`, { method: 'POST', headers: { Origin: server.origin, 'Content-Type': 'application/json', 'X-Kocokan-Update-Token': token, ...headers }, body: JSON.stringify(body) })
}

async function prepare(server: LocalServer, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${server.origin}/api/update/prepare`, {
    method: 'POST',
    headers: { Origin: server.origin, 'Content-Type': 'application/json', 'X-Kocokan-Update-Token': token, ...headers },
    body: JSON.stringify(body),
  })
}

async function waitForState(server: LocalServer, expected: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const value = await (await fetch(`${server.origin}/api/update/status`)).json() as Record<string, unknown>
    if (value.state === expected) return value
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`Update state did not reach ${expected}`)
}

function rawPrepare(origin: string, host: string): Promise<number | undefined> {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ version: '0.1.2' })
    const req = request({ hostname: url.hostname, port: url.port, path: '/api/update/prepare', method: 'POST', headers: { Host: host, Origin: origin, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Kocokan-Update-Token': token } }, (response) => {
      response.resume()
      response.on('end', () => resolve(response.statusCode))
    })
    req.on('error', reject)
    req.end(body)
  })
}

describe('local update API', () => {
  it('defaults to a conservative portable capability with install disabled', async () => {
    const server = await start()
    await expect((await fetch(`${server.origin}/api/update/capabilities`)).json()).resolves.toEqual({
      environment: 'portable', currentVersion: '0.1.1', prepareSupported: false, installSupported: false, reason: 'installed-environment-required',
    })
    expect((await fetch(`${server.origin}/api/update/bootstrap`, { method: 'POST', headers: { Origin: server.origin } })).status).toBe(503)
  })

  it('prepares one valid update and exposes only safe progress state', async () => {
    const updateServices = services(async (_release, _sha256, onProgress, onVerifying) => { onProgress({ downloadedBytes: 35_000_000, totalBytes: 70_000_000, percent: 50 }); onVerifying() })
    const server = await start(updateServices)
    const accepted = await prepare(server, { version: '0.1.2' })
    expect(accepted.status).toBe(202)
    const status = await waitForState(server, 'ready-to-install')
    expect(status).toEqual({ state: 'ready-to-install', version: '0.1.2' })
    expect(JSON.stringify(status)).not.toMatch(/(?:path|url|sha256|token)/i)
    expect(updateServices.resolve).toHaveBeenCalledWith('0.1.1', '0.1.2')
  })

  it('exposes installed capability without secrets and delivers the token only through the same-origin bootstrap', async () => {
    const server = await start(services())
    const capabilitiesResponse = await fetch(`${server.origin}/api/update/capabilities`)
    expect(capabilitiesResponse.headers.get('cache-control')).toBe('no-store')
    const capabilities = await capabilitiesResponse.json()
    expect(capabilities).toEqual({ environment: 'installed', currentVersion: '0.1.1', prepareSupported: true, installSupported: false })
    expect(JSON.stringify(capabilities)).not.toContain(token)

    const bootstrap = await fetch(`${server.origin}/api/update/bootstrap`, { method: 'POST', headers: { Origin: server.origin } })
    expect(bootstrap.status).toBe(200)
    expect(bootstrap.headers.get('cache-control')).toBe('no-store')
    expect(await bootstrap.json()).toEqual({ mutationToken: token })
    expect((await fetch(`${server.origin}/api/update/bootstrap`, { method: 'POST' })).status).toBe(403)
    expect((await fetch(`${server.origin}/api/update/bootstrap`, { method: 'POST', headers: { Origin: 'http://attacker.invalid' } })).status).toBe(403)
    expect((await fetch(`${server.origin}/api/update/install`, { method: 'POST', headers: { Origin: server.origin } })).status).toBe(403)
  })

  it.each([
    ['malformed version', { version: 'v0.1.2' }],
    ['url field', { version: '0.1.2', url: 'https://attacker.invalid/a.exe' }],
    ['path field', { version: '0.1.2', path: 'C:\\Windows\\a.exe' }],
    ['unknown field', { version: '0.1.2', extra: true }],
  ])('rejects %s', async (_label, body) => {
    const server = await start(services())
    expect((await prepare(server, body)).status).toBe(400)
  })

  it('requires canonical origin, host, JSON content type, and mutation token', async () => {
    const server = await start(services())
    expect((await fetch(`${server.origin}/api/update/prepare`, { method: 'POST', headers: { Origin: server.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ version: '0.1.2' }) })).status).toBe(403)
    expect((await prepare(server, { version: '0.1.2' }, { Origin: 'http://attacker.invalid' })).status).toBe(403)
    expect((await prepare(server, { version: '0.1.2' }, { 'Content-Type': 'text/plain' })).status).toBe(415)
    expect((await prepare(server, { version: '0.1.2' }, { 'X-Kocokan-Update-Token': 'wrong' })).status).toBe(403)
    expect(await rawPrepare(server.origin, 'attacker.invalid')).toBe(421)
  })

  it('returns 409 while a preparation job is active', async () => {
    let finish: (() => void) | undefined
    const pending = new Promise<void>((resolve) => { finish = resolve })
    const server = await start(services(async (_release, _sha256, onProgress) => { onProgress({ downloadedBytes: 1 }); await pending }))
    expect((await prepare(server, { version: '0.1.2' })).status).toBe(202)
    await waitForState(server, 'downloading')
    expect((await prepare(server, { version: '0.1.2' })).status).toBe(409)
    finish?.()
    await waitForState(server, 'ready-to-install')
  })

  it('hands off one exact ready version and rejects duplicates', async () => {
    const handoff = vi.fn()
    const server = await start(services(), handoff)
    await expect((await fetch(`${server.origin}/api/update/capabilities`)).json()).resolves.toMatchObject({ installSupported: true })
    expect((await prepare(server, { version: '0.1.2' })).status).toBe(202)
    await waitForState(server, 'ready-to-install')
    const accepted = await install(server, { version: '0.1.2' })
    expect(accepted.status).toBe(202)
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(handoff).toHaveBeenCalledTimes(1)
    expect(handoff).toHaveBeenCalledWith('0.1.2')
    expect((await install(server, { version: '0.1.2' })).status).toBe(409)
  })

  it('rejects install before ready, wrong version, invalid token, and unsafe fields', async () => {
    const server = await start(services(), vi.fn())
    expect((await install(server, { version: '0.1.2' })).status).toBe(409)
    expect((await prepare(server, { version: '0.1.2' })).status).toBe(202)
    await waitForState(server, 'ready-to-install')
    expect((await install(server, { version: '0.1.3' })).status).toBe(409)
    expect((await install(server, { version: '0.1.2' }, { 'X-Kocokan-Update-Token': 'wrong' })).status).toBe(403)
    expect((await install(server, { version: '0.1.2', path: 'C:\\evil.exe' })).status).toBe(400)
  })

  it('keeps install disabled outside an authorized launcher handoff', async () => {
    const server = await start(services())
    expect((await install(server, { version: '0.1.2' })).status).toBe(503)
  })

  it('rejects install in portable capability even with a well-formed launcher token', async () => {
    runtime = await startLocalServer({ webRoot: directory, version: '0.1.1', testPort: 0, update: { capability: 'portable', mutationToken: token } })
    expect((await install(runtime, { version: '0.1.2' })).status).toBe(503)
  })
})
