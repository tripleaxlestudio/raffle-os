# Phase 8 Roadmap Mini-Audit

## Current position

- Branch: `feature/random-number-roll-slice-5`
- HEAD: `39aa8f3cc0ad588051c1d297fa0b9dda7f7ef27c`
- Worktree: clean
- Current main roadmap: Phase 8, Slice 14
- Active sub-slice: Slice 14C — Production Draw Run / presentation/operator work
- Verdict: **STAY ON PHASE 8 SLICE 14C**

Random Number Roll Slice 1–5 are feature sub-slices and do not represent Phase 8 Slice 1–5.

Phase 8 remains formally unaccepted. [`PHASE-8-ACCEPTANCE.md`](./PHASE-8-ACCEPTANCE.md) still records `PHASE 8 NOT YET ACCEPTED`; Chrome/Edge manual acceptance remains not run.

## Phase 8 completion map

| Main slice | Status |
|---|---|
| Slices 1–7 | Implemented and automated evidence recorded; manual acceptance remains open |
| Slice 8 — Production workspace and route authority | Implemented |
| Slice 9 — Event and PrizeCategory setup | Implemented |
| Slice 10 — Participant import as ordinary operation | Implemented |
| Slice 11 — Production draw queue and journey | Implemented |
| Slice 12 — Production History and decision navigation | Implemented |
| Slice 13 — Display configuration and Audience launch | Implemented, with remaining manual/browser verification |
| Slice 14 — Product-level deterministic setup and visual completion | In progress |
| Slice 14A — Settings/navigation/display | Substantially implemented |
| Slice 14B — Draw Setup refinement | Substantially implemented |
| Slice 14C — Production Draw Run/presentation/operator | Partially implemented; current active slice |
| Slice 14D | Not present in repository planning documents |
| Slice 15 — Automated integration closeout | Not started as a formal closeout |

The actual plan names only Slice 14 and Slice 15. 14A/14B/14C exist in Git history and branch naming, but 14D does not appear in the planning documents.

## Slice 14C matrix

| Planned item | Status | Evidence |
|---|---|---|
| Draw Run preflight / ready state | PARTIAL | `DrawRunPage` has persisted readiness validation, start gating, stale-session checks, storage/crypto checks, and blocked/error states. The richer composed preflight checklist described in the completion plan is not present. [`DrawRunPage.tsx`](../../src/pages/operator/DrawRunPage.tsx:70) |
| Practice/Live separation | DONE | Mode-specific badges, copy, persistence paths, Practice-only reset, and Live pending handoff exist in `ProductionDrawPresentation` and `DrawRunPage`. |
| Countdown | DONE | Controller-driven countdown, skip behavior, persisted presentation state, and Audience countdown projection exist. |
| Random Number Roll presentation | DONE | Presentation configuration, rolling metadata, deterministic Audience roll stage, and associated tests exist. [`ProductionDrawPresentation.tsx`](../../src/ui/operator/draw/ProductionDrawPresentation.tsx:121), [`RandomNumberRollStage.test.tsx`](../../src/ui/audience/RandomNumberRollStage.test.tsx) |
| Timed/manual stop | DONE | Timed completion and explicit `STOP & REVEAL` behavior are implemented. |
| Together/sequential reveal | DONE | Reveal mode is persisted/projected and covered by Audience winner/reveal tests. |
| Audience publisher state | DONE | Production publisher lifecycle, acknowledgement state, committed projection, blackout, reconnect, and publication-failure isolation are implemented. |
| Audience connectivity/readiness | PARTIAL | Connection status, display URL, acknowledgement, and diagnostics are visible. However, the full Draw Run readiness/preflight composition and browser validation remain incomplete. |
| Practice reset/re-run | DONE | Reset clears the Practice projection, republishes standby, and returns the session to ready state. |
| Safe/failure states | PARTIAL | Loading, blocked, stale, persistence, recovery, blackout, and publisher-failure paths exist. The broader product completion plan still requires stronger user-visible recovery coverage for missing Event/category/display configuration and storage failure. |
| Winner presentation | DONE | Operator and Audience reveal states display selected ticket strings and distinguish official versus rehearsal results. |
| Multi-winner layout | DONE | Audience winner layout logic and tests cover varying counts, including 1/6/10/20/50-oriented datasets. [`winner-layout.ts`](../../src/ui/audience/winner-layout.ts) |
| Audience draw/prize identity | DONE | Production public projection carries event/category/prize identity and the Audience header renders it. [`AudienceDrawHeader.tsx`](../../src/ui/audience/AudienceDrawHeader.tsx) |

## Work completed ahead of schedule or incidentally

The current HEAD already contains work that should not be scheduled again:

- Deterministic Phase 8 setup datasets, including exact tickets `00042` and `42`, winner-count matrix `1/6/10/20/50`, DisplayConfiguration, and lifecycle/history records. [`phase8-setup.ts`](../../src/infrastructure/persistence/seed/phase8-setup.ts)
- Production Event lifecycle persistence and related repository behavior.
- Production Event and PrizeCategory UI.
- Production Settings and DisplayConfiguration integration.
- Production Audience launch, connection testing, retained-state restore, late join, reconnect, and presence handling.
- Participant import refinements and production routing.
- Production History and Pending Results navigation.
- Random Number Roll setup, orchestration, deterministic rolling, timed/manual completion, reveal modes, and multi-winner Audience layouts.
- Production Draw Run common shell, Practice reset/re-run, countdown, rolling, reveal, blackout, and Audience status.

## Cleanup/finalization commits

- `d853570` — completed production Event lifecycle persistence and related repository/service consistency. This satisfied remaining Slice 9/setup persistence responsibilities and strengthened Slice 10/Draw Setup dependencies.
- `dd9b4c0` — normalized production operator workflows across navigation, Events, Prize Categories, History, Pending Results, Settings, participant import, and layout. This consolidated responsibilities from Slices 8–13 and earlier Slice 14A work.
- `39aa8f3` — finalized Audience rolling/reveal continuity, public projection, winner layouts, and Audience presentation behavior. This substantially satisfies 14C presentation responsibilities, but does not close the remaining preflight, recovery, and manual-acceptance gaps.

## Remaining blockers before closing 14C

1. Complete the Draw Run preflight/ready-state composition, including clear readiness categories and Audience readiness.
2. Finish user-visible safe recovery states for missing Event/category/display configuration, stale sessions, and storage failures.
3. Verify all target winner-count layouts and exact-ticket cases through the production journey, not only isolated tests.
4. Complete route/source leakage and production navigation checks required by Slice 14.
5. Preserve the outstanding Chrome/Edge manual acceptance gate.

## Recommended next main slice

The next planned slice is:

**Slice 15 — Automated integration closeout**

It should begin only after the remaining Slice 14C/14 completion blockers are resolved. Its dependencies are the completed production journey, deterministic setup datasets, route/source audits, persistence/recovery verification, Audience privacy/transport checks, and the full automated command evidence.

No new branch should be created yet. Once 14C is closed, the recommended branch name from clean HEAD `39aa8f3` is:

`phase8/slice-15-automated-integration-closeout`
