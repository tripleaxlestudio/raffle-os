import { describe, expect, it, vi } from 'vitest'
import { openExternalLink, type ExternalLinkHost, type ExternalWindow } from './external-link.ts'

describe('openExternalLink', () => {
  it('opens a new browsing context without navigating the current page', () => {
    const opened: ExternalWindow = { opener: window, focus: vi.fn() }
    const host: ExternalLinkHost = { open: vi.fn(() => opened) }
    const currentLocation = window.location.href

    expect(openExternalLink('https://docs.google.com/forms/example/viewform', host)).toBe('opened')
    expect(host.open).toHaveBeenCalledWith('https://docs.google.com/forms/example/viewform', '_blank')
    expect(opened.opener).toBeNull()
    expect(opened.focus).toHaveBeenCalledOnce()
    expect(window.location.href).toBe(currentLocation)
  })

  it('returns a non-throwing blocked result for popup failure', () => {
    expect(openExternalLink('https://docs.google.com/forms/example/viewform', { open: vi.fn(() => null) })).toBe('blocked')
    expect(openExternalLink('https://docs.google.com/forms/example/viewform', { open: vi.fn(() => { throw new Error('blocked') }) })).toBe('blocked')
  })
})
