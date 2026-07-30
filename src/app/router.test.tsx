import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const placeholderOperatorPages = operatorPages.filter(
  ([path]) => path !== '/dashboard' && path !== '/participants',
)

const operatorNavigationLabels = operatorPages.map(([, label]) => label)

describe('application routes', () => {
  it('redirects / to /dashboard', async () => {
    const { router } = renderRoute('/')

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Nusantara Tech Gala 2026',
      }),
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
        name: 'Nusantara Tech Gala 2026',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Operator navigation' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Raffle OS')).toBeInTheDocument()
    expect(
      screen.getAllByText('Nusantara Tech Gala 2026'),
    ).toHaveLength(2)
    expect(screen.getByText('Practice Mode')).toBeInTheDocument()
    expect(
      screen.getByRole('status', {
        name: 'Audience Display: Connected',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Prototype scenario' }),
    ).toHaveValue('ready')
  })

  it.each(placeholderOperatorPages)(
    'renders %s as the %s placeholder page',
    (path, title) => {
    const { container } = renderRoute(path)

    expect(
      screen.getByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('This feature is not yet implemented.'),
    ).toBeInTheDocument()
    expect(container.querySelector('[data-operator-shell]')).toHaveAttribute(
      'data-interface',
      'operator',
    )
    expect(screen.getByRole('banner')).toBeInTheDocument()

    const navigation = screen.getByRole('navigation', {
      name: 'Operator navigation',
    })
    for (const navigationLabel of operatorNavigationLabels) {
      expect(
        within(navigation).getByRole('link', { name: navigationLabel }),
      ).toBeInTheDocument()
    }
    },
  )

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

  it('renders the standalone Audience Display shell at /display', () => {
    const { container } = renderRoute('/display')

    const audienceShell = container.querySelector('[data-audience-shell]')
    expect(audienceShell).toHaveAttribute('data-interface', 'audience')
    expect(container.querySelector('[data-operator-shell]')).toBeNull()
    expect(
      screen.getByRole('main', { name: 'Audience presentation' }),
    ).toBeInTheDocument()
  })

  it('renders the inert Audience Display placeholder at /display', () => {
    renderRoute('/display')

    expect(screen.getByText('Raffle OS')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Audience Display' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'This route is intended for LED screens, projectors, or vMix capture.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Display states and raffle presentation are not yet implemented.',
      ),
    ).toBeInTheDocument()
  })

  it('renders Not Found for an unknown route', () => {
    const { container } = renderRoute('/unknown-route')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Not Found' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('The requested page does not exist.'),
    ).toBeInTheDocument()
    expect(container.querySelector('[data-operator-shell]')).toBeNull()
    expect(
      screen.queryByRole('navigation', { name: 'Operator navigation' }),
    ).not.toBeInTheDocument()
  })

  it('provides working navigation from Not Found to /dashboard', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/unknown-route')

    const recoveryLink = screen.getByRole('link', {
      name: 'Return to Dashboard',
    })
    expect(recoveryLink).toHaveAttribute('href', '/dashboard')

    await user.click(recoveryLink)

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Nusantara Tech Gala 2026',
      }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  it('does not render the Operator shell or status on /display', () => {
    renderRoute('/display')

    expect(
      screen.queryByRole('navigation', { name: 'Operator navigation' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByText('Practice Mode')).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        /^Audience Display: (Disconnected|Connecting|Connected)$/,
      ),
    ).not.toBeInTheDocument()
  })

  it('does not expose links to Operator routes on /display', () => {
    renderRoute('/display')

    for (const navigationLabel of operatorNavigationLabels) {
      expect(
        screen.queryByRole('link', { name: navigationLabel }),
      ).not.toBeInTheDocument()
    }
  })
})
