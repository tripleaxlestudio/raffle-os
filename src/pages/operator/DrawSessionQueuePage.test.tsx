import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DrawControlDeck, DrawSessionQueuePage } from './DrawSessionQueuePage.tsx'
import type { DrawSessionQueueDeck } from '../../ui/operator/draw/draw-session-queue-view-model.ts'
import type { DrawSessionQueueItem, DrawSessionQueueResult } from '../../application/draw/draw-session-queue.ts'
import type { Event } from '../../domain/events/event.types.ts'

const mocks = vi.hoisted(() => ({
  queue: null as DrawSessionQueueResult | null,
}))

const event = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Raffle OS Phase 5 Acceptance',
  status: 'live',
  createdAt: '2026-08-08T00:00:00.000Z',
  updatedAt: '2026-08-08T00:00:00.000Z',
} as Event

vi.mock('../../app/workspace/ProductionWorkspaceContext.tsx', () => ({
  useProductionWorkspace: () => ({
    status: 'ready',
    event,
    displayConfiguration: { id: 'display-1', blackoutAppearance: 'pure-black', safeAreaMargin: 48 },
    eventSettings: { eventId: event.id, displayName: event.name, subtitle: '', primaryColor: '#000000', accentColor: '#ffffff', updatedAt: event.updatedAt },
  }),
  useProductionAudiencePublisher: () => ({
    status: 'connected',
    getDiagnostics: () => ({ isConnected: true, lastHeartbeat: null, queuedMessages: 0 }),
    subscribe: () => () => undefined,
  }),
}))

vi.mock('../../infrastructure/composition/draw-command-production.ts', () => ({
  createDrawSetupProductionServices: () => ({ open: vi.fn(async () => undefined) }),
}))

vi.mock('../../application/draw/draw-session-queue.ts', () => ({
  queryDrawSessionQueue: vi.fn(async () => mocks.queue),
}))

const session = (mode: 'practice' | 'live', status: 'ready' | 'pending-confirmation' | 'completed' = 'ready'): DrawSessionQueueItem => ({
  action: status === 'pending-confirmation'
    ? { kind: 'pending', to: `/draw/pending/${mode}-session` }
    : status === 'completed'
      ? { kind: 'history', to: '/history' }
      : { kind: 'run', to: `/draw/run/${mode}` },
  category: { id: 'category-1', name: 'Acceptance Prize', prizeName: 'Acceptance Test Prize' } as never,
  checkpoint: null,
  event: { id: 'event-1', name: 'Raffle OS Phase 5 Acceptance' } as never,
  relation: 'valid',
  session: { id: `${mode}-session`, mode, status, updatedAt: '2026-07-31T08:15:00.000Z' } as never,
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
    return <DrawControlDeck connection={{ acknowledged: true, acknowledgedAt: undefined, detail: 'Snapshot publik terakhir telah dikonfirmasi.', label: 'Terhubung', tone: 'success' }} deck={deck} displayUrl="/display?eventId=event-1" selectedMode={mode} setSelectedMode={setMode} />
  }

  return render(<MemoryRouter><Harness /></MemoryRouter>)
}

beforeEach(() => {
  mocks.queue = { event, items: [] }
})

describe('Production Draw control deck', () => {
  it('renders ClipboardCheck for the pending-result action branch', () => {
    const pendingDeck: DrawSessionQueueDeck = {
      ...deck,
      defaultMode: 'live',
      sessions: {
        live: { ...session('live', 'pending-confirmation') },
      },
    }

    render(<MemoryRouter><DrawControlDeck connection={{ acknowledged: true, acknowledgedAt: undefined, detail: 'Snapshot publik terakhir telah dikonfirmasi.', label: 'Terhubung', tone: 'success' }} deck={pendingDeck} displayUrl="/display?eventId=event-1" selectedMode="live" setSelectedMode={() => undefined} /></MemoryRouter>)

    const review = screen.getByRole('link', { name: 'Tinjau Hasil' })
    expect(review).toBeInTheDocument()
    expect(review.querySelector('.ui-icon')).toBeInTheDocument()
  })

  it('uses one prominent mode switch with selected states and compact audience actions', () => {
    renderDeck()
    const modeGroup = screen.getByRole('group', { name: 'Mode Acceptance Prize' })
    const practice = screen.getByRole('button', { name: 'Latihan' })
    const live = screen.getByRole('button', { name: 'Live' })

    expect(modeGroup).toBeInTheDocument()
    expect(practice).toHaveAttribute('aria-pressed', 'true')
    expect(practice).toHaveClass('is-selected')
    expect(screen.getByText('Proses latihan — hasil tidak disimpan sebagai hasil resmi.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mode Live tidak aktif' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Siap untuk latihan' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mulai Latihan' })).toHaveClass('ui-button--lg')
    expect(screen.getByRole('link', { name: 'Mulai Latihan' })).toHaveClass('ui-button--primary')
    expect(screen.getByRole('link', { name: 'Buka Pengaturan Undian' })).toHaveAttribute('href', '/draw/setup')
    expect(screen.getByRole('link', { name: 'Buka Pengaturan Undian' })).toHaveClass('ui-button--lg')
    expect(screen.getByRole('link', { name: 'Buka Pengaturan Undian' })).toHaveClass('draw-control-deck__live-setup-action')
    expect(screen.getAllByText('Terhubung')).toHaveLength(1)
    expect(screen.getByText('Snapshot publik terakhir telah dikonfirmasi.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buka Tampilan Audiens' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mulai Latihan' })).toBeInTheDocument()

    fireEvent.click(live)

    expect(live).toHaveAttribute('aria-pressed', 'true')
    expect(live).toHaveClass('is-selected')
    expect(screen.getByText('Proses resmi — dapat membuat hasil resmi setelah konfirmasi.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mulai Undian' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mulai Undian' })).toHaveClass('ui-button--danger')
  })
})

describe('Production DrawSessionQueuePage empty states', () => {
  it('renders the refined empty state card when no active draw exists but completed sessions exist', async () => {
    mocks.queue = {
      event,
      items: [session('live', 'completed')],
    }

    render(<MemoryRouter><DrawSessionQueuePage /></MemoryRouter>)

    expect(await screen.findByRole('heading', { level: 2, name: 'Tidak ada Undian aktif' })).toBeInTheDocument()
    expect(screen.getByText('Undian sebelumnya yang selesai atau dibatalkan tetap tersedia di Riwayat. Buat undian berikutnya dari Pengaturan Undian saat siap.')).toBeInTheDocument()

    const emptyCard = screen.getByRole('heading', { level: 2, name: 'Tidak ada Undian aktif' }).closest('.draw-live-queue__empty-state')
    expect(emptyCard).toBeInTheDocument()
    expect(emptyCard).toHaveClass('ui-card--raised')

    const icon = emptyCard?.querySelector('.draw-live-queue__empty-icon')
    expect(icon).toBeInTheDocument()
    expect(icon?.querySelector('.ui-icon')).toBeInTheDocument()

    const primaryAction = within(emptyCard as HTMLElement).getByRole('link', { name: 'Mulai Undian Berikutnya' })
    expect(primaryAction).toHaveAttribute('href', '/draw/setup')
    expect(primaryAction).toHaveClass('ui-button--primary')

    const secondaryAction = within(emptyCard as HTMLElement).getByRole('link', { name: 'Lihat Riwayat' })
    expect(secondaryAction).toHaveAttribute('href', '/history')
    expect(secondaryAction).toHaveClass('ui-button--secondary')
  })

  it('renders initial setup empty state when no draws have ever been created', async () => {
    mocks.queue = {
      event,
      items: [],
    }

    render(<MemoryRouter><DrawSessionQueuePage /></MemoryRouter>)

    expect(await screen.findByRole('heading', { level: 2, name: 'Belum ada sesi undian' })).toBeInTheDocument()
    expect(screen.getByText('Buat konfigurasi di Pengaturan Undian; sesi tersimpan akan langsung muncul di sini.')).toBeInTheDocument()

    const emptyCard = screen.getByRole('heading', { level: 2, name: 'Belum ada sesi undian' }).closest('.draw-live-queue__empty-state')
    expect(emptyCard).toBeInTheDocument()

    const primaryAction = within(emptyCard as HTMLElement).getByRole('link', { name: 'Buat Sesi Undian' })
    expect(primaryAction).toHaveAttribute('href', '/draw/setup')
    expect(primaryAction).toHaveClass('ui-button--primary')

    expect(within(emptyCard as HTMLElement).queryByRole('link', { name: 'Lihat Riwayat' })).not.toBeInTheDocument()
  })
})
