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
    expect(navigation).toHaveTextContent('History')
    expect(navigation).toHaveTextContent('Audience Display')
    expect(navigation).not.toHaveTextContent('Live Draw')
    expect(navigation).not.toHaveTextContent('Pending Results')
    expect(navigation).not.toHaveTextContent('Settings')
  })

  it.each(['/draw/live', '/draw/results', '/settings'])('keeps incomplete production route %s honest', async (path) => {
    renderRoute(path)
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument())
    expect(screen.getAllByText(/not available yet|not configured/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
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
