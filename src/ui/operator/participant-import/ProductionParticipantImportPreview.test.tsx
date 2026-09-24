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
  await user.upload(screen.getByLabelText('File Peserta'), file)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Diagnostik dan ringkasan validasi' })).toBeInTheDocument())
}

async function chooseStrategyAndOpenConfirmation(user: ReturnType<typeof userEvent.setup>, strategy: 'Ganti' | 'Gabung' = 'Ganti') {
  await user.click(screen.getByRole('radio', { name: strategy }))
  await user.click(screen.getByRole('button', { name: 'Tinjau dan konfirmasi impor' }))
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
}

describe('production participant import preview audit', () => {
  it.each(['/participants', '/participants?workflow=production-preview', '/participants?workflow=unknown', '/participants?workflow='])('promotes %s to the production workflow', (path) => {
    renderProduction(makeServices(), path)
    expect(screen.getByLabelText('File Peserta')).toBeInTheDocument()
    expect(screen.queryByText('Fictional participant data for static interface review. No file or participant record is read, changed, or stored.')).not.toBeInTheDocument()
  })

  it('keeps the production route authoritative even when a prototype query is supplied', () => {
    renderProduction(makeServices(), '/participants?workflow=prototype')
    expect(screen.getByRole('heading', { name: 'Impor Peserta' })).toBeVisible()
    expect(screen.queryByText(/Fictional participant data for static interface review/)).not.toBeInTheDocument()
  })

  it('renders the resolved Event and safe no-Event state without preview wording', async () => {
    const draftView = renderProduction(makeServices({ event: draftEvent }))
    expect((await screen.findAllByText('Draft Event')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Production Preview|Chrome|Edge|acceptance pending/i)).not.toBeInTheDocument()

    draftView.unmount()
    const noEvent = makeServices({ event: null })
    renderProduction(noEvent, '/participants?workflow=production-preview')
    expect(await screen.findByRole('heading', { name: 'Acara diperlukan untuk impor Peserta' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Buka Pengelolaan Acara' })).toHaveAttribute('href', '/events')
  })

  it('keeps validation current and confirmation disabled when all rows are invalid', async () => {
    const user = userEvent.setup()
    renderProduction(makeServices())
    await user.upload(screen.getByLabelText('File Peserta'), new File(['Ticket Number\n\n'], 'invalid.csv', { type: 'text/csv' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Diagnostik dan ringkasan validasi' })).toBeInTheDocument())
    const progress = screen.getByRole('navigation', { name: 'Progres Impor Peserta' })
    expect(within(progress).getByText('Validasi Data').closest('li')).toHaveAttribute('data-state', 'active')
    expect(within(progress).getByText('Konfirmasi Impor').closest('li')).toHaveAttribute('data-state', 'upcoming')
    expect(screen.getByRole('button', { name: 'Tinjau dan konfirmasi impor' })).toBeDisabled()
  })

  it('renders the integrated operator structure with observable semantics', async () => {
    renderProduction(makeServices())

    expect(await screen.findByRole('navigation', { name: 'Progres Impor Peserta' })).toBeVisible()
    expect(screen.getByText('Unggah File')).toBeVisible()
    expect(screen.getByText('Petakan Kolom')).toBeVisible()
    expect(screen.getByText('Validasi Data')).toBeVisible()
    expect(screen.getByText('Konfirmasi Impor')).toBeVisible()

    const eventRegion = await screen.findByRole('region', { name: 'Acara yang Dipilih' })
    expect(within(eventRegion).getByText('Draft Event')).toBeVisible()
    const persistedRegion = screen.getByRole('region', { name: 'Peserta Tersimpan' })
    expect(persistedRegion).toBeVisible()
    expect(screen.getByLabelText('File Peserta')).toBeVisible()

    const user = userEvent.setup()
    await user.upload(screen.getByLabelText('File Peserta'), new File(['Ticket Number,Name\n00042,Ada'], 'participants.csv', { type: 'text/csv' }))
    await waitFor(() => expect(screen.getByRole('table', { name: 'Baris Peserta hasil pembacaan' })).toBeVisible())
    expect(screen.getByRole('table', { name: 'Baris Peserta hasil pembacaan' })).toHaveTextContent('00042')
    expect(screen.getByRole('combobox', { name: /Nomor Tiket · Wajib/ })).toBeVisible()
    expect(screen.getByRole('combobox', { name: /Nama Peserta · Opsional/ })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Ganti' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Gabung' })).not.toBeChecked()
  })

  it('resolves production-preview through the real draft Event boundary', async () => {
    const services = makeServices()
    renderProduction(services)
    expect(await screen.findByRole('heading', { name: 'Acara yang Dipilih' })).toBeVisible()
    expect(services.preferences.get).toHaveBeenCalledWith('activeEventId')
    expect(services.events.findById).toHaveBeenCalledWith(eventId)
  })

  it('loads persisted verification independently on initial open and preserves exact tickets', async () => {
    const services = makeServices({ initialRecords: [
      { id: '1' as ParticipantId, eventId, ticketNumber: '00042' as never, isCheckedIn: false, createdAt: timestamp, updatedAt: timestamp },
      { id: '2' as ParticipantId, eventId, ticketNumber: '42' as never, isCheckedIn: false, createdAt: timestamp, updatedAt: timestamp },
    ] })
    renderProduction(services)
    expect(await screen.findByText('Total Peserta tersimpan: 2')).toBeVisible()
    expect(screen.getByText('00042')).toBeVisible()
    expect(screen.getByText('42')).toBeVisible()
    expect(services.getPersistedParticipantsForEvent).toHaveBeenCalledWith(eventId)
    expect(screen.queryByLabelText('File Peserta')).toBeInTheDocument()
  })

  it('shows empty, bounded, and safe read-failure verification states', async () => {
    const empty = makeServices()
    const emptyView = renderProduction(empty)
    expect(await screen.findByText('Belum ada Peserta yang tersimpan untuk Acara ini.')).toBeVisible()
    emptyView.unmount()

    const many = Array.from({ length: 51 }, (_, index) => ({ id: `${index}` as ParticipantId, eventId, ticketNumber: `${index}` as never, isCheckedIn: false, createdAt: timestamp, updatedAt: timestamp }))
    const bounded = makeServices({ initialRecords: many })
    const boundedView = renderProduction(bounded)
    expect(await screen.findByText('51 peserta · 0 sudah check-in')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Berikutnya' })).toBeEnabled()
    expect(screen.queryByText('Preview truncated to 50 Participants.')).not.toBeInTheDocument()
    expect(screen.getByText('Total Peserta tersimpan: 51')).toBeVisible()
    boundedView.unmount()

    const failed = makeServices()
    vi.mocked(failed.getPersistedParticipantsForEvent).mockRejectedValue(new Error('SECRET_DATABASE_DETAIL'))
    renderProduction(failed)
    const alert = await screen.findByText(/Peserta tersimpan tidak dapat dibaca dengan aman/)
    expect(alert).not.toHaveTextContent('SECRET_DATABASE_DETAIL')
  })

  it('paginates the complete persisted dataset without changing ticket strings or order', async () => {
    const user = userEvent.setup()
    const records = Array.from({ length: 100 }, (_, index) => ({ id: `${index}` as ParticipantId, eventId, ticketNumber: String(index).padStart(5, '0') as never, isCheckedIn: true, createdAt: timestamp, updatedAt: timestamp }))
    renderProduction(makeServices({ initialRecords: records }))
    const table = await screen.findByRole('table', { name: 'Peserta tersimpan' })
    expect(table).toHaveTextContent('00000')
    expect(table).toHaveTextContent('00009')
    expect(table).not.toHaveTextContent('00010')
    expect(screen.getByRole('button', { name: 'Sebelumnya' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Berikutnya' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Berikutnya' }))
    expect(table).toHaveTextContent('00010')
    expect(table).not.toHaveTextContent('00000')
    expect(screen.getByRole('button', { name: 'Sebelumnya' })).toBeEnabled()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Baris per halaman' }), '50')
    expect(table).toHaveTextContent('00000')
    expect(table).toHaveTextContent('00049')
    expect(table).not.toHaveTextContent('00050')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Baris per halaman' }), '100')
    expect(table).toHaveTextContent('00099')
    expect(screen.getByRole('button', { name: 'Sebelumnya' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Berikutnya' })).toBeDisabled()
    expect(screen.getByText('100 peserta · 100 sudah check-in')).toBeVisible()
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
    expect(await screen.findByRole('heading', { name: 'Acara yang Dipilih' })).toBeVisible()
    expect(await screen.findByText('00700')).toBeVisible()
  })

  it('blocks when no Event is selected and blocks immutable Events', async () => {
    renderProduction(makeServices({ event: null }))
    expect(await screen.findByRole('heading', { name: 'Acara diperlukan untuk impor Peserta' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Tinjau dan konfirmasi impor' })).not.toBeInTheDocument()

    renderProduction(makeServices({ event: immutableEvent }))
    expect(await screen.findByText(/tidak mengizinkan impor Peserta|tidak dapat diubah/)).toBeVisible()
  })

  it('requires explicit Replace or Merge selection and confirmation', async () => {
    const user = userEvent.setup(); const services = makeServices(); renderProduction(services); await stageFile(user)
    expect(screen.getByRole('button', { name: 'Tinjau dan konfirmasi impor' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'Ganti' }))
    expect(screen.getByRole('button', { name: 'Tinjau dan konfirmasi impor' })).not.toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Tinjau dan konfirmasi impor' }))
    expect(screen.getByRole('button', { name: 'Batal' })).toHaveClass('ui-button--secondary')
    expect(screen.getByRole('button', { name: 'Konfirmasi Ganti' })).toHaveClass('ui-button--primary')
    expect(screen.getByRole('button', { name: 'Konfirmasi Ganti' })).toBeDisabled()
    expect(services.unitOfWork.commitParticipantImport).not.toHaveBeenCalled()
  })

  it('passes only valid drafts, exact Event ID, exact mapping, and exact ticket strings', async () => {
    const user = userEvent.setup(); const services = makeServices(); renderProduction(services); await stageFile(user)
    await chooseStrategyAndOpenConfirmation(user, 'Gabung')
    await user.click(screen.getByRole('button', { name: 'Konfirmasi Gabung atomik' }))
    await waitFor(() => expect(services.unitOfWork.commitParticipantImport).toHaveBeenCalledTimes(1))
    const input = vi.mocked(services.unitOfWork.commitParticipantImport).mock.calls[0]?.[0]
    expect(input).toMatchObject({ eventId, strategy: 'merge', auditRecord: { detail: { mapping: { ticketNumber: 'Ticket Number' } } } })
    expect(input?.participants).toHaveLength(1)
    expect(input?.participants[0]?.ticketNumber).toBe('00042')
  })

  it('prevents double submission and disables controls while committing', async () => {
    const pending = deferred<{ removedCount: number; unchangedCount: number }>(); const user = userEvent.setup()
    const services = makeServices({ commit: () => pending.promise }); renderProduction(services); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Gabung')
    const confirm = screen.getByRole('button', { name: 'Konfirmasi Gabung atomik' })
    await user.click(confirm); await user.click(confirm)
    expect(services.unitOfWork.commitParticipantImport).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('File Peserta')).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Gabung' })).toBeDisabled()
    pending.resolve({ removedCount: 0, unchangedCount: 0 })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Impor Peserta selesai' })).toBeInTheDocument())
  })

  it('does not show success while the commit promise is pending', async () => {
    const pending = deferred<{ removedCount: number; unchangedCount: number }>(); const user = userEvent.setup()
    renderProduction(makeServices({ commit: () => pending.promise })); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Gabung'); await user.click(screen.getByRole('button', { name: 'Konfirmasi Gabung atomik' }))
    expect(screen.queryByRole('heading', { name: 'Impor Peserta selesai' })).not.toBeInTheDocument()
    pending.resolve({ removedCount: 0, unchangedCount: 0 })
  })

  it('renders Replace counts, Merge counts, and bounded persisted verification', async () => {
    const user = userEvent.setup(); const replace = makeServices(); const replaceView = renderProduction(replace); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Ganti'); await user.click(screen.getByLabelText(/Saya memahami/)); await user.click(screen.getByRole('button', { name: 'Konfirmasi Ganti' }))
    expect(await screen.findByText(/Dimasukkan: 1 · Dihapus\/diganti: 2 · Tidak berubah: 0/)).toBeVisible()

    expect(replace.getPersistedParticipantsForEvent).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Tinjau dan konfirmasi impor' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Impor File Lain' })).toBeVisible()
    const completedProgress = screen.getByRole('navigation', { name: 'Progres Impor Peserta' })
    expect(within(completedProgress).getAllByText('Selesai')).toHaveLength(4)
    expect(screen.queryByLabelText('Ruang kerja validasi')).not.toBeInTheDocument()
    const completedLayout = screen.getByLabelText('Impor Peserta selesai', { selector: '.production-import-preview__success-layout' })
    expect(completedLayout).toHaveClass('production-import-preview__success-layout')
    expect(within(completedLayout).getByRole('region', { name: 'Peserta Tersimpan' })).toBeVisible()
    expect(completedLayout.querySelectorAll('.production-import-preview__success-metrics > div')).toHaveLength(3)
    replaceView.unmount()
    const merge = makeServices(); renderProduction(merge); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Gabung'); await user.click(screen.getByRole('button', { name: 'Konfirmasi Gabung atomik' }))
    expect(await screen.findByText(/Dimasukkan: 1 · Dihapus\/diganti: 0 · Tidak berubah: 2/)).toBeVisible()
    expect(screen.getByText('Total Peserta tersimpan: 1')).toBeVisible()
    expect(screen.getAllByText('00042').length).toBeGreaterThan(0)
    expect(merge.getPersistedParticipantsForEvent).toHaveBeenCalled()
  })

  it('does not restore File, mapping, strategy, or confirmation state after remount', async () => {
    const user = userEvent.setup(); const services = makeServices(); const view = renderProduction(services)
    await stageFile(user)
    await user.click(screen.getByRole('radio', { name: 'Gabung' }))
    await user.click(screen.getByRole('button', { name: 'Tinjau dan konfirmasi impor' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    view.unmount()
    renderProduction(services)
    await screen.findByText('Belum ada Peserta yang tersimpan untuk Acara ini.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Diagnostik dan ringkasan validasi' })).not.toBeInTheDocument()
    expect(screen.queryByText('participants.csv')).not.toBeInTheDocument()
  })

  it.each([
    ['existing-ticket-conflict', { code: 'duplicate-record', message: '00042 already exists in this Event' }],
    ['transaction failure', { code: 'unknown', stack: 'SECRET_STACK' }],
  ])('renders safe %s text without raw persistence details', async (_label, error) => {
    const user = userEvent.setup(); const services = makeServices({ commit: () => Promise.reject(error) }); renderProduction(services); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Gabung'); await user.click(screen.getByRole('button', { name: 'Konfirmasi Gabung atomik' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/Tidak ada record yang berubah|dibatalkan|ditolak/)
    expect(alert).not.toHaveTextContent('SECRET_STACK')
    expect(alert).not.toHaveTextContent('already exists in this Event')
  })

  it('keeps the staged validation result available for retry', async () => {
    const user = userEvent.setup(); const services = makeServices({ commit: () => Promise.reject({ code: 'transaction-failed', stack: 'SECRET' }) }); renderProduction(services); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Gabung'); await user.click(screen.getByRole('button', { name: 'Konfirmasi Gabung atomik' }))
    await user.click(await screen.findByRole('button', { name: 'Tinjau ulang' }))
    expect(screen.getByRole('heading', { name: 'Diagnostik dan ringkasan validasi' })).toBeInTheDocument()
    expect(screen.getByText(/Draf valid: 1/)).toBeVisible()
  })

  it('clears success when a new file or mapping is selected', async () => {
    const user = userEvent.setup(); const services = makeServices(); renderProduction(services); await stageFile(user); await chooseStrategyAndOpenConfirmation(user, 'Gabung'); await user.click(screen.getByRole('button', { name: 'Konfirmasi Gabung atomik' })); await screen.findByRole('heading', { name: 'Impor Peserta selesai' }); await user.click(screen.getByRole('button', { name: 'Impor File Lain' }))
    await user.upload(screen.getByLabelText('File Peserta'), new File(['Ticket Number,Name\n00099,Bob'], 'new.csv', { type: 'text/csv' }))
    expect(screen.queryByRole('heading', { name: 'Impor Peserta selesai' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Nama Peserta/ })).toBeInTheDocument())
    await user.selectOptions(screen.getByRole('combobox', { name: /Nama Peserta/ }), '')
    expect(screen.queryByRole('heading', { name: 'Impor Peserta selesai' })).not.toBeInTheDocument()
  })

  it('keeps the explicit prototype route and Audience routes private', () => {
    const prototypeView = render(<MemoryRouter initialEntries={['/dev/prototypes/participants?workflow=prototype']}><PrototypeParticipantsPage /></MemoryRouter>)
    expect(screen.getByText(/Fictional participant data/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Browse file' })).toBeInTheDocument()

    prototypeView.unmount()
    const audienceRouter = createMemoryRouter(appRoutes, { initialEntries: ['/display?workflow=production-preview&ticketNumber=00042'] })
    render(<RouterProvider router={audienceRouter} />)
    expect(screen.queryByLabelText('File Peserta')).not.toBeInTheDocument()
    expect(screen.queryByText('00042')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Impor Peserta' })).not.toBeInTheDocument()
  })
})
