import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RandomNumberRollStage } from './RandomNumberRollStage.tsx'
import type { PublicAudienceScenario } from './audience-view.types.ts'

const baseScenario = (overrides: Partial<PublicAudienceScenario> = {}): PublicAudienceScenario => ({
  eventName: 'Event', eventSubtitle: 'Subtitle', prizeCategory: 'Door Prize', prizeLabel: 'Sepeda',
  state: 'rolling', presentationMode: 'random-number-roll', rollingStartedAt: new Date(0).toISOString(),
  ticketNumbers: ['754838', '291405', '736194'], layoutCount: 3, revealMode: 'all-together', ...overrides,
})

describe('Random Number Roll presentation continuity', () => {
  it('shows stable exact draw identity across rolling and reveal without remounting the stage', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const view = render(<RandomNumberRollStage scenario={baseScenario()} />)
    const root = view.container.querySelector('[data-audience-state]')
    const grid = view.container.querySelector('[data-testid="winner-grid"]')
    const slots = [...view.container.querySelectorAll('[data-ticket-tile]')]
    expect(view.container.querySelectorAll('[data-reveal-entrance="true"]')).toHaveLength(3)
    expect(screen.getByText('Current draw')).toBeInTheDocument()
    expect(screen.getByText('Door Prize')).toBeInTheDocument()
    expect(screen.getByText('Sepeda')).toBeInTheDocument()

    view.rerender(<RandomNumberRollStage scenario={baseScenario({ state: 'reveal', revealStartedAt: new Date(0).toISOString() })} />)

    expect(view.container.querySelector('[data-audience-state]')).toBe(root)
    expect(view.container.querySelector('[data-testid="winner-grid"]')).toBe(grid)
    expect([...view.container.querySelectorAll('[data-ticket-tile]')]).toEqual(slots)
    expect(screen.getByText('Results under verification')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Winner' })).toBeInTheDocument()
    expect(screen.getByText('Current draw')).toBeInTheDocument()
    expect(screen.getByText('Door Prize')).toBeInTheDocument()
    expect(screen.getByText('Sepeda')).toBeInTheDocument()
    expect(view.container.textContent).not.toContain('Â·')
    expect(view.container.querySelectorAll('[data-reveal-entrance="false"]')).toHaveLength(3)
    vi.useRealTimers()
  })

  it('keeps sequential slots mounted while authoritative values lock in place', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const view = render(<RandomNumberRollStage scenario={baseScenario({ state: 'reveal', revealMode: 'sequential', revealStartedAt: new Date(0).toISOString() })} />)
    const slots = [...view.container.querySelectorAll('[data-ticket-tile]')]
    expect(view.container.querySelectorAll('[data-locked="false"]')).toHaveLength(2)

    act(() => { vi.advanceTimersByTime(800) })

    expect([...view.container.querySelectorAll('[data-ticket-tile]')]).toEqual(slots)
    expect(view.container.querySelectorAll('[data-locked="true"]')).toHaveLength(2)
    vi.useRealTimers()
  })
})
