import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AUDIENCE_DISPLAY_WINDOW_NAME,
  openManagedAudienceDisplay,
  resetManagedAudienceDisplayForTests,
  type AudienceWindowHost,
  type ManagedAudienceWindow,
} from './managed-audience-display.ts'

function createWindow(): ManagedAudienceWindow {
  return { closed: false, focus: vi.fn(), opener: {} }
}

afterEach(resetManagedAudienceDisplayForTests)

describe('managed Audience Display window', () => {
  it('focuses the managed display instead of opening another tab for repeated clicks', () => {
    const audienceWindow = createWindow()
    const host: AudienceWindowHost = { open: vi.fn(() => audienceWindow) }

    expect(openManagedAudienceDisplay('/display?eventId=event-1', host)).toBe('opened')
    expect(openManagedAudienceDisplay('/display?eventId=event-1', host)).toBe('focused')

    expect(host.open).toHaveBeenCalledOnce()
    expect(host.open).toHaveBeenCalledWith('/display?eventId=event-1', AUDIENCE_DISPLAY_WINDOW_NAME)
    expect(audienceWindow.focus).toHaveBeenCalledTimes(2)
    expect(audienceWindow.opener).toBeNull()
  })

  it('opens a replacement after the managed display is closed', () => {
    const first = createWindow()
    const second = createWindow()
    const host: AudienceWindowHost = { open: vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second) }

    expect(openManagedAudienceDisplay('/display?eventId=event-1', host)).toBe('opened')
    Object.defineProperty(first, 'closed', { value: true })
    expect(openManagedAudienceDisplay('/display?eventId=event-1', host)).toBe('opened')

    expect(host.open).toHaveBeenCalledTimes(2)
    expect(second.focus).toHaveBeenCalledOnce()
  })

  it('reuses the named display context when the active display URL changes', () => {
    const audienceWindow = createWindow()
    const host: AudienceWindowHost = { open: vi.fn(() => audienceWindow) }

    openManagedAudienceDisplay('/display?eventId=event-1', host)
    expect(openManagedAudienceDisplay('/display?eventId=event-2', host)).toBe('focused')

    expect(host.open).toHaveBeenNthCalledWith(2, '/display?eventId=event-2', AUDIENCE_DISPLAY_WINDOW_NAME)
  })

  it('reports a blocked popup without retaining a window', () => {
    const host: AudienceWindowHost = { open: vi.fn(() => null) }

    expect(openManagedAudienceDisplay('/display?eventId=event-1', host)).toBe('blocked')
    expect(openManagedAudienceDisplay('/display?eventId=event-1', host)).toBe('blocked')
    expect(host.open).toHaveBeenCalledTimes(2)
  })
})
