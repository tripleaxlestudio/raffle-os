import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toast } from './Toast.tsx'

describe('Toast', () => {
  it('uses status semantics for readable non-urgent messages', () => {
    render(
      <Toast
        description="No participant fixture was changed."
        title="Prototype action complete"
        variant="success"
      />,
    )

    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Prototype action complete')
    expect(toast).toHaveTextContent('No participant fixture was changed.')
    expect(toast).toHaveClass('ui-toast--success')
  })

  it('uses alert semantics only when explicitly urgent', () => {
    render(
      <Toast
        title="Prototype warning"
        urgent
        variant="danger"
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Prototype warning')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('supports an accessible dismiss action', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <Toast
        dismissLabel="Dismiss prototype notice"
        onDismiss={onDismiss}
        title="Prototype only"
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Dismiss prototype notice',
      }),
    )

    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('does not schedule automatic dismissal', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    try {
      render(<Toast title="Persistent prototype notice" />)
      expect(setTimeoutSpy).not.toHaveBeenCalled()
      expect(screen.getByRole('status')).toBeInTheDocument()
    } finally {
      setTimeoutSpy.mockRestore()
    }
  })
})
