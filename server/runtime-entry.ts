import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createInterface } from 'node:readline'
import { startLocalServer } from './local-server.ts'
import { createDefaultUpdatePreparationServices } from './update/update-api.ts'
import { consumeRuntimeUpdateBootstrap } from './update/runtime-capability.ts'
import { consumeUpdateInstallResult, removeStalePartialInstallers } from './update/update-result.ts'

// Vite replaces this constant in the standalone bundle; no Vite code runs here.
declare const __KOCOKAN_RUNTIME_VERSION__: string

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { 'web-root': { type: 'string' }, 'launcher-stdio': { type: 'boolean' } }, strict: true, allowPositionals: false })
  const executableDirectory = dirname(resolve(process.argv[1] ?? '.'))
  const updateBootstrap = consumeRuntimeUpdateBootstrap(process.env)
  const localAppData = process.env.LOCALAPPDATA
  const updateRoot = updateBootstrap.capability === 'installed' && typeof localAppData === 'string' && localAppData.trim() !== ''
    ? resolve(localAppData, 'Kocokan', 'updates') : undefined
  if (updateRoot !== undefined) await removeStalePartialInstallers(updateRoot)
  const lastInstallResult = updateRoot === undefined ? undefined : await consumeUpdateInstallResult(resolve(updateRoot, 'last-update-result.json'))
  const updateServices = updateRoot === undefined ? undefined : createDefaultUpdatePreparationServices(updateRoot)
  const requestInstall = updateBootstrap.capability === 'installed' && values['launcher-stdio'] === true
    ? (version: string): void => {
        process.stdout.write(`${JSON.stringify({ type: 'update-install', version })}\n`)
      }
    : undefined
  const runtime = await startLocalServer({
    webRoot: values['web-root'] ?? resolve(executableDirectory, '../dist'),
    version: __KOCOKAN_RUNTIME_VERSION__,
    update: {
      capability: updateBootstrap.capability,
      ...(updateBootstrap.mutationToken === undefined ? {} : { mutationToken: updateBootstrap.mutationToken }),
      ...(updateServices === undefined ? {} : { services: updateServices }),
      ...(requestInstall === undefined ? {} : { requestInstall }),
      ...(lastInstallResult === undefined ? {} : { lastInstallResult }),
    },
  })
  process.stdout.write(`${JSON.stringify({ type: 'ready', origin: runtime.origin, version: __KOCOKAN_RUNTIME_VERSION__ })}\n`)
  let shutdownRequested = false
  const control = values['launcher-stdio'] ? createInterface({ input: process.stdin }) : undefined
  const shutdown = (): void => {
    if (shutdownRequested) return
    shutdownRequested = true
    control?.close()
    if (control !== undefined) process.stdin.destroy()
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
  // Inherited anonymous stdin pipe is private to the launcher. EOF also stops
  // the runtime after parent death; no public shutdown route is added.
  control?.on('line', (line) => { if (line === 'shutdown') shutdown() })
  control?.on('close', shutdown)
  if (control !== undefined && process.stdin.readableEnded) shutdown()
}

void main().catch((error: unknown) => {
  process.stderr.write(`Kocokan startup failed: ${error instanceof Error ? error.message : 'Unknown runtime error.'}\n`)
  process.exitCode = 1
})
