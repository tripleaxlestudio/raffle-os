# Phase 5 Acceptance Record

## Final verdict

**PHASE 5 PASSED WITH APPROVED EXCEPTIONS**

Automated Slice 7 coverage is passing. Microsoft Edge browser verification was
completed by Ismail on 2026-08-05. Chrome was not run; the project owner
approved a waiver because the operational event environment will use Microsoft
Edge. Chrome is not recorded as passed, and no Chrome result is inferred from
Edge, jsdom, or fake IndexedDB tests.

## Branch and baseline

| Field | Evidence |
|---|---|
| Repository | `C:\laragon\www\raffle-os` |
| Branch | `phase5/slice-7-integration-acceptance` |
| Baseline | `f4bac07b6c09185d45c8b25fa41491c3b9d197ad` |
| Slice 6 dependency | `ac1f74bf991083f94f399d526c300e66bab08272` is an ancestor of `HEAD` and `origin/main` |
| Worktree before Slice 7 | Clean |
| Remote fetch | `git fetch origin main --prune` could not write `.git/FETCH_HEAD`: Permission denied. Existing `origin/main` was read but remote freshness was not independently revalidated. |

## Scope implemented

Slice 7 adds production-boundary integration evidence for the persisted Live
flow, Practice isolation, rollback after random failure, exact ticket identity,
and deterministic performance measurement. No product feature or production
draw behavior was added.

### Automated evidence

- `phase-5-integration.test.ts` uses real repositories and fake IndexedDB to
  verify persisted Event, configuration, category, session, and Participants;
  candidate ordering; frozen snapshots; deterministic selection; pending
  winners; atomic session/snapshot/winner/audit persistence; close/reopen
  readback; duplicate execution rejection; Practice non-persistence; and
  random-source rollback.
- `phase-5-performance.test.ts` exercises a deterministic 10,000-Participant
  representative dataset with checked-in/unchecked records, three groups,
  confirmed and cancelled history, and exact `00042`/`42` tickets. It measures
  repository read, eligibility, ordering, snapshot freezing, selection for 1,
  20, 50, and 100 winners, and end-to-end command time.
- Existing Phase 5 tests cover the remaining rule, capacity, repository
  transaction, Draw Setup, prototype isolation, and privacy boundaries.

## Verification results

Latest authoritative automated result: 54 test files and 610 tests passed.
Lint, typecheck, build, and `git diff --check` passed. The build retained the
existing Vite warning about chunks larger than 500 kB.

## Complete-flow and rollback evidence

The real fake-IndexedDB integration test confirms a successful Live command
creates exactly one configuration snapshot, one complete candidate snapshot,
the exact pending winner records in selection order, a pending-confirmation
session, and one `draw-session-started` audit record. Closing and reopening the
database preserves those records. A second command against the same session is
rejected.

Practice uses the same eligibility, candidate, and selection services but does
not call official persistence; the session remains ready and no official
winner or audit records are created.

Random-source failure is verified to leave the ready session unchanged with no
snapshots, winners, or success audit. Existing persistence tests cover invalid
snapshots, relationship failures, duplicate/stale writes, winner-write
failures, and audit rollback.

## Exact tickets, rules, capacity, and isolation

`00042` and `42` remain distinct strings through candidate snapshots,
selection, WinnerRecords, persistence, reopen, and production result models.
Existing Phase 5 tests cover `once-per-event`, `once-per-category`,
`allow-repeat`, check-in, exact group filtering, confirmed/cancelled/pending
history, Practice/Live separation, and requested counts from 1 through 100,
including capacity boundaries and invalid counts.

Production Draw Setup reads persisted data through its application query.
Prototype route tests remain explicit and isolated; source-boundary tests
verify production modules do not import prototype fixtures. Audience-facing
types remain narrow and do not carry raw Participant objects, names, groups,
notes, check-in state, exclusion reasons, or candidate lists.

## Performance evidence

The measured Node/jsdom run used four measured runs after one warm-up. The
representative dataset contains 10,000 Participants, 6,666 checked-in
records, groups `VIP`, `Staff`, and `Public`, one confirmed and one cancelled
history record, and exact tickets `00042` and `42`.

Observed medians from the run were approximately:

| Stage | Median milliseconds |
|---|---:|
| Repository read double | 0.7 |
| Eligibility evaluation | 60.3 |
| Deterministic ordering/candidate build | 74.8 |
| Snapshot freeze observation | 0.0 |
| Selection: 1 winner | 1.2 |
| Selection: 20 winners | 1.3 |
| Selection: 50 winners | 1.7 |
| Selection: 100 winners | 2.1 |
| Complete command with in-memory persistence double | 80.1 |

These are algorithm measurements, not browser or IndexedDB measurements. A
real fake-IndexedDB 10,000-row seed did not complete within the available
two-minute test window, so no IndexedDB performance claim is made. The target
of under one second for final selection is not a universal guarantee and was
not enforced as a brittle threshold.

## Chrome verification matrix

Chrome was **NOT RUN**. The project owner approved this exception because the
operational event environment will use Microsoft Edge. This is a waiver, not a
Chrome pass and not an inference that Edge behavior is identical to Chrome.

| Check | Result |
|---|---|
| Production Draw Setup and all loading/error states | WAIVED — owner-approved Edge-only operation |
| Practice confirmation/result and no official writes | WAIVED — owner-approved Edge-only operation |
| Live confirmation, duplicate-submit prevention, 1/100 winners | WAIVED — owner-approved Edge-only operation |
| Exact `00042` versus `42`, refresh persistence, pending state | WAIVED — owner-approved Edge-only operation |
| Recoverable failure, prototype isolation, Participant regression | WAIVED — owner-approved Edge-only operation |
| Keyboard/modal, reduced motion, scrollbars, clipped action | WAIVED — owner-approved Edge-only operation |
| Audience privacy boundary | WAIVED — owner-approved Edge-only operation |

## Edge verification matrix

Reviewer: **Ismail**. Date: **2026-08-05**. Primary operational browser:
**Microsoft Edge 151.0.4129.59 (Official build) (64-bit)**.

| Check | Result |
|---|---|
| Production Draw Setup route and persisted Ready state | PASS |
| Eligibility and capacity display | PASS |
| Practice confirmation and execution | PASS |
| Practice result clearly non-official and no official draw state | PASS |
| Live mode selection and confirmation with requested/eligible counts | PASS |
| Official Live execution and pending winner rendering | PASS |
| Sequence/ticket separation and exact leading-zero preservation | PASS |
| Pending-confirmation persistence and page refresh/reopen | PASS |
| Duplicate execution blocking | PASS |
| Updated eligibility after pending winners | PASS |
| Prototype controls absent from production route | PASS |
| Responsive layout with no clipped primary action | PASS |
| No double scrollbar observed | PASS |

## Accessibility and inherited acceptance status

Automated component/source tests cover accessible labels, keyboard-oriented
confirmation behavior, production/prototype separation, and the absence of
raw Participant data from Audience-facing paths. Edge manual verification
passed the responsive layout, clipped-action, scrollbar, and pending-result
checks. Equivalent Chrome checks remain waived by the owner and are not claimed
as observed.

Phase 3 remains functionally/source tested but retains its documented pending
manual Chrome and Edge IndexedDB smoke checks. Phase 4 remains functionally
complete with partial browser acceptance and retains its documented Chrome
and cross-browser limitations. This Phase 5 record does not silently relabel
the Chrome waiver as a Chrome pass.

## Scope audit

Slice 7 introduced no package or lockfile changes, schema migration, backend,
cloud, authentication, payment, confirmation/rejection workflow,
redraw/replacement, Live animation, BroadcastChannel, Audience mutation,
fullscreen/audio, export, backup/restore, or interrupted-session recovery UI.
No production draw path contains `Math.random()`.

## Final checklist

- [x] Complete production-path integration coverage added.
- [x] Live atomic persistence, reopen, duplicate prevention, and rollback covered.
- [x] Practice isolation covered.
- [x] Exact ticket identity covered.
- [x] Rule/capacity/prototype/privacy coverage retained and exercised by the suite.
- [x] Deterministic 10,000-record algorithm evidence recorded with limitations.
- [x] Chrome exception explicitly recorded as an owner-approved waiver; Chrome is not marked passed.
- [x] Edge browser matrix observed and recorded for the operational browser.
- [x] Phase 5 final acceptance verdict recorded as passed with approved exceptions.

## Approval

| Role | Name | Date | Decision |
|---|---|---|---|
| Owner/reviewer | Ismail | 2026-08-05 | APPROVED — PHASE 5 PASSED WITH APPROVED EXCEPTIONS; Chrome waived for Edge-only operation |

## Slice 7 files changed

- `src/application/draw/phase-5-integration.test.ts`
- `src/application/draw/phase-5-performance.test.ts`
- `docs/technical/PHASE-5-ACCEPTANCE.md`

## Development-only browser seed procedure

This acceptance harness is development-only. It is not a Settings editor and it does not select winners or write official draw history.

1. Start the Vite development server: `npm run dev`.
2. Open the local URL in Chrome or Edge.
3. Open DevTools â†’ Console.
4. Run the reset explicitly:

   ```js
   await window.__raffleAcceptance.reset()
   ```

5. Seed the acceptance data:

   ```js
   await window.__raffleAcceptance.seed()
   ```

6. Inspect aggregate state:

   ```js
   await window.__raffleAcceptance.inspect()
   ```

7. Select the seeded Practice session and reload:

   ```js
   await window.__raffleAcceptance.usePractice()
   location.reload()
   ```

   Open `/draw/setup` and verify the production Practice Ready state.
8. Select the seeded Live session and reload:

   ```js
   await window.__raffleAcceptance.useLive()
   location.reload()
   ```

   Open `/draw/setup` and verify `Mode: Live draw`, the seeded Live ready session, and the Run Live action.
9. Use the normal production draw controls for subsequent manual verification. The helper does not expose random selection, winner creation, redraws, or official persistence.

`seed()` intentionally refuses to run until `reset()` has completed in the current page lifetime, and the underlying seed still refuses any non-empty database. The profile contains one active Event, one category, one configuration, six Participants, and ready Practice and Live sessions. It includes the distinct ticket strings `"00042"` and `"42"`, both checked-in and unchecked Participants, and multiple groups. Snapshots and official history stores start empty.

`usePractice()` and `useLive()` update only the persisted `lastOperatorMode` preference after validating the seeded active Event and the corresponding ready session. The console API is registered only when `import.meta.env.DEV` is true and is absent from production builds.
