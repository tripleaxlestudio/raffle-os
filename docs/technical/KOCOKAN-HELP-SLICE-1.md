# Kocokan Help — Slice 1: Infrastructure & Navigation

Tanggal: 2 Oktober 2026 (Asia/Jakarta). Status: Implementasi Slice 1 dan focused gates selesai; full suite tidak PASS.

## Git dan scope

Branch awal: `main`. HEAD awal: `d5c4577360e676d5966cc25295b964ec6eb327ad`.
Perubahan lokal existing: `?? docs/copy/` dan `?? docs/product/KOCOKAN-HELP-MENUS-DRAFT.md`. Keduanya dipertahankan dan tidak dimasukkan ke commit Slice 1.

Implementasi berdasarkan draft yang disetujui dan instruksi Slice 1. Tidak ada perubahan package version, dependensi, draw engine, domain/persistence, Audience transport, updater, atau installer. Tidak ada push, tag, atau release.

## Implementasi

- Route Operator lokal: `/help/whats-new`, `/help/guide`, `/help/support`, `/help/licenses`. Tidak ada `/about`.
- Page shell memakai Card, Button, ButtonLink, layout Operator, dan token visual existing. Back-link tetap `/settings/app?tab=about`.
- Yang Baru memakai `KOCOKAN_APP_VERSION`, dengan pesan catatan perubahan belum tersedia. Tidak menulis changelog baru.
- Panduan menyediakan 13 anchor, alur produksi, checklist dengan backup manual opsional, dan placeholder jujur untuk bagian rinci. Anchor juga menggulir dan memindahkan fokus ke heading.
- Dukungan memuat topik kandidat tanpa tutorial recovery, tautan panduan, dan `ReportIssueModal` existing. Google Forms memerlukan internet; membuka form tidak berarti mengirim laporan. Tidak mengambil data acara/peserta untuk laporan.
- Lisensi memuat dua area dengan status belum dipublikasikan. Tidak menetapkan lisensi produk atau mengklaim atribusi lengkap.
- Sidebar Yang Baru/Panduan adalah tautan. Dukungan mempertahankan disclosure; submenu final Laporkan Masalah, Panduan Pengguna, Tentang Kocokan. Controlled element tetap ada ketika collapsed dengan `hidden`.
- Empat action About menjadi tautan. Deskripsi menjadi “Sistem undian lokal untuk kebutuhan acara”; atribusi “Dikembangkan oleh Tripleaxle”. Updater existing tetap utuh.
- Tab Settings berasal langsung dari query URL melalui mapping typed dari `SETTINGS_TABS`; invalid/missing kembali ke Umum. Klik tab mempertahankan parameter lain dan memasukkan history entry, tanpa local state duplikat.
- Checklist hanya state checkbox halaman yang sementara; tidak ditulis ke data acara atau penyimpanan.

## File implementasi dan tes

Dimodifikasi:

- `src/app/router.tsx`
- `src/app/shell/OperatorSidebar.tsx`
- `src/app/shell/OperatorSidebar.test.tsx`
- `src/pages/operator/AppSettingsPage.tsx`
- `src/pages/operator/AppSettingsPage.test.tsx`
- `src/pages/operator/settings/AboutTab.tsx`
- `src/pages/operator/settings/AboutTab.test.tsx`
- `src/styles/app.css`

Dibuat:

- `src/pages/operator/help/HelpPages.tsx`
- `src/pages/operator/help/help-guide-sections.ts`
- `src/pages/operator/help/HelpNavigation.test.tsx`
- `src/styles/kocokan/help.css`
- Dokumen laporan ini dan bukti di `docs/technical/evidence/help-slice1/`.

Tes baru meliputi direct route tanpa event di layout produksi, heading/version/state minimum, query tab valid/invalid, perubahan URL pada halaman yang sudah terbuka, history Back/Forward, parameter URL lain, empat action About dan navigasi balik, anchor/fokus, checkbox opsional, serta buka/tutup modal dan pemulihan fokus. Tes sidebar memperbarui perilaku placeholder menjadi navigasi nyata dan menguji keyboard disclosure. Tes About dibungkus router untuk tautan nyata. Tes metadata Settings menggunakan sumber versi existing, menggantikan angka versi lama.

## Verification gates

| Gate | Hasil |
|---|---|
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run lint` | PASS |
| Focused tests (5 file) | PASS: 60/60 |
| `npm.cmd run build` | PASS; peringatan chunk >500 kB tetap ada |
| `git diff --check` | PASS |
| Full suite sebelum edit | 1.538 tes: 1.429 lulus, 109 gagal |
| Full suite sesudah edit | 1.553 tes: 1.445 lulus, 108 gagal; bukan PASS |

Command focused:

```text
npm.cmd run test -- src/pages/operator/help/HelpNavigation.test.tsx src/app/shell/OperatorSidebar.test.tsx src/pages/operator/settings/AboutTab.test.tsx src/pages/operator/AppSettingsPage.test.tsx src/pages/operator/ReportIssueModal.test.tsx
```

Full suite dijalankan sebelum/sesudah dengan reporter JSON. Perbandingan nama file + nama lengkap tes gagal: **0 kegagalan baru**, **108 kegagalan dengan identitas yang sama seperti baseline**, dan 1 kegagalan baseline teratasi (tes metadata Tentang yang sebelumnya mengharapkan versi lama). Ini klasifikasi berdasarkan identitas assertion, bukan audit akar penyebab semua kegagalan. Tidak ada waiver atau klaim full suite PASS. Daftar file gagal disimpan di `evidence/help-slice1/full-suite-failing-files.txt`.

## Pemeriksaan browser

Menggunakan hasil production build pada origin preview terpisah `http://127.0.0.1:5179`, tanpa mengubah origin runtime terpasang `127.0.0.1:47882` atau data runtime tersebut.

- Halaman Panduan dan Dukungan render dengan “Tidak ada Acara aktif”; bantuan tidak redirect ke setup.
- Anchor checklist menggulir dan memfokuskan heading.
- Deep-link Tentang tetap terpilih setelah reload; klik tab Umum, Back, Forward mengikuti tab URL.
- Dukungan sidebar expand; Tentang Kocokan memiliki target query yang benar.
- Modal Laporkan Masalah bisa dibuka/ditutup. Tidak mengirim form eksternal.
- Panduan pada 1366 × 768 dan checklist pada 1440 × 900 diperiksa; tidak ditemukan overflow horizontal pada viewport tersebut. Masalah kontras heading yang ditemukan saat review diperbaiki, lalu production build dan screenshot diperbarui.

Bukti:

- [Panduan 1366 × 768](evidence/help-slice1/guide-1366x768.png)
- [Checklist 1440 × 900](evidence/help-slice1/checklist-1440x900.png)

Offline diverifikasi pada struktur source: seluruh konten Help disertakan lokal, tanpa fetch konten/jaringan baru. Simulasi browser offline penuh tidak dilakukan; bukan klaim manual offline PASS. Refresh/direct URL pada browser diverifikasi dengan preview produksi; lingkungan server target perlu tetap melayani SPA fallback seperti aplikasi existing.

## Asumsi dan tindak lanjut

- Back-link statis ke Tentang memenuhi kebutuhan navigasi tanpa menyimpan asal halaman.
- Placeholder berarti konten belum tersedia, bukan fitur baru yang telah diverifikasi.
- Checklist bersifat persiapan operator; pengujian AV dilakukan pada perangkat aktual dan bukan jaminan kompatibilitas semua perangkat.
- Slice 2: isi operasional/troubleshooting rinci, release evidence, dan audit atribusi lengkap belum dikerjakan.
- Lisensi produk menunggu ketentuan yang disahkan pemilik. Informasi diagnostik tetap enhancement mendatang.
- Full suite masih memiliki kegagalan baseline; tidak diperbaiki dalam scope ini.

Commit hanya memuat source, tes, styling, dan bukti Slice 1. Draft dan inventaris copy existing tetap untracked. Sesudah commit, `git diff --stat` untuk tracked working tree diharapkan kosong; status tetap menunjukkan dua perubahan lokal existing tersebut.
