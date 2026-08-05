# Phase 7 — Operator dan Audience Display Synchronization Plan

## 1. Executive summary

Phase 7 mengubah Audience Display dari prototype query-driven menjadi surface
production yang menerima projection publik dari Operator Panel melalui transport
local cross-window. Operator dan persisted production workflow tetap menjadi
authority; Audience tidak memilih, menghitung, menyimpan, mengonfirmasi, atau
mengganti hasil undian.

Urutan target Phase 7:

`typed public protocol` → `privacy-safe projection` → `production /display` →
`operator publisher` → `ordered synchronization/reconnect` →
`blackout/fullscreen/safe states` → `automated integration acceptance`

Transport utama yang diusulkan adalah `BroadcastChannel` pada origin yang sama,
dengan adapter local transport yang dapat diuji dan fallback capability state
yang aman bila API tidak tersedia. Phase 7 tidak menambahkan backend, cloud,
authentication, networked multi-device operation, atau perubahan schema kecuali
audit implementasi menemukan kebutuhan yang benar-benar tidak dapat dipenuhi
oleh state runtime dan checkpoint yang sudah ada.

Automated verification tetap wajib pada setiap slice. Semua browser/manual
checks pada plan ini secara eksplisit ditandai:

**DEFERRED TO POST-PHASE-8 INTEGRATED ACCEPTANCE**

Manual acceptance tidak menjadi alasan untuk mengklaim Phase 7 selesai sebelum
workflow Phase 8 dan integrated acceptance diselesaikan.

Implementasi tidak boleh dimulai sebelum owner menyetujui dokumen ini.

## 2. Audited baseline

Audit dilakukan dari `C:\laragon\www\raffle-os` pada 2026-08-05.

### Repository and verification baseline

| Pemeriksaan | Hasil audit |
|---|---|
| `git status --short` | Clean; tidak ada output |
| Branch | `phase6/slice-7-integration-acceptancem` |
| HEAD | `9b74b9cbad1e46ebd93554a9b348f321957b1fd4` |
| HEAD commit | `fix(phase6): stabilize browser recovery flows` |
| Recent commits | `1757e69 test(phase6): record integration and acceptance evidence`; `f5f9e1d fix(phase6): stabilize recovery and blackout preview`; `6a87a61 feat(phase6): recover draw presentation and pending handoff` |
| Remote freshness | Tidak diaudit ulang melalui fetch; audit memakai refs/commit lokal yang tersedia |
| Production dependencies | React, React DOM, React Router, Dexie, SheetJS CE tarball; tidak ada state-management atau transport dependency |
| IndexedDB schema | v2 additive checkpoint foundation; tidak ada schema v3 untuk Phase 7 baseline |

Verification yang tercatat pada Phase 6 acceptance adalah lint PASS, typecheck
PASS, test PASS (70 test files, 672 tests), build PASS dengan warning Vite
chunk >500 kB, dan `git diff --check` PASS. Verification ulang untuk task
planning ini wajib dijalankan sebelum commit plan dan dilaporkan terpisah.

### Production workflow baseline

- Draw Setup menulis konfigurasi dan ready `DrawSession` ke persistence lokal.
- Production route `/draw/run/:drawSessionId` membaca session persisted sebagai
  authority mode dan menjalankan Phase 5 command hanya pada start gate.
- Official result disimpan sebelum countdown/rolling/reveal; `WinnerRecord`
  adalah authority hasil, bukan animation state.
- Presentation workflow memiliki `countdown`, `rolling`, `reveal`, dan
  `pending-handoff`; checkpoint v2 menyimpan stage, timestamp, policy/version,
  draw session ID, dan `blackoutRequested` tanpa raw Participant atau winner
  payload.
- Production pending route `/draw/pending/:drawSessionId` bersifat read-only;
  confirm/cancel/redraw tetap Phase 8.
- Practice memakai tab-scoped `sessionStorage` dan tidak membuat official
  records.

### Audience baseline

`/display` memakai `AudienceDisplayShell` terpisah dari Operator layout, tetapi
`AudienceDisplayPage` saat ini memilih fixture berdasarkan query parameter dan
merender prototype `StandbyStage`, `CountdownStage`, `RollingStage`,
`WinnerStage`, `BlackoutStage`, atau `DisconnectedStage`. Belum ada production
display session, display-ready handshake, publisher, listener, sequence
ordering, rehydration, atau fullscreen action. Prototype query routes harus
tetap tersedia hanya sebagai explicit prototype behavior atau dipisahkan secara
aman selama promosi production route.

### Public projection and privacy baseline

`projectLivePresentationResult` sudah menghasilkan projection ticket-only:
`drawSessionId`, winner ID internal yang masih perlu ditinjau untuk public
protocol, sequence, dan `ticketNumber`. Projection tidak memuat `Participant`
name, check-in, group, notes, atau raw participant object. Phase 7 harus membuat
boundary yang lebih ketat: public payload hanya boleh membawa field yang memang
diperlukan Audience, dan sebaiknya tidak mengekspos internal `winnerId` bila
Audience tidak membutuhkannya.

### Blackout and connection baseline

Blackout sudah menjadi flag orthogonal `blackoutRequested` pada presentation
workflow/checkpoint; Phase 6 hanya menyediakan local operator preview. Shared
`ConnectionStatus` dan connection tokens sudah ada sebagai presentation
primitive, tetapi belum wired ke display transport. Existing Audience
disconnected fixture bukan disconnected protocol state.

## 3. Phase 6 dependency review

Phase 6 acceptance record secara jujur berstatus **PHASE 6 NOT YET ACCEPTED**.
Automated verification passed, tetapi owner browser verification masih terbuka
untuk valid Live refresh recovery tanpa invalid-transition error, pending route
refresh, orphan recovery, mutation-lock smoke, serta Chrome evidence/waiver.
HEAD menambahkan stabilization terhadap stale async transition dan orphan
mutation lock, namun acceptance record tidak boleh diubah atau dianggap tertutup
oleh plan ini.

Temuan tersebut bukan blocker untuk menyusun atau memulai kontrak Phase 7.
Dependency teknis yang relevan adalah:

- Phase 7 harus subscribe pada persisted/public presentation state yang sudah
  dibangun Phase 6, bukan membaca fixture atau memanggil draw command.
- Rehydration behavior harus mempertahankan invariant Phase 6: reconnect tidak
  boleh reselection, mengubah WinnerRecord, atau menghapus checkpoint.
- Jika automated regression menunjukkan Phase 6 controller tidak menyediakan
  state yang dapat diproyeksikan secara deterministik, implementation slice
  terkait harus berhenti pada blocked dependency dan memperbaiki hanya defect
  yang terbukti menghalangi Phase 7.
- Manual browser defect tetap dicatat sebagai outstanding evidence dan ditunda
  ke integrated acceptance policy; tidak boleh disembunyikan atau diubah menjadi
  PASS tanpa observasi owner.

Phase 7 tidak boleh memperluas Phase 6 untuk membuat confirmation, cancellation,
redraw, history, export, atau backup sebagai workaround.

## 4. Goals

1. Menyediakan typed local cross-window transport berbasis BroadcastChannel.
2. Menyediakan public presentation projection dengan privacy boundary yang
   menolak raw Participant payload dan operator-only metadata.
3. Mempromosikan `/display` menjadi production Audience route yang hanya
   menerima state dari publisher dan memulai dari safe standby/connecting state.
4. Mempublikasikan standby, countdown, rolling, reveal, confirmed-safe pending
   presentation, blackout, dan restore state dari Operator ke Audience tanpa
   menghasilkan result baru.
5. Menjamin ordering, stale/out-of-order rejection, reconnect, handshake, dan
   state rehydration yang deterministik.
6. Menyediakan blackout propagation dan fullscreen Audience workflow dengan
   status capability/failure yang aman.
7. Mempertahankan offline/local-first behavior: transport hanya intra-origin,
   tidak memerlukan internet, dan kegagalan display tidak merusak official
   draw persistence.

## 5. Explicit non-goals

- Confirm/cancel winner, replacement, redraw, atau redraw reason.
- Pending verification mutation, history, audit UI, atau export.
- Backup/restore, backend, cloud, authentication, payments, atau networked
  multi-device synchronization.
- Perubahan secure draw engine atau pemilihan winner oleh Audience.
- Raw Participant payload, nama peserta, check-in, group, notes, candidate pool,
  eligibility filters, atau internal persistence records pada public channel.
- Schema/migration changes, kecuali implementation audit membuktikan benar-benar
  diperlukan; setiap usulan harus dijelaskan dan mendapat owner approval.
- Phase 8 implementation dan integrated acceptance final sebelum Phase 8 selesai.
- Audio, asset marketplace, atau redesign visual di luar minimal public
  projection dan state behavior yang diperlukan Phase 7.

## 6. Architecture decisions

### 6.1 Transport

Gunakan interface transport kecil (`publish`, `subscribe`, `close`, capability
status) dengan adapter `BroadcastChannel`. Nama channel harus event/display
scoped dan tidak membawa data rahasia dalam channel name. Transport tidak boleh
menjadi repository atau source of truth.

`BroadcastChannel` adalah transport local same-origin, bukan jaringan. Bila API
tidak tersedia, production display masuk ke disconnected-safe/capability error
dan tidak menampilkan hasil baru. Jangan menambah dependency karena browser API
dan adapter test double sudah mencukupi.

### 6.2 Protocol and ordering

Setiap envelope memiliki protocol version, message ID, sender/display scope,
draw session identity bila relevan, monotonic sequence/epoch, emitted timestamp,
dan discriminated message type. Public state message membawa minimal public
projection dan stage metadata yang diperlukan untuk render; tidak membawa raw
Participant atau internal repository records.

Audience menerima hanya message yang valid untuk scope, protocol version, dan
session context. Message stale, duplicate, out-of-order, atau dari session lama
diabaikan tanpa mengubah visible state. State machine harus mengizinkan reset ke
standby/restore secara eksplisit, bukan menerima arbitrary transition.

### 6.3 Authority and projection

Operator workflow/persisted Phase 6 records tetap authority. Publisher membaca
state presentation dan membuat immutable public projection. Audience merender
projection dan tidak memanggil selection, eligibility, participant repository,
atau draw command. `confirmed` pada Phase 7 hanya berupa public presentation
state yang tersedia dari existing workflow contract; perubahan status resmi,
confirm/cancel, dan redraw tetap Phase 8.

### 6.4 Handshake, reconnect, and rehydration

Audience mengirim `display-ready` capability/identity tanpa participant data.
Operator membalas dengan current safe snapshot dan current sequence. Listener
harus dapat reconnect/reopen tanpa mengarang state; publisher boleh republish
snapshot idempotently. Saat gap atau invalid sequence terdeteksi, Audience
meminta restore dan menunggu snapshot. Last accepted public state atau safe
blackout/disconnected state dipilih sesuai policy yang diuji, tidak pernah
melanjutkan ke winner state dari timer lokal setelah channel hilang.

### 6.5 Blackout and fullscreen

Blackout propagation memakai intent/state yang sudah dipersist sebagai
orthogonal flag; blackout tidak mengganti underlying countdown/rolling/reveal
stage. Audience menyembunyikan public content secara aman dan dapat kembali
ketika intent dicabut.

Fullscreen menggunakan `document.fullscreenElement` dan
`requestFullscreen()` hanya dari explicit user action pada Audience window.
Failure, browser denial, atau unsupported API menampilkan status non-destructive;
display tetap usable dalam windowed mode. Tidak ada fullscreen otomatis saat
load.

### 6.6 Schema and persistence

Tidak ada schema change yang direncanakan. Runtime transport state, handshake,
last accepted public envelope, dan connection state cukup berada di memory/tab
state; official recovery tetap melalui Phase 6 checkpoint and WinnerRecord
authority. Bila audit implementasi menemukan persistensi tambahan wajib, slice
protocol harus berhenti untuk owner review sebelum schema/migration diubah.

## 7. Slice breakdown

Setiap slice wajib menambahkan automated tests dan menjalankan verification
minimal yang relevan; integration slice menjalankan seluruh suite.

### Slice 1 — Transport and protocol contracts

Definisikan typed envelope, public message union, protocol version, scope,
sequence/epoch, capability, transport interface, BroadcastChannel adapter,
in-memory test transport, error taxonomy, dan safe close semantics.

Automated acceptance: valid/invalid envelope parsing; protocol/version/scope
rejection; duplicate and out-of-order sequence handling; channel unavailable;
listener cleanup; no `Math.random`; no production dependency/schema change.

### Slice 2 — Public projection and privacy boundary

Definisikan public display snapshot/stage projection dari existing presentation
state. Whitelist field-by-field payload; hindari internal winner IDs unless
strictly required. Add defensive serialization/validation and source-level
privacy tests.

Automated acceptance: ticket numbers remain strings including leading zeroes;
projection excludes Participant/name/check-in/group/notes/candidate/filter and
operator controls; malformed or cross-session projection rejected; projection
is immutable and does not invoke draw or persistence mutation.

### Slice 3 — Production Audience route

Replace query-authoritative behavior for the production `/display` route with
transport-backed bootstrap: connecting/standby, valid snapshot rendering,
safe disconnected state, route-safe error handling, and preserved operator
layout separation. Keep explicit prototype fixtures isolated and labeled.

Automated acceptance: direct route render; no operator controls; no prototype
fixture dependency in production path; all required public states; no raw
participant text in DOM/payload; safe initial state before first message.

### Slice 4 — Operator publisher integration

Attach publisher lifecycle to production Draw Run/presentation controller and
operator display status. Publish initial standby and state transitions from the
same public projection used by the local presentation. Publish pending handoff
or safe final state without adding Phase 8 actions.

Automated acceptance: one authoritative transition produces one valid public
message; repeated React renders do not duplicate effects; Practice/Live labels
remain distinct; publisher failure cannot alter DrawSession, WinnerRecord,
checkpoint, or pending result; display-ready receives current snapshot.

### Slice 5 — Synchronization, countdown/rolling/reveal, reconnect

Implement handshake, snapshot restore, sequence/epoch comparison, stale-message
drop, reconnect/reopen, gap recovery, and synchronization of countdown, rolling,
reveal, and safe pending presentation. Animation timing remains operator-owned;
Audience does not run an independent timer that can advance to a new result.

Automated acceptance: deterministic event timeline; late messages ignored;
duplicate messages idempotent; disconnect during every stage stops unsafe
progression; reconnect restores same session/stage/result projection; refresh
does not reselection; multiple Audience listeners receive equivalent snapshots;
offline operation remains local.

### Slice 6 — Blackout, fullscreen, connection states

Propagate orthogonal blackout intent, implement explicit fullscreen control,
capability/error status, connecting/connected/disconnected-safe display states,
and operator connection indicator. Blackout preserves underlying stage for
restore and never leaks internal data.

Automated acceptance: blackout on/off ordering; blackout during countdown,
rolling, reveal; fullscreen success/denial/unsupported mocks; no automatic
fullscreen; connection status transitions; safe state after channel close or
missing API; no display controls beyond public/fullscreen workflow.

### Slice 7 — Integration and automated acceptance

Add end-to-end-in-process transport integration tests spanning Operator
publisher → Audience listener, Practice and Live-safe public states, reconnect,
multiple displays, blackout, fullscreen capability, privacy, and Phase 6
recovery invariants. Reconcile only Phase 7 plan/acceptance documentation after
tests pass; do not modify Phase 6 acceptance in this planning task.

Automated acceptance: full lint, typecheck, test, build, diff check; complete
matrix below; test evidence records counts and known Vite warning; no Phase 8
actions or source imports appear in the production Audience path.

## 8. Dependency graph

```text
Phase 6 production workflow/checkpoint/projection
        │
        ├── Slice 1: transport + protocol contracts
        │       │
        │       └── Slice 2: public projection/privacy
        │                │
        │                ├── Slice 3: production Audience route
        │                │       │
        │                │       └── Slice 5: sync/reconnect/rehydration
        │                │
        │                └── Slice 4: Operator publisher
        │                        │
        │                        └──────────────┘
        │
        └── existing blackout intent + presentation policy
                         │
                         └── Slice 6: blackout/fullscreen/connection states

Slices 3, 4, 5, 6 ──→ Slice 7: integration + automated acceptance
Slice 7 ──(automated only)──→ Phase 7 exit review
Phase 8 confirmation/redraw ──→ post-Phase-8 integrated manual acceptance
```

Required ordering is 1 → 2 before either route/publisher promotion. Slices 3
and 4 may proceed in parallel after Slice 2 if their contracts remain stable;
Slice 5 requires both. Slice 6 depends on protocol plus existing blackout
intent. Slice 7 is the only Phase 7 completion gate.

## 9. Test strategy

- Keep transport/protocol, projection, state machine, and fullscreen capability
  logic outside React where practical.
- Use deterministic fake transport, fake clock/timers, explicit message IDs,
  and fixed snapshots; never use statistical randomness tests or `Math.random`.
- Use fake IndexedDB only to verify Phase 6 authority is unchanged and no new
  official write occurs; do not persist transport envelopes as official data.
- Test privacy with positive whitelist assertions and negative payload/DOM
  assertions for every Participant field.
- Test React lifecycle cleanup, Strict Mode re-mount, route unmount, duplicate
  subscriptions, multiple Audience instances, and channel close.
- Test exact string identity (`00042` versus `42`), one session versus stale
  session, and stage transitions under delayed delivery.
- Add focused tests per slice, then run `npm.cmd run lint`,
  `npm.cmd run typecheck`, `npm.cmd run test`, `npm.cmd run build`, and
  `git diff --check` at integration closeout.

## 10. Automated acceptance matrix

| Area | Automated evidence required |
|---|---|
| Transport capability | BroadcastChannel adapter, unavailable API, close/error, listener cleanup |
| Protocol integrity | Version, scope, session, epoch/sequence validation; invalid envelopes rejected |
| Privacy | No raw Participant/name/check-in/group/notes/candidate/filter/operator data in public messages or Audience DOM |
| Projection | Ticket-only immutable projection; `00042` and `42` remain distinct strings |
| Audience route | Production `/display` bootstraps safely and prototype query fixtures remain isolated |
| Public states | Standby, countdown, rolling, reveal, safe pending/confirmed presentation, blackout, disconnected-safe |
| Operator publisher | State transition publication, display-ready snapshot, no duplicate publication on rerender |
| Countdown/rolling/reveal | Audience reflects operator stage; local timer cannot invent or advance result |
| Ordering | Duplicate, stale, out-of-order, old-session, and sequence-gap messages are ignored/recovered safely |
| Reconnect | Close/reopen/refresh restores the same public session/stage/projection without reselection |
| Multiple displays | Two listeners receive equivalent state and one listener failure does not affect the other |
| Blackout | Orthogonal on/off propagation preserves underlying stage and safe content |
| Fullscreen | Explicit action only; success, denial, unsupported, and exit states are safe |
| Connection state | Connecting/connected/disconnected status is typed, rendered, and non-sensitive |
| Local-first | No network/backend dependency; behavior works with local transport and offline browser APIs |
| Phase boundary | No confirm/cancel/redraw/history/export/backup/backend/schema work sneaks into Phase 7 |
| Regression safety | Phase 6 result, checkpoint, mutation lock, Practice isolation, and pending read-only invariants remain green |

## 11. Manual checks

All entries below are explicitly:

**DEFERRED TO POST-PHASE-8 INTEGRATED ACCEPTANCE**

- Open Operator and Audience in separate same-origin windows/tabs.
- Verify production `/display` starts safely, connects, and shows standby.
- Observe countdown → rolling → reveal → pending-safe presentation on a target
  1920 × 1080 / 16:9 display.
- Verify ticket readability and layouts for 1, 6, 10, 20, and larger supported
  winner counts.
- Verify no operator controls, participant name, check-in, group, or notes are
  visible on the Audience screen.
- Close/reopen Audience during each state; refresh Operator and confirm same
  result/session is restored.
- Open multiple Audience windows and verify equivalent state.
- Disable/restore channel capability and verify disconnected-safe behavior.
- Toggle blackout during countdown, rolling, reveal, and safe pending state.
- Enter/exit fullscreen through explicit user action; verify browser denial is
  non-blocking.
- Verify operator connection indicator and recovery instructions.
- Verify offline/local-first behavior with internet unavailable.
- Verify Phase 6 known browser recovery paths and Chrome evidence/waiver as part
  of the combined post-Phase-8 acceptance, without rewriting historical Phase 6
  evidence.

No manual browser PASS may be claimed for Phase 7 from automated tests or from
earlier Phase 6 observations.

## 12. Risks and rollback

Risks include malformed public payloads, privacy leakage, duplicate publisher
effects, message reordering, channel lifecycle races, timer drift, browser API
differences, fullscreen denial, popup blocking, multiple display ambiguity,
storage/readiness failures, and accidental reliance on query fixtures.

Rollback is additive and safe:

- Disable publisher/listener wiring and return `/display` to a safe standby or
  explicit legacy prototype path; do not infer official results from query
  parameters.
- Keep Phase 6 persisted DrawSession, WinnerRecord, checkpoint, and mutation
  lock untouched if transport fails.
- Drop stale or unsupported messages rather than applying guessed state.
- On reconnect failure, remain disconnected-safe/blackout-safe until a valid
  snapshot arrives.
- Revert a slice at source/commit level only if it does not delete or rewrite
  official local records.
- Do not add a schema migration as an emergency transport workaround.

Known Phase 6 browser gaps, Vite chunk warning, and the limits of local
same-origin transport remain visible risks; Phase 7 cannot claim networked or
multi-device resilience.

## 13. Phase 7 exit criteria

- Typed BroadcastChannel/local transport and protocol tests pass.
- Production Audience route renders only validated public projections and has no
  raw Participant/operator payload boundary violation.
- Operator actions publish standby, countdown, rolling, reveal, safe pending/
  confirmed presentation, blackout, and restore state without changing draw
  authority.
- Countdown, rolling, and reveal are synchronized from Operator state; Audience
  cannot select, reselection, or invent a winner.
- Duplicate, stale, out-of-order, old-session, and gap messages are handled
  safely and deterministically.
- Audience reconnect/reopen/rehydration restores the same public state or a safe
  disconnected state without official data mutation.
- Blackout intent propagates orthogonally and fullscreen is explicit,
  capability-aware, and non-destructive.
- Multiple Audience listeners and a failed listener do not corrupt Operator or
  persisted draw data.
- Offline/local-first automated scenarios pass without backend/cloud.
- No Phase 8 action, history/export, backup/restore, backend, or unapproved
  schema/dependency change is present.
- Every slice has automated evidence; full lint, typecheck, test, build, and
  diff checks pass.
- Manual browser acceptance remains labeled deferred until post-Phase-8
  integrated acceptance; no unobserved browser result is claimed.

## 14. Approval gate

This document is audit and planning only. **No Phase 7 implementation may begin
until the project owner reviews and approves `PHASE-7-PLAN.md`.**

After approval, implementation should use separate reviewable commits for
Slices 1–7. This planning task must change only this file. It must not change
source code, package files, lockfile, schema, migration, README, AGENTS, TASKS,
PRD, or Phase 6 acceptance.

Proposed implementation commit sequence:

1. `feat(phase7): add transport and protocol contracts`
2. `feat(phase7): enforce public display projection privacy`
3. `feat(phase7): promote production Audience route`
4. `feat(phase7): publish operator presentation state`
5. `feat(phase7): synchronize and rehydrate Audience state`
6. `feat(phase7): add blackout fullscreen and connection states`
7. `test(phase7): record automated acceptance evidence`
