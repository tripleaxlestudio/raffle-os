import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { startLocalServer } from './local-server.ts'

// Vite replaces this constant in the standalone bundle; no Vite code runs here.
declare const __KOCOKAN_RUNTIME_VERSION__: string

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { 'web-root': { type: 'string' } }, strict: true, allowPositionals: false })
  const executableDirectory = dirname(resolve(process.argv[1] ?? '.'))
  const runtime = await startLocalServer({
    webRoot: values['web-root'] ?? resolve(executableDirectory, '../dist'),
    version: __KOCOKAN_RUNTIME_VERSION__,
  })
  process.stdout.write(`${JSON.stringify({ type: 'ready', origin: runtime.origin, version: __KOCOKAN_RUNTIME_VERSION__ })}\n`)
  let shutdownRequested = false
  const shutdown = (): void => {
    if (shutdownRequested) return
    shutdownRequested = true
    void runtime.close().then(() => {
      process.stdout.write(`${JSON.stringify({ type: 'stopped' })}\n`)
      process.removeListener('SIGINT', shutdown)
      process.removeListener('SIGTERM', shutdown)
      process.removeListener('message', onMessage)
      process.removeListener('disconnect', shutdown)
      if (process.connected) process.disconnect()
    }).catch(() => { process.stderr.write('Kocokan shutdown failed.\n'); process.exitCode = 1 })
  }
  // Private parent-process IPC, never an HTTP shutdown endpoint. Also supports
  // automated Windows tests where POSIX signals are not graceful termination.
  const onMessage = (message: unknown): void => {
    if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'shutdown') shutdown()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('message', onMessage)
  process.on('disconnect', shutdown)
}

void main().catch((error: unknown) => {
  process.stderr.write(`Kocokan startup failed: ${error instanceof Error ? error.message : 'Unknown runtime error.'}\n`)
  process.exitCode = 1
})
