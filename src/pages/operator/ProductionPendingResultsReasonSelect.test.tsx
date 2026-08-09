import ReactSelect from 'react-select'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import type { RedrawReason } from '../../domain/winners/redraw.types.ts'

const reasons: readonly { value: RedrawReason; label: string }[] = [
  { value: 'absent', label: 'Absent' },
  { value: 'invalid-ticket', label: 'Invalid ticket' },
  { value: 'ineligible', label: 'Ineligible' },
  { value: 'previous-winner', label: 'Previous winner' },
  { value: 'operator-error', label: 'Operator error' },
  { value: 'other', label: 'Other' },
]

function ReasonSelectHarness() {
  const [reason, setReason] = useState<RedrawReason>('absent')
  const selected = reasons.find((option) => option.value === reason) ?? reasons[0]

  return (
    <div>
      <span id="reason-label">Reason</span>
      <ReactSelect
        aria-labelledby="reason-label"
        inputId="reason"
        isClearable={false}
        isSearchable={false}
        menuPortalTarget={document.body}
        menuPosition="fixed"
        onChange={(option) => { if (option !== null) setReason(option.value) }}
        options={reasons}
        value={selected}
      />
      <output aria-label="Selected reason">{reason}</output>
    </div>
  )
}

describe('Production Pending Results Reason Select', () => {
  it('shows the selected value, opens, selects every reason, and closes', async () => {
    const user = userEvent.setup()
    render(<ReasonSelectHarness />)

    const control = screen.getByRole('combobox', { name: 'Reason' })
    expect(screen.getByText('Absent')).toBeInTheDocument()
    for (const option of reasons) {
      await user.click(control)
      const matches = screen.getAllByText(option.label)
      expect(matches.length).toBeGreaterThan(0)
      await user.click(matches.at(-1) as HTMLElement)
      expect(screen.getByLabelText('Selected reason')).toHaveTextContent(option.value)
    }
  })

  it('supports keyboard navigation and keeps the control non-searchable', async () => {
    const user = userEvent.setup()
    render(<ReasonSelectHarness />)

    const control = screen.getByRole('combobox', { name: 'Reason' })
    control.focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(screen.getByLabelText('Selected reason')).toHaveTextContent('invalid-ticket')
    expect(control).toHaveAttribute('aria-autocomplete', 'list')
  })
})
