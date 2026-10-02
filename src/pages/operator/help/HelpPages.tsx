import { GUIDE_SECTIONS } from './help-guide-sections.ts'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { KOCOKAN_APP_VERSION } from '../../../config/app-version.ts'
import { Button, ButtonLink, Card } from '../../../shared/ui/index.ts'
import { ReportIssueModal } from '../ReportIssueModal.tsx'

function HelpShell({ title, intro, children }: { readonly title: string; readonly intro: string; readonly children: ReactNode }) {
  return <section className="kc-help-page" aria-labelledby="help-title">
    <header><h1 id="help-title">{title}</h1><p>{intro}</p></header>
    <nav aria-label="Navigasi bantuan"><ButtonLink to="/settings/app?tab=about" variant="secondary">Kembali ke Settings → Tentang</ButtonLink></nav>
    {children}
  </section>
}

export function HelpWhatsNewPage() {
  return <HelpShell title="Yang Baru di Kocokan" intro="Lihat perubahan dan perbaikan pada rilis Kocokan.">
    <Card><h2>Versi {KOCOKAN_APP_VERSION}</h2><p>Catatan perubahan untuk versi ini belum tersedia.</p></Card>
  </HelpShell>
}

const checklist = [
  'Acara aktif sesuai acara yang akan dijalankan.',
  'Hadiah/kategori dan jumlah pemenang sudah diperiksa.',
  'Impor peserta selesai; jumlah peserta, nomor tiket, dan data penting sudah ditinjau.',
  'Pengaturan Tampilan sudah disimpan; logo, warna, dan keterbacaan diperiksa pada Tampilan Audiens.',
  'Tampilan Audiens menunjukkan Terhubung dan keluaran terlihat pada layar tujuan.',
  'Jika menggunakan LED, proyektor, atau vMix, uji keluaran pada perangkat aktual.',
  'Pengaturan Undian dan jumlah peserta yang memenuhi syarat sesuai kebutuhan.',
  'Jalankan Latihan dan periksa urutan presentasi yang dipilih. Jika menggunakan Countdown → Rolling → Reveal, periksa setiap tahap.',
  'Pastikan kembali mode Live sebelum memulai undian resmi.',
  'Opsional: buat backup manual sebelum acara bila diperlukan melalui Settings → Data & Penyimpanan → Buat Backup; pastikan file hasil unduhan tersedia.',
] as const

export function HelpGuidePage() {
  const { hash } = useLocation()
  useEffect(() => {
    const section = GUIDE_SECTIONS.find((item) => `#${item.id}` === hash)
    if (section === undefined) return
    const heading = document.getElementById(section.id)
    heading?.scrollIntoView?.({ block: 'start' })
    heading?.focus({ preventScroll: true })
  }, [hash])
  return <HelpShell title="Panduan Pengguna" intro="Petunjuk menyiapkan dan mengoperasikan Kocokan untuk acara.">
    <Card><nav aria-label="Daftar isi panduan"><h2>Daftar Isi</h2><ol>{GUIDE_SECTIONS.map((section) => <li key={section.id}><Link to={`#${section.id}`}>{section.title}</Link></li>)}</ol></nav></Card>
    {GUIDE_SECTIONS.map((section) => <Card key={section.id} aria-labelledby={section.id}>
      <h2 id={section.id} tabIndex={-1}>{section.title}</h2>
      {section.id === 'alur-cepat-kocokan' ? <>
        <p>Acara → Hadiah → Peserta → Pengaturan Tampilan → Pengaturan Undian → Latihan → Undian Live → Tinjau Pemenang → Konfirmasi / Undi Ulang → Riwayat.</p>
        <p>Konfirmasi atau Undi Ulang dipilih sesuai kondisi pemenang.</p>
      </> : section.id === 'checklist-sebelum-acara' ? <>
        <ul className="kc-help-checklist">{checklist.map((item) => <li key={item}><label><input type="checkbox" /> <span>{item}</span></label></li>)}</ul>
        <p>Urutan presentasi mengikuti konfigurasi. Pemeriksaan perangkat AV dilakukan pada perangkat yang digunakan. Backup bersifat manual; keberhasilan pemulihan perlu diperiksa terpisah.</p>
      </> : <p>Panduan rinci akan tersedia setelah langkah penggunaan diverifikasi.</p>}
    </Card>)}
  </HelpShell>
}

export function HelpSupportPage() {
  const [reportOpen, setReportOpen] = useState(false)
  return <HelpShell title="Dukungan Kocokan" intro="Temukan bantuan untuk kendala penggunaan atau laporkan masalah yang Anda temui.">
    <Card><h2>Kendala Umum</h2><ul>
      {['Tampilan Audiens tidak terhubung', 'Keluaran vMix tidak muncul', 'Impor peserta gagal', 'Hasil belum tersimpan', 'Pemulihan setelah refresh', 'Kendala penyimpanan lokal'].map((topic) => <li key={topic}>{topic}</li>)}
    </ul><p>Panduan penanganan akan tersedia setelah langkah pemulihan diverifikasi.</p></Card>
    <Card><h2>Panduan Pengguna</h2><ButtonLink to="/help/guide" variant="secondary">Buka Panduan Pengguna</ButtonLink></Card>
    <Card><h2>Laporkan Masalah</h2><p>Google Forms membutuhkan koneksi internet. Jangan sertakan data peserta atau informasi acara. Membuka form bukan berarti laporan sudah terkirim.</p><Button onClick={() => setReportOpen(true)}>Laporkan Masalah</Button></Card>
    <ReportIssueModal open={reportOpen} onClose={() => setReportOpen(false)} />
  </HelpShell>
}

export function HelpLicensesPage() {
  return <HelpShell title="Lisensi & Open Source" intro="Informasi penggunaan Kocokan dan atribusi komponen pihak ketiga.">
    <Card><h2>Lisensi / Ketentuan Penggunaan Kocokan</h2><p>Ketentuan penggunaan Kocokan belum dipublikasikan pada build ini.</p></Card>
    <Card><h2>Third-Party / Open Source Notices</h2><p>Atribusi lokal akan dilengkapi setelah komponen yang didistribusikan diverifikasi. Daftar lengkap belum dipublikasikan pada build ini.</p></Card>
  </HelpShell>
}
