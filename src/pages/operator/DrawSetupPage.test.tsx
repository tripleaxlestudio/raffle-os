import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { appRoutes } from '../../app/router.tsx'
import { drawSetupFixtures } from '../../prototype/data/index.ts'

function renderDrawSetup(path = '/draw/setup') {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  })
  const view = render(<RouterProvider router={router} />)

  return { router, ...view }
}

describe('Draw Setup static prototype', () => {
  it('renders the deterministic category, prize, presets, and rules', () => {
    renderDrawSetup()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Draw Setup' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Category' }),
    ).toHaveValue('Grand Prize')
    expect(screen.getByRole('textbox', { name: 'Prize name' })).toHaveValue(
      'Electric Scooter',
    )

    const presets = screen.getByRole('group', {
      name: 'Winner count presets',
    })
    for (const preset of ['1', '3', '6', '10', '20', '50']) {
      expect(
        within(presets).getByRole('button', { name: preset }),
      ).toBeInTheDocument()
    }
    expect(
      within(presets).getByRole('button', { name: '1' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('checkbox', {
        name: 'Checked-in participants only',
      }),
    ).toBeChecked()
    expect(
      screen.getByRole('checkbox', {
        name: 'Exclude previous winners',
      }),
    ).toBeChecked()
    expect(
      screen.getByRole('group', { name: 'Winning frequency' }),
    ).toBeInTheDocument()
  })

  it('renders the eligible pool summary and permits ready review', () => {
    renderDrawSetup('/draw/setup?mode=practice&scenario=ready')

    const pool = screen.getByLabelText('Eligible pool summary')
    expect(within(pool).getByText('4,820')).toBeVisible()
    expect(within(pool).getByText('3,946')).toBeVisible()
    expect(within(pool).getByText('3,814')).toBeVisible()
    expect(
      screen.getByText(/Sufficient static capacity/i),
    ).toBeVisible()

    expect(
      screen.getByRole('link', { name: 'Review draw' }),
    ).toHaveAttribute(
      'href',
      '/draw/live?state=ready&mode=practice',
    )
  })

  it('distinguishes Practice and Live modes with text and correct links', () => {
    const { unmount } = renderDrawSetup(
      '/draw/setup?mode=practice&scenario=ready',
    )
    expect(screen.getAllByText(/Practice rehearsal context/i).length).toBeGreaterThan(0)
    unmount()

    renderDrawSetup('/draw/setup?mode=live&scenario=ready')
    expect(
      screen.getAllByText(/Live-event review context/i).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('link', { name: 'Review draw' }),
    ).toHaveAttribute('href', '/draw/live?state=ready&mode=live')
  })

  it('blocks the insufficient scenario with an explicit warning', () => {
    renderDrawSetup(
      '/draw/setup?mode=practice&scenario=insufficient',
    )

    expect(
      screen.getAllByText(
        'Requested winners exceed the eligible participant pool.',
      ).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: 'Resolve pool shortage' }),
    ).toBeDisabled()
    expect(
      screen.queryByRole('link', { name: 'Review draw' }),
    ).not.toBeInTheDocument()
  })

  it('changes only local visual controls without mutating fixtures', async () => {
    const user = userEvent.setup()
    const fixtureWinnerCount =
      drawSetupFixtures.ready.configuration.winnerCount

    expect(Object.isFrozen(drawSetupFixtures)).toBe(true)
    expect(Object.isFrozen(drawSetupFixtures.ready)).toBe(true)
    expect(
      Object.isFrozen(drawSetupFixtures.ready.configuration),
    ).toBe(true)

    renderDrawSetup('/draw/setup?mode=practice&scenario=ready')
    await user.click(
      within(
        screen.getByRole('group', { name: 'Winner count presets' }),
      ).getByRole('button', { name: '6' }),
    )

    expect(
      screen.getByRole('spinbutton', { name: 'Custom winner count' }),
    ).toHaveValue(6)
    expect(drawSetupFixtures.ready.configuration.winnerCount).toBe(
      fixtureWinnerCount,
    )
  })
})
