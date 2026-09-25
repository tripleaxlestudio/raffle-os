import { describe, expect, it, vi } from 'vitest'
import { LocalUpdateClient, LocalUpdateClientError, type NativeUpdateStatus } from './local-update-client.ts'

const TOKEN_A = 'A'.repeat(43)
const TOKEN_B = 'B'.repeat(43)
const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('LocalUpdateClient', () => {
  it('treats an absent development API as development without throwing', async () => {
    const client = new LocalUpdateClient({ fetch: vi.fn(async () => new Response('<html>', { status: 200 })) })
    await expect(client.detectCapabilities()).resolves.toEqual({ environment: 'development', prepareSupported: false, installSupported: false })
  })

  it.each([
    ['portable', false],
    ['installed', true],
  ] as const)('reads %s capabilities', async (environment, prepareSupported) => {
    const client = new LocalUpdateClient({ fetch: vi.fn(async () => response({ environment, currentVersion: '0.1.0', prepareSupported, installSupported: false })) })
    await expect(client.detectCapabilities()).resolves.toMatchObject({ environment, prepareSupported, installSupported: false })
  })

  it('bootstraps once, keeps the token only in memory, and prepares', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ mutationToken: TOKEN_A }))
      .mockResolvedValueOnce(response({ state: 'preparing', version: '0.1.1' }, 202))
      .mockResolvedValueOnce(response({ state: 'preparing', version: '0.1.2' }, 202))
    const client = new LocalUpdateClient({ fetch })
    await client.prepare('0.1.1')
    await client.prepare('0.1.2')
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[1]?.[1]?.headers).toMatchObject({ 'X-Kocokan-Update-Token': TOKEN_A })
    expect(fetch.mock.calls[2]?.[1]?.headers).toMatchObject({ 'X-Kocokan-Update-Token': TOKEN_A })
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('rejects bootstrap origin/auth failures without retaining a token', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ error: 'origin-required' }, 403))
    const client = new LocalUpdateClient({ fetch })
    await expect(client.prepare('0.1.1')).rejects.toMatchObject({ code: 'bootstrap-failed' })
  })

  it('re-bootstraps exactly once after an invalid token', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ mutationToken: TOKEN_A }))
      .mockResolvedValueOnce(response({ error: 'authorization-required' }, 403))
      .mockResolvedValueOnce(response({ mutationToken: TOKEN_B }))
      .mockResolvedValueOnce(response({ state: 'preparing', version: '0.1.1' }, 202))
    const client = new LocalUpdateClient({ fetch })
    await expect(client.prepare('0.1.1')).resolves.toMatchObject({ state: 'preparing' })
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('stops after the second authorization failure', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ mutationToken: TOKEN_A }))
      .mockResolvedValueOnce(response({}, 403))
      .mockResolvedValueOnce(response({ mutationToken: TOKEN_B }))
      .mockResolvedValueOnce(response({}, 403))
    await expect(new LocalUpdateClient({ fetch }).prepare('0.1.1')).rejects.toMatchObject({ code: 'authorization-failed' })
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('polls conservatively and stops on ready', async () => {
    const statuses: NativeUpdateStatus[] = []
    const delay = vi.fn(async () => undefined)
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ state: 'downloading', progress: { downloadedBytes: 50, totalBytes: 100, percent: 50 } }))
      .mockResolvedValueOnce(response({ state: 'verifying' }))
      .mockResolvedValueOnce(response({ state: 'ready-to-install' }))
    const result = await new LocalUpdateClient({ fetch, delay }).pollStatus((status) => statuses.push(status))
    expect(result.state).toBe('ready-to-install')
    expect(statuses.map(({ state }) => state)).toEqual(['downloading', 'verifying', 'ready-to-install'])
    expect(delay).toHaveBeenCalledTimes(2)
    expect(delay).toHaveBeenCalledWith(750, undefined)
  })

  it('stops polling on a public error', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ state: 'error', error: 'checksum-invalid' }))
    const result = await new LocalUpdateClient({ fetch, delay: vi.fn(async () => undefined) }).pollStatus(() => undefined)
    expect(result).toMatchObject({ state: 'error', error: 'checksum-invalid' })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('stops safely when the runtime becomes unavailable', async () => {
    const client = new LocalUpdateClient({ fetch: vi.fn(async () => { throw new TypeError('offline') }) })
    await expect(client.getStatus()).rejects.toEqual(new LocalUpdateClientError('runtime-unavailable'))
  })

  it('uses in-memory authorization for the exact install version', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ mutationToken: TOKEN_A })).mockResolvedValueOnce(response({ state: 'installing', version: '0.1.1' }, 202))
    await expect(new LocalUpdateClient({ fetch }).install('0.1.1')).resolves.toEqual({ state: 'installing', version: '0.1.1' })
    expect(fetch.mock.calls[1]?.[0]).toBe('/api/update/install')
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ body: '{"version":"0.1.1"}', headers: { 'X-Kocokan-Update-Token': TOKEN_A } })
  })

  it('reads only a bounded public install result shape', async () => {
    const client = new LocalUpdateClient({ fetch: vi.fn(async () => response({ result: { version: '0.1.1', result: 'success', timestamp: '2026-09-25T00:00:00.000Z' } })) })
    await expect(client.getInstallResult()).resolves.toEqual({ version: '0.1.1', result: 'success', timestamp: '2026-09-25T00:00:00.000Z' })
  })
})
