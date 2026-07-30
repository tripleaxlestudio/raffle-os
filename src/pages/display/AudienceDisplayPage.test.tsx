import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { appRoutes } from '../../app/router.tsx'
import {
  audienceFixtures,
  audienceTicketNumbers,
  pendingResultsFixtures,
} from '../../prototype/data/index.ts'

function renderDisplay(path = '/display') {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  })
  const view = render(<RouterProvider router={router} />)

  return { router, ...view }
}

const directlyAccessibleStates = [
  ['/display', 'standby'],
  ['/display?state=standby', 'standby'],
  ['/display?state=countdown', 'countdown'],
  ['/display?state=rolling', 'rolling'],
  ['/display?state=reveal&count=1', 'winner-reveal'],
  ['/display?state=confirmed&count=1', 'confirmed'],
  ['/display?state=blackout', 'blackout'],
  ['/display?state=disconnected', 'disconnected'],
] as const

const winnerLayouts = [
  [1, 'hero', '1', '1'],
  [6, '3x2', '3', '2'],
  [10, '5x2', '5', '2'],
  [20, '5x4', '5', '4'],
] as const

describe('Audience Display static states', () => {
  it.each(directlyAccessibleStates)(
    'renders %s as the %s public state',
    (path, state) => {
      const { container } = renderDisplay(path)

      expect(
        container.querySelector(`[data-audience-state="${state}"]`),
      ).toBeInTheDocument()
      expect(container.querySelector('[data-operator-shell]')).toBeNull()
    },
  )

  it('falls back invalid state and count values safely', () => {
    const { container, unmount } = renderDisplay(
      '/display?state=unknown&count=100',
    )

    expect(
      container.querySelector('[data-audience-state="standby"]'),
    ).toBeInTheDocument()
    unmount()

    const fallback = renderDisplay('/display?state=reveal&count=7')
    const grid = fallback.container.querySelector('[data-winner-count]')
    expect(grid).toHaveAttribute('data-winner-count', '1')
    expect(grid?.querySelectorAll('[data-ticket-tile]')).toHaveLength(1)
  })

  it('renders standby event identity, prize context, and waiting message', () => {
    renderDisplay('/display?state=standby')

    expect(
      screen.getByText('Nusantara Tech Gala 2026'),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Celebrating ideas that move Indonesia forward',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Draw will begin shortly',
      }),
    ).toBeVisible()
    expect(screen.getByText('Grand Prize')).toBeVisible()
    expect(screen.getByText('Electric Scooter')).toBeVisible()
    expect(screen.queryByText('000123')).not.toBeInTheDocument()
  })

  it('renders a static accessible countdown numeral', () => {
    const { container } = renderDisplay('/display?state=countdown')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Get ready' }),
    ).toBeVisible()
    expect(screen.getByLabelText('Static countdown value: 3')).toHaveTextContent(
      '3',
    )
    expect(
      container.querySelector('[data-prototype-static="true"]'),
    ).toBeInTheDocument()
  })

  it('renders a stable deterministic rolling arrangement with leading zeroes', () => {
    renderDisplay('/display?state=rolling')

    const stream = screen.getByRole('list', {
      name: 'Presentational ticket stream',
    })
    expect(stream).toHaveAttribute('data-prototype-static', 'true')
    expect(within(stream).getByText('000123')).toBeVisible()
    expect(within(stream).getByText('000784')).toBeVisible()
    expect(within(stream).getByText('004216')).toBeVisible()
    expect(within(stream).getAllByRole('listitem')).toHaveLength(8)
  })

  it('keeps all fixture values frozen and deterministic', () => {
    expect(Object.isFrozen(audienceFixtures)).toBe(true)
    expect(Object.isFrozen(audienceFixtures.reveal)).toBe(true)
    expect(Object.isFrozen(audienceFixtures.confirmed)).toBe(true)
    expect(Object.isFrozen(audienceTicketNumbers)).toBe(true)
    expect(audienceTicketNumbers[0]).toBe('000123')
    expect(audienceTicketNumbers[19]).toBe('174195')

    for (const count of [1, 6, 10, 20] as const) {
      expect(Object.isFrozen(audienceFixtures.reveal[count])).toBe(true)
      expect(
        Object.isFrozen(audienceFixtures.reveal[count].ticketNumbers),
      ).toBe(true)
      expect(
        Object.isFrozen(audienceFixtures.confirmed[count]),
      ).toBe(true)
    }
  })
})

describe('Audience winner grids', () => {
  it.each(winnerLayouts)(
    'renders reveal count %i as the exact %s layout',
    (count, layout, columns, rows) => {
      const { container } = renderDisplay(
        `/display?state=reveal&count=${count}`,
      )
      const grid = container.querySelector('[data-winner-count]')

      expect(grid).toHaveAttribute('data-grid-layout', layout)
      expect(grid).toHaveAttribute('data-columns', columns)
      expect(grid).toHaveAttribute('data-rows', rows)
      expect(grid).toHaveAttribute('data-winner-count', String(count))
      expect(grid?.querySelectorAll('[data-ticket-tile]')).toHaveLength(
        count,
      )
      expect(
        screen.getByRole('status'),
      ).toHaveTextContent('Results under verification')
      expect(screen.queryByText('Confirmed')).not.toBeInTheDocument()
    },
  )

  it.each(winnerLayouts)(
    'renders confirmed count %i with the same exact %s layout',
    (count, layout, columns, rows) => {
      const { container } = renderDisplay(
        `/display?state=confirmed&count=${count}`,
      )
      const grid = container.querySelector('[data-winner-count]')

      expect(grid).toHaveAttribute('data-grid-layout', layout)
      expect(grid).toHaveAttribute('data-columns', columns)
      expect(grid).toHaveAttribute('data-rows', rows)
      expect(grid?.querySelectorAll('[data-ticket-tile]')).toHaveLength(
        count,
      )
      expect(screen.getByRole('status')).toHaveTextContent('Confirmed')
      for (const tile of grid?.querySelectorAll('[data-ticket-tile]') ?? []) {
        expect(tile).toHaveAttribute('data-confirmed', 'true')
      }
    },
  )

  it('preserves exact leading-zero strings throughout winner layouts', () => {
    renderDisplay('/display?state=reveal&count=20')

    const grid = screen.getByRole('list', { name: '20 ticket results' })
    for (const ticketNumber of audienceTicketNumbers) {
      expect(typeof ticketNumber).toBe('string')
      expect(within(grid).getByText(ticketNumber)).toBeVisible()
    }
  })
})

describe('Audience safety and privacy', () => {
  it('renders blackout as an empty, non-interactive public surface', () => {
    const { container } = renderDisplay('/display?state=blackout')
    const blackout = container.querySelector(
      '[data-audience-state="blackout"]',
    )

    expect(blackout).toBeInTheDocument()
    expect(blackout).toBeEmptyDOMElement()
    expect(blackout).toHaveTextContent('')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Nusantara Tech Gala 2026'),
    ).not.toBeInTheDocument()
  })

  it('renders disconnected-safe copy without stale ticket results', () => {
    renderDisplay('/display?state=disconnected')

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Display connection interrupted',
      }),
    ).toBeVisible()
    expect(screen.getByText('Please wait for the operator.')).toBeVisible()
    expect(screen.queryByText('000123')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Results under verification'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Confirmed')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('never renders Operator participant names or internal controls', () => {
    const { container } = renderDisplay(
      '/display?state=confirmed&count=20',
    )
    const operatorNames = pendingResultsFixtures.pending.winners.map(
      (winner) => winner.participantName,
    )

    for (const participantName of operatorNames) {
      expect(screen.queryByText(participantName)).not.toBeInTheDocument()
    }
    for (const internalText of [
      'Jakarta Chapter',
      'Checked in',
      'Participant absent',
      'Practice Mode',
      'Audience Display: Connected',
    ]) {
      expect(screen.queryByText(internalText)).not.toBeInTheDocument()
    }

    expect(container.querySelector('.operator-sidebar')).toBeNull()
    expect(container.querySelector('.operator-header')).toBeNull()
    expect(
      screen.queryByRole('navigation', {
        name: 'Prototype navigation scenarios',
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: 'Prototype scenario' }),
    ).not.toBeInTheDocument()
  })
})
