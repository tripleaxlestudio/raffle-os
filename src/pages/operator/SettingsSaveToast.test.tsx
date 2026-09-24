import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsSaveToast } from './SettingsSaveToast.tsx'

describe('SettingsSaveToast', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('renders an accessible success toast with title and tab detail', () => {
    const view = render(<SettingsSaveToast kind="success" message="Branding settings saved" onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Settings saved')).toBeInTheDocument()
    expect(screen.getByText('Branding settings saved')).toBeInTheDocument()
    expect(view.container.firstElementChild).toHaveClass('settings-toast')
    expect(view.container.firstElementChild).not.toHaveClass('settings-toast--error')
  })

  it('auto-dismisses success, supports close, and keeps errors until dismissed', () => {
    vi.useFakeTimers()
    const successDismiss = vi.fn()
    render(<SettingsSaveToast kind="success" message="Display settings saved" onDismiss={successDismiss} />)
    vi.advanceTimersByTime(3179)
    expect(successDismiss).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(successDismiss).toHaveBeenCalledOnce()

    const errorDismiss = vi.fn()
    const error = render(<SettingsSaveToast kind="error" message="Display settings could not be saved. Try again." onDismiss={errorDismiss} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to save settings')
    vi.advanceTimersByTime(10000)
    expect(errorDismiss).not.toHaveBeenCalled()
    within(error.container).getByRole('button', { name: 'Close notification' }).click()
    vi.advanceTimersByTime(180)
    expect(errorDismiss).toHaveBeenCalledOnce()
  })

  it('replaces the active toast and dismisses immediately when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const onDismiss = vi.fn()
    const view = render(<SettingsSaveToast kind="success" message="Branding settings saved" onDismiss={onDismiss} />)
    view.rerender(<SettingsSaveToast kind="success" message="Audio settings saved" onDismiss={onDismiss} />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByText('Audio settings saved')).toBeInTheDocument()
    screen.getByRole('button', { name: 'Close notification' }).click()
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
