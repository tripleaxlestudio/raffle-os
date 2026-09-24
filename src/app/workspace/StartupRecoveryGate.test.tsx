import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StartupRecoveryResult } from '../../application/workflow/startup-recovery-arbiter.ts'
import type { CommandId } from '../../domain/shared/identifiers.ts'
import { makeDrawHistoryFixture, makeWinner } from '../../infrastructure/persistence/test/draw-history-test-helpers.ts'
import { StartupRecoveryGate } from './StartupRecoveryGate.tsx'

const navigate = vi.fn()
const redrawTransition = { handoff: null as import('./ProductionWorkspaceContext.tsx').IntentionalRedrawHandoff | null, prepare: vi.fn(), clear: vi.fn() }

vi.mock('./ProductionWorkspaceContext.tsx', () => ({
  useIntentionalRedrawTransition: () => redrawTransition,
}))

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => navigate }
})

function recoveredRedraw(): StartupRecoveryResult {
  const fixture = makeDrawHistoryFixture()
  const session = {
    ...fixture.session,
    status: 'pending-confirmation' as const,
    configurationSnapshot: fixture.snapshots.configurationSnapshot,
    candidatePoolSnapshot: fixture.snapshots.candidatePoolSnapshot,
  }
  const cancelled = makeWinner(fixture, 0, 1, { status: 'cancelled' })
  const redrawRequest = {
    id: '00000000-0000-4000-8000-000000000099' as CommandId,
    eventId: session.eventId,
    drawSessionId: session.id,
    status: 'pending' as const,
    reason: 'absent' as const,
    targets: [{ winnerId: cancelled.id, originalStatus: 'pending' as const, originalSequenceNumber: cancelled.sequenceNumber }],
    replacementCount: 1,
    createdAt: session.updatedAt,
    updatedAt: session.updatedAt,
  }
  return {
    kind: 'recover-session',
    session,
    recommendedRoute: `/draw/run/${session.id}`,
    redrawRequest,
    decision: {
      kind: 'resume-verification',
      session,
      winners: [cancelled],
      redraws: [],
      receipts: { kind: 'absent' },
      checkpoint: { kind: 'absent' },
    },
  }
}

describe('StartupRecoveryGate recovery notice', () => {
  beforeEach(() => navigate.mockReset())

  it('shows a compact non-actionable notice on the active recovered redraw route', () => {
    const recovery = recoveredRedraw()
    if (recovery.kind !== 'recover-session') throw new Error('Expected recovered session fixture.')
    render(
      <MemoryRouter initialEntries={[`/draw/run/${recovery.session.id}`]}>
        <StartupRecoveryGate recovery={recovery} />
        <h1>Undi Ulang siap dijalankan</h1>
      </MemoryRouter>,
    )

    const notice = screen.getByRole('region', { name: 'Sesi undi ulang berhasil dipulihkan' })
    expect(notice).toHaveClass('kc-draw-recovery-notice')
    expect(screen.getByText('Semua hasil dan keputusan sebelumnya tetap tersimpan.')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Lanjutkan verifikasi' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Undi Ulang siap dijalankan' })).toBeVisible()
  })

  it('keeps the navigation CTA while recovery is still moving to an actionable destination', () => {
    const recovery = recoveredRedraw()
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <StartupRecoveryGate recovery={recovery} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Lanjutkan verifikasi' })).toBeVisible()
    expect(navigate).toHaveBeenCalledWith(recovery.kind === 'recover-session' ? recovery.recommendedRoute : '', { replace: true })
  })
})
