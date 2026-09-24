# Kocokan UI Redesign — Slice 6 Plan

Tanggal audit: 2026-09-01

Branch audit: `redesign/kocokan-ui`

Status: **planning only; implementasi belum diizinkan**.

## 1. Keputusan dan batas audit

Slice 6 hanya memodernisasi presentasi visual Operator untuk Settings dan state
lintas aplikasi. Seluruh handler, service, repository, state machine, route
target, persistence, recovery decision, Audience protocol, dan isi presentasi
publik tetap menjadi kontrak beku.

Dokumen ini dibuat dari source inspection, focused test run, dan pemeriksaan
terfokus in-app Chromium pada 1440 × 900. Pemeriksaan browser menggunakan Acara
lokal terisolasi bernama `Audit Slice 6`; Settings disimpan satu kali untuk
membuat konfigurasi Display pada profile audit, Display Test dinyalakan lalu
dihentikan, dan tidak ada sesi atau record Live resmi yang dibuat. Observasi ini
bukan manual Chrome/Edge, assistive-technology, two-window, atau owner
acceptance.

Preflight implementasi harus dimulai dari checkpoint Slice 5 yang sudah diterima,
satu commit terfokus, dan worktree bersih. Pada saat audit ini HEAD masih
`0b42c35` (Slice 4) dan worktree berisi perubahan History/Slice 5 yang belum
menjadi commit terpisah. Dokumen rencana ini tidak mengubah atau menilai
acceptance perubahan tersebut.

## 2. Tujuan Slice 6

- Menjadikan Branding, Presentasi, Audio, dan Tampilan satu keluarga Settings
  Kocokan yang jelas, ringkas, light-first, dan konsisten dengan shell serta
  primitive yang sudah ada.
- Memisahkan konfigurasi yang disimpan, tindakan Display Test, status koneksi,
  dan feedback sementara sehingga Operator tidak menyamakan `Terhubung` dengan
  snapshot tes yang sudah diterapkan.
- Menyatukan grammar visual loading, empty/setup-required, error, blocked,
  storage failure, recovery, unavailable, toast, dan fallback pada Operator
  tanpa mengubah kondisi atau tindakan yang menghasilkan state tersebut.
- Menghapus ketergantungan production Settings/state pada styling Kocokan yang
  terselip di `operator.css`, lalu menempatkan ownership baru pada
  `kocokan/settings.css` dan `kocokan/states.css`.
- Menutup sisa inkonsistensi Operator yang benar-benar berada dalam ownership
  Settings/state chrome, tanpa membuka refactor route/page atau rekonsiliasi
  Phase 11.

## 3. Current visual and state inventory

### 3.1 Settings shell

| Area | Implementasi saat ini | Observasi visual/state | Risiko atau utang Slice 6 |
|---|---|---|---|
| Page/header | `ProductionSettingsPage` + `PageHeader` | Sudah berada di shell Kocokan; action `Buka Tampilan Audiens` muncul setelah Display configuration tersedia | Action header dan action dalam section Display menduplikasi entry point secara sengaja; hierarchy perlu jelas tanpa menghapus salah satunya |
| Section navigation | Empat raw button: Branding, Presentasi, Audio, Tampilan; `aria-current="page"` | Card kiri putih dengan hard shadow; active lavender dan focus outline terlihat | Class raw `.settings-*` masih dimiliki `operator.css`; belum ada `kocokan/settings.css` |
| Settings card | Satu article mengganti isi sesuai state lokal `section` | Card putih besar, status authority di kanan atas, form/action di bawah | Layout sudah light-first tetapi styling bercampur dengan legacy/prototype selectors |
| Save authority | `loading`, `persisted`, `unsaved`, `saving`, `saved`, `error` dipetakan ke label visual | Audit melihat `Perubahan belum disimpan` pada Display belum dikonfigurasi dan `Tersimpan` setelah save | State derivation harus tetap persis; hanya badge/hierarchy yang boleh berubah |
| Setup continuation | Fixed `ProductionSetupContinuation` tetap muncul pada `/settings` | Pada fixture belum lengkap, footer mengunci langkah Display dan menutupi bagian bawah viewport | Dimiliki Slice 2 secara fungsional; Slice 6 hanya regression-check overlap/fit, bukan mengubah journey atau unlock guard |

### 3.2 Branding

| Surface/state | Implementasi saat ini | Batas Slice 6 |
|---|---|---|
| Nama dan subjudul publik | Dua controlled text input | Rapikan label, spacing, focus, dirty/saving/disabled presentation; value dan handler tetap |
| Warna utama dan aksen | Native color input + text hex input | Pertahankan dua input dan value exact; jangan menambah normalisasi/validasi warna |
| Logo | File input lokal, empty preview, selected filename/size, replace/remove | Ubah chrome asset card saja; file accept, Blob, object URL cleanup, remove handler, dan persistence tetap |
| Background 16:9 | File input lokal dengan preview lebar | Sama seperti logo; tidak mengubah crop, object-fit, ukuran aset, atau data yang disimpan |
| Empty/selected asset | Empty menampilkan `LOGO`/`16:9`; selected menampilkan image | Kedua state, long filename, invalid/missing image preview, dan remove action harus masuk browser matrix |

### 3.3 Presentation

Enam persisted control sudah tersusun dua kolom: countdown duration, rolling
duration, reveal style, celebration effect, reduced-motion checkbox, dan winner
layout preference. Audit visual menunjukkan native select sudah light dan
readable, tetapi reduced-motion masih berupa raw checkbox composition yang
berbeda dari Toggle Kocokan.

Slice 6 boleh menyelaraskan label, helper, control height, selected/focus,
disabled treatment, dan grid responsive. Elemen kontrol harus tetap native
select/checkbox dengan option/value, order, keyboard behavior, dan handler yang
sama. Tidak mengubah duration preset, reveal/celebration enum, reduced-motion
semantics, winner layout behavior, atau presentasi Audience.

### 3.4 Audio

| Surface/state | Current ownership | Keadaan yang wajib dipertahankan |
|---|---|---|
| Audio switch | Raw `role="switch"` checkbox dengan Enter handler | Aktif/nonaktif, checked/unchecked, visible focus, non-color cue, dan real switch semantics |
| Volume | Native range, disabled bila audio nonaktif | Nilai 0–100 dan output persen exact; disabled tetap jelas dan tidak terlihat actionable |
| Reveal cue asset | Local audio file, empty/selected/replace/remove | Existing MIME/size validation dan Blob tetap; tidak menambah cue baru |
| Audio test | `Audio` browser API setelah user action | Ready, disabled, invalid/unavailable file, played, autoplay/permission failure, dan ended cleanup |
| Audio feedback | Inline `role="status"` | Tetap non-blocking; kegagalan audio tidak boleh menghalangi draw atau mengubah persisted settings |

Audit visual memperlihatkan dua kolom yang cukup jelas, tetapi disabled controls,
file card, inline status, dan primary save action belum memakai satu grammar
state yang konsisten. Visualisasi waveform dekoratif tetap `aria-hidden`.

### 3.5 Display configuration, preview, dan test chrome

| Area | Current implementation/state | Batas aman |
|---|---|---|
| Output framing | Resolution native select + safe-area number input | Tetap menyimpan width/height/margin yang sama; min/max dan unit `px` tidak berubah |
| Safety behavior | Native select dengan satu option `pure-black` | Tidak menambah option atau perilaku blackout |
| Static preview | `AudiencePreviewSurface` langsung di dalam grid Settings | **Isi, markup, class, text, gradient, branding, safe area, dan renderer beku** |
| Metadata | Aspek, resolusi, area aman, runtime/test | Chrome di luar preview boleh disusun ulang; nilai dan derivasi tetap |
| Save/Open/Test/Stop | Save → managed Open → Test → conditional Stop | Order dan callback tetap; Stop harus jelas berisiko/interruptive tanpa mengubah publish semantics |
| Connection | `DisplayConnectionStatus`: setup-required, waiting, connected, reconnecting, unavailable, publication-failed | Label/icon/non-color treatment boleh diperjelas; status source dan heartbeat/ack logic beku |
| Test visibility | inactive, publishing, visible, stopping, standby, failed | Harus tetap terpisah dari transport connection; jangan menyimpulkan `visible` hanya dari `connected` |
| Popup blocked | `AudienceDisplayButton` mengisi `popupBlocked`, lalu alert fallback memberi retry | Managed single-window behavior tetap; tidak membuka multiple windows atau mengganti URL |

Pada fixture terkonfigurasi tanpa tab Audience, audit melihat koneksi `Menunggu`,
test `Mempublikasikan tes`, tombol test disabled, dan `Hentikan Tes` tersedia.
Setelah Stop, test kembali `Tidak aktif`. Ini adalah baseline perilaku yang tidak
boleh berubah.

### 3.6 Cross-app composed states

| State family | Current surface/owner | Current visual condition | Slice 6 ownership |
|---|---|---|---|
| Loading | `ProductionLoadingState` dan route-owned loading branches | Card dengan spinner; animation sudah punya keyframe | Kocokan composition + reduced-motion; tidak mengubah async/load branch |
| Empty/setup-required | `ProductionSetupRequired`, empty card/table/page branches | Setup-required shared card; route empties masih beragam | Shared visual grammar dan focused audit; route-specific copy/action tetap |
| Error/read failure | `StatusBanner`, route error branches | Banner Kocokan di dalam shell; action placement tidak selalu konsisten | Spacing/action hierarchy only; retry handler/error sanitization tetap |
| Blocked/invalid reference | Draw/queue/readiness branches; dormant `ProductionWorkspaceBlockedPage` | Status banner atau page composition berbeda-beda | Mounted production surfaces diaudit; dormant page tidak dipasang atau dianggap workflow baru |
| Storage failure | `OperatorPersistenceStatus`, Settings/import/draw/history errors | Primitive masih memakai raw legacy class dan token | Opt-in Kocokan presentation; role/live-region/action tetap |
| Startup recovery | `StartupRecoveryGate` | Redirect + banner/card/persistence status sesuai arbiter | Visual composition only; recommended route dan recovery decision beku |
| Presentation recovery | `PresentationRecoveryDialog` + Draw Run recovery frame | Sudah themed via modal/useUiClass | Consistency/isolation verification; tidak mengubah modal decision atau winner recovery |
| Waiting/unavailable/publication failure | `AudienceConnectionStatus`, Settings panel, Draw header/queue | Shared state punya icon + label; Settings punya badge kedua untuk test visibility | Samakan visual vocabulary tanpa menyatukan dua state source |
| App/route fallback | `AppErrorBoundary`, `RouteErrorPage`, `NotFoundPage` | Fallback produksi di luar shell masih legacy-dark; 404 audit tidak punya marker Kocokan | Explicit production-only theme ownership; sanitized copy/action tetap |
| Toast | Shared `Toast` dan Settings-only `SettingsSaveToast` | Dua treatment; Settings success auto-dismiss, error persistent | Satu visual grammar; timer, urgency, replacement, reduced-motion dan dismiss semantics tetap |
| Tooltip | Native `title` pada header/nav/action | Browser-owned chrome; tidak ada custom tooltip component | Audit label/title/focus only; tidak membuat tooltip engine atau portal baru |
| Diagnostics | DEV-only `RuntimeDiagnosticsPanel` dari production layout | Tampil hanya dengan `?debug=audience-transport` | Chrome production-only boleh konsisten; trace, copy/clear behavior, cap dan DEV gate beku; tidak membuat Log feature |

### 3.7 Current fallback and isolation observations

- `/does-not-exist` saat ini menghasilkan fallback Operator legacy-dark dengan
  `data-interface="operator"` tetapi tanpa `data-ui-theme="kocokan"`.
- `/display` tanpa konteks valid tetap berada di `AudienceDisplayShell`, tidak
  memiliki marker Kocokan, dan menampilkan safe connection state Audience.
- Static Settings preview saat audit memiliki class
  `audience-stage audience-preview-surface settings-display-preview`, berada di
  bawah ancestor Kocokan, tetapi tetap memakai background/color Audience
  baseline. Ini aman hanya selama generic inherited token/font/color-scheme
  tidak dimutasi oleh ancestor.
- Modal dan SidePanel portal berada di `document.body`; foundation Slice 1
  sudah memberi marker theme pada root portal. Slice 6 wajib regression-check,
  bukan memindahkan portal atau mengubah focus/inert behavior.
- Native `title` bukan portal React dan tidak dapat/themed oleh CSS aplikasi.

## 4. Exact implementation scope after approval

### A. Settings composition

1. Opt in production-owned Settings hooks melalui `useUiClass`; gunakan
   `kc-settings-*` untuk page, section nav, card, form grids, asset controls,
   save authority, action rows, connection/test panel, popup fallback, dan
   responsive layout.
2. Buat `src/styles/kocokan/settings.css` sebagai single owner untuk visual
   production Settings. Pertahankan legacy `.settings-*` yang masih dipakai
   prototype atau preview; jangan menghapus selector hanya karena namanya sama.
3. Pertahankan satu primary save action per section. Open Display, Test, dan
   Stop tetap operational secondary/risky actions dengan urutan yang sama.
4. Pertahankan semua controlled value, `settingsEqual`, save/load effect,
   asset validation, object URL cleanup, display configuration save,
   `signalProductionWorkspaceChanged`, audio test, dan publisher callback.
5. Tidak mengubah `AudiencePreviewSurface`; external grid, metadata, and action
   chrome saja yang menjadi scope.

### B. Display Test and connection chrome

1. Tampilkan transport connection dan test visibility sebagai dua baris/state
   group yang jelas dengan label, icon/shape, dan text—bukan warna saja.
2. Cover setup-required, waiting, connected, reconnecting, unavailable,
   publication-failed dan inactive/publishing/visible/stopping/standby/failed.
3. Pertahankan managed display opener, single-window focus/reopen, scoped URL,
   popup blocked callback, retained public state, acknowledgement, dan publisher
   lifetime.
4. DEV diagnostics boleh mendapat Kocokan chrome hanya di subtree production;
   tidak menambah menu Log, telemetry, persistence, atau user-facing diagnostics.

### C. States and fallback surfaces

1. Buat `src/styles/kocokan/states.css` untuk composed loading, setup-required,
   storage/persistence, error, blocked, recovery, unavailable, toast, dan
   production fallback surfaces.
2. Gunakan opt-in class melalui `useUiClass` pada shared state component sehingga
   unthemed prototype tetap legacy.
3. Berikan ownership tema secara eksplisit pada production route error element.
   `/display`, `/dev/*`, prototype, dan Audience error paths harus tetap unthemed
   Kocokan. Jangan menganggap semua `data-interface="operator"` adalah produksi.
4. Global `AppErrorBoundary` hanya boleh opt in Kocokan ketika pathname memang
   production Operator; error pada `/display` dan `/dev/*` mempertahankan
   baseline visual. Classifier ini presentation-only dan harus diuji sebagai
   matrix path, bukan mengubah navigation/error catching.
5. NotFound production boleh menggunakan Kocokan fallback, sedangkan `/dev/*`
   wildcard/fallback tetap legacy. Link recovery, sanitized messages, reload,
   status code handling dan raw-stack suppression tidak berubah.
6. Settings toast dan shared Toast boleh berbagi token/layout grammar tetapi
   tidak digabung menjadi behavior/component baru bila itu mengubah timer,
   replacement, live-region atau dismissal.
7. Loading spinner harus berhenti bergerak pada reduced motion; state tetap
   terlihat melalui icon/label non-motion.

### D. Remaining Operator consistency audit

- Audit mounted uses dari shared loading/setup/status/persistence/toast pada
  Dashboard, Events/import, Draw Setup/queue/run, Pending, History, Settings,
  dan startup recovery.
- Perbaikan hanya boleh berupa shared presentation hook atau spacing/composition
  yang dimiliki `states.css`. Jangan menyusun ulang workflow page milik Slice
  2–5.
- Audit long copy, long local filenames, action wrapping, fixed setup footer,
  1366/1440/1920 viewport, visible focus, disabled contrast, live-region, dan
  document overflow.
- Jika temuan memerlukan perubahan handler, state union, service, route target,
  copy reconciliation, domain, persistence, atau Audience renderer, catat dan
  keluarkan dari Slice 6.

## 5. Files and components involved

### Planned production edits

| File | Planned change |
|---|---|
| `src/pages/operator/ProductionSettingsPage.tsx` | Presentation hooks/composition untuk empat section, Display Test/connection/popup chrome; logic frozen |
| `src/pages/operator/SettingsSaveToast.tsx` | Kocokan class hook dan visual/icon/copy layout only; timer/live-region behavior frozen |
| `src/shared/components/ProductionWorkspaceState.tsx` | Opt-in Kocokan loading/setup-required hooks; default legacy retained |
| `src/shared/components/OperatorPersistenceStatus.tsx` | Opt-in class/state visuals; role/action unchanged |
| `src/app/workspace/StartupRecoveryGate.tsx` | Named composition hooks bila diperlukan; redirect/arbiter unchanged |
| `src/app/errors/AppErrorBoundary.tsx` | Explicit production-path theme marker only; catch/reload/sanitization unchanged |
| `src/app/errors/RouteErrorPage.tsx` | Explicit theme ownership prop/wrapper; content mapping and recovery link unchanged |
| `src/pages/system/NotFoundPage.tsx` | Explicit production vs legacy presentation opt-in; link unchanged |
| `src/app/router.tsx` | Hanya memasang variant fallback visual yang benar pada production/display/dev ownership; route paths/elements/targets unchanged |
| `src/styles/kocokan/settings.css` | Baru; owner tunggal production Settings chrome, tidak termasuk preview internals |
| `src/styles/kocokan/states.css` | Baru; owner tunggal production composed states/fallback/toast chrome |
| `src/styles/app.css` | Import dua stylesheet baru, setelah foundation dan sebelum/bersama page styles sesuai cascade audit |
| `src/styles/operator.css` | Hanya cleanup selector production yang terbukti telah dipindah; retain legacy/prototype/preview selectors |

### Conditional edits only if the audit proves a visual gap

| File | Allowed conditional scope |
|---|---|
| `src/shared/ui/Toast.tsx` | Additional presentation hook/class only; no timer introduced |
| `src/shared/components/StatusBanner.tsx` | Class composition only bila shared state matrix membutuhkan hook baru |
| `src/shared/components/AudienceConnectionStatus.tsx` | Visual metadata/class only; state mapping/labels/source unchanged |
| `src/app/layouts/ProductionOperatorLayout.tsx` | DEV diagnostics wrapper class or explicit tooltip/status hook only; publisher/provider lifetime unchanged |
| `src/application/display-transport/RuntimeDiagnostics.tsx` | Explicit class hook only bila production-scoped CSS tidak cukup; no trace behavior change |
| `src/ui/operator/draw/PresentationRecoveryDialog.tsx` | Composition class only bila browser audit menunjukkan inconsistency; dialog decisions unchanged |

### Verification-only, no planned source edit

- `src/ui/audience/AudiencePreviewSurface.tsx`
- `src/ui/audience/AudiencePresentation.tsx`
- `src/pages/display/AudienceDisplayPage.tsx`
- `src/app/layouts/AudienceDisplayShell.tsx`
- `src/styles/audience.css`
- `src/shared/ui/Modal.tsx`
- `src/shared/ui/SidePanel.tsx`
- `src/pages/operator/ProductionWorkspaceBlockedPage.tsx` (dormant; tetap tidak
  mounted)
- domain/settings, display transport, publisher, recovery arbiter, repositories,
  Dexie/schema/migrations, and managed-display opener implementation.

Jika implementation membutuhkan edit pada verification-only file atau file
domain/application/persistence, hentikan bagian tersebut dan minta keputusan
scope baru.

## 6. Cross-app state ownership

| State/data | Authoritative owner | Slice 6 may change | Slice 6 must not change |
|---|---|---|---|
| Active Event/workspace | `ProductionWorkspaceContext` and repositories | How ready/loading/empty/error is composed visually | State union, load timing, active Event selection, provider mount |
| Settings draft/dirty/save | `ProductionSettingsPage`, `settingsEqual`, `EventSettingsService`, `DisplayConfigurationService` | Layout, labels grouping, authority badge appearance | Dirty predicate, save order, repository writes, signal, failure handling |
| Local assets | Event settings domain + browser Blob/object URL | Asset card/filename presentation | MIME/size contract, Blob, cleanup, storage format |
| Audio test | `ProductionSettingsPage.testAudio` + browser Audio | Ready/disabled/failure feedback visuals | Play trigger, volume, autoplay handling, non-blocking behavior |
| Display connection | `connection-status.ts` subscription/store | Icon/badge/copy grouping | Presence, liveness, state derivation, timeout |
| Display Test visibility | Publisher diagnostics/ack subscription + local view state | Separate visual lane and action hierarchy | Publish payload, retained state, ack interpretation, Stop behavior |
| Managed Display window | `managed-audience-display.ts` via `AudienceDisplayButton` | Button/fallback chrome | Single-window reuse/focus, URL, popup result semantics |
| Startup recovery | startup recovery arbiter + `StartupRecoveryGate` | Banner/card/dialog styling | Redirect target, recovery decision, idempotency, no-reselection guarantee |
| Storage readiness | persistence health + `OperatorPersistenceStatus` | Semantic state visuals | Live block, retry callback, official write rules |
| Route/app errors | React Router + `AppErrorBoundary` | Production-only theme wrapper | Error mapping, sanitization, reload/link action, route behavior |
| Toast lifecycle | Settings toast or shared Toast consumer | Appearance, stacking, focus visibility | success auto-dismiss, error persistence, urgency, replacement, callback |
| Diagnostics | in-memory runtime trace, DEV gate | Production chrome only | Trace content, cap, clear/copy behavior, no persistence/telemetry |

Recovery remains read-only/idempotent. Persisted official records outrank
presentation checkpoints, exact ticket strings remain untouched, dan tidak ada
render/state styling yang boleh memilih ulang pemenang.

## 7. Theme and isolation risks

1. **Nested Audience preview.** `AudiencePreviewSurface` berada di bawah
   `data-ui-theme="kocokan"`; CSS Settings tidak boleh memetakan generic
   `--app-bg`, `--text-*`, font, line-height, `color-scheme`, `button`, `img`,
   atau heading pada ancestor. Style external chrome dengan explicit
   `kc-settings-*` only.
2. **Shared preview selectors.** `.settings-display-preview` dan
   `.audience-preview-surface` di `operator.css` berisi background fallback
   Audience. Jangan memindah, menghapus, atau meng-overwrite selector tersebut
   sebagai cleanup Settings.
3. **Public `/display`.** Tidak boleh mengimpor `settings.css`/`states.css`
   melalui selector global yang cocok ke `AudienceDisplayShell`; verify no
   Kocokan marker, token, font, color, background, safe area, atau stage delta.
4. **Global error boundary.** `AppErrorBoundary` membungkus seluruh router.
   Blanket Kocokan marker akan mengubah fallback `/display` dan `/dev/*`; theme
   ownership harus explicit by production pathname/route.
5. **Route error reuse.** `RouteErrorPage` dipakai production, display, dan
   prototype. Default harus legacy; hanya production route element yang opt in.
6. **Portals.** Modal/SidePanel roots tidak mewarisi CSS ancestry meski React
   context tersedia. Pertahankan marker root yang sudah ada; jangan theme
   `document.body`, memindahkan portal, atau mengubah inert/focus/Escape.
7. **Fixed toast.** `SettingsSaveToast` memakai `position: fixed` tetapi tetap
   DOM-descendant, bukan portal. Styling harus scoped pada class Kocokan, z-index
   harus tidak menutupi modal/header, dan reduced-motion tetap berlaku.
8. **Legacy/prototype compatibility.** Raw `.settings-*`, `.error-page`,
   `.production-workspace-state`, dan `.operator-persistence-status` memiliki
   unthemed consumers/tests. Cleanup hanya setelah `rg` membuktikan ownership;
   default shared component tetap legacy.
9. **Native UI.** Select, file picker, color picker, range, dan `title` memakai
   browser chrome. Jangan memakai blanket `color-scheme: light` pada preview or
   body; scope native control styles ke `kc-settings-*` control.
10. **Dirty Slice 5 overlap.** `operator.css` dan `kocokan/primitives.css`
    sedang disentuh worktree Slice 5. Implementasi Slice 6 tidak boleh dimulai
    atau menyelesaikan conflict sebelum Slice 5 diterima, committed, dan clean.

## 8. Test and regression plan

### 8.1 Current focused baseline

Command audit:

```text
npm.cmd run test -- src/pages/operator/ProductionSettingsDraft.test.ts src/pages/operator/ProductionPresentationSettings.test.ts src/pages/operator/ProductionAudioSettings.test.ts src/pages/operator/ProductionDisplaySettings.test.ts src/pages/operator/SettingsSaveToast.test.tsx src/shared/ui/Toast.test.tsx src/shared/components/OperatorPersistenceStatus.test.tsx src/shared/components/AudienceConnectionStatus.test.tsx src/app/errors/ErrorHandling.test.tsx src/application/workflow/phase10-recovery-acceptance.integration.test.tsx --maxWorkers=2
```

Hasil saat audit: **27 pass / 12 fail** pada 10 file. Dua belas failure adalah
baseline copy/assertion drift yang sudah ada:

- 2 `ErrorHandling.test.tsx` (action masih mengharapkan copy Inggris);
- 1 Phase 10 recovery scenario H (detail masih mengharapkan copy Inggris);
- 2 `OperatorPersistenceStatus.test.tsx` (status masih mengharapkan copy Inggris);
- 3 `ProductionAudioSettings.test.ts` (source contract Inggris);
- 2 `ProductionDisplaySettings.test.ts` (source contract Inggris);
- 2 `ProductionPresentationSettings.test.ts` (source contract Inggris).

Failure tersebut tetap **FAIL** dan tidak boleh “diperbaiki” sebagai bagian
Slice 6 karena itu rekonsiliasi Phase 11/copy di luar scope. Before/after harus
dibandingkan menggunakan relative file + full test name + first failure-message
line. Total yang sama tidak cukup.

### 8.2 Focused tests during implementation

Pertahankan focused command di atas dan tambahkan dedicated tests, misalnya:

- `src/pages/operator/KocokanSettingsAndStates.test.tsx` untuk section
  navigation, visual hooks, save authority, Display action order, connection vs
  test visibility, popup fallback, preview boundary, and responsive semantics;
- path ownership tests untuk production `RouteErrorPage`, `NotFoundPage`, dan
  `AppErrorBoundary` vs `/display` and `/dev/*`;
- loading/setup/persistence matrix dengan themed dan unthemed wrapper;
- Settings toast success/error/reduced-motion/replace/dismiss;
- Audio switch/range/test fallback behavior tanpa benar-benar mengandalkan audio
  device;
- recovery state rendering sambil mempertahankan exact route, record, dan
  idempotency assertions.

Jangan menghapus, skip, melemahkan, atau mengubah existing behavior assertions
untuk membuat total hijau. Source-string assertion yang sudah gagal tidak boleh
diam-diam dinormalisasi; dedicated semantic tests menjadi bukti Slice 6.

### 8.3 Full regression and static gates

Karena Slice 6 menyentuh shared state/fallback di banyak route, full suite wajib:

```text
npm.cmd run test -- --maxWorkers=2 --reporter=json --outputFile=node_modules/.tmp/kocokan-slice6-full.json
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
```

Gunakan accepted Slice 5 full result sebagai immediate baseline, lalu bandingkan
juga dengan redesign register. Laporkan terpisah:

- newly passing tests;
- added tests passing;
- baseline failures identik;
- changed/missing/resolved baseline failures;
- new failures;
- previously passing relevant behavior yang menjadi fail.

Stop dan investigasi setiap changed/new failure. Full suite yang masih memiliki
baseline failure tetap dilaporkan FAIL, bukan PASS. Build warning baseline tidak
boleh disebut error baru tanpa comparison.

### 8.4 Scope/isolation checks

- `git diff --name-only` harus sesuai allowlist implementation.
- `rg` audit memastikan tidak ada perubahan pada `AudiencePresentation`,
  `AudiencePreviewSurface`, `audience.css`, `/display` renderer/protocol,
  domain/persistence/recovery decision, dependencies, atau Phase 11 docs.
- Compare computed style dan screenshot before/after untuk Settings preview,
  `/display`, `/dev/prototypes/settings`, production 404/error, dan portal.
- Verify exact display publish/open/stop callbacks melalui behavior tests; tidak
  hanya source inspection.

## 9. Browser acceptance checklist

### Environment and evidence

- [ ] Record commit, clean worktree, browser/version, viewport, event/fixture,
  section/state, expected/observed, screenshot, dan cleanup.
- [ ] Operator: 1366 × 768, 1440 × 900, 1920 × 1080.
- [ ] Audience: `/display` pada 1920 × 1080 dan two-window Operator/Audience.
- [ ] Focused in-app Chromium check selama development; manual Chrome dan Edge
  tetap gate terpisah.
- [ ] Keyboard-only dan screen-reader/assistive-technology pass dicatat terpisah.

### Settings common

- [ ] Section nav Branding/Presentasi/Audio/Tampilan: active, hover, focus,
  keyboard activation, `aria-current`, long Event name, and no layout jump.
- [ ] Authority states: loading, unsaved, saving, saved, error, setup-required;
  label/icon/shape readable without color.
- [ ] Save disabled when clean/saving; enabled only from existing dirty
  predicate; one save request; success/error feedback remains correct.
- [ ] Fixed setup continuation does not hide Settings action/status at each
  viewport; its journey/lock behavior remains unchanged.
- [ ] No horizontal document overflow; content remains reachable by vertical
  scroll; fixed toast/footer/header do not overlap focus target.

### Branding

- [ ] Empty, selected, replace, remove logo and background states.
- [ ] Long filename/large displayed size wraps safely; file input remains
  keyboard accessible; focus ring visible.
- [ ] Color picker + exact hex text remain paired and usable.
- [ ] Unsaved visual preview uses existing draft values; saving/reload uses
  existing persisted values; no asset/Blob behavior change.

### Presentation

- [ ] All six controls, option order/value, two-column and narrow stacked layout.
- [ ] Reduced-motion checkbox retains real checked/focus/keyboard semantics.
- [ ] Native select open/focus/disabled states readable on Chrome and Edge.
- [ ] No control change alters static or live Audience presentation beyond
  existing saved behavior.

### Audio

- [ ] Audio off/on switch has label + state + switch cue, not color only.
- [ ] Volume disabled/enabled, 0/72/100 values, keyboard range use, and output.
- [ ] No file, valid file, invalid type/size, replace, remove, long filename.
- [ ] Test disabled, ready, playback success, autoplay/permission failure, and
  ended cleanup; failure remains non-blocking.
- [ ] No audio setting is presented as required for draw correctness.

### Display/Test/connection

- [ ] No Display configuration: setup-required, no invalid Open/Test action,
  Save creates the same configuration through the existing service.
- [ ] Transport: setup-required, waiting, connected, reconnecting, unavailable,
  publication-failed; icon/text/state key all differ appropriately.
- [ ] Test: inactive, publishing, visible after applied acknowledgement,
  stopping, standby, failed; never conflated with transport state.
- [ ] Action order remains Save → Open → Test → conditional Stop at desktop;
  wrapping order remains understandable at narrower viewport.
- [ ] Managed Open focuses/reopens one Audience window; repeated action does not
  create uncontrolled duplicate windows.
- [ ] Popup blocked alert explains that window is not open and exposes the same
  safe retry path.
- [ ] Stop returns retained public state to standby through existing publisher;
  no fabricated acknowledgement.
- [ ] DEV diagnostics with `?debug=audience-transport` fits and remains DEV-only;
  no production Log menu appears.

### Cross-app states and portals

- [ ] Shared loading/setup-required/error/storage/blocked/unavailable surfaces
  on representative Dashboard, import, Draw, Pending, History, Settings routes.
- [ ] Startup normal/no-event/storage-failure/recover-session/conflicting-session/
  acknowledgement-required compositions preserve exact navigation and records.
- [ ] Presentation recovery modal: exact winners preserved; no reselection;
  keyboard focus, no Escape dismissal, action order, and focus target unchanged.
- [ ] Modal and SidePanel portal roots remain Kocokan only for production;
  Escape/inert/outside-dismiss/focus-return unchanged where applicable.
- [ ] Shared Toast and Settings toast: status vs alert, success auto-dismiss,
  persistent error, close, replacement, reduced motion, modal stacking.
- [ ] Native `title` text is accurate and not the sole accessible name; no
  custom tooltip/portal introduced.

### Isolation

- [ ] Static Settings preview pixels/computed font/color/background/safe area
  match before Slice 6; only external frame/meta/action chrome may differ.
- [ ] `/display` standby/connecting/disconnected/blackout/reveal/confirmed
  presentation and error/safe state are visually unchanged.
- [ ] `AudiencePresentation` and `AudiencePreviewSurface` source/diff are empty.
- [ ] `/dev/prototypes/settings`, `/dev/prototypes/display`, legacy shared
  components, and prototype errors remain legacy, not Kocokan.
- [ ] Production 404/route/app fallback becomes Kocokan; `/display` and `/dev/*`
  fallback retain baseline ownership.

Automated tests, screenshots, dan in-app Chromium evidence tidak menggantikan
manual Chrome/Edge, assistive technology, two-window, atau owner acceptance.

## 10. Out of scope

- Semua perubahan visual atau behavioral pada `/display`.
- Edit pada `AudiencePresentation`, `AudiencePreviewSurface`, Audience stages,
  safe area/public winner layout, branding/public copy, gradient, animation,
  disconnected-safe, blackout, atau `audience.css`.
- Perubahan actual Audience preview content atau membuat preview baru/forked.
- Publisher/BroadcastChannel/heartbeat/ack/reconnect/protocol/state machine,
  managed-window ownership, display URL/scope, fullscreen behavior.
- Domain/business logic, Web Crypto selection, eligibility, ticket strings,
  winner order, decision commands, Live/Practice, audit/history/export.
- Persistence/schema/migration/repository/service transaction, settings format,
  asset limits, recovery arbitration, idempotency, atau reselection behavior.
- Menambah Settings option, audio cue, display resolution, blackout mode,
  presentation preset, Log/diagnostics feature, telemetry, backup/restore, atau
  dependency/font baru.
- Rekonsiliasi lokalisasi Phase 11, termasuk memperbaiki seluruh stale English
  test assertions/copy debt. Perubahan copy hanya boleh terjadi dengan approval
  terpisah.
- Refactor page composition Slice 2–5, History cleanup, integrated Slice 7,
  packaging/Windows Host, release gates, atau klaim release-ready.
- Mounting `ProductionWorkspaceBlockedPage`, menambah route, atau mengubah route
  availability/navigation contract.
- Mengubah setup journey/footer unlock logic untuk memperbaiki fit Settings.

## 11. Planned execution sequence after approval

1. **Preflight:** owner acceptance Slice 5, focused Slice 5 commit, clean tree,
   accepted baseline/evidence, branch/HEAD/status record.
2. **Baseline capture:** Settings four sections + cross-app state fixtures,
   focused/full JSON results, `/display`/preview/prototype/fallback screenshots
   and computed-style register.
3. **Settings CSS ownership:** add `settings.css`, migrate explicit production
   hooks, browser-check each section before moving on.
4. **Display chrome:** refine connection/test/action/popup composition, then
   verify managed-window and two-source state semantics without code-path change.
5. **States CSS ownership:** migrate shared opt-in state hooks and production
   fallback ownership; verify legacy defaults and portal isolation.
6. **Consistency pass:** representative mounted state matrix only; record any
   functional/copy/Audience findings as out-of-scope instead of fixing them.
7. **Closeout:** focused/full exact failure comparison, typecheck/lint/build,
   diff/scope/isolation audit, browser evidence, Slice 6 report, one focused
   commit, clean tree, then stop for owner review before Slice 7.

## 12. Definition of done and approval gate

- Empat Settings section memakai Kocokan production hooks dan single-owner CSS;
  legacy/prototype and preview selectors tetap terisolasi.
- Display transport dan test visibility tetap dua authoritative signals yang
  terpisah, dengan action order dan managed-window behavior unchanged.
- Loading/empty/error/blocked/recovery/storage/unavailable/toast/fallback
  memiliki grammar visual Operator yang konsisten tanpa mengubah state source,
  handler, action, route, atau official record.
- Production fallback Kocokan tidak bocor ke `/display` atau `/dev/*`.
- Static preview, `/display`, `AudiencePresentation`, dan actual Audience preview
  content tidak berubah secara source maupun visual.
- Tidak ada domain/persistence/protocol/dependency/Phase 11 reconciliation.
- Focused/full regressions dibandingkan per identity/signature; baseline failures
  tetap dilaporkan FAIL; tidak ada changed/new failure atau relevant regression.
- Focused browser evidence selesai; manual Chrome/Edge, assistive technology,
  two-window, dan owner acceptance dilaporkan jujur sebagai gate masing-masing.
- Satu focused Slice 6 implementation commit dan clean worktree setelah approval.

Approval yang diperlukan berikutnya: **owner approval untuk mengeksekusi plan
Slice 6 ini**. Sampai approval diberikan, tidak ada source, test, CSS, TASKS,
rencana induk, evidence, atau implementation commit Slice 6 yang dibuat.
