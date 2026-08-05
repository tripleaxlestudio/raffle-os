import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductionDrawPresentation } from './ProductionDrawPresentation.tsx'
import type { PresentationResultProjection } from '../../../application/workflow/presentation-projection.ts'

function result(count: number): PresentationResultProjection {
  return { drawSessionId: '00000000-0000-4000-8000-000000000001' as never, winners: Array.from({ length: count }, (_, index) => ({ winnerId: `00000000-0000-4000-8000-${String(index + 2).padStart(12, '0')}` as never, sequence: index + 1, ticketNumber: index === 0 ? '00042' : String(index + 1) })) }
}

describe('ProductionDrawPresentation', () => {
  beforeEach(() => { vi.stubGlobal('matchMedia', () => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn() })) })

  it.each([1, 20, 50, 100])('reveals %i winners in sequence order without changing ticket strings', async (count) => {
    render(<ProductionDrawPresentation result={result(count)} mode="practice" eventName="Event" prizeCategory="Gold" prizeName="Prize" practiceResult={{ drawSessionId: result(count).drawSessionId, winners: result(count).winners as never, createdAt: '2026-08-05T00:00:00.000Z', policyVersion: 1 }} onFailure={() => undefined} />)
    expect(await screen.findByRole('list', { name: `${count} Practice winners` })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(count)
    expect(screen.getByText('00042')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip animation' })).not.toBeInTheDocument()
  })
})
