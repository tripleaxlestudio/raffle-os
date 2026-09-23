import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublisherStatus } from '../../application/display-transport/operator-publisher.ts'
import { setDisplayConnectionStatus } from '../../application/display-transport/connection-status.ts'
import { ProductionOperatorLayout } from './ProductionOperatorLayout.tsx'
import { ProductionDashboardPage } from '../../pages/operator/ProductionDashboardPage.tsx'
import type { EventStatus } from '../../domain/events/event.types.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { StartupRecoveryResult } from '../../application/workflow/startup-recovery-arbiter.ts'
import type { AuditRecord } from '../../domain/audit/audit.types.ts'
import type { DrawSessionQueueItem } from '../../application/draw/draw-session-queue.ts'

const mocks = vi.hoisted(() => {
  const listeners = new Set<(status: PublisherStatus) => void>()
  const snapshotListeners = new Set<() => void>()
  const state = { connected: false, snapshot: { drawSessionId: 'ui-event', stage: 'standby' as const, blackoutRequested: false as boolean, displayTest: false, eventName: 'UI test' } }
  const queueItems: DrawSessionQueueItem[] = []
  const auditRecords: AuditRecord[] = []
  const audience = {
    status: { kind: 'waiting-for-display' } as PublisherStatus,
    subscribe: (listener: (status: PublisherStatus) => void) => { listeners.add(listener); return () => listeners.delete(listener) },
    subscribeSnapshot: (listener: () => void) => { snapshotListeners.add(listener); return () => snapshotListeners.delete(listener) },
    getSnapshot: () => state.snapshot,
    getDiagnostics: () => state.connected ? { lastAcknowledgement: {}, lastSnapshotTimestamp: '2026-08-31T00:00:00.000Z' } : undefined,
    publish: vi.fn(),
  }
  const workspace = {
    status: 'ready', event: { id: 'ui-event', name: 'UI test', status: 'ready' as EventStatus },
    displayConfiguration: { id: 'ui-display' } as { id: string } | null, currentMode: null as 'live' | 'practice' | null,
    unresolvedSession: null as DrawSession | null, startupRecovery: { kind: 'normal', targetPath: '/dashboard' } as StartupRecoveryResult, participantCount: 0, checkedInParticipantCount: 0,
    prizeCategoryCount: 6, liveSessionCount: 0,
    sessionCounts: { draft: 0, ready: 0, drawing: 0, 'pending-confirmation': 0, completed: 0, cancelled: 0 },
    setupReadiness: { event: true, prize: true, participants: true, displaySettings: true, drawSetup: false },
  }
  return { audience, workspace, state, listeners, queueItems, auditRecords, openAudience: vi.fn(), services: { open: vi.fn(async () => undefined), audits: { findByEventId: vi.fn(async () => auditRecords) }, events: { findAll: vi.fn(async () => [workspace.event, { id: 'another-event', name: 'Another test event', status: 'draft' }]) }, service: { selectEvent: vi.fn(async () => undefined) } } }
})

vi.mock('../workspace/ProductionWorkspaceContext.tsx', () => ({
  ProductionWorkspaceProvider: ({ children }: { children: ReactNode }) => children,
  useProductionWorkspace: () => mocks.workspace,
  useProductionAudiencePublisher: () => mocks.audience,
  signalProductionWorkspaceChanged: vi.fn(),
}))
vi.mock('../shell/OperatorSidebar.tsx', () => ({ OperatorSidebar: () => null }))
vi.mock('../workspace/StartupRecoveryGate.tsx', () => ({ StartupRecoveryGate: () => null }))
vi.mock('../../infrastructure/composition/event-setup-production.ts', () => ({ createEventSetupProductionServices: () => mocks.services }))
vi.mock('../../infrastructure/composition/draw-command-production.ts', () => ({ createDrawSetupProductionServices: () => mocks.services }))
vi.mock('../../application/draw/draw-session-queue.ts', () => ({ queryDrawSessionQueue: async () => ({ items: mocks.queueItems }) }))
vi.mock('../../infrastructure/browser/managed-audience-display.ts', () => ({ openManagedAudienceDisplay: mocks.openAudience }))

function renderDashboard() {
  return render(<MemoryRouter initialEntries={['/dashboard']}><Routes><Route element={<ProductionOperatorLayout />}><Route path="/dashboard" element={<ProductionDashboardPage />} /><Route path="/events" element={<h1>Pengaturan Acara</h1>} /></Route></Routes></MemoryRouter>)
}

function queueItem(status: DrawSession['status'], id = `session-${status}`, mode: DrawSession['mode'] = 'live'): DrawSessionQueueItem {
  return {
    session: { id, eventId: 'ui-event', configurationId: `configuration-${id}`, mode, status, configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: '2026-09-21T08:00:00.000Z', updatedAt: '2026-09-21T08:00:00.000Z' } as DrawSession,
    event: mocks.workspace.event as never,
    category: { id: `category-${id}`, eventId: 'ui-event', name: 'Grand Prize', prizeName: 'iPhone 17 Pro' } as never,
    winnerCount: 1,
    checkpoint: null,
    relation: 'valid',
    action: status === 'pending-confirmation' ? { kind: 'pending', to: `/draw/pending/${id}` } : status === 'draft' ? { kind: 'setup', to: '/draw/setup' } : status === 'completed' || status === 'cancelled' ? { kind: 'history', to: '/history' } : { kind: 'run', to: `/draw/run/${id}` },
  }
}

describe('production header and dashboard Audience indicators', () => {
  beforeEach(() => {
    mocks.state.connected = false
    mocks.state.snapshot = { drawSessionId: 'ui-event', stage: 'standby', blackoutRequested: false, displayTest: false, eventName: 'UI test' }
    mocks.audience.status = { kind: 'waiting-for-display' }
    mocks.openAudience.mockClear()
    mocks.workspace.currentMode = null
    mocks.workspace.event.name = 'UI test'
    mocks.workspace.event.status = 'ready'
    mocks.workspace.unresolvedSession = null
    mocks.workspace.startupRecovery = { kind: 'normal', targetPath: '/dashboard' }
    mocks.workspace.displayConfiguration = { id: 'ui-display' }
    mocks.workspace.participantCount = 300
    mocks.workspace.checkedInParticipantCount = 231
    mocks.workspace.prizeCategoryCount = 6
    mocks.workspace.sessionCounts = { draft: 0, ready: 0, drawing: 0, 'pending-confirmation': 0, completed: 0, cancelled: 0 }
    mocks.workspace.sessionCounts['pending-confirmation'] = 0
    mocks.workspace.setupReadiness = { event: true, prize: true, participants: true, displaySettings: true, drawSetup: false }
    mocks.auditRecords.splice(0)
    mocks.queueItems.splice(0)
    setDisplayConnectionStatus('ui-event:ui-display', 'waiting')
  })

  it('uses one accessible Active Event link to navigate directly to Event settings', async () => {
    const user = userEvent.setup()
    renderDashboard()
    const control = screen.getByRole('link', { name: /^Acara aktif\s*UI test\s*Ready$/ })
    expect(control).toHaveAttribute('href', '/events')
    expect(control.querySelector('.kc-operator-header__chevron')).not.toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await user.click(control)
    expect(screen.getByRole('heading', { level: 1, name: 'Pengaturan Acara' })).toBeVisible()
  })

  it('retains the complete long Event name in the compact link title', () => {
    mocks.workspace.event.name = 'Perayaan tahunan perusahaan dan keluarga besar seluruh cabang Indonesia — fixture nama Acara panjang'
    renderDashboard()
    const header = within(screen.getByRole('banner'))
    expect(header.getByText(mocks.workspace.event.name)).toHaveAttribute('title', mocks.workspace.event.name)
    expect(header.getByRole('link', { name: /^Acara aktif/ })).toHaveAttribute('href', '/events')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it.each([
    ['ready', 'ready', 'Ready'],
    ['live', 'live', 'Live'],
    ['completed', 'completed', 'Selesai'],
    ['draft', 'draft', 'Draf'],
    ['archived', 'archived', 'Diarsipkan'],
  ] as const)('maps the %s Event status to an explicit %s badge', (eventStatus, statusKey, label) => {
    mocks.workspace.event.status = eventStatus
    renderDashboard()
    expect(within(screen.getByRole('banner')).getByText(label)).toHaveAttribute('data-status', statusKey)
  })

  it.each([
    ['drawing', 'live', 'Live'],
    ['pending-confirmation', 'pending', 'Pending'],
  ] as const)('uses authoritative %s Live-session state for the %s badge', (sessionStatus, statusKey, label) => {
    mocks.workspace.unresolvedSession = { status: sessionStatus } as DrawSession
    renderDashboard()
    expect(within(screen.getByRole('banner')).getByText(label)).toHaveAttribute('data-status', statusKey)
  })

  it('shows an interrupted badge for authoritative conflicting recovery state', () => {
    mocks.workspace.startupRecovery = { kind: 'conflicting-sessions', sessions: [], recommendedRoute: '/draw/pending' }
    renderDashboard()
    expect(within(screen.getByRole('banner')).getByText('Terganggu')).toHaveAttribute('data-status', 'interrupted')
  })

  it.each([['live', 'Mode Live'], ['practice', 'Mode Latihan']] as const)('keeps %s mode explicit in production chrome', (mode, label) => {
    mocks.workspace.currentMode = mode
    renderDashboard()
    expect(within(screen.getByRole('banner')).getByText(label)).toHaveAttribute('data-mode', mode)
    expect(document.querySelector('[data-operator-shell]')).toHaveAttribute('data-ui-theme', 'kocokan')
  })

  it('keeps both visual indicators synchronized through waiting, connected, and waiting', async () => {
    renderDashboard()
    const operations = within(screen.getByRole('region', { name: 'Operasi Dasbor' }))
    expect(operations.getByRole('heading', { name: 'Audience Output' })).toBeVisible()
    expect(operations.getByRole('img', { name: 'Monitor Audience: Standby' })).toHaveClass('production-preview')
    expect(operations.getByRole('img', { name: 'Monitor Audience: Standby' })).toHaveAttribute('data-public-stage', 'standby')
    expect(operations.getByText('Monitor produksi dari snapshot publik aktif')).toBeVisible()
    const waitingButton = screen.getByRole('button', { name: 'Tampilan Audiens: Menunggu' })
    const waitingIcon = waitingButton.querySelector('svg')?.innerHTML
    expect(waitingButton.querySelector('[data-connection-state]')).toHaveAttribute('data-connection-state', 'waiting')
    expect(operations.getByText('Menunggu').parentElement).toHaveAttribute('data-connection-state', 'waiting')

    act(() => {
      mocks.state.connected = true
      setDisplayConnectionStatus('ui-event:ui-display', 'connected')
      mocks.listeners.forEach((listener) => listener({ kind: 'audience-presence', status: 'connected', subscriberCount: 1 }))
    })
    const connectedButton = screen.getByRole('button', { name: 'Tampilan Audiens: Terhubung' })
    expect(connectedButton.querySelector('[data-connection-state]')).toHaveAttribute('data-connection-state', 'connected')
    expect(connectedButton.querySelector('svg')?.innerHTML).not.toBe(waitingIcon)
    expect(operations.getByText('Terhubung').parentElement).toHaveAttribute('data-connection-state', 'connected')
    await userEvent.setup().click(connectedButton)
    expect(mocks.openAudience).toHaveBeenCalledWith('/display?eventId=ui-event&displayConfigurationId=ui-display')

    act(() => {
      // A historical snapshot acknowledgement must not keep the badge connected.
      setDisplayConnectionStatus('ui-event:ui-display', 'waiting')
      mocks.listeners.forEach((listener) => listener({ kind: 'audience-presence', status: 'waiting', subscriberCount: 0 }))
    })
    expect(screen.getByRole('button', { name: 'Tampilan Audiens: Menunggu' }).querySelector('svg')?.innerHTML).toBe(waitingIcon)
    expect(operations.getByText('Menunggu')).toBeVisible()
  })

  it('shows a setup state instead of fabricating an Audience preview when display configuration is missing', () => {
    mocks.workspace.displayConfiguration = null
    mocks.workspace.setupReadiness = { ...mocks.workspace.setupReadiness, displaySettings: false }
    renderDashboard()
    const operations = within(screen.getByRole('region', { name: 'Operasi Dasbor' }))
    expect(operations.getAllByText('Tampilan Audience belum disiapkan')).toHaveLength(2)
    expect(operations.queryByRole('img', { name: /Monitor Audience:/ })).not.toBeInTheDocument()
    const setupLinks = operations.getAllByRole('link', { name: 'Siapkan Tampilan' })
    expect(setupLinks).toHaveLength(2)
    for (const link of setupLinks) expect(link).toHaveAttribute('href', '/settings')
  })

  it('presents one contextual next action without repeating dashboard metrics', async () => {
    setDisplayConnectionStatus('ui-event:ui-display', 'connected')
    renderDashboard()
    const operations = within(screen.getByRole('region', { name: 'Operasi Dasbor' }))
    expect(operations.getByRole('heading', { name: 'Langkah Berikutnya' })).toBeVisible()
    expect(operations.getByLabelText('Tindakan utama acara')).toHaveAttribute('data-tone', 'neutral')
    expect(operations.getByRole('heading', { name: 'System Check' })).toBeVisible()
    expect(operations.getByText('5/6 aman')).toBeVisible()
    const setupDrawLinks = await operations.findAllByRole('link', { name: 'Siapkan Undian' })
    expect(setupDrawLinks).toHaveLength(2)
    expect(setupDrawLinks.every((link) => link.getAttribute('href') === '/draw/setup')).toBe(true)
    expect(operations.getByText('Belum ada undian yang siap dijalankan')).toBeVisible()
    expect(operations.getByRole('heading', { name: 'Undian Berikutnya' })).toBeVisible()
    expect(screen.getByText('Siap • Audience Terhubung • Standby • Undian belum disiapkan')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Perlu Tindakan' })).not.toBeInTheDocument()
  })

  it('routes the primary action to the first incomplete readiness step', async () => {
    mocks.workspace.setupReadiness = { event: true, prize: false, participants: false, displaySettings: false, drawSetup: false }
    mocks.workspace.prizeCategoryCount = 0
    mocks.workspace.participantCount = 0
    renderDashboard()
    expect(await within(screen.getByRole('region', { name: 'Operasi Dasbor' })).findByRole('link', { name: 'Atur Hadiah' })).toHaveAttribute('href', '/prize-categories')
    expect(screen.getByText('2/6 aman')).toBeVisible()
  })

  it('uses the authoritative ready queue item for the primary CTA and upcoming draw', async () => {
    setDisplayConnectionStatus('ui-event:ui-display', 'connected')
    mocks.queueItems.push(queueItem('ready', 'ready-grand-prize'))
    mocks.workspace.sessionCounts.ready = 1
    mocks.workspace.setupReadiness = { ...mocks.workspace.setupReadiness, drawSetup: true }
    renderDashboard()
    const operations = within(screen.getByRole('region', { name: 'Operasi Dasbor' }))
    expect(await operations.findByRole('link', { name: 'Mulai Undian' })).toHaveAttribute('href', '/draw/run/ready-grand-prize')
    expect(operations.getAllByText('iPhone 17 Pro siap dijalankan')).toHaveLength(1)
    expect(operations.getByText('6/6 aman')).toBeVisible()
    expect(screen.getByText('Siap • Audience Terhubung • Standby • Undian siap')).toBeVisible()
  })

  it('returns an active drawing session instead of offering another start action', async () => {
    setDisplayConnectionStatus('ui-event:ui-display', 'connected')
    mocks.queueItems.push(queueItem('drawing', 'running-session'))
    mocks.workspace.sessionCounts.drawing = 1
    renderDashboard()
    expect(await screen.findByRole('link', { name: 'Kembali ke Undian' })).toHaveAttribute('href', '/draw/run/running-session')
    expect(screen.queryByRole('link', { name: 'Mulai Undian' })).not.toBeInTheDocument()
    expect(screen.getByText('Siap • Audience Terhubung • Standby • Undian sedang berjalan')).toBeVisible()
  })

  it('shows the attention strip only when results require confirmation', () => {
    mocks.workspace.sessionCounts['pending-confirmation'] = 2
    renderDashboard()
    expect(screen.getByRole('heading', { name: 'Perlu Tindakan' })).toBeVisible()
    expect(screen.getByText('2 hasil menunggu konfirmasi')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Lanjutkan Verifikasi' })).toHaveAttribute('href', '/draw/pending')
    expect(screen.getByText('Siap • Audience Menunggu • Standby • Verifikasi tertunda')).toBeVisible()
  })

  it('treats a configured but disconnected Audience as an operational blocker', async () => {
    renderDashboard()
    const operations = within(screen.getByRole('region', { name: 'Operasi Dasbor' }))
    expect(operations.getByLabelText('Tindakan utama acara')).toHaveAttribute('data-tone', 'attention')
    expect(operations.getByText('Hubungkan Audience Display')).toBeVisible()
    expect(operations.getByText('4/6 aman')).toBeVisible()
    const audienceButtons = await operations.findAllByRole('button', { name: 'Buka Tampilan Audiens' })
    expect(audienceButtons).toHaveLength(2)
    expect(audienceButtons.some((button) => button.classList.contains('kc-button--primary'))).toBe(true)
    expect(screen.getByText('Audience Display belum terhubung')).toBeVisible()
  })

  it('prioritizes authoritative recovery over other dashboard actions', async () => {
    mocks.workspace.startupRecovery = { kind: 'conflicting-sessions', sessions: [{ id: 'session-1' } as DrawSession, { id: 'session-2' } as DrawSession], recommendedRoute: '/draw/pending' }
    renderDashboard()
    expect(await within(screen.getByRole('region', { name: 'Operasi Dasbor' })).findByRole('link', { name: 'Pulihkan Sesi' })).toHaveAttribute('href', '/draw/pending')
    expect(screen.getByText('Pemulihan sesi diperlukan')).toBeVisible()
    expect(screen.getByText('Siap • Audience Menunggu • Standby • Sesi perlu dipulihkan')).toBeVisible()
  })

  it('shows blackout as presentation state without conflating it with connection status', () => {
    setDisplayConnectionStatus('ui-event:ui-display', 'connected')
    mocks.state.snapshot = { ...mocks.state.snapshot, blackoutRequested: true }
    renderDashboard()
    const operations = within(screen.getByRole('region', { name: 'Operasi Dasbor' }))
    expect(operations.getByText('BLACKOUT')).toHaveAttribute('data-state', 'blackout')
    expect(operations.getByRole('img', { name: 'Monitor Audience: Blackout' })).toHaveAttribute('data-public-stage', 'blackout')
    expect(operations.getByText('Terhubung').parentElement).toHaveAttribute('data-connection-state', 'connected')
  })

  it('derives stored Live progress and compact statistics from queue state', async () => {
    setDisplayConnectionStatus('ui-event:ui-display', 'connected')
    for (let index = 0; index < 7; index += 1) mocks.queueItems.push(queueItem('completed', `completed-${index}`))
    for (let index = 0; index < 2; index += 1) mocks.queueItems.push(queueItem('ready', `ready-${index}`))
    mocks.queueItems.push(queueItem('pending-confirmation', 'pending-1'), queueItem('draft', 'draft-1'), queueItem('draft', 'draft-2'))
    mocks.workspace.sessionCounts = { draft: 2, ready: 2, drawing: 0, 'pending-confirmation': 1, completed: 7, cancelled: 0 }
    renderDashboard()
    expect(await screen.findByRole('heading', { name: '7 dari 12 selesai' })).toBeVisible()
    expect(screen.getByRole('progressbar', { name: '58% undian Live selesai' })).toHaveAttribute('aria-valuenow', '58')
    expect(screen.getByText('2 siap · 0 berjalan · 1 pending · 2 draf')).toBeVisible()
    const stats = within(screen.getByRole('navigation', { name: 'Statistik operasional' }))
    expect(stats.getByRole('link', { name: /2\s*Siap/ })).toBeVisible()
    expect(stats.getByRole('link', { name: /1\s*Pending/ })).toHaveAttribute('data-warning', 'true')
    expect(stats.getByRole('link', { name: /7\s*Selesai/ })).toBeVisible()
  })

  it('shows recent activity from official audit records with contextual links', async () => {
    mocks.auditRecords.push(
      { id: 'audit-import' as never, eventId: 'ui-event' as never, action: 'participant-import-committed', actor: { type: 'system' }, detail: { insertedParticipantCount: 300, source: { fileName: 'peserta.xlsx' } }, timestamp: '2026-09-21T08:00:00.000Z' as never },
      { id: 'audit-confirm' as never, eventId: 'ui-event' as never, action: 'winner-confirmed', actor: { type: 'operator', name: 'local-operator' }, detail: { commandId: 'command-1', drawSessionId: 'session-1', ticketNumber: '00042' }, timestamp: '2026-09-21T09:00:00.000Z' as never },
    )
    renderDashboard()

    const activity = within(await screen.findByRole('list', { name: 'Aktivitas resmi terbaru' }))
    expect(activity.getByText('Pemenang dikonfirmasi')).toBeVisible()
    expect(activity.getByText('Tiket 00042')).toBeVisible()
    expect(activity.getByRole('link', { name: /Pemenang dikonfirmasi/ })).toHaveAttribute('href', '/history/session-1')
    expect(activity.getByRole('link', { name: /Peserta berhasil diimpor/ })).toHaveAttribute('href', '/participants')
    expect(screen.getByRole('link', { name: 'Lihat Riwayat' })).toHaveAttribute('href', '/history')
  })

  it.each([
    ['reconnecting', 'Menghubungkan ulang'],
    ['unavailable', 'Tidak tersedia'],
    ['publication-failed', 'Publikasi gagal'],
  ] as const)('preserves the %s state with a localized accessible name', (state, label) => {
    setDisplayConnectionStatus('ui-event:ui-display', state)
    renderDashboard()
    const button = screen.getByRole('button', { name: `Tampilan Audiens: ${label}` })
    expect(button.querySelector('[data-connection-state]')).toHaveAttribute('data-connection-state', state)
    expect(button).toHaveTextContent(`Audiens: ${label}`)
  })
})
