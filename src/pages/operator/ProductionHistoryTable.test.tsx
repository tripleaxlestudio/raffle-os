import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { HistoryReconstruction, ReconstructedHistorySession } from '../../application/history/history-read-model.ts'
import { HistoryTable } from './ProductionHistoryPage.tsx'

const makeItem = (index: number): HistoryReconstruction => ({ kind: 'complete', value: ({
  audits: [], category: { id: `category-${index}`, eventId: `event-${index}`, name: 'Door Prize', prizeName: `Sepeda ${index + 1}`, displayOrder: index, createdAt: '2026-08-08T00:00:00.000Z' }, configuration: null, event: { id: `event-${index}`, name: 'Uji Coba Event', status: 'live', createdAt: '2026-08-08T00:00:00.000Z', updatedAt: '2026-08-08T00:00:00.000Z' }, issues: [], lineages: [], redraws: [], session: { id: `session-${index}`, eventId: `event-${index}`, configurationId: `configuration-${index}`, mode: 'live', status: 'completed', configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: '2026-08-08T00:27:00.000Z', updatedAt: '2026-08-08T06:39:00.000Z', completedAt: '2026-08-08T06:39:00.000Z' }, summary: { categoryId: `category-${index}`, categoryName: 'Door Prize', completionTimestamp: '2026-08-08T06:39:00.000Z', drawSessionId: `session-${index}`, drawTimestamp: '2026-08-08T00:27:00.000Z', eligibleCount: 2, eventId: `event-${index}`, eventName: 'Uji Coba Event', mode: 'live', prizeName: `Sepeda ${index + 1}`, requestedWinnerCount: 1, sessionStatus: 'completed' }, winners: [],
} as unknown as ReconstructedHistorySession) })

describe('production History table', () => {
  it.each([1, 5, 10])('renders %i draw sessions as compact table rows', (count) => {
    render(<MemoryRouter><HistoryTable items={Array.from({ length: count }, (_, index) => makeItem(index))} /></MemoryRouter>)

    const table = screen.getByRole('table', { name: 'Official history sessions' })
    expect(within(table).getAllByRole('row')).toHaveLength(count + 1)
    expect(within(table).getAllByRole('link', { name: 'View Details' })).toHaveLength(count)
  })

  it('keeps the prize strongest and event context secondary', () => {
    render(<MemoryRouter><HistoryTable items={[makeItem(0)]} /></MemoryRouter>)

    const row = screen.getAllByRole('row')[1]
    expect(within(row).getByText('Sepeda 1')).toBeInTheDocument()
    expect(within(row).getByText('Door Prize')).toHaveClass('history-table__secondary')
    expect(within(row).getByText('Sepeda 1')).toHaveClass('history-table__event')
  })
})
