import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StableRelease, UpdateReleaseClient } from '../../../application/update/update-checker.ts'
import { productionUpdateLock } from '../../../application/update/update-lock.ts'
import type { UpdateSafetyAuthority } from '../../../application/update/update-safety.ts'
import type { ExternalLinkOpenResult } from '../../../infrastructure/browser/external-link.ts'
import { LocalUpdateClient } from '../../../infrastructure/update/local-update-client.ts'
import { UiThemeContext } from '../../../shared/ui/ui-theme.ts'
import { AboutTab } from './AboutTab.tsx'

function stableRelease(version = '0.1.0'): StableRelease {
  return {
    tagName: `v${version}`,
    version,
    htmlUrl: `https://github.com/tripleaxlestudio/raffle-os/releases/tag/v${version}`,
    publishedAt: '2026-09-24T02:29:48Z',
  }
}

function clientFrom(check: UpdateReleaseClient['getLatestStableRelease']): UpdateReleaseClient {
  return { getLatestStableRelease: check }
}

function renderAbout({
  updateClient = clientFrom(async () => stableRelease()),
  openLink = vi.fn<(url: string) => ExternalLinkOpenResult>(() => 'opened'),
  nativeClient: nativeUpdateClient,
  safetyAuthority,
}: {
  readonly updateClient?: UpdateReleaseClient
  readonly openLink?: (url: string) => ExternalLinkOpenResult
  readonly nativeClient?: LocalUpdateClient
  readonly safetyAuthority?: UpdateSafetyAuthority
} = {}) {
  return render(
    <UiThemeContext.Provider value="kocokan">
      <AboutTab currentVersion="0.1.0" nativeClient={nativeUpdateClient} openLink={openLink} safetyAuthority={safetyAuthority} updateClient={updateClient} />
    </UiThemeContext.Provider>,
  )
}

afterEach(() => productionUpdateLock.release())

function createNativeClient(environment: 'portable' | 'installed', statuses: readonly unknown[] = []) {
  let statusIndex = 0
  return new LocalUpdateClient({
    delay: async () => undefined,
    fetch: vi.fn(async (input) => {
      const path = String(input)
      if (path.endsWith('/capabilities')) return new Response(JSON.stringify({ environment, currentVersion: '0.1.0', prepareSupported: environment === 'installed', installSupported: false }), { status: 200 })
      if (path.endsWith('/bootstrap')) return new Response(JSON.stringify({ mutationToken: 'A'.repeat(43) }), { status: 200 })
      if (path.endsWith('/prepare')) return new Response(JSON.stringify({ state: 'preparing', version: '0.1.1' }), { status: 202 })
      if (path.endsWith('/result')) return new Response(JSON.stringify({ result: null }), { status: 200 })
      if (path.endsWith('/status')) return new Response(JSON.stringify(statuses[statusIndex++] ?? { state: 'ready-to-install', version: '0.1.1' }), { status: 200 })
      return new Response(null, { status: 404 })
    }),
  })
}

describe('AboutTab update checker', () => {
  it('starts idle and displays the package version', () => {
    renderAbout()
    expect(screen.getByText('0.1.0')).toBeInTheDocument()
    expect(screen.getByText('Belum diperiksa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Periksa Pembaruan' })).toBeEnabled()
  })

  it('shows checking state while the request is pending', async () => {
    let resolveRelease: ((release: StableRelease) => void) | undefined
    const updateClient = clientFrom(() => new Promise((resolve) => { resolveRelease = resolve }))
    renderAbout({ updateClient })

    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    expect(screen.getByText('Memeriksa pembaruan...')).toBeInTheDocument()

    await act(async () => resolveRelease?.(stableRelease()))
  })

  it('disables the check button while checking', async () => {
    const updateClient = clientFrom(() => new Promise(() => undefined))
    renderAbout({ updateClient })

    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    expect(screen.getByRole('button', { name: 'Memeriksa…' })).toBeDisabled()
  })

  it('shows up-to-date state and supports checking again', async () => {
    const check = vi.fn(async () => stableRelease())
    renderAbout({ updateClient: clientFrom(check) })

    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    expect(await screen.findByText('Anda menggunakan versi terbaru.')).toBeInTheDocument()
    expect(screen.getByText('Versi 0.1.0')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Periksa Lagi' }))
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('shows update-available state without downloading anything', async () => {
    renderAbout({ updateClient: clientFrom(async () => stableRelease('0.1.1')) })
    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))

    expect(await screen.findByText('Pembaruan tersedia: v0.1.1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lihat Rilis' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Periksa Lagi' })).toBeEnabled()
  })

  it('shows installed-only copy in development and portable modes', async () => {
    const development = new LocalUpdateClient({ fetch: vi.fn(async () => new Response('<html>', { status: 200 })) })
    const view = renderAbout({ updateClient: clientFrom(async () => stableRelease('0.1.1')), nativeClient: development })
    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    expect(await screen.findByText('Pembaruan otomatis hanya tersedia pada versi Kocokan yang terpasang.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Update Sekarang' })).not.toBeInTheDocument()
    view.unmount()

    renderAbout({ updateClient: clientFrom(async () => stableRelease('0.1.1')), nativeClient: createNativeClient('portable') })
    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    expect(await screen.findByText('Pembaruan otomatis hanya tersedia pada versi Kocokan yang terpasang.')).toBeInTheDocument()
  })

  it('offers preparation only for an installed and authoritatively safe workspace', async () => {
    renderAbout({
      updateClient: clientFrom(async () => stableRelease('0.1.1')),
      nativeClient: createNativeClient('installed'),
      safetyAuthority: async () => ({ safe: true }),
    })
    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    expect(await screen.findByRole('button', { name: 'Update Sekarang' })).toBeEnabled()
  })

  it('blocks preparation while an Audience subscriber is connected', async () => {
    renderAbout({
      updateClient: clientFrom(async () => stableRelease('0.1.1')),
      nativeClient: createNativeClient('installed'),
      safetyAuthority: async () => ({ safe: false, reason: 'audience-connected' }),
    })
    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    expect(await screen.findByText('Tutup Audience Display sebelum memasang pembaruan.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update Sekarang' })).toBeDisabled()
  })

  it('shows download progress, verification, then stops at ready-to-install', async () => {
    const releases: Array<() => void> = []
    let statusIndex = 0
    const statuses = [
      { state: 'downloading', version: '0.1.1', progress: { downloadedBytes: 50, totalBytes: 100, percent: 50 } },
      { state: 'verifying', version: '0.1.1' },
      { state: 'ready-to-install', version: '0.1.1' },
    ]
    const client = new LocalUpdateClient({
      delay: () => new Promise<void>((resolve) => { releases.push(resolve) }),
      fetch: vi.fn(async (input) => {
        const path = String(input)
        if (path.endsWith('/capabilities')) return new Response(JSON.stringify({ environment: 'installed', currentVersion: '0.1.0', prepareSupported: true, installSupported: false }), { status: 200 })
        if (path.endsWith('/bootstrap')) return new Response(JSON.stringify({ mutationToken: 'A'.repeat(43) }), { status: 200 })
        if (path.endsWith('/prepare')) return new Response(JSON.stringify({ state: 'preparing', version: '0.1.1' }), { status: 202 })
        if (path.endsWith('/result')) return new Response(JSON.stringify({ result: null }), { status: 200 })
        return new Response(JSON.stringify(statuses[statusIndex++]), { status: 200 })
      }),
    })
    renderAbout({ updateClient: clientFrom(async () => stableRelease('0.1.1')), nativeClient: client, safetyAuthority: async () => ({ safe: true }) })
    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Update Sekarang' }))
    expect(await screen.findByText('Mengunduh pembaruan...')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progres unduhan pembaruan' })).toHaveAttribute('value', '50')
    await act(async () => releases.shift()?.())
    expect(await screen.findByText('Memverifikasi pembaruan...')).toBeInTheDocument()
    await act(async () => releases.shift()?.())
    expect(await screen.findByText('Siap dipasang')).toBeInTheDocument()
    expect(productionUpdateLock.getState()).toBe('ready-to-install')
    expect(screen.queryByRole('button', { name: /pasang/i })).not.toBeInTheDocument()
  })

  it('renders indeterminate progress when total size is unavailable', async () => {
    let statusSent = false
    const client = new LocalUpdateClient({
      delay: () => new Promise<void>(() => undefined),
      fetch: vi.fn(async (input) => {
        const path = String(input)
        if (path.endsWith('/capabilities')) return new Response(JSON.stringify({ environment: 'installed', prepareSupported: true, installSupported: false }), { status: 200 })
        if (path.endsWith('/bootstrap')) return new Response(JSON.stringify({ mutationToken: 'A'.repeat(43) }), { status: 200 })
        if (path.endsWith('/prepare')) return new Response(JSON.stringify({ state: 'preparing', version: '0.1.1' }), { status: 202 })
        if (path.endsWith('/result')) return new Response(JSON.stringify({ result: null }), { status: 200 })
        statusSent = true
        return new Response(JSON.stringify({ state: 'downloading', version: '0.1.1', progress: { downloadedBytes: 25 } }), { status: 200 })
      }),
    })
    const view = renderAbout({ updateClient: clientFrom(async () => stableRelease('0.1.1')), nativeClient: client, safetyAuthority: async () => ({ safe: true }) })
    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Update Sekarang' }))
    expect(await screen.findByText('Mengunduh pembaruan...')).toBeInTheDocument()
    expect(statusSent).toBe(true)
    expect(screen.getByRole('progressbar', { name: 'Progres unduhan pembaruan' })).not.toHaveAttribute('value')
    view.unmount()
  })

  it('rechecks safety and requests install only from ready installed state', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path.endsWith('/capabilities')) return new Response(JSON.stringify({ environment: 'installed', currentVersion: '0.1.0', prepareSupported: true, installSupported: true }), { status: 200 })
      if (path.endsWith('/result')) return new Response(JSON.stringify({ result: null }), { status: 200 })
      if (path.endsWith('/bootstrap')) return new Response(JSON.stringify({ mutationToken: 'A'.repeat(43) }), { status: 200 })
      if (path.endsWith('/prepare')) return new Response(JSON.stringify({ state: 'preparing', version: '0.1.1' }), { status: 202 })
      if (path.endsWith('/status')) return new Response(JSON.stringify({ state: 'ready-to-install', version: '0.1.1' }), { status: 200 })
      if (path.endsWith('/install')) return new Response(JSON.stringify({ state: 'installing', version: '0.1.1' }), { status: 202 })
      return new Response(null, { status: 404 })
    })
    const safety = vi.fn<UpdateSafetyAuthority>(async () => ({ safe: true }))
    renderAbout({ updateClient: clientFrom(async () => stableRelease('0.1.1')), nativeClient: new LocalUpdateClient({ fetch }), safetyAuthority: safety })
    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Update Sekarang' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pasang Pembaruan' }))
    expect(await screen.findByText('Menyiapkan instalasi...')).toBeInTheDocument()
    expect(fetch.mock.calls.some(([input]) => String(input).endsWith('/install'))).toBe(true)
    expect(safety.mock.calls.length).toBeGreaterThanOrEqual(5)
    expect(productionUpdateLock.getState()).toBe('ready-to-install')
  })

  it('blocks handoff when the authoritative safety state becomes unsafe', async () => {
    let safetyReads = 0
    const safety = vi.fn<UpdateSafetyAuthority>(async () => (++safetyReads >= 4 ? { safe: false, reason: 'audience-connected' } : { safe: true }))
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path.endsWith('/capabilities')) return new Response(JSON.stringify({ environment: 'installed', prepareSupported: true, installSupported: true }), { status: 200 })
      if (path.endsWith('/result')) return new Response(JSON.stringify({ result: null }), { status: 200 })
      if (path.endsWith('/bootstrap')) return new Response(JSON.stringify({ mutationToken: 'A'.repeat(43) }), { status: 200 })
      if (path.endsWith('/prepare')) return new Response(JSON.stringify({ state: 'preparing', version: '0.1.1' }), { status: 202 })
      return new Response(JSON.stringify({ state: 'ready-to-install', version: '0.1.1' }), { status: 200 })
    })
    renderAbout({ updateClient: clientFrom(async () => stableRelease('0.1.1')), nativeClient: new LocalUpdateClient({ fetch }), safetyAuthority: safety })
    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Update Sekarang' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pasang Pembaruan' }))
    expect(await screen.findByText('Tutup Audience Display sebelum memasang pembaruan.')).toBeInTheDocument()
    expect(fetch.mock.calls.some(([input]) => String(input).endsWith('/install'))).toBe(false)
  })

  it('keeps a calm installing state when runtime disconnects during handoff', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path.endsWith('/capabilities')) return new Response(JSON.stringify({ environment: 'installed', prepareSupported: true, installSupported: true }), { status: 200 })
      if (path.endsWith('/result')) return new Response(JSON.stringify({ result: null }), { status: 200 })
      if (path.endsWith('/bootstrap')) return new Response(JSON.stringify({ mutationToken: 'A'.repeat(43) }), { status: 200 })
      if (path.endsWith('/prepare')) return new Response(JSON.stringify({ state: 'preparing', version: '0.1.1' }), { status: 202 })
      if (path.endsWith('/install')) throw new TypeError('runtime closed')
      return new Response(JSON.stringify({ state: 'ready-to-install', version: '0.1.1' }), { status: 200 })
    })
    renderAbout({ updateClient: clientFrom(async () => stableRelease('0.1.1')), nativeClient: new LocalUpdateClient({ fetch }), safetyAuthority: async () => ({ safe: true }) })
    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Update Sekarang' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pasang Pembaruan' }))
    expect(await screen.findByText('Menyiapkan instalasi...')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['success', 'Pembaruan v0.1.1 berhasil dipasang.'],
    ['cancelled', 'Pemasangan v0.1.1 dibatalkan.'],
    ['failed', 'Pemasangan v0.1.1 gagal.'],
  ] as const)('shows the consumed %s install result after relaunch', async (result, copy) => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/result')
      ? new Response(JSON.stringify({ result: { version: '0.1.1', result, timestamp: '2026-09-25T00:00:00.000Z' } }), { status: 200 })
      : new Response(JSON.stringify({ environment: 'installed', prepareSupported: true, installSupported: true }), { status: 200 }))
    renderAbout({ nativeClient: new LocalUpdateClient({ fetch }) })
    expect(await screen.findByText(copy)).toBeInTheDocument()
  })

  it('maps native errors and allows a preparation retry', async () => {
    const client = createNativeClient('installed', [{ state: 'error', version: '0.1.1', error: 'checksum-invalid' }, { state: 'ready-to-install', version: '0.1.1' }])
    renderAbout({ updateClient: clientFrom(async () => stableRelease('0.1.1')), nativeClient: client, safetyAuthority: async () => ({ safe: true }) })
    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Update Sekarang' }))
    expect(await screen.findByText('Verifikasi pembaruan gagal.')).toBeInTheDocument()
    expect(productionUpdateLock.getState()).toBe('idle')
    await userEvent.click(screen.getByRole('button', { name: 'Coba Lagi Menyiapkan' }))
    expect(await screen.findByText('Siap dipasang')).toBeInTheDocument()
  })

  it('shows a nonfatal error state', async () => {
    renderAbout({ updateClient: clientFrom(async () => { throw new Error('offline') }) })
    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))

    expect(await screen.findByText('Tidak dapat memeriksa pembaruan.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Coba Lagi' })).toBeEnabled()
  })

  it('retries after an error', async () => {
    const check = vi.fn<UpdateReleaseClient['getLatestStableRelease']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(stableRelease())
    renderAbout({ updateClient: clientFrom(check) })

    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    await screen.findByText('Tidak dapat memeriksa pembaruan.')
    await userEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }))

    expect(await screen.findByText('Anda menggunakan versi terbaru.')).toBeInTheDocument()
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('opens the validated HTTPS release URL through the external-link helper', async () => {
    const openLink = vi.fn<(url: string) => ExternalLinkOpenResult>(() => 'opened')
    renderAbout({ updateClient: clientFrom(async () => stableRelease('0.1.1')), openLink })
    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Lihat Rilis' }))

    expect(openLink).toHaveBeenCalledWith('https://github.com/tripleaxlestudio/raffle-os/releases/tag/v0.1.1')
  })

  it('does not write browser persistence while checking', async () => {
    const localWrite = vi.spyOn(Storage.prototype, 'setItem')
    const localRemove = vi.spyOn(Storage.prototype, 'removeItem')
    const indexedDbOpen = vi.fn()
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: { open: indexedDbOpen },
    })
    renderAbout({ updateClient: clientFrom(async () => stableRelease()) })

    await userEvent.click(screen.getByRole('button', { name: 'Periksa Pembaruan' }))
    await screen.findByText('Anda menggunakan versi terbaru.')

    expect(localWrite).not.toHaveBeenCalled()
    expect(localRemove).not.toHaveBeenCalled()
    expect(indexedDbOpen).not.toHaveBeenCalled()
    Reflect.deleteProperty(globalThis, 'indexedDB')
  })
})
