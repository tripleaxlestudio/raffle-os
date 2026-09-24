import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { RaffleOSDatabase } from '../../infrastructure/persistence/db.ts'
import { AppSettingsPage } from './AppSettingsPage.tsx'

let testDb: RaffleOSDatabase

function createTestDb(): RaffleOSDatabase {
  return new RaffleOSDatabase(`RaffleOS_AppSettingsTest_${Date.now()}_${Math.random()}`, {
    IDBKeyRange,
    indexedDB,
  })
}

function renderAppSettings(database = testDb) {
  return render(
    <MemoryRouter>
      <AppSettingsPage database={database} />
    </MemoryRouter>,
  )
}

describe('AppSettingsPage prototype & production storage', () => {
  beforeEach(() => {
    testDb = createTestDb()
  })

  it('renders page header and horizontal navigation tabs', () => {
    renderAppSettings()

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(
      screen.getByText('Pengaturan aplikasi, penyimpanan, koneksi, dan sistem Kocokan.'),
    ).toBeInTheDocument()

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(6)
    expect(tabs[0]).toHaveTextContent('Umum')
    expect(tabs[1]).toHaveTextContent('Data & Penyimpanan')
    expect(tabs[2]).toHaveTextContent('Operasional')
    expect(tabs[3]).toHaveTextContent('Koneksi & Integrasi')
    expect(tabs[4]).toHaveTextContent('Sistem & Diagnostik')
    expect(tabs[5]).toHaveTextContent('Tentang')
  })

  it('renders Tab 1: Umum by default with all candidate controls', () => {
    renderAppSettings()

    // Tab is selected
    expect(screen.getByRole('tab', { name: /Umum/i })).toHaveAttribute('aria-selected', 'true')

    // Bahasa & Regional
    expect(screen.getByRole('heading', { name: 'Bahasa & Regional' })).toBeInTheDocument()
    expect(screen.getByLabelText('Bahasa aplikasi')).toHaveValue('id')
    expect(screen.getByLabelText('Format waktu')).toHaveValue('24')
    expect(screen.getByLabelText('Format tanggal')).toHaveValue('DD/MM/YYYY')

    // Startup
    expect(screen.getByRole('heading', { name: 'Startup' })).toBeInTheDocument()
    expect(screen.getByLabelText('Saat Kocokan dibuka')).toHaveValue('last-event')
    expect(screen.getByLabelText('Mode awal')).toHaveValue('practice')
    expect(screen.getByRole('switch', { name: 'Pulihkan acara terakhir secara otomatis' })).toBeChecked()

    // Antarmuka Operator
    expect(screen.getByRole('heading', { name: 'Antarmuka Operator' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('switch', { name: 'Kurangi animasi antarmuka' })).not.toBeChecked()
  })

  it('allows switching controls locally in Tab 1 without side effects', async () => {
    const user = userEvent.setup()
    renderAppSettings()

    const languageSelect = screen.getByLabelText('Bahasa aplikasi')
    await user.selectOptions(languageSelect, 'en')
    expect(languageSelect).toHaveValue('en')

    const motionToggle = screen.getByRole('switch', { name: 'Kurangi animasi antarmuka' })
    await user.click(motionToggle)
    expect(motionToggle).toBeChecked()

    const compactScaleBtn = screen.getByRole('button', { name: 'Compact' })
    await user.click(compactScaleBtn)
    expect(compactScaleBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches to Tab 2: Data & Penyimpanan and displays real metrics and guarded reset modal', async () => {
    const user = userEvent.setup()
    renderAppSettings()

    // Click Tab 2
    await user.click(screen.getByRole('tab', { name: /Data & Penyimpanan/i }))

    expect(screen.getByRole('heading', { name: 'Penyimpanan Lokal' })).toBeInTheDocument()
    expect(await screen.findByText('Siap')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Buat Backup/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pulihkan Backup/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bersihkan Data Sementara/i })).toBeInTheDocument()

    // Click Reset button to trigger real guarded confirmation modal
    const resetBtn = screen.getByRole('button', { name: /Reset Seluruh Data/i })
    await user.click(resetBtn)

    const modal = screen.getByRole('dialog', { name: /Reset Seluruh Data\?/i })
    expect(modal).toBeInTheDocument()
    expect(within(modal).getByText(/Peringatan Penghapusan Permanen/i)).toBeInTheDocument()

    // Reset button is disabled until typing RESET
    const confirmBtn = within(modal).getByRole('button', { name: 'Reset Seluruh Data' })
    expect(confirmBtn).toBeDisabled()

    const input = within(modal).getByPlaceholderText('RESET')
    await user.type(input, 'RESET')
    expect(confirmBtn).toBeEnabled()

    // Cancel modal
    await user.click(within(modal).getByRole('button', { name: 'Batal' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('switches to Tab 3: Operasional and opens keyboard shortcuts modal', async () => {
    const user = userEvent.setup()
    renderAppSettings()

    await user.click(screen.getByRole('tab', { name: /Operasional/i }))

    expect(screen.getByRole('heading', { name: 'Recovery' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Pulihkan sesi yang terputus otomatis' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Ingatkan ketika ada sesi aktif' })).toBeChecked()

    expect(screen.getByRole('heading', { name: 'Audience Display' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Buka Audience Display otomatis' })).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'Buka Audience Display di jendela baru' })).toBeChecked()

    expect(screen.getByRole('heading', { name: 'Perangkat' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Cegah layar tidur saat sesi aktif' })).toBeChecked()

    // Open shortcuts modal
    await user.click(screen.getByRole('button', { name: /Lihat Shortcut/i }))
    const modal = screen.getByRole('dialog', { name: /Pintasan Keyboard Operator/i })
    expect(modal).toBeInTheDocument()
    expect(within(modal).getByText('Space')).toBeInTheDocument()
    expect(within(modal).getByText('Mulai atau putar undian tiket')).toBeInTheDocument()

    // Close shortcuts modal
    await user.click(within(modal).getByRole('button', { name: 'Tutup' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('switches to Tab 4: Koneksi & Integrasi with dummy status and Coming Soon cards', async () => {
    const user = userEvent.setup()
    renderAppSettings()

    await user.click(screen.getByRole('tab', { name: /Koneksi & Integrasi/i }))

    expect(screen.getByRole('heading', { name: 'Audience Connection' })).toBeInTheDocument()
    expect(screen.getByText('BroadcastChannel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tes Koneksi/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Restart Koneksi/i })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Local Server' })).toBeInTheDocument()
    expect(screen.getByText('127.0.0.1')).toBeInTheDocument()
    expect(screen.getByText('5173')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Salin Alamat/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Buka di Browser/i })).toBeInTheDocument()

    // Integrations
    expect(screen.getByRole('heading', { name: 'Integrasi' })).toBeInTheDocument()
    expect(screen.getByText('NDI Output')).toBeInTheDocument()
    expect(screen.getByText('Remote Controller')).toBeInTheDocument()
    expect(screen.getByText('Network Controller')).toBeInTheDocument()
    const comingSoonBadges = screen.getAllByText('Coming Soon')
    expect(comingSoonBadges).toHaveLength(3)
  })

  it('switches to Tab 5: Sistem & Diagnostik with system health checks and log link', async () => {
    const user = userEvent.setup()
    renderAppSettings()

    await user.click(screen.getByRole('tab', { name: /Sistem & Diagnostik/i }))

    expect(screen.getByRole('heading', { name: 'System Health' })).toBeInTheDocument()
    expect(screen.getByText('Secure Random')).toBeInTheDocument()
    expect(screen.getByText('Microsoft Edge 128.0')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Jalankan Pemeriksaan Sistem/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Buka Log/i })).toHaveAttribute('href', '/log')
    expect(screen.getByRole('button', { name: /Export Diagnostic Report/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bersihkan Cache Aplikasi/i })).toBeInTheDocument()
  })

  it('switches to Tab 6: Tentang with hero card, metadata, and application rows', async () => {
    const user = userEvent.setup()
    renderAppSettings()

    await user.click(screen.getByRole('tab', { name: /Tentang/i }))

    expect(screen.getByRole('heading', { name: 'KOCOKAN' })).toBeInTheDocument()
    expect(screen.getByText('Kontrol Undian untuk Event')).toBeInTheDocument()
    expect(screen.getByText('by Tripleaxle')).toBeInTheDocument()

    expect(screen.getByText('0.1.0')).toBeInTheDocument()
    expect(screen.getAllByText('Development')).toHaveLength(2)

    expect(screen.getByText('Yang Baru')).toBeInTheDocument()
    expect(screen.getByText('Panduan Pengguna')).toBeInTheDocument()
    expect(screen.getByText('Dukungan')).toBeInTheDocument()
    expect(screen.getByText('Lisensi & Open Source')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Periksa Pembaruan/i })).toBeInTheDocument()
  })
})
