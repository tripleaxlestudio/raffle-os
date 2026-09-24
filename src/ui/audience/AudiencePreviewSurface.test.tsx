import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudiencePreviewSurface } from './AudiencePreviewSurface.tsx'

describe('AudiencePreviewSurface', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders branding, safe area, colors, and a cover background without runtime transport', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:logo').mockReturnValueOnce('blob:background')
    const view = render(<AudiencePreviewSurface accentColor="#f2a93b" background={{ blob: new Blob(['background'], { type: 'image/png' }), name: 'bg.png', size: 10, type: 'image/png' }} displayName="Public Gala" logo={{ blob: new Blob(['logo'], { type: 'image/png' }), name: 'logo.png', size: 8, type: 'image/png' }} primaryColor="#7567ff" safeAreaMargin={48} subtitle="Public subtitle" />)

    expect(screen.getByText('Public Gala')).toBeInTheDocument()
    expect(screen.getByText('Public subtitle')).toBeInTheDocument()
    expect(view.container.querySelector('img')).toHaveAttribute('src', 'blob:logo')
    expect(view.container.querySelector('.audience-preview-surface')).toHaveStyle({ '--audience-background-image': 'url(blob:background)', '--audience-safe-inline': '48px', '--audience-safe-block': '48px' })
    expect(view.container.querySelector('.audience-preview-surface')).toHaveClass('audience-stage')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('revokes both object URLs when assets change and on unmount', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second').mockReturnValueOnce('blob:replacement')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const first = { blob: new Blob(['one'], { type: 'image/png' }), name: 'one.png', size: 3, type: 'image/png' }
    const second = { blob: new Blob(['two'], { type: 'image/png' }), name: 'two.png', size: 3, type: 'image/png' }
    const view = render(<AudiencePreviewSurface accentColor="#f2a93b" background={first} displayName="Gala" logo={first} primaryColor="#7567ff" safeAreaMargin={20} />)
    view.rerender(<AudiencePreviewSurface accentColor="#f2a93b" background={second} displayName="Gala" logo={second} primaryColor="#7567ff" safeAreaMargin={20} />)
    view.unmount()
    expect(create).toHaveBeenCalledTimes(4)
    expect(revoke).toHaveBeenCalledWith('blob:first')
    expect(revoke).toHaveBeenCalledWith('blob:second')
    expect(revoke).toHaveBeenCalledWith('blob:replacement')
  })
})
