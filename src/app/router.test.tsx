import { render, screen, waitFor, within } from '@testing-library/react'
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

const operatorPages = [
  ['/dashboard', 'Dashboard'],
  ['/participants', 'Participants'],
  ['/draw/setup', 'Draw Setup'],
  ['/draw/live', 'Live Draw'],
  ['/draw/results', 'Pending Results'],
  ['/history', 'History'],
  ['/settings', 'Settings'],
] as const

const operatorNavigationLabels = operatorPages.map(([, label]) => label)

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

  it('renders Dashboard inside the Operator shell', () => {
    renderRoute('/dashboard')

    expect(
      within(screen.getByRole('main')).getByRole('heading', {
        level: 1,
        name: 'Dashboard',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Operator navigation' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Raffle OS')).toBeInTheDocument()
    expect(screen.getByText('Event not selected')).toBeInTheDocument()
    expect(screen.getByText('Practice Mode')).toBeInTheDocument()
    expect(
      screen.getByRole('status', {
        name: 'Audience Display: Disconnected',
      }),
    ).toBeInTheDocument()
  })

  it.each(operatorPages)('renders %s as the %s page', (path, title) => {
    renderRoute(path)

    expect(
      screen.getByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('This feature is not yet implemented.'),
    ).toBeInTheDocument()

    const navigation = screen.getByRole('navigation', {
      name: 'Operator navigation',
    })
    for (const navigationLabel of operatorNavigationLabels) {
      expect(
        within(navigation).getByRole('link', { name: navigationLabel }),
      ).toBeInTheDocument()
    }
  })

  it.each([
    ['/dashboard', 'Dashboard'],
    ['/draw/results', 'Pending Results'],
    ['/settings', 'Settings'],
  ])('marks the navigation link for %s as active', (path, label) => {
    renderRoute(path)

    const activeLink = screen.getByRole('link', { name: label })
    expect(activeLink).toHaveAttribute('aria-current', 'page')
    expect(activeLink).toHaveClass('operator-nav__link--active')
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
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByText('Raffle OS')).not.toBeInTheDocument()
    expect(screen.queryByText('Practice Mode')).not.toBeInTheDocument()
    expect(screen.queryByText(/Audience Display:/)).not.toBeInTheDocument()
    expect(screen.queryByText('Participants')).not.toBeInTheDocument()
  })
})
