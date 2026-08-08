import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { appRoutes } from './router.tsx'

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('application routes', () => {
  it('redirects the root to the production dashboard', async () => {
    const router = renderRoute('/')
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    expect(screen.queryByText('Nusantara Tech Gala 2026')).not.toBeInTheDocument()
  })

  it.each(['/dashboard', '/participants', '/draw/setup', '/history', '/display'])('renders production route %s without prototype chrome', async (path) => {
    renderRoute(path)
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument())
    expect(screen.queryByText('PROTO')).not.toBeInTheDocument()
    expect(screen.queryByText(/Nusantara Tech Gala 2026/i)).not.toBeInTheDocument()
  })

  it('keeps Operator and Audience production shells separated', () => {
    renderRoute('/dashboard')
    expect(document.querySelector('[data-operator-shell]')).toHaveAttribute('data-interface', 'operator')
    expect(screen.getByRole('navigation', { name: 'Operator navigation' })).toBeInTheDocument()

    cleanup()
    renderRoute('/display')
    expect(document.querySelector('[data-audience-shell]')).toHaveAttribute('data-interface', 'audience')
    expect(screen.queryByRole('navigation', { name: 'Operator navigation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  it('exposes only production destinations in the production sidebar', () => {
    renderRoute('/dashboard')
    const navigation = screen.getByRole('navigation', { name: 'Operator navigation' })
    expect(navigation).toHaveTextContent('Dashboard')
    expect(navigation).toHaveTextContent('Participants')
    expect(navigation).toHaveTextContent('Draw Setup')
    expect(navigation).toHaveTextContent('Live Draw')
    expect(navigation).toHaveTextContent('Pending Results')
    expect(navigation).toHaveTextContent('History')
    expect(navigation).toHaveTextContent('Settings')
    expect(navigation.textContent).toBe('DBDashboardPTParticipantsDSDraw SetupLDLive DrawPRPending ResultsHIHistorySTSettings')
    expect(navigation).not.toHaveTextContent('Events')
    expect(navigation).not.toHaveTextContent('Prize Categories')
    expect(navigation).not.toHaveTextContent('Audience Display')
    expect(navigation).not.toHaveTextContent('Live Draw Queue')
    expect(Array.from(navigation.querySelectorAll('a')).map((link) => link.getAttribute('href'))).not.toContain('/dev/prototypes')
  })

  it.each(['/draw/live', '/draw/pending', '/settings'])('keeps production route %s honest', async (path) => {
    renderRoute(path)
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument())
    if (path === '/settings') expect(screen.getAllByText(/not configured/i).length).toBeGreaterThan(0)
    else expect(screen.getByRole('heading', { name: path === '/draw/pending' ? 'Pending Results' : 'Live Draw' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('does not expose the prototype pending route as production navigation', () => {
    renderRoute('/draw/results')
    expect(screen.getByRole('heading', { name: 'Not Found' })).toBeInTheDocument()
  })

  it('keeps the current Event header control safe when no Event is active', async () => {
    const user = userEvent.setup()
    renderRoute('/dashboard')
    await waitFor(() => expect(screen.getByRole('button', { name: /Current Event/i })).toBeInTheDocument())
    const control = screen.getByRole('button', { name: /Current Event/i })
    expect(control).toHaveAttribute('aria-expanded', 'false')
    expect(control.querySelector('.operator-header__chevron')).toBeInTheDocument()
    await user.click(control)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(control).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'Switch / Manage Events' })).toHaveAttribute('href', '/events')
    expect(screen.getByRole('menuitem', { name: 'Manage Prize Categories' })).toHaveAttribute('href', '/prize-categories')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(control).toHaveFocus()
  })

  it('closes the Current Event menu on outside pointer interaction and reopens cleanly', async () => {
    const user = userEvent.setup()
    renderRoute('/dashboard')
    const control = await screen.findByRole('button', { name: /Current Event/i })
    await user.click(control)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.click(screen.getByRole('main'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await user.click(control)
    await user.click(screen.getByRole('menuitem', { name: 'Manage Prize Categories' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('links missing production Audience configuration to Settings', async () => {
    renderRoute('/dashboard')
    await waitFor(() => expect(screen.getByRole('link', { name: 'Audience: Setup required' })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Audience: Setup required' })).toHaveAttribute('href', '/settings')
    expect(screen.queryByText(/Production display scope is ready/i)).not.toBeInTheDocument()
  })

  it('keeps the deterministic prototype available only under its development namespace', () => {
    renderRoute('/dev/prototypes/dashboard')
    expect(screen.getByText('PROTO')).toBeVisible()
    expect(screen.getAllByText('Nusantara Tech Gala 2026').length).toBeGreaterThan(0)
  })

  it('keeps the prototype Audience Display namespace available', () => {
    renderRoute('/dev/prototypes/display')
    expect(screen.getByText('Draw will begin shortly')).toBeVisible()
  })

  it('keeps unknown routes recoverable through the production dashboard', async () => {
    const user = userEvent.setup()
    const router = renderRoute('/unknown-route')
    const recoveryLink = screen.getByRole('link', { name: 'Return to Dashboard' })
    expect(recoveryLink).toHaveAttribute('href', '/dashboard')
    await user.click(recoveryLink)
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })
})
