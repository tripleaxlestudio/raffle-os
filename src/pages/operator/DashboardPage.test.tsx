import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { appRoutes } from '../../app/router.tsx'

function renderDashboard(path = '/dashboard') {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  })

  const view = render(<RouterProvider router={router} />)

  return { router, ...view }
}

describe('Dashboard static prototype', () => {
  it('renders the deterministic ready scenario by default', () => {
    const { container } = renderDashboard()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Nusantara Tech Gala 2026',
      }),
    ).toBeInTheDocument()
    expect(container.querySelector('.dashboard')).toHaveAttribute(
      'data-prototype-scenario',
      'ready',
    )
    expect(
      screen.getByText('All critical systems are ready'),
    ).toBeInTheDocument()
    expect(screen.getByText('4 of 4 ready')).toBeInTheDocument()
  })

  it('renders the deterministic attention scenario from the URL', () => {
    const { container } = renderDashboard(
      '/dashboard?scenario=attention',
    )

    expect(container.querySelector('.dashboard')).toHaveAttribute(
      'data-prototype-scenario',
      'attention',
    )
    expect(screen.getByText('2 items open')).toBeInTheDocument()
    expect(screen.getByText('Live Mode')).toBeInTheDocument()
    expect(
      screen.getByRole('status', {
        name: 'Audience Display: Disconnected',
      }),
    ).toBeInTheDocument()
  })

  it('falls back safely for an unsupported scenario', () => {
    const { container } = renderDashboard(
      '/dashboard?scenario=unsupported',
    )

    expect(container.querySelector('.dashboard')).toHaveAttribute(
      'data-prototype-scenario',
      'ready',
    )
    expect(
      screen.getByRole('combobox', { name: 'Prototype scenario' }),
    ).toHaveValue('ready')
  })

  it('preserves leading zeroes in prototype ticket identifiers', () => {
    renderDashboard()

    const activity = screen.getByRole('heading', {
      level: 2,
      name: 'Recent prototype activity',
    }).closest('section')

    expect(activity).not.toBeNull()
    expect(within(activity as HTMLElement).getByText('000784')).toBeVisible()
    expect(within(activity as HTMLElement).getByText('004216')).toBeVisible()
    expect(within(activity as HTMLElement).getByText('001039')).toBeVisible()
  })

  it('exposes one clear primary Dashboard action', () => {
    renderDashboard()

    const primaryAction = screen.getByRole('link', {
      name: 'Set up next draw',
    })
    expect(primaryAction).toHaveAttribute('href', '/draw/setup')
    expect(primaryAction).toHaveClass('ui-button--primary')
  })

  it('changes only the URL-selected prototype scenario', async () => {
    const user = userEvent.setup()
    const { router } = renderDashboard()

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Prototype scenario' }),
      'attention',
    )

    expect(router.state.location.pathname).toBe('/dashboard')
    expect(router.state.location.search).toBe('?scenario=attention')
    expect(
      await screen.findByText('Resolve two readiness checks before going Live'),
    ).toBeInTheDocument()
  })
})
