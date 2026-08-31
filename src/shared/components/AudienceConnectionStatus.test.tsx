import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DisplayConnectionStatus } from '../../application/display-transport/connection-status.ts'
import { AudienceConnectionStatus } from './AudienceConnectionStatus.tsx'

const states: ReadonlyArray<readonly [DisplayConnectionStatus, string]> = [
  ['setup-required', 'Perlu pengaturan'],
  ['waiting', 'Menunggu'],
  ['connected', 'Terhubung'],
  ['reconnecting', 'Menghubungkan ulang'],
  ['unavailable', 'Tidak tersedia'],
  ['publication-failed', 'Publikasi gagal'],
]

describe('Audience connection status presentation', () => {
  it.each(states)('renders %s with Indonesian text and a stable styling key', (state, label) => {
    const { container } = render(<AudienceConnectionStatus state={state} />)
    expect(screen.getByText(label)).toBeVisible()
    expect(container.firstChild).toHaveAttribute('data-connection-state', state)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('svg')).toHaveAttribute('width', '20')
  })

  it('changes both icon shape and label when waiting becomes connected and returns', () => {
    const { container, rerender } = render(<AudienceConnectionStatus state="waiting" prefix />)
    const waitingIcon = container.querySelector('svg')?.innerHTML
    expect(screen.getByText('Audiens: Menunggu')).toBeVisible()
    rerender(<AudienceConnectionStatus state="connected" prefix />)
    expect(screen.getByText('Audiens: Terhubung')).toBeVisible()
    expect(container.querySelector('svg')?.innerHTML).not.toBe(waitingIcon)
    rerender(<AudienceConnectionStatus state="waiting" prefix />)
    expect(screen.getByText('Audiens: Menunggu')).toBeVisible()
    expect(container.querySelector('svg')?.innerHTML).toBe(waitingIcon)
  })
})
