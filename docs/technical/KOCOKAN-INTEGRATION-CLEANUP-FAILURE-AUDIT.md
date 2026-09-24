# Audit full suite — codex/kocokan-integration-cleanup

Commit: 6fad028. Audit 8 September 2026. Tidak ada source/test/config yang diubah; tidak ada commit.

Full suite: 1.378 test, 1.270 lulus, 108 gagal; 174 file, 30 file gagal. Exit 1.
Klasifikasi menggunakan assertion pertama yang gagal, source test, source produksi relevan, dan routing aktual. Satu test mendapat satu kategori. Kategori lama berarti titik kegagalan menunjukkan kontrak lama; tidak berarti semua assertion setelahnya telah lolos.

87 dari 108 memiliki signature identik (file + full test name + baris error pertama) dengan baseline 142 failure pada commit 523da464. 21 sisanya bukan otomatis regression baru: bisa berupa test tambahan atau signature berubah. Tidak ada checkout/run ulang commit lama.

## Ringkasan dan keputusan

| Kategori | Gagal | Penyebab | Arah tindak lanjut, belum dikerjakan |
|---|---:|---|---|
| Assertion/copy UI lama | 59 | Query label, heading, tombol, region dan format tanggal masih mengacu copy/markup lama; contoh Save changes, Result Locked, SETUP JOURNEY, Saved locally versus UI sekarang. | Perbarui test secara terarah sambil mempertahankan assertion perilaku, state, dan persistence. Belum ada bukti production state salah dari titik gagal ini. |
| Routing atau Settings contract lama | 18 | Sidebar/header berubah; /settings kini Display Designer, /settings/app App Settings; source-string Settings lama dan prototype heading belum mengikuti komposisi sekarang. | Sesuaikan fixture tujuan, komposisi route, selector, dan ownership test. Jangan sekadar mengganti semua string atau menghapus assertion. |
| Audience structure/presentation contract lama | 23 | Copy standby/display-test/disconnected berubah, header countdown berubah, label list dilokalkan, status banner winner lama dihapus. | Test kemungkinan perlu diperbarui. Review dulu kebutuhan status aksesibel dan pembedaan pending/confirmed pada 8 test grid; jangan langsung menghapus pemeriksaan tersebut. State/acknowledgement yang berada setelah query gagal belum terbukti. |
| Persistence/isolation expectation lama | 5 | Empat source-boundary assertion mengasumsikan fase tanpa production DB/repository; satu test schema mengunci versi 6 sedangkan aplikasi versi 7. | Perbarui batas isolation berdasarkan runtime/route aktual dan schema migration. Tetap pertahankan larangan official write dari prototype. Direct import Display Designer perlu dinilai sebagai boundary produksi, bukan dibenarkan hanya karena test tua. |
| Harness recovery: provider belum dipasang | 1 | Scenario H merender StartupRecoveryGate hanya di MemoryRouter; hook intentional redraw kini membutuhkan ProductionWorkspaceProvider. Layout produksi sudah memasangnya. | Perbaiki composition/harness test. Tidak ada bukti perlu mengubah production recovery dari error ini. |
| Kemungkinan regression nyata / kontrak konfigurasi belum diputuskan | 2 | Nilai presentasi yang diberikan berubah saat save dan snapshot: duration/speed direset ke 8/12, sequential direset menjadi all-together. | Review kontrak sebelum memilih test atau production. Normalisasi eksplisit sejak 042b369 dan test domain sekarang mengharapkannya; ini bukan bukti otomatis bahwa perubahan backward compatibility telah disetujui. |
| Total | 108 | Tidak ada duplikasi kategori. | Tidak ada perbaikan dilakukan. |

## Temuan prioritas integritas

- Authoring, draw-authoring-service.test.ts:49: expected duration 5 dan speed 20, actual 8 dan 12. Save mengembalikan ok sebelum assertion gagal.
- Hasil draw, draw-command.test.ts:119: expected duration 12, speed 18, sequential; actual 8, 12, all-together. Command ok. Assertion nomor winner pada baris sesudahnya belum dieksekusi dalam test yang gagal; failure ini tidak membuktikan RNG atau hasil winner salah.
- Resolver dan validator pada src/domain/draws/draw-presentation.types.ts secara eksplisit mengganti ketiga nilai tersebut. Dua test ini juga tercatat pada dokumen AUDIENCE-PRIZE-IMAGE-VERIFICATION.md, sehingga tidak dapat disebut baru muncul pada cleanup.
- Recovery scenario H gagal sebelum pemeriksaan redirect, karena provider hilang. Scenarios A-G dan I lulus (8/9); test StartupRecoveryGate tersendiri 2/2 lulus.
- Delapan test Audience grid (reveal/confirmed 1, 6, 10, 20) sudah melewati pemeriksaan layout/count/tile sebelum gagal mencari role=status. Kebutuhan assistive status harus direview; jangan menyamakan hilangnya status UI dengan perubahan authoritative winner status.
- Audience leading-zero test gagal mencari nama list Inggris '20 ticket results'; WinnerGrid sekarang memakai label Indonesia. Pemeriksaan setiap string tiket dalam loop belum tercapai.
- Audience transport: 10 failure di empat file berhenti pada copy public presentation. Assertion state/ack/liveness berikutnya tetap belum tervalidasi oleh test yang gagal.
- Persistence status component: kedua failure murni expected 'Saved locally'/'Save failed' versus 'Tersimpan secara lokal'/'Gagal menyimpan'; bukan kegagalan IndexedDB.
- Schema receipt: database.verno aktual 7, expected 6. Schema V7 menambahkan redraw_requests. Assertion index berikutnya belum tercapai; jangan menghapus pemeriksaan index.
- db.test.ts source isolation bahkan menangkap StartupRecoveryGate.test.tsx lewat glob. Dua repository boundary test menangkap DisplayDesignerPrototypePage.tsx, yang diekspor sebagai ProductionDisplayDesignerPage dan dipasang pada /settings. Nama file Prototype tidak cukup untuk menetapkan isolation runtime.

## Bukti lulus relevan dari full suite ini

| File | Lulus/gagal |
|---|---:|
| src/application/pending-decisions/redraw-workflow.test.ts | 11/0 |
| src/pages/operator/DrawRunRedrawMode.test.tsx | 3/0 |
| src/pages/operator/ProductionPendingResultsRedrawFlow.test.tsx | 2/0 |
| src/application/pending-decisions/confirmation-workflow.test.ts | 5/0 |
| src/infrastructure/persistence/transactions/draw-persistence-unit-of-work.test.ts | 18/0 |
| src/application/draw/practice-result-storage.test.ts | 10/0 |
| src/application/workflow/live-session-recovery.test.ts | 13/0 |
| src/application/workflow/recovery-contract.test.ts | 10/0 |
| src/application/workflow/startup-recovery-arbiter.test.ts | 9/0 |
| src/application/display-transport/audience-recovery.test.ts | 4/0 |
| src/application/display-transport/phase10-audience-recovery.integration.test.ts | 7/0 |

Bukti ini tidak menyatakan seluruh recovery, Audience state, hasil draw, atau production isolation sudah lolos; beberapa test yang gagal belum mencapai assertion perilakunya. Tidak ada browser/vMix/manual acceptance yang dijalankan.

## Commands

- npm.cmd run test -- --reporter=json --outputFile=C:/Users/User/AppData/Local/Temp/raffle-failure-audit.json — exit 1, 1270 passed / 108 failed.
- npm.cmd run test -- src/application/draw/draw-authoring-service.test.ts src/application/draw/draw-command.test.ts --reporter=verbose — exit 1, 22 passed / 2 failed, diff nilai berhasil dikonfirmasi.
- git branch --show-current, git status --short, git log, git show dan pembacaan source/docs — read-only. Git mengeluarkan warning akses user-level ignore; status tidak menampilkan perubahan.
- Lint/build tidak dijalankan karena ini audit tanpa perubahan aplikasi/TypeScript.

## File test per kategori

### Assertion/copy UI lama — 59

| File test | Gagal |
|---|---:|
| [src/app/errors/ErrorHandling.test.tsx](C:/laragon/www/raffle-os/src/app/errors/ErrorHandling.test.tsx) | 2 |
| [src/app/production-draw-run-route.test.tsx](C:/laragon/www/raffle-os/src/app/production-draw-run-route.test.tsx) | 10 |
| [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx) | 18 |
| [src/pages/operator/LiveDrawPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/LiveDrawPage.test.tsx) | 2 |
| [src/pages/operator/PendingResultsPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/PendingResultsPage.test.tsx) | 3 |
| [src/shared/components/OperatorPersistenceStatus.test.tsx](C:/laragon/www/raffle-os/src/shared/components/OperatorPersistenceStatus.test.tsx) | 2 |
| [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx) | 15 |
| [src/shared/ui/CorePrimitives.test.tsx](C:/laragon/www/raffle-os/src/shared/ui/CorePrimitives.test.tsx) | 1 |
| [src/shared/ui/Modal.test.tsx](C:/laragon/www/raffle-os/src/shared/ui/Modal.test.tsx) | 2 |
| [src/ui/operator/draw/draw-session-queue-view-model.test.ts](C:/laragon/www/raffle-os/src/ui/operator/draw/draw-session-queue-view-model.test.ts) | 4 |

### Audience structure/presentation contract lama — 23

| File test | Gagal |
|---|---:|
| [src/application/display-transport/audience-liveness.test.tsx](C:/laragon/www/raffle-os/src/application/display-transport/audience-liveness.test.tsx) | 3 |
| [src/application/display-transport/audience-render-commit.integration.test.tsx](C:/laragon/www/raffle-os/src/application/display-transport/audience-render-commit.integration.test.tsx) | 2 |
| [src/application/display-transport/phase7-integration.test.tsx](C:/laragon/www/raffle-os/src/application/display-transport/phase7-integration.test.tsx) | 1 |
| [src/application/display-transport/settings-display-integration.test.ts](C:/laragon/www/raffle-os/src/application/display-transport/settings-display-integration.test.ts) | 4 |
| [src/pages/display/AudienceDisplayPage.test.tsx](C:/laragon/www/raffle-os/src/pages/display/AudienceDisplayPage.test.tsx) | 12 |
| [src/ui/audience/RandomNumberRollStage.test.tsx](C:/laragon/www/raffle-os/src/ui/audience/RandomNumberRollStage.test.tsx) | 1 |

### Harness recovery: provider belum dipasang — 1

| File test | Gagal |
|---|---:|
| [src/application/workflow/phase10-recovery-acceptance.integration.test.tsx](C:/laragon/www/raffle-os/src/application/workflow/phase10-recovery-acceptance.integration.test.tsx) | 1 |

### Kemungkinan regression nyata / kontrak konfigurasi belum diputuskan — 2

| File test | Gagal |
|---|---:|
| [src/application/draw/draw-authoring-service.test.ts](C:/laragon/www/raffle-os/src/application/draw/draw-authoring-service.test.ts) | 1 |
| [src/application/draw/draw-command.test.ts](C:/laragon/www/raffle-os/src/application/draw/draw-command.test.ts) | 1 |

### Persistence/isolation expectation lama — 5

| File test | Gagal |
|---|---:|
| [src/infrastructure/persistence/db.test.ts](C:/laragon/www/raffle-os/src/infrastructure/persistence/db.test.ts) | 2 |
| [src/infrastructure/persistence/repositories/command-receipt.repository.test.ts](C:/laragon/www/raffle-os/src/infrastructure/persistence/repositories/command-receipt.repository.test.ts) | 1 |
| [src/infrastructure/persistence/repositories/configuration-repositories.test.ts](C:/laragon/www/raffle-os/src/infrastructure/persistence/repositories/configuration-repositories.test.ts) | 1 |
| [src/infrastructure/persistence/repositories/core-repositories.test.ts](C:/laragon/www/raffle-os/src/infrastructure/persistence/repositories/core-repositories.test.ts) | 1 |

### Routing atau Settings contract lama — 18

| File test | Gagal |
|---|---:|
| [src/app/PhaseTwoHappyPath.test.tsx](C:/laragon/www/raffle-os/src/app/PhaseTwoHappyPath.test.tsx) | 1 |
| [src/app/router.test.tsx](C:/laragon/www/raffle-os/src/app/router.test.tsx) | 8 |
| [src/pages/operator/DrawSetupRoute.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupRoute.test.tsx) | 1 |
| [src/pages/operator/ProductionAudioSettings.test.ts](C:/laragon/www/raffle-os/src/pages/operator/ProductionAudioSettings.test.ts) | 3 |
| [src/pages/operator/ProductionDisplaySettings.test.ts](C:/laragon/www/raffle-os/src/pages/operator/ProductionDisplaySettings.test.ts) | 2 |
| [src/pages/operator/ProductionPresentationSettings.test.ts](C:/laragon/www/raffle-os/src/pages/operator/ProductionPresentationSettings.test.ts) | 2 |
| [src/pages/operator/SettingsPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/SettingsPage.test.tsx) | 1 |

## Inventaris seluruh 108 failure

### F001 — Routing atau Settings contract lama

File: [src/app/PhaseTwoHappyPath.test.tsx](C:/laragon/www/raffle-os/src/app/PhaseTwoHappyPath.test.tsx)

Test: Phase 2 deterministic happy path connects every static screen through browser-history-compatible URLs

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "link" and name "Peserta"

Signature identik baseline lama: True

### F002 — Assertion/copy UI lama

File: [src/app/production-draw-run-route.test.tsx](C:/laragon/www/raffle-os/src/app/production-draw-run-route.test.tsx)

Test: production Draw Run route shell uses production chrome without prototype controls or status bars

Error pertama: TestingLibraryElementError: Unable to find an element with the text: Ruang kerja produksi. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: False

### F003 — Assertion/copy UI lama

File: [src/app/production-draw-run-route.test.tsx](C:/laragon/www/raffle-os/src/app/production-draw-run-route.test.tsx)

Test: production Draw Run route shell keeps an unknown session safe and never starts the command

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Back to Draw Setup"

Signature identik baseline lama: True

### F004 — Assertion/copy UI lama

File: [src/app/production-draw-run-route.test.tsx](C:/laragon/www/raffle-os/src/app/production-draw-run-route.test.tsx)

Test: production Draw Run route shell renders the persisted start gate without invoking the command on route load

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Hold to start official Live draw"

Signature identik baseline lama: True

### F005 — Assertion/copy UI lama

File: [src/app/production-draw-run-route.test.tsx](C:/laragon/www/raffle-os/src/app/production-draw-run-route.test.tsx)

Test: production Draw Run route shell keeps the primary start action and persisted recap visible without the redundant checklist

Error pertama: TestingLibraryElementError: Unable to find an element with the text: Event. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F006 — Assertion/copy UI lama

File: [src/app/production-draw-run-route.test.tsx](C:/laragon/www/raffle-os/src/app/production-draw-run-route.test.tsx)

Test: production Draw Run route shell keeps all-ready stage focused on centered execution without a redundant checklist

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Hold to start official Live draw"

Signature identik baseline lama: True

### F007 — Assertion/copy UI lama

File: [src/app/production-draw-run-route.test.tsx](C:/laragon/www/raffle-os/src/app/production-draw-run-route.test.tsx)

Test: production Draw Run route shell places the Practice safety notice inside the Start Draw stage

Error pertama: TestingLibraryElementError: Unable to find an element with the text: PRACTICE MODE. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F008 — Assertion/copy UI lama

File: [src/app/production-draw-run-route.test.tsx](C:/laragon/www/raffle-os/src/app/production-draw-run-route.test.tsx)

Test: production Draw Run route shell surfaces a start failure instead of silently returning to Ready

Error pertama: Error: Unable to find role="button" and name "Hold to start official Live draw"

Signature identik baseline lama: True

### F009 — Assertion/copy UI lama

File: [src/app/production-draw-run-route.test.tsx](C:/laragon/www/raffle-os/src/app/production-draw-run-route.test.tsx)

Test: production Draw Run route shell hydrates a valid Practice projection on initial mount and does not show start controls

Error pertama: Error: Unable to find role="heading" and name "Result Locked"

Signature identik baseline lama: True

### F010 — Assertion/copy UI lama

File: [src/app/production-draw-run-route.test.tsx](C:/laragon/www/raffle-os/src/app/production-draw-run-route.test.tsx)

Test: production Draw Run route shell uses the same projection after remount without reselection

Error pertama: Error: Unable to find role="heading" and name "Result Locked"

Signature identik baseline lama: True

### F011 — Assertion/copy UI lama

File: [src/app/production-draw-run-route.test.tsx](C:/laragon/www/raffle-os/src/app/production-draw-run-route.test.tsx)

Test: production Draw Run route shell surfaces a corrupt Practice projection as a typed bootstrap error without invoking selection

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name "Presentation recovery"

Signature identik baseline lama: True

### F012 — Routing atau Settings contract lama

File: [src/app/router.test.tsx](C:/laragon/www/raffle-os/src/app/router.test.tsx)

Test: application routes exposes only production destinations in the production sidebar

Error pertama: Error: expect(element).toHaveTextContent()

Signature identik baseline lama: True

### F013 — Routing atau Settings contract lama

File: [src/app/router.test.tsx](C:/laragon/www/raffle-os/src/app/router.test.tsx)

Test: application routes keeps production route /draw/pending honest

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name "Hasil Pending"

Signature identik baseline lama: True

### F014 — Routing atau Settings contract lama

File: [src/app/router.test.tsx](C:/laragon/www/raffle-os/src/app/router.test.tsx)

Test: application routes keeps production route /settings honest

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name "Event required"

Signature identik baseline lama: True

### F015 — Routing atau Settings contract lama

File: [src/app/router.test.tsx](C:/laragon/www/raffle-os/src/app/router.test.tsx)

Test: application routes does not expose the prototype pending route as production navigation

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name "Not Found"

Signature identik baseline lama: True

### F016 — Routing atau Settings contract lama

File: [src/app/router.test.tsx](C:/laragon/www/raffle-os/src/app/router.test.tsx)

Test: application routes keeps the current Event header control safe when no Event is active

Error pertama: Error: Unable to find role="button" and name `/Current Event/i`

Signature identik baseline lama: True

### F017 — Routing atau Settings contract lama

File: [src/app/router.test.tsx](C:/laragon/www/raffle-os/src/app/router.test.tsx)

Test: application routes closes the Current Event menu on outside pointer interaction and reopens cleanly

Error pertama: Error: Unable to find role="button" and name `/Current Event/i`

Signature identik baseline lama: True

### F018 — Routing atau Settings contract lama

File: [src/app/router.test.tsx](C:/laragon/www/raffle-os/src/app/router.test.tsx)

Test: application routes links missing production Audience configuration to Settings

Error pertama: Error: Unable to find role="link" and name "Audience: Setup required"

Signature identik baseline lama: True

### F019 — Routing atau Settings contract lama

File: [src/app/router.test.tsx](C:/laragon/www/raffle-os/src/app/router.test.tsx)

Test: application routes keeps unknown routes recoverable through the production dashboard

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "link" and name "Return to Dashboard"

Signature identik baseline lama: True

### F020 — Assertion/copy UI lama

File: [src/app/errors/ErrorHandling.test.tsx](C:/laragon/www/raffle-os/src/app/errors/ErrorHandling.test.tsx)

Test: AppErrorBoundary provides a reload action

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Reload application"

Signature identik baseline lama: True

### F021 — Assertion/copy UI lama

File: [src/app/errors/ErrorHandling.test.tsx](C:/laragon/www/raffle-os/src/app/errors/ErrorHandling.test.tsx)

Test: RouteErrorPage renders a generic fallback for unknown errors without a raw stack

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "link" and name "Return to Dashboard"

Signature identik baseline lama: True

### F022 — Audience structure/presentation contract lama

File: [src/application/display-transport/audience-liveness.test.tsx](C:/laragon/www/raffle-os/src/application/display-transport/audience-liveness.test.tsx)

Test: Audience liveness watchdog keeps DISPLAY TEST and standby rendered while the real publisher heartbeat continues

Error pertama: TestingLibraryElementError: Unable to find an element with the text: /DISPLAY TEST/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F023 — Audience structure/presentation contract lama

File: [src/application/display-transport/audience-liveness.test.tsx](C:/laragon/www/raffle-os/src/application/display-transport/audience-liveness.test.tsx)

Test: Audience liveness watchdog keeps the public presentation stable for a 60-second heartbeat interval

Error pertama: TestingLibraryElementError: Unable to find an element with the text: /DISPLAY TEST/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F024 — Audience structure/presentation contract lama

File: [src/application/display-transport/audience-liveness.test.tsx](C:/laragon/www/raffle-os/src/application/display-transport/audience-liveness.test.tsx)

Test: Audience liveness watchdog shows interrupted only after publisher activity expires, then restores the retained snapshot

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name "Display connection interrupted"

Signature identik baseline lama: True

### F025 — Audience structure/presentation contract lama

File: [src/application/display-transport/audience-render-commit.integration.test.tsx](C:/laragon/www/raffle-os/src/application/display-transport/audience-render-commit.integration.test.tsx)

Test: Phase 8 Audience render-source acknowledgement boundary restores retained standby for a late Audience without a sequence or heartbeat storm

Error pertama: TestingLibraryElementError: Unable to find an element with the text: Display ready. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F026 — Audience structure/presentation contract lama

File: [src/application/display-transport/audience-render-commit.integration.test.tsx](C:/laragon/www/raffle-os/src/application/display-transport/audience-render-commit.integration.test.tsx)

Test: Phase 8 Audience render-source acknowledgement boundary acknowledges standby and display-test only after the real route selects each presentation

Error pertama: Error: Unable to find an element with the text: Display ready. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F027 — Audience structure/presentation contract lama

File: [src/application/display-transport/phase7-integration.test.tsx](C:/laragon/www/raffle-os/src/application/display-transport/phase7-integration.test.tsx)

Test: Phase 7 integration and automated acceptance runs the authoritative Operator → public projection → protocol → Audience → DOM flow

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name "Draw will begin shortly"

Signature identik baseline lama: True

### F028 — Audience structure/presentation contract lama

File: [src/application/display-transport/settings-display-integration.test.ts](C:/laragon/www/raffle-os/src/application/display-transport/settings-display-integration.test.ts)

Test: production Settings display-test integration moves the real Audience controller from connecting to display test after acknowledgement

Error pertama: TestingLibraryElementError: Unable to find an element with the text: /DISPLAY TEST/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F029 — Audience structure/presentation contract lama

File: [src/application/display-transport/settings-display-integration.test.ts](C:/laragon/www/raffle-os/src/application/display-transport/settings-display-integration.test.ts)

Test: production Settings display-test integration restores the same public test for late joiners, refreshes, and multiple windows

Error pertama: TestingLibraryElementError: Unable to find an element with the text: /DISPLAY TEST/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F030 — Audience structure/presentation contract lama

File: [src/application/display-transport/settings-display-integration.test.ts](C:/laragon/www/raffle-os/src/application/display-transport/settings-display-integration.test.ts)

Test: production Settings display-test integration keeps one publisher alive across five realtime start/stop cycles

Error pertama: TestingLibraryElementError: Unable to find an element with the text: Display ready. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F031 — Audience structure/presentation contract lama

File: [src/application/display-transport/settings-display-integration.test.ts](C:/laragon/www/raffle-os/src/application/display-transport/settings-display-integration.test.ts)

Test: production Settings display-test integration delivers the production snapshot through the BroadcastChannel adapter

Error pertama: TestingLibraryElementError: Unable to find an element with the text: Display ready. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F032 — Kemungkinan regression nyata / kontrak konfigurasi belum diputuskan

File: [src/application/draw/draw-authoring-service.test.ts](C:/laragon/www/raffle-os/src/application/draw/draw-authoring-service.test.ts)

Test: draw authoring service persists a valid per-draw Random Number Roll configuration

Error pertama: AssertionError: expected { …(5) } to deeply equal { …(5) }

Signature identik baseline lama: False

### F033 — Kemungkinan regression nyata / kontrak konfigurasi belum diputuskan

File: [src/application/draw/draw-command.test.ts](C:/laragon/www/raffle-os/src/application/draw/draw-command.test.ts)

Test: executeDraw captures per-draw presentation configuration without changing selection semantics

Error pertama: AssertionError: expected { …(5) } to deeply equal { …(5) }

Signature identik baseline lama: False

### F034 — Harness recovery: provider belum dipasang

File: [src/application/workflow/phase10-recovery-acceptance.integration.test.tsx](C:/laragon/www/raffle-os/src/application/workflow/phase10-recovery-acceptance.integration.test.tsx)

Test: Phase 10.7 integrated recovery acceptance scenarios A-I H: unresolved official work redirects the Operator away from conflicting fresh setup

Error pertama: Error: useIntentionalRedrawTransition must be used inside ProductionWorkspaceProvider.

Signature identik baseline lama: False

### F035 — Persistence/isolation expectation lama

File: [src/infrastructure/persistence/db.test.ts](C:/laragon/www/raffle-os/src/infrastructure/persistence/db.test.ts)

Test: prototype and application persistence isolation keeps application entrypoints, routes, pages, UI, and prototype disconnected

Error pertama: AssertionError: ../../app/workspace/StartupRecoveryGate.test.tsx: expected 'import { render, screen } from \'@tes…' not to match /(?:from\s+|import\s…/persistence|dexie)

Signature identik baseline lama: False

### F036 — Persistence/isolation expectation lama

File: [src/infrastructure/persistence/db.test.ts](C:/laragon/www/raffle-os/src/infrastructure/persistence/db.test.ts)

Test: prototype and application persistence isolation has no production database instance or automatic application-render open path

Error pertama: AssertionError: expected true to be false // Object.is equality

Signature identik baseline lama: False

### F037 — Audience structure/presentation contract lama

File: [src/pages/display/AudienceDisplayPage.test.tsx](C:/laragon/www/raffle-os/src/pages/display/AudienceDisplayPage.test.tsx)

Test: Audience Display static states renders a static accessible countdown numeral

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name "Bersiap"

Signature identik baseline lama: True

### F038 — Audience structure/presentation contract lama

File: [src/pages/display/AudienceDisplayPage.test.tsx](C:/laragon/www/raffle-os/src/pages/display/AudienceDisplayPage.test.tsx)

Test: Audience Display static states renders a stable deterministic rolling arrangement with leading zeroes

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "list" and name "Presentational ticket stream"

Signature identik baseline lama: True

### F039 — Audience structure/presentation contract lama

File: [src/pages/display/AudienceDisplayPage.test.tsx](C:/laragon/www/raffle-os/src/pages/display/AudienceDisplayPage.test.tsx)

Test: Audience winner grids renders reveal count 1 as the exact hero layout

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "status"

Signature identik baseline lama: False

### F040 — Audience structure/presentation contract lama

File: [src/pages/display/AudienceDisplayPage.test.tsx](C:/laragon/www/raffle-os/src/pages/display/AudienceDisplayPage.test.tsx)

Test: Audience winner grids renders reveal count 6 as the exact 3x2 layout

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "status"

Signature identik baseline lama: False

### F041 — Audience structure/presentation contract lama

File: [src/pages/display/AudienceDisplayPage.test.tsx](C:/laragon/www/raffle-os/src/pages/display/AudienceDisplayPage.test.tsx)

Test: Audience winner grids renders reveal count 10 as the exact 5x2 layout

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "status"

Signature identik baseline lama: False

### F042 — Audience structure/presentation contract lama

File: [src/pages/display/AudienceDisplayPage.test.tsx](C:/laragon/www/raffle-os/src/pages/display/AudienceDisplayPage.test.tsx)

Test: Audience winner grids renders reveal count 20 as the exact 5x4 layout

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "status"

Signature identik baseline lama: False

### F043 — Audience structure/presentation contract lama

File: [src/pages/display/AudienceDisplayPage.test.tsx](C:/laragon/www/raffle-os/src/pages/display/AudienceDisplayPage.test.tsx)

Test: Audience winner grids renders confirmed count 1 with the same exact hero layout

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "status"

Signature identik baseline lama: False

### F044 — Audience structure/presentation contract lama

File: [src/pages/display/AudienceDisplayPage.test.tsx](C:/laragon/www/raffle-os/src/pages/display/AudienceDisplayPage.test.tsx)

Test: Audience winner grids renders confirmed count 6 with the same exact 3x2 layout

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "status"

Signature identik baseline lama: False

### F045 — Audience structure/presentation contract lama

File: [src/pages/display/AudienceDisplayPage.test.tsx](C:/laragon/www/raffle-os/src/pages/display/AudienceDisplayPage.test.tsx)

Test: Audience winner grids renders confirmed count 10 with the same exact 5x2 layout

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "status"

Signature identik baseline lama: False

### F046 — Audience structure/presentation contract lama

File: [src/pages/display/AudienceDisplayPage.test.tsx](C:/laragon/www/raffle-os/src/pages/display/AudienceDisplayPage.test.tsx)

Test: Audience winner grids renders confirmed count 20 with the same exact 5x4 layout

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "status"

Signature identik baseline lama: False

### F047 — Audience structure/presentation contract lama

File: [src/pages/display/AudienceDisplayPage.test.tsx](C:/laragon/www/raffle-os/src/pages/display/AudienceDisplayPage.test.tsx)

Test: Audience winner grids preserves exact leading-zero strings throughout winner layouts

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "list" and name "20 ticket results"

Signature identik baseline lama: True

### F048 — Audience structure/presentation contract lama

File: [src/pages/display/AudienceDisplayPage.test.tsx](C:/laragon/www/raffle-os/src/pages/display/AudienceDisplayPage.test.tsx)

Test: Audience safety and privacy renders blackout as a non-interactive public surface with an assistive status

Error pertama: Error: expect(element).toHaveAccessibleName()

Signature identik baseline lama: True

### F049 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring keeps Event read-only and follows the selected persisted category prize

Error pertama: TestingLibraryElementError: Unable to find a label with the text of: Prize

Signature identik baseline lama: True

### F050 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring shows prize-first option identities and persisted draw status groups

Error pertama: Error: Unable to find role="option" and name "K-Ion Nano Premium 5 · Door Prize · COMPLETED"

Signature identik baseline lama: True

### F051 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring shows quick counts with pressed semantics and updates the same winner field

Error pertama: TestingLibraryElementError: Unable to find a label with the text of: Custom winner count

Signature identik baseline lama: True

### F052 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring saves requestedWinners through the existing authoring service

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Save changes"

Signature identik baseline lama: True

### F053 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring keeps Save changes disabled while pristine and re-enables it for each editable change

Error pertama: Error: Unable to find role="button" and name "Save changes"

Signature identik baseline lama: True

### F054 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring preserves the custom 1–100 input and validation errors

Error pertama: Error: Unable to find a label with the text of: Custom winner count

Signature identik baseline lama: True

### F055 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring shows authoritative capacity diagnostics and readiness

Error pertama: Error: Unable to find role="heading" and name "Eligible pool summary"

Signature identik baseline lama: True

### F056 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring defaults to Instant Reveal and keeps the pool and winner quantity workflow intact

Error pertama: Error: Unable to find role="heading" and name "Reveal style"

Signature identik baseline lama: True

### F057 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring selects Random Number Roll and maps speed and reveal presets without timed controls

Error pertama: Error: Unable to find role="heading" and name "Reveal style"

Signature identik baseline lama: False

### F058 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring persists the shared presentation configuration in Practice and does not alter winner quantity

Error pertama: Error: Unable to find role="heading" and name "Reveal style"

Signature identik baseline lama: True

### F059 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring does not expose rolling stop or duration controls

Error pertama: Error: Unable to find role="heading" and name "Reveal style"

Signature identik baseline lama: False

### F060 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring saves and reloads manual-only rolling with speed and reveal settings intact

Error pertama: Error: Unable to find role="radio" and name `/Random Number Roll/`

Signature identik baseline lama: False

### F061 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring restores the selected presentation UI after Save changes and reload

Error pertama: Error: Unable to find role="heading" and name "Reveal style"

Signature identik baseline lama: True

### F062 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring keeps Instant Reveal unaffected while preserving non-duration draft values

Error pertama: Error: Unable to find role="heading" and name "Reveal style"

Signature identik baseline lama: False

### F063 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring refreshes readiness after save and preserves Live conflict blocking

Error pertama: Error: Unable to find a label with the text of: Custom winner count

Signature identik baseline lama: True

### F064 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring keeps started sessions immutable and preserves Live distinction

Error pertama: Error: Unable to find role="heading" and name "This DrawSession is not editable"

Signature identik baseline lama: True

### F065 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring keeps all presentation controls aligned with the active-session lock

Error pertama: Error: Unable to find role="dialog" and name "Winner review pending"

Signature identik baseline lama: True

### F066 — Assertion/copy UI lama

File: [src/pages/operator/DrawSetupPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupPage.test.tsx)

Test: Draw Setup persisted authoring allows a completed previous session to prepare the next presentation configuration

Error pertama: Error: Unable to find role="heading" and name "Reveal style"

Signature identik baseline lama: True

### F067 — Routing atau Settings contract lama

File: [src/pages/operator/DrawSetupRoute.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/DrawSetupRoute.test.tsx)

Test: Draw Setup route isolation uses the production composition when no prototype scenario is supplied

Error pertama: TestingLibraryElementError: Unable to find an element with the text: /Loading persisted Event/i. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F068 — Assertion/copy UI lama

File: [src/pages/operator/LiveDrawPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/LiveDrawPage.test.tsx)

Test: Live Draw static prototype opens confirmation and returns focus when cancelled

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Batal"

Signature identik baseline lama: True

### F069 — Assertion/copy UI lama

File: [src/pages/operator/LiveDrawPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/LiveDrawPage.test.tsx)

Test: Live Draw static prototype renders exact leading-zero tickets without declaring a winner

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "link" and name "Tinjau Hasil Tertunda"

Signature identik baseline lama: True

### F070 — Assertion/copy UI lama

File: [src/pages/operator/PendingResultsPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/PendingResultsPage.test.tsx)

Test: Hasil Pending static prototype renders the pending summary and exact leading-zero tickets

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name "Hasil Pending"

Signature identik baseline lama: True

### F071 — Assertion/copy UI lama

File: [src/pages/operator/PendingResultsPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/PendingResultsPage.test.tsx)

Test: Hasil Pending static prototype renders partial and confirmed fixture states directly

Error pertama: TestingLibraryElementError: Unable to find an element with the text: Tertunda. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F072 — Assertion/copy UI lama

File: [src/pages/operator/PendingResultsPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/PendingResultsPage.test.tsx)

Test: Hasil Pending static prototype reconciles every partial row status with the exact summary counts

Error pertama: TestingLibraryElementError: Unable to find an element with the text: Tertunda. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F073 — Routing atau Settings contract lama

File: [src/pages/operator/ProductionAudioSettings.test.ts](C:/laragon/www/raffle-os/src/pages/operator/ProductionAudioSettings.test.ts)

Test: production Audio settings UI contract keeps the authoritative audio contract in a compact two-column layout

Error pertama: AssertionError: expected 'import { useCallback, useEffect, useM…' to contain 'Audio cues'

Signature identik baseline lama: True

### F074 — Routing atau Settings contract lama

File: [src/pages/operator/ProductionAudioSettings.test.ts](C:/laragon/www/raffle-os/src/pages/operator/ProductionAudioSettings.test.ts)

Test: production Audio settings UI contract keeps empty, selected, replace, and remove states inside the audio card

Error pertama: AssertionError: expected 'import { useCallback, useEffect, useM…' to contain 'No local audio asset selected.'

Signature identik baseline lama: True

### F075 — Routing atau Settings contract lama

File: [src/pages/operator/ProductionAudioSettings.test.ts](C:/laragon/www/raffle-os/src/pages/operator/ProductionAudioSettings.test.ts)

Test: production Audio settings UI contract explains unavailable playback and preserves the shared save toast path

Error pertama: AssertionError: expected 'import { useCallback, useEffect, useM…' to contain 'Enable audio to test the selected rev…'

Signature identik baseline lama: True

### F076 — Routing atau Settings contract lama

File: [src/pages/operator/ProductionDisplaySettings.test.ts](C:/laragon/www/raffle-os/src/pages/operator/ProductionDisplaySettings.test.ts)

Test: production Display settings UI contract keeps the persisted controls in grouped output and safety sections

Error pertama: AssertionError: expected 'import { useCallback, useEffect, useM…' to contain 'Output framing'

Signature identik baseline lama: True

### F077 — Routing atau Settings contract lama

File: [src/pages/operator/ProductionDisplaySettings.test.ts](C:/laragon/www/raffle-os/src/pages/operator/ProductionDisplaySettings.test.ts)

Test: production Display settings UI contract preserves the live preview, metadata strip, and desktop action order

Error pertama: AssertionError: expected 'import { useCallback, useEffect, useM…' to contain 'Aspect'

Signature identik baseline lama: True

### F078 — Routing atau Settings contract lama

File: [src/pages/operator/ProductionPresentationSettings.test.ts](C:/laragon/www/raffle-os/src/pages/operator/ProductionPresentationSettings.test.ts)

Test: production Presentation settings UI contract contains the six persisted Presentation controls in the approved two-column order

Error pertama: AssertionError: expected 'import { useCallback, useEffect, useM…' to contain 'Countdown duration'

Signature identik baseline lama: True

### F079 — Routing atau Settings contract lama

File: [src/pages/operator/ProductionPresentationSettings.test.ts](C:/laragon/www/raffle-os/src/pages/operator/ProductionPresentationSettings.test.ts)

Test: production Presentation settings UI contract keeps the Presentation save toast detail and Display ownership explicit

Error pertama: AssertionError: expected 'import { useCallback, useEffect, useM…' to contain '`${details[0]} settings saved`'

Signature identik baseline lama: True

### F080 — Routing atau Settings contract lama

File: [src/pages/operator/SettingsPage.test.tsx](C:/laragon/www/raffle-os/src/pages/operator/SettingsPage.test.tsx)

Test: Settings static prototype renders /dev/prototypes/settings?section=presentation directly as the Presentasi section

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name "Presentasi"

Signature identik baseline lama: True

### F081 — Assertion/copy UI lama

File: [src/shared/components/OperatorPersistenceStatus.test.tsx](C:/laragon/www/raffle-os/src/shared/components/OperatorPersistenceStatus.test.tsx)

Test: OperatorPersistenceStatus describes a saved local state

Error pertama: Error: expect(element).toHaveTextContent()

Signature identik baseline lama: True

### F082 — Assertion/copy UI lama

File: [src/shared/components/OperatorPersistenceStatus.test.tsx](C:/laragon/www/raffle-os/src/shared/components/OperatorPersistenceStatus.test.tsx)

Test: OperatorPersistenceStatus exposes a retry action for failed persistence

Error pertama: Error: expect(element).toHaveTextContent()

Signature identik baseline lama: True

### F083 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation reports the five-stage production setup journey in order

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "region" and name "Event setup"

Signature identik baseline lama: True

### F084 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation uses the route as the current setup stage for /events

Error pertama: TestingLibraryElementError: Unable to find an element with the text: /SETUP JOURNEY · STEP 1 OF 5/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F085 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation uses the route as the current setup stage for /prize-categories

Error pertama: TestingLibraryElementError: Unable to find an element with the text: /SETUP JOURNEY · STEP 2 OF 5/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F086 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation uses the route as the current setup stage for /participants

Error pertama: TestingLibraryElementError: Unable to find an element with the text: /SETUP JOURNEY · STEP 3 OF 5/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F087 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation uses the route as the current setup stage for /settings

Error pertama: TestingLibraryElementError: Unable to find an element with the text: /SETUP JOURNEY · STEP 4 OF 5/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F088 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation uses the route as the current setup stage for /draw/setup

Error pertama: TestingLibraryElementError: Unable to find an element with the text: /SETUP JOURNEY · STEP 5 OF 5/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F089 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation keeps Next disabled without an authoritative Current Event

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name `/Next: Prize/i`

Signature identik baseline lama: True

### F090 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation keeps Participants locked while Prize has no persisted category

Error pertama: TestingLibraryElementError: Unable to find an element with the text: /PRIZE IN PROGRESS/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F091 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation uses persisted readiness to enable the next stage without a visit flag

Error pertama: TestingLibraryElementError: Unable to find an element with the text: /PRIZE COMPLETE/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F092 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation does not admit Participants merely because Prize is complete

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name `/Next: Participants/i`

Signature identik baseline lama: True

### F093 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation uses Previous for every stage after Event

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Previous"

Signature identik baseline lama: True

### F094 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation enables Next and shows the Current Event identity as workspace state becomes ready

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name `/Next: Prize/i`

Signature identik baseline lama: True

### F095 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation keeps Step 5 visible while authoritative Draw Setup is incomplete

Error pertama: TestingLibraryElementError: Unable to find an element with the text: /SETUP JOURNEY/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F096 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation shows the recovery journey again when authoritative setup becomes incomplete

Error pertama: TestingLibraryElementError: Unable to find an element with the text: /SETUP JOURNEY/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F097 — Assertion/copy UI lama

File: [src/shared/components/ProductionSetupContinuation.test.tsx](C:/laragon/www/raffle-os/src/shared/components/ProductionSetupContinuation.test.tsx)

Test: ProductionSetupContinuation does not carry completion suppression between Events

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "region" and name "Draw Setup setup"

Signature identik baseline lama: True

### F098 — Assertion/copy UI lama

File: [src/shared/ui/CorePrimitives.test.tsx](C:/laragon/www/raffle-os/src/shared/ui/CorePrimitives.test.tsx)

Test: core UI primitives renders typed badge and card variants

Error pertama: TestingLibraryElementError: Unable to find an element with the text: Dikonfirmasi. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F099 — Assertion/copy UI lama

File: [src/shared/ui/Modal.test.tsx](C:/laragon/www/raffle-os/src/shared/ui/Modal.test.tsx)

Test: Modal and ConfirmationDialog has an accessible name and places initial focus on cancel

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Batal"

Signature identik baseline lama: True

### F100 — Assertion/copy UI lama

File: [src/shared/ui/Modal.test.tsx](C:/laragon/www/raffle-os/src/shared/ui/Modal.test.tsx)

Test: Modal and ConfirmationDialog closes on cancel and returns focus without confirming

Error pertama: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Batal"

Signature identik baseline lama: True

### F101 — Audience structure/presentation contract lama

File: [src/ui/audience/RandomNumberRollStage.test.tsx](C:/laragon/www/raffle-os/src/ui/audience/RandomNumberRollStage.test.tsx)

Test: Random Number Roll presentation continuity shows stable exact draw identity across rolling and reveal without remounting the stage

Error pertama: TestingLibraryElementError: Unable to find an element with the text: CURRENT DRAW. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Signature identik baseline lama: True

### F102 — Persistence/isolation expectation lama

File: [src/infrastructure/persistence/repositories/command-receipt.repository.test.ts](C:/laragon/www/raffle-os/src/infrastructure/persistence/repositories/command-receipt.repository.test.ts)

Test: schema v3 command receipts creates the additive receipt store with the exact idempotency indexes

Error pertama: AssertionError: expected 7 to be 6 // Object.is equality

Signature identik baseline lama: False

### F103 — Persistence/isolation expectation lama

File: [src/infrastructure/persistence/repositories/configuration-repositories.test.ts](C:/laragon/www/raffle-os/src/infrastructure/persistence/repositories/configuration-repositories.test.ts)

Test: Slice 4 source and scope boundaries keeps pages, routes, UI, and prototype disconnected

Error pertama: AssertionError: ../../../pages/operator/DisplayDesignerPrototypePage.tsx: expected 'import { memo, useCallback, useEffect…' not to match /(?:from\s+|import\s*\()['…/repositories

Signature identik baseline lama: False

### F104 — Persistence/isolation expectation lama

File: [src/infrastructure/persistence/repositories/core-repositories.test.ts](C:/laragon/www/raffle-os/src/infrastructure/persistence/repositories/core-repositories.test.ts)

Test: Slice 3 source boundaries keeps pages, routes, UI, and prototype disconnected from repositories

Error pertama: AssertionError: ../../../pages/operator/DisplayDesignerPrototypePage.tsx: expected 'import { memo, useCallback, useEffect…' not to match /(?:from\s+|import\s*\()['…/repositories

Signature identik baseline lama: False

### F105 — Assertion/copy UI lama

File: [src/ui/operator/draw/draw-session-queue-view-model.test.ts](C:/laragon/www/raffle-os/src/ui/operator/draw/draw-session-queue-view-model.test.ts)

Test: production DrawSession queue view model formats timestamps without exposing ISO values

Error pertama: AssertionError: expected '6 Agu 2026, 23.42' to match /^6 Aug 2026 · \d{2}:42$/

Signature identik baseline lama: True

### F106 — Assertion/copy UI lama

File: [src/ui/operator/draw/draw-session-queue-view-model.test.ts](C:/laragon/www/raffle-os/src/ui/operator/draw/draw-session-queue-view-model.test.ts)

Test: production DrawSession queue view model uses explicit mode and lifecycle labels

Error pertama: AssertionError: expected { modeLabel: 'Latihan', …(10) } to match object { modeLabel: 'Latihan', …(3) }

Signature identik baseline lama: True

### F107 — Assertion/copy UI lama

File: [src/ui/operator/draw/draw-session-queue-view-model.test.ts](C:/laragon/www/raffle-os/src/ui/operator/draw/draw-session-queue-view-model.test.ts)

Test: production DrawSession queue view model formats drawing recovery without raw checkpoint values

Error pertama: AssertionError: expected { modeLabel: 'Live', …(10) } to match object { …(3) }

Signature identik baseline lama: True

### F108 — Assertion/copy UI lama

File: [src/ui/operator/draw/draw-session-queue-view-model.test.ts](C:/laragon/www/raffle-os/src/ui/operator/draw/draw-session-queue-view-model.test.ts)

Test: production DrawSession queue view model keeps relationship failures visible and non-actionable

Error pertama: AssertionError: expected { modeLabel: 'Live', …(10) } to match object { …(2) }

Signature identik baseline lama: True

