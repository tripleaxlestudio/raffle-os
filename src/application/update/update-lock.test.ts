import { describe, expect, it } from 'vitest'
import { UpdateOperationLock, UpdateOperationLockedError } from './update-lock.ts'

describe('UpdateOperationLock', () => {
  it('acquires before the authoritative validation resolves and blocks draw operations', async () => {
    const lock = new UpdateOperationLock()
    let resolve!: (safe: boolean) => void
    const acquiring = lock.acquire(() => new Promise<boolean>((done) => { resolve = done }))

    expect(lock.getState()).toBe('preparing')
    expect(() => lock.assertDrawOperationAllowed()).toThrow(UpdateOperationLockedError)
    resolve(true)
    await expect(acquiring).resolves.toBe(true)
  })

  it('releases when the second safety read fails closed', async () => {
    const lock = new UpdateOperationLock()
    await expect(lock.acquire(async () => false)).resolves.toBe(false)
    expect(lock.getState()).toBe('idle')
  })

  it('blocks redraw-equivalent callers while preparing and remains active when ready', async () => {
    const lock = new UpdateOperationLock()
    await lock.acquire(async () => true)
    expect(() => lock.assertDrawOperationAllowed()).toThrow(UpdateOperationLockedError)
    lock.markReadyToInstall()
    expect(lock.getState()).toBe('ready-to-install')
    expect(() => lock.assertDrawOperationAllowed()).toThrow(UpdateOperationLockedError)
  })

  it('releases explicitly after a preparation error or reset', async () => {
    const lock = new UpdateOperationLock()
    await lock.acquire(async () => true)
    lock.release()
    expect(() => lock.assertDrawOperationAllowed()).not.toThrow()
  })

  it('revalidates while preserving the active lock', async () => {
    const lock = new UpdateOperationLock()
    await lock.acquire(async () => true)
    lock.markReadyToInstall()
    await expect(lock.revalidate(async () => false)).resolves.toBe(false)
    expect(lock.getState()).toBe('ready-to-install')
  })
})
