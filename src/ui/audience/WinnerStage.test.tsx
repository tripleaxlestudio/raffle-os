import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WinnerStage } from './WinnerStage.tsx'
import { SEQUENTIAL_REVEAL_INTERVAL_MS, visibleWinnerCount } from './sequential-reveal.ts'
import type { PublicAudienceScenario } from './audience-view.types.ts'

const tickets = ['00042', '42', '00007', '100', '00099', '501']
const scenario = (overrides: Partial<PublicAudienceScenario> = {}): PublicAudienceScenario => ({
  eventName: 'Event', eventSubtitle: 'Subtitle', prizeCategory: 'Prize', prizeLabel: 'Winner', state: 'reveal',
  ticketNumbers: tickets, revealMode: 'sequential', revealStartedAt: new Date(0).toISOString(), ...overrides,
})

describe('Audience sequential winner reveal', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0) })
  afterEach(() => { vi.useRealTimers() })

  it('shows together immediately and preserves authoritative order and strings', () => {
    render(<WinnerStage scenario={scenario({ revealMode: 'all-together' })} />)
    expect(screen.getAllByText(/^(00042|42|00007|100|00099|501)$/).map((node) => node.textContent)).toEqual(tickets)
  })

  it('progresses locally from the reveal timestamp without transport updates', () => {
    render(<WinnerStage scenario={scenario()} />)
    expect(screen.getAllByText('00042')).toHaveLength(1)
    expect(screen.queryByText('42')).not.toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(SEQUENTIAL_REVEAL_INTERVAL_MS) })
    expect(screen.getByText('42')).toBeVisible()
    act(() => { vi.advanceTimersByTime(SEQUENTIAL_REVEAL_INTERVAL_MS * 4) })
    expect(screen.getAllByText(/^(00042|42|00007|100|00099|501)$/)).toHaveLength(6)
  })

  it('reconstructs the visible position after refresh or late join', () => {
    vi.setSystemTime(SEQUENTIAL_REVEAL_INTERVAL_MS * 3 + 400)
    render(<WinnerStage scenario={scenario()} />)
    expect(screen.getAllByText(/^(00042|42|00007|100)$/)).toHaveLength(4)
    expect(screen.queryByText('00099')).not.toBeInTheDocument()
  })

  it.each([1, 6, 10, 20, 50])('reserves a bounded %i-slot layout', (count) => {
    const values = Array.from({ length: count }, (_, index) => String(index + 1))
    const { container } = render(<WinnerStage scenario={scenario({ ticketNumbers: values, revealMode: 'all-together' })} />)
    const grid = container.querySelector('[data-winner-count]')
    expect(grid?.querySelectorAll('[data-ticket-tile]')).toHaveLength(count)
    expect(grid).toHaveAttribute('data-rows', String(Math.ceil(count / (count === 1 ? 1 : count <= 6 ? 3 : 5))))
  })

  it('does not delay a single sequential winner', () => {
    render(<WinnerStage scenario={scenario({ ticketNumbers: ['00042'] })} />)
    expect(screen.getByText('00042')).toBeVisible()
    expect(visibleWinnerCount(new Date(100000).toISOString(), 1, 0)).toBe(1)
  })
})
