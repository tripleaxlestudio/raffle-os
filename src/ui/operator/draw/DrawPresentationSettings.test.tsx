import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_DRAW_PRESENTATION_CONFIGURATION,
  type DrawPresentationConfiguration,
} from '../../../domain/draws/draw-presentation.types.ts'
import { DrawPresentationSettings } from './DrawPresentationSettings.tsx'

function ControlledSettings({
  initial = DEFAULT_DRAW_PRESENTATION_CONFIGURATION,
  disabled = false,
  winnerCount = 3,
}: {
  readonly initial?: DrawPresentationConfiguration
  readonly disabled?: boolean
  readonly winnerCount?: number
}) {
  const [configuration, setConfiguration] = useState(initial)
  return (
    <DrawPresentationSettings
      configuration={configuration}
      winnerCount={winnerCount}
      disabled={disabled}
      onChange={setConfiguration}
    />
  )
}

describe('DrawPresentationSettings simplified reveal behavior', () => {
  it('exposes only the two approved reveal choices with exact labels and descriptions', () => {
    render(<ControlledSettings />)

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(2)

    const directChoice = screen.getByRole('radio', { name: /Tampil Langsung/ })
    expect(directChoice).toBeInTheDocument()
    expect(directChoice).toHaveTextContent('Setelah hitung mundur, pemenang langsung ditampilkan.')
    expect(directChoice).toHaveAttribute('aria-checked', 'true')

    const manualRollingChoice = screen.getByRole('radio', { name: /Putar & Stop Manual/ })
    expect(manualRollingChoice).toBeInTheDocument()
    expect(manualRollingChoice).toHaveTextContent(
      'Setelah hitung mundur, nomor akan terus berputar hingga operator menekan Stop.',
    )
    expect(manualRollingChoice).toHaveAttribute('aria-checked', 'false')
  })

  it('removes the entire speed, reveal mode, and rolling control UI', async () => {
    const user = userEvent.setup()
    render(<ControlledSettings />)

    // Even when selecting Putar & Stop Manual, no secondary controls appear
    await user.click(screen.getByRole('radio', { name: /Putar & Stop Manual/ }))

    // Speed controls are gone
    expect(screen.queryByRole('group', { name: 'Kecepatan putaran' })).not.toBeInTheDocument()
    expect(screen.queryByText('Halus')).not.toBeInTheDocument()
    expect(screen.queryByText('Cepat')).not.toBeInTheDocument()
    expect(screen.queryByText('Sangat Cepat')).not.toBeInTheDocument()
    expect(screen.queryByText(/putaran\/dtk/)).not.toBeInTheDocument()

    // Reveal mode controls are gone
    expect(screen.queryByRole('group', { name: 'Mode pengungkapan' })).not.toBeInTheDocument()
    expect(screen.queryByText('Ungkap Bersamaan')).not.toBeInTheDocument()
    expect(screen.queryByText('Ungkap Berurutan')).not.toBeInTheDocument()

    // Duration and control mode controls remain gone
    expect(screen.queryByRole('group', { name: 'Kontrol putaran' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Durasi putaran' })).not.toBeInTheDocument()
    expect(screen.queryByText('Berwaktu')).not.toBeInTheDocument()
    expect(screen.queryByText('Berhenti Manual')).not.toBeInTheDocument()
    expect(screen.queryByText(/^(5|8|12) dtk$/)).not.toBeInTheDocument()
  })

  it('dispatches configuration with fixed defaults when toggling choices', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DrawPresentationSettings
        configuration={DEFAULT_DRAW_PRESENTATION_CONFIGURATION}
        winnerCount={5}
        disabled={false}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('radio', { name: /Putar & Stop Manual/ }))
    expect(onChange).toHaveBeenCalledWith({
      presentationMode: 'random-number-roll',
      rollStopMode: 'manual',
      rollDurationSeconds: 8,
      rollSpeedPerSecond: 12,
      revealMode: 'all-together',
    })

    onChange.mockClear()
    await user.click(screen.getByRole('radio', { name: /Tampil Langsung/ }))
    expect(onChange).toHaveBeenCalledWith({
      presentationMode: 'instant-reveal',
      rollStopMode: 'manual',
      rollDurationSeconds: 8,
      rollSpeedPerSecond: 12,
      revealMode: 'all-together',
    })
  })

  it('disables all options when disabled is true', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DrawPresentationSettings
        configuration={DEFAULT_DRAW_PRESENTATION_CONFIGURATION}
        winnerCount={1}
        disabled={true}
        onChange={onChange}
      />,
    )

    const radios = screen.getAllByRole('radio')
    for (const radio of radios) {
      expect(radio).toBeDisabled()
      await user.click(radio)
    }
    expect(onChange).not.toHaveBeenCalled()
  })
})
