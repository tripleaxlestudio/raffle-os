import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ExternalLinkOpenResult } from '../../infrastructure/browser/external-link.ts'
import { GOOGLE_FORM_BASE_URL, GOOGLE_FORM_ENTRIES } from '../../config/feedback.ts'
import { UiThemeContext } from '../../shared/ui/ui-theme.ts'
import { ReportIssueModal } from './ReportIssueModal.tsx'

function renderModal({
  openLink = vi.fn<(url: string) => ExternalLinkOpenResult>(() => 'opened'),
  onClose = vi.fn(),
}: {
  readonly openLink?: (url: string) => ExternalLinkOpenResult
  readonly onClose?: () => void
} = {}) {
  render(<UiThemeContext.Provider value="kocokan"><ReportIssueModal onClose={onClose} open openLink={openLink} /></UiThemeContext.Provider>)
}

function completeForm() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Judul masalah' }), { target: { value: 'Modal gagal dibuka & layar kosong' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Kategori' }), { target: { value: 'Operator UI' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Tingkat dampak' }), { target: { value: 'Mengganggu workflow' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Apa yang terjadi?' }), { target: { value: 'Modal tidak muncul setelah tombol diklik.' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Apa yang seharusnya terjadi?' }), { target: { value: 'Modal laporan tampil tanpa mengubah halaman.' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Langkah untuk mengulang masalah' }), { target: { value: '1. Buka Dukungan\n2. Klik Laporkan Masalah\n3. Amati layar' } })
}

describe('ReportIssueModal', () => {
  it('focuses the first form field and closes through Batal', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal({ onClose })
    expect(screen.getByRole('combobox', { name: 'Jenis laporan' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Batal' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('validates all required fields and cannot open the external form before review', async () => {
    const user = userEvent.setup()
    const openLink = vi.fn<(url: string) => ExternalLinkOpenResult>(() => 'opened')
    renderModal({ openLink })
    expect(screen.getByRole('combobox', { name: 'Jenis laporan' })).toHaveValue('Bug')
    expect(screen.queryByRole('button', { name: 'Buka Form Feedback' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tinjau Laporan' }))

    expect(screen.getAllByText('Field ini wajib diisi.')).toHaveLength(6)
    expect(screen.getByRole('alert')).toHaveTextContent('Lengkapi semua field')
    expect(openLink).not.toHaveBeenCalled()
  })

  it('shows a final review, opens the encoded Google Form, and retains the form', async () => {
    const user = userEvent.setup()
    const openLink = vi.fn<(url: string) => ExternalLinkOpenResult>(() => 'opened')
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const currentLocation = window.location.href
    renderModal({ openLink, onClose: vi.fn() })
    completeForm()

    await user.click(screen.getByRole('button', { name: 'Tinjau Laporan' }))

    const dialog = screen.getByRole('dialog', { name: 'Laporkan Masalah' })
    expect(within(dialog).getByText('Modal gagal dibuka & layar kosong')).toBeInTheDocument()
    expect(within(dialog).getByText(/Apa yang terjadi\?/)).toBeInTheDocument()
    expect(openLink).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Buka Form Feedback' }))

    expect(openLink).toHaveBeenCalledOnce()
    const openedUrl = new URL(openLink.mock.calls[0]?.[0] ?? '')
    expect(openedUrl.origin + openedUrl.pathname).toBe(GOOGLE_FORM_BASE_URL)
    expect(openedUrl.searchParams.get('usp')).toBe('pp_url')
    expect(openedUrl.searchParams.get(GOOGLE_FORM_ENTRIES.reportType)).toBe('Bug')
    expect(openedUrl.searchParams.get(GOOGLE_FORM_ENTRIES.title)).toBe('Modal gagal dibuka & layar kosong')
    expect(openedUrl.searchParams.get(GOOGLE_FORM_ENTRIES.category)).toBe('Operator UI')
    expect(openedUrl.searchParams.get(GOOGLE_FORM_ENTRIES.severity)).toBe('Mengganggu workflow')
    expect(screen.getByRole('status')).toHaveTextContent('Form feedback telah dibuka')
    expect(screen.getByText(/Laporan belum dikirim sampai/)).toBeInTheDocument()
    expect(storageWrite).not.toHaveBeenCalled()
    expect(window.location.href).toBe(currentLocation)

    await user.click(within(dialog).getByRole('button', { name: 'Kembali' }))
    expect(screen.getByRole('combobox', { name: 'Jenis laporan' })).toHaveValue('Bug')
    expect(screen.getByRole('textbox', { name: 'Judul masalah' })).toHaveValue('Modal gagal dibuka & layar kosong')
    expect(screen.getByRole('textbox', { name: 'Apa yang terjadi?' })).toHaveValue('Modal tidak muncul setelah tombol diklik.')
  })

  it('reports popup blocking without closing or clearing the review', async () => {
    const user = userEvent.setup()
    const openLink = vi.fn<(url: string) => ExternalLinkOpenResult>(() => 'blocked')
    renderModal({ openLink, onClose: vi.fn() })
    completeForm()
    await user.click(screen.getByRole('button', { name: 'Tinjau Laporan' }))
    await user.click(screen.getByRole('button', { name: 'Buka Form Feedback' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Izinkan pop-up')
    expect(screen.getByText('Modal gagal dibuka & layar kosong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buka Form Feedback' })).toBeInTheDocument()
  })
})
