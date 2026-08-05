import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { appRoutes } from '../../app/router.tsx'
import {
  pendingResultsFixtures,
  redrawFixture,
} from '../../prototype/data/index.ts'

function renderResults(path = '/dev/prototypes/draw/results') {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path.startsWith('/dev/') ? path : `/dev/prototypes${path}`],
  })
  const view = render(<RouterProvider router={router} />)

  return { router, ...view }
}

describe('Pending Results static prototype', () => {
  it('renders the pending summary and exact leading-zero tickets', () => {
    renderResults()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Pending Results' }),
    ).toBeInTheDocument()
    const table = screen.getByRole('table', {
      name: 'Prototype winner records for pending scenario',
    })
    for (const ticket of [
      '000784',
      '004216',
      '010039',
      '018742',
      '021507',
      '035118',
    ]) {
      expect(within(table).getByText(ticket)).toBeVisible()
    }
    expect(within(table).getByText('Alya Pranoto')).toBeVisible()
    expect(
      within(table).getAllByText('Jakarta Chapter')[0],
    ).toBeVisible()
    expect(screen.getByText('Grand Prize Session 1')).toBeVisible()
    expect(screen.getByText('3,814')).toBeVisible()
    expect(screen.getAllByText('10').length).toBeGreaterThan(1)
  })

  it('renders partial and confirmed fixture states directly', () => {
    const { unmount } = renderResults('/draw/results?scenario=partial')
    const partialTable = screen.getByRole('table', {
      name: 'Prototype winner records for partial scenario',
    })
    for (const status of ['Pending', 'Confirmed', 'Cancelled', 'Replaced']) {
      expect(within(partialTable).getAllByText(status).length).toBeGreaterThan(0)
    }
    expect(screen.getByText(/Mixed statuses shown/i)).toBeVisible()
    unmount()

    renderResults('/draw/results?scenario=confirmed')
    expect(
      screen.getByRole('table', {
        name: 'Prototype winner records for confirmed scenario',
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThanOrEqual(10)
    expect(
      screen.getByRole('link', { name: 'Review static history' }),
    ).toHaveAttribute('href', '/dev/prototypes/history?view=session-detail')
  })

  it('reconciles every partial row status with the exact summary counts', () => {
    renderResults('/draw/results?scenario=partial')
    const fixture = pendingResultsFixtures.partial
    const counts = {
      pending: fixture.winners.filter((winner) => winner.status === 'pending')
        .length,
      confirmed: fixture.winners.filter(
        (winner) => winner.status === 'confirmed',
      ).length,
      cancelled: fixture.winners.filter(
        (winner) => winner.status === 'cancelled',
      ).length,
      replaced: fixture.winners.filter(
        (winner) => winner.status === 'replaced',
      ).length,
    }
    const summary = screen
      .getByRole('heading', { level: 2, name: 'Result summary' })
      .closest('.results-summary')

    expect(counts).toEqual({
      pending: 4,
      confirmed: 4,
      cancelled: 1,
      replaced: 1,
    })
    expect(fixture.summary).toMatchObject(counts)
    expect(fixture.summary.totalResultRecords).toBe(10)
    expect(fixture.winners).toHaveLength(10)
    if (!(summary instanceof HTMLElement)) {
      throw new Error('Result summary was not rendered.')
    }
    expect(
      within(summary).getByText('Total result records').parentElement,
    ).toHaveTextContent('10')
    for (const [label, value] of [
      ['Pending', '4'],
      ['Confirmed', '4'],
      ['Cancelled', '1'],
      ['Replaced', '1'],
    ] as const) {
      expect(
        within(summary).getByText(label).parentElement,
      ).toHaveTextContent(value)
    }
  })

  it('keeps visual row selection local and leaves frozen fixtures unchanged', async () => {
    const user = userEvent.setup()
    const fixture = pendingResultsFixtures.pending
    const originalFirstStatus = fixture.winners[0]?.status

    expect(Object.isFrozen(pendingResultsFixtures)).toBe(true)
    expect(Object.isFrozen(fixture)).toBe(true)
    expect(Object.isFrozen(fixture.winners)).toBe(true)
    expect(Object.isFrozen(fixture.winners[0])).toBe(true)

    renderResults()
    const ticketCheckbox = screen.getByRole('checkbox', {
      name: 'Select ticket 000784',
    })
    expect(ticketCheckbox).toBeChecked()
    await user.click(ticketCheckbox)
    expect(ticketCheckbox).not.toBeChecked()
    expect(fixture.winners[0]?.status).toBe(originalFirstStatus)
    expect(fixture.summary.pending).toBe(10)
  })

  it('states that confirmation changes no official data and routes to a fixture', async () => {
    const user = userEvent.setup()
    const { router } = renderResults()

    await user.click(
      screen.getByRole('button', { name: /Confirm selected \(2\)/i }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Confirm selected winners?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /No official result, eligibility, or history is changed, and no data is stored/i,
      ),
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: 'Show partial scenario' }),
    )
    await waitFor(() => {
      expect(router.state.location.search).toBe('?scenario=partial')
    })
  })

  it('uses expected deterministic result and redraw links', () => {
    renderResults()

    expect(
      screen.getByRole('link', { name: 'Open redraw' }),
    ).toHaveAttribute(
      'href',
      '/dev/prototypes/draw/results?scenario=pending&panel=redraw&selection=multiple',
    )
    expect(
      screen.getByRole('link', { name: 'Return to Live Draw' }),
    ).toHaveAttribute(
      'href',
      '/dev/prototypes/draw/live?state=running&mode=live&stage=rolling',
    )
  })
})

describe('Redraw presentation panel', () => {
  it('renders single and multiple selections with all approved reasons', () => {
    const { unmount } = renderResults(
      '/draw/results?panel=redraw&selection=single',
    )
    const singlePanel = screen.getByRole('dialog', {
      name: 'Redraw selected winner',
    })
    expect(singlePanel).toBeInTheDocument()
    expect(within(singlePanel).getByText('004216')).toBeVisible()

    const reasonSelect = screen.getByRole('combobox', {
      name: 'Redraw reason',
    })
    for (const reason of redrawFixture.reasons) {
      expect(within(reasonSelect).getByRole('option', { name: reason })).toBeInTheDocument()
    }
    unmount()

    renderResults('/draw/results?panel=redraw&selection=multiple')
    const multiplePanel = screen.getByRole('dialog', {
      name: 'Redraw 2 selected winners',
    })
    expect(multiplePanel).toBeInTheDocument()
    expect(within(multiplePanel).getByText('004216')).toBeVisible()
    expect(within(multiplePanel).getByText('018742')).toBeVisible()
  })

  it('renders the drawer surface after its full-viewport backdrop', () => {
    renderResults('/draw/results?panel=redraw&selection=single')

    const drawerRoot = document.querySelector(
      '[data-layer="drawer-root"]',
    )
    const backdrop = document.querySelector(
      '[data-layer="drawer-backdrop"]',
    )
    const surface = screen.getByRole('dialog', {
      name: 'Redraw selected winner',
    })

    expect(drawerRoot).toHaveAttribute('data-interface', 'operator')
    expect(drawerRoot?.children[0]).toBe(backdrop)
    expect(drawerRoot?.children[1]).toBe(surface)
    expect(surface).toHaveAttribute('data-layer', 'drawer-surface')
    expect(
      within(surface).getByRole('heading', {
        level: 2,
        name: 'Redraw selected winner',
      }),
    ).toBeInTheDocument()
  })

  it('closes PrototypeNavigator and makes the background inert when opened', async () => {
    const user = userEvent.setup()
    renderResults()
    const navigatorSummary = screen.getByText('Prototype navigation')
    const navigator = navigatorSummary.closest('details')

    await user.click(navigatorSummary)
    expect(navigator).toHaveAttribute('open')

    await user.click(screen.getByRole('link', { name: 'Open redraw' }))

    expect(navigator).not.toHaveAttribute('open')
    expect(document.querySelector('[data-operator-shell]')).toHaveAttribute(
      'inert',
    )
    expect(document.documentElement).toHaveAttribute(
      'data-side-panel-open',
    )
  })

  it('shows a required-note appearance for Other', async () => {
    const user = userEvent.setup()
    renderResults('/draw/results?panel=redraw&selection=single')

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Redraw reason' }),
      'Other',
    )
    const note = screen.getByRole('textbox', {
      name: 'Reason note (required)',
    })
    expect(note).toBeRequired()
    expect(note).toHaveAccessibleDescription(/Required appearance/i)
  })

  it('shows the fixed original-to-replacement relationship without selection logic', () => {
    renderResults('/draw/results?panel=replacement')

    const panel = screen.getByRole('dialog', {
      name: 'Replacement relationship preview',
    })
    expect(within(panel).getByText('004216')).toBeVisible()
    expect(within(panel).getByText('035118')).toBeVisible()
    expect(within(panel).getByText('Participant absent')).toBeVisible()
    expect(
      within(panel).getByText(/Original ticket 004216 is shown as cancelled/i),
    ).toBeVisible()
    expect(
      within(panel).getByText(/No selection logic or redraw has run/i),
    ).toBeVisible()
    expect(
      within(panel).getByRole('link', { name: 'Review in History' }),
    ).toHaveAttribute('href', '/dev/prototypes/history?view=session-detail')
  })

  it('does not mutate the redraw fixture during panel interactions', async () => {
    const fixtureBefore = JSON.stringify(redrawFixture)
    const user = userEvent.setup()
    renderResults('/draw/results?panel=redraw&selection=multiple')

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Redraw reason' }),
      'Other',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Reason note (required)' }),
      'Presentation-only note',
    )

    expect(JSON.stringify(redrawFixture)).toBe(fixtureBefore)
  })

  it('closes with Escape and returns focus to the redraw trigger', async () => {
    const user = userEvent.setup()
    renderResults()
    const trigger = screen.getByRole('link', { name: 'Open redraw' })

    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(document.querySelector('[data-operator-shell]')).not.toHaveAttribute(
      'inert',
    )
    expect(document.documentElement).not.toHaveAttribute(
      'data-side-panel-open',
    )

    const navigatorSummary = screen.getByText('Prototype navigation')
    await user.click(navigatorSummary)
    expect(navigatorSummary.closest('details')).toHaveAttribute('open')
  })
})
