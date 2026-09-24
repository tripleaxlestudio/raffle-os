import { StrictMode, useState, type ReactNode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UiThemeContext } from '../../../shared/ui/ui-theme.ts'
import { DEFAULT_DRAW_PRESENTATION_CONFIGURATION } from '../../../domain/draws/draw-presentation.types.ts'
import { parseDrawSessionId, parseWinnerRecordId } from '../../../domain/shared/identifiers.ts'
import { parseIsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type { Result } from '../../../domain/shared/result.ts'
import { DrawPresentationSettings } from './DrawPresentationSettings.tsx'
import { PresentationSupport, ProductionDrawPresentation } from './ProductionDrawPresentation.tsx'
import { PresentationRecoveryDialog } from './PresentationRecoveryDialog.tsx'

function valid<T>(result: Result<T>): T {
  if (!result.ok) throw new Error('Invalid test fixture')
  return result.value
}
const drawSessionId = valid(parseDrawSessionId('00000000-0000-4000-8000-000000000003'))
const winnerId = valid(parseWinnerRecordId('00000000-0000-4000-8000-000000000004'))
const timestamp = valid(parseIsoTimestamp('2026-08-05T00:00:00.000Z'))
const result = { drawSessionId, winners: [{ winnerId, sequence: 1, ticketNumber: '00042' }] }
function Themed({ children }: { children: ReactNode }) {
  return <MemoryRouter><UiThemeContext.Provider value="kocokan"><div data-ui-theme="kocokan">{children}</div></UiThemeContext.Provider></MemoryRouter>
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('Kocokan Draw Console isolation', () => {
  it('retains checked semantics, draft values and simplified choices in the themed settings', () => {
    function Settings() {
      const [configuration, setConfiguration] = useState(DEFAULT_DRAW_PRESENTATION_CONFIGURATION)
      return <DrawPresentationSettings configuration={configuration} winnerCount={6} disabled={false} onChange={setConfiguration} />
    }
    render(<Themed><Settings /></Themed>)
    const direct = screen.getByRole('radio', { name: /Tampil Langsung/ })
    const rolling = screen.getByRole('radio', { name: /Putar & Stop Manual/ })
    expect(direct).toHaveAttribute('aria-checked', 'true')
    expect(direct).toHaveClass('kc-presentation-choice--selected')
    expect(rolling).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(rolling)
    expect(rolling).toHaveAttribute('aria-checked', 'true')
    expect(rolling).toHaveClass('kc-presentation-choice--selected')
    expect(direct).toHaveAttribute('aria-checked', 'false')

    expect(screen.queryByRole('group', { name: 'Kecepatan putaran' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Mode pengungkapan' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Durasi putaran' })).not.toBeInTheDocument()
  })

  it('keeps locked settings disabled without dispatching a draft update', () => {
    const change = vi.fn()
    render(<Themed><DrawPresentationSettings configuration={{...DEFAULT_DRAW_PRESENTATION_CONFIGURATION,presentationMode:'random-number-roll'}} winnerCount={6} disabled onChange={change} /></Themed>)
    for (const radio of screen.getAllByRole('radio')) { expect(radio).toBeDisabled(); fireEvent.click(radio) }
    expect(change).not.toHaveBeenCalled()
  })

  it('retains legacy class defaults outside the production theme', () => {
    render(<DrawPresentationSettings configuration={DEFAULT_DRAW_PRESENTATION_CONFIGURATION} winnerCount={1} disabled={false} onChange={() => undefined} />)
    expect(screen.getByRole('radio', { name: /Tampil Langsung/ })).toHaveClass('presentation-choice')
    expect(document.querySelector('[class*="kc-"]')).toBeNull()
  })

  it('themes monitor chrome without replacing or renaming the frozen canvas', () => {
    render(<Themed><PresentationSupport previewStage="reveal" eventName="Fixture" prizeCategory="Door Prize" prizeName="Prize" result={result} blackoutRequested={false} /></Themed>)
    const preview = screen.getByTestId('production-preview')
    expect(preview).toHaveClass('production-preview')
    expect(preview.closest('aside')).toHaveClass('kc-production-presentation-support')
    expect(preview.querySelector('.production-preview__viewport > [data-audience-preview="true"]')).not.toBeNull()
    expect(preview.querySelector('[class*="kc-"]')).toBeNull()
    expect(preview).toHaveTextContent('00042')
  })

  it('keeps blackout in the actual Audience canvas', () => {
    render(<Themed><PresentationSupport previewStage="reveal" eventName="Fixture" prizeCategory="Door Prize" prizeName="Prize" result={result} blackoutRequested /></Themed>)
    expect(screen.getByTestId('production-preview')).toHaveAttribute('data-public-stage','blackout')
    expect(screen.getByTestId('production-preview').querySelector('.audience-display-page')).not.toBeNull()
    expect(screen.getByText('Status runtime')).toBeVisible()
  })

  it('propagates the theme to recovery portal while preserving the safe handoff', () => {
    const review = vi.fn(), back = vi.fn()
    render(<Themed><PresentationRecoveryDialog onBackToSetup={back} onReviewPendingResults={review} reviewPendingResultsAvailable /></Themed>)
    const dialog = screen.getByRole('dialog')
    expect(dialog.closest('[data-ui-theme="kocokan"]')).not.toBeNull()
    expect(dialog.querySelector('.kc-production-recovery-dialog__safe-state')).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(dialog).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tinjau Pemenang' }))
    expect(review).toHaveBeenCalledOnce()
    expect(back).not.toHaveBeenCalled()
  })

  it('keeps the themed presentation mount stable across countdown updates in StrictMode', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(timestamp))
    vi.stubGlobal('matchMedia', () => ({matches:false,addListener:vi.fn(),removeListener:vi.fn()}))
    const failure = vi.fn()
    render(<StrictMode><Themed><ProductionDrawPresentation result={result} mode="live" eventName="Fixture" prizeCategory="Door Prize" prizeName="Prize" initialPresentation={{stage:'countdown',stageStartedAt:timestamp,blackoutRequested:false}} checkpoints={{findByDrawSessionId:async()=>null,upsert:async()=>undefined}} onFailure={failure} /></Themed></StrictMode>)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    const preview = screen.getByTestId('production-preview')
    expect(screen.getByRole('heading', { name: 'Bersiap' })).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(screen.getByTestId('production-preview')).toBe(preview)
    expect(preview.closest('.kc-production-draw-run-shell')).not.toBeNull()
    expect(failure).not.toHaveBeenCalled()
  })
})
