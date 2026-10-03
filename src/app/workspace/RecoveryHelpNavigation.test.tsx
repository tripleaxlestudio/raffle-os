import { useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { evaluateStartupRecovery, type StartupRecoveryResult } from '../../application/workflow/startup-recovery-arbiter.ts'
import { createDrawSessionId, type CommandId } from '../../domain/shared/identifiers.ts'
import { makeDrawHistoryFixture, makeWinner } from '../../infrastructure/persistence/test/draw-history-test-helpers.ts'
import { HelpGuidePage, HelpLicensesPage, HelpSupportPage, HelpWhatsNewPage } from '../../pages/operator/help/HelpPages.tsx'
import { StartupRecoveryGate } from './StartupRecoveryGate.tsx'
import { RecoveryHelpContext, recoveryNavigationTarget } from './recovery-help-navigation.ts'

const clearHandoff = vi.fn()
vi.mock('./ProductionWorkspaceContext.tsx', () => ({
  useIntentionalRedrawTransition: () => ({ handoff: null, clear: clearHandoff }),
}))

function recoveryFixture(kind: 'pending' | 'drawing' | 'unknown' | 'conflict' | 'redraw' = 'pending'): StartupRecoveryResult {
  const fixture = makeDrawHistoryFixture()
  const session = { ...fixture.session, status: kind === 'drawing' || kind === 'unknown' ? 'drawing' as const : 'pending-confirmation' as const, ...fixture.snapshots }
  const winner = makeWinner(fixture, 0, 1)
  return evaluateStartupRecovery({
    activeEvent: fixture.event,
    sessions: kind === 'conflict' ? [session, { ...session, id: createDrawSessionId() }] : [session],
    winners: kind === 'unknown' ? [] : [winner],
    redrawRequests: kind === 'redraw' ? [{ id: '00000000-0000-4000-8000-000000000099' as CommandId, eventId: session.eventId, drawSessionId: session.id, status: 'pending', reason: 'absent', targets: [{ winnerId: winner.id, originalStatus: 'pending', originalSequenceNumber: 1 }], replacementCount: 1, createdAt: session.updatedAt, updatedAt: session.updatedAt }] : [],
  })
}

function openRecovery(recovery: StartupRecoveryResult | undefined, path = '/help/guide') {
  let updateRecovery: (next: StartupRecoveryResult | undefined) => void = () => undefined
  function Layout() {
    const [current, setCurrent] = useState(recovery)
    updateRecovery = setCurrent
    return <RecoveryHelpContext value={recoveryNavigationTarget(current) !== null}>
      <StartupRecoveryGate recovery={current} /><Outlet />
    </RecoveryHelpContext>
  }
  const router = createMemoryRouter([{ element: <Layout />, children: [
    { path: '/help/whats-new', element: <HelpWhatsNewPage /> },
    { path: '/help/guide', element: <HelpGuidePage /> },
    { path: '/help/support', element: <HelpSupportPage /> },
    { path: '/help/licenses', element: <HelpLicensesPage /> },
    { path: '*', element: <h1>Halaman operasional</h1> },
  ] }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return { router, setRecovery: (next: StartupRecoveryResult | undefined) => act(() => updateRecovery(next)) }
}

describe('approved recovery Help navigation', () => {
  beforeEach(() => clearHandoff.mockClear())

  it.each(['/help/whats-new', '/help/guide', '/help/support', '/help/licenses'])('allows %s with a persistent recovery action and no About backlink', async (path) => {
    const recovery = recoveryFixture()
    const { router } = openRecovery(recovery, `${path}?context=help#topic`)
    expect(router.state.location.pathname).toBe(path)
    expect(screen.getByRole('link', { name: 'Kembali ke Pemulihan' })).toHaveAttribute('href', recoveryNavigationTarget(recovery))
    expect(screen.getByText('Pemulihan belum selesai')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Kembali ke Settings → Tentang' })).not.toBeInTheDocument()
    expect(clearHandoff).not.toHaveBeenCalled()
  })

  it.each(['pending', 'drawing', 'unknown', 'conflict', 'redraw'] as const)('returns to the authoritative %s destination and permits Back/Forward', async (kind) => {
    const recovery = recoveryFixture(kind)
    const snapshot = structuredClone(recovery)
    const { router } = openRecovery(recovery)
    await userEvent.setup().click(screen.getByRole('link', { name: 'Kembali ke Pemulihan' }))
    expect(router.state.location.pathname).toBe(recoveryNavigationTarget(recovery))
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe('/help/guide')
    expect(screen.getByRole('link', { name: 'Kembali ke Pemulihan' })).toBeVisible()
    await act(() => router.navigate(1))
    expect(router.state.location.pathname).toBe(recoveryNavigationTarget(recovery))
    expect(recovery).toEqual(snapshot)
  })

  it.each(['/dashboard', '/events', '/settings', '/settings/app?tab=about', '/settings/app?tab=storage', '/help/guide-extra', '/help/guide/', '/help/future'])('does not grant an exception to %s', (path) => {
    const recovery = recoveryFixture()
    const { router } = openRecovery(recovery, path)
    expect(router.state.location.pathname).toBe(recoveryNavigationTarget(recovery))
  })

  it('updates the CTA without leaving Help and removes the notice after resolution without replaying navigation', async () => {
    const { router, setRecovery } = openRecovery(recoveryFixture())
    const conflict = recoveryFixture('conflict')
    await setRecovery(conflict)
    expect(screen.getByRole('link', { name: 'Kembali ke Pemulihan' })).toHaveAttribute('href', '/draw/pending')
    expect(screen.getByText('Pilih sesi Live tersimpan untuk dipulihkan')).toBeVisible()
    await setRecovery({ kind: 'normal', targetPath: '/dashboard' })
    expect(screen.queryByText('Pemulihan belum selesai')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kembali ke Settings → Tentang' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/help/guide')
  })

  it.each([undefined, { kind: 'no-active-event' } as const, { kind: 'normal', targetPath: '/dashboard' } as const, { kind: 'storage-failure', error: 'Unreadable' } as const])('does not invent a recovery target for %j', (recovery) => {
    const { router } = openRecovery(recovery)
    expect(router.state.location.pathname).toBe('/help/guide')
    expect(screen.queryByRole('link', { name: 'Kembali ke Pemulihan' })).not.toBeInTheDocument()
  })
})
