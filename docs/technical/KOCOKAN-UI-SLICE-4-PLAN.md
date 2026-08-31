# Plan Slice 4 — Pending Results Kocokan

Tanggal: 2026-09-01. Status: **plan dan amendment disetujui; implementasi serta
verifikasi selesai dan menunggu review owner**.

Owner menyatakan Slice 3 selesai dan menyetujui boundary Slice 4 secara prinsip,
dengan amendment UX/visual di bawah sebagai guard yang mengikat. Owner kemudian
memberi izin eksplisit untuk preflight, implementasi, verifikasi, dan satu commit
Slice 4. Hasil pelaksanaan dicatat di [laporan Slice 4](KOCOKAN-UI-SLICE-4.md).
Tidak ada rekonsiliasi Phase 11.

Snapshot saat amendment dibuat: branch `redesign/kocokan-ui`, HEAD `93f3785`
(`feat(ui): apply light-first Kocokan Draw Console slice 3`), worktree bersih.

Acuan:

- [PRD](../product/PRD.md)
- [rencana redesign utama](KOCOKAN-UI-REDESIGN-PLAN.md)
- [inventaris permukaan](KOCOKAN-UI-SURFACE-INVENTORY.md)
- [rencana Slice 3](KOCOKAN-UI-SLICE-3-PLAN.md)
- [laporan Slice 3](KOCOKAN-UI-SLICE-3.md)

## 1. Tujuan yang terlihat oleh Operator

Memperjelas alur **meninjau hasil → memilih pemenang → mengonfirmasi,
membatalkan, atau mengundi ulang → melanjutkan ke undian berikutnya** dalam
bahasa visual Kocokan light-first. Operator harus dapat membaca jumlah keputusan
yang belum selesai, tiket yang dipilih, konsekuensi tindakan, dan kapasitas
pengganti dengan cepat tanpa mengubah perilaku domain yang sudah ada.

Slice 4 adalah refinement hierarki dan kepadatan interaksi. Slice ini bukan
redesign alur kerja baru dan bukan perubahan requirements Phase 11.

## 2. Prinsip workspace yang mengikat

Jangan merombak information architecture Pending Results. Struktur luas yang
sudah ada dipertahankan:

```text
summary
  -> winner decision workspace
  -> operator context
  -> authoritative record
```

Urutan baca, kepemilikan state, route, query, dan handoff tetap sama. Perubahan
boleh merapikan hierarchy, spacing, density, wrapping, responsive placement,
dan treatment visual. Jangan memindahkan audit menjadi aksi utama, menggabungkan
context ke setiap row, atau membuat wizard/drawer baru demi tampilan.

## 3. Scope dan hasil yang dituju

### A. Landing Pending Results — `/draw/pending`

- Pertahankan loading, setup-required, error/retry, empty, satu sesi Pending,
  dan beberapa sesi Pending yang sudah ada.
- Terapkan komposisi Kocokan light-first yang konsisten dengan shell serta
  Slice 2–3. Satu sesi tetap memprioritaskan `Tinjau Pemenang`; beberapa sesi
  tetap mempertahankan satu tautan review per sesi tanpa sort/filter baru.
- Event context, jumlah pemenang, hadiah, kategori, dan waktu yang sudah tersedia
  tetap berasal dari query saat ini. Jangan menambah query atau derived state.
- Empty state tetap operasional dan tidak mengklaim bahwa riwayat resmi kosong.

### B. Summary metrics — `/draw/pending/:drawSessionId`

Strip metrik tidak boleh tampil sebagai lima dashboard card dengan bobot sama.
Semua nilai tetap terlihat, tetapi hierarchy operasionalnya adalah:

1. **Tertunda** — paling menonjol karena masih membutuhkan keputusan.
2. **Dikonfirmasi**.
3. **Dibatalkan**.
4. **Pengganti**.
5. **Total pemenang** — tetap terlihat sebagai konteks, bukan prioritas utama.

Boleh mengubah urutan presentasi/DOM yang bersifat visual dan class hook untuk
mencerminkan prioritas di atas. Jangan mengubah filter `pending`, `confirmed`,
`cancelled`, perhitungan replacement, angka total, repository query, atau cara
nilai diturunkan. Status tidak boleh dibedakan melalui warna saja.

### C. Winner decision workspace dan scalability

Desain selection workspace harus diverifikasi untuk skenario jumlah pemenang:

```text
1, 6, 10, 20, 50, 100
```

- Ticket number adalah identifier visual terkuat pada setiap row/cell.
- Pertahankan ticket sebagai exact string, leading zeroes, urutan existing,
  status, sequence number, dan selection eligibility.
- Gunakan compact row/grid yang tidak berubah menjadi card besar per pemenang.
  Banyak pemenang boleh memakai beberapa kolom pada viewport lebar dan kembali
  ke kolom lebih sedikit pada viewport sempit, selama urutan baca DOM tetap.
- Workspace harus tetap dapat discroll dan digunakan pada 50/100 pemenang;
  jangan memakai tinggi tetap yang memotong row, sticky layer yang menutupi
  row, virtualisasi baru, pagination baru, atau reorder.
- Cancelled/confirmed/non-actionable record tetap terbaca dan disabled sesuai
  eligibility saat ini. Styling tidak boleh membuat record tersebut tampak
  dapat dipilih.

### D. Selection visibility dan controls

Selected state lavender harus persisten saat:

- hover;
- keyboard focus/focus-within;
- multi-select;
- select-all;
- ketersediaan action berubah.

Selector hover/focus tidak boleh mengalahkan selected state karena specificity
atau source order. Selection memakai lebih dari warna: native checkbox/checked
state, outline, background lavender, serta teks/icon state yang memang sudah
tersedia. Native `checked` tetap menjadi accessible source of truth; jangan
menambahkan ARIA yang bertentangan dengan semantics checkbox.

Ekspos kemampuan selection yang sudah ada dengan jelas. Reuse state/handler
existing (`selected`, toggle individual, dan toggle seluruh Pending); jangan
menambah selection rule baru. Current handler memang mendukung memilih seluruh
Pending dan membersihkan pilihan tersebut melalui toggle yang sama. Jika audit
implementasi menemukan clear-selection pada salah satu permukaan ternyata tidak
didukung state/handler existing, hentikan bagian itu dan minta approval sebelum
menambah behavior.

Quick-redraw selection pada Draw Run hanya boleh memvisualkan kemampuan existing:
pilih individual, pilih semua, dan bersihkan pilihan yang memang sudah tersedia.
Tidak menambah range selection, invert selection, filter-selection, atau shortcut.

### E. Action hierarchy

Tiga decision action harus berbeda melalui icon, label, fill/outline hierarchy,
dan disabled state; warna bukan satu-satunya pembeda:

- **Konfirmasi:** action terkuat ketika selection valid.
- **Batalkan:** destructive action.
- **Undi Ulang:** corrective/risky action, berbeda dari destructive cancel dan
  tidak tampil sebagai aksi rutin tanpa konsekuensi.

Jumlah target yang sudah ditampilkan pada label/action context dipertahankan.
Jangan mengubah `canDecide`, capacity guard, busy guard, expected winner status,
confirmation/cancellation/redraw command, atau kapan action tersedia.

### F. Operator context panel

Pertahankan panel context di sisi kanan pada viewport yang cukup lebar. Tingkatkan
hierarchy agar Operator cepat menemukan:

- Acara;
- kategori;
- hadiah;
- jumlah pemenang;
- pool yang memenuhi syarat;
- waktu undian;
- kapasitas pengganti.

Panel tetap supporting metadata: surface lebih tenang dan bobot visual lebih
rendah daripada decision workspace. Pada viewport lebih sempit panel boleh
menumpuk sesuai responsive flow tanpa mengubah isi atau query. Replacement
capacity tetap menjelaskan bahwa identitas pengganti belum dipilih sampai redraw
diminta; UI tidak boleh memilih atau mengarang pengganti terlebih dahulu.

### G. Decision dialogs dan reason menu

- Rapikan dialog confirm, cancel, redraw Pending, redraw Confirmed, quick-redraw
  confirmation, dan multi-winner selection yang termasuk ownership Slice 4.
- Pertahankan title, target count/ticket context, consequence, busy/disabled
  guard, Escape, focus return, inert boundary, callback, dan command semantics.
- Integrasikan existing `react-select` ReasonSelect ke tema light Operator.
  Body portal tetap `document.body`, fixed positioning dan stacking tetap aman.
  Tidak mengganti dependency atau mengubah daftar/value reason.
- Hilangkan hardcoded legacy dark menu hanya melalui adapter/class/style milik
  Slice 4. Menu/options/focus/selected/disabled harus menggunakan white/warm
  surfaces, charcoal outline, lavender selection, dan focus yang terlihat.
- Reason `other` tetap mewajibkan note non-empty; reason lain mempertahankan
  optional note. Tidak mengubah validation atau audit payload.

### H. Authoritative record

Pertahankan authoritative WinnerRecord sebagai bagian secondary/collapsible
yang sudah ada. Audit data tidak boleh bersaing dengan active decision workflow.

- Original/cancelled winner tetap terlihat.
- Status, timestamp yang tersedia, dan hubungan original-to-replacement tetap
  terbaca tanpa memodifikasi record atau lineage query.
- Collapsible disclosure, keyboard semantics, dan default state dipertahankan.
- Jangan memindahkan action keputusan ke dalam record audit.

### I. Completed state — next action workspace

Completed Pending Results harus jelas bertransisi dari **decision workspace**
menjadi **next action workspace**:

- Primary: `Mulai Undian Berikutnya`.
- Secondary: `Lihat Riwayat`.
- Correction/redraw hasil Confirmed: risky, terpisah secara spasial dan visual
  dari normal next-step actions.

Completed/read-only state tidak boleh menampilkan kontrol Pending aktif. Aksi
correction mempertahankan confirmation, reason, capacity, winner target, dan
receipt semantics existing. Slice 4 tidak mendesain halaman History tujuan.

## 4. Light-first guard

Seluruh Pending Results adalah bagian dari Kocokan light Operator system:

- white/warm off-white surfaces;
- charcoal outline;
- controlled hard shadow;
- lavender untuk selection;
- semantic green/amber/red hanya ketika bermakna.

Tidak boleh ada panel besar legacy dark pada landing, summary, winner workspace,
context, authoritative record, completed state, modal, atau dropdown portal.
Nested section dibuat lebih flat daripada parent surface; hindari card di dalam
card yang tebal, gradients, glass, neon, glow, dan motion dekoratif.

Audience presentation, `AudiencePresentation`, `/display`, public projection,
preview canvas, safe area, winner layout Audiens, dan Audience CSS tetap beku.

## 5. Localization guard

Jangan memasukkan rekonsiliasi lokalisasi luas ke Slice 4. Existing mixed copy,
termasuk `pending` dan `winners selected`, tetap dicatat sebagai utang Phase 11
sampai owner memberi izin eksplisit untuk scope lokalisasi terpisah.

- Jangan mengubah behavioral assertions hanya untuk menormalkan copy.
- Jangan menyapu string lain di luar permukaan visual yang diizinkan.
- Jangan mengubah enum, reason value, command name, receipt, route, storage key,
  protocol field, export header, timestamp, atau identifier tersimpan.
- Ticket strings dan leading zeroes tidak pernah dilokalkan/diformat ulang.

Jika mixed copy mengganggu fit visual selama browser check, catat sebagai
limitation/evidence; jangan memperbaikinya diam-diam dalam commit redesign.

## 6. Kontrak yang tidak boleh berubah

- Secure draw selection, Web Crypto, eligibility, candidate pool snapshot,
  winner order, ticket strings, dan replacement capacity query.
- Winner/session status transition, confirmation, cancellation, redraw,
  partial confirmation, redraw reason/note rules, dan lineage.
- Command/receipt/idempotency, persistence transaction, schema/migration,
  history/audit/export, recovery, dan official record ownership.
- Practice/Live isolation, publisher lifecycle, Audience protocol,
  BroadcastChannel, blackout, reconnect, dan pending recovery tanpa reselection.
- Route, query parameters, link target, service construction, effects,
  subscriptions, refs, React keys, handler, disabled guard, dan conditional branch.
- Shared tokens/primitives/shell, Slice 2/3 composition di luar hook yang secara
  eksplisit dimiliki Slice 4, prototype `/dev/*`, History, Settings, dan Audience.
- Tidak ada dependency/font baru, backend, fitur selection baru, atau product
  requirement baru.

Perubahan visual tidak boleh menghapus atau menimpa official history, memilih
pemenang baru saat render/recovery, atau membuat hover/focus memicu command.

## 7. Rencana file dan ownership CSS

| File | Perubahan yang direncanakan |
|---|---|
| `src/pages/operator/ProductionPendingResultsLandingPage.tsx` | Hook komposisi landing/state yang sudah ada; tanpa query baru |
| `src/pages/operator/ProductionPendingResultsPage.tsx` | Hierarchy summary, compact winner workspace, context, completed/read-only, dialog hook, light ReasonSelect adapter; handler/domain tetap |
| `src/ui/operator/draw/ProductionDrawPresentation.tsx` | Hanya grid selection multi-quick-redraw dan dialog dalam ownership Slice 4; Draw Run/Audience preview lain beku |
| `src/styles/kocokan/pending.css` (baru) | Pemilik tunggal style Pending Results, selected specificity, responsive grid, dialogs, dan reason portal |
| `src/styles/app.css` | Satu import stylesheet Slice 4 |
| Test Slice 4 | Coverage visual/semantic hooks, selection persistence, action hierarchy, reason portal, completed state, scalability fixtures |
| `docs/technical/evidence/kocokan-ui-slice4/` | Baseline, browser observations, screenshots terpilih, test comparison, scope/isolation audit |
| Dokumentasi | Plan ini, laporan Slice 4 setelah implementasi, `TASKS.md`, dan status rencana utama |

Gunakan `useUiClass`/theme opt-in dan `--kc-*` yang sudah tersedia. Default
unthemed consumers tetap legacy. Jangan menghapus style lama dari `operator.css`
di Slice 4; stylesheet baru mengisolasi ownership production Kocokan. Hindari
broad descendant selectors, `!important`, perubahan ancestor font/line-height,
atau selector yang bocor ke Audience/prototype.

Jika implementasi membutuhkan shared primitive/token, domain/application,
persistence, route, atau file History/Audience di luar tabel ini, hentikan bagian
tersebut dan minta keputusan scope. Jangan memperluas izin diam-diam.

## 8. Urutan pengerjaan setelah izin eksekusi

1. **Preflight:** catat acceptance Slice 3, branch/HEAD/cleanliness; baca ulang
   PRD, plan utama, inventory, Slice 3 report; audit diff/handlers dan capture
   focused/full baseline serta visual sebelum perubahan pada data uji terisolasi.
2. **Landing dan summary:** migrasikan state landing; atur hierarchy metric
   Tertunda → Dikonfirmasi → Dibatalkan → Pengganti → Total tanpa mengubah nilai.
   Browser-check sebelum pindah area.
3. **Decision workspace:** implement compact row/grid untuk 1/6/10/20/50/100,
   persistent selected state, existing select-all/clear toggle, action hierarchy,
   dan right-side context. Audit handler/guard setelah perubahan markup.
4. **Dialogs dan portal:** rapikan confirm/cancel/redraw, multi-winner quick
   selection, serta light ReasonSelect adapter. Cek keyboard, Escape, focus
   return, portal stacking, `other` validation, busy, dan disabled.
5. **Authoritative/completed:** jaga audit collapsible tetap secondary; ubah
   completed menjadi next-action workspace dan pisahkan risky correction.
6. **Closeout:** focused/full regression comparison, viewport/browser/isolation
   evidence, scope audit, laporan, satu focused commit, clean worktree, lalu stop
   untuk review owner sebelum Slice 5.

Jangan memulai History, Settings, integrated Slice 7, atau Phase 11 reconciliation.

## 9. Verifikasi dan acceptance

### Automated checks saat implementasi

Focused before/after minimal:

```text
npm.cmd run test -- src/pages/operator/ProductionPendingResultsLandingPage.test.tsx src/pages/operator/ProductionPendingResultsReasonSelect.test.tsx src/ui/operator/draw/ProductionDrawPresentation.test.tsx src/application/pending-decisions/pending-decisions.test.ts src/application/pending-decisions/confirmation-workflow.test.ts src/application/pending-decisions/cancellation-workflow.test.ts src/application/pending-decisions/redraw-workflow.test.ts src/application/pending-decisions/capacity-query.test.ts src/application/workflow/phase10-recovery-acceptance.integration.test.tsx --maxWorkers=2
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
```

Tambahkan dedicated production Pending visual/semantic test bila diperlukan,
misalnya `src/pages/operator/KocokanPendingResults.test.tsx`. Jangan memakai
prototype `PendingResultsPage.test.tsx` sebagai bukti perilaku production;
prototype tetap perlu isolation check agar theme tidak bocor.

Full suite wajib sebelum closeout karena halaman ini menjalankan official
decision commands dan perubahan menyentuh dialog quick-redraw lintas route:

```text
npm.cmd run test -- --maxWorkers=2 --reporter=json --outputFile=node_modules/.tmp/kocokan-slice4-full.json
```

Gunakan reporter JSON untuk focused baseline/after dan bandingkan exact test
identity/signature dengan register baseline serta hasil Slice 3. Laporkan secara
terpisah: newly passing, baseline FAIL identik, changed failure, dan new failure.
Hentikan/investigasi changed/new failure atau perilaku relevan yang sebelumnya
lulus menjadi gagal. Keseluruhan FAIL tetap dilaporkan FAIL; baseline debt tidak
dianggap waived dan tidak diperbaiki dalam commit visual tanpa izin.

Behavioral test tidak boleh dilemahkan/dihapus untuk mengakomodasi markup atau
copy. Assertion visual/semantic yang benar-benar berubah boleh ditambah atau
disesuaikan secara terbatas dengan bukti bahwa handler, command, record, dan
accessible control behavior tetap.

### Browser dan acceptance visual

| Area | Kondisi minimum yang harus dibuktikan |
|---|---|
| Landing | loading, setup-required, error/retry, empty, satu Pending, beberapa Pending |
| Summary | seluruh lima nilai benar; prioritas visual Tertunda → Dikonfirmasi → Dibatalkan → Pengganti → Total; bukan lima card setara |
| Winner workspace | 1, 6, 10, 20, 50, 100; exact/leading-zero tickets; order/status/eligibility; no clipped action/row |
| Selection | individual, multi, select-all, clear existing; selected bertahan pada hover/focus; checkbox + outline + lavender; disabled tetap jelas |
| Actions | Confirm strongest saat valid; Cancel destructive; Redraw corrective/risky; count, capacity, busy, dan disabled benar |
| Context | right-side pada lebar cukup; Event/category/prize/count/pool/time/capacity cepat terbaca; metadata tetap quieter |
| Dialog/portal | confirm, cancel, redraw Pending/Confirmed, quick-redraw selection; reason menu light; keyboard/Escape/focus return; `other` note required |
| Partial/read-only | campuran Pending/Confirmed/Cancelled/Replacement; non-actionable tidak selectable; authoritative lineage tetap terlihat |
| Completed | next-action workspace; `Mulai Undian Berikutnya` primary; `Lihat Riwayat` secondary; correction terpisah dan risky |
| Isolation | Audience canvas/`/display`, History, prototype, shared shell, dan Slice 2–3 surface di luar ownership tidak berubah |

Operator diperiksa pada **1366×768, 1440×900, dan 1920×1080**. Periksa
vertical scrolling, sticky/action overlap, long Event/prize/category, long audit
note, portal dekat tepi viewport, dan ticket leading zeroes. Horizontal document
overflow, hidden controls, selection yang hilang saat hover/focus, atau 100
winner rows yang tidak dapat dijangkau adalah failure.

Gunakan origin/profile dan fixture data terpisah dari data pengguna. Practice atau
fixture read-only menjadi default untuk visual setup; jangan membuat official Live
record hanya untuk screenshot tanpa izin eksplisit. Jika state Live diperlukan,
gunakan test data terisolasi dan dokumentasikan dataset, expected/observed, browser,
viewport, commit, serta cleanup. Automated test/screenshot tidak menggantikan
manual Chrome/Edge, assistive technology, two-window, atau owner acceptance.

## 10. Definition of done dan keputusan owner

- Information architecture tetap summary → decision workspace → context →
  authoritative record; tidak ada workflow baru.
- Semua lima summary values tetap benar dengan priority yang disetujui.
- Skenario 1/6/10/20/50/100 usable dan exact ticket strings terjaga.
- Selected state persisten pada hover/focus dan menggunakan non-color cues.
- Existing selection/action/decision semantics, query, receipt, audit, recovery,
  dan Audience behavior tidak berubah.
- Context tetap kanan pada viewport cukup; authoritative record tetap secondary;
  completed state memprioritaskan next action dan memisahkan correction.
- Seluruh scope light-first tanpa large legacy dark panel atau theme leakage.
- Mixed localization debt tidak diselesaikan/dinormalisasi dalam Slice 4.
- Focused/full verification, failure comparison, browser observations, scope
  audit, evidence, laporan, dan keterbatasan dicatat jujur.
- Satu focused implementation commit dan clean worktree; stop untuk owner review
  sebelum Slice 5. Tidak ada klaim release-ready atau official-Live readiness.

Approval berikutnya yang masih diperlukan: **owner review dan acceptance atas
hasil Slice 4**. Implementasi berhenti sebelum Slice 5.
