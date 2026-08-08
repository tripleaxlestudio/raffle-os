import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { OfficialHistorySession } from '../../application/history/history-read-model.ts'
import { HistoryDetail, HistorySessionCard } from './ProductionHistoryPage.tsx'

const makeItem = (index: number): OfficialHistorySession => ({
  relation: 'valid',
  event: { id: `event-${index}`, name: 'Uji Coba Event', status: 'live', createdAt: '2026-08-08T00:00:00.000Z', updatedAt: '2026-08-08T00:00:00.000Z' },
  category: { id: `category-${index}`, eventId: `event-${index}`, name: 'Door Prize', prizeName: index === 9 ? 'A very long prize name that should wrap without clipping' : `Sepeda ${index + 1}`, displayOrder: index, createdAt: '2026-08-08T00:00:00.000Z' },
  session: { id: `session-${index}`, eventId: `event-${index}`, configurationId: `configuration-${index}`, mode: 'live', status: 'completed', configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: '2026-08-08T00:27:00.000Z', updatedAt: '2026-08-08T06:39:00.000Z', completedAt: '2026-08-08T06:39:00.000Z' },
  records: [],
} as unknown as OfficialHistorySession)

describe('compact Production History records', () => {
  it.each([1, 5, 10])('renders %i records as a consistent compact list', (count) => {
    const { container } = render(<MemoryRouter>{Array.from({ length: count }, (_, index) => <HistorySessionCard item={makeItem(index)} key={index} />)}</MemoryRouter>)
    const cards = [...container.querySelectorAll('.history-session-card')]
    expect(cards).toHaveLength(count)
    expect(cards.every((card) => card.querySelector('.history-session-card__bottom') !== null)).toBe(true)
    expect(screen.getAllByRole('link', { name: 'View official details' })).toHaveLength(count)
    expect(within(cards.at(-1)! as HTMLElement).getByText(count === 10 ? /very long prize name/ : /Sepeda/)).toBeVisible()
  })

  it('uses the card action as the truthful expand/collapse control', () => {
    const item = makeItem(0)
    const collapsed = render(<MemoryRouter><HistorySessionCard item={item} /></MemoryRouter>)
    const collapsedAction = screen.getByRole('link', { name: 'View official details' })
    expect(collapsedAction).toHaveAttribute('aria-expanded', 'false')
    expect(collapsedAction).toHaveAttribute('aria-controls', 'history-details-session-0')
    collapsed.unmount()

    render(<MemoryRouter><HistorySessionCard expanded item={item} /><HistoryDetail item={item} /></MemoryRouter>)
    const expandedAction = screen.getByRole('link', { name: 'Hide official details' })
    expect(expandedAction).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('table', { name: 'Official WinnerRecords' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Close details' })).not.toBeInTheDocument()
    const detail = document.getElementById('history-details-session-0')!
    expect(within(detail).queryByText('Uji Coba Event')).not.toBeInTheDocument()
    expect(within(detail).queryByText('Prize category unavailable')).not.toBeInTheDocument()
  })
})
