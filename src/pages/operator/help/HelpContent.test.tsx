import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { HelpGuidePage, HelpLicensesPage, HelpSupportPage, HelpWhatsNewPage } from './HelpPages.tsx'
import { SUPPORT_ARTICLES } from './help-support-content.ts'
import notices from './third-party-notices.json'

describe('Verified local help content', () => {
  it('explains the production journey in order and keeps backup optional', () => {
    render(<MemoryRouter><HelpGuidePage /></MemoryRouter>)
    const heading = screen.getByRole('heading', { name: 'Alur Cepat Kocokan' })
    const steps = within(heading.parentElement!).getAllByRole('listitem').map((item) => item.textContent?.split(':')[0])
    expect(steps).toEqual(['Acara', 'Hadiah', 'Peserta', 'Pengaturan Tampilan', 'Pengaturan Undian', 'Latihan', 'Undian Live', 'Tinjau Pemenang', 'Konfirmasi / Undi Ulang', 'Riwayat'])
    expect(screen.getByRole('checkbox', { name: /^Opsional:.*backup/ })).not.toBeChecked()
    expect(screen.getByText(/Tampil Langsung atau Putar & Stop Manual/)).toBeVisible()
    expect(screen.getByText(/Pengganti belum langsung dipilih/)).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Restore manual' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: /kecepatan|rolling berwaktu/i })).not.toBeInTheDocument()
  })

  it('opens each troubleshooting article and links to the relevant guide section', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><HelpSupportPage /></MemoryRouter>)
    for (const article of SUPPORT_ARTICLES) {
      const summary = screen.getByText(article.title, { selector: 'summary' })
      await user.click(summary)
      const region = within(summary.parentElement!)
      for (const name of ['Gejala', 'Periksa', 'Coba', 'Jika masih terjadi']) expect(region.getByRole('heading', { name })).toBeVisible()
      expect(region.getByRole('link')).toHaveAttribute('href', `/help/guide#${article.guide}`)
      await user.click(region.getByRole('button', { name: 'Laporkan Masalah' }))
      expect(screen.getByRole('dialog', { name: 'Laporkan Masalah' })).toBeVisible()
      await user.keyboard('{Escape}')
      expect(region.getByRole('button')).toHaveFocus()
    }
    expect(screen.getByText(/Google Forms membutuhkan koneksi internet/)).toBeVisible()
    expect(screen.getByText(/Jangan sertakan data peserta/)).toBeVisible()
  })

  it('uses a fallback for an installed version without release evidence', () => {
    render(<MemoryRouter><HelpWhatsNewPage currentVersion="9.9.9" /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Versi 9.9.9' })).toBeVisible()
    expect(screen.getByText('Catatan perubahan untuk versi ini belum tersedia.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Kocokan 0.1.3' })).toBeVisible()
    expect(screen.getByText('Tanggal tag rilis: 28 September 2026')).toBeVisible()
  })

  it('renders product terms separately from expandable local license texts', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><HelpLicensesPage /></MemoryRouter>)
    expect(screen.getByText('Ketentuan penggunaan Kocokan belum dipublikasikan pada build ini.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Third-Party / Open Source Notices' })).toBeVisible()
    for (const component of notices.components) {
      const summary = screen.getByText(`${component.name} — ${component.version}`, { selector: 'summary' })
      await user.click(summary)
      const texts = within(summary.parentElement!).getAllByLabelText(`Teks lisensi ${component.name}`)
      expect(texts).toHaveLength(component.notices.length)
      for (const [index, text] of texts.entries()) {
        expect(text).toBeVisible()
        expect(text.textContent).toBe(component.notices[index].text)
        expect(text).toHaveAttribute('tabindex', '0')
      }
    }
  })
})
