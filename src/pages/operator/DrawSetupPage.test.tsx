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
const configuration = { id: 'configuration-1', eventId: event.id, prizeCategoryId: category.id, requestedWinners: 1, winningRule: 'once-per-event', requireCheckIn: true, eligibleGroupFilter: null, createdAt: event.createdAt, updatedAt: event.updatedAt } as const
const session = { id: 'session-1', eventId: event.id, configurationId: configuration.id, mode: 'practice', status: 'ready', configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: event.createdAt, updatedAt: event.updatedAt } as const
const record = { event, category, configuration, session, eligibleCount: 4 } as unknown as DrawAuthoringRecord

function services(overrides: { record?: DrawAuthoringRecord | null; event?: typeof event | null; save?: DrawSetupProductionServices['authoringService'] extends infer S ? S extends { save: (...args: never[]) => unknown } ? S['save'] : never : never; conflict?: 'drawing' | 'pending-confirmation'; conflictAfterSave?: 'drawing' | 'pending-confirmation' } = {}) {
  const current = overrides.record === undefined ? record : overrides.record
  const load = vi.fn(async () => ({ ok: true as const, event: overrides.event === undefined ? event : overrides.event, categories: [category], record: current }))
  let activeConflict = overrides.conflict
  const save = overrides.save ?? vi.fn(async () => { activeConflict = overrides.conflictAfterSave; return { ok: true as const, record: current ?? record } })
  const participant = { id: 'participant-1', eventId: event.id, ticketNumber: '00042', isCheckedIn: true, createdAt: event.createdAt, updatedAt: event.updatedAt }
  return { open: vi.fn(async () => undefined), checkStorage: vi.fn(async () => ({ ok: true as const })), checkCrypto: vi.fn(async () => ({ ok: true as const })), preferences: { get: vi.fn(async () => event.id) }, events: { findById: vi.fn(async () => event) }, configurations: { findById: vi.fn(async () => configuration) }, categories: { findById: vi.fn(async () => category) }, sessions: { findById: vi.fn(async () => session), findByEventId: vi.fn(async () => activeConflict === undefined ? [session] : [session, { ...session, id: 'live-conflict', mode: 'live' as const, status: activeConflict }]) }, participants: { countByEventId: vi.fn(async () => 1), findByEventId: vi.fn(async () => [participant]) }, winners: { findByEventId: vi.fn(async () => []) }, authoringService: { load, save }, } as unknown as DrawSetupProductionServices
}

function renderPage(value: DrawSetupProductionServices) { return render(<MemoryRouter><DrawSetupPage services={value} /></MemoryRouter>) }

describe('Draw Setup persisted authoring', () => {
  it('shows a safe empty Event state', async () => {
    renderPage(services({ event: null, record: null }))
    expect(await screen.findByText('Create or select an Event first')).toBeInTheDocument()
    expect(screen.queryByText('Electric Vehicle')).not.toBeInTheDocument()
  })

  it('loads persisted values and saves without duplicate submission', async () => {
    const user = userEvent.setup()
    const save = vi.fn(async () => ({ ok: true as const, record }))
    renderPage(services({ save }))
    expect(await screen.findByDisplayValue('1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Electric Vehicle')).toHaveAttribute('readonly')
    await user.clear(screen.getByLabelText('Winner count'))
    await user.type(screen.getByLabelText('Winner count'), '6')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('distinguishes Practice and Live textually and preserves validation errors', async () => {
    const user = userEvent.setup()
    const save = vi.fn(async () => ({ ok: false as const, error: new DrawAuthoringError('invalid-winner-count', 'Winner count must be an integer from 1 through 100.') }))
    renderPage(services({ save }))
    await screen.findByText('Prize name')
    await user.click(screen.getByRole('radio', { name: 'Live' }))
    expect(screen.getByText(/Mode is stored on the ready DrawSession/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/Winner count must be an integer/i)).toBeInTheDocument()
  })

  it('renders mode options and readiness as separate accessible items', async () => {
    renderPage(services())
    expect(await screen.findByRole('radio', { name: 'Practice' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Live' })).toBeInTheDocument()
    expect(screen.getByText('Rehearsal only. No official result is created.')).toBeInTheDocument()
    expect(screen.getByText('Official session. Result becomes pending after the start gate.')).toBeInTheDocument()
    expect(screen.getByText('Eligible participants')).toBeInTheDocument()
    expect(screen.getByText('Requested winners')).toBeInTheDocument()
    expect(screen.getByText('Storage')).toBeInTheDocument()
    expect(screen.getByText('Secure Web Crypto')).toBeInTheDocument()
    expect(screen.getAllByText('1', { selector: 'dd' })).toHaveLength(2)
    expect(screen.getAllByText('Ready', { selector: 'dd' })).toHaveLength(2)
  })

  it('marks a dirty form as needing save without evaluating draft state', async () => {
    const user = userEvent.setup()
    renderPage(services())
    await screen.findByRole('radio', { name: 'Practice' })
    await user.clear(screen.getByLabelText('Winner count'))
    await user.type(screen.getByLabelText('Winner count'), '2')
    expect(screen.getByText('Save changes to evaluate', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.queryByText('Checking…')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Practice start gate' })).toBeDisabled()
  })

  it('refreshes readiness after one successful save and reflects a conflict', async () => {
    const user = userEvent.setup()
    const value = services({ conflictAfterSave: 'pending-confirmation' })
    renderPage(value)
    await screen.findByRole('radio', { name: 'Practice' })
    await user.clear(screen.getByLabelText('Winner count'))
    await user.type(screen.getByLabelText('Winner count'), '2')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Not evaluated', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.queryByText('Save changes to evaluate')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Draw handoff is blocked' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Practice start gate' })).toBeDisabled()
    expect((value as unknown as { checkStorage: { mock: { calls: unknown[][] } } }).checkStorage.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it.each(['pending-confirmation', 'drawing'] as const)('%s conflict resolves every readiness row', async (conflict) => {
    renderPage(services({ conflict }))
    expect(await screen.findByRole('heading', { name: 'Draw handoff is blocked' })).toBeInTheDocument()
    expect(screen.getByText(/Eligibility was not evaluated because an active or pending Live session/i)).toBeInTheDocument()
    expect(screen.queryByText('Checking…')).not.toBeInTheDocument()
    expect(screen.getByText('Not evaluated', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('Storage', { selector: 'dt' })).toBeInTheDocument()
    expect(screen.getAllByText('Ready', { selector: 'dd' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Open Practice start gate' })).toBeDisabled()
  })
})
