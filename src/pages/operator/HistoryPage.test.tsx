import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { appRoutes } from '../../app/router.tsx'
import { historyFixture } from '../../prototype/data/index.ts'

function renderHistory(path = '/history') {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  })
  const view = render(<RouterProvider router={router} />)

  return { router, ...view }
}

describe('History static prototype', () => {
  it('renders Draw Sessions by default and for invalid views', () => {
    const { unmount } = renderHistory()
    expect(
      screen.getByRole('table', { name: 'Prototype draw sessions' }),
    ).toBeInTheDocument()
    expect(screen.getByText('29 Jul 2026, 21:18:42 WIB')).toBeVisible()
    expect(
      screen.getAllByRole('link', { name: 'Open detail' })[0],
    ).toHaveAttribute('href', '/history?view=session-detail')
    unmount()

    const { container } = renderHistory('/history?view=unknown')
    expect(container.querySelector('.history-page')).toHaveAttribute(
      'data-history-view',
      'sessions',
    )
  })

  it('renders all winners and the replacement linkage directly', () => {
    renderHistory('/history?view=winners')

    const table = screen.getByRole('table', {
      name: 'Prototype winner history',
    })
    expect(within(table).getByText('000784')).toBeVisible()
    expect(within(table).getAllByText('004216').length).toBeGreaterThan(0)
    expect(within(table).getAllByText('035118').length).toBeGreaterThan(0)
    expect(within(table).getByText('cancelled → replaced by')).toBeVisible()
    expect(within(table).getByText('original → replacement')).toBeVisible()
  })

  it('renders deterministic chronological audit entries', () => {
    renderHistory('/history?view=audit')

    for (const entry of historyFixture.auditEntries) {
      expect(screen.getByText(entry.action)).toBeVisible()
      expect(screen.getByText(entry.timestamp)).toBeVisible()
    }
    expect(screen.getByText('Winner cancelled')).toBeVisible()
    expect(screen.getByText('Replacement previewed')).toBeVisible()
  })

  it('renders session detail, snapshot, cancelled record, and disabled exports', () => {
    renderHistory('/history?view=session-detail')

    expect(screen.getByText('DRAW-GP-001')).toBeVisible()
    expect(screen.getByText('3,814')).toBeVisible()
    expect(screen.getByText('Cancellation & replacement')).toBeVisible()
    expect(screen.getAllByText('004216').length).toBeGreaterThan(0)
    expect(screen.getAllByText('035118').length).toBeGreaterThan(0)
    expect(screen.getByText('Participant absent')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Export CSV · Prototype only' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Export XLSX · Prototype only' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('link', {
        name: 'Review presentation settings',
      }),
    ).toHaveAttribute('href', '/settings?section=branding')
  })

  it('exposes selected tab state for direct views', () => {
    renderHistory('/history?view=audit')

    expect(screen.getByRole('tab', { name: 'Audit Log' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      screen.getByRole('tab', { name: 'Draw Sessions' }),
    ).toHaveAttribute('aria-selected', 'false')
  })
})
