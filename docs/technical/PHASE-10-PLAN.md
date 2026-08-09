# Phase 10 Plan — Recovery, Persistence Safety, and Operational Resilience

## 1. Status

**Planning artifact only — pending owner review and approval.**

Phase 9 is accepted. This document audits the clean post-Phase-9 repository and
proposes Phase 10 implementation slices. No Phase 10 production feature is
implemented by this document.

## 2. Accepted baseline

- Baseline commit: `8b9ccfc` (`chore: finalize accepted phase 8 and phase 9 baseline`).
- Branch at audit start: `phase9/slice-9-6-confirmed-results-export`.
- `git status --short` was empty before planning.
- Phase 9 closeout records accepted authoritative History reconstruction,
  Session History/Detail, All Winners, filters/search, Audit Timeline,
  completed-result Audience Show/Hide, official-record immutability evidence,
  and CSV/XLSX export.
- Phase 9 closeout explicitly defers interrupted-session recovery,
  backup/restore, and broad hardening.

## 3. Phase objective

Make the existing local-first raffle safe to operate through browser reloads,
tab loss, application restart, persistence failures, schema incompatibility,
and Audience reconnects. Recovery must restore persisted identity and state,
never silently select again, never invent an official result, and never mutate
terminal official History as a side effect of recovery.

## 4. Current baseline audit

The production path is split between application/domain workflow, Dexie
repositories and transactions, Operator routes, and the BroadcastChannel
transport. The audit found that the core selection handoff is already safer
than the surrounding recovery UX: `executeDraw` selects once and persists the
DrawSession snapshots and Pending WinnerRecords through the draw unit of work;
confirmation, cancellation, redraw, audit records, and command receipts use
transactional/idempotent persistence paths.

The current `DrawSessionStatus` union is `draft`, `ready`, `drawing`,
`pending-confirmation`, `completed`, and `cancelled`. It does not contain
`interrupted`. A separate presentation workflow has an `interrupted` stage,
but this is not an official DrawSession lifecycle state.

Presentation checkpoints are intentionally transient and contain session ID,
stage, timestamp, blackout intent, and format/policy versions; they do not
contain winners or participant data. `decideLiveRecovery` can resume a trusted
checkpoint or route a persisted official result to Pending handoff. The queue
prioritizes `drawing` and `pending-confirmation`, but there is no deterministic
application-boot recovery arbiter across all unresolved states.

IndexedDB infrastructure already includes `openSupported`, supported-version
probing, migration errors, quota/open error normalization, `checkReadiness`,
transaction error mapping, and `runStorageCapabilityDiagnostic`. The diagnostic
uses an isolated temporary database, writes/reads/deletes a sentinel, verifies
cleanup, and is covered by failure-injection tests. It is not yet a compact
production operator health model and it must not be duplicated.

Audience transport already has retained publisher state, display-ready and
restore-request handshake, heartbeat/liveness, reconnect-safe state,
epoch/sequence ordering, duplicate/stale/gap rejection, snapshot application
acknowledgement, and public projection from committed records. The Operator or
persisted domain remains authoritative; the Audience does not select results.

## 5. Existing capability classification

### 5.1 Already implemented

| Requirement | Evidence and classification |
|---|---|
| Pending result recovery | **ALREADY IMPLEMENTED.** Live start persists DrawSession identity, configuration snapshot, candidate-pool snapshot, Pending WinnerRecords, audit/receipt context atomically; pending routes reload by session ID and do not select again. `AC-EVT-004` coverage exists in draw and pending-decision tests, but the full browser recovery evidence still belongs in Phase 10. |
| IndexedDB persistence | **ALREADY IMPLEMENTED.** Events, participants, settings, sessions, winners, redraws, audits, checkpoints, preferences, and command receipts use Dexie/IndexedDB; localStorage is not the official dataset store. |
| Transaction rollback | **ALREADY IMPLEMENTED.** Draw, participant import, authoring, confirmation, cancellation, redraw, audit, and receipt writes use transaction boundaries with rollback tests. |
| Storage diagnostics | **ALREADY IMPLEMENTED.** `runStorageCapabilityDiagnostic()` exists with isolated temporary DB cleanup and deterministic open/schema/write/read/delete failure tests. Production presentation/wiring remains a gap below. |
| Schema safety | **ALREADY IMPLEMENTED.** Forward migrations through schema v6, newer-version probing, `UnsupportedSchemaVersionError`, migration error mapping, and migration tests exist. |
| Audience disconnected-safe | **ALREADY IMPLEMENTED.** Audience enters disconnected-safe/unavailable state and does not invent or continue a result. |
| Audience reconnect and retained public state | **ALREADY IMPLEMENTED.** Handshake, restore, retained publisher snapshot, heartbeat, reconnect, acknowledgements, and stale/duplicate sequence protection are covered by transport integration tests. |
| Official record immutability and export isolation | **ALREADY IMPLEMENTED.** Phase 9 protects terminal official records and failed export paths are read-only. |
| Command idempotency | **ALREADY IMPLEMENTED.** Command receipts protect confirmation, cancellation, and redraw retries from duplicate official mutations. |

### 5.2 Partially implemented

| Requirement | Current gap |
|---|---|
| Interrupted DrawSession handling | **PARTIALLY IMPLEMENTED.** Presentation has an interrupted/failed-safe concept and the PRD defines `Interrupted`, but the official `DrawSessionStatus` does not. The implementation must first decide whether a persisted lifecycle state is required and define migrations only if evidence warrants it. |
| Pending recovery evidence/UX | **PARTIALLY IMPLEMENTED.** Exact result recovery exists, including partial confirmation and redraw lineage, but startup precedence, acknowledgement, stale-checkpoint messaging, and repeated-reload acceptance are not unified. |
| Live preflight | **PARTIALLY IMPLEMENTED.** Draw readiness checks storage readability, eligibility, session conflicts, and Web Crypto; Audience state is informational/waiting. It does not provide the dedicated persistence-health/recovery decision needed before a critical Live action. |
| Persistence error mapping | **PARTIALLY IMPLEMENTED.** Open, quota, schema, transaction, and checkpoint errors are typed, but write failures across Event/settings, setup, and official Live flows do not share a compact operator-facing state model. |
| Autosave/persistence feedback | **PARTIALLY IMPLEMENTED.** Settings exposes loading/saving/saved/unsaved/error; Event and import flows expose local success/failure; draw setup and Live persistence do not consistently show saved/saving/failed/recovery-required semantics. |
| Presentation checkpoints | **PARTIALLY IMPLEMENTED.** Checkpoints safely resume countdown/rolling/reveal and preserve blackout intent, but their ordering against newer official session data and lifecycle cleanup policy needs explicit Phase 10 rules. |
| Startup recovery | **MISSING in production behavior.** Layout boot resolves an active Event for shell navigation, but there is no centralized precedence for unresolved Live sessions, checkpoints, storage health, and schema failures. |
| Quota/storage pressure UX | **PARTIALLY IMPLEMENTED.** Quota errors normalize and import reports rollback; `navigator.storage.estimate()` is not used, and no UI claims a guarantee. Phase 10 should expose only reliable signals. |

### 5.3 Missing capabilities

- A deterministic startup recovery arbiter and safe route/decision model.
- A formal distinction between presentation interruption and official-record
  interruption, including safe handling before selection, after persisted
  selection, and during partial verification.
- Operator-facing storage health states for unavailable/open/read/write/
  transaction/quota/schema cases, with retry and non-destructive guidance.
- A minimal, non-noisy persistence feedback contract for important writes.
- Explicit recovery acknowledgement and safe actions for unresolved sessions,
  stale/corrupt checkpoints, and interrupted presentations.
- Integrated repeated-reload/reconnect/failure-injection acceptance evidence.

### 5.4 Out of scope

Backup/restore is conditional P2 and is not assumed in the core Phase 10
implementation. Broad accessibility hardening, 10,000-participant profiling,
100-winner benchmarking, broad browser certification, release packaging,
installer/EXE packaging, NDI, localization, remote/mobile control, and large
visual redesign remain deferred.

## 6. Scope

Phase 10 covers recovery contracts, deterministic startup arbitration, safe
Pending/interrupted Live recovery, persistence health and operator feedback,
Audience recovery integration, and deterministic automated/manual acceptance.
It may add ordinary UI accessibility and browser-safe behavior required by
these slices, but it does not redesign accepted Phase 8/9 workflows.

## 7. Non-goals

- No new backend, cloud store, authentication, online registration, or
  cross-device synchronization.
- No random reselection during refresh, reconnect, retry, or startup.
- No automatic replacement winner, automatic abandonment, destructive reset,
  or silent History rewrite.
- No claim of exact free-storage guarantees or reliable private/incognito
  detection where browser APIs cannot provide that evidence.
- No BroadcastChannel rebuild; only recovery semantics and integration.
- No backup/restore implementation without separate owner approval.

## 8. PRD / task traceability

| Requirement / acceptance | Audit result and Phase 10 treatment |
|---|---|
| FR-EVT-003, FR-EVT-004 | IndexedDB and important local writes exist. Phase 10 adds consistent save-health feedback, failure routing, and recovery-safe startup. |
| FR-EVT-006 / AC-EVT-004 | Pending reload already restores session/snapshot/winners/statuses. Phase 10 adds explicit startup precedence, partial-confirmation/repeated-reload evidence, and no-reselection invariants. |
| FR-MOD-003 | Practice persistence remains isolated from official History; recovery must not promote Practice state. Add regression coverage where recovery paths intersect mode handling. |
| FR-MOD-004 | Live official writes are transactional and receipt-protected. Phase 10 makes failed writes visibly non-successful and routes to a safe decision without partial official records. |
| FR-AUD-010 / AC-AUD-006 | Disconnected-safe and stale ordering are implemented. Phase 10 verifies reconnect after Operator/Audience reload and requires authoritative persisted/Operator state to win. |
| PRD recovery requirements | Refresh before start restores draft; refresh after Pending restores the same result; BroadcastChannel loss is safe; application close during Running requires a safe recovery decision; storage/quota failure blocks Live; export failure leaves History unchanged. The first three have implementation foundations; the latter startup/storage/operator cases need Phase 10 integration. |
| AC-EVT-001 | Event reopen and persistence foundations exist; Phase 10 adds boot precedence when an active Event has unresolved official work. |
| AC-EVT-002 | Offline core flows are established by the local-first architecture; Phase 10 adds storage-health and interrupted-operation evidence, not network functionality. |
| AC-EVT-003 | IndexedDB/localStorage separation is implemented; Phase 10 verifies diagnostics and error policy do not put official data in temporary stores. |
| Related History/Audience criteria | Phase 9 immutability, Show/Hide, export, retained Audience state, exact ticket strings, and redraw lineage remain authoritative and must be regression-protected. |

## 9. Recovery state model

Keep official lifecycle and presentation lifecycle separate.

Official DrawSession decisions:

| Situation | Policy |
|---|---|
| `ready`/draft with no selection | Restore setup/configuration. No official result exists; a new selection requires an explicit operator start. |
| pre-selection presentation interruption | Treat as presentation interruption only. Do not fabricate a result. Return to safe setup/queue or require acknowledgement. |
| `drawing` with persisted Pending winners | Treat persisted winners and snapshots as authoritative. Recover to verification/pending handoff; never call selection again. |
| `drawing` with no persisted winners | Do not infer that selection completed. Mark/record an interruption decision only if the lifecycle contract requires it; require explicit safe operator choice before another Live start. |
| `pending-confirmation` | Recover exact WinnerRecord IDs, strings, statuses, candidate snapshot, receipts, and redraw lineage; continue verification. |
| partial confirmation | Preserve Confirmed winners; leave remaining Pending/Cancelled/Replaced relationships unchanged. |
| redraw in progress or retried | Resolve command receipt first. A committed receipt is the result; an uncommitted transaction is rolled back and may be retried through the command boundary. |
| completed/cancelled | Terminal official records remain read-only. Presentation cleanup/recovery cannot reopen or overwrite them. |

Do not add `interrupted` to `DrawSessionStatus` merely because the PRD names
it. Slice 10.1 must decide whether existing `drawing` plus a recovery decision
is sufficient. Add a persisted `interrupted` state only if the audit proves
that the current states cannot represent “selection outcome unknown” without
unsafe ambiguity; if added, specify a forward migration and terminal/active
transition rules before implementation.

## 10. Startup recovery policy

At application boot, evaluate in this order:

1. Establish storage/schema health. If the database cannot open/read safely,
   show a typed storage-unavailable/schema-incompatible state and block Live;
   never auto-reset.
2. Resolve the active Event and verify required relationships.
3. Load Live sessions, WinnerRecords, command receipts, and presentation
   checkpoints for that Event.
4. Resolve committed command receipts before interpreting an operation as
   interrupted.
5. Route unresolved persisted official results (`pending-confirmation`, or a
   committed result still represented by `drawing`) to the exact session’s
   recovery/verification route.
6. Route a trusted checkpoint only when it belongs to the same Live session,
   is supported/current, and does not conflict with newer official state.
7. Route pre-selection/ambiguous state to a safe acknowledgement screen with
   explicit choices; do not start a new draw automatically.
8. If nothing is unresolved, continue to Dashboard/Draw Setup normally.

The arbiter must be idempotent: repeated reloads produce the same route and
read-only decision, and do not create sessions, winners, audits, receipts, or
random selections.

## 11. Persistence/storage safety policy

Reuse `RaffleOSDatabase.openSupported`, `checkReadiness`, typed persistence
errors, and `runStorageCapabilityDiagnostic`; do not create a second diagnostic.

The production health model should distinguish:

- unavailable IndexedDB or database open failure;
- unsupported/newer schema or migration failure;
- required-store/read failure;
- transactional/write failure;
- quota/storage-pressure signal when reliably reported;
- checkpoint-only failure where official data remains preserved;
- healthy/unknown (unknown is not a free-space guarantee).

Readiness may perform safe reads. A write-capability probe, if approved in a
preflight slice, must use the existing isolated temporary diagnostic database,
must verify cleanup, and must never touch `RaffleOS_DB` or official records.
`navigator.storage.estimate()` can inform a warning when available, but the UI
must say “reported estimate” and must not promise remaining capacity. No
incognito/private-mode inference is allowed.

On official Live persistence failure, the application must report failure,
retain the last known safe state, and never present a successful result. The
unit-of-work transaction boundary and command receipt rules remain the source
of truth for partial-write prevention. Reset utilities remain development-only
and require explicit confirmation; production recovery never invokes them.

## 12. Audience recovery policy

Keep BroadcastChannel protocol v1 and existing publisher/subscriber logic.
After either tab reloads, the Audience requests a retained snapshot; the
Operator/persisted domain responds with the newest accepted epoch/sequence and
public projection. After both reload, the same rule applies when the Operator
re-establishes its publisher state. A disconnect during countdown/rolling/
reveal enters disconnected-safe and does not advance or invent a result.

After result selection, Audience may restore only the public projection of that
same DrawSession. Confirmed Show/Hide state remains a public presentation
decision, while official WinnerRecords and History remain authoritative. Stale,
duplicate, cross-scope, or cross-session messages are rejected as today.

## 13. Backup / Restore Decision

**Recommendation: B — keep backup/restore deferred to a later optional milestone.**

The current schema has event-scoped foreign-key-like relationships across
Events, Participants, settings, configurations, sessions, WinnerRecords,
redraws, audits, checkpoints, command receipts, and local display assets. IDs
and immutable audit relationships require a versioned package, integrity
validation, duplicate Event ID policy, no-silent-overwrite conflict handling,
and an explicit asset format. Existing CSV/XLSX export is a confirmed-result
projection, not a lossless event backup. Adding backup now would expand the
recovery schema surface and migration risk before the core interrupted-session
policy is proven.

Revisit as an approval-gated optional slice after Phase 10. That slice should
define a portable versioned package, event/relationship integrity checks,
duplicate ID and conflict behavior, preserved History/audit/receipt semantics,
asset inclusion or references, and import rollback/no-overwrite guarantees.

## 14. Slice breakdown

### 10.1 — Recovery domain/state audit and contracts

- **Objective:** Decide official interruption semantics and define typed
  recovery decisions without conflating presentation checkpoints with records.
- **Dependencies:** Current DrawSession, WinnerRecord, receipt, checkpoint,
  and recovery contracts; PRD lifecycle rules.
- **Boundary:** Domain/application contracts and pure decision functions only;
  no UI or schema change unless the state audit proves it necessary.
- **Likely areas:** `src/domain/draws/draw-session.types.ts`,
  `src/application/workflow/recovery.*`, draw queue/readiness contracts,
  invariants and tests.
- **Tests:** exhaustive state matrix; no-selection vs persisted-selection;
  partial confirmation; receipt committed/uncommitted; terminal immutability;
  idempotent repeated decisions.
- **Manual acceptance:** Review representative persisted fixtures and confirm
  every recovery decision names an explicit safe operator action.
- **Non-goals:** random selection, routing redesign, backup, new state by
  assumption.
- **Exit criteria:** approved state table and typed contracts with no ambiguous
  path that can reselect.

### 10.2 — Startup and unresolved-session detection

- **Objective:** Make boot deterministic and route unresolved official work
  before normal setup.
- **Dependencies:** 10.1; existing repositories and `checkReadiness`.
- **Boundary:** Application boot/startup resolver, route guard, read-only
  unresolved-session query, safe fallback UI contract.
- **Likely areas:** app/layout boot, production service composition, draw
  session queue/readiness, new focused startup modules/tests.
- **Tests:** no active work, Pending, partial confirmation, drawing with/without
  winners, committed receipt, missing relationship, schema failure, repeated
  boot.
- **Manual acceptance:** reload each known session point and verify the same
  session is selected for recovery.
- **Non-goals:** automatic abandonment or session repair.
- **Exit criteria:** no boot path sends the operator to conflicting fresh Live
  setup when unresolved official work exists.

### 10.3 — Pending / interrupted Live recovery

- **Objective:** Restore exact official data and safe presentation state across
  refresh, close/reopen, and interrupted presentation.
- **Dependencies:** 10.1–10.2; existing atomic draw and pending-decision flows.
- **Boundary:** Recovery orchestration around persisted session/winners/checkpoint;
  preserve existing selection and command idempotency.
- **Likely areas:** `draw-session-queue`, `recovery-query`,
  `ProductionDrawPresentation`, Pending route/page, checkpoint repository.
- **Tests:** exact ticket strings/IDs, candidate snapshot, statuses, redraw
  lineage, checkpoint stale/corrupt/unsupported, pre-selection interruption,
  post-selection interruption, partial confirmation, repeated reload.
- **Manual acceptance:** Chrome/Edge refresh and tab close/reopen at setup,
  countdown, rolling, reveal, Pending, partial confirmation, and redraw.
- **Non-goals:** new animation behavior or new random source.
- **Exit criteria:** recovery never calls selection and terminal History is
  unchanged by recovery.

### 10.4 — Persistence health and storage safety

- **Objective:** Reuse existing diagnostics and expose actionable health
  states before critical Live writes.
- **Dependencies:** 10.1; existing error normalization and diagnostic tests.
- **Boundary:** Typed health adapter, optional isolated preflight probe, safe
  error mapping, no official data mutation.
- **Likely areas:** persistence diagnostics/errors/db, draw preflight/composition,
  participant import error mapping, focused operator health component.
- **Tests:** open/read/write/transaction/quota/schema failures, rollback,
  cleanup failure, unsupported schema, no production DB touch, Web Crypto
  unavailable, diagnostic unavailable.
- **Manual acceptance:** supported developer/test failure injection shows
  actionable guidance and blocks Live without reset.
- **Non-goals:** storage guarantees, private-mode detection, destructive reset.
- **Exit criteria:** every critical Live failure maps to retry/return/resolve
  guidance and cannot report false success.

### 10.5 — Operator recovery UI and persistence feedback

- **Objective:** Provide compact saved/saving/failed/recovery-required status
  and safe recovery actions using existing modal/banner language.
- **Dependencies:** 10.2–10.4.
- **Boundary:** Operator UI state mapping and route actions; keep error details
  typed and human-readable, with no raw stack traces.
- **Likely areas:** Operator layout/startup shell, Settings, Event/Draw Setup,
  Live/ Pending pages, `PresentationRecoveryDialog`, shared banners/toasts.
- **Tests:** UI states and focus/actions for recovery available, retry,
  continue verification, return safe state, storage blocked, save failed.
- **Manual acceptance:** operator can understand what is saved, what failed,
  and what action is safe during an event without opening dev tools.
- **Non-goals:** noisy per-keystroke autosave or visual redesign.
- **Exit criteria:** no event-operation error lands on a cryptic/debug screen.

### 10.6 — Audience reconnect / presentation recovery integration

- **Objective:** Verify and integrate existing retained transport state with
  authoritative session recovery.
- **Dependencies:** 10.3 and 10.5; existing protocol/controller tests.
- **Boundary:** restore payload selection and lifecycle integration only;
  preserve protocol and ordering rules.
- **Likely areas:** `display-transport` controller/publisher/projection,
  Audience/Operator integration routes, audience connection view model.
- **Tests:** Operator reload, Audience reload, both reload, disconnect during
  each stage, reconnect after selection, stale/duplicate restore, retained
  Show/Hide state.
- **Manual acceptance:** Chrome/Edge two-tab test with display disconnect and
  reconnect; verify no new result or internal data appears.
- **Non-goals:** BroadcastChannel replacement, NDI, remote display.
- **Exit criteria:** persisted/Operator state is authoritative after every
  reconnect scenario.

### 10.7 — Integrated recovery scenarios and acceptance

- **Objective:** Prove the full recovery contract with deterministic automated
  and practical manual evidence.
- **Dependencies:** 10.1–10.6.
- **Boundary:** cross-layer tests, failure injection, owner runbook and
  acceptance record.
- **Likely areas:** application/persistence/routing/UI/display integration
  test suites and a Phase 10 acceptance document if approved.
- **Tests:** Scenarios A–I below, including repeated reload and duplicate
  receipt protection.
- **Manual acceptance:** focused matrix in section 18.
- **Non-goals:** release certification and broad performance programs.
- **Exit criteria:** all required scenarios pass, `git diff --check` passes,
  and owner signs the recovery evidence.

## 15. Dependency/order

```text
10.1 Recovery contracts/state audit
          |
          v
10.2 Startup/unresolved-session detection ----+
          |                                   |
          v                                   v
10.3 Pending/interrupted recovery       10.4 Persistence health
          |                                   |
          +------------------+----------------+
                             v
                    10.5 Operator recovery UX
                             |
                             v
                    10.6 Audience integration
                             |
                             v
                    10.7 Integrated acceptance
```

10.4 can prototype independently after 10.1, but its operator blocking and
preflight behavior must integrate after the startup/recovery decision contract.

## 16. Automated test requirements

Add deterministic tests at the narrowest boundary: pure recovery/domain
matrices; application startup and preflight; persistence open/schema/transaction
failure injection; routing boot precedence; React recovery UI; and
BroadcastChannel/controller reconnect integration. Include repository failure,
rollback, quota/open failure, unsupported schema, stale/corrupt checkpoint,
reconnect, and repeated recovery. Assert exact ticket strings, IDs, statuses,
timestamps, snapshots, redraw lineage, audit evidence, and receipt idempotency.
Never use statistical randomness tests and never use a test that “proves”
recovery by selecting a fresh winner.

## 17. Required recovery scenarios

| Scenario | Expected acceptance |
|---|---|
| A. Refresh with no active draw | Normal recovery; no official record or new selection. |
| B. Refresh after persisted Live selection, still Pending | Same DrawSession, WinnerRecord IDs, winners, snapshots, and Pending state; no reselection. |
| C. Refresh after partial confirmation | Confirmed remain Confirmed; remaining winners remain Pending; no duplicate audit/receipt. |
| D. Presentation interruption before selection | No fabricated official result; safe acknowledgement/return path. |
| E. Audience disconnect/reconnect with result | Authoritative retained/persisted public result restored; no new result. |
| F. Official persistence write failure | No false success and no partial official records; actionable retry/safe return. |
| G. Storage/schema cannot open safely | Live blocked with guidance; no automatic destructive reset. |
| H. Startup with unresolved official session | Operator directed to recover/resolve that session before conflicting Live work. |
| I. Repeated reload/recovery | Idempotent route/state; no duplicate sessions, winners, audits, or command receipts. |

## 18. Manual acceptance matrix

| Check | Chrome/Edge manual action | Expected | Automated coverage |
|---|---|---|---|
| No active draw | Open Operator, refresh | Dashboard/setup returns normally; no record changes | Startup/router tests |
| Pending recovery | Persist Live selection, refresh during reveal/Pending | Exact same tickets/session and Pending verification | Application/persistence/UI tests |
| Partial confirmation | Confirm one winner, refresh | Confirmed/Pending split preserved | Pending decision/recovery tests |
| Pre-selection interruption | Reload/close during countdown before official selection exists | Safe state; no winner invented | Recovery state tests; manual timing check |
| Audience reconnect | Disconnect/reload Audience at countdown, rolling, reveal, and confirmed Show/Hide | Disconnected-safe then latest authoritative public state; no new result | Transport integration tests; two-tab Chrome/Edge check |
| Storage failure | Use supported developer/test injection for open/write/quota/schema failure | Live blocked or failed visibly; retry/return guidance; no reset | Failure-injection tests |
| Startup conflict | Reload with unresolved Live session | Recovery route precedes fresh setup | Startup tests and manual reload |
| Repeated recovery | Reload both tabs several times | Stable identity/state; no duplicates | Idempotency integration tests |

Only the two-tab Audience, browser close/reopen, real refresh timing, and
Chrome/Edge rendering/connection checks require manual Chrome/Edge testing.
Failure injection, exact persistence invariants, and repeated recovery should
be automated; manual testing should not be the sole evidence.

## 19. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Presentation state mistaken for official domain state | Separate checkpoint and DrawSession contracts; official records always win. |
| Recovery triggers reselection | Recovery APIs accept persisted IDs/results and have tests that spy on selection; boot is read-only. |
| Stale checkpoint overrides newer official data | Validate session/format/timestamps and compare against persisted session/winners; discard or acknowledge stale checkpoint. |
| Recovery creates duplicate AuditRecords | Resolve command receipts first; make recovery read-only; test repeated reload. |
| Recovery bypasses command idempotency | All confirmation/cancellation/redraw retries enter existing command services and receipts. |
| Browser quota APIs are incomplete | Label estimates as advisory; classify actual write errors; never promise free capacity. |
| Destructive recovery action | No automatic reset/delete/abandon; explicit confirmation and development-only reset boundary. |
| Reconnect restores stale Audience state | Operator/persisted projection is authoritative; retain epoch/sequence/session validation and restore acknowledgement. |
| Schema migration becomes unnecessarily complex | Decide state need in 10.1; avoid new schema/checkpoint fields unless an invariant cannot be met otherwise. |
| Error UI exposes implementation details | Central typed mapping to actionable operator language; keep causes for diagnostics only. |

## 20. Exit criteria

- All applicable requirements are classified and traceable to repository
  evidence or a Phase 10 slice.
- Startup deterministically detects unresolved official work and storage/schema
  blockers before conflicting Live actions.
- Pending and partial-confirmation recovery restores exact IDs, strings,
  snapshots, statuses, redraw lineage, audits, timestamps, and receipts.
- Presentation interruption cannot fabricate or silently replace an official
  result.
- Persistence failure cannot report false Live success or leave partial
  official records.
- Audience disconnect/reconnect remains safe and authoritative.
- Scenarios A–I pass through automated tests plus the focused manual matrix.
- No terminal History record is overwritten or deleted by recovery.
- Owner approves any decision to add an `interrupted` lifecycle state or a
  future backup/restore slice.
- Phase 10 implementation changes remain within the stated scope; deferred
  Phase 11 work is not pulled in.

## 21. Explicit implementation boundary

This plan creates no domain, persistence, UI, route, test, schema,
dependency, or production-data changes. Implementation requires separate
owner approval after this plan is reviewed.
