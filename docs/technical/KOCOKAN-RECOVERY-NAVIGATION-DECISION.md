# Kocokan — Recovery Navigation Decision Audit

## 1. Scope

Tanggal: 3 Oktober 2026. Status: **audit selesai; keputusan produk belum dipilih; tidak ada perubahan behavior produksi**.

Follow-up D dari [Help Acceptance](KOCOKAN-HELP-ACCEPTANCE.md), setelah [Storage Integrity A+B](KOCOKAN-STORAGE-INTEGRITY-A-B.md). Baseline branch `main`, HEAD `7cbd2124de2108fc1e08fdf9b7447da16787e0da`. History memuat Slice 1 `bc5bc77`, Slice 2 `578b4fc`, Help Acceptance `26faf82`, dan Storage A+B `7cbd212`. Dua untracked awal dipertahankan: `docs/copy/` dan `docs/product/KOCOKAN-HELP-MENUS-DRAFT.md`. Tidak ada push, perubahan versi, installer, data pengguna, atau keputusan produk baru.

Label bukti dalam dokumen: **Fakta source** = implementasi baseline; **Bukti uji** = pengamatan yang benar-benar dijalankan; **Inference** = implikasi yang belum dibuktikan lewat acceptance; **Rekomendasi** = proposal, bukan keputusan pemilik. [PRD](../product/PRD.md) dibaca sebagai persyaratan integritas lokal. Deskripsi awal AGENTS/PRD tentang fitur yang belum diimplementasikan bukan bukti kemampuan aktual; audit ini mengikuti source dan closeout terbaru tanpa mengubah persyaratan.

## 2. Current Architecture

**Fakta source:** [router](../../src/app/router.tsx), [layout](../../src/app/layouts/ProductionOperatorLayout.tsx), [workspace provider](../../src/app/workspace/ProductionWorkspaceContext.tsx), [gate](../../src/app/workspace/StartupRecoveryGate.tsx).

```text
ProductionOperatorLayout (dua route object ber-path /)
└── ProductionWorkspaceProvider
    ├── OperatorSidebar + Header
    └── main
        ├── StartupRecoveryGate (sibling, bukan wrapper Outlet)
        ├── Outlet
        │   ├── /dashboard
        │   ├── /events
        │   ├── /prize-categories, /participants
        │   ├── /draw/setup, /draw/live
        │   ├── /draw/pending, /draw/pending/:drawSessionId
        │   ├── /draw/run/:drawSessionId
        │   ├── /history, /history/winners, /history/:drawSessionId
        │   ├── /settings (Pengaturan Tampilan), /log
        │   ├── /settings/app (semua tab)
        │   └── /help/whats-new, /help/guide, /help/support, /help/licenses
        └── diagnostics / setup continuation
Di luar layout ini: /display, /dev/prototypes/*, /dev/setup (DEV), wildcard 404
```

Semua route Operator produksi di atas terkena gate, termasuk Help dan Settings yang bersifat global. Audience dan prototype tidak terkena gate ini; itu pemisahan interface, bukan jalur alternatif recovery Operator.

| Area | Ketergantungan workspace |
|---|---|
| Dashboard | Membaca status workspace; tersedia juga sebagai empty/setup screen |
| Events | Mengelola daftar acara dan memilih active event; dapat digunakan tanpa active event |
| Prize, Participants, Draw Setup/Queue, Pending landing, History, Pengaturan Tampilan | Data dan operasi terkait acara aktif; sidebar juga memakai readiness/setup journey |
| Run/Pending detail | Menggunakan session ID serta event/configuration terkait; tetap berada dalam shell workspace aktif |
| Log | Utility global; tidak ditandai event-scoped oleh sidebar |
| App Settings dan empat Help | Halaman global, tidak membutuhkan active event untuk kontennya; provider dan gate tetap berjalan |

Sidebar mengklasifikasikan semua menu utama selain Dashboard, Log, App Settings sebagai event-scoped, termasuk Events. Ini aturan readiness sidebar, bukan larangan router yang identik. Help utility tidak memakai pemeriksaan readiness tersebut. Jangan menyamakan link terlihat aktif dengan izin recovery.

Provider melakukan health check, membaca `activeEventId`, event, sessions, winners, redraws, receipts, checkpoints, dan active redraw requests, lalu memanggil [arbiter](../../src/application/workflow/startup-recovery-arbiter.ts). Scope startup adalah **acara aktif**, bukan seluruh acara tersimpan. Provider refresh saat mount dan event `raffle-os:workspace-changed`, bukan setiap perubahan URL atau polling database lintas tab.

Gate membuat target hanya untuk `recover-session` dan `conflicting-sessions`. Jika `pathname !== recommendedRoute`, effect memanggil `navigate(target, { replace: true })`. Search/hash tidak dibandingkan. `normal.targetPath='/dashboard'` tidak dipakai gate untuk redirect. Storage failure bukan recovery-route redirect: provider biasanya mengubahnya menjadi workspace error; gate menerima recovery undefined saat workspace tidak ready. Cabang `storage-failure` gate sendiri hanya menampilkan status blocked.

**Fakta source penting:** Outlet selalu dirender berdampingan dengan gate. Redirect terjadi dalam `useEffect`, setelah render, dan pada cold boot setelah pembacaan workspace selesai. Gate bukan penghalang mount, bukan transaksi lock, dan bukan jaminan seluruh tindakan anak tidak pernah sempat berjalan.

## 3. Recovery State Matrix

**Fakta source:** [recovery contract](../../src/application/workflow/recovery-contract.ts), [startup arbiter](../../src/application/workflow/startup-recovery-arbiter.ts), [session evaluator](../../src/application/workflow/live-session-recovery.ts).

| State aktual / input | Sumber keputusan | Recommended route startup | Risiko jika meninggalkan recovery (inference) |
|---|---|---|---|
| Satu Live `drawing`, ada winner resmi | `resume-pending` | `/draw/pending/:id` | Verifikasi tertunda; keluar run dapat menghentikan presentasi |
| Satu Live `pending-confirmation`, ada winner resmi | `resume-verification` | `/draw/pending/:id` | Operator lupa keputusan pemenang yang belum selesai |
| Live drawing/pending tanpa winner | `safe-acknowledgement-required`, `selection-outcome-unknown` | `/draw/pending/:id` | Tidak boleh menganggap belum memilih atau memulai ulang |
| Receipt `started`/`unknown` tanpa committed receipt | `safe-acknowledgement-required`, `receipt-unresolved` | `/draw/pending/:id` | Outcome perintah belum aman; tindakan ulang bisa salah |
| Checkpoint sesi lain dan tanpa winner | `safe-acknowledgement-required`, `checkpoint-conflict` | `/draw/pending/:id` | Context presentasi tidak cocok; perlu peninjauan resmi |
| Lebih dari satu unresolved Live pada acara aktif | `conflicting-sessions`, sebelum evaluasi sesi tunggal | `/draw/pending` | Tidak boleh diam-diam memilih sesi terbaru sebagai kebenaran |
| Active persisted redraw request, status bukan completed, pada satu unresolved Live | Arbiter mengutamakan request untuk route; tetap membawa decision | `/draw/run/:id` | Handoff/UI dapat hilang; request, cancellation dan lineage harus tetap tersimpan |
| In-memory intentional redraw handoff | Provider `handoff`; bukan recovery result sendiri | Tidak membuat target sendiri | Gate menghapus handoff jika pathname bukan run milik handoff |
| Stored presentation checkpoint | Input contract; winner resmi mendahului metadata presentasi, kecuali receipt unresolved yang diprioritaskan | Mengikuti state sesi di atas | Tidak boleh menjadikan tahap rolling/reveal sebagai sumber hasil |
| Checkpoint corrupt/unsupported pada evaluator dengan winner | `resume-verification` pada contract/session evaluator | Pending; startup provider dapat menjadi error jika repository read melempar | Jalur fallback evaluator tidak otomatis membuktikan startup tahan semua corruption |
| Sesi sebelum hasil, `ready`/draft | Contract dapat menghasilkan `resume-setup`; startup memfilter hanya drawing/pending | Startup `normal`, **tidak** redirect ke setup | Jangan mengklaim branch setup gate aktif untuk ready session |
| Sesi completed/cancelled dengan hasil resmi | Contract `terminal`; session evaluator merekomendasikan `/history/:id` | Startup `normal`, tidak auto-redirect history | Hasil tetap tersimpan; tidak ada unresolved startup lock |
| Practice, acara lain, tidak ada active event, normal | Dikecualikan oleh scope/filter startup | Tidak ada target gate | Bukan klaim recovery semua acara atau tab |
| Storage gagal / active reference invalid / loading | Provider error/invalid/loading atau hasil storage-failure service | Tidak ada redirect recovery ini | Tidak boleh dinyatakan safe karena target null |

Tidak ada status persisted `interrupted` pada enum DrawSession; “Terganggu” adalah label UI derived. Unknown selection dan conflicting sessions berbeda: yang pertama keputusan ambigu satu sesi, yang kedua beberapa unresolved sessions. Branch `resume-setup` dan `terminal` ada dalam evaluator, tetapi tidak tercapai dari unresolved filter startup saat ini. [Tes arbiter](../../src/application/workflow/startup-recovery-arbiter.test.ts) bahkan berjudul setup untuk ready namun assertion aktual adalah normal/dashboard; audit mengikuti assertion dan kode, bukan nama tes.

## 4. Current Navigation Behavior

**Bukti uji:** [browser.json](evidence/recovery-navigation/browser.json), Edge headless dengan context nonpersistent baru, origin terisolasi `http://127.0.0.1:5182`. Fixture sintetis satu acara, kategori, konfigurasi, peserta tiket `00042`, konfigurasi display, satu Live pending dan winner pending. Tidak menjalankan pemilihan resmi atau mengakses origin installed `127.0.0.1:47882`.

| Skenario | Pengamatan aktual |
|---|---|
| Normal tanpa active event | Empat direct Help dan About terbuka normal |
| Pending recovery, direct empat Help / About | Seluruhnya berakhir di `/draw/pending/:id`, heading Tinjau Pemenang |
| Sidebar Yang Baru / Panduan / Tentang | Link terlihat tersedia, tetapi navigasi kembali ke Pending |
| Sidebar Dukungan → Laporkan Masalah | Disclosure dan modal dapat dibuka tanpa perubahan route; form eksternal tidak dikirim |
| Recommended route + refresh | Tetap Pending, bukan redirect ke Help |
| Direct Help kemudian Back / Forward | Tetap Pending; tidak ada runaway loop pada fixture ini |
| Tab baru pada context yang sama → Help Support | Membaca fixture yang sama, dialihkan ke Pending |
| Dua unresolved sessions → direct Support | Dialihkan ke `/draw/pending` landing |
| Drawing tanpa winner → direct Guide | Dialihkan ke detail Pending, banner Perlu konfirmasi aman; halaman detail menampilkan “Status hasil tidak didukung” |
| Fixture resolved + workspace signal | Tidak otomatis replay tujuan Help; route sekarang tetap Pending |
| Setelah resolved → Guide / Support / About / Dashboard | Terbuka normal |
| Back setelah resolved melintasi entry yang dulu diganti | Entry tetap URL Pending, kini Hasil Akhir; route Help yang di-replace tidak kembali |

Browser evidence mencatat 26 observasi, nol page errors. Seluruh isi tabel IndexedDB dibandingkan sebelum/sesudah rangkaian navigasi pending (termasuk modal, refresh, tab baru) dan identik. Perubahan fixture untuk resolved/conflict/unknown dilakukan terpisah sesudah perbandingan tersebut. Resolution sengaja memakai update fixture + workspace signal, **bukan acceptance konfirmasi resmi**. Tidak ada browser acceptance active redraw/countdown/corrupt DB; state itu ditelusuri dari source dan tes evaluator, bukan diklaim teruji end-to-end.

Temuan drawing tanpa winner menunjukkan target recovery belum tentu halaman actionable: detail Pending menolak status drawing. Ini keterbatasan recovery existing, bukan akibat Help; jangan memperbaikinya diam-diam dalam scope navigasi. Exception Help menyediakan bacaan, tidak menyelesaikan masalah tersebut.

**History — fakta source dan bukti:** push/direct navigation membuat entry baru; replace gate mengganti entry yang diminta, tanpa entry tambahan untuk redirect itu sendiri. Percobaan Help berulang tetap menumpuk beberapa entry identik Pending karena navigasi awal melakukan push. Pada run bukti, panjang history meningkat dari 6 menjadi 14 melalui direct/sidebar; modal tidak meningkatkannya, Back/Forward/refresh tetap 15. Jadi bukan loop otomatis tanpa batas, tetapi Back dapat terasa tidak bergerak. Target Help dan query/hash yang sudah diganti hilang. Tidak ada `returnUrl`/intended-route capture di gate; target normal tidak mereplay tujuan. Setelah resolved, history lama yang sudah diganti tetap Pending.

**Side effects — fakta source:**

- Arbiter/contract hanya menghitung keputusan; tidak membuat hasil, menyeleksi, menandai sesi interrupted, menghapus checkpoint, atau menyelesaikan recovery karena suatu route dibuka.
- Gate mengubah browser history dan **membersihkan handoff redraw di memori** ketika keluar run. Persisted redraw request tidak dihapus oleh effect tersebut. Refresh membuat provider baru sehingga handoff memori hilang secara alami.
- Provider health check membuka database yang didukung (initialization/migrations tetap mekanisme DB existing), lalu query. Jangan menyebut seluruh shell bebas side effects: publisher bisa dibuat, menyiarkan recovery/standby, mengganti status koneksi, dan menutup transport saat unmount; trace DEV juga mencatat aktivitas. `advanceSetupJourney` menulis preference jika callback dipanggil, bukan karena membuka Help.
- [Run page](../../src/pages/operator/DrawRunPage.tsx) dan [presentation](../../src/ui/operator/draw/ProductionDrawPresentation.tsx) mempunyai lifecycle tersendiri. Unmount melakukan controller dispose dan menghentikan timer; stage/blackout memakai checkpoint writes. [Pending page](../../src/pages/operator/ProductionPendingResultsPage.tsx) membaca data dan dapat mempublikasikan hasil ke Audience. Itu efek halaman tujuan/anak, bukan mutasi dari gate.
- Refresh Help saat unresolved membaca ulang state dan mengalihkan. Fixture pending tidak berubah; tidak membuktikan semua active presentation lifecycle bebas writes. Membuka Help hipotetis tidak menghapus official recovery, tetapi keluar run dapat mengubah keadaan presentasi dan handoff sementara.

## 5. Help / Settings Safety Classification

**Fakta source:** [Help pages](../../src/pages/operator/help/HelpPages.tsx), [guide content](../../src/pages/operator/help/HelpGuideContent.tsx), [support articles](../../src/pages/operator/help/help-support-content.ts), [sidebar](../../src/app/shell/OperatorSidebar.tsx), [ReportIssueModal](../../src/pages/operator/ReportIssueModal.tsx).

Help tidak memanggil repository/domain mutation, recovery executor, reset, restore, storage action, atau draw command. Checklist memakai checkbox UI; anchor melakukan scroll/focus; disclosure/modal memakai state lokal. Laporan menyusun draft/preview dari input manual dan metadata versi/origin/user-agent lalu membuka Google Forms setelah tindakan eksplisit. Membuka form tidak sama dengan mengirim laporan. Tidak ada otomatis mengambil database peserta. Parent shell/presentation effects tetap harus dinilai terpisah.

Topik existing yang tertutup hard lock justru relevan saat recovery: Support “Pemulihan setelah refresh”, “Hasil belum tersimpan / hasil tidak terlihat”, “Kendala penyimpanan lokal”, “Tampilan Audiens tidak terhubung”; Guide “Hasil, Konfirmasi, dan Undi Ulang”, “Penyimpanan dan Pemulihan”, “Tampilan Audiens dan Persiapan AV”. Instruksinya menunda keputusan Live baru, meninjau record tersimpan, dan menghindari draw ulang/reset/restore sebagai pengganti pemeriksaan. Reporting modal sidebar tetap tersedia sekarang, tetapi tidak menggantikan akses troubleshooting. Tidak ada konten Help diubah pada audit.

**Fakta source:** [AppSettingsPage](../../src/pages/operator/AppSettingsPage.tsx) memakai satu pathname; query `tab` menentukan panel dan invalid/missing value kembali ke `general`. Semua tab tetap terlihat sebagai tombol navigasi. Gate saat ini tidak membedakan tab.

| Tab / route | Kategori aktual | Efek / keputusan exception |
|---|---|---|
| General | Preference-like UI, saat ini unpersisted | Language/time/startup/mode/scale/motion hanya useState. Bukan runtime preference implementation yang boleh diklaim aktif; tidak diperlukan untuk Help exception |
| Operations | Preference-like UI + modal informasi | Recovery reminders, Audience launch, wake lock hanya state lokal; Shortcuts membuka modal. Toggle tidak menonaktifkan gate aktual |
| Connections | Simulated utilities + clipboard nyata | Test/restart/URL memakai timer/notice dummy; Copy menulis clipboard `http://127.0.0.1:5173`. Tidak melakukan integrasi/restart produksi; follow-up C tetap scope lain |
| Diagnostics | Informasi/simulasi + navigasi | Check/export/clear cache dummy; link ke Log. Bukan bukti diagnostics produksi atau cache deletion nyata |
| Storage | Read/download **dan** destructive domain mutation | Stats membaca; backup membaca main DB + prize assets dan download. Restore mengganti seluruh main tables serta mengimpor assets; reset membersihkan main tables/owned browser keys dan memberi workspace signal; executeReset tidak membersihkan database prize assets terpisah. Konfirmasi UI ada, tetapi tab tidak boleh di-allowlist secara keseluruhan |
| About | Informasi **dan** updater actions | Versi/credit/Help links informatif. Mount mendeteksi native capabilities/install result; Check Update mengakses release client. Prepare/download/install tersedia pada runtime terpasang dan memakai authoritative safety + update lock. Bukan halaman read-only murni |
| `/settings` | Event/display preferences dan presentation controls | Pengaturan Tampilan produksi berbeda dari App Settings; tetap workflow blocked |

Sumber tab: [General](../../src/pages/operator/settings/GeneralTab.tsx), [Operations](../../src/pages/operator/settings/OperationsTab.tsx), [Connections](../../src/pages/operator/settings/ConnectionsTab.tsx), [Diagnostics](../../src/pages/operator/settings/DiagnosticsTab.tsx), [Storage](../../src/pages/operator/settings/DataStorageTab.tsx), [storage service](../../src/application/storage/storage-service.ts), [About](../../src/pages/operator/settings/AboutTab.tsx), [update safety](../../src/application/update/update-safety.ts).

Storage “Bersihkan Data Sementara” saat ini hanya feedback success, bukan pembersihan aktual; jangan menyimpulkan dari label. About safety menolak unresolved/conflict/receipt/redraw/active presentation dan kondisi Audience tertentu sebelum preparation/install. Perlindungan tersebut perlu dipertahankan; bukan alasan menggolongkan seluruh About read-only. Audit tidak melakukan check/download/install nyata.

Allowlist `/settings/app` terlalu kasar. Bahkan allowlist query `tab=about` saja tidak cukup: navigasi tab dan default invalid tab dapat memasang panel lain; gate effect tidak mencegah initial mount. Option C memerlukan pembatasan render/action/query, bukan hanya pathname equality.

## 6. Decision Options

### A. Hard Lock

**Proposal:** pertahankan redirect semua route Operator produksi selain recommended recovery route; Help dan Settings ikut tertutup.

- Keuntungan: satu fokus operasional, kompleksitas perubahan kecil, tidak membuka updater/storage tambahan.
- Risiko/UX: troubleshooting offline tidak terbaca ketika paling dibutuhkan; sidebar terlihat bisa dibuka namun kembali ke recovery; history kehilangan intent. Modal laporan saja tidak cukup.
- Safety: menjaga prioritas routing, tetapi **bukan** hard mutation lock karena sibling Outlet dan async effect. Active-event scope serta handler/domain protections tetap dibutuhkan.
- Test requirement: direct/sidebar/back/forward/reload/new tab untuk pending/conflict/unknown/redraw; child mount sebelum redirect; target recovery benar-benar actionable; no mutation dan perlindungan domain existing.

### B. Help Exception

**Proposal:** izinkan hanya empat route Help terdaftar (keluarga `/help/*` yang dikenal); workflow lain tetap redirect. Persistent status/banner dan CTA **Kembali ke Pemulihan** pada Help, dengan target terbaru dari authoritative workspace. About tidak mendapat exception tahap ini.

- Keuntungan: akses petunjuk aman dan laporan tanpa membuka storage/updater, cakupan review lebih sempit dibanding C.
- Risiko/UX: operator dapat menghabiskan waktu di Help dan lupa pending; backlink Help ke About sekarang akan redirect. Perubahan saat keluar active run dapat menghentikan controller/handoff sementara.
- Safety: Help sendiri tidak menulis domain, tetapi exception routing saja belum cukup untuk lifecycle active presentation. Persisted result/request/checkpoint/receipt harus tetap otoritatif; tidak boleh memulai selection baru setelah kembali.
- Test requirement: seluruh route/deep-link Help, banner/CTA untuk tiap recovery kind, domain snapshot/no command, handoff/active run exit-return, query/hash/history, workspace loading/error/changes dan resolved state.

### C. Read-only Utility Exception

**Proposal:** Help ditambah utility yang telah dipisahkan dan dibatasi menjadi read-only; About hanya jika updater actions dan tab switching tidak dapat mengakses operasi lain selama recovery. Tidak memberi izin seluruh Settings.

- Keuntungan: versi/informasi dan utility bisa dilihat dalam context troubleshooting.
- Risiko/UX: definisi read-only lebih rumit; query spoof/default/tab click, mount effects, clipboard dan updater bukan informasi murni. Label preference saat ini juga bisa menyesatkan karena simulated.
- Safety: perlu guard render dan action selain route, serta menjaga updater safety dan storage protections. Permission route tidak boleh menjadi permission command.
- Test requirement: semua tes B ditambah tiap tab/query/default/duplicate parameter, updater capability/prepare/install denial, storage reset/restore denial, panel mount, dan utility action policy. Installed updater tests harus terisolasi tanpa upgrade nyata.

Tidak ada opsi yang dipilih pemilik pada audit ini. Tidak ada prototype exception production, banner, CTA, allowlist atau route baru dibuat. Perbandingan exception pada dokumen ini adalah analisis source, **bukan hasil uji behavior hipotetis**.

## 7. Risk Analysis

| Aspek | A | B | C |
|---|---|---|---|
| Safety | Fokus recovery kuat, tetapi routing effect bukan total lock | Hasil tetap terlindungi jika domain guards/lifecycle teruji; risiko lupa pending perlu status persisten | Permukaan tindakan/query lebih luas, perlu isolasi aksi updater/storage |
| Usability | Bantuan relevan tertutup, terutama saat target tidak actionable | Troubleshooting terbaca; kembali recovery harus jelas dan selalu tersedia | Utility lebih lengkap tetapi batas izin dapat membingungkan |
| Implementation complexity | Rendah untuk mempertahankan routing; target/lock defects tetap terpisah | Terbatas pada policy Help/status/return, namun active run memerlukan pemeriksaan nyata | Lebih tinggi: tab-level rendering, action guards, updater dan regression Settings |

**Inference:** Membaca bantuan lebih kecil risikonya daripada membuka tindakan storage/updater, tetapi waktu/context switching saat acara tetap nyata. Tidak ada skor numerik atau jaminan safety menyeluruh. Recovery tidak boleh di-dismiss sebagai cara membuka workflow lain. Banner tidak menggantikan command-level protections, dan navigation gate saja tidak mengunci perubahan database dari tab lain.

## 8. Recommended Direction

**Rekomendasi arsitektur: B — Help Exception**, pending keputusan pemilik dan acceptance di bagian 11.

Why: empat Help lokal tidak memanggil mutasi domain; kontennya sudah menyarankan peninjauan record aman saat recovery. Hard lock menutup kebutuhan itu; C membuka persoalan updater/storage/tab boundaries yang tidak diperlukan untuk akses Help.

Routes allowed: hanya `/help/whats-new`, `/help/guide`, `/help/support`, `/help/licenses` beserta anchor/query yang tidak memberi hak operasi. `/help/*` adalah shorthand keluarga yang terdaftar, bukan wildcard bebas untuk route masa depan.

Routes still blocked: semua workflow non-target, App Settings seluruh tab termasuk About, Pengaturan Tampilan, Events, History dan route operasional lain sebagaimana policy recovery. Recommended route tetap dibolehkan. Di luar shell (Audience/DEV) tidak diubah scope ini.

Behavior pada Help: status recovery persisten, tidak dapat di-dismiss; jelaskan unresolved/conflicting/safe acknowledgement sesuai state. Baca Help tidak menyelesaikan, membersihkan atau merepair recovery. CTA Kembali ke Pemulihan memakai recommendedRoute terbaru; tidak memakai URL dari query. Pada loading/error jangan menyatakan safe atau membuat target palsu. Setelah resolved, status hilang dan Help tetap di halaman sekarang, tanpa redirect default atau replay intent yang tidak disimpan.

Behavior kembali: CTA tersedia pada semua halaman Help; target konflik tetap landing, target satu sesi sesuai arbiter/redraw. History push/replace untuk CTA diputuskan dan diuji pada implementation review agar Back tidak menciptakan bounce. Backlink About existing harus mendapat perlakuan context recovery yang jelas; proposal ini tidak mengubahnya sekarang.

## 9. Required Guardrails

1. Pisahkan izin membaca Help dari izin tindakan Live/event/storage/update. Domain command protections tetap authoritative.
2. Status/CTA persisten mengikuti workspace yang sama; tidak menghapus session, request, receipts, checkpoint, winner atau lineage saat Help dibuka.
3. Audit dan uji exit-return active run: controller dispose, checkpoint transition yang sedang berjalan, publisher ownership, intentional handoff yang dibersihkan, refresh dan re-entry redraw. Jangan menyamakan memori handoff dengan persisted request.
4. Jangan auto-start/reselect pada return/new tab, jangan replay timer berdasarkan asumsi UI. Jika active stage belum aman untuk ditinggalkan, implementasi B harus ditahan sampai batas lifecycle diselesaikan dalam scope yang disetujui; jangan diam-diam mengubah presentasi.
5. Exact route allowlist; route Help masa depan wajib diaudit. Unknown/help-like path dan Settings query tidak menjadi bypass.
6. Current active-event scope, async load dan cross-tab freshness dijelaskan; jangan mengklaim gate lock semua acara. CTA tidak boleh memakai stale session target setelah workspace berubah.
7. About updater/storage tetap blocked; tidak menonaktifkan safety lock untuk kemudahan navigasi.
8. Fokus/keyboard/banner readable pada viewport Operator; external form tetap tindakan eksplisit, tanpa pengiriman otomatis/data peserta.
9. Temuan unknown drawing target tidak actionable dicatat sebagai follow-up recovery terpisah, tanpa source fix pada audit ini.

## 10. Implementation Plan if Approved

**Rencana bersyarat, belum dilakukan:**

1. Konfirmasi opsi pemilik. Bila B, tetapkan empat route Help dan batas lifecycle active run sebelum editing; jangan menambahkan About tanpa keputusan baru.
2. Tambahkan predicate izin navigasi kecil/typed dan status recovery yang dibagi gate/Help; pertahankan authoritative target dan domain protections.
3. Tambahkan status persisten dan CTA return di shell Help; sesuaikan backlink About dalam context recovery tanpa rewrite panduan.
4. Uji lifecycle run/redraw dan kasus ambiguous/conflict, lalu browser fixture. Jika ditemukan kebutuhan perubahan presentation/domain, laporkan scope tambahan sebelum melanjutkan.
5. Jalankan focused tests, lint dan build untuk coding slice; review diff, bukti manual/browser, dan full-suite state sesuai scope acceptance berikutnya. Tidak ada release/version/install/push otomatis.

## 11. Acceptance Tests Required

**Sebelum menerima perubahan B/C:**

- State matrix normal/no-event/loading/error/invalid reference, one pending, drawing+winner, drawing tanpa winner, unresolved receipt, conflicting sessions, active redraw, checkpoint matching/absent/conflicting/corrupt, completed/cancelled, Practice dan acara lain.
- Empat direct Help, sidebar, Support→Guide anchor, About link, Back/Forward, refresh, new tab; exact path/query/hash behavior. Workflow tetap blocked; jangan sekadar memeriksa mocked navigate.
- Banner/CTA selalu terlihat pada Help selama unresolved, tidak dismissible, target berubah saat authority berubah. Setelah resolution tidak ada banner stale, auto replay intended route, atau redirect default tak diminta.
- Snapshot seluruh tabel/record sebelum-sesudah Help/return; zero draw commands, zero official winner/recovery clear akibat navigasi. Ticket `00042`, cancellation/replacement lineage dan receipts tetap terjaga.
- Active countdown/rolling/reveal/pending-handoff dan redraw exit-return/refresh: disposal/timer/checkpoint race, in-memory handoff loss, persisted request recovery, publisher/public state dan no reselection. Dev fixture ini **belum** membuktikan bagian tersebut.
- Case C: tab switch, missing/invalid/duplicate `tab`, default panel, mount side effects, action guards, storage denial dan updater safety. Jangan allowlist seluruh Settings.
- History intent hilang oleh replace dipahami; setelah resolved Back/Forward tidak bounce; route return tidak membuat loop dan tidak memakai arbitrary returnUrl.
- Offline lokal, keyboard/focus, viewport 1440×900, reporting modal tanpa submit eksternal otomatis.

**Verification audit yang benar-benar dijalankan:**

```text
npm.cmd run test -- src/app/workspace/StartupRecoveryGate.test.tsx src/application/workflow/startup-recovery-arbiter.test.ts src/application/workflow/recovery-contract.test.ts src/application/workflow/live-session-recovery.test.ts src/pages/operator/help/HelpNavigation.test.tsx src/pages/operator/help/HelpContent.test.tsx
```

Hasil: **6 files / 53 tests PASS**, exit 0. Tes existing tidak diedit dan tidak ada tes baru committed yang mengunci policy lama. Browser: 26 observasi, zero page errors; navigasi pending snapshot identik. Script exploration berada di TEMP dan bukan source produksi. Percobaan browser pertama berhenti karena harness menutup disclosure Dukungan sebelum klik laporan; harness diperbaiki menjadi buka hanya jika collapsed, lalu dua run lengkap lulus. Itu kesalahan harness, bukan failure aplikasi.

`git diff --check` dan pengecekan seluruh link relatif dokumen/JSON dilakukan sebelum commit; hanya dokumen ini dan evidence JSON menjadi perubahan audit. Full suite, lint dan build tidak dijalankan karena tidak ada perubahan application/TypeScript; focused green bukan klaim full-suite green. Kegagalan baseline full-suite yang tercatat pada closeout sebelumnya tidak dianggap terselesaikan oleh audit ini. Server fixture dihentikan setelah pengujian.

## 12. Open Product Decision

Keputusan diperlukan sebelum perubahan behavior. About saat ini tidak memenuhi definisi read-only penuh; jika memilih C, scope tambahan pembatasan updater/tab harus ditetapkan. Pilihan tidak boleh diartikan mengubah integritas hasil, state machine recovery atau melonggarkan tindakan resmi.

```text
PRODUCT DECISION REQUIRED

Saat unresolved Live recovery aktif:

[ ] A — Blokir seluruh route non-recovery termasuk Help.
[ ] B — Izinkan empat route /help/* terdaftar sebagai read-only exception,
        dengan status persisten dan CTA Kembali ke Pemulihan.
[ ] C — Izinkan Help + utility read-only lain yang telah diaudit,
        dengan pembatasan render/tab/action sebelum About dapat diizinkan.

Recommended by audit: B
Reason: Help lokal tidak menjalankan mutasi domain dan menyediakan petunjuk
yang dibutuhkan saat recovery, sementara Settings/About memiliki tindakan
di luar membaca informasi. Recovery tetap prioritas dan workflow lain terkunci.

Owner decision: BELUM DIPILIH.
```
