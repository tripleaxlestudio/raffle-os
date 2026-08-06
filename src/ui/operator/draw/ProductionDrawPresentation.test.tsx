import { StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductionDrawPresentation } from './ProductionDrawPresentation.tsx'
import type { PresentationResultProjection } from '../../../application/workflow/presentation-projection.ts'

function result(count: number): PresentationResultProjection {
  return { drawSessionId: '00000000-0000-4000-8000-000000000001' as never, winners: Array.from({ length: count }, (_, index) => ({ winnerId: `00000000-0000-4000-8000-${String(index + 2).padStart(12, '0')}` as never, sequence: index + 1, ticketNumber: index === 0 ? '00042' : String(index + 1) })) }
}

describe('ProductionDrawPresentation', () => {
  beforeEach(() => { vi.stubGlobal('matchMedia', () => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn() })) })
  afterEach(() => { vi.useRealTimers() })

  it.each([1, 20, 50, 100])('reveals %i winners in sequence order without changing ticket strings', async (count) => {
    render(<ProductionDrawPresentation result={result(count)} mode="practice" eventName="Event" prizeCategory="Gold" prizeName="Prize" practiceResult={{ drawSessionId: result(count).drawSessionId, winners: result(count).winners as never, createdAt: '2026-08-05T00:00:00.000Z', policyVersion: 1 }} onFailure={() => undefined} />)
    expect(await screen.findByRole('list', { name: `${count} Practice winners` })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(count)
    expect(screen.getByText('00042')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip animation' })).not.toBeInTheDocument()
  })

  it('bootstraps a Live result without a checkpoint by writing countdown first', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }))
    const upsert = vi.fn(async () => undefined)
    const findByDrawSessionId = vi.fn(async () => null)
    render(<ProductionDrawPresentation result={result(1)} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" checkpoints={{ findByDrawSessionId, upsert }} onFailure={() => undefined} />)
    expect(await screen.findByRole('heading', { name: 'Get ready' })).toBeInTheDocument()
    expect(findByDrawSessionId).toHaveBeenCalledWith(result(1).drawSessionId)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ stage: 'countdown', drawSessionId: result(1).drawSessionId }))
  })

  it('shows a typed safe error when the Live countdown checkpoint write fails', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }))
    render(<ProductionDrawPresentation result={result(1)} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" checkpoints={{ findByDrawSessionId: async () => null, upsert: async () => { throw new Error('write rejected') } }} onFailure={() => undefined} />)
    expect(await screen.findByText('Official result is locked, but presentation could not start.')).toBeInTheDocument()
    expect(screen.queryByText('Preparing locked result presentation…')).not.toBeInTheDocument()
  })

  it('exposes rehearsal reset only for completed Practice presentation', async () => {
    const onResetPractice = vi.fn()
    render(<ProductionDrawPresentation result={result(1)} mode="practice" eventName="Event" prizeCategory="Gold" prizeName="Prize" practiceResult={{ drawSessionId: result(1).drawSessionId, winners: result(1).winners as never, createdAt: '2026-08-05T00:00:00.000Z', policyVersion: 1, presentation: { storageFormatVersion: 1, stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, presentationPolicyVersion: 1, blackoutRequested: false } }} onFailure={() => undefined} onResetPractice={onResetPractice} />)
    expect(await screen.findByRole('heading', { name: 'Winner reveal' })).toBeInTheDocument()
    await screen.findByRole('button', { name: 'Reset rehearsal' }).then((button) => button.click())
    expect(onResetPractice).toHaveBeenCalledTimes(1)
  })

  it('does not expose rehearsal reset for Live presentation', async () => {
    render(<ProductionDrawPresentation result={result(1)} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false }} onFailure={() => undefined} onResetPractice={vi.fn()} />)
    expect(await screen.findByRole('heading', { name: 'Winner reveal' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset rehearsal' })).not.toBeInTheDocument()
  })

  it('survives Strict Mode recovery hydration and continues from the persisted stage', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T00:00:00.000Z'))
    vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }))
    const recoveredAt = '2026-08-05T00:00:00.000Z' as never
    render(<StrictMode><ProductionDrawPresentation result={result(1)} mode="live" eventName="Event" prizeCategory="Gold" prizeName="Prize" initialPresentation={{ stage: 'countdown', stageStartedAt: recoveredAt, blackoutRequested: false }} checkpoints={{ findByDrawSessionId: async () => null, upsert: async () => undefined }} onFailure={() => undefined} /></StrictMode>)

    await Promise.resolve()
    expect(screen.getByRole('heading', { name: 'Get ready' })).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getByRole('heading', { name: 'Selecting winners' })).toBeInTheDocument()
    expect(screen.queryByText('The presentation stage transition is invalid.')).not.toBeInTheDocument()
  })
})
