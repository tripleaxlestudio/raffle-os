import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PresentationSupport, presentationWinnerCountForStage, ProductionDrawPresentation, ProductionDrawRunHeader } from './ProductionDrawPresentation.tsx'
import type { PresentationResultProjection } from '../../../application/workflow/presentation-projection.ts'
import { projectPublicDisplaySnapshot } from '../../../application/display-transport/public-projection.ts'
import audienceDisplayPageSource from '../../../pages/display/AudienceDisplayPage.tsx?raw'
import productionPresentationSource from './ProductionDrawPresentation.tsx?raw'

function result(count: number): PresentationResultProjection {
  return { drawSessionId: '00000000-0000-4000-8000-000000000001' as never, winners: Array.from({ length: count }, (_, index) => ({ winnerId: `00000000-0000-4000-8000-${String(index + 2).padStart(12, '0')}` as never, sequence: index + 1, ticketNumber: index === 0 ? '00042' : String(index + 1) })) }
}

function publicSnapshot(stage: 'countdown' | 'rolling' | 'reveal', count: number) {
  const winningResult = result(count)
  return projectPublicDisplaySnapshot({
    drawSessionId: winningResult.drawSessionId,
    stage,
    stageStartedAt: '2030-08-05T00:00:00.000Z' as never,
    countdownValue: stage === 'countdown' ? 3 : undefined,
    blackoutRequested: false,
    eventName: 'Event',
    prizeCategory: 'Gold',
    prizeName: 'Prize',
    result: winningResult,
    presentationConfiguration: {
      winnerCount: count,
      presentationMode: 'random-number-roll',
      rollSpeedPerSecond: 12,
      rollStopMode: 'timed',
      rollDurationSeconds: 8,
      revealMode: 'all-together',
    },
    presentationSeed: winningResult.drawSessionId,
  })
}

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

describe('ProductionDrawPresentation', () => {
  beforeEach(() => { vi.stubGlobal('matchMedia', () => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn() })) })
  afterEach(() => { vi.useRealTimers() })

  it.each([1, 3, 5, 6])('uses %i selected replacement slot(s) throughout redraw presentation', (selectedCount) => {
    expect(presentationWinnerCountForStage('countdown', result(6), result(selectedCount))).toBe(selectedCount)
    expect(presentationWinnerCountForStage('rolling', result(6), result(selectedCount))).toBe(selectedCount)
    expect(presentationWinnerCountForStage('reveal', result(6), result(selectedCount))).toBe(selectedCount)
    expect(presentationWinnerCountForStage('pending-handoff', result(6), result(selectedCount))).toBe(selectedCount)
  })

  it('keeps the Operator preview and /display on the same audience renderer and public projection', () => {
    expect(audienceDisplayPageSource).toContain('AudiencePresentation')
    expect(productionPresentationSource).toContain('AudiencePresentation')
    expect(productionPresentationSource).toContain('publicSnapshot={publicSnapshot} displayConfiguration={displayConfiguration}')
    expect(productionPresentationSource).not.toContain('production-preview__tickets">')
  })

  it.each([1, 5, 9, 10])('renders the exact authoritative rolling public projection for a %i-winner redraw', (count) => {
    const snapshot = publicSnapshot('rolling', count)
    render(<PresentationSupport previewStage="rolling" eventName="Event" prizeCategory="Gold" prizeName="Prize" result={result(10)} recap={{ winnerCount: 10, eligibleCount: 100, winningRule: 'Once per event', countdownSeconds: 3, rollingSeconds: 8 }} blackoutRequested={false} publicSnapshot={snapshot} />)
    const preview = screen.getByTestId('production-preview')
    expect(preview).toHaveAttribute('data-public-stage', snapshot.stage)
    expect(preview.querySelector('[data-testid="winner-grid"]')).toHaveAttribute('data-slot-count', String(snapshot.rollingSlotCount))
  })

  it.each([1, 5, 9, 10])('renders the exact authoritative reveal public projection for a %i-winner redraw', (count) => {
    const snapshot = publicSnapshot('reveal', count)
    render(<PresentationSupport previewStage="reveal" eventName="Event" prizeCategory="Gold" prizeName="Prize" result={result(10)} recap={{ winnerCount: 10, eligibleCount: 100, winningRule: 'Once per event', countdownSeconds: 3, rollingSeconds: 8 }} blackoutRequested={false} publicSnapshot={snapshot} />)
    const preview = screen.getByTestId('production-preview')
    expect(preview).toHaveAttribute('data-public-stage', snapshot.stage)
    expect(preview.querySelector('[data-testid="winner-grid"]')).toHaveAttribute('data-slot-count', String(snapshot.ticketNumbers?.length))
    expect(preview).toHaveTextContent(snapshot.ticketNumbers?.[0] ?? '')
  })

  it('mounts the shared Audience canvas inside a visible preview viewport', () => {
    render(<PresentationSupport previewStage="ready" eventName="Spring Event" prizeCategory="Door Prize" prizeName="Prize" recap={{ winnerCount: 1, eligibleCount: 10, winningRule: 'Once per event', countdownSeconds: 3, rollingSeconds: 8 }} blackoutRequested={false} />)
    const viewport = screen.getByTestId('production-preview').querySelector('.production-preview__viewport')
    expect(viewport).not.toBeNull()
    const presentation = viewport?.querySelector('[data-audience-preview="true"]')
    expect(presentation).not.toBeNull()
    expect(presentation).toBeVisible()
    expect(presentation).not.toHaveStyle({ display: 'none', visibility: 'hidden' })
  })

  it('keeps the preview canvas on one guarded positive scale value', () => {
    render(<PresentationSupport previewStage="ready" eventName="Spring Event" prizeCategory="Door Prize" prizeName="Prize" blackoutRequested={false} />)
    const presentation = screen.getByTestId('production-preview').querySelector('[data-audience-preview="true"]')
    expect(presentation).toHaveStyle('--audience-preview-scale: 0.5')
    expect(presentation?.parentElement).toHaveClass('production-preview__viewport')
  })

  it('renders the persistent public monitor for the Ready-to-Start state', () => {
    render(<PresentationSupport previewStage="ready" eventName="Spring Event" prizeCategory="Door Prize" prizeName="K-Ion Nano Premium 5" recap={{ winnerCount: 10, eligibleCount: 100, winningRule: 'Once per event', countdownSeconds: 3, rollingSeconds: 8 }} audienceStatus={{ label: 'Connected', detail: 'Acknowledged', displayUrl: null }} blackoutRequested={false} />)
    const preview = screen.getByTestId('production-preview')
    expect(preview).toHaveAttribute('data-public-stage', 'ready')
    expect(preview.querySelector('[data-audience-state="standby"]')).toBeInTheDocument()
    expect(preview).toHaveTextContent('Next draw')
    expect(preview).toHaveTextContent('K-Ion Nano Premium 5')
    expect(screen.getByText('Runtime status')).toBeInTheDocument()
    expect(screen.getByText(/Audience acknowledgement: Acknowledged/)).toBeInTheDocument()
  })

  it.each([1, 20, 50, 100])('reveals %i winners in sequence order without changing ticket strings', async (count) => {
    render(<ProductionDrawPresentation result={result(count)} mode="practice" eventName="Event" prizeCategory="Gold" prizeName="Prize" practiceResult={{ drawSessionId: result(count).drawSessionId, winners: result(count).winners as never, createdAt: '2026-08-05T00:00:00.000Z', policyVersion: 1 }} onFailure={() => undefined} />)
    const winnerList = await screen.findByRole('list', { name: `${count} Practice winners` })
    expect(winnerList).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(count)
    expect(within(winnerList).getByText('00042')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip animation' })).not.toBeInTheDocument()
  })

  it('bootstraps a Live result without a checkpoint by writing countdown first', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }))
    const upsert = vi.fn(async () => undefined)
    const findByDrawSessionId = vi.fn(async () => null)
    render(<ProductionDrawPresentation result={result(1)} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" checkpoints={{ findByDrawSessionId, upsert }} onFailure={() => undefined} />)
    expect(await screen.findByRole('heading', { name: 'Get ready' })).toBeInTheDocument()
    expect(findByDrawSessionId).toHaveBeenCalledWith(result(1).drawSessionId)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ stage: 'countdown', drawSessionId: result(1).drawSessionId }))
  })

  it('shows the blocking recovery dialog when the Live countdown checkpoint write fails', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }))
    const onRecoveryBack = vi.fn()
    render(<ProductionDrawPresentation result={result(1)} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" checkpoints={{ findByDrawSessionId: async () => null, upsert: async () => { throw new Error('write rejected') } }} onFailure={() => undefined} onRecoveryBack={onRecoveryBack} />)
    const dialog = await screen.findByRole('dialog', { name: 'Winner result safely saved' })
    expect(screen.getByRole('heading', { name: 'Presentation recovery' })).toBeInTheDocument()
    expect(screen.getByText('The selected winner is safely recorded.')).toBeInTheDocument()
    expect(screen.getByText('Continue to review the winner to confirm the result or draw a replacement if needed.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Draw Setup' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Review Winner' })).not.toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.queryByText('Preparing locked result presentation…')).not.toBeInTheDocument()
    screen.getByRole('button', { name: 'Back to Draw Setup' }).click()
    expect(onRecoveryBack).toHaveBeenCalledTimes(1)
  })

  it('routes review to the exact locked DrawSession when pending results are persisted', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }))
    const drawSessionId = result(1).drawSessionId

    function RecoveryHarness() {
      const navigate = useNavigate()
      return <ProductionDrawPresentation result={result(1)} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" checkpoints={{ findByDrawSessionId: async () => null, upsert: async () => { throw new Error('write rejected') } }} onFailure={() => undefined} reviewPendingResultsAvailable onReviewPendingResults={() => navigate(`/draw/pending/${drawSessionId}`)} />
    }

    render(<MemoryRouter initialEntries={[`/draw/run/${drawSessionId}`]}><RecoveryHarness /><LocationProbe /></MemoryRouter>)
    await screen.findByRole('dialog', { name: 'Winner result safely saved' })
    expect(within(screen.getByRole('contentinfo')).getAllByRole('button').map((button) => button.textContent?.trim())).toEqual(['Back to Draw Setup', 'Review Winner'])
    fireEvent.click(screen.getByRole('button', { name: 'Review Winner' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(`/draw/pending/${drawSessionId}`))
  })

  it('exposes rehearsal reset only for completed Practice presentation', async () => {
    const onResetPractice = vi.fn()
    render(<ProductionDrawPresentation result={result(1)} mode="practice" eventName="Event" prizeCategory="Gold" prizeName="Prize" practiceResult={{ drawSessionId: result(1).drawSessionId, winners: result(1).winners as never, createdAt: '2026-08-05T00:00:00.000Z', policyVersion: 1, presentation: { storageFormatVersion: 1, stage: 'pending-handoff', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, presentationPolicyVersion: 1, blackoutRequested: false } }} initialPresentation={{ stage: 'pending-handoff', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false }} onFailure={() => undefined} onResetPractice={onResetPractice} />)
    expect(await screen.findByRole('heading', { name: 'Practice presentation complete' })).toBeInTheDocument()
    await screen.findByRole('button', { name: 'Reset rehearsal' }).then((button) => button.click())
    expect(onResetPractice).toHaveBeenCalledTimes(1)
  })

  it('does not expose rehearsal reset for Live presentation', async () => {
    render(<ProductionDrawPresentation result={result(1)} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false }} onFailure={() => undefined} onResetPractice={vi.fn()} />)
    expect(await screen.findByRole('heading', { name: 'Winner reveal' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset rehearsal' })).not.toBeInTheDocument()
    expect(screen.getByText('Presentation complete')).toBeInTheDocument()
    expect(screen.getByText('The selected winners are ready for review.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review Pending Results' })).toBeInTheDocument()
  })

  it('opens quick redraw confirmation without mutating until confirmed', async () => {
    const onQuickRedraw = vi.fn(async () => undefined)
    const onReviewPendingResults = vi.fn()
    render(<ProductionDrawPresentation result={result(1)} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false }} onFailure={() => undefined} onQuickRedraw={onQuickRedraw} onReviewPendingResults={onReviewPendingResults} />)

    expect(await screen.findByRole('button', { name: 'Redraw Winner' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Redraw Winner' }))
    expect(screen.getByRole('dialog', { name: 'Redraw winner' })).toBeInTheDocument()
    expect(screen.getByText('Current winner')).toBeInTheDocument()
    expect(screen.getByText('Ticket 00042')).toBeInTheDocument()
    expect(screen.getByText('This winner will be replaced')).toBeInTheDocument()
    expect(screen.getByText('Ticket 00042 will be marked as Absent and excluded from this replacement draw.')).toBeInTheDocument()
    expect(screen.getByText('The original result will remain in official history for audit purposes.')).toBeInTheDocument()
    expect(screen.getByText('Replacement draw')).toBeInTheDocument()
    expect(screen.getByText('A new eligible participant will be selected using the existing Live draw rules.')).toBeInTheDocument()
    expect(onQuickRedraw).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Review Instead' }))
    expect(onReviewPendingResults).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: 'Redraw winner' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Redraw Winner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Redraw' }))
    await waitFor(() => expect(onQuickRedraw).toHaveBeenCalledTimes(1))
  })

  it('keeps redraw available for two winners and requires explicit winner selection', async () => {
    const onQuickRedraw = vi.fn(async () => undefined)
    render(<ProductionDrawPresentation result={result(2)} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false }} onFailure={() => undefined} onQuickRedraw={onQuickRedraw} />)

    expect(await screen.findByRole('button', { name: 'Redraw Winner' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Redraw Winner' }))
    expect(await screen.findByRole('dialog', { name: 'Select winners to redraw' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Select winners to redraw' })).toHaveTextContent('00042')
    expect(screen.getByRole('dialog', { name: 'Select winners to redraw' })).toHaveTextContent('#2')
    expect(screen.queryByRole('dialog', { name: 'Redraw winner' })).not.toBeInTheDocument()
    expect(onQuickRedraw).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    const selectedCards = screen.getAllByRole('checkbox').map((checkbox) => checkbox.closest('label'))
    expect(selectedCards.every((card) => card?.classList.contains('production-redraw-selection-dialog__option--selected'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    fireEvent.click(screen.getAllByRole('checkbox')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Redraw' }))
    expect(await screen.findByRole('dialog', { name: 'Redraw winner' })).toBeInTheDocument()
    expect(screen.getByText('Ticket 00042 will be marked as Absent and excluded from this replacement draw.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Redraw' }))
    await waitFor(() => expect(onQuickRedraw).toHaveBeenCalledWith([result(2).winners[0]?.winnerId]))
  })

  it.each([3, 5])('keeps redraw available for a %s-winner draw', async (winnerCount) => {
    const onQuickRedraw = vi.fn(async () => undefined)
    render(<ProductionDrawPresentation result={result(winnerCount)} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false }} onFailure={() => undefined} onQuickRedraw={onQuickRedraw} />)
    expect(await screen.findByRole('button', { name: 'Redraw Winner' })).toBeInTheDocument()
  })

  it('restores a compact chained redraw lineage with only the current winner actionable', async () => {
    const onQuickRedraw = vi.fn(async () => undefined)
    render(<ProductionDrawPresentation result={{ drawSessionId: result(1).drawSessionId, winners: [{ winnerId: '00000000-0000-4000-8000-000000000009' as never, sequence: 1, ticketNumber: '00034' }] }} redrawLineage={[{ winnerId: '00000000-0000-4000-8000-000000000006' as never, ticketNumber: '00056', status: 'replaced' }, { winnerId: '00000000-0000-4000-8000-000000000007' as never, ticketNumber: '00093', status: 'replaced' }, { winnerId: '00000000-0000-4000-8000-000000000008' as never, ticketNumber: '00004', status: 'replaced' }, { winnerId: '00000000-0000-4000-8000-000000000009' as never, ticketNumber: '00034', status: 'current' }]} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false }} onFailure={() => undefined} onQuickRedraw={onQuickRedraw} />)

    expect(await screen.findByText('Redraw history · 3 replaced winners')).toBeInTheDocument()
    const historyDisclosure = screen.getByText('View history')
    expect(historyDisclosure.closest('details')).not.toHaveAttribute('open')
    fireEvent.click(historyDisclosure)
    const history = screen.getByRole('list', { name: 'Previous replaced tickets' })
    expect(within(history).getByText('00056')).toBeInTheDocument()
    expect(within(history).getByText('00093')).toBeInTheDocument()
    expect(within(history).getByText('00004')).toBeInTheDocument()
    expect(within(history).getAllByText('REPLACED · ABSENT')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Redraw Winner' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Winner reveal' })).toHaveTextContent('00034')
    fireEvent.click(screen.getByRole('button', { name: 'Redraw Winner' }))
    expect(screen.getByRole('dialog', { name: 'Redraw winner' })).toBeInTheDocument()
  })

  it('renders the production control deck and structured Audience status during countdown', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }))
    render(<ProductionDrawPresentation result={result(2)} mode="practice" eventName="Event" prizeCategory="Gold" prizeName="Prize" practiceResult={{ drawSessionId: result(2).drawSessionId, winners: result(2).winners as never, createdAt: '2026-08-05T00:00:00.000Z', policyVersion: 1 }} recap={{ winnerCount: 2, eligibleCount: 40, winningRule: 'uniform', countdownSeconds: 5, rollingSeconds: 8 }} audienceStatus={{ label: 'Connected', detail: 'Audience presence is active and the latest public snapshot was acknowledged.', displayUrl: null }} onFailure={() => undefined} />)
    expect(await screen.findByRole('heading', { name: 'Get ready' })).toBeInTheDocument()
    expect(screen.getAllByText('Connected')[0]).toHaveClass('ui-badge--success')
    expect(screen.getAllByText('Audience presence is active and the latest public snapshot was acknowledged.')).toHaveLength(1)
    expect(screen.getByText('Winner count').nextElementSibling).toHaveTextContent('2')
    expect(screen.queryByRole('button', { name: 'Reset rehearsal' })).not.toBeInTheDocument()
  })

  it('renders exact winner values in the authoritative preview during reveal', async () => {
    render(<ProductionDrawPresentation result={result(1)} mode="practice" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false }} audienceStatus={{ label: 'Connected', detail: 'Acknowledged', displayUrl: null }} onFailure={() => undefined} />)
    expect(await screen.findByRole('heading', { name: 'Winner reveal' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '1 Practice winners' })).toHaveTextContent('00042')
    expect(screen.getByTestId('production-preview')).toHaveAttribute('data-public-stage', 'reveal')
    expect(within(screen.getByTestId('production-preview')).getByText('00042')).toBeInTheDocument()
  })

  it('centers 3-winner result and preview groups without changing ticket strings', async () => {
    render(<ProductionDrawPresentation result={result(3)} mode="practice" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false }} onFailure={() => undefined} />)
    expect(await screen.findByRole('heading', { name: 'Winner reveal' })).toBeInTheDocument()
    const winnerList = screen.getByRole('list', { name: '3 Practice winners' })
    expect(winnerList).toHaveClass('production-winner-list--3')
    expect(winnerList).not.toHaveClass('production-winner-list--1')
    expect(within(winnerList).getByText('00042')).toBeInTheDocument()
    const preview = screen.getByTestId('production-preview')
    expect(preview.querySelector('[data-audience-state="reveal"]')).toBeInTheDocument()
    expect(preview.querySelectorAll('.ticket-tile__number')).toHaveLength(3)
  })

  it('uses a compact three-column winner grid for six winners with contiguous indexes', async () => {
    render(<ProductionDrawPresentation result={result(6)} mode="practice" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false }} onFailure={() => undefined} />)
    expect(await screen.findByRole('heading', { name: 'Winner reveal' })).toBeInTheDocument()
    const winnerList = screen.getByRole('list', { name: '6 Practice winners' })
    expect(winnerList).toHaveClass('production-winner-list--6')
    expect(within(winnerList).getAllByRole('listitem')).toHaveLength(6)
    expect(winnerList).toHaveTextContent('#1')
    expect(winnerList).toHaveTextContent('#6')
  })

  it('keeps only replacement winners in Operator reveal and preview after a partial redraw', async () => {
    render(<ProductionDrawPresentation result={result(6)} activeResult={result(3)} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false }} onFailure={() => undefined} />)

    const winnerList = await screen.findByRole('list', { name: '3 official winners' })
    expect(within(winnerList).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByTestId('production-preview').querySelectorAll('.ticket-tile__number')).toHaveLength(3)
  })

  it.each([1, 3, 5, 6])('keeps %i replacement slot(s) in the Operator Audience Preview while rolling', async (selectedCount) => {
    render(<ProductionDrawPresentation result={result(6)} activeResult={result(selectedCount)} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'rolling', stageStartedAt: '2030-08-05T00:00:00.000Z' as never, blackoutRequested: false }} onFailure={() => undefined} />)

    const preview = await screen.findByTestId('production-preview')
    expect(preview).toHaveAttribute('data-public-stage', 'rolling')
    expect(preview.querySelector('[data-testid="winner-grid"]')).toHaveAttribute('data-slot-count', String(selectedCount))
  })

  it('keeps the active multi-winner grid when redraw lineage includes replaced winners', async () => {
    const currentResult = result(6)
    const lineage = [
      { winnerId: '00000000-0000-4000-8000-000000000101' as never, ticketNumber: '00101', status: 'replaced' as const },
      { winnerId: '00000000-0000-4000-8000-000000000102' as never, ticketNumber: '00102', status: 'replaced' as const },
      { winnerId: '00000000-0000-4000-8000-000000000103' as never, ticketNumber: '00103', status: 'replaced' as const },
      ...currentResult.winners.map((winner) => ({ winnerId: winner.winnerId, ticketNumber: winner.ticketNumber, status: 'current' as const })),
    ]

    render(<ProductionDrawPresentation result={currentResult} redrawLineage={lineage} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false }} onFailure={() => undefined} />)

    const winnerList = await screen.findByRole('list', { name: '6 official winners' })
    expect(winnerList).toHaveClass('production-winner-list--6')
    expect(winnerList).not.toHaveClass('production-winner-list--1')
    expect(within(winnerList).getAllByRole('listitem')).toHaveLength(6)
    expect(within(winnerList).getAllByText(/^#[1-6]$/)).toHaveLength(6)
    for (let index = 1; index <= 6; index += 1) {
      expect(winnerList).toHaveTextContent(`#${index}`)
    }
  })

  it('restores Reset rehearsal for completed Practice reveal only', async () => {
    const onResetPractice = vi.fn()
    render(<ProductionDrawPresentation result={result(1)} mode="practice" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false }} onFailure={() => undefined} onResetPractice={onResetPractice} />)
    expect(await screen.findByRole('button', { name: 'Reset rehearsal' })).toBeInTheDocument()
    screen.getByRole('button', { name: 'Reset rehearsal' }).click()
    expect(onResetPractice).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Return to Draw Sessions' })).toBeInTheDocument()
  })

  it('completes a Practice timed roll without Skip animation', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }))
    const practiceResult = { drawSessionId: result(1).drawSessionId, winners: result(1).winners as never, createdAt: '2026-08-05T00:00:00.000Z', policyVersion: 1 as const }
    render(<ProductionDrawPresentation result={result(1)} mode="practice" eventName="Event" prizeCategory="Gold" prizeName="Prize" practiceResult={practiceResult} presentationConfiguration={{ presentationMode: 'random-number-roll', rollStopMode: 'timed', rollDurationSeconds: 5, rollSpeedPerSecond: 20, revealMode: 'sequential' }} onFailure={() => undefined} />)
    await act(async () => { await Promise.resolve() })
    expect(screen.getByRole('heading', { name: 'Get ready' })).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getByRole('heading', { name: 'Rolling' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip animation' })).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(screen.getByRole('heading', { name: 'Winner reveal' })).toBeInTheDocument()
  })

  it('shows STOP & REVEAL only for Manual rolling', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T00:00:00.000Z'))
    vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }))
    const practiceResult = { drawSessionId: result(1).drawSessionId, winners: result(1).winners as never, createdAt: '2026-08-05T00:00:00.000Z', policyVersion: 1 as const }
    render(<ProductionDrawPresentation result={result(1)} mode="practice" eventName="Event" prizeCategory="Gold" prizeName="Prize" practiceResult={practiceResult} presentationConfiguration={{ presentationMode: 'random-number-roll', rollStopMode: 'manual', rollDurationSeconds: 5, rollSpeedPerSecond: 20, revealMode: 'sequential' }} initialPresentation={{ stage: 'rolling', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false }} onFailure={() => undefined} />)
    await act(async () => { await Promise.resolve() })
    const stop = screen.getByRole('button', { name: 'STOP & REVEAL' })
    expect(stop).toHaveClass('ui-button--danger', 'ui-button--lg', 'production-manual-stop')
    expect(stop.closest('.production-presentation__content')).not.toBeNull()
    expect(document.querySelector('.presentation-header-actions')?.querySelector('button')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Skip animation' })).not.toBeInTheDocument()
  })

  it('survives Strict Mode recovery hydration and continues from the persisted stage', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T00:00:00.000Z'))
    vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }))
    const recoveredAt = '2026-08-05T00:00:00.000Z' as never
    render(<StrictMode><ProductionDrawPresentation result={result(1)} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'countdown', stageStartedAt: recoveredAt, blackoutRequested: false }} checkpoints={{ findByDrawSessionId: async () => null, upsert: async () => undefined }} onFailure={() => undefined} /></StrictMode>)

    await Promise.resolve()
    expect(screen.getByRole('heading', { name: 'Get ready' })).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getByRole('heading', { name: 'Rolling' })).toBeInTheDocument()
    expect(screen.queryByText('The presentation stage transition is invalid.')).not.toBeInTheDocument()
  })
})

describe('ProductionDrawRunHeader', () => {
  it('keeps critical metrics and production actions explicit', () => {
    render(
      <MemoryRouter>
        <ProductionDrawRunHeader
          backTo="/draw/live"
          audienceStatus={{ detail: 'Last public snapshot acknowledged.', displayUrl: '/display?eventId=event-1', label: 'Connected' }}
          eventName="Spring Event"
          mode="live"
          prizeCategory="Grand Prize"
          prizeName="Travel voucher"
          recap={{ countdownSeconds: 5, eligibleCount: 4, rollingSeconds: 8, winnerCount: 1, winningRule: 'Once per category' }}
          stage="Ready to start"
        />
      </MemoryRouter>,
    )

    const header = screen.getByRole('banner')
    const metrics = header.querySelector('dl')
    if (metrics === null) throw new Error('Expected the draw metrics definition list.')
    expect(within(metrics).getAllByText('Winners')).toHaveLength(1)
    expect(within(metrics).getAllByText('Eligible')).toHaveLength(1)
    expect(within(metrics).getAllByText('Presentation timing')).toHaveLength(1)
    expect(within(metrics).getByText('1')).toBeVisible()
    expect(within(metrics).getByText('4')).toBeVisible()
    expect(within(metrics).getByText('Countdown')).toBeVisible()
    expect(within(metrics).getByText('5s')).toBeVisible()
    expect(within(metrics).getByText('Rolling')).toBeVisible()
    expect(within(metrics).getByText('8s')).toBeVisible()
    expect(within(header).getByRole('link', { name: 'Back to Live Draw' })).toHaveAttribute('href', '/draw/live')
    expect(within(header).getByRole('link', { name: 'Open Audience Display' })).toHaveAttribute('href', '/display?eventId=event-1')
    expect(within(header).getByText('Audience Display')).toBeVisible()
    expect(within(header).getByText('Connected')).toBeVisible()
    expect(within(header).getByText('Last public snapshot acknowledged.')).toBeVisible()
  })
})
