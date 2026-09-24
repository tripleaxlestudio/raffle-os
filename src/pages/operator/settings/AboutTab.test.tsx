import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { StableRelease, UpdateReleaseClient } from '../../../application/update/update-checker.ts'
import type { ExternalLinkOpenResult } from '../../../infrastructure/browser/external-link.ts'
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
}: {
  readonly updateClient?: UpdateReleaseClient
  readonly openLink?: (url: string) => ExternalLinkOpenResult
} = {}) {
  render(
    <UiThemeContext.Provider value="kocokan">
      <AboutTab currentVersion="0.1.0" openLink={openLink} updateClient={updateClient} />
    </UiThemeContext.Provider>,
  )
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
