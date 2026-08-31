import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublisherStatus } from '../../application/display-transport/operator-publisher.ts'
import { setDisplayConnectionStatus } from '../../application/display-transport/connection-status.ts'
import { ProductionOperatorLayout } from './ProductionOperatorLayout.tsx'
import { ProductionDashboardPage } from '../../pages/operator/ProductionDashboardPage.tsx'

const mocks = vi.hoisted(() => {
  const listeners = new Set<(status: PublisherStatus) => void>()
  const state = { connected: false }
  const audience = {
    status: { kind: 'waiting-for-display' } as PublisherStatus,
    subscribe: (listener: (status: PublisherStatus) => void) => { listeners.add(listener); return () => listeners.delete(listener) },
    getDiagnostics: () => state.connected ? { lastAcknowledgement: {}, lastSnapshotTimestamp: '2026-08-31T00:00:00.000Z' } : undefined,
    publish: vi.fn(),
  }
  const workspace = {
    status: 'ready', event: { id: 'ui-event', name: 'UI test', status: 'draft' },
    displayConfiguration: { id: 'ui-display' }, currentMode: null,
    unresolvedSession: null, participantCount: 0, checkedInParticipantCount: 0,
    prizeCategoryCount: 0, liveSessionCount: 0,
    sessionCounts: { ready: 0, drawing: 0, 'pending-confirmation': 0 },
  }
  return { audience, workspace, state, listeners, openAudience: vi.fn(), services: { open: vi.fn(async () => undefined) } }
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
vi.mock('../../application/draw/draw-session-queue.ts', () => ({ queryDrawSessionQueue: async () => null }))
vi.mock('../../infrastructure/browser/managed-audience-display.ts', () => ({ openManagedAudienceDisplay: mocks.openAudience }))

function renderDashboard() {
  return render(<MemoryRouter initialEntries={['/dashboard']}><Routes><Route element={<ProductionOperatorLayout />}><Route path="/dashboard" element={<ProductionDashboardPage />} /></Route></Routes></MemoryRouter>)
}

describe('production header and dashboard Audience indicators', () => {
  beforeEach(() => {
    mocks.state.connected = false
    mocks.audience.status = { kind: 'waiting-for-display' }
    mocks.openAudience.mockClear()
    setDisplayConnectionStatus('ui-event:ui-display', 'waiting')
  })

  it('keeps both visual indicators synchronized through waiting, connected, and waiting', async () => {
    renderDashboard()
    const operations = within(screen.getByRole('region', { name: 'Operasi Dasbor' }))
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
