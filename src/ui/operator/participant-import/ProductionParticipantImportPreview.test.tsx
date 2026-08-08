import { render, screen, waitFor, within } from '@testing-library/react'
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
import { PrototypeParticipantsPage } from '../../../pages/operator/PrototypeParticipantsPage.tsx'
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

function makeServices(options: { event?: Event | null; initialRecords?: Participant[]; commit?: (input: ParticipantImportTransactionInput) => Promise<{ removedCount: number; unchangedCount: number }> } = {}) {
  let records: Participant[] = options.initialRecords?.slice() ?? []
  const services: ParticipantImportProductionServices = {
    database: { openSupported: vi.fn().mockResolvedValue(undefined) },
    preferences: { get: vi.fn().mockResolvedValue(options.event === undefined ? eventId : options.event?.id ?? null) },
    events: { findById: vi.fn().mockResolvedValue(options.event === undefined ? draftEvent : options.event) },
    participants: {
      countByEventId: vi.fn().mockImplementation(async (id: EventId) => id === eventId ? records.length : 0),
      findByEventId: vi.fn().mockImplementation(async (id: EventId) => id === eventId ? records.slice() : []),
    },
    getPersistedParticipantsForEvent: vi.fn().mockImplementation(async (id: EventId) => {
      const eventRecords = id === eventId ? records : []
      return { totalCount: eventRecords.length, records: eventRecords.slice() }
    }),
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

function renderProduction(services: ParticipantImportProductionServices, path = '/participants') {
  return render(<MemoryRouter initialEntries={[path]}><ParticipantsPage services={services} /></MemoryRouter>)
}

async function stageFile(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(['Ticket Number,Name\n00042,Ada\n,Invalid'], 'participants.csv', { type: 'text/csv' })
  await user.upload(screen.getByLabelText('Participant file'), file)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Validation diagnostics and summary' })).toBeInTheDocument())
}

async function chooseStrategyAndOpenConfirmation(user: ReturnType<typeof userEvent.setup>, strategy: 'Replace' | 'Merge' = 'Replace') {
  await user.click(screen.getByRole('radio', { name: strategy }))
  await user.click(screen.getByRole('button', { name: 'Review and confirm import' }))
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
}

describe('production participant import preview audit', () => {
  it.each(['/participants', '/participants?workflow=production-preview', '/participants?workflow=unknown', '/participants?workflow='])('promotes %s to the production workflow', (path) => {
    renderProduction(makeServices(), path)
    expect(screen.getByLabelText('Participant file')).toBeInTheDocument()
    expect(screen.queryByText('Fictional participant data for static interface review. No file or participant record is read, changed, or stored.')).not.toBeInTheDocument()
  })

  it('keeps the production route authoritative even when a prototype query is supplied', () => {
    renderProduction(makeServices(), '/participants?workflow=prototype')
    expect(screen.getByRole('heading', { name: 'Participant Import' })).toBeVisible()
    expect(screen.queryByText(/Fictional participant data for static interface review/)).not.toBeInTheDocument()
  })

  it('renders the resolved Event and safe no-Event state without preview wording', async () => {
    const draftView = renderProduction(makeServices({ event: draftEvent }))
    expect((await screen.findAllByText('Draft Event')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Production Preview|Chrome|Edge|acceptance pending/i)).not.toBeInTheDocument()

    draftView.unmount()
    const noEvent = makeServices({ event: null })
    renderProduction(noEvent, '/participants?workflow=production-preview')
    expect(await screen.findByText('No current Event is selected. Select a real Event before importing participants.')).toBeVisible()
  })

  it('keeps validation current and confirmation disabled when all rows are invalid', async () => {
    const user = userEvent.setup()
    renderProduction(makeServices())
    await user.upload(screen.getByLabelText('Participant file'), new File(['Ticket Number\n\n'], 'invalid.csv', { type: 'text/csv' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Validation diagnostics and summary' })).toBeInTheDocument())
    const progress = screen.getByRole('navigation', { name: 'Participant Import progress' })
    expect(within(progress).getByText('Validate Data').closest('li')).toHaveAttribute('data-state', 'active')
    expect(within(progress).getByText('Confirm Import').closest('li')).toHaveAttribute('data-state', 'upcoming')
    expect(screen.getByRole('button', { name: 'Review and confirm import' })).toBeDisabled()
  })

  it('renders the integrated operator structure with observable semantics', async () => {
    renderProduction(makeServices())

    expect(await screen.findByRole('navigation', { name: 'Participant Import progress' })).toBeVisible()
    expect(screen.getByText('Upload File')).toBeVisible()
    expect(screen.getByText('Map Columns')).toBeVisible()
    expect(screen.getByText('Validate Data')).toBeVisible()
    expect(screen.getByText('Confirm Import')).toBeVisible()

    const eventRegion = await screen.findByRole('region', { name: 'Selected Event' })
    expect(within(eventRegion).getByText('Draft Event')).toBeVisible()
    const persistedRegion = screen.getByRole('region', { name: 'Persisted Participants' })
    expect(persistedRegion).toBeVisible()
    expect(screen.getByLabelText('Participant file')).toBeVisible()

    const user = userEvent.setup()
    await user.upload(screen.getByLabelText('Participant file'), new File(['Ticket Number,Name\n00042,Ada'], 'participants.csv', { type: 'text/csv' }))
    await waitFor(() => expect(screen.getByRole('table', { name: 'Parsed participant rows' })).toBeVisible())
    expect(screen.getByRole('table', { name: 'Parsed participant rows' })).toHaveTextContent('00042')
    expect(screen.getByRole('combobox', { name: /Ticket Number · Required/ })).toBeVisible()
    expect(screen.getByRole('combobox', { name: /Participant Name · Optional/ })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Replace' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Merge' })).not.toBeChecked()
  })

  it('resolves production-preview through the real draft Event boundary', async () => {
    const services = makeServices()
    renderProduction(services)
    expect(await screen.findByRole('heading', { name: 'Selected Event' })).toBeVisible()
    expect(services.preferences.get).toHaveBeenCalledWith('activeEventId')
    expect(services.events.findById).toHaveBeenCalledWith(eventId)
  })

  it('loads persisted verification independently on initial open and preserves exact tickets', async () => {
    const services = makeServices({ initialRecords: [
      { id: '1' as ParticipantId, eventId, ticketNumber: '00042' as never, isCheckedIn: false, createdAt: timestamp, updatedAt: timestamp },
      { id: '2' as ParticipantId, eventId, ticketNumber: '42' as never, isCheckedIn: false, createdAt: timestamp, updatedAt: timestamp },
    ] })
    renderProduction(services)
    expect(await screen.findByText('Total stored Participants: 2')).toBeVisible()
    expect(screen.getByText('00042')).toBeVisible()
    expect(screen.getByText('42')).toBeVisible()
    expect(services.getPersistedParticipantsForEvent).toHaveBeenCalledWith(eventId)
    expect(screen.queryByLabelText('Participant file')).toBeInTheDocument()
  })

  it('shows empty, bounded, and safe read-failure verification states', async () => {
    const empty = makeServices()
    const emptyView = renderProduction(empty)
    expect(await screen.findByText('No Participants are persisted for this Event.')).toBeVisible()
    emptyView.unmount()

    const many = Array.from({ length: 51 }, (_, index) => ({ id: `${index}` as ParticipantId, eventId, ticketNumber: `${index}` as never, isCheckedIn: false, createdAt: timestamp, updatedAt: timestamp }))
    const bounded = makeServices({ initialRecords: many })
    const boundedView = renderProduction(bounded)
    expect(await screen.findByText('51 participants · 0 checked in')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    expect(screen.queryByText('Preview truncated to 50 Participants.')).not.toBeInTheDocument()
    expect(screen.getByText('Total stored Participants: 51')).toBeVisible()
    boundedView.unmount()

    const failed = makeServices()
    vi.mocked(failed.getPersistedParticipantsForEvent).mockRejectedValue(new Error('SECRET_DATABASE_DETAIL'))
    renderProduction(failed)
    const alert = await screen.findByText(/Persisted Participants could not be read safely/)
    expect(alert).not.toHaveTextContent('SECRET_DATABASE_DETAIL')
  })

  it('paginates the complete persisted dataset without changing ticket strings or order', async () => {
    const user = userEvent.setup()
    const records = Array.from({ length: 100 }, (_, index) => ({ id: `${index}` as ParticipantId, eventId, ticketNumber: String(index).padStart(5, '0') as never, isCheckedIn: true, createdAt: timestamp, updatedAt: timestamp }))
    renderProduction(makeServices({ initialRecords: records }))
    const table = await screen.findByRole('table', { name: 'Persisted Participants' })
    expect(table).toHaveTextContent('00000')
    expect(table).toHaveTextContent('00009')
    expect(table).not.toHaveTextContent('00010')
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(table).toHaveTextContent('00010')
    expect(table).not.toHaveTextContent('00000')
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50')
    expect(table).toHaveTextContent('00000')
    expect(table).toHaveTextContent('00049')
    expect(table).not.toHaveTextContent('00050')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '100')
    expect(table).toHaveTextContent('00099')
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByText('100 participants · 100 checked in')).toBeVisible()
  })

  it('reloads persisted verification when the active Event changes', async () => {
    const secondEventId = '22222222-2222-4222-8222-222222222222' as EventId
    const secondEvent: Event = { ...draftEvent, id: secondEventId, name: 'Second Draft Event' }
    const services = makeServices({ initialRecords: [{ id: '1' as ParticipantId, eventId, ticketNumber: '00042' as never, isCheckedIn: false, createdAt: timestamp, updatedAt: timestamp }] })
    vi.mocked(services.preferences.get)
      .mockResolvedValueOnce(eventId)
      .mockResolvedValueOnce(secondEventId)
    vi.mocked(services.events.findById).mockImplementation(async (id) => id === eventId ? draftEvent : secondEvent)
    vi.mocked(services.getPersistedParticipantsForEvent).mockImplementation(async (id) => id === eventId
      ? { totalCount: 1, records: [{ id: '1' as ParticipantId, eventId, ticketNumber: '00042' as never, isCheckedIn: false, createdAt: timestamp, updatedAt: timestamp }] }
      : { totalCount: 1, records: [{ id: '2' as ParticipantId, eventId: secondEventId, ticketNumber: '00700' as never, isCheckedIn: false, createdAt: timestamp, updatedAt: timestamp }] })
    renderProduction(services)
    expect(await screen.findByText('00042')).toBeVisible()
    window.dispatchEvent(new Event('focus'))
    expect(await screen.findByRole('heading', { name: 'Selected Event' })).toBeVisible()
    expect(await screen.findByText('00700')).toBeVisible()
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
    expect(screen.getByLabelText('Participant file')).toBeDisabled()
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
    const user = userEvent.setup(); const replace = makeServices(); const replaceView = renderProduction(replace); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Replace'); await user.click(screen.getByLabelText(/I understand/)); await user.click(screen.getByRole('button', { name: 'Confirm Replace' }))
    expect(await screen.findByText(/Inserted: 1 · Removed\/replaced: 2 · Unchanged: 0/)).toBeVisible()

    expect(replace.getPersistedParticipantsForEvent).toHaveBeenCalled()
    replaceView.unmount()
    const merge = makeServices(); renderProduction(merge); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Merge'); await user.click(screen.getByRole('button', { name: 'Confirm atomic Merge' }))
    expect(await screen.findByText(/Inserted: 1 · Removed\/replaced: 0 · Unchanged: 2/)).toBeVisible()
    expect(screen.getByText('Total stored Participants: 1')).toBeVisible()
    expect(screen.getAllByText('00042').length).toBeGreaterThan(0)
    expect(merge.getPersistedParticipantsForEvent).toHaveBeenCalled()
  })

  it('does not restore File, mapping, strategy, or confirmation state after remount', async () => {
    const user = userEvent.setup(); const services = makeServices(); const view = renderProduction(services)
    await stageFile(user)
    await user.click(screen.getByRole('radio', { name: 'Merge' }))
    await user.click(screen.getByRole('button', { name: 'Review and confirm import' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    view.unmount()
    renderProduction(services)
    await screen.findByText('No Participants are persisted for this Event.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Validation diagnostics and summary' })).not.toBeInTheDocument()
    expect(screen.queryByText('participants.csv')).not.toBeInTheDocument()
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
    await user.upload(screen.getByLabelText('Participant file'), new File(['Ticket Number,Name\n00099,Bob'], 'new.csv', { type: 'text/csv' }))
    expect(screen.queryByRole('heading', { name: 'Participant import complete' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Participant Name/ })).toBeInTheDocument())
    await user.selectOptions(screen.getByRole('combobox', { name: /Participant Name/ }), '')
    expect(screen.queryByRole('heading', { name: 'Participant import complete' })).not.toBeInTheDocument()
  })

  it('keeps the explicit prototype route and Audience routes private', () => {
    const prototypeView = render(<MemoryRouter initialEntries={['/dev/prototypes/participants?workflow=prototype']}><PrototypeParticipantsPage /></MemoryRouter>)
    expect(screen.getByText(/Fictional participant data/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Browse file' })).toBeInTheDocument()

    prototypeView.unmount()
    const audienceRouter = createMemoryRouter(appRoutes, { initialEntries: ['/display?workflow=production-preview&ticketNumber=00042'] })
    render(<RouterProvider router={audienceRouter} />)
    expect(screen.queryByLabelText('Participant file')).not.toBeInTheDocument()
    expect(screen.queryByText('00042')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Participant Import' })).not.toBeInTheDocument()
  })
})
