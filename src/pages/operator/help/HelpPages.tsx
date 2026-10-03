import { GUIDE_SECTIONS } from './help-guide-sections.ts'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { KOCOKAN_APP_VERSION } from '../../../config/app-version.ts'
import { Button, ButtonLink, Card } from '../../../shared/ui/index.ts'
import { ReportIssueModal } from '../ReportIssueModal.tsx'
import { HelpGuideContent } from './HelpGuideContent.tsx'
import { SUPPORT_ARTICLES } from './help-support-content.ts'
import { HELP_RELEASE_NOTES } from './help-release-notes.ts'
import thirdPartyNotices from './third-party-notices.json'

function HelpShell({ title, intro, children }: { readonly title: string; readonly intro: string; readonly children: ReactNode }) {
  return <section className="kc-help-page" aria-labelledby="help-title">
    <header><h1 id="help-title">{title}</h1><p>{intro}</p></header>
    <nav aria-label="Navigasi bantuan"><ButtonLink to="/settings/app?tab=about" variant="secondary">Kembali ke Settings → Tentang</ButtonLink></nav>
    {children}
  </section>
}

export function HelpWhatsNewPage({ currentVersion = KOCOKAN_APP_VERSION }: { readonly currentVersion?: string }) {
  const currentNote = HELP_RELEASE_NOTES.find((note) => note.version === currentVersion)
  return <HelpShell title="Yang Baru di Kocokan" intro="Lihat perubahan dan perbaikan pada rilis Kocokan.">
    <Card><h2>Versi {currentVersion}</h2>{currentNote === undefined ? <p>Catatan perubahan untuk versi ini belum tersedia.</p> : <p>Catatan rilis versi yang digunakan tersedia pada riwayat di bawah.</p>}</Card>
    <h2>Riwayat Rilis</h2>
    {HELP_RELEASE_NOTES.map((note) => <Card key={note.version}>
      <h2>Kocokan {note.version}</h2><p>Tanggal tag rilis: {note.tagDate}</p>
      {note.added.length > 0 ? <><h3>Yang Baru</h3><ul>{note.added.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
      {note.fixed.length > 0 ? <><h3>Perbaikan</h3><ul>{note.fixed.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
      <h3>Catatan</h3><ul>{note.notes.map((item) => <li key={item}>{item}</li>)}</ul>
    </Card>)}
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
        <ol>
          <li>Acara: buat/pilih ruang kerja yang benar.</li><li>Hadiah: siapkan kategori dan hadiah.</li><li>Peserta: impor, validasi, dan periksa data tersimpan.</li>
          <li>Pengaturan Tampilan: siapkan dan simpan tampilan publik.</li><li>Pengaturan Undian: tentukan pemenang, aturan, dan presentasi.</li>
          <li>Latihan: uji layar dan kendali sebelum acara.</li><li>Undian Live: periksa mode dan konfirmasi mulai resmi.</li>
          <li>Tinjau Pemenang: periksa hasil yang masih tertunda.</li><li>Konfirmasi / Undi Ulang: buat keputusan pada pemenang yang dipilih.</li><li>Riwayat: periksa status dan ekspor hasil terkonfirmasi.</li>
        </ol>
      </> : section.id === 'checklist-sebelum-acara' ? <>
        <ul className="kc-help-checklist">{checklist.map((item) => <li key={item}><label><input type="checkbox" /> <span>{item}</span></label></li>)}</ul>
        <p>Urutan presentasi mengikuti konfigurasi. Pemeriksaan perangkat AV dilakukan pada perangkat yang digunakan. Backup bersifat manual; keberhasilan pemulihan perlu diperiksa terpisah.</p>
      </> : <HelpGuideContent sectionId={section.id} />}
    </Card>)}
  </HelpShell>
}

export function HelpSupportPage() {
  const [reportOpen, setReportOpen] = useState(false)
  return <HelpShell title="Dukungan Kocokan" intro="Temukan bantuan untuk kendala penggunaan atau laporkan masalah yang Anda temui.">
    <Card><h2>Kendala Umum</h2><p>Mulai dari pemeriksaan yang aman. Jika status sesi Live belum jelas, tunda tindakan baru.</p>
      {SUPPORT_ARTICLES.map((article) => <details className="kc-help-article" key={article.id}>
        <summary>{article.title}</summary>
        <h3>Gejala</h3><p>{article.symptom}</p><h3>Periksa</h3><p>{article.check}</p><h3>Coba</h3><p>{article.try}</p>
        <h3>Jika masih terjadi</h3><p>{article.unresolved}</p>
        <ButtonLink to={`/help/guide#${article.guide}`} variant="secondary">Lihat {article.guideLabel}</ButtonLink>
        <Button variant="secondary" onClick={() => setReportOpen(true)}>Laporkan Masalah</Button>
      </details>)}
    </Card>
    <Card><h2>Panduan Pengguna</h2><ButtonLink to="/help/guide" variant="secondary">Buka Panduan Pengguna</ButtonLink></Card>
    <Card><h2>Laporkan Masalah</h2><p>Google Forms membutuhkan koneksi internet. Jangan sertakan data peserta atau informasi acara. Membuka form bukan berarti laporan sudah terkirim.</p><Button onClick={() => setReportOpen(true)}>Laporkan Masalah</Button></Card>
    <ReportIssueModal open={reportOpen} onClose={() => setReportOpen(false)} />
  </HelpShell>
}

export function HelpLicensesPage() {
  return <HelpShell title="Lisensi & Open Source" intro="Informasi penggunaan Kocokan dan atribusi komponen pihak ketiga.">
    <Card><h2>Lisensi / Ketentuan Penggunaan Kocokan</h2><p>Ketentuan penggunaan Kocokan belum dipublikasikan pada build ini.</p></Card>
    <Card><h2>Third-Party / Open Source Notices</h2><p>Notices lokal untuk komponen pada bundle web/runtime yang diperiksa, serta runtime Windows dari distribusi v0.1.3 yang sudah ada. Daftar ini tidak menetapkan lisensi Kocokan dan bukan pernyataan kelengkapan hukum.</p>
      <p>Versi runtime Windows dapat berbeda pada distribusi lain. Aset yang ditambahkan pengguna berada di luar pemeriksaan ini.</p>
      {thirdPartyNotices.components.map((component) => <details className="kc-help-article" key={`${component.name}:${component.version}`}>
        <summary>{component.name} — {component.version}</summary>
        <p>{component.license}</p><p>Cakupan: {component.scope}</p>
        {component.notices.map((notice) => <div key={notice.filename}><h3>{notice.filename}</h3><pre className="kc-help-license-text" tabIndex={0} aria-label={`Teks lisensi ${component.name}`}>{notice.text}</pre></div>)}
      </details>)}
    </Card>
  </HelpShell>
}
