import { GUIDE_SECTIONS } from './help-guide-sections.ts'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { appRoutes } from '../../../app/router.tsx'
import { KOCOKAN_APP_VERSION } from '../../../config/app-version.ts'
import { AppSettingsPage } from '../AppSettingsPage.tsx'
import { HelpGuidePage, HelpSupportPage } from './HelpPages.tsx'

function settingsRouter(path: string) {
  const router = createMemoryRouter([{ path: '/settings/app', element: <AppSettingsPage /> }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('Help infrastructure and navigation', () => {
  it.each([
    ['/help/whats-new', 'Yang Baru di Kocokan'],
    ['/help/guide', 'Panduan Pengguna'],
    ['/help/support', 'Dukungan Kocokan'],
    ['/help/licenses', 'Lisensi & Open Source'],
  ])('opens %s directly in the Operator shell without an active event', async (path, title) => {
    const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeVisible()
    expect(document.querySelector('[data-operator-shell]')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
    expect(screen.getByRole('link', { name: 'Kembali ke Settings → Tentang' })).toHaveAttribute('href', '/settings/app?tab=about')
    if (path === '/help/whats-new') {
      expect(screen.getByRole('heading', { name: `Versi ${KOCOKAN_APP_VERSION}` })).toBeVisible()
      expect(screen.getByText('Catatan perubahan untuk versi ini belum tersedia.')).toBeVisible()
    }
    if (path === '/help/licenses') expect(screen.getByText('Ketentuan penggunaan Kocokan belum dipublikasikan pada build ini.')).toBeVisible()
  })

  it.each(['about', 'storage', 'invalid', ''])('selects the tab from direct URL %s', (tab) => {
    settingsRouter(`/settings/app?tab=${tab}`)
    const name = tab === 'about' ? 'Tentang' : tab === 'storage' ? 'Data & Penyimpanan' : 'Umum'
    expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true')
  })

  it.each([
    ['/help/whats-new', 'Yang Baru di Kocokan'],
    ['/help/guide', 'Panduan Pengguna'],
    ['/help/support', 'Dukungan Kocokan'],
    ['/help/licenses', 'Lisensi & Open Source'],
  ])('opens %s from About and returns to the same tab', async (path, heading) => {
    const user = userEvent.setup()
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/settings/app?tab=about'] })
    render(<RouterProvider router={router} />)
    const action = screen.getByRole('tabpanel').querySelector(`a[href="${path}"]`)
    if (action === null) throw new Error('Help action missing')
    await user.click(action)
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeVisible()
    await user.click(screen.getByRole('link', { name: 'Kembali ke Settings → Tentang' }))
    expect(screen.getByRole('tab', { name: 'Tentang' })).toHaveAttribute('aria-selected', 'true')
  })

  it('follows URL changes, retains other query parameters, and supports Back/Forward', async () => {
    const user = userEvent.setup()
    const router = settingsRouter('/settings/app?tab=general&context=help')
    await user.click(screen.getByRole('tab', { name: 'Tentang' }))
    expect(router.state.location.search).toBe('?tab=about&context=help')
    await act(() => router.navigate(-1))
    expect(screen.getByRole('tab', { name: 'Umum' })).toHaveAttribute('aria-selected', 'true')
    await act(() => router.navigate(1))
    expect(screen.getByRole('tab', { name: 'Tentang' })).toHaveAttribute('aria-selected', 'true')
    await act(() => router.navigate('/settings/app?tab=operations'))
    expect(screen.getByRole('tab', { name: 'Operasional' })).toHaveAttribute('aria-selected', 'true')
    await act(() => router.navigate('/settings/app?tab=about'))
    expect(screen.getByRole('tab', { name: 'Tentang' })).toHaveAttribute('aria-selected', 'true')
    const panel = screen.getByRole('tabpanel')
    for (const path of ['/help/whats-new', '/help/guide', '/help/support', '/help/licenses']) {
      expect(panel.querySelector(`a[href="${path}"]`)).toBeInTheDocument()
    }
    expect(panel.textContent).not.toContain('Simulasi')
  })

  it('provides all guide anchors, focus navigation, and an optional manual checklist', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter([{ path: '/help/guide', element: <HelpGuidePage /> }], { initialEntries: ['/help/guide'] })
    render(<RouterProvider router={router} />)
    for (const section of GUIDE_SECTIONS) {
      expect(screen.getByRole('link', { name: section.title })).toHaveAttribute('href', `/help/guide#${section.id}`)
      expect(screen.getByRole('heading', { name: section.title })).toHaveAttribute('id', section.id)
    }
    await user.click(screen.getByRole('link', { name: 'Checklist Sebelum Acara' }))
    expect(screen.getByRole('heading', { name: 'Checklist Sebelum Acara' })).toHaveFocus()
    expect(screen.getByRole('checkbox', { name: /^Opsional:/ })).not.toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: /^Opsional:/ }))
    expect(screen.getByRole('checkbox', { name: /^Opsional:/ })).toBeChecked()
  })

  it('opens the existing reporting modal and restores focus on closing', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter([{ path: '/help/support', element: <HelpSupportPage /> }], { initialEntries: ['/help/support'] })
    render(<RouterProvider router={router} />)
    const report = screen.getByRole('button', { name: 'Laporkan Masalah' })
    await user.click(report)
    expect(screen.getByRole('dialog', { name: 'Laporkan Masalah' })).toBeVisible()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(report).toHaveFocus()
    expect(screen.getByText(/Membuka form bukan berarti laporan sudah terkirim/)).toBeVisible()
  })
})
