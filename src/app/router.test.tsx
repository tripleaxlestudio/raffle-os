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

const operatorPageHeadings = [
  ['/dashboard', 'Nusantara Tech Gala 2026'],
  ['/participants', 'Participant Import'],
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

  it.each(operatorPageHeadings)(
    'renders %s as the %s Operator page',
    (path, title) => {
    const { container } = renderRoute(path)

    expect(
      screen.getByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument()
    expect(container.querySelector('[data-operator-shell]')).toHaveAttribute(
      'data-interface',
      'operator',
    )
    expect(container.querySelector('.operator-header')).toBeInTheDocument()

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

  it('renders the standby Audience Display prototype at /display', () => {
    renderRoute('/display')

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Draw will begin shortly',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Nusantara Tech Gala 2026'),
    ).toBeInTheDocument()
    expect(screen.queryByText('000123')).not.toBeInTheDocument()
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

  it('exposes prototype direct links only in Operator navigation', () => {
    renderRoute('/draw/setup')

    const prototypeNavigation = screen.getByRole('navigation', {
      name: 'Prototype navigation scenarios',
    })
    const expectedLinks = [
      ['Draw Setup — Practice Ready', '/draw/setup?mode=practice&scenario=ready'],
      ['Draw Setup — Live Ready', '/draw/setup?mode=live&scenario=ready'],
      [
        'Draw Setup — Insufficient Pool',
        '/draw/setup?mode=practice&scenario=insufficient',
      ],
      [
        'Live Draw — Practice Ready',
        '/draw/live?state=ready&mode=practice',
      ],
      ['Live Draw — Live Ready', '/draw/live?state=ready&mode=live'],
      [
        'Live Draw — Countdown',
        '/draw/live?state=running&mode=practice&stage=countdown',
      ],
      [
        'Live Draw — Rolling',
        '/draw/live?state=running&mode=practice&stage=rolling',
      ],
    ] as const

    for (const [label, href] of expectedLinks) {
      expect(
        within(prototypeNavigation).getByRole('link', { name: label }),
      ).toHaveAttribute('href', href)
    }

    const sliceFourLinks = [
      ['Pending Results - Pending', '/draw/results?scenario=pending'],
      [
        'Pending Results - Partial confirmation',
        '/draw/results?scenario=partial',
      ],
      ['Pending Results - Confirmed', '/draw/results?scenario=confirmed'],
      [
        'Redraw - Single winner',
        '/draw/results?panel=redraw&selection=single',
      ],
      [
        'Redraw - Multiple winners',
        '/draw/results?panel=redraw&selection=multiple',
      ],
      [
        'Redraw - Replacement preview',
        '/draw/results?panel=replacement',
      ],
      ['History - Draw Sessions', '/history?view=sessions'],
      ['History - All Winners', '/history?view=winners'],
      ['History - Audit Log', '/history?view=audit'],
      ['History - Session detail', '/history?view=session-detail'],
      ['Settings - Branding', '/settings?section=branding'],
      ['Settings - Presentation', '/settings?section=presentation'],
      ['Settings - Audio', '/settings?section=audio'],
      ['Settings - Display', '/settings?section=display'],
    ] as const

    for (const [label, href] of sliceFourLinks) {
      expect(
        within(prototypeNavigation).getByRole('link', { name: label }),
      ).toHaveAttribute('href', href)
    }

    const audienceLinks = [
      ['Audience Standby', '/display?state=standby'],
      ['Audience Countdown', '/display?state=countdown'],
      ['Audience Rolling', '/display?state=rolling'],
      ['Reveal 1', '/display?state=reveal&count=1'],
      ['Reveal 6', '/display?state=reveal&count=6'],
      ['Reveal 10', '/display?state=reveal&count=10'],
      ['Reveal 20', '/display?state=reveal&count=20'],
      ['Confirmed 1', '/display?state=confirmed&count=1'],
      ['Confirmed 6', '/display?state=confirmed&count=6'],
      ['Confirmed 10', '/display?state=confirmed&count=10'],
      ['Confirmed 20', '/display?state=confirmed&count=20'],
      ['Blackout', '/display?state=blackout'],
      ['Disconnected', '/display?state=disconnected'],
    ] as const

    for (const [label, href] of audienceLinks) {
      expect(
        within(prototypeNavigation).getByRole('link', { name: label }),
      ).toHaveAttribute('href', href)
    }
    expect(screen.getByText('Phase 2 Prototype')).toBeVisible()
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
