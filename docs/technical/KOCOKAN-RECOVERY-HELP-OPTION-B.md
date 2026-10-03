# Kocokan — Help Recovery Option B

Pemilik memilih **B** setelah [Recovery Navigation Decision Audit](KOCOKAN-RECOVERY-NAVIGATION-DECISION.md). Baseline implementasi: branch `main`, commit `f68a1dab40112f972b3256f96d1397f8e06c2cc3`. Dua untracked existing `docs/copy/` dan `docs/product/KOCOKAN-HELP-MENUS-DRAFT.md` dipertahankan. Tidak ada perubahan versi, dependency, schema, official draw/recovery state machine, updater, installer atau push.

## Behavior

Empat pathname yang diizinkan selama unresolved/conflicting recovery: `/help/whats-new`, `/help/guide`, `/help/support`, `/help/licenses`. Query dan anchor pada keempat halaman tidak mengubah izin. Ini exact list, bukan wildcard untuk route Help masa depan; trailing slash/unknown path tidak diberi exception oleh predicate. Wildcard 404 di luar shell tetap mengikuti router existing.

Pada Help, gate menampilkan banner warning yang tetap terlihat saat main digulir, badge **Pemulihan belum selesai**, dan CTA **Kembali ke Pemulihan**. Target CTA berasal dari recommendedRoute recovery saat ini: Pending detail, Pending landing untuk konflik, atau Run untuk active redraw. Status ambiguous memakai Perlu konfirmasi aman. Banner tidak bisa di-dismiss.

CTA menggunakan navigasi push normal: Back dapat kembali membaca Help dan Forward kembali ke recovery; tidak ada bounce redirect pada Help. Settings, Tentang, Pengaturan Tampilan dan workflow non-target tetap memakai redirect replace existing. Backlink Help ke Tentang disembunyikan hanya saat recovery aktif. Setelah recovery normal, banner hilang, backlink dipulihkan, dan pengguna tetap di Help; tidak ada auto replay intended route atau default redirect.

State loading/error mengikuti provider/gate existing: tidak menciptakan target pemulihan atau menyatakan aman. Context Help hanya membawa apakah ada authoritative recovery target, bukan otoritas izin domain. Saat provider sedang refresh, indikator recovery bisa sementara tidak dirender sampai state ready; tidak ada perubahan mekanisme refresh/cross-tab existing.

## Safety dan lifecycle

Help tetap berupa konten lokal, checkbox/disclosure/focus/navigation/modal. Tidak ada domain/storage/reset/restore/draw command baru. Header dan provider tetap menjalankan ownership/publikasi Audience existing. Gate tetap merupakan sibling Outlet dengan redirect effect; perubahan ini tidak mengubahnya menjadi lock transaksi atau penghalang mount semua halaman.

Keluar run menghentikan presentation controller/timer existing; checkpoint write yang sudah dimulai dapat menyelesaikan persistence, tetapi lifecycle guard mencegah progres/publikasi controller yang telah disposed. Tidak ada perubahan presentation controller produksi. Intentional redraw handoff sementara tetap dibersihkan sesuai behavior existing; persisted request/pilihan/lineage tidak dihapus. Kembali membaca request/checkpoint otoritatif, bukan memulai pemilihan otomatis.

Re-entry reveal/pending-handoff pada running redraw tetap dapat melakukan completion existing berdasarkan pilihan yang sudah tersimpan. Itu bukan kemampuan baru Help dan tidak diganti oleh patch ini. Browser acceptance baru mencakup pending request serta running rolling; countdown/reveal/pending-handoff dan async-write disposal diperiksa dengan tes controller. Tidak mengklaim seluruh lifecycle/hardware telah teruji end-to-end.

Temuan audit bahwa drawing tanpa winner diarahkan ke Pending detail yang menolak status drawing tetap follow-up terpisah; Help sekarang dapat dibaca tetapi target recovery tersebut tidak diperbaiki. Scope startup tetap acara aktif, bukan semua acara tersimpan. Tidak ada cross-tab invalidation baru.

## Berkas

- [recovery-help-navigation.ts](../../src/app/workspace/recovery-help-navigation.ts): exact predicate, target helper dan context.
- [StartupRecoveryGate.tsx](../../src/app/workspace/StartupRecoveryGate.tsx): exception Help serta banner/CTA.
- [ProductionOperatorLayout.tsx](../../src/app/layouts/ProductionOperatorLayout.tsx): context status authoritative untuk backlink Help.
- [HelpPages.tsx](../../src/pages/operator/help/HelpPages.tsx): backlink About sesuai context; isi artikel tidak diubah.
- [help.css](../../src/styles/kocokan/help.css): sticky status dan anchor clearance.
- [RecoveryHelpNavigation.test.tsx](../../src/app/workspace/RecoveryHelpNavigation.test.tsx), [StartupRecoveryGate.test.tsx](../../src/app/workspace/StartupRecoveryGate.test.tsx), [presentation-controller.test.ts](../../src/application/workflow/presentation-controller.test.ts): route/history/status/handoff dan lifecycle checks.
- Dokumen ini, anotasi keputusan pada audit, serta [browser evidence](evidence/recovery-help-option-b/browser.json) dan [screenshot](evidence/recovery-help-option-b/help-recovery-1440.png).

## Verification

Focused:

```text
npm.cmd run test -- src/app/workspace/RecoveryHelpNavigation.test.tsx src/app/workspace/StartupRecoveryGate.test.tsx src/application/workflow/presentation-controller.test.ts src/pages/operator/help src/pages/operator/DrawRunRedrawMode.test.tsx src/pages/operator/ProductionPendingResultsRedrawFlow.test.tsx src/ui/operator/draw/ProductionDrawPresentation.test.tsx src/application/workflow/startup-recovery-arbiter.test.ts src/application/workflow/recovery-contract.test.ts src/application/workflow/live-session-recovery.test.ts
```

**11 files, 151 tests PASS.** Mencakup pending/drawing/unknown/conflict/redraw, exact paths, Back/Forward, target update/resolution, non-recovery states, handoff cleanup dan stage disposal. Run awal test baru gagal karena fixture memanggil helper CommandId yang tidak tersedia; fixture diperbaiki mengikuti branded ID existing, tanpa perubahan domain source.

`npm.cmd run lint`: PASS. `npm.cmd run build`: PASS; warning bundle >500 kB tetap ada. Focused green bukan klaim full suite green.

Full suite dijalankan sekali setelah smoke/browser selesai, dengan JSON reporter ke TEMP. Hasil **1.599 total, 1.491 passed, 108 failed**, exit 1. Dibandingkan baseline Storage A+B **1.571 total, 1.463 passed, 108 failed** berdasarkan repository-relative file + full test name: **0 failure baru, 0 failure hilang, 108 unchanged**. Tambahan 28 tes lulus. [Full-suite comparison](evidence/recovery-help-option-b/full-suite-comparison.json) menyimpan daftar kegagalan dan perbandingan; tidak ada source/test unrelated diubah untuk menutupi baseline, dan tidak ada waiver baru. Full suite tetap **NOT PASS**.

**Browser: 31 observasi, nol page errors**, Edge headless, context nonpersistent baru pada `http://127.0.0.1:5182`, viewport 1440×900. Fixture sintetis, origin installed `127.0.0.1:47882` tidak diakses. Empat Help direct, sidebar, anchor/focus, scroll banner, CTA Back/Forward, refresh/new tab, reporting modal, denied Settings/workflow, konflik dan unknown state, resolution, pending/running redraw return diuji. Snapshot seluruh main IndexedDB tables identik selama rangkaian navigasi Pending; snapshot pending/running rolling redraw masing-masing identik setelah Help/return. Resolution/conflict/redraw setup adalah perubahan fixture eksplisit, bukan tindakan pada data nyata.

Konten lokal diuji saat non-loopback requests diblokir, dengan local runtime tetap tersedia; bukan browser offline mode yang memutus local server. Anchor Penyimpanan dan Pemulihan mendapat fokus dan berada di bawah banner; banner tetap terlihat pada scroll akhir, screenshot ditinjau visual. Dua hambatan harness browser diperbaiki: klik anchor yang hash-nya sudah sama tidak memicu hash effect; heading redraw aktual adalah Undi Ulang. Run final lengkap lulus tanpa source workaround.

Server fixture dihentikan setelah smoke. `git diff --check` dan seluruh link dokumen diperiksa sebelum laporan akhir. Perubahan belum di-commit; tidak ada push. Full-suite state, diff dan batas acceptance disajikan terpisah, tanpa waiver baru.
