# Kocokan Help — Acceptance

Tanggal pemeriksaan: 3 Oktober 2026. Acceptance ini menilai fitur Help pada source dan bukti yang disebutkan, dengan batas operasional yang dinyatakan secara eksplisit.

## 1. Scope

Closeout Slice 1 (routing/navigasi dan page infrastructure) serta Slice 2 (konten operasional, troubleshooting, release notes lokal dan notices). Source aktual dibaca kembali; laporan sebelumnya dipakai sebagai indeks bukti, bukan satu-satunya dasar acceptance. Tidak ditemukan defect Help yang memerlukan perubahan source pada closeout ini. Tidak ada fitur, refactor, dependency, versi, perubahan domain, installer, atau update baru.

Kondisi normal berarti tidak ada unresolved Live recovery yang sedang diprioritaskan aplikasi. Help dapat dibuka tanpa acara aktif dalam kondisi tersebut. Perilaku saat Startup Recovery aktif dicatat sebagai keputusan produk terpisah.

## 2. Commits

| Tahap | Hash aktual | Pesan |
|---|---|---|
| Slice 1 | `bc5bc77c3c99f4004ed1cc13b601c2aca1d89ccb` | `feat(help): add help navigation and page infrastructure` |
| Slice 2 / HEAD sebelum closeout | `578b4fcb8e5a31760e46089d0d350470d902ec81` | `feat(help): add verified help content` |
| Acceptance | Commit yang memuat dokumen ini; hash dicantumkan pada laporan akhir dan dapat dibaca melalui `git log -1 --format="%H %s"` | `docs(help): accept help feature` |

Branch: `main`. Kedua slice berada dalam history branch ini. Commit acceptance terpisah dan tidak di-push. Dokumen tidak dapat mencantumkan hash commit yang memuat dirinya sendiri sebelum commit terbentuk.

## 3. Feature Acceptance Matrix

| Area | Status | Evidence |
|---|---|---|
| Routing | PASS dalam kondisi normal | [router](../../src/app/router.tsx), [tes navigasi](../../src/pages/operator/help/HelpNavigation.test.tsx), [smoke closeout](evidence/help-acceptance/navigation-smoke.json): empat direct URL, refresh, Back/Forward, Operator layout, tanpa acara aktif |
| Sidebar | PASS | [OperatorSidebar](../../src/app/shell/OperatorSidebar.tsx), tes sidebar dan smoke: target nyata, disclosure keyboard, modal/focus, tanpa menu Dokumentasi |
| Settings About | PASS | [AboutTab](../../src/pages/operator/settings/AboutTab.tsx), [AppSettingsPage](../../src/pages/operator/AppSettingsPage.tsx), focused tests dan smoke: empat target, centralized version, Tripleaxle, deep link/refesh |
| Guide, checklist dan alur cepat | PASS | [HelpPages](../../src/pages/operator/help/HelpPages.tsx), [konten Guide](../../src/pages/operator/help/HelpGuideContent.tsx), [tes konten](../../src/pages/operator/help/HelpContent.test.tsx); 13 anchor difokuskan pada smoke |
| Support / troubleshooting | PASS dengan batas solusi yang dibuktikan | [artikel Support](../../src/pages/operator/help/help-support-content.ts), enam artikel memakai empat subbagian dan cross-link; focused tests, source audit kritis di bagian 4 |
| Pelaporan masalah | PASS dengan kebutuhan internet eksternal | [ReportIssueModal](../../src/pages/operator/ReportIssueModal.tsx), tes modal, sidebar smoke, [bukti kegagalan koneksi Slice 2](evidence/help-slice2/browser-verification.json) |
| Release Notes | PASS / bounded | [data rilis](../../src/pages/operator/help/help-release-notes.ts), dokumen rilis 0.1.0/0.1.1/0.1.3, fallback dites; tidak ada rekonstruksi 0.1.2 |
| Licenses | PASS / bounded pada artefak audit | [notice audit](evidence/help-slice2/notices-audit.json), [notices](../legal/THIRD-PARTY-NOTICES.md), pemeriksaan closeout: 7 direct dependencies, 28 komponen, 30 teks upstream sesuai hash/UI |
| Offline | PASS within stated boundary | [bukti browser Slice 2](evidence/help-slice2/browser-verification.json) dan smoke closeout: konten internet-offline, loopback lokal tetap tersedia |
| Keyboard / viewport | PASS within operational accessibility checks | Bukti Slice 2 pada 1440×900 dan 1366×768; smoke closeout keyboard, seluruh anchor; bukan sertifikasi accessibility lengkap |
| Full suite | NOT PASS — baseline unchanged pada run final | 1.557 total, 1.449 passed, 108 failed; 0 baru/0 hilang/108 unchanged. Run awal dan timing failure tetap dicatat; bukan waiver |

## 4. Accepted Behavior

### Routing, sidebar dan Tentang

Empat route `/help/whats-new`, `/help/guide`, `/help/support`, `/help/licenses` merupakan children dari ProductionOperatorLayout. Tidak ada route About baru. Semua memiliki tautan kembali ke `/settings/app?tab=about`. Direct URL, refresh, Back/Forward dan action About menggunakan keyboard diperiksa pada browser profile baru tanpa acara aktif.

Sidebar final: Yang Baru → `/help/whats-new`; Panduan Pengguna → `/help/guide`; tombol Dukungan membuka submenu Laporkan Masalah (modal existing), Panduan Pengguna → `/help/guide`, Tentang Kocokan → `/settings/app?tab=about`. Disclosure menggunakan button, aria-expanded, aria-controls dan hidden. Tidak ada action Help simulasi/dead atau label menu Dokumentasi. Tentang menampilkan “Sistem undian lokal untuk kebutuhan acara”, “Dikembangkan oleh Tripleaxle”, dan versi dari `package.json` → define Vite → [app-version.ts](../../src/config/app-version.ts). Keempat action Tentang menuju route Help yang sesuai.

### Panduan dan keselamatan wording

[Daftar section](../../src/pages/operator/help/help-guide-sections.ts) dan hasil render memiliki Daftar Isi serta seluruh 13 bagian: Alur Cepat Kocokan; Checklist Sebelum Acara; Mengenal Kocokan; Persiapan Acara dan Hadiah; Peserta dan Impor Data; Pengaturan Undian; Tampilan Audiens dan Persiapan AV; Latihan dan Live; Menjalankan Undian; Hasil, Konfirmasi, dan Undi Ulang; Riwayat dan Ekspor; Penyimpanan dan Pemulihan; Kendala Umum.

Alur cepat berurutan Acara → Hadiah → Peserta → Pengaturan Tampilan → Pengaturan Undian → Latihan → Undian Live → Tinjau Pemenang → Konfirmasi / Undi Ulang → Riwayat. Backup checklist berlabel Opsional dan tidak menjadi syarat Live. Checkbox merupakan pemeriksaan manual di halaman; tidak mengubah kesiapan domain atau menjamin persiapan acara sudah selesai.

Konten draw diperiksa terhadap [DrawPresentationSettings](../../src/ui/operator/draw/DrawPresentationSettings.tsx), [presentation-controller](../../src/application/workflow/presentation-controller.ts), [draw-command](../../src/application/draw/draw-command.ts) dan [ProductionDrawPresentation](../../src/ui/operator/draw/ProductionDrawPresentation.tsx). Pilihan aktif hanya Tampil Langsung dan Putar & Stop Manual. Rolling tidak berhenti oleh timer; hasil resmi terpisah dari animasi. Istilah Stop dalam panduan mengacu pada tindakan manual yang pada layar run berlabel **HENTIKAN & TAMPILKAN**. Preferensi gerak berkurang dapat melewati countdown. Field kompatibilitas lama yang masih ada secara internal tidak dijelaskan sebagai kontrol aktif.

Wording redraw sesuai [Pending Results](../../src/pages/operator/ProductionPendingResultsPage.tsx), [redraw-service](../../src/application/pending-decisions/redraw-service.ts) dan [transaksi persistence](../../src/infrastructure/persistence/transactions/dexie-draw-persistence-unit-of-work.ts): tindakan Pending Results menyimpan request, membatalkan original terpilih, lalu melakukan handoff ke `/draw/run/:id` untuk rolling/Stop manual. Outcome awal memiliki replacement kosong; pemilihan replacement bukan bagian action Pending Results. Hubungan original/pengganti dipertahankan. Unknown/handoff tidak terbaca mengarahkan peninjauan record, bukan permintaan kedua.

Recovery diperiksa terhadap [live-session-recovery](../../src/application/workflow/live-session-recovery.ts) dan [StartupRecoveryGate](../../src/app/workspace/StartupRecoveryGate.tsx): membaca saved state/result, memberikan prioritas pada official records, dan tidak melakukan seleksi ulang. Pending/unknown diperiksa sebelum tindakan Live baru. Ini acceptance wording Help, bukan uji seluruh kegagalan recovery di runtime nyata.

Backup/restore diperiksa terhadap [storage-service](../../src/application/storage/storage-service.ts), [DataStorageTab](../../src/pages/operator/settings/DataStorageTab.tsx) dan [restore confirmation](../../src/pages/operator/settings/RestoreConfirmationModal.tsx). Penyimpanan aplikasi, recovery setelah refresh, backup manual opsional, dan restore manual dijelaskan terpisah. Restore memiliki validasi/preview/confirmation dan mengganti current data dalam transaksi; panduan tidak menjamin semua aset/keadaan kembali atau menyarankan restore generik untuk hasil yang belum terlihat.

### Support, pelaporan dan AV

Enam artikel membahas koneksi Audience, output vMix, impor, hasil tidak terlihat, setelah refresh, dan penyimpanan lokal. Semuanya memakai Gejala / Periksa / Coba / Jika masih terjadi, guide anchor, dan Laporkan Masalah. Langkah destruktif—hapus storage/IndexedDB/site data, hapus event, draw baru tanpa peninjauan, restore generik, duplicate redraw—tidak dianjurkan. Teks larangan terhadap tindakan tersebut tidak diperlakukan sebagai instruksi menjalankannya. Untuk status ambigu, solusi tidak dijanjikan pasti dan pengguna diarahkan ke pelaporan.

Pelaporan tetap form → review → Google Forms; peringatan melarang data peserta/informasi acara. Metadata dibatasi pada versi, user agent dan origin. Membuka form tidak dinyatakan sebagai laporan terkirim. Koneksi internet diperlukan hanya untuk tujuan eksternal. Bukti Slice 2 menunjukkan request Google Forms gagal dengan ERR_INTERNET_DISCONNECTED tanpa page error; modal dan navigasi aplikasi tetap dapat digunakan. Tidak ada pengiriman laporan pada acceptance.

Guide membedakan fitur Kocokan—membuka Audience, indikator Terhubung, Siaga, display settings/branding, preview dan browser output—dari vMix, LED processor, proyektor dan capture/output hardware. Preview draf memerlukan penyimpanan agar diterapkan pada Audience. Tidak ada klaim konfigurasi hardware otomatis, dukungan semua engine/perangkat, atau alamat loopback dapat dipakai dari komputer lain.

### Release notes dan notices

Notes 0.1.0 dan 0.1.1 ditelusuri ke [rilis 0.1.0](../releases/KOCOKAN-v0.1.0.md) dan [rilis 0.1.1](../releases/KOCOKAN-v0.1.1.md). Notes 0.1.3 ditelusuri ke [evidence 0.1.3](../releases/KOCOKAN-v0.1.3.md), existing RELEASE-NOTES.txt/manifest dan tag `v0.1.3` pada `d5c4577360e676d5966cc25295b964ec6eb327ad`. Tanggal dilabeli tanggal tag, bukan tanggal publikasi GitHub. Ringkasan user-facing bukan dump commit. 0.1.2 tidak direkonstruksi. Versi terpasang berasal dari sumber terpusat; versi tanpa note memakai “Catatan perubahan untuk versi ini belum tersedia.”

Audit Slice 2 memisahkan dependency development, production-marked yang tidak teramati dalam bundle, 25 npm package installations yang teramati dalam web/runtime, dan tiga runtime snapshot Windows v0.1.3. Exact version diperoleh dari lock/installed metadata atau manifest distribusi, bukan range package.json. Tujuh direct production dependencies—Dexie, React, React DOM, React Router, React Select, ws, SheetJS—tercakup. Windows snapshot mencakup Node 22.23.2 serta Microsoft.NETCore.App/Microsoft.WindowsDesktop.App 8.0.31.

Closeout membandingkan 30 committed upstream notice files dengan SHA-256 audit dan teks JSON yang ditampilkan pada Help: cocok seluruhnya. Notice source tidak diubah; Git attributes menjaga byte akhir baris. Lisensi produk dipisahkan dan tetap belum dipublikasikan/ditetapkan. Acceptance ini tidak menyatakan kelengkapan hukum, sertifikasi, atau legal compliance. Final installer untuk perubahan Help belum dire-audit; packaging berikutnya wajib melakukan audit notices ulang. Aset pengguna di luar pemeriksaan package ini.

## 5. Verification

| Gate closeout | Hasil |
|---|---|
| `git status --short` sebelum | Hanya dua untracked unrelated existing |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run lint` | PASS |
| Focused tests | PASS: 64/64, 6 file |
| `npm.cmd run build` | PASS; large-chunk warning tetap ada |
| `git diff --check` / staged diff check | PASS sebelum commit |
| Full suite final | NOT PASS: 1.557 total, 1.449 passed, 108 failed; 0 baru, 0 hilang, 108 unchanged terhadap Slice 2 |
| Offline browser | Bukti Slice 2 diterima dalam boundary internet-offline; smoke closeout juga memblokir non-loopback |
| Viewport / keyboard | Operational accessibility checks pada bukti Slice 2 dan smoke tambahan closeout |
| Notice text/hash | PASS: 30 committed files cocok upstream hash dan local UI; 7 direct dependencies tercakup |

Focused command:

```text
npm.cmd run test -- src/pages/operator/help src/app/shell/OperatorSidebar.test.tsx src/pages/operator/settings/AboutTab.test.tsx src/pages/operator/AppSettingsPage.test.tsx src/pages/operator/ReportIssueModal.test.tsx
```

Full suite dijalankan baru dengan JSON reporter, dalam installed environment yang sama dan tanpa perubahan source/package/lockfile. Baseline Slice 2: 1.557 total, 1.449 passed, 108 failed. Run closeout pertama: 1.557 total, 1.448 passed, 109 failed; 1 baru, 0 hilang, 108 unchanged. Kegagalan tambahan: `ProductionPendingResultsRedrawFlow.test.tsx :: Production Pending Results redraw handoff creates only a redraw request and navigates to the existing Live Draw route`. Router pathname sudah memenuhi waitFor tetapi query heading sinkron berikutnya tidak menemukan target. Ini indikasi timing assertion, bukan akar penyebab yang telah dibuktikan. Run tersebut bersamaan dengan smoke browser. [Hasil pertama](evidence/help-acceptance/full-suite-first-run.json) dipertahankan. Tes file tersebut kemudian lulus 2/2 secara terpisah tanpa edit source atau tes. Full suite diulang secara terpisah setelah browser/preview selesai; hasil final dicatat pada [comparison](evidence/help-acceptance/full-suite-comparison.json).

Smoke closeout dijalankan pada production preview `http://127.0.0.1:5179`, Edge headless, browser profile baru, semua non-loopback page requests diblokir. Empat route diperiksa direct/refresh/Back/Forward/keyboard action About; submenu dan modal serta focus restoration; deep link Tentang setelah refresh; seluruh 13 anchor. Semua anchor mendapat fokus dan berada di bawah header 67px. Tidak ada request konten Help eksternal atau page error. [Bukti smoke](evidence/help-acceptance/navigation-smoke.json). Runtime/data installed `127.0.0.1:47882` tidak digunakan. Preview dihentikan setelah smoke.

Bukti Slice 2 mencakup route refresh dan content di 1440×900 serta 1366×768, TOC/checklist, internal links/disclosure dengan keyboard, focus terlihat, heading anchor di bawah header, tidak ada horizontal overflow yang mengganggu, dan teks lisensi panjang dengan scroll area/PageDown. Screenshot checklist 1366, support 1440 dan license 1366 ditinjau lagi pada closeout. Source aplikasi tidak berubah; production build menghasilkan nama/ukuran bundle yang sama seperti Slice 2. [Browser verification](evidence/help-slice2/browser-verification.json), [checklist](evidence/help-slice2/guide-checklist-1366.png), [support](evidence/help-slice2/support-1440.png), [lisensi panjang](evidence/help-slice2/licenses-1366.png).

Full-suite pengulangan menghasilkan **1.557 total, 1.449 passed, 108 failed**, dengan **0 failure baru, 0 failure hilang, 108 failure unchanged** berdasarkan file + full test name. Tes handoff tambahan dari run pertama tidak gagal pada run ulang. Karena tidak ada source/test/dependency berubah, tidak ada regression Help baru yang terdeteksi; fluktuasi satu assertion tetap menjadi follow-up dan tidak membuktikan penyebab pasti. Kedua run full suite berakhir non-zero karena baseline failures, sehingga tidak pernah dinyatakan PASS.

## 6. Known Boundaries

- Internet offline: konten lokal tetap tersedia, termasuk direct URL/refresh, selama local HTTP runtime masih tersedia. Local runtime unavailable/server dihentikan atau loopback diblokir bukan klaim dukungan refresh. Tidak ada service worker yang ditambahkan atau diklaim.
- Operational accessibility checks mencakup interaksi/viewport yang diuji; bukan accessibility certification penuh atau acceptance semua assistive technology.
- Tidak ada external hardware acceptance untuk vMix/LED/proyektor/capture. Setup perangkat perlu diuji tim AV pada perangkat aktual.
- Help tests tidak membuktikan seluruh runtime recovery, storage failure, draw integrity atau redraw acceptance. Wording kritis dicocokkan dengan source; tidak ada tindakan Live pada data nyata.
- Full suite tetap NOT PASS karena kegagalan baseline; run pertama juga menunjukkan kegagalan tambahan yang tidak boleh disembunyikan. Tidak ada waiver baru.
- Tidak ada legal certification/kelengkapan hukum. Product terms menunggu keputusan pemilik. Final installer notices wajib dire-audit pada packaging berikutnya.

## 7. Follow-up di luar scope Help

Rekomendasi issue terpisah di bawah merupakan backlog dokumentasi lokal; tidak ada issue eksternal dibuat atau perubahan implementasi dilakukan.

| ID / usulan issue | Bukti / masalah | Hasil yang perlu diverifikasi terpisah |
|---|---|---|
| A — Gunakan centralized version pada backup metadata | DataStorageTab memanggil `createBackup(database)` tanpa versi; service default `0.1.0` | Versi backup sesuai source terpusat, kompatibilitas backup lama tetap terjaga. Tidak diperbaiki pada closeout |
| B — Audit prize image asset backup/restore round-trip | Asset round-trip belum diaudit penuh; backup data/preview tidak cukup membuktikan semua asset kembali | Cakupan asset, representasi blob/reference, hasil setelah restore dan kompatibilitas legacy dibuktikan sebelum klaim kelengkapan |
| C — Putuskan status ConnectionsTab simulated controls | Source memakai dummy connection/test/restart dan simulasi URL; Help tidak menganggapnya integration aktif | Keputusan product/UI: label/disable/hapus/implementasi pada scope terpisah, acceptance untuk tiap action nyata |
| D — Putuskan akses Help saat Startup Recovery aktif | Gate mengarahkan unresolved/conflicting Live ke recommendedRoute dengan replace | Pemilik memilih Help selalu dapat diakses atau recovery tetap diprioritaskan; tes navigasi/safety sesuai keputusan. Perilaku sekarang tidak diubah |
| E — Evaluasi ukuran bundle Help/notices | Build main JS 1.577,49 kB, gzip 395,94 kB; local notices berada di main bundle | Kandidat lazy-load notice data atau split Help/license content; uji load/refresh tanpa internet dan packaging lokal sebelum menerima optimasi |

Selain A–E: catat timing assertion tes handoff dari run awal sebagai investigasi stabilitas tes terpisah; jangan menutupi dengan mass rewrite. Perbaikan 108 baseline failures membutuhkan scope sendiri. Catatan rilis 0.1.2 memerlukan evidence sebelum diterbitkan.

## 8. Final Status

**HELP FEATURE ACCEPTED**

Fitur Help Slice 1 + Slice 2 diterima sesuai matrix dan known boundaries di atas; bukan acceptance semua subsistem aplikasi. Full-suite final memiliki baseline failures yang sama, dengan run awal/timing follow-up tetap tercatat. File closeout hanya dokumen ini dan tiga evidence JSON di `docs/technical/evidence/help-acceptance/`. Dua untracked existing `docs/copy/` dan `docs/product/KOCOKAN-HELP-MENUS-DRAFT.md` tetap di luar commit. Setelah commit, tracked working tree harus bersih, `git diff --stat` kosong; status tetap menunjukkan dua path unrelated tersebut. Tidak ada push dan tidak ada fitur baru setelah acceptance tanpa scope baru.
