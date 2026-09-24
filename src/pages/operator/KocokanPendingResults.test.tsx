import { useState, type ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { parseTicketNumber } from '../../domain/participants/participant.invariants.ts'
import { parseWinnerRecordId } from '../../domain/shared/identifiers.ts'
import type { Result } from '../../domain/shared/result.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import { UiThemeContext } from '../../shared/ui/ui-theme.ts'
import { PendingResultsSummary, PendingWinnerGrid, ReasonSelect } from './ProductionPendingResultsPage.tsx'

function valid<T>(result: Result<T>): T {
  if (!result.ok) throw new Error('Invalid Kocokan Pending fixture')
  return result.value
}

function Themed({ children }: { readonly children: ReactNode }) {
  return <UiThemeContext.Provider value="kocokan"><div data-ui-theme="kocokan">{children}</div></UiThemeContext.Provider>
}

function winner(sequenceNumber: number, status: WinnerRecord['status'] = 'pending') {
  const suffix = sequenceNumber.toString().padStart(12, '0')
  return {
    id: valid(parseWinnerRecordId(`00000000-0000-4000-8000-${suffix}`)),
    sequenceNumber,
    ticketNumber: valid(parseTicketNumber(sequenceNumber.toString().padStart(6, '0'))),
    status,
  }
}

function SelectionHarness({ count }: { readonly count: number }) {
  const winners = Array.from({ length: count }, (_, index) => winner(index + 1))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  return <Themed>
    <button onClick={() => setSelected(new Set(winners.map((entry) => entry.id)))}>Pilih semua fixture</button>
    <button onClick={() => setSelected(new Set())}>Bersihkan fixture</button>
    <PendingWinnerGrid winners={winners} selected={selected} busy={false} onToggle={(winnerId) => setSelected((current) => {
      const next = new Set(current)
      if (next.has(winnerId)) next.delete(winnerId)
      else next.add(winnerId)
      return next
    })} />
  </Themed>
}

describe('Kocokan Pending Results visual contracts', () => {
  it('orders the five existing metrics by approved operational priority without changing values', () => {
    render(<Themed><PendingResultsSummary total={20} pending={6} confirmed={10} cancelled={3} replacements={1} /></Themed>)

    const summary = screen.getByLabelText('Ringkasan hasil')
    const metrics = Array.from(summary.querySelectorAll<HTMLElement>('.pending-results__metric'))
    expect(metrics.map((metric) => metric.textContent)).toEqual([
      'Tertunda6',
      'Dikonfirmasi10',
      'Dibatalkan3',
      'Pengganti1',
      'Total pemenang20',
    ])
    expect(metrics.map((metric) => metric.dataset.metricPriority)).toEqual(['1', '2', '3', '4', '5'])
  })

  it.each([1, 6, 10, 20, 50, 100])('keeps %i exact ordered ticket rows reachable without pagination', (count) => {
    render(<SelectionHarness count={count} />)

    const grid = screen.getByRole('list', { name: 'Pemenang tertunda' })
    const rows = Array.from(grid.querySelectorAll<HTMLElement>('.pending-results__winner-row'))
    expect(rows).toHaveLength(count)
    expect(rows[0]).toHaveTextContent('000001')
    expect(rows.at(-1)).toHaveTextContent(count.toString().padStart(6, '0'))
    expect(screen.getAllByRole('checkbox')).toHaveLength(count)
  })

  it('keeps lavender selection state explicit through individual, multi, select-all, focus and clear changes', async () => {
    const user = userEvent.setup()
    render(<SelectionHarness count={6} />)

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0])
    const firstRow = checkboxes[0].closest('.pending-results__winner-row')
    expect(checkboxes[0]).toBeChecked()
    expect(firstRow).toHaveAttribute('data-selected', 'true')
    expect(firstRow).toHaveClass('pending-results__winner-row--selected')
    fireEvent.mouseOver(firstRow as HTMLElement)
    checkboxes[0].focus()
    expect(firstRow).toHaveAttribute('data-selected', 'true')

    await user.click(checkboxes[1])
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Pilih semua fixture' }))
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(6)
    await user.click(screen.getByRole('button', { name: 'Bersihkan fixture' }))
    expect(screen.queryAllByRole('checkbox', { checked: true })).toHaveLength(0)
  })

  it('keeps confirmed and cancelled rows visible but ineligible for selection', () => {
    render(<Themed><PendingWinnerGrid winners={[winner(1), winner(2, 'confirmed'), winner(3, 'cancelled')]} selected={new Set()} busy={false} onToggle={() => undefined} /></Themed>)

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes[0]).toBeEnabled()
    expect(checkboxes[1]).toBeDisabled()
    expect(checkboxes[2]).toBeDisabled()
    expect(screen.getByText('Dikonfirmasi')).toBeVisible()
    expect(screen.getByText('Dipertahankan dalam riwayat resmi')).toBeVisible()
  })

  it('propagates the Kocokan light token boundary into the existing reason-select portal', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [reason, setReason] = useState<'absent' | 'other'>('absent')
      return <Themed><ReasonSelect id="slice4-reason" reason={reason} busy={false} onChange={(value) => setReason(value === 'other' ? 'other' : 'absent')} /></Themed>
    }
    render(<Harness />)

    await user.click(screen.getByRole('combobox', { name: 'Alasan' }))
    const menu = document.querySelector<HTMLElement>('.raffle-reason-select__menu')
    expect(menu).toHaveAttribute('data-ui-theme', 'kocokan')
    expect(screen.getByRole('option', { name: 'Tidak Hadir' })).toBeVisible()
    expect(screen.getByRole('option', { name: 'Lainnya' })).toBeVisible()
  })
})
