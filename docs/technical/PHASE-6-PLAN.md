# Phase 6 — Draw Setup and Live Workflow Implementation Plan

## 1. Executive summary

Phase 6 mengubah alur operator setelah Draw Setup menjadi workflow produksi yang persisten dan dapat dipulihkan:

Draw Setup → production Live/Practice start gate → secure result locked → countdown → rolling → reveal → read-only Pending handoff

Phase ini tidak mengubah algoritma secure selection Phase 5. Tanggung jawabnya adalah authoring konfigurasi yang tersimpan, membangun handoff route yang tervalidasi, menjalankan command Phase 5 tepat sekali pada batas yang disetujui, memisahkan hasil dari presentasi, dan memulihkan presentasi tanpa reselection.

Implementasi dilarang sebelum pemilik proyek menyetujui dokumen ini.

## 2. Audited repository baseline

Audit dilakukan dari C:\laragon\www\raffle-os pada 2026-08-05.

| Pemeriksaan | Hasil |
|---|---|
| git status --short sebelum audit | Clean; tidak ada output |
| Branch awal | main |
| git rev-parse HEAD | 4d1c6cb8fced3ec1617285e497c408656a7f5d45 |
| Cached origin/main | 4d1c6cb8fced3ec1617285e497c408656a7f5d45 |
| HEAD relationship | HEAD menunjuk commit merge phase 5 integration and acceptance dan sama dengan cached origin/main |
| git fetch origin main --prune | Gagal: error: cannot open '.git/FETCH_HEAD': Permission denied |
| Pemeriksaan FETCH_HEAD | File ada, 105 bytes, atribut Archive; Git tidak dapat membukanya |
| Proses Git aktif | Tidak ditemukan |
| Retry fetch | Gagal sekali lagi dengan error yang sama |

Remote freshness tidak dapat diklaim. Baseline remote di atas hanya berdasarkan HEAD dan ref origin/main yang sudah tercache. Tidak ada perubahan yang boleh dilakukan untuk memperbaiki permission tersebut.

Branch phase6/plan juga tidak dapat dibuat karena Git tidak dapat membuat directory ref di .git/refs/heads/phase6/ (unable to create directory). Rencana tetap dibuat pada branch main yang clean; commit harus dilakukan oleh lingkungan atau pemilik yang memiliki akses tulis Git.

Verification baseline:

| Command | Hasil |
|---|---|
| npm.cmd run lint | PASS |
| npm.cmd run typecheck | PASS |
| npm.cmd run test | PASS — 54 test files, 610 tests; duration 61.55s |
| npm.cmd run build | PASS — Vite 8.1.5, 158 modules; warning chunk index 623.62 kB dan xlsx 493.22 kB |
| git diff --check | PASS |

## 3. Review dan disposition Phase 5

Phase 5 berstatus PASSED WITH APPROVED EXCEPTIONS. Edge merupakan browser operasional yang diuji; Chrome mendapat waiver owner dan waiver tersebut tidak otomatis berlaku untuk Phase 6.

Sudah tersedia dan menjadi dependency Phase 6:

- eligibility secure, candidate-pool snapshot, Web Crypto selection tanpa replacement, pending WinnerRecord, atomic persistence, rollback, dan Practice isolation;
- production Draw Setup yang membaca persisted Event, category, configuration, session, participant, dan eligibility melalui query/service production;
- successful Live command menghasilkan pending-confirmation, configuration snapshot, candidate snapshot, pending winners, serta audit draw-session-started;
- duplicate execution rejection dan readback setelah database close/reopen;
- exact ticket identity: "00042" dan "42" tetap string berbeda.

Batas yang harus dibawa ke Phase 6:

- Draw Setup sekarang langsung memanggil command Phase 5 dan menampilkan pending result; Live Draw belum menjadi route production.
- LiveDrawPage masih mengimpor fixture dari src/prototype/ dan merupakan presentation prototype.
- pending result screen juga masih fixture/prototype dan memuat confirmation serta redraw affordance yang belum boleh dipromosikan dalam Phase 6.
- warning Vite chunk >500 kB tetap ada.
- benchmark 10.000 peserta mengukur algoritma dengan persistence double, bukan performa IndexedDB nyata.
- acceptance Phase 3 dan Phase 4 masih memiliki keterbatasan browser yang telah didokumentasikan.
- AGENTS.md dan sebagian TASKS.md mengalami documentation drift terhadap implementasi Phase 3–5; drift ini tidak diperbaiki dalam task planning.

## 4. Current architecture and gap analysis

Domain/application saat ini sudah memisahkan DrawSession, DrawConfiguration, eligibility, candidate builder, secure selection, draw command, repository, dan persistence unit of work. DrawSession menyimpan status ready, drawing, atau pending-confirmation, snapshot konfigurasi/candidate, mode, dan timestamp. Schema IndexedDB masih version 1.

Gap utama:

1. Tidak ada kontrak typed untuk state countdown/rolling/reveal/interruption atau checkpoint presentasi.
2. Konfigurasi yang dipakai Draw Setup belum menjadi authoring workflow produksi yang lengkap dan dapat dibuka kembali tanpa development seed.
3. Draw Setup memiliki loading/error/capacity handling, tetapi belum memiliki session handoff ke Live route dan belum menjalankan workflow presentation.
4. Live route mengambil seluruh state dari query prototype; query tersebut bukan authority dan tidak boleh menentukan hasil.
5. Belum ada boundary at-most-one pada controller UI dan duplicate-execution rejection yang terhubung jelas dengan satu official persisted draw effect.
6. Belum ada recovery persisted checkpoint; refresh dapat kehilangan tahap presentasi walaupun result resmi telah tersimpan.
7. Pending route production read-only belum tersedia; confirmation/redraw tetap future Phase 8.
8. Participant mutation/import belum memiliki lock yang ditentukan untuk active presentation.

### Keputusan owner yang final

- Draw Setup hanya mengelola persisted configuration, readiness, dan valid ready
  DrawSession. Final Phase 5 command dijalankan oleh production Live Draw route
  setelah start gate.
- Route production adalah /draw/run/:drawSessionId. Persisted DrawSession adalah
  authority untuk mode. Query parameter mode tidak boleh memilih atau mengganti
  mode session.
- Presentation checkpoint menggunakan store terpisah melalui additive IndexedDB
  schema v2. Checkpoint Live hanya menyimpan drawSessionId, persisted stage,
  timestamps/policy metadata, format version, dan orthogonal blackoutRequested.
  Checkpoint tidak menduplikasi WinnerRecord atau selected-result projection;
  official WinnerRecords tetap satu-satunya authority untuk hasil Live.
- Practice result dan Practice presentation checkpoint menggunakan sessionStorage,
  bukan official IndexedDB stores. Reload pada tab yang sama boleh dipulihkan;
  close tab mengakhiri Practice.
- Blackout bukan presentation stage. blackoutRequested adalah flag orthogonal,
  sehingga countdown/rolling/reveal yang sedang berjalan tetap dapat dipulihkan.
- Persisted stages hanya countdown, rolling, reveal, dan pending-handoff.
  starting dan pre-result failures tetap ephemeral.
- Kontrak eksekusi bukan klaim exactly-once invocation: controller aktif hanya
  boleh melakukan at-most-one invocation; application/persistence boundary wajib
  menolak duplicate execution; hasil akhirnya harus exactly one official persisted
  draw effect; session yang sudah started atau pending-confirmation tidak boleh
  melakukan reselection.
- Orphan recovery: bila Phase 5 berhasil tetapi checkpoint belum dibuat,
  DrawSession dan WinnerRecords tetap authoritative. Reload langsung menuju
  production read-only Pending Results; command tidak boleh dijalankan ulang dan
  countdown tidak perlu direkonstruksi tanpa checkpoint.
- Hold-to-start Live berdurasi 1.500 ms. Pointer hold dan Space hold batal pada
  release, blur, route change, atau unmount sebelum durasi selesai. Sediakan
  explicit confirmation action sebagai assistive-technology fallback yang tidak
  bergantung pada timed hold.
- Draw-specific category, prize name, winner count, winning rule, check-in
  requirement, eligible-group filter, mode, dan ready-session authoring berada di
  Draw Setup. Settings bukan tempat utama authoring draw.
- Participant/import mutation lock ditegakkan di application/persistence boundary,
  bukan UI saja. Lock dimulai sebelum authoritative command read dan berakhir
  setelah pending-handoff.
- Production Pending Results dipromosikan sebagai read-only pada Phase 6; tidak
  ada confirm, cancel, atau redraw controls. Session pending-confirmation yang
  sudah ada dibuka melalui Pending Results dan memblokir conflicting new Live
  session.
- Phase 5 Chrome waiver tidak diwariskan. Slice 7 harus mencatat Chrome PASS yang
  benar-benar diamati atau waiver owner baru.

## 5. Phase 6 goals

- Konfigurasi draw production tersimpan, tervalidasi, dan terkait hanya dengan Event yang benar.
- Live/Practice memiliki start gate yang accessible dan tidak ambigu.
- Secure result dipilih dan dipersist sebelum countdown; timer/animation tidak pernah memilih atau mengubah result.
- Live memiliki at-most-one invocation per active UI controller, duplicate
  execution rejection, exactly one official persisted draw effect, dan tidak ada
  reselection untuk session started/pending-confirmation; Practice tidak membuat
  official records.
- Refresh, close/reopen, abort, dan error memiliki semantics yang tidak melakukan reselection.
- Handoff Pending production bersifat read-only dan siap dikonsumsi Phase 8.
- Public presentation projection minim dan tidak membawa raw Participant data.

## 6. In-scope behavior

Termasuk: draw-specific prize category/name, winner count preset/custom 1–100,
winning rule, check-in, eligible group, mode, persisted ready session,
authoritative count, capacity/readiness gates, validated /draw/run/:drawSessionId
route, 1.500 ms Live hold-to-start, keyboard/assistive-technology fallback,
Phase 5 execution contract, Practice isolation, countdown/rolling/reveal,
skip/reduced motion, additive v2 Live checkpoint, sessionStorage Practice
recovery, interruption/orphan recovery, application-level mutation lock selama
workflow aktif, dan read-only Pending handoff.

## 7. Explicit out-of-scope behavior

Tidak termasuk confirmation all/individual, cancellation, redraw/replacement atau redraw reason, BroadcastChannel, cross-window synchronization, production Audience fullscreen workflow, connection handshake/reconnect, final history UI, winner CSV/XLSX export, backup/restore, backend/cloud/authentication/payments, dan perubahan algoritma secure selection kecuali defect nyata dilaporkan sebagai dependency blocker. Blackout production propagation ke Audience tetap Phase 7; Phase 6 hanya menyiapkan operator-side intent/public projection lokal bila perlu.

## 8. Domain, persistence, application, routing, dan UI decisions

- State workflow adalah discriminated union: ready, starting, countdown, rolling, reveal, interrupted, pending-handoff, dan failed. Blackout bukan state/stage; blackoutRequested adalah flag orthogonal pada checkpoint dan state controller. starting dan pre-result failures tetap ephemeral.
- Selected result tidak disalin ke checkpoint. Official WinnerRecords adalah satu-satunya authority hasil Live; presentation hanya membaca WinnerRecords melalui projection saat runtime.
- Route production adalah /draw/run/:drawSessionId. ID session adalah identity, persisted mode adalah authority, dan query parameter mode dilarang memilih atau mengganti mode. Invalid/mismatched ID mengembalikan safe error tanpa command.
- Draw Setup melakukan persisted authoring, readiness, dan valid ready session. Production Live Draw melakukan final Phase 5 command setelah start gate.
- Live checkpoint wajib menggunakan store terpisah pada additive IndexedDB schema v2; record hanya memuat drawSessionId, stage countdown/rolling/reveal/pending-handoff, timestamps/policy metadata, format version, dan blackoutRequested. Practice checkpoint/result hanya sessionStorage.
- Hold-to-start Live selalu 1.500 ms. Pointer/Space hold batal pada release, blur, route change, atau unmount sebelum selesai. Fallback adalah explicit confirmation action yang tidak bergantung pada timed hold.
- Countdown/rolling durations berasal dari typed presentation policy, default owner-approved; test menggunakan injected clock/timer, bukan wall-clock sleep.
- Setelah official result tersimpan, abort tidak membatalkan atau menghapusnya; recovery melanjutkan/skip ke result yang sama dan kemudian read-only Pending.
- Participant/import mutation lock ditegakkan di application/persistence boundary, dimulai sebelum authoritative command read dan berakhir setelah pending-handoff.
- Jika Phase 5 berhasil tetapi checkpoint belum dibuat, DrawSession dan WinnerRecords tetap authoritative; reload langsung menuju production read-only Pending Results tanpa command ulang atau rekonstruksi countdown. Existing pending-confirmation session memblokir conflicting new Live session. Pending route tidak memiliki confirm/cancel/redraw controls.

## 9. Slice breakdown

### Slice 1 — Workflow Contracts and Persistence Design

Likely files/modules: src/domain/draws/draw-session.types.ts, domain workflow types baru di src/domain/draws/, src/application/draw/ error/query contracts, src/infrastructure/persistence/schema/*, db.ts, repository interfaces dan tests. Tidak boleh mengubah algoritma Phase 5.

Deliver typed state/error contracts, WinnerRecord-backed runtime projection, additive IndexedDB schema v2 checkpoint record tanpa WinnerRecord atau selected-result duplication, upsert/read/delete policy, dan recovery invariant: reload tidak pernah memanggil selection lagi.

Tests: unit transition/invariant, serialization/privacy, stale checkpoint, schema migration and rollback/readback. Happy path checkpoint round-trip; negative invalid session, version, relationship, malformed projection; recovery after partial write. Commands: npm.cmd run lint, npm.cmd run typecheck, focused Vitest, npm.cmd run test, npm.cmd run build, git diff --check.

Manual: inspect IndexedDB records after reload and verify no participant payload. DoD: contracts approved, persistence strategy tested, no UI workflow added.

### Slice 2 — Persisted Configuration and Ready-Session Authoring

Likely files: DrawSetupPage.tsx, DrawSetupRoute.tsx, src/application/draw/draw-setup-query*, configuration/session repositories, domain invariants, composition, and focused tests. Settings is not the primary draw-authoring surface.

Add category/name/count 1–100/rule/check-in/group/mode authoring, valid ready session creation/update, reopen/readback, and event relationship checks. Happy path creates and edits a ready session. Negative cases reject empty name, invalid count, unknown category/event, cross-event IDs, stale started session, and insufficient eligible capacity. Recovery preserves last valid draft. Non-goal: selection and presentation.

Tests include repository integration with fake IndexedDB, invariant unit tests, component form tests, and cross-event isolation. Manual checks cover saving, reopening, mode distinction and offline reload. DoD: production does not rely on development acceptance seed.

### Slice 3 — Production Draw Setup and Readiness Gates

Likely files: DrawSetupPage.tsx, DrawSetupRoute.tsx, draw setup query/error mapper, route tests, composition services, and operator styles/components.

Make setup an editable persisted configuration/readiness screen with authoritative eligible count, insufficient-capacity block, IndexedDB/Web Crypto readiness, active/pending-session detection, explicit Live confirmation, and validated route handoff. Remove production dependence on prototype imports. Distinguish Practice and Live by text, labels, semantics, and confirmation, not color alone.

Tests cover loading, missing data, retryable/non-retryable errors, stale session, capacity boundaries 1/100, URL tampering, and no prototype import. Manual: offline setup, no double scrollbar/clipped action at 1440×900. DoD: setup only prepares ready session and never treats mutable page state as authority.

### Slice 4 — Live Start Gate and Phase 5 Command Handoff

Likely files: LiveDrawPage.tsx, new workflow controller/application service, draw-command-production.ts, route definitions, hold-to-start components, and tests.

Live reads/locks the persisted configuration, revalidates Event/session/count, supports the final 1.500 ms hold-to-start plus Space/Enter hold, cancels on release, blur, route change, and unmount, and offers an explicit non-timed assistive-technology confirmation. The controller permits at-most-one invocation; the application/persistence boundary rejects duplicates and guarantees one official persisted effect. Practice uses sessionStorage only. Selection must complete and be locked before countdown.

Tests: at-most-one deferred command per controller, duplicate UI invocation with one official effect, pointer/Space release cancellation, blur, route change, unmount, explicit fallback, focus, failure before/during/after command, Practice isolation, existing pending-session conflict, and final revalidation. Manual: Live warning, hold progress, cancellation, fallback, and offline/Web Crypto failure. DoD: no command is triggered by render/timer. Non-goal: animation and Audience communication.

### Slice 5 — Countdown, Rolling, Reveal, and Skip Animation

Likely files: workflow presentation components under src/ui/operator/draw/ or src/pages/operator/, injected timer/presentation policy in application layer, projection selectors, styles, and component tests.

Implement countdown, rolling, single/multi-winner layouts for 1, 20, 50, 100, reveal, skip, reduced-motion, exact string ticket rendering, and no Math.random() in presentation. Result identity is immutable and unaffected by timer, animation, skip, rerender, or navigation. Public projection has no raw Participant.

Tests use fake timers and deterministic result fixtures: duration boundaries, skip at each stage, rerender, reduced motion, exact "00042" vs "42", layout overflow, and no random source. Manual: 1440×900, keyboard focus, clipping, scrollbars, reduced-motion preference. DoD: visual rolling is purely cosmetic.

### Slice 6 — Abort, Interruption Recovery, Blackout Boundary, and Pending Handoff

Likely files: checkpoint repository/service from Slice 1, workflow recovery controller, LiveDrawPage.tsx, read-only pending route/page, route tests, and participant mutation lock integration.

Define and test: abort before command (return ready, no official winners), command failure, abort after persisted result (never discard/reselect), refresh during countdown/rolling/reveal, browser close/reopen, interrupted messaging, Practice sessionStorage recovery and close-tab loss, orphan recovery when checkpoint creation fails, and pending read-only handoff. On post-selection interruption, resume or skip to the same result. Blackout is an orthogonal flag and must preserve the underlying stage; no BroadcastChannel or Audience propagation.

Tests use fake IndexedDB and reload/reopen simulation for every persisted stage, stale/corrupt/missing checkpoint, checkpoint non-duplication of WinnerRecord, command/persistence failures, orphan recovery, blackout preservation, and mutation during active workflow. Manual: browser refresh/close/reopen, safe pending display, no confirm/cancel/redraw controls, and offline recovery. DoD: pending result remains auditable and reload cannot produce a second selection.

### Slice 7 — Integration, Acceptance, and Documentation Closeout

Likely files: integration/browser harnesses, regression tests under existing draw, import, persistence, and router areas, docs/technical/PHASE-6-ACCEPTANCE.md only after implementation passes, plus approved documentation reconciliation.

Run full fake-IndexedDB flow, reload/reopen, execution-contract and one-effect checks, Practice sessionStorage isolation/reload/close-tab policy, exact tickets, 1/20/50/100 winners, timer/skip determinism, prototype isolation, import replace/merge mutation-lock regression, privacy boundary, keyboard/pointer, offline, 1440×900, and Edge. Record Chrome as PASS only if actually observed; otherwise record a new owner waiver. DoD: all Phase 6 exit criteria evidenced and no future-phase feature slipped in.

## 10. Slice dependency graph/table

| Slice | Depends on | Produces | Blocks |
|---|---|---|---|
| 1 | Phase 3, Phase 5 | Workflow contracts and persistence design | 2, 4, 6 |
| 2 | Slice 1 | Persisted configuration and ready sessions | 3 |
| 3 | Slice 2 | Production setup and route handoff | 4 |
| 4 | Slice 3, Phase 5 command | At-most-one controller invocation and one official persisted effect | 5 |
| 5 | Slice 4 | Production presentation workflow | 6 |
| 6 | Slice 1, Slice 5 | Recovery and Pending handoff | 7 |
| 7 | Slices 1–6 | Acceptance evidence and closeout | Phase 7 |

External dependencies: Phase 3 persistence/schema; Phase 4 persisted Participants; Phase 5 eligibility, candidate snapshot, secure selection, command, rollback, and pending winners. Phase 7 consumes public presentation state but is not implemented here. Phase 8 consumes Pending winners; confirmation/redraw is not implemented here.

## 11. Test strategy per slice

Every slice must include pure domain unit tests, component tests for user-visible state, fake-IndexedDB integration where persistence is involved, and explicit negative/recovery cases. Selection tests remain responsible for bounds, no-duplicate, Web Crypto failure, and exact ticket identity; presentation tests must assert that they do not select. The execution contract tests at-most-one invocation per active controller, duplicate rejection, exactly one official persisted effect, and no reselection for started/pending-confirmation sessions. Use injected clock/timer and deterministic random doubles only in tests. Run the relevant focused tests plus lint, typecheck, full test, build, and git diff --check before each slice handoff.

Privacy tests must assert that public projections contain no raw Participant, name, group, notes, check-in state, exclusion reason, or candidate list. Source boundary tests must assert production routes do not import src/prototype/.

## 12. Browser/manual acceptance matrix

| Check | Required evidence |
|---|---|
| Setup save/reopen | Persisted configuration/session read back after reload |
| Live execution contract | At-most-one controller invocation, duplicate rejection, and one official persisted effect |
| Result-before-animation | Selection locked before countdown timestamp |
| Animation/skip/reload | Same winner IDs and exact ticket strings |
| Practice isolation | No official WinnerRecord, session mutation, or audit |
| Practice recovery | Same-tab reload restores sessionStorage result/checkpoint; close-tab loss is accepted and documented |
| Pending recovery | Refresh at countdown, rolling, reveal, and post-result reuses the same persisted WinnerRecords |
| Orphan recovery | Official result survives missing checkpoint; reload goes directly to read-only Pending without reselection |
| Checkpoint integrity | Corrupt/stale checkpoint is rejected or bypassed; checkpoint never duplicates WinnerRecord |
| Blackout | blackoutRequested does not erase or replace countdown/rolling/reveal stage |
| Leading zeroes | 00042 and 42 render as distinct strings |
| Prototype isolation | No fixture import or prototype controls in production route |
| Privacy | Public projection has no raw Participant data |
| Mutation safety | Import/participant mutation blocked only during active selected workflow |
| Mutation boundary | Replace/merge/import mutation is rejected at application/persistence boundary while lock is active |
| Existing pending | Existing pending-confirmation session opens read-only Pending Results and blocks conflicting Live start |
| Accessibility | Keyboard hold equivalent, focus, labels, reduced motion |
| Layout | 1440×900, no clipping or double scrollbar |
| Offline | Local setup, Practice, and approved Live persistence behavior |
| Browser | Edge observed; Chrome observed or new owner-approved waiver |

Browser claims must be based on observed results only. Existing Edge acceptance is Phase 5 evidence, not Phase 6 evidence. Phase 3/4 documented limitations remain visible in the final record.

## 13. Risks and rollback strategy

Risks include duplicate command execution, stale/mismatched session URLs, lost checkpoint, schema upgrade failure, browser timer throttling, storage quota/write failure, participant mutation races, privacy leakage, and accidental promotion of prototype actions. Existing Vite chunk warning and unmeasured real IndexedDB 10,000-row performance remain follow-ups, not silently resolved by this plan.

Before official selection, rollback is a ready-session return with no winners. After selection persistence, rollback means recovery to the same immutable result or read-only Pending; never delete, reset, or rerun the session. Schema rollback is not automatic: use additive migration, preserve v1 records, and stop Live start when upgrade/readiness fails. A slice may be reverted at source/commit level only if it does not remove already-created official records.

## 14. Final owner decisions

The following decisions are final for Phase 6 and are no longer open questions:

1. Final secure command runs from Live Draw after start gate; Draw Setup only authors persisted configuration/readiness/ready session.
2. Route is /draw/run/:drawSessionId; persisted DrawSession, including mode, is authoritative and query mode cannot override it.
3. Live checkpoint uses a separate additive IndexedDB schema v2 store and never duplicates WinnerRecord or selected-result projection.
4. Persisted stages are countdown, rolling, reveal, and pending-handoff; starting and pre-result failures are ephemeral.
5. Hold-to-start is 1.500 ms with release/blur/route/unmount cancellation and an explicit non-timed assistive-technology fallback.
6. Countdown and rolling durations come from the approved typed presentation policy.
7. Post-selection abort never discards or reselections official results; missing checkpoint goes directly to read-only Pending Results.
8. Practice uses sessionStorage and same-tab reload recovery; close-tab loss ends Practice.
9. Mutation/import lock is enforced at application/persistence boundary from before authoritative command read through pending-handoff.
10. Blackout is an orthogonal blackoutRequested flag, not a presentation stage, and propagation remains Phase 7.
11. Production Pending Results is read-only with no confirm/cancel/redraw; existing pending-confirmation sessions block conflicting new Live sessions.
12. Execution contract is at-most-one invocation per active UI controller, duplicate rejection at the application/persistence boundary, exactly one official persisted effect, and no reselection for started/pending-confirmation sessions.
13. Chrome must be observed as PASS or receive a new owner waiver; the Phase 5 waiver is not inherited.

## 15. Proposed branch and commit sequence

Intended branch: phase6/plan. The audited environment could not create it due to .git ref permission, so this plan currently remains on clean main.

After Git write access is restored:

1. git switch -c phase6/plan
2. commit only this file: docs: add phase 6 implementation plan
3. owner reviews and approves the plan;
4. implementation uses separate branches/commits for Slices 1–7;
5. no merge to main and no push without explicit request.

Suggested implementation commits are feat(phase6): add workflow contracts, feat(phase6): persist ready draw authoring, feat(phase6): production setup handoff, feat(phase6): add live start gate, feat(phase6): add presentation stages, feat(phase6): recover interrupted pending workflow, and test(phase6): record acceptance evidence.

## 16. Phase 6 exit criteria

- Setup tersimpan dan terbuka kembali sebagai valid ready session.
- Live memenuhi execution contract: at-most-one invocation per active controller,
  duplicate rejection, exactly one official persisted effect, dan secure result
  terkunci sebelum animation.
- Countdown, rolling, reveal, skip, rerender, navigation, refresh, and recovery tidak mengubah result.
- Practice tidak membuat official records atau mengubah Live eligibility.
- Live menghasilkan auditable pending session dan dapat dibuka setelah refresh.
- Refresh pada setiap presentation stage tidak melakukan reselection.
- Official result tanpa checkpoint tetap membuka read-only Pending Results tanpa
  command ulang atau rekonstruksi countdown.
- Checkpoint corrupt/stale ditolak atau dilewati dan tidak menduplikasi
  WinnerRecord atau selected-result projection.
- blackoutRequested tidak menghapus underlying countdown/rolling/reveal stage.
- Practice reload tab yang sama memulihkan sessionStorage; close tab mengakhiri
  Practice tanpa official persistence.
- Mutation replace/merge/import ditolak pada application/persistence boundary saat
  lock aktif.
- Existing pending-confirmation session memblokir conflicting Live start.
- "00042" dan "42" tetap exact strings.
- Prototype fixtures tidak masuk production route.
- Operator-only/raw Participant data tidak masuk public projection.
- Active presentation dilindungi dari participant mutation sesuai lock policy.
- Keyboard, focus, reduced motion, scrollbar, clipping, dan 1440×900 checks lulus.
- Full fake-IndexedDB integration, regression, and browser evidence recorded.
- Edge result dicatat jujur; Chrome PASS atau waiver baru dicatat eksplisit.
- PHASE-6-ACCEPTANCE.md disusun hanya setelah implementasi benar-benar lulus.
- Tidak ada confirmation, cancellation, redraw, BroadcastChannel, Audience synchronization, export, backend, atau perubahan secure selection yang menyusup.

## 17. Approval gate

Dokumen ini hanya merupakan audit dan rencana. **No Phase 6 implementation may begin until the project owner has reviewed and approved PHASE-6-PLAN.md.**

No source code, test, package, lockfile, schema, migration, README, AGENTS, TASKS, PRD, or Phase 5 acceptance record is to be changed as part of this planning task.
