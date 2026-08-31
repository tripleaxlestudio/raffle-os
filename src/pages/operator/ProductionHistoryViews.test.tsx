import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { HistoryReconstruction, ReconstructedHistorySession } from '../../application/history/history-read-model.ts'
import { AllWinners, HistoryDetail } from './ProductionHistoryPage.tsx'

const makeProjection = (): HistoryReconstruction => ({ kind: 'incomplete', value: ({
  audits: [], category: null, configuration: null, event: null, issues: [{ code: 'missing-category', message: 'Missing category' }], redraws: [],
  lineages: [{ originalWinnerRecordId: 'winner-original', originalTicketNumber: '00042', redrawRecordId: 'redraw-1', redrawTimestamp: '2026-08-08T10:02:00.000Z', replacementTicketNumber: '42', replacementWinnerRecordId: 'winner-replacement', reason: 'other' }],
  session: { id: 'session-1', eventId: 'event-1', configurationId: 'configuration-1', mode: 'live', status: 'pending-confirmation', configurationSnapshot: { categoryName: 'Grand Prize', configurationId: 'configuration-1', eventId: 'event-1', prizeCategoryId: 'category-1', prizeName: 'Electric Scooter', requestedWinners: 2 }, candidatePoolSnapshot: { eligibleSnapshotCount: 2 }, createdAt: '2026-08-08T10:00:00.000Z', updatedAt: '2026-08-08T10:02:00.000Z' },
  summary: { categoryId: 'category-1', categoryName: 'Grand Prize', completionTimestamp: undefined, drawSessionId: 'session-1', drawTimestamp: '2026-08-08T10:00:00.000Z', eligibleCount: 2, eventId: 'event-1', eventName: 'Event', mode: 'live', prizeName: 'Electric Scooter', requestedWinnerCount: 2, sessionStatus: 'pending-confirmation' },
  winners: [
    { cancellationTimestamp: '2026-08-08T10:02:00.000Z', drawSessionId: 'session-1', participantId: 'participant-1', selectedTimestamp: '2026-08-08T10:00:00.000Z', sequence: 1, status: 'cancelled', ticketNumber: '00042', winnerRecordId: 'winner-original' },
    { drawSessionId: 'session-1', participantId: 'participant-2', selectedTimestamp: '2026-08-08T10:02:00.000Z', sequence: 2, status: 'pending', ticketNumber: '42', winnerRecordId: 'winner-replacement' },
  ],
} as unknown as ReconstructedHistorySession) })

describe('production History views', () => {
  it('keeps all retained winners, exact tickets, and redraw lineage visible in detail', () => {
    render(<MemoryRouter><HistoryDetail reconstruction={makeProjection()} /></MemoryRouter>)
    expect(screen.getByText('Official record is incomplete or inconsistent')).toBeInTheDocument()
    expect(screen.getAllByText('00042').length).toBeGreaterThan(0)
    expect(screen.getAllByText('42').length).toBeGreaterThan(0)
    expect(screen.getByText('Replacement context')).toBeInTheDocument()
    expect(screen.getByText('Tertunda')).toBeInTheDocument()
    expect(screen.getAllByText('Dibatalkan').length).toBeGreaterThan(1)
    expect(screen.getByText('Eligible-pool count')).toBeInTheDocument()
  })

  it('aggregates confirmed, cancelled, and pending records without presenting practice data', () => {
    const second = makeProjection()
    render(<MemoryRouter><AllWinners eventName="Event" sessions={[makeProjection(), second]} /></MemoryRouter>)
    const table = screen.getByRole('table', { name: 'All official winners' })
    expect(within(table).getAllByText('00042').length).toBeGreaterThanOrEqual(2)
    expect(within(table).getAllByText('42').length).toBeGreaterThanOrEqual(2)
    expect(within(table).getAllByText('Tertunda')).toHaveLength(2)
    expect(within(table).getAllByText('Dibatalkan').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('Latihan')).not.toBeInTheDocument()
  })
})
