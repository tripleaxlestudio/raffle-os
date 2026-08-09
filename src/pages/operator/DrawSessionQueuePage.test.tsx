import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DrawControlDeck } from './DrawSessionQueuePage.tsx'
import type { DrawSessionQueueDeck } from '../../ui/operator/draw/draw-session-queue-view-model.ts'
import type { DrawSessionQueueItem } from '../../application/draw/draw-session-queue.ts'

const session = (mode: 'practice' | 'live'): DrawSessionQueueItem => ({
  action: { kind: 'run', to: `/draw/run/${mode}` },
  category: { id: 'category-1', name: 'Acceptance Prize', prizeName: 'Acceptance Test Prize' } as never,
  checkpoint: null,
  event: { id: 'event-1', name: 'Raffle OS Phase 5 Acceptance' } as never,
  relation: 'valid',
  session: { id: `${mode}-session`, mode, status: 'ready', updatedAt: '2026-07-31T08:15:00.000Z' } as never,
  winnerCount: 1,
})

const deck: DrawSessionQueueDeck = {
  categoryName: 'Acceptance Prize',
  defaultMode: 'practice',
  eventName: 'Raffle OS Phase 5 Acceptance',
  key: 'deck-1',
  prizeName: 'Acceptance Test Prize',
  sessions: { live: session('live'), practice: session('practice') },
  winnerCount: 1,
}

function renderDeck() {
  function Harness() {
    const [mode, setMode] = useState<'practice' | 'live'>('practice')
    return <DrawControlDeck connection={{ acknowledged: true, acknowledgedAt: undefined, detail: 'Last public snapshot acknowledged.', label: 'Connected', tone: 'success' }} deck={deck} displayUrl="/display?eventId=event-1" selectedMode={mode} setSelectedMode={setMode} />
  }

  return render(<MemoryRouter><Harness /></MemoryRouter>)
}

describe('Production Draw control deck', () => {
  it('renders ClipboardCheck for the pending-result action branch', () => {
    const pendingDeck: DrawSessionQueueDeck = {
      ...deck,
      defaultMode: 'live',
      sessions: {
        live: { ...session('live'), action: { kind: 'pending', to: '/draw/pending/live-session' } },
      },
    }

    render(<MemoryRouter><DrawControlDeck connection={{ acknowledged: true, acknowledgedAt: undefined, detail: 'Last public snapshot acknowledged.', label: 'Connected', tone: 'success' }} deck={pendingDeck} displayUrl="/display?eventId=event-1" selectedMode="live" setSelectedMode={() => undefined} /></MemoryRouter>)

    const review = screen.getByRole('link', { name: 'Review Pending Results' })
    expect(review).toBeInTheDocument()
    expect(review.querySelector('.ui-icon')).toBeInTheDocument()
  })

  it('uses one prominent mode switch with selected states and compact audience actions', () => {
    renderDeck()
    const modeGroup = screen.getByRole('group', { name: 'Acceptance Prize mode' })
    const practice = screen.getByRole('button', { name: 'Practice' })
    const live = screen.getByRole('button', { name: 'Live' })

    expect(modeGroup).toBeInTheDocument()
    expect(practice).toHaveAttribute('aria-pressed', 'true')
    expect(practice).toHaveClass('is-selected')
    expect(screen.getByText('Rehearsal run — results will not be saved as official.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Live mode is not active' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ready for rehearsal' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start Practice' })).toHaveClass('ui-button--lg')
    expect(screen.getByRole('link', { name: 'Start Practice' })).toHaveClass('ui-button--primary')
    expect(screen.getByRole('link', { name: 'Open Draw Setup' })).toHaveAttribute('href', '/draw/setup')
    expect(screen.getByRole('link', { name: 'Open Draw Setup' })).toHaveClass('ui-button--lg')
    expect(screen.getByRole('link', { name: 'Open Draw Setup' })).toHaveClass('draw-control-deck__live-setup-action')
    expect(screen.getAllByText('Connected')).toHaveLength(1)
    expect(screen.getByText('Last public snapshot acknowledged.')).toBeInTheDocument()
    expect(screen.queryByText('Acknowledged')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Audience Display' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start Practice' })).toBeInTheDocument()

    fireEvent.click(live)

    expect(live).toHaveAttribute('aria-pressed', 'true')
    expect(live).toHaveClass('is-selected')
    expect(screen.getByText('Official run — eligible to create an official result after confirmation.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start Live Draw' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start Live Draw' })).toHaveClass('ui-button--danger')
  })
})
