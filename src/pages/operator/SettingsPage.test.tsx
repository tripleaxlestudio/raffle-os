import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { appRoutes } from '../../app/router.tsx'

function renderSettings(path = '/dev/prototypes/settings') {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path.startsWith('/dev/') ? path : `/dev/prototypes${path}`],
  })
  const view = render(<RouterProvider router={router} />)

  return { router, ...view }
}

describe('Settings static prototype', () => {
  it('renders Branding by default without file inputs', () => {
    const { container } = renderSettings()

    expect(
      screen.getByRole('heading', { level: 2, name: 'Branding' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Event name' })).toHaveValue(
      'Nusantara Tech Gala 2026',
    )
    expect(screen.getByText('Event logo placeholder')).toBeVisible()
    expect(screen.getByText('Background placeholder')).toBeVisible()
    expect(container.querySelector('input[type="file"]')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Save settings · Prototype only' }),
    ).toBeDisabled()
  })

  it.each([
    ['/dev/prototypes/settings?section=branding', 'Branding'],
    ['/dev/prototypes/settings?section=presentation', 'Presentasi'],
    ['/dev/prototypes/settings?section=audio', 'Audio'],
    ['/dev/prototypes/settings?section=display', 'Display'],
  ])('renders %s directly as the %s section', (path, heading) => {
    renderSettings(path)

    expect(
      screen.getByRole('heading', { level: 2, name: heading }),
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: heading })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('shows presentation controls without runtime motion', () => {
    renderSettings('/dev/prototypes/settings?section=presentation')

    expect(
      screen.getByRole('combobox', { name: 'Countdown duration' }),
    ).toHaveValue('3 seconds')
    expect(
      screen.getByRole('combobox', { name: 'Rolling duration' }),
    ).toHaveValue('8 seconds')
    expect(
      screen.getByRole('switch', { name: 'Respect reduced motion' }),
    ).toBeChecked()
  })

  it('shows inert audio controls without an audio element', () => {
    const { container } = renderSettings('/dev/prototypes/settings?section=audio')

    expect(
      screen.getByRole('combobox', { name: 'Countdown cue' }),
    ).toHaveValue('Pulse countdown')
    expect(
      screen.getByLabelText('Master volume appearance 72%'),
    ).toBeVisible()
    expect(container.querySelector('audio')).toBeNull()
  })

  it('shows display controls and links to the static standby URL', () => {
    renderSettings('/dev/prototypes/settings?section=display')

    expect(
      screen.getByRole('combobox', { name: 'Target resolution' }),
    ).toHaveValue('1920 × 1080 (16:9)')
    expect(
      screen.getByRole('switch', { name: 'Disconnected-safe state' }),
    ).toBeChecked()
    expect(
      screen.getByRole('link', { name: 'Preview display' }),
    ).toHaveAttribute('href', '/dev/prototypes/display?state=standby')
  })

  it('falls invalid sections back to Branding', () => {
    const { container } = renderSettings('/dev/prototypes/settings?section=storage')

    expect(container.querySelector('.settings-page')).toHaveAttribute(
      'data-settings-section',
      'branding',
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'Branding' }),
    ).toBeInTheDocument()
  })
})
