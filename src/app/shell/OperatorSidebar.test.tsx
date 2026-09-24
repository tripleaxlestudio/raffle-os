import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OperatorSidebar } from './OperatorSidebar.tsx'

const workspace = vi.hoisted(() => ({ status: 'empty' as 'empty' | 'invalid-reference' | 'loading' | 'ready' }))

vi.mock('../workspace/ProductionWorkspaceContext.tsx', () => ({
  useProductionWorkspace: () => workspace,
}))

function LocationProbe() {
  return <output data-testid="location"><LocationText /></output>
}

function LocationText() {
  return <>{useLocation().pathname}</>
}

function renderSidebar(path = '/dashboard') {
  return render(<MemoryRouter initialEntries={[path]}><OperatorSidebar production /><LocationProbe /></MemoryRouter>)
}

beforeEach(() => { workspace.status = 'empty' })

describe('production sidebar Event gating', () => {
  it('keeps Dashboard enabled and disables Event-scoped navigation without exposing links', async () => {
    const user = userEvent.setup()
    renderSidebar()

    expect(screen.getByRole('link', { name: 'Dasbor' })).toHaveAttribute('href', '/dashboard')
    for (const label of ['Hadiah', 'Peserta', 'Pengaturan Tampilan', 'Pengaturan Undian', 'Undian', 'Hasil', 'Riwayat']) {
      const item = screen.getByText(label).closest('[aria-disabled]') as HTMLElement
      expect(item).toHaveAttribute('aria-disabled', 'true')
      expect(item).not.toHaveAttribute('tabindex')
      expect(item.closest('a')).toBeNull()
      await user.click(item)
    }
    expect(screen.getByRole('link', { name: 'Log' })).toHaveAttribute('href', '/log')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings/app')
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard')
  })

  it('uses semantic outline icons while keeping production labels visible', () => {
    workspace.status = 'ready'
    renderSidebar()

    expect(document.querySelectorAll('.kc-operator-nav__icon .ui-icon')).toHaveLength(10)
    expect(document.querySelectorAll('.kc-operator-nav__marker')).toHaveLength(0)
    for (const label of ['Dasbor', 'Hadiah', 'Peserta', 'Pengaturan Tampilan', 'Pengaturan Undian', 'Undian', 'Hasil', 'Riwayat']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    const labels = within(screen.getByRole('navigation', { name: 'Navigasi Operator' })).getAllByRole('link').map((link) => link.textContent)
    expect(labels.slice(-3)).toEqual(['Riwayat', 'Log', 'Settings'])
  })

  it('shows secondary placeholder utilities without creating navigation', async () => {
    const user = userEvent.setup()
    workspace.status = 'ready'
    renderSidebar('/dashboard')

    const utilities = screen.getByRole('navigation', { name: 'Bantuan dan informasi' })
    for (const label of ['Yang Baru', 'Panduan Pengguna']) {
      const utility = within(utilities).getByRole('button', { name: label })
      expect(utility).toHaveAttribute('title', `${label} belum tersedia`)
      await user.click(utility)
      expect(screen.getByTestId('location')).toHaveTextContent('/dashboard')
    }

    const support = within(utilities).getByRole('button', { name: 'Dukungan' })
    expect(support).toHaveAttribute('aria-expanded', 'false')
    expect(within(utilities).queryByRole('button', { name: 'Laporkan Masalah' })).not.toBeInTheDocument()

    await user.click(support)

    expect(support).toHaveAttribute('aria-expanded', 'true')
    const workspaceBeforeReport = { ...workspace }
    const reportIssue = within(utilities).getByRole('button', { name: 'Laporkan Masalah' })
    expect(reportIssue).not.toHaveAttribute('title')
    await user.click(reportIssue)
    expect(screen.getByRole('dialog', { name: 'Laporkan Masalah' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard')
    expect(workspace).toEqual(workspaceBeforeReport)
    await user.click(screen.getByRole('button', { name: 'Batal' }))
    expect(screen.queryByRole('dialog', { name: 'Laporkan Masalah' })).not.toBeInTheDocument()

    for (const label of ['Dokumentasi', 'Tentang Kocokan']) {
      const submenuItem = within(utilities).getByRole('button', { name: label })
      expect(submenuItem).toHaveAttribute('title', `${label} belum tersedia`)
      await user.click(submenuItem)
      expect(screen.getByTestId('location')).toHaveTextContent('/dashboard')
    }

    await user.click(support)
    expect(support).toHaveAttribute('aria-expanded', 'false')
    expect(within(utilities).queryByRole('button', { name: 'Laporkan Masalah' })).not.toBeInTheDocument()
    expect(screen.getByText('KOCOKAN', { selector: '.kc-operator-sidebar__footer-label' })).toBeInTheDocument()
    expect(screen.getByText('Versi pengembangan')).toBeInTheDocument()
  })

  it('treats a stale Event reference as unavailable', () => {
    workspace.status = 'invalid-reference'
    renderSidebar()

    expect(screen.getAllByRole('generic').filter((element) => element.getAttribute('aria-disabled') === 'true')).toHaveLength(7)
  })

  it('restores all navigation when the workspace becomes ready without remounting', () => {
    const view = renderSidebar()
    workspace.status = 'ready'
    view.rerender(<MemoryRouter initialEntries={['/dashboard']}><OperatorSidebar production /><LocationProbe /></MemoryRouter>)

    for (const label of ['Dasbor', 'Hadiah', 'Peserta', 'Pengaturan Tampilan', 'Pengaturan Undian', 'Undian', 'Hasil', 'Riwayat']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(screen.queryAllByText('Select an Event first')).toHaveLength(0)
  })

  it('preserves the stable normal navigation shell while workspace data is loading', () => {
    workspace.status = 'loading'
    renderSidebar()

    expect(screen.getAllByRole('link')).toHaveLength(10)
    expect(screen.queryAllByText('Select an Event first')).toHaveLength(0)
  })

  it('marks Prize active on the existing Prize Categories route', () => {
    workspace.status = 'ready'
    renderSidebar('/prize-categories')

    expect(screen.getByRole('link', { name: 'Hadiah' })).toHaveClass('kc-operator-nav__link--active')
    expect(screen.getByRole('link', { name: 'Hadiah' })).toHaveAttribute('href', '/prize-categories')
  })

  it.each([
    ['Log', '/log'],
    ['Settings', '/settings/app'],
  ])('preserves the active treatment for %s', (label, path) => {
    workspace.status = 'ready'
    renderSidebar(path)

    expect(screen.getByRole('link', { name: label })).toHaveClass('kc-operator-nav__link--active')
  })

  it('keeps the next stage disabled when the current stage is complete but not admitted', () => {
    Object.assign(workspace, { status: 'ready', setupReadiness: { event: true, prize: true, participants: false, displaySettings: false, drawSetup: false }, setupJourneyReachedStep: 2 })
    renderSidebar('/prize-categories')

    expect(screen.getByRole('link', { name: 'Hadiah' })).toHaveClass('kc-operator-nav__link--active')
    expect(screen.getByText('Peserta').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Pengaturan Tampilan').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true')
  })

  it('admits the next stage without revoking it when navigating back', () => {
    Object.assign(workspace, { status: 'ready', setupReadiness: { event: true, prize: true, participants: false, displaySettings: false, drawSetup: false }, setupJourneyReachedStep: 3 })
    renderSidebar('/prize-categories')

    expect(screen.getByRole('link', { name: 'Peserta' })).toBeInTheDocument()
    expect(screen.getByText('Pengaturan Tampilan').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true')
  })

  it('restores normal production navigation after authoritative setup completion', () => {
    Object.assign(workspace, { status: 'ready', setupReadiness: { event: true, prize: true, participants: true, displaySettings: true, drawSetup: true }, setupJourneyReachedStep: 5 })
    renderSidebar('/draw/setup')

    for (const label of ['Hadiah', 'Peserta', 'Pengaturan Tampilan', 'Pengaturan Undian', 'Undian', 'Hasil', 'Riwayat']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(screen.queryAllByLabelText('Complete the previous setup step first')).toHaveLength(0)
  })
})
