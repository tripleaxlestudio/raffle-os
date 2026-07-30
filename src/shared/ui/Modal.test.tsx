import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button.tsx'
import { ConfirmationDialog } from './ConfirmationDialog.tsx'

function DialogHarness({ onConfirm = vi.fn() }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open confirmation</Button>
      <ConfirmationDialog
        confirmLabel="Advance prototype"
        consequence="No product behavior or mutation will occur."
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          onConfirm()
          setOpen(false)
        }}
        open={open}
        title="Advance static state?"
      />
    </>
  )
}

describe('Modal and ConfirmationDialog', () => {
  it('has an accessible name and places initial focus on cancel', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    await user.click(
      screen.getByRole('button', { name: 'Open confirmation' }),
    )

    expect(
      screen.getByRole('dialog', { name: 'Advance static state?' }),
    ).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(
      screen.getByRole('button', { name: 'Close dialog' }),
    ).toBeVisible()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)
    const trigger = screen.getByRole('button', {
      name: 'Open confirmation',
    })

    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('closes on cancel and returns focus without confirming', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<DialogHarness onConfirm={onConfirm} />)
    const trigger = screen.getByRole('button', {
      name: 'Open confirmation',
    })

    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('confirms explicitly and does not invoke any other behavior', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<DialogHarness onConfirm={onConfirm} />)

    await user.click(
      screen.getByRole('button', { name: 'Open confirmation' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Advance prototype' }),
    )

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cycles keyboard focus within the dialog', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    await user.click(
      screen.getByRole('button', { name: 'Open confirmation' }),
    )
    const close = screen.getByRole('button', { name: 'Close dialog' })
    const confirm = screen.getByRole('button', {
      name: 'Advance prototype',
    })

    close.focus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(confirm).toHaveFocus()

    await user.tab()
    expect(close).toHaveFocus()
  })
})
