import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UiThemeContext } from '../../shared/ui/ui-theme.ts'
import { DrawSetupSaveToast } from './DrawSetupSaveToast.tsx'

describe('DrawSetupSaveToast', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('renders compact Kocokan save feedback with a success icon', () => {
    const view = render(<UiThemeContext.Provider value="kocokan"><DrawSetupSaveToast onDismiss={vi.fn()} /></UiThemeContext.Provider>)
    expect(screen.getByRole('status')).toHaveTextContent('Sesi undian berhasil disimpan')
    expect(screen.getByRole('status')).toHaveClass('kc-draw-setup-save-toast')
    expect(view.container.querySelector('.kc-draw-setup-save-toast__icon svg')).toBeInTheDocument()
  })

  it('auto-dismisses after the brief success interval', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<UiThemeContext.Provider value="kocokan"><DrawSetupSaveToast onDismiss={onDismiss} /></UiThemeContext.Provider>)

    act(() => vi.advanceTimersByTime(2999))
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('status')).toHaveClass('kc-draw-setup-save-toast--exiting')
    act(() => vi.advanceTimersByTime(180))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
