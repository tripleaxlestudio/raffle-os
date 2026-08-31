# Plan Slice 3 — Draw Console Kocokan

Tanggal: 2026-08-31. Status: **implemented, verified, and owner accepted on
2026-09-01**.

Update 2026-09-01: implementasi dan verifikasi selesai untuk review owner;
lihat [laporan Slice 3](KOCOKAN-UI-SLICE-3.md). Scope di bawah tetap otoritatif.
Owner accepted Slice 3 and subsequently authorized Slice 4 on 2026-09-01.

Owner menerima checkpoint akhir Slice 2 `c6e598a` pada `redesign/kocokan-ui`,
termasuk refinement, dan menyetujui gate regresi yang dijelaskan di bawah.
Jalankan preflight sebelum implementasi; stop setelah satu commit Slice 3 untuk
review owner. Slice 4 dan rekonsiliasi Phase 11 tidak diizinkan.

Guard tambahan yang mengikat: seluruh permukaan Draw Console milik Operator
**light-first**, putih/warm off-white, outline charcoal, hard shadow terkendali,
purple/lavender dan warna semantik seperlunya. Nested section lebih flat dari
parent card. Tidak boleh ada panel besar legacy dark pada setup, queue, run,
runtime controls, status/context, atau recovery. Gelap hanya untuk kanvas
presentasi aktual Audiens/konten Audience-owned yang dibekukan.

Bagian di bawah merekam proposal asli; status otorisasi di atas menggantikan
kalimat historis yang masih menyebut menunggu approval/perencanaan saja.

Plan ini disusun atas permintaan owner sambil pekerjaan/review Slice 2 berjalan.
Tidak menerima Slice 2 secara otomatis, tidak memulai Slice 3, dan tidak
mengizinkan Slice 4 atau rekonsiliasi kegagalan Phase 11.

## 1. Tujuan yang terlihat oleh Operator

Menerapkan bahasa visual Kocokan pada alur **mengatur → memilih sesi →
menjalankan undian**, agar mode, jumlah pemenang, kesiapan, dan tindakan
berikutnya mudah dibaca saat acara berlangsung. Perilaku undian tetap sama.

Acuan: [rencana redesign utama](KOCOKAN-UI-REDESIGN-PLAN.md),
[inventaris permukaan](KOCOKAN-UI-SURFACE-INVENTORY.md),
[PRD](../product/PRD.md), dan [laporan Slice 2](KOCOKAN-UI-SLICE-2.md).
Ini workstream redesign terpisah, bukan perubahan persyaratan Phase 11.

Snapshot repo saat perencanaan: branch `redesign/kocokan-ui`, HEAD `c6e598a`.
Laporan Slice 2 mencatat implementasi/refinement untuk review owner. Snapshot
ini bukan asumsi bahwa pekerjaan paralel selesai; periksa ulang sebelum eksekusi.

## 2. Scope dan hasil yang dituju

### A. Pengaturan Undian — `/draw/setup`

- Ringkasan kapasitas menjadi strip ringkas dengan lima metrik yang sudah ada.
  **Memenuhi syarat** dan **Pemenang diminta** paling menonjol; total peserta,
  check-in, dan pengecualian pemenang tetap terlihat, bukan dihilangkan.
- Kelompokkan identitas Acara/hadiah, jumlah pemenang, gaya presentasi, dan
  aturan kelayakan dengan heading serta divider ringan. Hindari kartu tebal
  berlapis pada setiap kelompok.
- Ratakan preset jumlah pemenang dan input kustom pada baris kontrol yang
  konsisten; label/helper boleh membungkus tanpa menggeser tinggi kontrol.
  Pertahankan rentang kustom 1–100 dan validasinya, tanpa menambah preset.
- Pilihan Live/Latihan jelas melalui teks, indikator pilihan, dan penjelasan
  konsekuensi. Lavender menandai pilihan; merah bukan satu-satunya penanda Live.
- Rapikan kontrol Ungkap Langsung/Putar Nomor Acak, Berwaktu/Berhenti Manual,
  durasi, kecepatan, dan pengungkapan bersamaan/berurutan. Nilai, default,
  visibilitas kondisional, dan persistensinya tidak berubah.
- Area pendukung memuat mode dan aksi simpan/lanjut. Hierarki aksi mengikuti
  kondisi yang sudah ada: simpan perubahan, kemudian lanjut ke gerbang mulai.
  Jangan menyembunyikan tombol atau mengganti guard untuk menyederhanakan UI.
- Pertahankan footer kelanjutan dari Slice 2 serta ruang bebas di bawahnya;
  jangan mendesain ulang komponen footer bersama dalam Slice 3.

Kapasitas belum dievaluasi tetap `—`, bukan nol atau angka perkiraan. Form yang
berubah belum boleh mengklaim kesiapan resmi. Simpan/lanjut hanya menyusun atau
membuka gerbang mulai; tidak boleh memilih pemenang.

### B. Antrean Undian — `/draw/live`

- Pertahankan deck per hadiah/kategori dan pengelompokan sesi yang ada.
  Ringkas susunan menjadi mode → identitas dan jumlah → kesiapan → aksi.
- Mode tersedia/tidak tersedia dan sesi diblokir tetap eksplisit. Mengganti
  pilihan mode hanya memilih sesi yang sudah ada, tidak membuat sesi baru.
- Aksi operasional sesi terpilih paling menonjol di dalam deck; pengaturan dan
  buka Audiens sekunder. Jangan menciptakan prioritas/sortir sesi baru demi
  satu tombol utama untuk seluruh antrean.
- Status Audiens menampilkan label dan detail aktual, termasuk acknowledgement
  yang sudah tersedia. Terhubung bukan sinonim undian siap dimulai.
- Pertahankan dua empty state berbeda: belum pernah ada sesi, dan tidak ada
  sesi aktif meskipun riwayat tersedia. Tautan tujuan tetap sama.

Tidak menambah search, filter, pagination, reorder, batch start, atau auto-start.

### C. Jalankan Undian — `/draw/run/:drawSessionId`

- Header ringkas: mode, tahap saat ini, identitas hadiah/Acara, jumlah pemenang,
  peserta memenuhi syarat, dan status Audiens terbaca tanpa saling berdesakan.
- Area kontrol utama dan monitor Audiens berdampingan bila lebar cukup;
  pada ruang lebih sempit, susun vertikal dalam urutan baca yang masuk akal.
  Gunakan ukuran berbasis konten, bukan tinggi tetap yang memotong pesan.
- Gerbang mulai tetap menonjol, termasuk notice Latihan, ringkasan tersimpan,
  hold-to-start/konfirmasi, busy, disabled, serta pesan gagal yang sebenarnya.
- Pertahankan seluruh cabang kontrol runtime: countdown, putaran berwaktu,
  Berhenti & Ungkap untuk manual, reveal, pending handoff, blackout, reset
  Latihan, quick redraw, riwayat penggantian, dan recovery yang tersedia.
  Tidak menambahkan aksi Skip, Pause, Resume, atau shortcut baru.
- Hasil tiket pada panel Operator tetap persis, termasuk leading zeroes dan
  urutan. Penataan hasil tidak mengubah winner projection atau hasil redraw.
- Monitor Audiens boleh mendapat bingkai luar, heading, dan recap Kocokan.
  Isi kanvas tetap `AudiencePresentation` yang sama dengan `/display`.

### Batas dialog dan state lintas slice

Slice 3 boleh merapikan body/footer dialog kelanjutan Live, start/reset, quick
redraw confirmation, dan recovery yang dimiliki Draw Console. Gunakan primitive
modal bertema yang sudah ada; jangan mengubah fokus, inert, Escape, busy guard,
confirmation flow, reason, atau callback.

Redesign grid pemilihan pemenang dalam dialog multi-redraw, selected-state
adapter, dan reason-select milik **Slice 4**. Pada Slice 3 dialog tersebut
dipertahankan dan diuji tetap dapat digunakan; jangan menerapkan selector baru
yang diam-diam mengubah isinya. Pending landing/detail juga tidak disentuh.
State loading/error/blocked lokal boleh mendapat wrapper/layout Kocokan;
komponen recovery/fallback global tetap milik Slice 6.

## 3. Kontrak yang tidak boleh berubah

- Draw engine, Web Crypto, eligibility, kapasitas, aturan kemenangan, ticket
  strings, Live/Latihan, confirmation, cancellation, dan redraw lineage.
- Command/receipt, persistence, schema/migration, history, audit, export,
  checkpoint dan recovery. Recovery membaca hasil tersimpan, tidak memilih ulang.
- Routing, Event ownership, readiness guard, query, handler, timer, subscription,
  controller lifecycle, publisher ownership, dan React key/mount boundary.
- Audience protocol, BroadcastChannel, acknowledgement, reconnect, blackout,
  safe area, branding, fullscreen, dan renderer/preview scaling.
- `/display`, prototype `/dev/*`, Settings static preview, dan internal Audience
  CSS. Jangan memakai `AudiencePreview.tsx` statis untuk mengganti monitor live.
- Tidak ada dependency/font eksternal, backend, fitur baru, atau perubahan copy
  massal. Kekurangan terjemahan/fungsional dicatat terpisah, bukan dibundel.

## 4. Rencana file dan CSS

| File | Perubahan yang direncanakan |
|---|---|
| `src/pages/operator/DrawSetupPage.tsx` | Layout dan hook kelas opt-in |
| `src/pages/operator/DrawSessionQueuePage.tsx` | Komposisi deck dan kontrol mode |
| `src/pages/operator/DrawRunPage.tsx` | Chrome gerbang mulai dan state lokal |
| `src/ui/operator/draw/DrawPresentationSettings.tsx` | Tampilan pilihan/kontrol presentasi |
| `src/ui/operator/draw/ProductionDrawPresentation.tsx` | Header, kontrol, hasil Operator, bingkai monitor; bukan lifecycle atau renderer |
| `src/ui/operator/draw/PresentationRecoveryDialog.tsx` | Body/layout bila diperlukan; recovery callbacks tetap |
| `src/styles/kocokan/draw.css` (baru) | Pemilik tunggal style Draw Console |
| `src/styles/app.css` | Satu import stylesheet baru |
| Test terkait dan evidence Slice 3 | Coverage visual/semantik dan bukti regresi |

Gunakan `useUiClass` dan `--kc-*` yang sudah ada. Default konsumen tanpa theme
tetap legacy. Audit semua konsumen export sebelum mengubah kelas: khususnya
`DrawControlDeck`, `ProductionDrawRunHeader`, dan `PresentationSupport`.

Tidak merombak tokens, shared primitives, shell, `operator.css`, atau style
Slice 2. Bila ternyata diperlukan perubahan lintas scope, hentikan bagian itu
dan minta keputusan; jangan memperluas izin diam-diam. Jangan mengubah variable
warisan generik, font/line-height ancestor preview, atau menggunakan broad
descendant selector/`!important`. Pembersihan CSS lama tetap melalui audit Slice 7.

## 5. Urutan pengerjaan setelah mendapat izin

1. **Preflight:** pastikan hasil review Slice 2 dan checkpoint terakhir; baca
   ulang diff/status, catat branch/commit, serta jangan stage perubahan tugas
   lain. Jalankan baseline focused, simpan identitas/signature kegagalan, dan
   capture kondisi browser sebelum perubahan pada data uji terisolasi.
2. **Setup:** rapikan kapasitas, form, jumlah, mode, dan kontrol presentasi.
   Cek browser dan test setup sebelum pindah area.
3. **Queue:** rapikan deck terisi/kosong, mode unavailable, status, dan aksi.
   Cek perpindahan route tanpa memulai draw dari kartu antrean.
4. **Run:** rapikan start gate, setiap cabang presentasi, dialog dalam scope,
   hasil Operator, dan bingkai preview. Cek ulang lifecycle serta isolasi kanvas.
5. **Closeout:** focused + full regression, pemeriksaan visual/isolation,
   dokumentasi hasil dan batas bukti, satu commit terfokus dengan worktree
   bersih setelah koordinasi pekerjaan paralel. Stop untuk review owner.

Tidak membuat branch baru, commit, menjalankan draw, atau mengubah aplikasi
sebagai bagian dari permintaan **perencanaan** ini.

## 6. Verifikasi dan acceptance

### Automated checks saat implementasi

Focused sebelum/sesudah menggunakan set yang sama:

```text
npm.cmd run test -- src/pages/operator/DrawSetupPage.test.tsx src/pages/operator/DrawSetupRoute.test.tsx src/pages/operator/DrawSessionQueuePage.test.tsx src/ui/operator/draw/ProductionDrawPresentation.test.tsx src/app/production-draw-run-route.test.tsx src/application/draw/draw-run-preflight.test.ts src/application/draw/live-start-gate-controller.test.ts src/application/draw/draw-session-queue.test.ts src/ui/operator/draw/draw-session-queue-view-model.test.ts src/application/workflow/phase10-recovery-acceptance.integration.test.tsx --maxWorkers=2
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
```

Full suite sebelum closeout diwajibkan dalam usulan ini karena Draw Run memuat
kontrol resmi dan recovery, meskipun shared primitives tidak direncanakan berubah:

```text
npm.cmd run test -- --maxWorkers=2 --reporter=json --outputFile=node_modules/.tmp/kocokan-slice3-full.json
```

Gunakan JSON reporter juga pada focused before/after untuk perbandingan yang
dapat dilacak. Reuse `evidence/kocokan-ui-slice1/compare-tests.mjs` terhadap
register baseline asli; selain itu bandingkan hasil before/after Slice 3 agar
test yang sudah pulih pada slice sebelumnya tidak boleh gagal lagi tanpa terdeteksi.
Test di luar filtered run bukan berarti skipped; laporkan keduanya terpisah.

Tambah coverage bila markup baru memerlukan bukti selected/disabled semantics,
alignment hooks, atau theme isolation. Assertion yang terikat kelas visual boleh
disesuaikan secara terbatas; assertion perilaku tidak boleh dilemahkan/dihapus.
Audit diff handler, effect/dependency, refs, keys, disabled/conditional guards,
route target dan renderer props, bukan hanya screenshot.

**Usulan gate untuk disetujui bersama izin Slice 3:** meneruskan kebijakan
regresi Slice 2, bukan menganggap pengecualian itu sudah otomatis berlaku.
Laporkan (A) baru lulus, (B) baseline FAIL identik, (C) signature berubah,
dan (D) kegagalan baru. Hentikan/investigasi C/D dan setiap perilaku sebelumnya
lulus yang menjadi gagal. FAIL keseluruhan tetap FAIL; rekonsiliasi Phase 11
memerlukan izin dan commit terpisah. Angka Slice 2 bukan hasil uji Slice 3.

### Browser dan acceptance visual

| Area | Kondisi minimum yang harus dibuktikan |
|---|---|
| Setup | Missing setup/category; dirty/saved; kapasitas cukup/tidak cukup; conflict/locked; preset/kustom termasuk invalid; seluruh pilihan presentasi |
| Queue | Belum ada sesi; tidak ada sesi aktif; beberapa deck; Live/Latihan; mode unavailable; blocked relation; tautan pending/history yang tersedia |
| Start gate | Ready; hold dibatalkan; konfirmasi dibatalkan; busy/disabled; gagal; refresh tidak menjalankan command otomatis |
| Runtime | Countdown; timed/manual roll; reveal; pending handoff; blackout keluar/masuk; reset Latihan; quick redraw cancel; recovery tanpa reselection |
| Aksesibilitas | Tab/Shift+Tab; fokus terlihat; kontrol selected bertahan saat hover/focus; label dan non-color cue; dialog Escape/return focus; reduced motion |
| Isolasi | Preview dan `/display` memakai snapshot publik identik; prototype/static preview tidak berubah; portal tidak bocor tema |

Operator diperiksa pada **1366×768, 1440×900, dan 1920×1080**; Audience pada
**1920×1080**. Vertical scrolling diperbolehkan, horizontal document overflow,
kontrol terpotong, pesan tersembunyi, atau footer menutupi aksi tidak diterima.
Periksa nama panjang, teks error panjang, angka kustom, serta tiket leading zero.

Untuk preview, bandingkan snapshot/data dan ukuran kanvas yang sama sebelum/
sesudah: ready, rolling, reveal (1/6/10/20 pemenang dan fallback layout), blackout.
Bingkai dapat berbeda, tetapi font, warna, safe area, tiket, dan proporsi isi
kanvas tidak boleh berubah. Catat observasi visual plus computed style pada
batas inheritance; atribut theme atau DOM test saja tidak cukup.

Gunakan origin/profil data uji terpisah yang tidak dipakai Slice 2 atau pengguna.
Jangan mengasumsikan port tertentu masih kosong. Practice menjadi alur browser
default; state Live/persistence failure dapat dibuktikan melalui test terisolasi.
Jika verifikasi memerlukan penciptaan hasil Live lewat browser, sepakati dataset
dan izin uji tersebut dahulu; jangan memakai data acara pengguna. Kondisi yang
belum diuji ditandai belum diuji, bukan PASS berdasarkan state lain.

Simpan screenshot terpilih dan catatan browser/version, viewport, commit, data
uji, serta expected/observed di `docs/technical/evidence/kocokan-ui-slice3/`.
In-app Chromium tidak menggantikan acceptance Chrome/Edge, assistive technology,
dua-window, atau owner. Kekurangan bukti tetap dicatat pada handoff Slice 7.

## 7. Definition of done dan keputusan owner

- Tiga route dalam scope konsisten dengan fondasi Kocokan yang sudah direview.
- Guard/handler/lifecycle dan data resmi tidak berubah; preview/prototype
  isolation terverifikasi, bukan hanya dianggap aman karena file tidak diedit.
- Hasil command, perbandingan failure, screenshot, serta keterbatasan manual
  dicatat jujur. Tidak ada regresi baru yang belum ditangani.
- Laporan implementasi, TASKS dan link rencana utama disinkronkan tanpa mengubah
  release gates; commit hanya memuat slice yang diizinkan.
- Owner meninjau hasil sebelum Slice 4. Penyelesaian slice bukan izin resmi Live
  atau klaim release-ready.

Yang diminta pada review plan: persetujuan scope visual di atas dan gate
regresinya, setelah checkpoint/review Slice 2 dipastikan. Sampai itu diberikan,
status tetap **planned / not started**.
