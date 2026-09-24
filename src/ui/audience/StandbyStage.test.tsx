import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StandbyStage } from './StandbyStage.tsx'
import type { PublicAudienceScenario } from './audience-view.types.ts'

const scenario: PublicAudienceScenario = {
  state: 'standby', eventName: 'Acara Uji', eventSubtitle: 'Sampel publik',
  prizeCategory: 'Undian aktif', prizeLabel: 'Pengumuman pemenang',
  message: 'Menunggu undian berikutnya', displayTest: false,
}

describe('Audience standby presentation', () => {
  it('preserves the waiting copy and branding without adding controls or F11 hints', () => {
    const { container } = render(<StandbyStage scenario={scenario} />)
    const heading = screen.getByRole('heading', { level: 1, name: scenario.message })
    expect(heading).toBeVisible()
    expect(heading.querySelector('br')).toBeNull()
    expect(screen.getByText('Acara Uji')).toBeVisible()
    expect(screen.getByText('Pengumuman pemenang')).toBeVisible()
    expect(container.querySelector('[data-safe-area]')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText(/F11/)).not.toBeInTheDocument()
  })

  it('retains the next-prize title and winner count with long public copy', () => {
    const prize = 'Paket perjalanan keluarga dan hadiah utama perayaan tahunan'
    render(<StandbyStage scenario={{ ...scenario, nextDrawReady: true, prizeLabel: prize, winnerCount: 10, message: 'Undian segera dimulai' }} />)
    expect(screen.getByRole('heading', { level: 1, name: prize })).toBeVisible()
    expect(screen.getByText('10 Pemenang')).toBeVisible()
    expect(screen.getByText('Undian segera dimulai')).toBeVisible()
  })

})
