# Phase 5 — Eligibility, Candidate Pool, and Secure Draw Engine Implementation Plan

## 1. Executive summary

Phase 5 turns the existing typed domain and local-persistence foundation into a
production draw-start path. It will evaluate eligibility from persisted
Participants, construct and freeze a complete candidate-pool snapshot, select
one to 100 winners with a Web Crypto-backed unbiased algorithm, and atomically
persist a DrawSession transition, both snapshots, pending WinnerRecords, and a
draw-start AuditRecord.

The intended outcome is a trustworthy production draw engine that is usable by
the Operator through Draw Setup in Practice and Live modes. The result of a
draw is a set of pending winners; confirmation, cancellation, redraw, public
animation, and synchronization remain later workflows. No visual animation is
allowed to influence selection, and no official selection may use
`Math.random()`.

This plan is implementation work only. The plan itself does not implement any
Phase 5 source code.

## 2. Current repository baseline

The baseline was inspected after `git fetch origin main --prune` on 4 August
2026 in `C:\laragon\www\raffle-os`.

| Item | Verified value |
|---|---|
| Branch | `main` |
| `HEAD` | `90380aadcffb63f0e819bb2597e054be1f74dba0` |
| `origin/main` | `90380aadcffb63f0e819bb2597e054be1f74dba0` |
| HEAD/upstream relationship | Exact match |
| Working tree before this plan | Clean; `git status --short` produced no entries |
| Stack | React 19, React Router 7, TypeScript 6, Vite 8, Tailwind CSS 4, Vitest 4, Dexie 4.4.4 |
| Production dependencies | React, React DOM, React Router, Dexie, SheetJS CE 0.20.3 tarball |
| Test dependencies | Vitest 4, jsdom 29, Testing Library 16, jest-dom 7, user-event 14, fake-indexeddb 6.2.5 |
| Test count | 41 test files; 499 tests passed |
| Current UI boundary | `/participants` is production; Draw Setup and draw-related surfaces remain fixture-driven prototypes |
| Current persistence boundary | Version 1 IndexedDB schema, repositories, and draw-history transaction coordinator exist |
| Current Phase 5 behavior | Eligibility evaluation, candidate construction, secure selection, and production Draw Setup integration are not implemented |

The repository contains typed `Event`, `Participant`, `DrawConfiguration`,
`DrawSession`, `WinnerRecord`, and `AuditRecord` contracts. Ticket numbers are
represented by the branded `TicketNumber` string type. `DrawSession` already
has versioned configuration and candidate-pool snapshot fields, and the
existing `DrawPersistenceUnitOfWork.persistStartedDraw` coordinates snapshot
attachment, pending-winner insertion, session transition, and audit append.
The current `DrawSetupPage` imports `src/prototype/` fixtures and explicitly
states that its values are not saved, filtered, validated, or official.

The baseline verification results were:

| Command | Exit code | Result |
|---|---:|---|
| `git fetch origin main --prune` | 0 | `origin/main` updated; exact match with `HEAD` |
| `npm.cmd run lint` | 0 | ESLint passed with no diagnostics |
| `npm.cmd run typecheck` | 0 | `tsc -b` passed under strict TypeScript |
| `npm.cmd run test` | 0 | 41 files passed; 499 tests passed; Vitest duration 66.29s |
| `npm.cmd run build` | 0 | TypeScript/Vite build passed; 131 modules transformed |
| `git diff --check` | 0 | Passed |

The build retains the existing Vite warning for chunks above 500 kB. This is a
known follow-up and is not a Phase 5 dependency decision.

## 3. Dependencies and unresolved acceptance gates

### 3.1 Phase 3 dependency

Phase 5 depends on Phase 3's production contracts and persistence foundation:

- event-scoped Participants and exact string tickets;
- draw configuration and winning-rule types;
- DrawSession lifecycle and snapshot invariants;
- WinnerRecord sequence and relationship invariants;
- append-only AuditRecord policy;
- IndexedDB repositories and schema migrations; and
- `DrawPersistenceUnitOfWork` with rollback-capable cross-store transactions.

The historical Phase 3 acceptance record is **partially complete** because its
required manual IndexedDB smoke procedure was not run in Chrome or Edge. Its
automated/source acceptance passed. Phase 4 supplied Microsoft Edge import
evidence, but the Phase 3 gate must not be silently relabeled as complete. The
Phase 5 implementation must preserve and rerun the smoke procedure as part of
browser acceptance, or record an explicit owner-approved disposition.

### 3.2 Phase 4 dependency

Phase 5 consumes only Participants that have already passed the production
import pipeline and are persisted for the active Event. Phase 4 is recorded as
**functionally complete with partial browser acceptance**: bounded CSV/XLSX
staging, mapping, validation, atomic Replace/Merge persistence, audit append,
and Edge evidence are present; Chrome was not run and was waived for route
promotion, while the post-promotion Edge regression was not independently
evidenced.

Phase 5 must not compensate for unresolved import acceptance by accepting raw
files, prototype rows, invalid drafts, or an ad hoc participant source. Its
candidate builder reads persisted `Participant` records through the repository
boundary and must treat import validation and event-scoped uniqueness as
upstream prerequisites.

### 3.3 Requirements status and conflicts

The PRD is marked a draft for validation, but the repository's accepted phase
records and `AGENTS.md` provide consistent engineering invariants for this
plan. No direct requirement conflict was found. Product-owner approval is
still required for the open decisions in Section 17, especially the exact
meaning of “previously confirmed or otherwise disallowed” under each winning
rule and whether a failed draw attempt receives a failed audit record.

## 4. Phase 5 scope

### 4.1 In scope

- Pure eligibility contracts and rule evaluation.
- Event ownership and active configuration validation.
- Practice versus Live eligibility isolation.
- `requireCheckIn`, `eligibleGroupFilter`, and `winningRule` behavior.
- Exclusion of previously confirmed or otherwise disallowed winners.
- Candidate construction from persisted Participants.
- Stable deterministic ordering before randomization.
- Complete immutable candidate-pool snapshots.
- Snapshot/configuration consistency and freeze validation.
- Injectable random-source abstraction.
- Web Crypto `crypto.getRandomValues()` production randomness.
- Rejection-sampled bounded random integers.
- Fisher–Yates or equivalent unbiased without-replacement selection.
- Selection of 1–100 unique winners with immutable 1-based sequence numbers.
- Clear insufficient-capacity failure.
- Pending WinnerRecord creation only.
- Atomic draw-start persistence and rollback.
- Production Draw Setup integration and required UI states.
- Unit, integration, persistence, component, performance, and browser tests.

### 4.2 Explicitly out of scope

Phase 5 does not implement winner confirmation or rejection; redraw execution
or replacement workflows; Live countdown, rolling, reveal, or result animation;
BroadcastChannel synchronization; Audience Display production mutation;
fullscreen or audio behavior; export; backup/restore; interrupted-session
recovery UI; backend; cloud sync; authentication; or payments.

Practice draws must not write official history or change Live eligibility. Live
draws create pending records and a start audit entry, but do not confirm a
winner, cancel a winner, perform a redraw, or publish a public result.

## 5. Domain and application contracts

The implementation should reuse existing types where their invariants match,
and extend them only through a deliberate versioned contract change. The
following contracts are the minimum target; names may be adjusted if the
boundaries remain equivalent and typed.

```ts
type EligibilityExclusionReason =
  | 'wrong-event'
  | 'not-checked-in'
  | 'group-filter-mismatch'
  | 'previously-confirmed-winner'
  | 'otherwise-disallowed-winner'
  | 'invalid-participant'

interface EligibilityDecision {
  readonly participantId: ParticipantId
  readonly ticketNumber: TicketNumber
  readonly eligible: boolean
  readonly exclusionReasons: readonly EligibilityExclusionReason[]
}

interface EligibilityResult {
  readonly eventId: EventId
  readonly configurationId: DrawConfigurationId
  readonly mode: AppMode
  readonly decisions: readonly EligibilityDecision[]
  readonly eligibleEntries: readonly CandidatePoolSnapshotEntry[]
  readonly excludedCount: number
}

interface RandomSource {
  nextUint32(): number
}
```

The final types must make it impossible to confuse an event-scoped
`ParticipantId` or `TicketNumber`, must return typed failures rather than
throwing unclassified values, and must preserve exclusion reasons for operator
diagnostics. A candidate snapshot is not an eligibility count: it must include
the exact ordered entries used for selection, the event/configuration context,
mode, active rules, capture time, format version, and eligible count.

## 6. Eligibility rules and policy

Eligibility is a pure application/domain operation over an explicit Event,
DrawConfiguration, mode, prior winner state, and persisted Participant set. It
must not read React state, prototype fixtures, mutable page values, or perform
randomness.

### 6.1 Event ownership

The active Event, DrawConfiguration, PrizeCategory, prior WinnerRecords, and
Participants must agree on their event ownership. A Participant whose
`eventId` differs from the active Event is excluded with `wrong-event`; it is
never merely filtered by a page-level query. A configuration or category from
another Event is a typed relationship failure, not an empty pool. The builder
must verify the active Event and configuration exist and that the selected
configuration belongs to that Event before producing a ready result.

### 6.2 Practice and Live mode

The evaluator receives `mode` explicitly. Live mode considers confirmed
official winner history according to the configured winning rule. Practice mode
may calculate a rehearsal pool for the same Event and current configuration,
but it must not mutate official winner history, mark winners confirmed, or
cause future Live eligibility to exclude rehearsal selections. Practice
selection may persist only an explicitly non-official practice artifact if a
later phase approves one; this phase persists no official Practice draw.

### 6.3 Check-in and group filtering

If `requireCheckIn` is true, `Participant.isCheckedIn` must be true; otherwise
the participant receives `not-checked-in`. If `eligibleGroupFilter` is null,
no group restriction applies. If it is non-null, eligibility requires an exact
match against the persisted Participant group according to the approved
normalization policy. A missing group must not match a non-null filter and is
reported as `group-filter-mismatch`.

### 6.4 Winning rules and prior winners

The evaluator must apply the configuration's `winningRule` to official
WinnerRecords:

| Rule | Required exclusion |
|---|---|
| `once-per-event` | A participant with a confirmed winner in the Event is excluded from every later Live pool in that Event. |
| `once-per-category` | A participant with a confirmed winner in the selected PrizeCategory is excluded from later Live pools for that category, but may remain eligible for another category. |
| `allow-repeat` | Prior confirmed wins do not exclude the participant unless another explicit disqualification applies. |

Pending winners from the current or another unconfirmed session are not
confirmed history. They must nevertheless be treated as “otherwise disallowed”
when they would permit the same participant to be selected concurrently or
re-enter the same active DrawSession. The implementation must define this
without weakening the rule above: no participant may appear twice in one draw,
and a stale/active session relationship must fail safely rather than silently
selecting an in-flight participant.

Cancelled winners remain history records but do not count as confirmed wins
for `once-per-event` or `once-per-category`; the future redraw workflow will
decide how a cancelled record affects replacement eligibility. Duplicate or
corrupt official winner records are a data-integrity failure, not a reason to
silently choose a different rule.

### 6.5 Exact string handling

`"00042"` must remain distinct from `"42"` through repository reads, rule
evaluation, candidate snapshots, selection, WinnerRecords, UI, and later
history. No numeric conversion, sorting as numbers, trimming that changes the
identifier, invented zero padding, or locale formatting may occur. Stable
ordering must compare ticket strings as strings under the documented ordering
policy, with `participantId` as a deterministic tie-breaker.

## 7. The seven implementation slices

### Slice 1 — Eligibility Contracts and Rules

Define the typed eligibility input, output, exclusion reasons, typed failure
codes, and winning-rule policy. Implement a pure evaluator that accepts an
explicit Event, DrawConfiguration, mode, persisted Participants, and relevant
WinnerRecords. Validate event ownership, check-in, exact group filtering,
invalid participant data, and previous-win behavior. Return every decision or a
deliberately bounded diagnostic projection so the Operator can explain why a
pool is smaller.

Add tests for each rule, combinations of rules, all three winning rules,
confirmed versus pending versus cancelled winners, Practice isolation, event
cross-contamination, missing groups, and `00042`/`42`. Do not add selection or
persistence logic to this slice.

### Slice 2 — Candidate Pool Builder and Immutable Snapshot

Build candidates exclusively from the persisted Participant repository for the
active Event. Apply the pure evaluator, order eligible entries deterministically
by the agreed string-safe key, and construct the complete
`CandidatePoolSnapshot`. The snapshot must contain all candidate entries, not
only an eligible count, plus format version, capture time, mode/rule context,
and the configuration relationship needed for later validation.

Validate non-empty and unique participant/ticket identity, exact source
correspondence, event ownership, rule consistency, and capacity before the
snapshot leaves the application layer. Deep-freeze the in-memory snapshot and
its entry array before selection; serialize a value-equivalent immutable
record for persistence. The selection service must accept only this frozen
snapshot and must never reconstruct candidates from mutable Participants.

Add tests proving deterministic order, deep immutability, full entry capture,
leading-zero preservation, invalid source rejection, and capacity failures.

### Slice 3 — Secure Random Source and Fisher–Yates Shuffle

Define a small `RandomSource` port. The production adapter must use
`crypto.getRandomValues()` and return unsigned 32-bit values. Do not use
`Math.random()` anywhere in the production draw path, including helpers,
fallbacks, UI handlers, or test-only code imported by production modules.

Implement bounded integer generation with rejection sampling. For an exclusive
upper bound `n`, reject random values in the incomplete high range of the
32-bit domain and retry until a value below the largest divisible limit is
received; then return `value % n`. Reject invalid bounds and avoid modulo bias.
Use a Fisher–Yates shuffle or an equivalent without-replacement algorithm over
the frozen candidate entries.

Tests must use deterministic `RandomSource` doubles to verify bounds,
rejection behavior, shuffle output, and duplicate prevention. They must not
attempt to prove cryptographic randomness statistically. Add a source review or
static test that fails if production draw modules import or call
`Math.random()`.

### Slice 4 — Winner Selection Engine

Implement a pure selection service that accepts a validated frozen snapshot,
requested winner count from the matching configuration snapshot, and an
injectable random source. Support 1–100 winners. Fail before selection if
`requestedWinners` is outside that range, is not an integer, or exceeds the
snapshot capacity. Return exactly the selected entries in the random selection
order, with no duplicate participant or ticket.

Create pending `WinnerRecord` values only. Assign immutable contiguous
`sequenceNumber` values `1..requestedWinners` in final selection order. Preserve
the exact Participant ID and TicketNumber from the snapshot. Do not confirm,
cancel, redraw, animate, broadcast, or mutate existing official history here.

Test deterministic vectors, count boundaries 1 and 100, insufficient capacity,
duplicate source entries, duplicate prevention, sequence numbering, exact
ticket strings, and the guarantee that every selected entry belongs to the
frozen snapshot.

### Slice 5 — Draw Command and Atomic Persistence

Create an application command that loads and validates the active Event,
configuration, category, Participants, prior winner state, and a ready
DrawSession. It must evaluate eligibility, build and freeze the snapshot,
validate configuration/snapshot consistency, select winners, create pending
WinnerRecords, and prepare a `draw-session-started` AuditRecord before calling
the persistence boundary.

Reuse or minimally extend the existing `DrawPersistenceUnitOfWork`; keep all
eligibility and selection logic outside repositories and Dexie transactions.
The atomic write must include:

- the ready-to-drawing/pending-confirmation DrawSession state transition;
- the immutable configuration snapshot;
- the complete candidate-pool snapshot;
- every pending WinnerRecord with contiguous unique sequences; and
- the append-only AuditRecord with Event, session, mode, rule, capacity, and
  snapshot metadata sufficient to explain the start.

Before writing, recheck relationships, expected session status, capacity,
winner uniqueness, candidate membership, exact ticket correspondence, audit
ownership, and snapshot immutability/value validity. Any relationship,
capacity, uniqueness, audit, or persistence failure must roll back every write,
leaving the session ready, without partial snapshots, winners, or a success
audit. Normalize failures to recoverable typed application errors.

Practice must have an explicit non-official persistence path or remain
in-memory; it must never call the official Live transaction with records that
could affect Live eligibility or official history. The first implementation
should prefer no official persistence for Practice unless product approval
requires a local rehearsal record.

### Slice 6 — Draw Setup Production Integration

Replace the fixture-driven Draw Setup behavior with a production application
adapter and Operator view model. Remove production reliance on
`src/prototype/`; prototype routes and fixtures remain available only for the
explicit static-prototype scenarios. Keep the draw engine independent of React.

The page must expose one clear primary action, show the active Event and
configuration identity, preserve exact string counts/labels, and require an
explicit confirmation for Live. Required states are:

| State | Required behavior |
|---|---|
| Loading | Show that Event/configuration/Participants are being read; disable execution. |
| No active Event | Explain how to create/select an Event; no draw action. |
| No configuration | Explain that Draw Setup must be completed; no draw action. |
| No Participants | Explain that valid Participants must be imported for this Event; no draw action. |
| Insufficient candidates | Show requested versus eligible capacity and exclusion summary; block start. |
| Ready | Show mode, rule summary, eligible count, and the single start action. |
| Practice confirmation | Identify rehearsal-only behavior and no official-history mutation. |
| Live confirmation | Require explicit confirmation/hold-to-start and show the immutable snapshot intent. |
| Execution in progress | Prevent duplicate submission and show that selection/persistence is in progress. |
| Success with pending winners | Show pending status and sequence-ordered tickets to the Operator; direct to later verification. |
| Recoverable failure | Show a safe error, preserve existing data, allow retry, and do not imply a draw occurred. |

No raw Participant object, name, group, notes, check-in state, exclusion
reason, or candidate list may be sent to the Audience interface. Phase 5 may
return only the pending operator result; public display mutation remains out of
scope.

### Slice 7 — Integration, Performance, and Acceptance

Connect the full production path using persisted fixtures and realistic
repositories. Verify that a Live draw creates one session transition, complete
snapshots, pending winners, and one audit record atomically, and that a failed
operation leaves no partial state. Verify Practice isolation and prototype
scope isolation.

Measure candidate construction and selection separately from UI animation on a
representative laptop with 10,000 Participants and up to 100 winners. Record
dataset shape, browser/version, timing method, and memory observations. The PRD
target is under one second for final selection of up to 100 winners, excluding
animation; no cryptographic-certification or universal performance guarantee
should be claimed.

Complete the acceptance record only after automated checks and the manual
Chrome/Edge matrix in Section 13 are recorded. Update the roadmap only after
all applicable gates pass; do not declare Phase 5 complete merely because unit
tests pass.

## 8. Proposed directory and module structure

Names are proposed targets; files are not claimed to exist until implemented.

```text
src/application/eligibility/
  eligibility.types.ts
  eligibility-errors.ts
  eligibility-evaluator.ts
  eligibility-evaluator.test.ts

src/application/draw/
  candidate-pool.types.ts
  candidate-pool-builder.ts
  candidate-pool-builder.test.ts
  random-source.ts
  secure-random-source.ts
  bounded-random-integer.ts
  bounded-random-integer.test.ts
  fisher-yates.ts
  fisher-yates.test.ts
  winner-selection.ts
  winner-selection.test.ts
  draw-command.ts
  draw-command.test.ts

src/application/persistence/
  draw-persistence-unit-of-work.interface.ts  # extend only if required

src/infrastructure/random/
  web-crypto-random-source.ts

src/ui/operator/draw/
  DrawSetupProduction.tsx
  draw-setup-view-model.ts
  draw-setup-view-model.test.ts
```

Repositories should gain only the narrow reads needed for active Event,
Participants, configuration, category, and winner history. The random adapter
must not be placed in a repository. The Draw command is the composition point;
React should call the command through a typed service and render its state.

## 9. Persistence and transaction design

The command must treat the frozen snapshots as the sole selection input. It
must not re-read mutable Participants between selection and WinnerRecord
creation, and an official draw must always be explainable from its persisted
configuration and candidate snapshots rather than reconstructed from current
Participant rows.

The existing `persistStartedDraw` transaction is the preferred boundary. It
must be confirmed or extended to enforce all of the following inside the
transaction while retaining application-level preflight checks:

1. the session exists, belongs to the active Event, is `ready`, and has no
   attached snapshots;
2. both snapshots are complete, format-compatible, internally consistent, and
   related to the session configuration;
3. every WinnerRecord belongs to the session Event/category, has a unique
   Participant/ticket pair, has a sequence in `1..requestedWinners`, and is a
   member of the snapshot;
4. the winner count equals `requestedWinners` and capacity was sufficient;
5. the audit action and Event ownership are correct; and
6. all writes occur in one Dexie transaction and any error aborts all writes.

The persistence layer owns storage atomicity and relationship enforcement; it
does not own eligibility, random selection, ordering policy, or UI behavior.
The application command owns orchestration and typed failure mapping. Never
claim that an uncommitted command was drawn, and never append a success audit
after a failed transaction.

## 10. Testing strategy

### Unit tests

Cover eligibility decisions and exclusion reasons; all winning rules; mode
isolation; deterministic ordering; snapshot completeness and freezing; ticket
string identity; random bounds and rejection; Fisher–Yates without replacement;
1/100 winner boundaries; capacity errors; sequence numbers; and pending-only
WinnerRecords. Use deterministic random-source doubles, not statistical
randomness tests.

### Integration tests

Exercise the command with repository doubles and real domain fixtures. Verify
active Event ownership, configuration mismatch, prior winner filtering,
Practice isolation, Live result preparation, retry-safe errors, and that the
selection input is the frozen snapshot rather than a post-build Participant
mutation.

### Persistence tests

Using fake IndexedDB, verify valid atomic start, exact snapshots after reopen,
leading-zero round trips, duplicate and relationship rejection, stale session
rejection, insufficient capacity rejection, audit validation, and complete
rollback after failures in each write stage. Verify no partial winner or audit
record remains.

### Component tests

Cover all Draw Setup states, accessible labels, mode distinction without
color-only meaning, confirmation semantics, disabled duplicate submission,
retry after recoverable failure, exact requested/eligible counts, pending
winner display, and absence of raw Participant details in Audience payloads.

### Real-browser tests

Run the production route in current desktop Chrome and Edge with a clean local
profile. Verify IndexedDB open/read/write/reopen, persisted Participant reads,
Practice no-history behavior, Live pending result persistence, refresh after a
pending result, and safe failure behavior. Browser success must be observed,
versioned, and recorded; jsdom/fake-indexeddb cannot substitute for it.

## 11. Performance verification

Create deterministic persisted datasets containing at least 10,000 Participants
with a mixture of checked-in states, groups, previous winners, and exact
leading-zero tickets. Measure:

- repository read time;
- eligibility evaluation time;
- snapshot construction and deep-freeze time;
- secure selection time for 1, 20, 50, and 100 winners;
- transaction commit time; and
- end-to-end command time excluding presentation animation.

Repeat in Chrome and Edge, record machine/browser versions, and use a warm and
cold browser run where practical. Confirm that candidate memory is bounded by
the dataset and that the algorithm does not allocate an unbounded retry loop.
The target remains the PRD's under-one-second final-selection metric on a
typical event laptop; report measurements and limitations rather than claiming
cryptographic certification, legal audit certification, or mathematical proof
of fairness.

## 12. Manual Chrome and Edge verification matrix

Record exact browser versions, OS, date, reviewer, database/profile used, and
results. “Pass” requires observing the behavior in that browser.

| Check | Google Chrome | Microsoft Edge |
|---|---|---|
| Active Event/configuration load | NOT RUN | NOT RUN |
| No active Event/configuration/Participants states | NOT RUN | NOT RUN |
| Eligibility filters and exclusion explanation | NOT RUN | NOT RUN |
| Exact `00042` versus `42` display and persistence | NOT RUN | NOT RUN |
| Practice capacity and no official-history mutation | NOT RUN | NOT RUN |
| Live confirmation and duplicate-submit blocking | NOT RUN | NOT RUN |
| Live selection of 1 winner | NOT RUN | NOT RUN |
| Live selection of 100 winners | NOT RUN | NOT RUN |
| Pending winners survive refresh | NOT RUN | NOT RUN |
| Insufficient-candidate blocking | NOT RUN | NOT RUN |
| Recoverable failure leaves no partial records | NOT RUN | NOT RUN |
| Audience receives no raw Participant details | NOT RUN | NOT RUN |
| 10,000-Participant performance observation | NOT RUN | NOT RUN |

The existing Phase 3 and Phase 4 browser limitations must be linked in the
acceptance record rather than silently treated as Phase 5 passes.

## 13. Acceptance checklist

- [ ] Eligibility is a pure typed service with explicit exclusion reasons.
- [ ] Event, configuration, category, Participant, and winner ownership is
  validated before a pool is ready.
- [ ] `requireCheckIn`, exact group filtering, and all `winningRule` values are
  covered by tests and UI evidence.
- [ ] Confirmed prior winners are excluded according to rule; pending and
  cancelled semantics are documented and tested.
- [ ] Practice never changes Live eligibility or official history.
- [ ] Candidate construction reads persisted Participants for the active Event.
- [ ] Ticket identifiers remain exact strings, including distinct `00042` and
  `42`.
- [ ] Candidate ordering is deterministic before randomization.
- [ ] The snapshot contains the complete candidate entry list and is validated,
  deep-frozen, versioned, and persisted immutably.
- [ ] Selection uses only the frozen snapshot.
- [ ] Production randomness uses `crypto.getRandomValues()` through an
  injectable random-source interface.
- [ ] Bounded integers use rejection sampling; no production draw path calls
  `Math.random()`.
- [ ] Fisher–Yates or an equivalent unbiased without-replacement algorithm is
  tested for bounds and duplicate prevention.
- [ ] Requests from 1 through 100 winners work; insufficient capacity fails
  clearly before persistence.
- [ ] WinnerRecords are pending only and have immutable 1-based sequence order.
- [ ] Live start atomically persists session state, configuration snapshot,
  candidate snapshot, pending winners, and a start audit record.
- [ ] Relationship, capacity, uniqueness, audit, and persistence failures roll
  back completely.
- [ ] Draw Setup production integration implements every required state.
- [ ] No production behavior imports or uses `src/prototype/` fixtures.
- [ ] No raw Participant details reach the Audience interface.
- [ ] Unit, integration, persistence, component, and browser checks pass or
  have a recorded, approved exception.
- [ ] 10,000-Participant performance evidence is recorded.
- [ ] No claim of cryptographic certification, legal audit certification, or
  mathematical proof of fairness is made.

## 14. Risks and open questions

### Risks

- Ambiguous semantics for pending winners from concurrent or stale sessions
  could either permit an unintended repeat or block too much capacity.
- Deep-freezing large snapshots may add measurable allocation and memory cost.
- IndexedDB transaction behavior and storage limits remain browser-dependent.
- `crypto.getRandomValues()` availability/error handling must remain explicit in
  supported browsers; a silent non-crypto fallback is unacceptable.
- The current draw persistence contract was designed for synthetic records;
  Phase 5 must avoid widening it into a selection service.
- The existing Vite chunk warning and SheetJS audit/provenance limitations may
  affect browser performance, although neither is a draw-algorithm dependency.
- Chrome and some post-promotion Edge evidence remain incomplete from earlier
  phases.

### Decisions requiring approval

1. Confirm whether cancelled winners are eligible again under both
   `once-per-event` and `once-per-category` (this plan assumes they are not
   confirmed wins, but they remain explicit history).
2. Confirm the exact policy for pending winners belonging to another active or
   stale session.
3. Approve the deterministic candidate ordering key and group-match
   normalization policy.
4. Decide whether Practice results are memory-only or receive a separate,
   non-official local record; official history must remain unchanged either
   way.
5. Confirm whether failed Live draw attempts append a typed failed-attempt
   audit record or remain diagnostic-only; no success audit may be written.
6. Confirm the event-laptop definition and timing threshold for the PRD's
   under-one-second selection target.

## 15. Recommended immediate next task

Begin with **Phase 5 Slice 1 — Eligibility Contracts and Rules**. Resolve the
winning-rule and pending/cancelled semantics in the typed contract first, then
implement the pure evaluator and its focused tests without touching Draw Setup,
randomness, or persistence orchestration.

### Draft prompt for Phase 5 Slice 1

> Implement Phase 5 Slice 1 for Raffle OS: Eligibility Contracts and Rules.
> Before editing, read `AGENTS.md`, `TASKS.md`, `README.md`,
> `docs/product/PRD.md`, `docs/technical/PHASE-3-PLAN.md`,
> `docs/technical/PHASE-3-ACCEPTANCE.md`, `docs/technical/PHASE-4-PLAN.md`,
> `docs/technical/PHASE-4-ACCEPTANCE.md`, and
> `docs/technical/PHASE-5-PLAN.md`. Inspect the current domain and repository
> contracts. Define typed eligibility inputs/results, exclusion reasons, and
> typed failures. Implement a pure evaluator for Event ownership,
> `requireCheckIn`, exact `eligibleGroupFilter`, `once-per-event`,
> `once-per-category`, `allow-repeat`, and Practice/Live isolation. Preserve
> TicketNumber strings exactly, including `00042` versus `42`. Do not add
> randomness, candidate snapshots, persistence writes, Draw Setup integration,
> confirmation, redraw, Audience synchronization, or prototype imports. Add
> focused unit tests for every rule and edge case. Run lint, typecheck, tests,
> build, and `git diff --check`. Modify only the approved Slice 1 source/test
> files and report all assumptions and unresolved decisions.

## 16. Change-control record

This document is the only intended file change for the Phase 5 planning task.
No Phase 5 source code, tests, package file, dependency, previous phase
document, roadmap, commit, or push is part of this task.

