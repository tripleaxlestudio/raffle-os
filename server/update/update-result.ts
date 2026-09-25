import { readFile, readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

export type UpdateInstallResultKind = 'success' | 'cancelled' | 'failed'

export interface UpdateInstallResult {
  readonly version: string
  readonly result: UpdateInstallResultKind
  readonly timestamp: string
}

const VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function consumeUpdateInstallResult(path: string): Promise<UpdateInstallResult | undefined> {
  try {
    const metadata = await stat(path)
    if (!metadata.isFile()) return undefined
    if (metadata.size > 1024) { await unlink(path); return undefined }
    const raw = await readFile(path, 'utf8')
    await unlink(path)
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'result,timestamp,version') return undefined
    if (typeof value.version !== 'string' || !VERSION.test(value.version)) return undefined
    if (value.result !== 'success' && value.result !== 'cancelled' && value.result !== 'failed') return undefined
    if (typeof value.timestamp !== 'string' || Number.isNaN(Date.parse(value.timestamp))) return undefined
    return { version: value.version, result: value.result, timestamp: value.timestamp }
  } catch (cause: unknown) {
    if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'ENOENT') return undefined
    return undefined
  }
}

export async function removeStalePartialInstallers(updateRoot: string): Promise<void> {
  let entries
  try { entries = await readdir(updateRoot, { withFileTypes: true }) } catch { return }
  await Promise.all(entries.filter((entry) => entry.isDirectory() && VERSION.test(entry.name)).map(async (entry) => {
    const partial = join(updateRoot, entry.name, `Kocokan-Setup-${entry.name}.exe.part`)
    try { await unlink(partial) } catch (cause: unknown) {
      if (!(typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'ENOENT')) return
    }
  }))
}
