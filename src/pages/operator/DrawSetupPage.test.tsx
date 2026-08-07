import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { DrawAuthoringRecord } from '../../application/draw/draw-authoring.types.ts'
import type { DrawSetupProductionServices } from '../../application/draw/draw-setup-query.types.ts'
import { DrawAuthoringError } from '../../application/draw/draw-authoring-errors.ts'
import { DrawSetupPage } from './DrawSetupPage.tsx'

const event = { id: 'event-1', name: 'Persisted Gala', status: 'draft', createdAt: '2026-07-31T08:00:00.000Z', updatedAt: '2026-07-31T08:00:00.000Z' } as const
const category = { id: 'category-1', eventId: event.id, name: 'Grand Prize', prizeName: 'Electric Vehicle', displayOrder: 1, createdAt: event.createdAt } as const
const alternateCategory = { ...category, id: 'category-2', name: 'Second Prize', prizeName: 'Travel Voucher' } as const
const configuration = { id: 'configuration-1', eventId: event.id, prizeCategoryId: category.id, requestedWinners: 1, winningRule: 'once-per-event', requireCheckIn: true, eligibleGroupFilter: null, createdAt: event.createdAt, updatedAt: event.updatedAt } as const
const session = { id: 'session-1', eventId: event.id, configurationId: configuration.id, mode: 'practice', status: 'ready', configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: event.createdAt, updatedAt: event.updatedAt } as const
const record = { event, category, configuration, session, eligibleCount: 1 } as unknown as DrawAuthoringRecord
const participants = [
  { id: 'participant-1', eventId: event.id, ticketNumber: '00042', isCheckedIn: true, group: 'VIP', createdAt: event.createdAt, updatedAt: event.updatedAt },
  { id: 'participant-2', eventId: event.id, ticketNumber: '00043', isCheckedIn: false, group: 'VIP', createdAt: event.createdAt, updatedAt: event.updatedAt },
] as const

function services(overrides: { record?: DrawAuthoringRecord | null; event?: typeof event | null; categories?: readonly (typeof category | typeof alternateCategory)[]; participants?: readonly typeof participants[number][]; save?: DrawSetupProductionServices['authoringService'] extends infer S ? S extends { save: (...args: never[]) => unknown } ? S['save'] : never : never; conflict?: 'drawing' | 'pending-confirmation'; conflictAfterSave?: 'drawing' | 'pending-confirmation' } = {}) {
  const current = overrides.record === undefined ? record : overrides.record
  const load = vi.fn(async () => ({ ok: true as const, event: overrides.event === undefined ? event : overrides.event, categories: overrides.categories ?? [category], record: current }))
  let activeConflict = overrides.conflict
  const save = overrides.save ?? vi.fn(async () => { activeConflict = overrides.conflictAfterSave; return { ok: true as const, record: current ?? record } })
  const selectedParticipants = overrides.participants ?? participants
  return { open: vi.fn(async () => undefined), checkStorage: vi.fn(async () => ({ ok: true as const })), checkCrypto: vi.fn(async () => ({ ok: true as const })), preferences: { get: vi.fn(async () => event.id) }, events: { findById: vi.fn(async () => event) }, configurations: { findById: vi.fn(async () => configuration) }, categories: { findById: vi.fn(async () => category) }, sessions: { findById: vi.fn(async () => session), findByEventId: vi.fn(async () => activeConflict === undefined ? [session] : [session, { ...session, id: 'live-conflict', mode: 'live' as const, status: activeConflict }]) }, participants: { countByEventId: vi.fn(async () => selectedParticipants.length), findByEventId: vi.fn(async () => selectedParticipants) }, winners: { findByEventId: vi.fn(async () => []) }, authoringService: { load, save }, } as unknown as DrawSetupProductionServices
}

function renderPage(value: DrawSetupProductionServices) { return render(<MemoryRouter><DrawSetupPage services={value} /></MemoryRouter>) }

describe('Draw Setup persisted authoring', () => {
  it('keeps Event read-only and follows the selected persisted category prize', async () => {
    const user = userEvent.setup()
    renderPage(services({ categories: [category, alternateCategory] }))
    expect(await screen.findByDisplayValue('Persisted Gala')).toBeDisabled()
    const categorySelect = screen.getByLabelText('Prize category')
    await user.selectOptions(categorySelect, alternateCategory.id)
    expect(screen.getByDisplayValue('Travel Voucher')).toHaveAttribute('readonly')
  })

  it('shows quick counts with pressed semantics and updates the same winner field', async () => {
    const user = userEvent.setup()
    renderPage(services())
    for (const count of ['1', '3', '6', '10', '20', '50']) {
      expect(await screen.findByRole('button', { name: count })).toHaveAttribute('aria-pressed', count === '1' ? 'true' : 'false')
    }
    await user.click(screen.getByRole('button', { name: '6' }))
    expect(screen.getByRole('button', { name: '6' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Custom winner count')).toHaveValue(6)
    await user.clear(screen.getByLabelText('Custom winner count'))
    await user.type(screen.getByLabelText('Custom winner count'), '10')
    expect(screen.getByRole('button', { name: '10' })).toHaveAttribute('aria-pressed', 'true')
    await user.clear(screen.getByLabelText('Custom winner count'))
    await user.type(screen.getByLabelText('Custom winner count'), '7')
    for (const count of ['1', '3', '6', '10', '20', '50']) {
      expect(screen.getByRole('button', { name: count })).toHaveAttribute('aria-pressed', 'false')
    }
    expect(screen.getByText('Save changes to evaluate eligibility and readiness.')).toBeInTheDocument()
  })

  it('saves requestedWinners through the existing authoring service', async () => {
    const user = userEvent.setup()
    const save = vi.fn(async () => ({ ok: true as const, record }))
    renderPage(services({ save }))
    await screen.findByDisplayValue('1')
    await user.click(screen.getByRole('button', { name: '20' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ requestedWinners: '20' }))
  })

  it('preserves the custom 1–100 input and validation errors', async () => {
    const user = userEvent.setup()
    const save = vi.fn(async () => ({ ok: false as const, error: new DrawAuthoringError('invalid-winner-count', 'Winner count must be an integer from 1 through 100.') }))
    renderPage(services({ save }))
    const input = await screen.findByLabelText('Custom winner count')
    expect(input).toHaveAttribute('min', '1')
    expect(input).toHaveAttribute('max', '100')
    await user.clear(input)
    await user.type(input, '6')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/Winner count must be an integer from 1 through 100/i)).toBeInTheDocument()
  })

  it('shows authoritative capacity diagnostics and readiness', async () => {
    renderPage(services())
    const capacityHeading = await screen.findByRole('heading', { name: 'Eligible pool summary' })
    const capacitySection = capacityHeading.closest('section')
    const identityHeading = screen.getByRole('heading', { name: 'Event and prize' })
    const headingOrder = Array.from(document.querySelectorAll('h2')).map((heading) => heading.textContent)
    expect(headingOrder.indexOf(capacityHeading.textContent)).toBeLessThan(headingOrder.indexOf(identityHeading.textContent))
    expect(screen.getAllByRole('heading', { name: 'Eligible pool summary' })).toHaveLength(1)
    const primaryMetrics = screen.getByLabelText('Eligible pool metrics')
    expect(capacitySection).toContainElement(screen.getByText('Total participants'))
    expect(capacitySection).toContainElement(screen.getByText('Checked-in participants'))
    expect(capacitySection).toContainElement(screen.getByText('Previous winners excluded'))
    expect(primaryMetrics).toContainElement(screen.getByText('Eligible pool'))
    expect(primaryMetrics).toContainElement(screen.getByText('Requested winners'))
    expect(primaryMetrics.querySelectorAll('dt')).toHaveLength(5)
    expect(primaryMetrics.nextElementSibling).toHaveClass('draw-setup-capacity-readiness')
    expect(screen.getByText('Eligible pool').closest('div')).toHaveClass('eligible-pool-metrics__highlight')
    expect(screen.getByText('Requested winners').closest('div')).toHaveClass('eligible-pool-metrics__highlight')
    const supportCard = document.querySelector('.draw-setup-support-card')
    expect(supportCard).not.toContainElement(screen.getByText('Total participants'))
    expect(supportCard).not.toContainElement(screen.getByRole('heading', { name: 'Draw is ready for handoff' }))
    expect(screen.getByRole('heading', { name: 'Winner quantity' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Eligibility rules' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'How many winners?' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Who can win?' })).not.toBeInTheDocument()
    expect(screen.getByText('Choose a preset or enter 1–100. Save to recalculate readiness.')).toBeInTheDocument()
    expect(document.querySelector('.draw-mode-options__list')?.querySelectorAll('input[type="radio"]')).toHaveLength(2)
    expect(screen.getByRole('radio', { name: 'Practice' }).closest('label')).toHaveClass('draw-mode-option')
    expect(screen.getByRole('radio', { name: 'Live' }).closest('label')).toHaveClass('draw-mode-option')
    expect(screen.getByText('Official session. Confirmation is required before starting.')).toBeInTheDocument()
    expect(capacitySection).toContainElement(screen.getByRole('heading', { name: 'Draw is ready for handoff' }))
    expect(screen.getByRole('button', { name: 'Open Practice start gate' })).toBeInTheDocument()
  })

  it('defaults to Instant Reveal and keeps the pool and winner quantity workflow intact', async () => {
    renderPage(services())
    expect(await screen.findByRole('heading', { name: 'Reveal style' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Instant Reveal/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Random Number Roll/ })).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('group', { name: 'Roll duration' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Eligible pool summary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Winner quantity' })).toBeInTheDocument()
  })

  it('selects Random Number Roll and maps duration, speed, and reveal presets', async () => {
    const user = userEvent.setup()
    renderPage(services())
    await screen.findByRole('heading', { name: 'Reveal style' })
    await user.click(screen.getByRole('radio', { name: /Random Number Roll/ }))
    expect(screen.getByRole('radio', { name: /Random Number Roll/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: '5 sec' })).toHaveAttribute('aria-checked', 'false')
    await user.click(screen.getByRole('radio', { name: '5 sec' }))
    await user.click(screen.getByRole('radio', { name: /Smooth/ }))
    await user.click(screen.getByRole('radio', { name: 'Reveal Sequentially' }))
    expect(screen.getByRole('radio', { name: '5 sec' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Smooth/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Reveal Sequentially' })).toHaveAttribute('aria-checked', 'true')
  })

  it('persists the shared presentation configuration in Practice and does not alter winner quantity', async () => {
    const user = userEvent.setup()
    const save = vi.fn(async () => ({ ok: true as const, record }))
    renderPage(services({ save }))
    await screen.findByRole('heading', { name: 'Reveal style' })
    await user.click(screen.getByRole('radio', { name: /Random Number Roll/ }))
    await user.click(screen.getByRole('radio', { name: '12 sec' }))
    await user.click(screen.getByRole('radio', { name: /Rapid/ }))
    await user.click(screen.getByRole('radio', { name: 'Reveal Together' }))
    expect(screen.getByRole('radio', { name: 'Practice' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ requestedWinners: '1', mode: 'practice', presentation: { presentationMode: 'random-number-roll', rollDurationSeconds: 12, rollSpeedPerSecond: 20, revealMode: 'all-together' } }))
  })

  it('hides roll controls when switching back to Instant Reveal while preserving their draft values', async () => {
    const user = userEvent.setup()
    const save = vi.fn(async () => ({ ok: true as const, record }))
    renderPage(services({ save }))
    await screen.findByRole('heading', { name: 'Reveal style' })
    await user.click(screen.getByRole('radio', { name: /Random Number Roll/ }))
    await user.click(screen.getByRole('radio', { name: '5 sec' }))
    await user.click(screen.getByRole('radio', { name: /Rapid/ }))
    await user.click(screen.getByRole('radio', { name: /Instant Reveal/ }))
    expect(screen.queryByRole('radio', { name: '5 sec' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ presentation: { presentationMode: 'instant-reveal', rollDurationSeconds: 5, rollSpeedPerSecond: 20, revealMode: 'all-together' } }))
  })

  it('does not claim authoritative readiness while dirty and blocks handoff', async () => {
    const user = userEvent.setup()
    renderPage(services())
    await screen.findByLabelText('Custom winner count')
    await user.clear(screen.getByLabelText('Custom winner count'))
    await user.type(screen.getByLabelText('Custom winner count'), '2')
    expect(screen.getByText('Save changes to evaluate eligibility and readiness.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Practice start gate' })).toBeDisabled()
    expect(screen.getAllByText('—')).toHaveLength(5)
  })

  it('refreshes readiness after save and preserves Live conflict blocking', async () => {
    const user = userEvent.setup()
    const value = services({ conflictAfterSave: 'pending-confirmation' })
    renderPage(value)
    await screen.findByLabelText('Custom winner count')
    await user.click(screen.getByRole('button', { name: '6' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('heading', { name: 'Another Live session must be resolved' })).toBeInTheDocument()
    expect(screen.getByText(/Eligibility was not evaluated because an active or pending Live session/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Practice start gate' })).toBeDisabled()
  })

  it('keeps started sessions immutable and preserves Live distinction', async () => {
    const startedRecord = { ...record, session: { ...session, status: 'drawing' as const } } as unknown as DrawAuthoringRecord
    renderPage(services({ record: startedRecord }))
    expect(await screen.findByRole('heading', { name: 'This DrawSession is not editable' })).toBeInTheDocument()
    expect(screen.getByLabelText('Custom winner count')).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Live' })).toBeDisabled()
  })
})
