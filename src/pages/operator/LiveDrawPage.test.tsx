import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { appRoutes } from '../../app/router.tsx'

function renderLiveDraw(path = '/dev/prototypes/draw/live') {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  })
  const view = render(<RouterProvider router={router} />)

  return { router, ...view }
}

describe('Live Draw static prototype', () => {
  it('renders the ready configuration recap and system readiness', () => {
    renderLiveDraw('/dev/prototypes/draw/live?state=ready&mode=practice')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Live Draw' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Grand Prize control deck')).toBeVisible()
    expect(screen.getAllByText('Electric Scooter').length).toBeGreaterThan(0)
    expect(screen.getByText('System readiness')).toBeVisible()
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Warning').length).toBeGreaterThan(0)
    expect(
      screen.getByText(/Practice results would be rehearsal-only/i),
    ).toBeVisible()
    expect(
      screen.getByText(/No hold duration is measured/i),
    ).toBeVisible()
  })

  it('renders a stronger textual warning for Live mode', () => {
    renderLiveDraw('/dev/prototypes/draw/live?state=ready&mode=live')

    expect(
      screen.getByText(
        'This represents a live-event start flow',
      ),
    ).toBeVisible()
    expect(screen.getAllByText('Live Mode').length).toBeGreaterThan(0)
    expect(
      screen.getByText(/does not start an actual draw/i),
    ).toBeVisible()
  })

  it('opens confirmation and returns focus when cancelled', async () => {
    const user = userEvent.setup()
    renderLiveDraw('/dev/prototypes/draw/live?state=ready&mode=practice')
    const trigger = screen.getByRole('button', {
      name: 'Hold to start draw',
    })

    await user.click(trigger)
    expect(
      screen.getByRole('dialog', {
        name: 'Advance Practice Mode prototype?',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(
      screen.getByText(/No random selection will occur/i),
    ).toBeVisible()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('routes confirmation to the deterministic countdown state', async () => {
    const user = userEvent.setup()
    const { router } = renderLiveDraw(
      '/dev/prototypes/draw/live?state=ready&mode=live',
    )

    await user.click(
      screen.getByRole('button', { name: 'Hold to start draw' }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Show countdown prototype',
      }),
    )

    await waitFor(() => {
      expect(router.state.location.search).toBe(
        '?state=running&mode=live&stage=countdown',
      )
    })
    expect(
      screen.getByLabelText('Static countdown value 3'),
    ).toHaveTextContent('3')
  })

  it('renders a static countdown with deterministic navigation', () => {
    renderLiveDraw(
      '/dev/prototypes/draw/live?state=running&mode=practice&stage=countdown',
    )

    expect(
      screen.getByLabelText('Static countdown value 3'),
    ).toHaveTextContent('3')
    expect(screen.getByText(/No timer is running/i)).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Show rolling state' }),
    ).toHaveAttribute(
      'href',
      '/dev/prototypes/draw/live?state=running&mode=practice&stage=rolling',
    )
    expect(
      screen.getByText(/Configuration appears locked/i),
    ).toBeVisible()
  })

  it('renders exact leading-zero tickets without declaring a winner', () => {
    renderLiveDraw(
      '/dev/prototypes/draw/live?state=running&mode=live&stage=rolling',
    )

    const ticketStream = screen.getByLabelText('Static ticket stream')
    for (const ticket of [
      '000123',
      '004216',
      '010039',
      '018742',
      '021507',
    ]) {
      expect(within(ticketStream).getByText(ticket)).toBeVisible()
    }
    expect(
      screen.getByText(/do not imply eligibility, selection, or randomness/i),
    ).toBeVisible()
    expect(screen.getByText(/No winner has been selected/i)).toBeVisible()
    expect(screen.queryByText('Alya Pranoto')).not.toBeInTheDocument()
    expect(screen.queryByText('Bima Raharja')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Review Pending Results' }),
    ).toHaveAttribute('href', '/dev/prototypes/draw/results')
  })
})
