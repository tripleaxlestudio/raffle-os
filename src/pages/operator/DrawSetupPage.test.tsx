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

function services(overrides: { record?: DrawAuthoringRecord | null; event?: typeof event | null; save?: DrawSetupProductionServices['authoringService'] extends infer S ? S extends { save: (...args: never[]) => unknown } ? S['save'] : never : never } = {}) {
  const current = overrides.record === undefined ? record : overrides.record
  const load = vi.fn(async () => ({ ok: true as const, event: overrides.event === undefined ? event : overrides.event, categories: [category], record: current }))
  const save = overrides.save ?? vi.fn(async () => ({ ok: true as const, record: current ?? record }))
  return { open: vi.fn(async () => undefined), preferences: { get: vi.fn(async () => event.id) }, authoringService: { load, save }, } as unknown as DrawSetupProductionServices
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
    await user.click(screen.getByLabelText(/Live — official/))
    expect(screen.getByText(/Mode is stored on the ready DrawSession/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/Winner count must be an integer/i)).toBeInTheDocument()
  })
})
