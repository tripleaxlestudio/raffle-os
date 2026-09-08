import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LogPage } from './LogPage.tsx'

describe('LogPage', () => {
  it('renders page header and default filters', () => {
    render(<LogPage />)

    expect(screen.getByRole('heading', { name: 'Log Sistem' })).toBeInTheDocument()
    expect(screen.getByText('Aktivitas dan diagnostik aplikasi KOCOKAN.')).toBeInTheDocument()

    // Level filter chips
    const errorBtn = screen.getByRole('button', { name: /Error/i })
    const warnBtn = screen.getByRole('button', { name: /Peringatan/i })
    const infoBtn = screen.getByRole('button', { name: /Info/i })
    const debugBtn = screen.getByRole('button', { name: /Debug/i })

    expect(errorBtn).toHaveAttribute('aria-pressed', 'true')
    expect(warnBtn).toHaveAttribute('aria-pressed', 'true')
    expect(infoBtn).toHaveAttribute('aria-pressed', 'true')
    expect(debugBtn).toHaveAttribute('aria-pressed', 'false')

    // Search and category controls
    expect(screen.getByPlaceholderText('Cari log...')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filter sumber log' })).toHaveValue('ALL')
  })

  it('filters logs by search query', async () => {
    const user = userEvent.setup()
    render(<LogPage />)

    const searchInput = screen.getByPlaceholderText('Cari log...')
    await user.type(searchInput, 'IndexedDB')

    // Message containing IndexedDB should be visible
    expect(screen.getByText(/Database opened successfully/i)).toBeInTheDocument()

    // Clear search
    const clearSearchBtn = screen.getByRole('button', { name: 'Hapus pencarian' })
    await user.click(clearSearchBtn)
    expect(searchInput).toHaveValue('')
  })

  it('filters logs by category dropdown', async () => {
    const user = userEvent.setup()
    render(<LogPage />)

    const select = screen.getByRole('combobox', { name: 'Filter sumber log' })
    await user.selectOptions(select, 'Audio')

    expect(screen.getByText(/Audio synthesizer engine initialized/i)).toBeInTheDocument()
  })

  it('expands log row inline to display detail and copy action', async () => {
    const user = userEvent.setup()
    render(<LogPage />)

    // Find row with delayed acknowledgement
    const targetRow = screen.getByText(/Display acknowledgement delayed/i)
    await user.click(targetRow)

    // Check expanded details
    expect(screen.getByText('displayId')).toBeInTheDocument()
    expect(screen.getByText('audience-main')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salin Detail' })).toBeInTheDocument()
  })

  it('toggles pause and resume', async () => {
    const user = userEvent.setup()
    render(<LogPage />)

    const pauseBtn = screen.getByRole('button', { name: 'Jeda' })
    await user.click(pauseBtn)

    expect(screen.getByRole('button', { name: 'Lanjutkan' })).toBeInTheDocument()
    expect(screen.getByText(/Dijeda/i)).toBeInTheDocument()

    const resumeBtn = screen.getByRole('button', { name: 'Lanjutkan' })
    await user.click(resumeBtn)

    expect(screen.getByRole('button', { name: 'Jeda' })).toBeInTheDocument()
    expect(screen.getByText(/Real-time/i)).toBeInTheDocument()
  })

  it('opens confirmation dialog on clear and empties the viewer upon confirm', async () => {
    const user = userEvent.setup()
    render(<LogPage />)

    const clearBtn = screen.getByRole('button', { name: 'Bersihkan' })
    await user.click(clearBtn)

    expect(screen.getByRole('heading', { name: 'Bersihkan log sesi ini?' })).toBeInTheDocument()
    expect(screen.getByText('Log yang sedang ditampilkan akan dihapus dari viewer.')).toBeInTheDocument()

    const confirmClearBtn = screen.getByRole('button', { name: 'Bersihkan Log' })
    await user.click(confirmClearBtn)

    expect(screen.getByText('Tidak ada log yang cocok dengan filter saat ini.')).toBeInTheDocument()
  })
})
