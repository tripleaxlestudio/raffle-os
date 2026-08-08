import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WinnerStage } from './WinnerStage.tsx'
import { RollingStage } from './RollingStage.tsx'
import { winnerLayoutTier } from './winner-layout.ts'
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

  it('keeps the authoritative draw identity visible for Instant Reveal and dense winner grids', () => {
    const values = Array.from({ length: 50 }, (_, index) => String(index + 1).padStart(5, '0'))
    const { container } = render(<WinnerStage scenario={scenario({ presentationMode: 'instant-reveal', revealMode: 'all-together', prizeCategory: 'Door Prize', prizeLabel: 'Sepeda', ticketNumbers: values })} />)
    expect(screen.getByText('Door Prize')).toBeVisible()
    expect(screen.getByText('Sepeda')).toBeVisible()
    expect(container.querySelectorAll('.winner-grid__row')).toHaveLength(5)
    expect(container.textContent).not.toContain('Â·')
  })

  it('shows together immediately and preserves authoritative order and strings', () => {
    render(<WinnerStage scenario={scenario({ revealMode: 'all-together' })} />)
    expect(screen.getAllByText(/^(00042|42|00007|100|00099|501)$/).map((node) => node.textContent)).toEqual(tickets)
  })

  it('locks Random Number Roll together values immediately without reveal entrance state', () => {
    const { container } = render(<WinnerStage scenario={scenario({ presentationMode: 'random-number-roll', revealMode: 'all-together' })} />)
    const grid = container.querySelector('[data-winner-count]')
    expect(screen.getAllByText(/^(00042|42|00007|100|00099|501)$/).map((node) => node.textContent)).toEqual(tickets)
    expect(grid?.querySelectorAll('[data-reveal-entrance="true"]')).toHaveLength(0)
    expect(grid?.querySelectorAll('[data-ticket-tile]')).toHaveLength(tickets.length)
    expect(grid).toHaveAttribute('data-grid-layout', '3x2')
  })

  it('keeps Instant Reveal entrance treatment', () => {
    const { container } = render(<WinnerStage scenario={scenario({ presentationMode: 'instant-reveal', revealMode: 'all-together' })} />)
    expect(container.querySelectorAll('[data-reveal-entrance="true"]')).toHaveLength(tickets.length)
  })

  it('keeps the rolling-stage entrance treatment before any winner lock', () => {
    const { container } = render(<RollingStage scenario={scenario({ state: 'rolling', presentationMode: 'random-number-roll', prototypeStatic: false })} />)
    expect(container.querySelectorAll('[data-reveal-entrance="true"]')).toHaveLength(tickets.length)
    expect(container.querySelectorAll('[data-locked="false"]')).toHaveLength(tickets.length)
  })

  it('locks Random Number Roll sequential slots directly while remaining slots keep rolling', () => {
    const { container } = render(<WinnerStage scenario={scenario({ presentationMode: 'random-number-roll' })} />)
    const grid = container.querySelector('[data-winner-count]')
    const firstTile = grid?.querySelectorAll('[data-ticket-tile]')[0]
    const secondTile = grid?.querySelectorAll('[data-ticket-tile]')[1]
    expect(firstTile).toHaveAttribute('data-locked', 'true')
    expect(firstTile).toHaveAttribute('data-reveal-entrance', 'false')
    expect(firstTile).toHaveTextContent('00042')
    expect(secondTile).toHaveAttribute('data-locked', 'false')
    expect(secondTile?.querySelector('.ticket-tile__number')).not.toHaveTextContent(/^42$/)
    expect(secondTile).toHaveAttribute('data-reveal-entrance', 'false')
    const geometry = grid?.getAttribute('data-grid-layout')

    act(() => { vi.advanceTimersByTime(SEQUENTIAL_REVEAL_INTERVAL_MS) })

    expect(grid?.getAttribute('data-grid-layout')).toBe(geometry)
    expect(grid?.querySelectorAll('[data-ticket-tile]')).toHaveLength(tickets.length)
    expect(grid?.querySelectorAll('[data-locked="true"]')).toHaveLength(2)
    expect(secondTile).toHaveAttribute('data-locked', 'true')
    expect(secondTile?.querySelector('.ticket-tile__number')).toHaveTextContent('42')
    expect(secondTile).toHaveAttribute('data-reveal-entrance', 'false')
  })

  it('locks a single Random Number Roll winner without reveal entrance state', () => {
    const { container } = render(<WinnerStage scenario={scenario({ presentationMode: 'random-number-roll', ticketNumbers: ['00044'], revealMode: 'all-together' })} />)
    const tile = container.querySelector('[data-ticket-tile]')
    expect(tile).toHaveTextContent('00044')
    expect(tile).toHaveAttribute('data-locked', 'true')
    expect(tile).toHaveAttribute('data-reveal-entrance', 'false')
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

  it('keeps every sequential slot mounted while only lock state advances', () => {
    const { container } = render(<WinnerStage scenario={scenario()} />)
    const grid = container.querySelector('[data-winner-count]')
    expect(grid?.querySelectorAll('[data-ticket-tile]')).toHaveLength(tickets.length)
    expect(grid?.querySelectorAll('[data-locked="true"]')).toHaveLength(1)
    expect(grid?.querySelectorAll('[data-locked="false"]')).toHaveLength(tickets.length - 1)
    expect(screen.queryByLabelText('Winner pending')).not.toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(SEQUENTIAL_REVEAL_INTERVAL_MS) })
    expect(grid?.querySelectorAll('[data-ticket-tile]')).toHaveLength(tickets.length)
    expect(grid?.querySelectorAll('[data-locked="true"]')).toHaveLength(2)
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
    expect(grid).toHaveAttribute('data-rows', String(Math.ceil(count / (count === 1 ? 1 : count <= 3 ? count : count <= 6 ? 3 : count <= 20 ? 5 : 10))))
  })

  it.each([
    [1, 'a', 'hero'], [2, 'b', '2x1'], [3, 'b', '3x1'], [6, 'c', '3x2'],
    [10, 'd', '5x2'], [20, 'e', '5x4'], [50, 'f', '10x5'],
  ] as const)('uses the stable %s-winner tier and geometry', (count, tier, layout) => {
    const values = Array.from({ length: count }, (_, index) => String(index + 1).padStart(5, '0'))
    const { container } = render(<WinnerStage scenario={scenario({ ticketNumbers: values, revealMode: 'all-together' })} />)
    const grid = container.querySelector('[data-winner-count]')
    expect(winnerLayoutTier(count)).toBe(tier)
    expect(grid).toHaveAttribute('data-layout-tier', tier)
    expect(grid).toHaveAttribute('data-grid-layout', layout)
    expect(grid?.querySelectorAll('[data-ticket-tile]')).toHaveLength(count)
    expect(screen.getAllByText(values[0])).toHaveLength(1)
  })

  it('keeps the large tier on rolling slots before reveal', () => {
    const values = ['00044', '45574', '00007']
    const { container } = render(<WinnerStage scenario={scenario({ state: 'reveal', ticketNumbers: values })} />)
    expect(container.querySelector('[data-layout-tier="b"]')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-ticket-tile]')).toHaveLength(3)
  })

  it('centers the 3-winner rolling and reveal groups without distributed columns', () => {
    const values = ['00044', '45574', '00007']
    const rolling = render(<RollingStage scenario={scenario({ state: 'rolling', ticketNumbers: values, prototypeStatic: true })} />)
    const rollingGrid = rolling.container.querySelector('[data-winner-count]')
    expect(rollingGrid).toHaveAttribute('data-layout-tier', 'b')
    expect(rollingGrid).toHaveAttribute('data-layout-group', 'centered')
    expect(rollingGrid).toHaveStyle({ width: 'fit-content' })
    expect(rollingGrid).toHaveStyle({ gridTemplateColumns: 'repeat(3, minmax(min(18rem, 28vw), 26rem))' })
    rolling.unmount()

    const reveal = render(<WinnerStage scenario={scenario({ ticketNumbers: values, revealMode: 'all-together' })} />)
    const revealGrid = reveal.container.querySelector('[data-winner-count]')
    expect(revealGrid).toHaveAttribute('data-layout-group', 'centered')
    expect(revealGrid).toHaveStyle({ width: 'fit-content' })
    expect(revealGrid).toHaveStyle({ gridTemplateColumns: 'repeat(3, minmax(min(18rem, 28vw), 26rem))' })
    expect(screen.getByText('45574')).toBeInTheDocument()
  })

  it('preserves the single-winner hero layout while keeping ticket strings exact', () => {
    const { container } = render(<WinnerStage scenario={scenario({ ticketNumbers: ['00044'], revealMode: 'all-together' })} />)
    const grid = container.querySelector('[data-winner-count]')
    expect(grid).toHaveAttribute('data-layout-tier', 'a')
    expect(grid).toHaveAttribute('data-layout-group', 'distributed')
    expect(grid).not.toHaveStyle({ width: 'fit-content' })
    expect(screen.getByText('00044')).toBeInTheDocument()
  })

  it('does not delay a single sequential winner', () => {
    render(<WinnerStage scenario={scenario({ ticketNumbers: ['00042'] })} />)
    expect(screen.getByText('00042')).toBeVisible()
    expect(visibleWinnerCount(new Date(100000).toISOString(), 1, 0)).toBe(1)
  })

  it.each([
    [4, [2, 2]], [5, [3, 2]], [6, [3, 3]], [7, [4, 3]], [8, [4, 4]],
    [9, [5, 4]], [10, [5, 5]], [20, [5, 5, 5, 5]], [50, [10, 10, 10, 10, 10]],
  ] as const)('renders %i winners as distinct centered rows', (count, composition) => {
    const values = Array.from({ length: count }, (_, index) => String(index + 1).padStart(5, '0'))
    const { container } = render(<WinnerStage scenario={scenario({ ticketNumbers: values, revealMode: 'all-together' })} />)
    const grid = container.querySelector('[data-testid="winner-grid"]')
    const rows = [...(grid?.querySelectorAll('.winner-grid__row') ?? [])]
    expect(rows.map((row) => row.children.length)).toEqual(composition)
    expect(rows.reduce((total, row) => total + row.querySelectorAll('[data-ticket-tile]').length, 0)).toBe(count)
    expect(new Set([...grid!.querySelectorAll('.ticket-tile__number')].map((node) => node.textContent)).size).toBe(count)
  })

  it('keeps the same row wrappers and slot positions between rolling and reveal', () => {
    const values = Array.from({ length: 7 }, (_, index) => String(index + 1).padStart(5, '0'))
    const rolling = render(<RollingStage scenario={scenario({ state: 'rolling', ticketNumbers: values, rollingSlotCount: 7, prototypeStatic: true })} />)
    const rollingRows = [...rolling.container.querySelectorAll('.winner-grid__row')].map((row) => row.children.length)
    rolling.unmount()
    const reveal = render(<WinnerStage scenario={scenario({ ticketNumbers: values, revealMode: 'all-together' })} />)
    expect([...reveal.container.querySelectorAll('.winner-grid__row')].map((row) => row.children.length)).toEqual(rollingRows)
  })

  it.each([5, 6, 7, 9, 10, 20])('centers the outer %i-winner composition in rolling and reveal', (count) => {
    const values = Array.from({ length: count }, (_, index) => String(index + 1).padStart(5, '0'))
    const rolling = render(<RollingStage scenario={scenario({ state: 'rolling', ticketNumbers: values, rollingSlotCount: count, prototypeStatic: true })} />)
    expect(rolling.container.querySelector('[data-testid="winner-grid"]')).toHaveStyle({ marginInline: 'auto', justifySelf: 'center', alignItems: 'center' })
    rolling.unmount()
    const reveal = render(<WinnerStage scenario={scenario({ ticketNumbers: values, revealMode: 'all-together' })} />)
    expect(reveal.container.querySelector('[data-testid="winner-grid"]')).toHaveStyle({ marginInline: 'auto', justifySelf: 'center', alignItems: 'center' })
  })
})
