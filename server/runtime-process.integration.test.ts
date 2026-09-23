// @vitest-environment node
import { fork, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { build } from 'vite'
import { WebSocket } from 'ws'
import { createProtocolEnvelope } from '../src/application/display-transport/protocol.ts'
import { encodeDisplayWireEnvelope } from '../src/application/display-transport/wire-codec.ts'
import { PILOT_ORIGIN } from './local-server.ts'

let fixture: string
let bundle: string
let webRoot: string
const children = new Set<ChildProcess>()

beforeAll(async () => {
  fixture = await mkdtemp(join(tmpdir(), 'kocokan-bundle-test-'))
  webRoot = join(fixture, 'web')
  await mkdir(webRoot)
  await writeFile(join(webRoot, 'index.html'), '<!doctype html><div id="root">Portable fixture</div>')
  await build({ configFile: resolve('vite.runtime.config.ts'), logLevel: 'silent', build: { outDir: join(fixture, 'runtime') } })
  bundle = join(fixture, 'runtime/kocokan-server.cjs')
}, 20_000)

function launch(args: string[] = ['--web-root', webRoot]): { child: ChildProcess; ready: Promise<void>; exited: Promise<number | null>; stderr: () => string } {
  // Run the emitted bundle outside the repo, without node_modules or Vite at
  // runtime. process.execPath is the development machine's Node, not yet a
  // distributed Windows binary.
  const child = fork(bundle, args, { cwd: fixture, execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  children.add(child)
  let errorOutput = ''
  child.stderr?.on('data', (chunk: Buffer) => { errorOutput += chunk.toString() })
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => { children.delete(child); resolve(code) })
  })
  const ready = new Promise<void>((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error(`Runtime readiness timeout: ${errorOutput}`)), 10_000)
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
      if (output.includes('"type":"ready"')) { clearTimeout(timeout); resolve() }
    })
    void exited.then((code) => { clearTimeout(timeout); reject(new Error(`Runtime exited (${code}): ${errorOutput}`)) }, reject)
  })
  // Some tests deliberately launch a conflicting/invalid process.
  void ready.catch(() => undefined)
  return { child, ready, exited, stderr: () => errorOutput }
}

afterAll(async () => {
  for (const child of children) {
    const exited = once(child, 'exit')
    if (child.connected) child.send({ type: 'shutdown' })
    const force = setTimeout(() => child.kill(), 3000)
    try { await exited } finally { clearTimeout(force) }
  }
  // The path comes only from this suite's mkdtemp call.
  if (fixture !== undefined) await rm(fixture, { recursive: true, force: true })
})

describe('built production runtime process', () => {
  it('runs without project dependencies, handles substantial WS frames, reports fixed-port conflict and exits through IPC', async () => {
    const primary = launch()
    await primary.ready
    try {
      const health = await fetch(`${PILOT_ORIGIN}/health`)
      expect(await health.json()).toMatchObject({ application: 'kocokan', ready: true })
      expect(await (await fetch(`${PILOT_ORIGIN}/display?eventId=e&displayConfigurationId=d`)).text()).toContain('Portable fixture')
      const duplicate = launch()
      expect(await duplicate.exited).toBe(1)
      expect(duplicate.stderr()).toContain('No alternative port was selected')
      expect((await fetch(`${PILOT_ORIGIN}/health`)).status).toBe(200)
      const base = `${PILOT_ORIGIN.replace('http:', 'ws:')}/ws/display?eventId=event-built&displayId=display-built`
      const operator = new WebSocket(`${base}&role=operator`)
      await once(operator, 'open')
      const audience = new WebSocket(`${base}&role=audience`)
      await once(audience, 'open')
      const envelope = createProtocolEnvelope({ sender: { kind: 'operator', id: 'operator-built' }, scope: { eventId: 'event-built', displayId: 'display-built' }, drawSessionId: '00000000-0000-4000-8000-000000000001', epoch: 1, sequence: 1, emittedAt: '2026-09-23T00:00:00.000Z', message: { type: 'display-state', stage: 'standby', eventName: 'Portable runtime public event' } })
      const wire = await encodeDisplayWireEnvelope(envelope, async () => undefined)
      const received = once(audience, 'message')
      operator.send(wire)
      expect(String((await received)[0])).toBe(wire)
      const closed = once(audience, 'close')
      primary.child.send({ type: 'shutdown' })
      expect((await closed)[0]).toBe(1001)
      expect(await primary.exited).toBe(0)
      await expect(fetch(`${PILOT_ORIGIN}/health`)).rejects.toThrow()
      const restarted = launch()
      await restarted.ready
      restarted.child.send({ type: 'shutdown' })
      expect(await restarted.exited).toBe(0)
    } finally {
      if (primary.child.connected) primary.child.send({ type: 'shutdown' })
      await primary.exited
    }
  }, 20_000)

  it('rejects port overrides and missing production assets without declaring ready', async () => {
    const override = launch(['--port', '47883'])
    expect(await override.exited).toBe(1)
    expect(override.stderr()).toContain('Unknown option')
    const missing = launch(['--web-root', join(fixture, 'missing')])
    expect(await missing.exited).toBe(1)
    expect(missing.stderr()).toContain('Kocokan startup failed')
  })
})
