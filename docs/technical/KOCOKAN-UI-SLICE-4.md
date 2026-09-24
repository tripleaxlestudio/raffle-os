# Kocokan UI Slice 4 — Pending Results

Tanggal: 2026-09-01

Branch: `redesign/kocokan-ui`

Base: `93f3785` (`feat(ui): apply light-first Kocokan Draw Console slice 3`)

Status: **implemented and verified for owner review; not yet owner accepted**.

Slice ini mengikuti [plan yang disetujui](KOCOKAN-UI-SLICE-4-PLAN.md). Tidak
ada push, pekerjaan Slice 5, rekonsiliasi Phase 11, perubahan History, atau
perubahan visual Audience.

## Hasil

- Pending Results mempertahankan urutan informasi `summary -> decision
  workspace -> operator context -> authoritative record` sambil memperjelas
  hierarki dan kepadatan.
- Strip metrik kini memprioritaskan Tertunda, Dikonfirmasi, Dibatalkan,
  Pengganti, lalu Total tanpa mengubah nilai turunan atau query.
- Winner workspace menggunakan row/grid ringkas yang diuji untuk 1, 6, 10, 20,
  50, dan 100 pemenang. Ticket tetap string exact, termasuk leading zero dan
  urutan asli.
- Selected state lavender tetap terlihat saat hover/focus dan dilengkapi
  checkbox, outline, background, serta state semantics.
- Confirm, Cancel, dan Redraw dibedakan dengan label, ikon, fill/outline,
  semantic state, dan disabled treatment. Handler dan semantik keputusan tetap.
- Panel konteks tetap di kanan pada viewport yang cukup. Authoritative record
  tetap secondary/collapsible.
- Completed state mengutamakan `Mulai Undian Berikutnya`, menempatkan `Lihat
  Riwayat` sebagai secondary, dan memisahkan koreksi/redraw sebagai tindakan
  berisiko.
- Quick-redraw di `ProductionDrawPresentation.tsx` hanya mengubah selection
  grid/dialog surface. Draw Console chrome, runtime, dan Audience preview tidak
  diubah.

## File aplikasi

- `src/pages/operator/ProductionPendingResultsLandingPage.tsx`
- `src/pages/operator/ProductionPendingResultsPage.tsx`
- `src/pages/operator/KocokanPendingResults.test.tsx`
- `src/ui/operator/draw/ProductionDrawPresentation.tsx`
- `src/styles/app.css`
- `src/styles/kocokan/pending.css`

Bukti visual dan audit berada di
[`evidence/kocokan-ui-slice4`](evidence/kocokan-ui-slice4/README.md).

## Regression comparison

| Gate | Sebelum | Sesudah | Hasil |
|---|---:|---:|---|
| Focused | 67 pass / 22 fail | 77 pass / 22 fail | 10 test baru pass; 22 failure identik |
| Full | 1,074 pass / 140 fail | 1,084 pass / 140 fail | 10 test baru pass; 140 failure identik |

Identitas pembanding adalah relative file + full test name + baris pertama
failure message. Tidak ada failure baru, signature berubah, relevant behavior
yang sebelumnya pass lalu fail, test yang dilemahkan, atau baseline debt yang
dinormalisasi. Karena baseline tetap memiliki failure, focused dan full suite
tetap dilaporkan **FAIL**, bukan acceptance PASS.

## Pemeriksaan browser

Fixture visual terisolasi diperiksa di in-app browser pada 1366×768, 1440×900,
dan 1920×1080.

- 20 dan 100 winner tetap tanpa horizontal document overflow; grid 100 winner
  dapat discroll sampai ticket exact `000100` dan action bar.
- Selected + hover mempertahankan lavender background, purple outline/inset
  marker, checked checkbox, dan `data-selected=true`.
- Reason menu tetap light-first serta membawa portal marker Kocokan.
- Completed state menampilkan next action primer, History sekunder, correction
  terpisah, dan authoritative record tertutup secara default.
- Pemeriksaan route `/draw/pending` pada origin fixture tanpa Event tetap berada
  di state `Memuat`. Ini adalah perilaku baseline control flow yang tidak diubah
  karena berada di luar visual scope Slice 4; bukan bukti bahwa setup-required
  state telah diterima secara browser.

Pemeriksaan terfokus ini tidak menggantikan manual Chrome/Edge, assistive-tech,
two-window, atau owner acceptance.

## Verification

- Focused regression command: selesai, 77 pass / 22 unchanged fail.
- Full regression command: selesai, 1,084 pass / 140 unchanged fail.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run lint`: PASS.
- `npm.cmd run build`: PASS; Vite tetap memberi warning baseline bahwa chunk
  `index` sekitar 1.09 MB melewati 500 kB.
- Scope audit: tidak ada source di luar allowlist, tidak ada pending decision
  control-flow change, dan perubahan ProductionDrawPresentation terbatas pada
  quick-redraw selection dialog.

## Asumsi dan follow-up

- Pernyataan owner bahwa Slice 3 selesai diperlakukan sebagai acceptance Slice
  3 dan base `93f3785` dipakai untuk Slice 4.
- Fixture browser tidak menulis official Live record.
- Mixed localization strings tetap debt terpisah; test copy tidak dinormalisasi.
- Owner review Slice 4 masih diperlukan. Slice 5 belum diizinkan dan pekerjaan
  berhenti setelah satu commit ini.
- Tidak ada klaim release-ready atau official-Live readiness.
