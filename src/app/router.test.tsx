import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { appRoutes } from './router.tsx'

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  })

  const view = render(<RouterProvider router={router} />)

  return { router, ...view }
}

describe('application routes', () => {
  it('redirects / to /dashboard', async () => {
    const { router } = renderRoute('/')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard')
    })
  })

  it.each([
    ['/dashboard', 'Dashboard'],
    ['/participants', 'Participants'],
    ['/draw/setup', 'Draw Setup'],
    ['/draw/live', 'Live Draw'],
    ['/draw/results', 'Pending Results'],
    ['/history', 'History'],
    ['/settings', 'Settings'],
  ])('renders %s as the %s page', (path, title) => {
    renderRoute(path)

    expect(
      screen.getByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('This feature is not yet implemented.'),
    ).toBeInTheDocument()
  })

  it('renders the standalone Audience Display page at /display', () => {
    renderRoute('/display')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Audience Display' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('This feature is not yet implemented.'),
    ).toBeInTheDocument()
  })

  it('renders Not Found for an unknown route', () => {
    renderRoute('/unknown-route')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Not Found' }),
    ).toBeInTheDocument()
  })

  it('does not render Operator navigation or controls on /display', () => {
    renderRoute('/display')

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
