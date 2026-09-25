// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { consumeUpdateInstallResult, removeStalePartialInstallers } from './update-result.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))) })

async function root(): Promise<string> { const value = await mkdtemp(join(tmpdir(), 'kocokan-update-result-')); roots.push(value); return value }

describe('update result recovery', () => {
  it('consumes one safe result and removes the source file', async () => {
    const directory = await root()
    const path = join(directory, 'last-update-result.json')
    await writeFile(path, JSON.stringify({ version: '0.1.1', result: 'success', timestamp: '2026-09-25T00:00:00.000Z' }))
    await expect(consumeUpdateInstallResult(path)).resolves.toEqual({ version: '0.1.1', result: 'success', timestamp: '2026-09-25T00:00:00.000Z' })
    await expect(consumeUpdateInstallResult(path)).resolves.toBeUndefined()
  })

  it('rejects unsafe fields without exposing them', async () => {
    const directory = await root()
    const path = join(directory, 'last-update-result.json')
    await writeFile(path, JSON.stringify({ version: '0.1.1', result: 'failed', timestamp: '2026-09-25T00:00:00.000Z', path: 'secret' }))
    await expect(consumeUpdateInstallResult(path)).resolves.toBeUndefined()
  })

  it('removes only exact stale partial installer names', async () => {
    const directory = await root()
    const version = join(directory, '0.1.1')
    await mkdir(version)
    await writeFile(join(version, 'Kocokan-Setup-0.1.1.exe.part'), 'partial')
    await writeFile(join(version, 'keep.part'), 'keep')
    await removeStalePartialInstallers(directory)
    await expect(readFile(join(version, 'Kocokan-Setup-0.1.1.exe.part'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(join(version, 'keep.part'), 'utf8')).resolves.toBe('keep')
  })
})
