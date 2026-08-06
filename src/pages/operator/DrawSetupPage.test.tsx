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
    await screen.findByRole('button', { name: '6' })
    await user.click(screen.getByRole('button', { name: '6' }))
    expect(screen.getByRole('button', { name: '6' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Custom winner count')).toHaveValue(6)
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
    expect(await screen.findByText('Total participants')).toBeInTheDocument()
    expect(screen.getByText('Checked-in participants')).toBeInTheDocument()
    expect(screen.getByText('Previous winners excluded')).toBeInTheDocument()
    expect(screen.getAllByText('Eligible pool')).toHaveLength(2)
    expect(screen.getByText('Requested winners')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Winner quantity' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Eligibility rules' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'How many winners?' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Who can win?' })).not.toBeInTheDocument()
    expect(screen.getByText('Choose a preset or enter 1–100. Save to recalculate readiness.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Draw is ready for handoff' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Practice start gate' })).toBeInTheDocument()
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
