# Phase 8 — Production Pending-Result Mutation Workflow Plan

## 1. Executive summary

Phase 8 should turn the existing production pending handoff into an explicit,
local-first Operator workflow for deciding Live results. The first official
selection remains immutable and already exists before presentation; Phase 8
adds the controlled mutations after that checkpoint: confirm, cancel, and
redraw/replacement, with audit evidence, duplicate protection, recovery, and a
public Audience projection that never becomes an authority.

This is a planning and audit document. No Phase 8 implementation is claimed by
this plan. Phase 6 and Phase 7 historical evidence remains unchanged. Phase 6
and Phase 7 browser/manual debt remains deferred to the combined integrated
acceptance after Phase 8.

The audit supports a seven-slice implementation: domain contracts, additive
idempotency/recovery persistence decision, confirmation, cancellation,
redraw/replacement and eligibility, production Operator workflow, then
Audience/recovery integration and acceptance. The exact persistence migration
is an approval gate, not an automatic Phase 8 decision.

## 2. Audited baseline

Audit date: 2026-08-05. Repository: `C:\laragon\www\raffle-os`.

| Item | Audited result |
|---|---|
| Branch | `phase7/slice-7-integration-acceptance` |
| HEAD | `3c5662eef4a7c75aa99e3991b21389c65070f515` (`test(phase7): record automated acceptance evidence`) |
| Worktree at audit start | Clean (`git status --short --branch` showed only the branch line) |
| `origin` | `https://github.com/tripleaxlestudio/raffle-os.git` fetch/push remote is configured |
| `origin/main` relationship | Local `origin/main` is an ancestor of HEAD; local rev-list was `0 24` for `origin/main...HEAD`. HEAD is not an ancestor of local `origin/main`. |
| Remote freshness | Not established. `git fetch origin` failed before updating because `.git/FETCH_HEAD` was not writable (`Permission denied`). |
| Relevant schema | IndexedDB schema v2; v1 core stores plus additive `presentation_checkpoints` store. No v3 exists. |
| Test/build baseline recorded by Phase 7 | Full suite: 78 files, 720 tests; focused Phase 7: 1 file, 7 tests; relevant regression group: 40 files, 374 tests. Lint, typecheck, build, and diff check passed. |
| Production dependencies | React, React Router, Dexie, and approved SheetJS CE; no state-management or transport dependency. |

Relevant route and module inventory:

- `src/app/router.tsx` has production `/draw/run/:drawSessionId` and
  `/draw/pending/:drawSessionId`, separate from prototype `/draw/results`.
- `ProductionPendingResultsPage` reads a Live `pending-confirmation`
  `DrawSession`, its `WinnerRecord`s, Event, and PrizeCategory. It is
  read-only and explicitly says confirmation/redraw are Phase 8.
- `DrawSession` currently has `draft`, `ready`, `drawing`,
  `pending-confirmation`, `completed`, and `cancelled` statuses.
- `WinnerRecord` currently has `pending`, `confirmed`, and `cancelled`, with
  status timestamps. `RedrawRecord` already stores original/replacement IDs,
  reason, optional note, session/event, and timestamp.
- `DexieDrawPersistenceUnitOfWork` already exposes atomic
  `transitionWinnersWithAudit` and `recordRedrawReplacement` primitives, but no
  command identity, receipt, retry policy, or production controller invokes
  them for Phase 8.
- `presentation_checkpoints` contain stage/timing/policy/blackout metadata and
  intentionally do not contain winner or Participant payloads.
- Phase 7 transport/projection carries public ticket strings and presentation
  state only; Audience is not an authority and cannot mutate results.

## 3. Phase 6 and Phase 7 dependency review

Phase 6 supplies the authoritative pre-presentation result: immutable
configuration/candidate snapshots, Web Crypto selection, no replacement during
initial selection, atomic persistence of session/winners/audit, pending
handoff, checkpoint recovery, and participant/import mutation locking during
the active presentation. Its production pending screen is deliberately
read-only. Phase 6 manual acceptance is not closed: valid Live refresh,
pending refresh, orphan recovery, mutation-lock browser smoke, and Chrome
evidence remain owner verification items.

Phase 7 supplies the public projection and cross-window transport boundary:
typed envelopes, ordering/epoch/reconnect behavior, privacy-safe ticket-only
projection, blackout/fullscreen/connection-safe states, and separate Audience
layout. Its automated acceptance passed, while all browser/manual integrated
checks are explicitly deferred to post-Phase-8 acceptance.

Phase 8 must consume both boundaries without changing their historical records:
the result is read from `WinnerRecord`/`DrawSession`, and decisions are
published outward through the existing projection. It must not put mutation
controls in Audience or use presentation animation/transport as persistence.

## 4. Goals

- Make `/draw/pending/:drawSessionId` a production Operator decision surface.
- Confirm all or selected pending winners with an atomic, auditable operation.
- Cancel pending winners with explicit reason/context and no deletion.
- Draw and persist valid replacements with mandatory Live redraw reason and
  explicit original-to-replacement lineage.
- Prevent duplicate execution, duplicate records, and refresh-triggered reruns.
- Recompute redraw eligibility from the frozen session snapshot plus current
  official history, preserving ticket strings exactly.
- Recover safely after refresh, tab close, crash, storage failure, or transport
  failure, without ambiguous official state.
- Keep Practice tab-scoped and outside official Live mutation paths.
- Project confirmed/cancelled/replacement outcomes to Audience without
  exposing Participant/private fields and without requiring Audience
  connectivity for official persistence.

## 5. Explicit non-goals

- No backend, cloud database, authentication, payment, or online registration.
- No new random-selection algorithm or animation-driven selection.
- No Audience-side confirm, cancel, redraw, eligibility calculation, or
  official persistence.
- No CSV/XLSX export or backup/restore. History/read-model reconciliation is
  explicitly in Phase 8; export and backup boundaries remain outside Phase 8.
  No legal certification or external audit claim is made.
- No silent deletion or rewriting of Phase 6/7 evidence or official history.
- No schema migration during this planning task.

## 6. Authority model

| Concept | Authority and rule |
|---|---|
| `DrawSession` | Authority for Event, mode, configuration snapshot, candidate snapshot, session lifecycle, and whether a Live result is still unresolved. It does not replace individual winner status. |
| `WinnerRecord` | Authority for each selected slot and its lifecycle. `pending` is not final; `confirmed` is final; `cancelled` remains official audit evidence but is not final. |
| Pending result | A read projection of a persisted Live session whose selected records still require operator decision. Route render only reads; it never selects or mutates. |
| Presentation checkpoint | Recovery metadata for countdown/rolling/reveal/pending handoff. It never authorizes a mutation and never stores winner/private payloads. |
| Mutation lock | Application/persistence guard for one decision command per target session. Transactional preconditions plus unique schema-v3 receipts are the default; a persistent lock is added only if focused cross-tab race tests prove they are insufficient. |
| Audience projection | Derived public state from authoritative session/winner records and operator-approved decision events. It carries only public display data, never action authority or Participant data. |

The route parameter is untrusted input. Every command must reload and validate
the session, mode, relationships, current statuses, snapshots, and target IDs
inside the transaction boundary.

## 7. State machine

### Winner decision lifecycle

`pending → confirming → confirmed`

`pending → cancelling → cancelled`

`pending → redraw-selecting → replacement-persisting → pending replacement`

`confirmed → redraw-selecting → replacement-persisting → pending replacement`

For a redraw of an already confirmed result, the existing domain allowance
(`confirmed → cancelled` only with audited redraw context) is a separate
destructive command. It preserves the original, creates a new pending
replacement, and atomically moves a completed session back to
`pending-confirmation`. A replacement is never automatically confirmed.

### Session lifecycle

- `pending-confirmation`: at least one WinnerRecord remains `pending`, including
  a pending replacement. There is no persisted partial-completion status.
- `confirming`, `cancelling`, and `redraw-selecting` are controller/command
  phases, not necessarily persisted statuses. They must not be inferred from a
  route render.
- `completed`: zero WinnerRecords remain pending and at least one WinnerRecord
  is confirmed.
- `cancelled`: all winners are cancelled and no replacement is pending or
  confirmed. Cancellation preserves every WinnerRecord and RedrawRecord.

### Failure and recovery

Every mutation has `idle → executing → committed` or `idle → executing →
failed`. A client timeout is `unknown`, not failed: reload the authoritative
receipt/session before retrying. If persistence commits, retry returns the
same result. If it does not commit, retry may execute once. A stale lock is
reconciled from the persisted receipt, not guessed from UI state.

## 8. Command and idempotency model

Each command carries a caller-generated `commandId`, `drawSessionId`, mode,
target WinnerRecord IDs, expected statuses, a typed unauthenticated actor
(`local-operator`), and a canonical operation payload. The command handler validates an idempotency key scoped to
the operation and session. A retry with the same key and equivalent payload
returns the original outcome; the same key with a different payload is a safe
conflict. A new key is rejected when current persisted statuses no longer
match the expected precondition.

Confirm/cancel must be one transaction covering precondition reads, winner
transitions, session resolution, command receipt update, and append-only audit
records. Redraw must additionally cover replacement eligibility, original
cancellation, replacement append, `RedrawRecord`, and audit. The persistence
layer generates canonical commit timestamps; UI-supplied time is not
authoritative. No command is initiated by route render, refresh, timer,
Audience message, or reconnect.

The current repositories have no durable command identity or receipt. An
in-memory/UI disabled button is insufficient for duplicate-submit prevention.

## 9. Confirmation contract

Input: Live `drawSessionId`, one or more pending WinnerRecord IDs (or an
explicit all-pending selector), `commandId`, typed actor `local-operator`, and
an operation timestamp. The handler
must verify every target belongs to the same Live session and is currently
`pending`; an empty selection is invalid. It transitions only selected records
to `confirmed`, writes `confirmedAt` from the persistence-generated canonical
commit timestamp, and appends one audit record per
decision (or a typed batch detail with every target) plus command evidence.

Partial confirmation leaves all untargeted records pending and keeps the
session `pending-confirmation`. When no pending records remain and at least one
winner is confirmed, the session transitions to `completed` atomically. A
duplicate command is idempotent; a second command against already confirmed
records is rejected as stale/no-op according to the approved API contract,
never duplicated.

## 10. Cancellation contract

Input: Live session, one or more pending WinnerRecord IDs, `commandId`, actor,
reason, optional note, and timestamp. The reason vocabulary must be explicit;
`other` requires a non-empty note. The actor is typed `local-operator`.
Cancellation changes status and
`cancelledAt` from the persistence-generated canonical commit timestamp,
retains the record, and appends immutable audit evidence. It
must not silently return a ticket to an eligible pool without the policy being
applied by the eligibility evaluator.

Cancellation of a confirmed record is not a normal cancel command. It is only
allowed as part of the audited redraw/replacement contract, preserving the
original record and its relationship to the replacement.

## 11. Redraw/replacement contract

The operator selects one or more eligible pending/confirmed originals, supplies
the mandatory Live reason, and confirms the destructive action. The redraw
service evaluates candidates from the original session's immutable candidate
snapshot, removes participants disallowed by current official history and
active rules, removes already-active winners in the same session, and selects
replacement records using the existing secure random source without
replacement. It must preserve exact ticket strings.

For each original, the atomic transaction must: validate expected status;
exclude the original from the same operation and all active slots in the
session; cancel the original with audited redraw context; append a distinct
pending replacement; append one `RedrawRecord` linking both IDs and reason;
append audit evidence; and resolve the session from the resulting statuses. A
confirmed-original redraw is a separate destructive command and atomically
moves `completed` to `pending-confirmation` when the replacement is pending.
Multiple redraws must not reuse a participant or ticket. Candidate selection is
transaction-scoped: no externally observable replacement is selected or
revealed before commit, and an aborted transaction exposes nothing. A failed
transaction leaves the original and replacement state unchanged.

The existing `RedrawRecord` shape is a useful foundation, but the current
repository enforces only same-session/relationship invariants and does not yet
provide the command-level workflow, candidate construction, or durable
idempotency required here. A cancelled original cannot be selected again in
the same replacement operation or occupy another active slot in the same
session; future-draw eligibility follows confirmed history and the configured
event/category rule.

## 12. Eligibility and duplicate-winner policy

- `confirmed` winners exclude a participant for `once-per-event` or
  `once-per-category` according to the active rule.
- Pending winners in an in-flight Live session remain disallowed for another
  Live draw; cancellation/replacement must recompute this decision from
  persisted state.
- A cancelled original cannot be selected again in the same replacement
  operation or occupy another active slot in the same session. It is not a
  confirmed win; future-draw eligibility follows confirmed history and the
  configured event/category rule, not deletion of the cancelled record.
- A replacement cannot use a participant/ticket already occupying an active
  slot in the same session, a confirmed disallowed winner, a missing/mismatched
  Participant, or a ticket outside the immutable candidate snapshot.
- Ticket identifiers remain strings: `00042` and `42` are distinct values and
  must never pass through numeric coercion.
- Capacity is checked before redraw. If no valid candidate remains, the
  command fails without cancelling the original or creating partial records.

## 13. Practice versus Live policy

Practice remains presentation-only and tab-scoped. It may show simulated
confirm/cancel/redraw screens only through clearly marked prototype behavior;
it must not call official WinnerRecord, DrawSession, RedrawRecord, audit, or
command-receipt persistence. Practice must not alter Live eligibility/history.

Only Live may execute Phase 8 mutation commands. UI labels, semantics,
confirmation text, and route/service boundaries must distinguish the modes
without relying on color alone. Audience projection must label Practice and
Live accurately and never treat Practice as official.

## 14. Persistence/schema analysis

Schema v2 can represent the basic result lifecycle already: WinnerRecord has
pending/confirmed/cancelled and timestamps; DrawSession has pending/completed/
cancelled; RedrawRecord stores reason and lineage; AuditRecord is append-only;
the existing stores are included in atomic Dexie transactions. It can therefore
represent the business facts of a single committed confirm/cancel/redraw.

Schema v2 does not durably represent a unique command identity, an idempotent
command outcome, or an unambiguous recovery receipt after a crash between UI
intent and transaction completion. Audit detail alone is not sufficient as a
unique indexed receipt, and checkpoint v2 is a presentation record, not a
mutation journal.

Owner decision: approve additive IndexedDB schema v3 with a mandatory,
narrowly scoped command receipt/idempotency store. The receipt persists command
ID, operation scope/payload fingerprint, status/outcome, persistence-generated
canonical commit timestamp, and typed actor (`local-operator`) so an
unknown/timeout retry can reconcile safely. Preserve all v1/v2 stores and
records; do not rewrite history. Define upgrade readback, duplicate-key,
interrupted-upgrade, and unsupported-version behavior before coding.

A persistent mutation-lock store is not required by default. First prove with
focused cross-tab race tests that transactional preconditions plus unique
command receipts prevent duplicate official effects. Add a lock store only if
those tests demonstrate that they are insufficient; that additive change
requires a new owner decision.

## 15. Recovery and crash-safety policy

- Refresh/reopen pending must read the same session and winners; it must never
  call selection or auto-submit a command.
- During `confirming`, `cancelling`, or redraw, the UI shows recovery/loading
  state and reloads command receipt plus authoritative records.
- A committed receipt returns the committed outcome; a missing receipt with
  unchanged expected statuses is retryable; conflicting statuses require
  reconciliation, not a blind retry.
- Receipt ownership is scoped to a session/operation. Crash recovery reconciles
  the receipt and authoritative records; it does not require a persistent lock
  unless cross-tab race tests prove receipts and transactional preconditions
  insufficient.
- Storage failure, quota failure, or transaction abort leaves official records
  unchanged and presents a safe retry/recovery action.
- Audience disconnect/reconnect cannot affect official persistence. Reconnect
  requests a fresh projection from Operator; ordering/epoch rules prevent stale
  decisions from being displayed.
- Existing Phase 6 orphan checkpoint behavior remains intact and is tested
  before exposing Phase 8 actions.

## 16. Export/history/backup boundaries

Phase 8 must write the facts required by current history: session ID, category,
prize, mode, eligible count/snapshot relationship, winner status/timestamps,
cancel reason, redraw lineage, and audit records. Existing `HistoryPage` and
repository read paths must be reconciled to show the new lifecycle accurately;
this is a Phase 8 requirement, not an optional follow-up.

Final export is explicitly defined by the PRD as confirmed results while
pending/cancelled evidence remains auditable. CSV/XLSX export and backup/restore
are outside Phase 8. History/read-model reconciliation is required in Phase 8:
history must accurately expose pending, confirmed, cancelled, replaced,
session-resolution, reason, lineage, actor, and canonical commit timestamp
facts without silently omitting or overwriting evidence.

## 17. Operator UI plan

Promote only `ProductionPendingResultsPage`; keep the fixture-driven
`/draw/results` prototype isolated. The production page should provide:

- authoritative session summary and pending/confirmed/cancelled/replaced
  counts;
- explicit selection for individual or all pending winners;
- confirm action with confirmation dialog and duplicate-submit disabled state;
- cancel/redraw action with required reason and `other` note validation;
- replacement eligibility/capacity information before commit; never preview
  the actual randomly selected replacement before persistence commits;
- safe loading, conflict, storage-failure, retry, and recovery states;
- visible Live/official language and no Participant/private data in Audience;
- no action that runs merely because the route loaded or refreshed.

The primary action should follow the current unresolved state. Destructive Live
actions require explicit confirmation. Buttons are affordances only; all
guards remain in the domain/application and persistence boundary.

## 18. Audience synchronization implications

Operator remains authoritative. A revealed but unresolved result is
`provisional/pending`; `confirmed` is published only after persistence commits.
Cancellation removes the cancelled ticket from the active public projection
only after commit. A replacement is published as pending only after its
WinnerRecord/RedrawRecord transaction commits. The public payload remains
ticket-only and must not expose Participant name, group, check-in, notes,
private identifiers, command IDs, or redraw reasons.

Projection failure, absent Audience, or BroadcastChannel disconnect must never
rollback or block official confirmation. The Operator may display a local
“Audience not connected” state and retry publication. Multiple Audience windows
must receive the same scoped ordered projection and cannot send mutation
commands.

## 19. Slice breakdown

### Slice 1 — Domain lifecycle and command contracts

Define state transitions, operation discriminated unions, reason validation,
completion rules, conflict/error taxonomy, and invariants. Add focused tests;
do not wire UI yet.

### Slice 2 — Schema v3 receipts and idempotency boundary

Implement the approved additive schema v3 mandatory command receipt store and
atomic transaction composition, with migration/readback/unsupported-version
tests. Add no persistent lock store unless focused cross-tab race tests prove
that unique receipts and transactional preconditions are insufficient.

### Slice 3 — Confirmation workflow

Implement all/individual confirmation, partial completion, duplicate command
behavior, audit evidence, and production service tests.

### Slice 4 — Cancellation workflow

Implement required cancellation policy, append-only history, session
completion/recovery, safe failures, and eligibility regression tests.

### Slice 5 — Redraw/replacement and eligibility

Implement secure replacement selection from the session snapshot, reason/note,
duplicate prevention, lineage, atomic rollback, and confirmed/cancelled/future
eligibility tests. Include confirmed-original redraw as a separate destructive
command; its committed pending replacement moves `completed` back to
`pending-confirmation`. Do not reveal the selected replacement before commit.

### Slice 6 — Production pending Operator route

Replace the read-only production placeholder with the real controller/query and
UI states, keeping `/draw/results` prototype-only. Add refresh, duplicate
submit, error, and accessibility tests.

### Slice 7 — Audience projection, recovery, and integrated acceptance

Publish committed decision outcomes through the existing public protocol,
verify reconnect/multiple windows/privacy/blackout behavior, exercise crash and
lock reconciliation, then run automated and manual acceptance. No Audience
mutation authority is added.

## 20. Dependency graph

`PRD + existing Phase 6/7 contracts`
→ `Slice 1 lifecycle/commands`
→ `owner-approved schema v3 receipts`
→ `Slice 2 command receipts`
→ `Slice 3 confirmation` and `Slice 4 cancellation`
→ `Slice 5 redraw + eligibility`
→ `Slice 6 production Operator route`
→ `Slice 7 Audience/recovery integration`
→ `combined automated + manual acceptance`

Phase 6 persistence, eligibility, checkpoint, and mutation-lock tests are
regression gates for every slice. Phase 7 protocol/projection/privacy tests are
regression gates for Slice 7. History/read-model reconciliation is a Phase 8
gate; CSV/XLSX export and backup/restore remain outside Phase 8.

## 21. Automated test strategy

- Domain transition tests: valid/invalid edges, pending-confirmation while any
  pending remains, completed resolution with at least one confirmed winner,
  all-cancelled resolution, completed → pending-confirmation during
  confirmed-original redraw, timestamps, reason/note, and exact invariants.
- Command tests: same-command retry, same-key payload conflict, stale
  precondition, duplicate targets, route-render non-execution, idempotent
  official effect, cross-tab commands using different command IDs, and retry
  after an unknown/timeout result.
- Persistence tests: atomic commit/rollback, schema v3 migration/readback,
  receipt recovery, persistence-generated canonical commit timestamps,
  `local-operator` actor, cross-tab race behavior, quota/error behavior, and no
  deleted audit evidence.
- Eligibility tests: previous confirmed winners, pending in-flight winners,
  cancelled originals, category/event rules, insufficient redraw capacity,
  duplicate participant/ticket prevention, and `00042` string preservation.
- Redraw tests: pending and confirmed-original policy, completed →
  pending-confirmation, reason required, original/replacement lineage, no
  duplicate replacement, cancelled original excluded from the same operation
  and active session slots, no externally observable replacement selection or
  reveal before commit, and failed transaction leaves original unchanged.
- React/route tests: production route only, explicit confirmations, partial
  statuses, refresh/reopen, loading/error/recovery, accessibility, and no
  prototype fixture leakage.
- Audience integration tests: committed-only projection, stale ordering,
  reconnect, multiple windows, blackout/privacy, and no mutation handling.

## 22. Automated acceptance matrix

| Area | Required automated evidence |
|---|---|
| Confirmation | All/individual/partial confirm; exact one effect under duplicate submit; pending targets only; audit records; completed only with zero pending and at least one confirmed |
| Cancellation | Required reason/note; append-only cancelled record; partial cancellation; idempotent retry; no silent deletion |
| Redraw | Valid pool and capacity; secure no-replacement selection; no active/confirmed-ineligible duplicate; cancelled original excluded; reason; lineage; atomic rollback; completed → pending-confirmation |
| Recovery | Refresh/crash/timeout in every command phase; receipt reconciliation; retry after unknown/timeout; cross-tab different command IDs; no reselection |
| Commit boundary | Replacement eligibility/capacity may be shown pre-commit; actual random selection is transaction-scoped and neither exposed nor revealed before commit |
| Authority/privacy | WinnerRecord/DrawSession remain authoritative; checkpoint has no winner/private payload; Audience cannot mutate; exact public fields only |
| Mode | Practice writes no official mutation; Live writes official transaction/audit; labels and route boundaries are explicit |
| Existing regression | Full Phase 6 and Phase 7 automated suites remain green, including exact tickets, presentation recovery, blackout, transport ordering, and privacy |
| Verification commands | `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test`, `npm.cmd run build`, `git diff --check` |

## 23. Manual integrated acceptance matrix

This matrix is a post-Phase-8 plan only; none of these checks are claimed as
run during this planning task. Execute in Chrome and Edge, with Operator and
Audience in same-origin separate windows:

- countdown → rolling → reveal → pending, then confirm;
- cancel pending result with each reason policy and verify history;
- redraw/replacement for one and multiple records, including lineage;
- refresh/reopen at pending, confirming, cancelling, and redraw states;
- duplicate-submit attempts, timeout/retry, receipt recovery, and cross-tab
  race behavior;
- blackout, Audience disconnect/reconnect, multiple Audience windows, and
  confirmed/cancelled/replacement projection;
- fullscreen enter/exit/denial and safe fallback;
- offline/local-first operation, storage failure messaging, and no network
  dependency;
- exact ticket rendering including leading zeroes and privacy inspection;
- Audience 1920×1080 layout and Operator 1440×900 layout;
- winner counts 1, 6, 10, 20, and larger supported counts;
- Phase 6 deferred valid-refresh, pending-refresh, orphan-recovery, and
  mutation-lock browser paths;
- Phase 7 deferred Chrome/Edge, same-origin windows, visual, fullscreen,
  reconnect, blackout, privacy, and multi-Audience paths;
- confirm that no route render, refresh, Audience event, or transport failure
  triggers selection or corrupts official persistence.

Record browser/version, viewport, seed/data identity, exact command sequence,
observed state, and evidence. Do not substitute automated evidence for these
manual rows.

## 24. Risks and rollback

Primary risks are receipt migration/idempotency gaps, partial writes, cross-tab
races, redraw selecting an ineligible participant, replacement leakage before
commit, ambiguous all-cancelled/completed resolution, and public projection
exposing private data. Mitigate with transaction-level preconditions, mandatory
additive v3 receipts, append-only audit, receipt reconciliation, candidate
revalidation, commit-gated replacement projection, and public projection tests.

Rollback must mean stopping the new command path and leaving v1/v2 data and
historical records intact. Do not downgrade an IndexedDB schema in place or
delete receipts/audit records to make a failed workflow look clean.
Unsupported-version behavior and backup/restore of test fixtures must be
documented before release; product backup/restore remains outside Phase 8.

## 25. Exit criteria

- Owner-approved command and authority contracts are implemented and reviewed.
- Schema v3 command receipts are implemented as additive mandatory persistence,
  with migration tests and an unsupported-version policy. No mutation-lock
  store exists unless separately justified by failing cross-tab race tests.
- Confirm/cancel/redraw are atomic, auditable, idempotent, and recovery-safe.
- Eligibility and duplicate prevention pass for all supported winner counts and
  exact string tickets.
- Practice/Live isolation and Audience privacy/projection invariants pass.
- Production pending route is actionable only through explicit Operator
  decisions; Audience remains read-only.
- Required automated verification passes with exact file/test counts recorded.
- Combined Phase 6/7 manual debt is run and accepted in Chrome and Edge.
- History/read-model reconciliation exposes cancelled and replacement lineage,
  resolution states, canonical commit timestamps, and actor. CSV/XLSX export
  and backup/restore remain outside Phase 8.

## 26. Approval gate

Before implementation, the owner has approved: existing
`pending-confirmation` while any WinnerRecord is pending; completed only when
zero pending and at least one confirmed; cancelled only when all are cancelled
with no pending/confirmed replacement; cancelled-original same-operation and
same-session exclusion; confirmed-original redraw as a separate destructive
command with completed → pending-confirmation; additive mandatory schema v3
command receipts; no persistent lock unless race tests require it; commit-gated
Audience semantics; Phase 8 history/read-model reconciliation; export and
backup/restore outside Phase 8; no pre-commit random replacement preview; and
persistence-generated canonical timestamps with `local-operator`. The gate
still requires implementation review of the detailed contracts and tests; no
slice may bypass it or silently convert a prototype control into an official
action.

## 27. Proposed commit sequence

1. `docs(phase8): finalize pending mutation workflow plan` — this revised plan
   only; the required planning deliverable.
2. `feat(phase8): add pending decision domain contracts` — Slice 1.
3. `feat(phase8): add schema v3 command receipts` — Slice 2; use the approved
   additive receipt store and add no persistent lock unless race tests require
   it.
4. `feat(phase8): persist idempotent confirmation workflow` — Slice 3.
5. `feat(phase8): persist audited cancellation workflow` — Slice 4.
6. `feat(phase8): add redraw replacement and eligibility guards` — Slice 5.
7. `feat(phase8): enable production pending result decisions` — Slice 6.
8. `test(phase8): close audience recovery and integrated acceptance` — Slice 7
   evidence and acceptance record.

For this planning task, only `docs/technical/PHASE-8-PLAN.md` may be committed.
