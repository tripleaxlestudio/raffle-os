import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Event } from '../../../domain/events/event.types.ts'
import type { Participant } from '../../../domain/participants/participant.types.ts'
import type { EventId, ParticipantId } from '../../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type { ParticipantImportTransactionInput } from '../../../application/persistence/participant-import-unit-of-work.interface.ts'
import type { ParticipantImportProductionServices } from '../../../application/participant-import/participant-import-production-services.ts'
import { ParticipantsPage } from '../../../pages/operator/ParticipantsPage.tsx'
import { appRoutes } from '../../../app/router.tsx'

const eventId = '11111111-1111-4111-8111-111111111111' as EventId
const timestamp = '2026-08-04T10:00:00.000Z' as IsoTimestamp

const draftEvent: Event = { id: eventId, name: 'Draft Event', status: 'draft', createdAt: timestamp, updatedAt: timestamp }
const immutableEvent: Event = { ...draftEvent, name: 'Live Event', status: 'live' }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise })
  return { promise, resolve, reject }
}

function makeServices(options: { event?: Event | null; commit?: (input: ParticipantImportTransactionInput) => Promise<{ removedCount: number; unchangedCount: number }> } = {}) {
  let records: Participant[] = []
  const services: ParticipantImportProductionServices = {
    database: { openSupported: vi.fn().mockResolvedValue(undefined) },
    preferences: { get: vi.fn().mockResolvedValue(options.event === undefined ? eventId : options.event?.id ?? null) },
    events: { findById: vi.fn().mockResolvedValue(options.event === undefined ? draftEvent : options.event) },
    participants: {
      countByEventId: vi.fn().mockImplementation(async (id: EventId) => id === eventId ? records.length : 0),
      findByEventId: vi.fn().mockImplementation(async (id: EventId) => id === eventId ? records.slice() : []),
    },
    unitOfWork: { commitParticipantImport: vi.fn().mockImplementation(async (input: ParticipantImportTransactionInput) => {
      if (options.commit) return options.commit(input)
      records = input.participants.slice() as Participant[]
      return { removedCount: input.strategy === 'replace' ? 2 : 0, unchangedCount: input.strategy === 'merge' ? 2 : 0 }
    }) },
    createParticipantId: () => `44444444-4444-4444-8444-444444444444` as ParticipantId,
    createAuditRecordId: () => '55555555-5555-4555-8555-555555555555' as never,
    createOperationId: () => 'operation-1',
    now: () => timestamp,
  }
  return services
}

function renderProduction(services: ParticipantImportProductionServices, path = '/participants?workflow=production-preview') {
  return render(<MemoryRouter initialEntries={[path]}><ParticipantsPage services={services} /></MemoryRouter>)
}

async function stageFile(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(['Ticket Number,Name\n00042,Ada\n,Invalid'], 'participants.csv', { type: 'text/csv' })
  await user.upload(screen.getByLabelText('Choose participant file'), file)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Validation diagnostics and summary' })).toBeInTheDocument())
}

async function chooseStrategyAndOpenConfirmation(user: ReturnType<typeof userEvent.setup>, strategy: 'Replace' | 'Merge' = 'Replace') {
  await user.click(screen.getByRole('radio', { name: strategy }))
  await user.click(screen.getByRole('button', { name: 'Review and confirm import' }))
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
}

describe('production participant import preview audit', () => {
  it('resolves production-preview through the real draft Event boundary', async () => {
    const services = makeServices()
    renderProduction(services)
    expect(await screen.findByText('Draft Event')).toBeVisible()
    expect(services.preferences.get).toHaveBeenCalledWith('activeEventId')
    expect(services.events.findById).toHaveBeenCalledWith(eventId)
  })

  it('blocks when no Event is selected and blocks immutable Events', async () => {
    renderProduction(makeServices({ event: null }))
    expect(await screen.findByText(/No current Event|could not be found/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Review and confirm import' })).not.toBeInTheDocument()

    renderProduction(makeServices({ event: immutableEvent }))
    expect(await screen.findByText(/does not permit participant import|immutable Event/)).toBeVisible()
  })

  it('requires explicit Replace or Merge selection and confirmation', async () => {
    const user = userEvent.setup(); const services = makeServices(); renderProduction(services); await stageFile(user)
    expect(screen.getByRole('button', { name: 'Review and confirm import' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'Replace' }))
    expect(screen.getByRole('button', { name: 'Review and confirm import' })).not.toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Review and confirm import' }))
    expect(screen.getByRole('button', { name: 'Confirm Replace' })).toBeDisabled()
    expect(services.unitOfWork.commitParticipantImport).not.toHaveBeenCalled()
  })

  it('passes only valid drafts, exact Event ID, exact mapping, and exact ticket strings', async () => {
    const user = userEvent.setup(); const services = makeServices(); renderProduction(services); await stageFile(user)
    await chooseStrategyAndOpenConfirmation(user, 'Merge')
    await user.click(screen.getByRole('button', { name: 'Confirm atomic Merge' }))
    await waitFor(() => expect(services.unitOfWork.commitParticipantImport).toHaveBeenCalledTimes(1))
    const input = vi.mocked(services.unitOfWork.commitParticipantImport).mock.calls[0]?.[0]
    expect(input).toMatchObject({ eventId, strategy: 'merge', auditRecord: { detail: { mapping: { ticketNumber: 'Ticket Number' } } } })
    expect(input?.participants).toHaveLength(1)
    expect(input?.participants[0]?.ticketNumber).toBe('00042')
  })

  it('prevents double submission and disables controls while committing', async () => {
    const pending = deferred<{ removedCount: number; unchangedCount: number }>(); const user = userEvent.setup()
    const services = makeServices({ commit: () => pending.promise }); renderProduction(services); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Merge')
    const confirm = screen.getByRole('button', { name: 'Confirm atomic Merge' })
    await user.click(confirm); await user.click(confirm)
    expect(services.unitOfWork.commitParticipantImport).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Choose participant file')).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Merge' })).toBeDisabled()
    pending.resolve({ removedCount: 0, unchangedCount: 0 })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Participant import complete' })).toBeInTheDocument())
  })

  it('does not show success while the commit promise is pending', async () => {
    const pending = deferred<{ removedCount: number; unchangedCount: number }>(); const user = userEvent.setup()
    renderProduction(makeServices({ commit: () => pending.promise })); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Merge'); await user.click(screen.getByRole('button', { name: 'Confirm atomic Merge' }))
    expect(screen.queryByRole('heading', { name: 'Participant import complete' })).not.toBeInTheDocument()
    pending.resolve({ removedCount: 0, unchangedCount: 0 })
  })

  it('renders Replace counts, Merge counts, and bounded persisted verification', async () => {
    const user = userEvent.setup(); const replace = makeServices(); renderProduction(replace); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Replace'); await user.click(screen.getByLabelText(/I understand/)); await user.click(screen.getByRole('button', { name: 'Confirm Replace' }))
    expect(await screen.findByText(/Inserted: 1 · Removed\/replaced: 2 · Unchanged: 0/)).toBeVisible()

    const merge = makeServices(); renderProduction(merge); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Merge'); await user.click(screen.getByRole('button', { name: 'Confirm atomic Merge' }))
    expect(await screen.findByText(/Inserted: 1 · Removed\/replaced: 0 · Unchanged: 2/)).toBeVisible()
    expect(screen.getByText('Persisted Participants: 1')).toBeVisible()
    expect(screen.getAllByText('00042').length).toBeGreaterThan(0)
  })

  it.each([
    ['existing-ticket-conflict', { code: 'duplicate-record', message: '00042 already exists in this Event' }],
    ['transaction failure', { code: 'unknown', stack: 'SECRET_STACK' }],
  ])('renders safe %s text without raw persistence details', async (_label, error) => {
    const user = userEvent.setup(); const services = makeServices({ commit: () => Promise.reject(error) }); renderProduction(services); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Merge'); await user.click(screen.getByRole('button', { name: 'Confirm atomic Merge' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/No records changed|rolled back|rejected/)
    expect(alert).not.toHaveTextContent('SECRET_STACK')
    expect(alert).not.toHaveTextContent('already exists in this Event')
  })

  it('keeps the staged validation result available for retry', async () => {
    const user = userEvent.setup(); const services = makeServices({ commit: () => Promise.reject({ code: 'transaction-failed', stack: 'SECRET' }) }); renderProduction(services); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Merge'); await user.click(screen.getByRole('button', { name: 'Confirm atomic Merge' }))
    await user.click(await screen.findByRole('button', { name: 'Retry review' }))
    expect(screen.getByRole('heading', { name: 'Validation diagnostics and summary' })).toBeInTheDocument()
    expect(screen.getByText(/Valid drafts: 1/)).toBeVisible()
  })

  it('clears success when a new file or mapping is selected', async () => {
    const user = userEvent.setup(); const services = makeServices(); renderProduction(services); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Merge'); await user.click(screen.getByRole('button', { name: 'Confirm atomic Merge' })); await screen.findByRole('heading', { name: 'Participant import complete' })
    await user.upload(screen.getByLabelText('Choose participant file'), new File(['Ticket Number,Name\n00099,Bob'], 'new.csv', { type: 'text/csv' }))
    expect(screen.queryByRole('heading', { name: 'Participant import complete' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Participant Name/ })).toBeInTheDocument())
    await user.selectOptions(screen.getByRole('combobox', { name: /Participant Name/ }), '')
    expect(screen.queryByRole('heading', { name: 'Participant import complete' })).not.toBeInTheDocument()
  })

  it('keeps the default route prototype and Audience routes private', () => {
    const services = makeServices(); const prototypeView = render(<MemoryRouter initialEntries={['/participants']}><ParticipantsPage services={services} /></MemoryRouter>)
    expect(screen.getByText(/Fictional participant data/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Browse file' })).toBeInTheDocument()

    prototypeView.unmount()
    const audienceRouter = createMemoryRouter(appRoutes, { initialEntries: ['/display?workflow=production-preview&ticketNumber=00042'] })
    render(<RouterProvider router={audienceRouter} />)
    expect(screen.queryByLabelText('Choose participant file')).not.toBeInTheDocument()
    expect(screen.queryByText('00042')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Participant Import' })).not.toBeInTheDocument()
  })
})
