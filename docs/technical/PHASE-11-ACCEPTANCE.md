# Phase 11 Acceptance and PRD Evidence Index

## Status

**BASELINE INDEX — PHASE 11 NOT YET ACCEPTED**

Statuses in this file mean:

- `INHERITED-AUTO`: relevant historical automated/source evidence exists but
  must be rerun on the final candidate;
- `MANUAL-PENDING`: required browser/device observation has not been recorded;
- `GAP`: implementation or required evidence is absent; and
- `PASS`: reserved for current, identified evidence on the applicable build.

No row is marked PASS by assumption.

## PRD acceptance evidence index

| Acceptance ID | Baseline status | Evidence and remaining Phase 11 action |
|---|---|---|
| AC-EVT-001 | MANUAL-PENDING | Phase 3 repositories and tests exist; execute B11-001 in both browsers |
| AC-EVT-002 | GAP | Full offline journey and packaged offline launch remain unproved; B11-023/B11-024 |
| AC-EVT-003 | INHERITED-AUTO | Phase 3 schema/repository evidence; rerun and inspect localStorage/IndexedDB in B11-001 |
| AC-EVT-004 | INHERITED-AUTO + MANUAL-PENDING | Phase 10 A-I tests; execute B11-008/B11-018 |
| AC-IMP-001 | INHERITED-AUTO + MANUAL-PENDING | Phase 4 parser/mapping evidence; execute B11-003/B11-004 |
| AC-IMP-002 | INHERITED-AUTO + MANUAL-PENDING | Import/draw/history/export tests preserve strings; perform browser round-trip in B11-003/B11-004/B11-017 |
| AC-IMP-003 | INHERITED-AUTO | Import staging/validation tests; rerun candidate suite and observe B11-003/B11-004 |
| AC-IMP-004 | INHERITED-AUTO | Validation and candidate-pool tests; rerun focused suites |
| AC-IMP-005 | INHERITED-AUTO + MANUAL-PENDING | Atomic Replace tests; execute B11-005 |
| AC-IMP-006 | INHERITED-AUTO + MANUAL-PENDING | Atomic Merge/uniqueness tests; execute B11-005 |
| AC-IMP-007 | INHERITED-AUTO + MANUAL-PENDING | Mapping tests; execute representative B11-003/B11-004 files |
| AC-DRW-001 | INHERITED-AUTO | Draw authoring/readiness and UI tests; rerun candidate suite |
| AC-DRW-002 | INHERITED-AUTO | Eligibility/readiness query and Draw Setup UI tests |
| AC-DRW-003 | INHERITED-AUTO | Eligibility evaluator tests cover check-in |
| AC-DRW-004 | INHERITED-AUTO | Draw readiness/preflight and setup UI tests |
| AC-DRW-005 | INHERITED-AUTO | Eligibility and integration tests cover once-per-event |
| AC-DRW-006 | INHERITED-AUTO | Eligibility tests cover repeat and once-per-category rules |
| AC-RNG-001 | INHERITED-AUTO | Web Crypto adapter and random-source prohibition tests; repeat source audit |
| AC-RNG-002 | INHERITED-AUTO | Bounded random integer rejection tests |
| AC-RNG-003 | INHERITED-AUTO | Winner selection/Fisher-Yates tests prevent duplicates |
| AC-RNG-004 | INHERITED-AUTO | Candidate snapshot and winner-selection tests |
| AC-RNG-005 | INHERITED-AUTO | Presentation workflow/projection evidence keeps animation separate |
| AC-RNG-006 | INHERITED-AUTO | Web Crypto failure and no-fallback tests |
| AC-MOD-001 | MANUAL-PENDING | Automated labels exist; verify non-color distinction in accessibility audit and B11-006 |
| AC-MOD-002 | INHERITED-AUTO + MANUAL-PENDING | Practice isolation tests; execute B11-006 |
| AC-MOD-003 | INHERITED-AUTO + MANUAL-PENDING | Live start gate tests; execute B11-007 |
| AC-OPS-001 | INHERITED-AUTO + MANUAL-PENDING | Router/sidebar tests; verify navigation and keyboard journey |
| AC-OPS-002 | INHERITED-AUTO + MANUAL-PENDING | Display presence/blackout UI tests; execute B11-015 |
| AC-OPS-003 | INHERITED-AUTO + MANUAL-PENDING | Modal/live confirmation tests; verify keyboard/focus and B11-007/B11-010 |
| AC-AUD-001 | INHERITED-AUTO + MANUAL-PENDING | Phase 7 transport integration; execute two-window B11-011 |
| AC-AUD-002 | INHERITED-AUTO + MANUAL-PENDING | Public projection/privacy DOM tests; observe B11-013 |
| AC-AUD-003 | INHERITED-AUTO + MANUAL-PENDING | Audience production rendering tests; execute B11-011 |
| AC-AUD-004 | INHERITED-AUTO + MANUAL-PENDING | Winner layout tests; observe B11-012 at target display |
| AC-AUD-005 | MANUAL-PENDING | Visual dominance/readability requires target-display observation |
| AC-AUD-006 | INHERITED-AUTO + MANUAL-PENDING | Reconnect/controller tests; execute B11-014 |
| AC-AUD-007 | INHERITED-AUTO + MANUAL-PENDING | Settings/audio fallback tests; execute B11-016 |
| AC-RES-001 | INHERITED-AUTO + MANUAL-PENDING | Pending/confirmation tests; execute B11-007/B11-009 |
| AC-RES-002 | INHERITED-AUTO + MANUAL-PENDING | Partial confirmation and Phase 10 recovery tests; execute B11-009 |
| AC-RES-003 | INHERITED-AUTO + MANUAL-PENDING | Pending decision/redraw tests; execute B11-010 |
| AC-RES-004 | INHERITED-AUTO + MANUAL-PENDING | Cancellation/redraw validation tests; execute B11-010 in Live |
| AC-RES-005 | INHERITED-AUTO + MANUAL-PENDING | Redraw lineage/history tests; reconcile in B11-010/B11-017 |
| AC-RES-006 | INHERITED-AUTO | Redraw capacity/eligibility and transaction tests |
| AC-HIS-001 | INHERITED-AUTO + MANUAL-PENDING | History read-model/UI tests; inspect B11-017 |
| AC-HIS-002 | INHERITED-AUTO + MANUAL-PENDING | Repository/domain boundaries; audit routes and B11-017 |
| AC-HIS-003 | INHERITED-AUTO + MANUAL-PENDING | Confirmed CSV/XLSX export tests; execute exact-string B11-017 |
| AC-NFR-001 | INHERITED-AUTO + MANUAL-PENDING | 10,000 fixture exists; full browser pipeline B11-022 remains required |
| AC-NFR-002 | GAP | Benchmark device/protocol approval and real-browser measurements required |
| AC-NFR-003 | MANUAL-PENDING | Full current Chrome/Edge B11 matrix required |
| AC-NFR-004 | INHERITED-AUTO | Strict TypeScript configuration; rerun `npm run typecheck` |
| AC-NFR-005 | INHERITED-AUTO | Domain source audit required on candidate; no approval for domain `any` is recorded |
| AC-NFR-006 | INHERITED-AUTO | Randomization, eligibility, duplicate, and redraw suites exist; rerun full tests |
| AC-NFR-007 | INHERITED-AUTO | Domain/application tests run without React rendering; rerun candidate suite |

## Phase 11-specific release gates

| Gate | Status | Required evidence |
|---|---|---|
| Accessibility hardening | IN PROGRESS | Slice 11.1 implementation and focused evidence are recorded in `PHASE-11-ACCESSIBILITY-AUDIT.md`; current Chrome/Edge B11-019/B11-020 and assistive-technology sign-off remain pending |
| Indonesian production localization | IN PROGRESS | `INDONESIAN-LOCALIZATION.md`, typed message catalog, formatters, production copy migration, and focused UI regressions are checkpointed; full-suite reconciliation and B11-021 remain pending |
| Browser and viewport acceptance | MANUAL-PENDING | Completed `PHASE-11-BROWSER-MATRIX.md` |
| Scale and performance | GAP | Approved `PHASE-11-PERFORMANCE.md` and B11-022 |
| Bundle/prototype/debug cleanup | GAP | Build manifest/source audit and accepted large-chunk disposition |
| Windows local Host package | GAP | ADR-003, reproducible artifact, checksum/notices/runbook, B11-024/B11-025 |
| Operator rehearsal | GAP | Completed `OPERATOR-REHEARSAL.md` |
| Known limitations | IN PROGRESS | Initial register in `PHASE-11-BASELINE.md`; publish final product record |
| RC decision | GAP | Immutable candidate evidence and explicit approver decision |

## Slice 11.1 verification (historical)

| Command | Result |
|---|---|
| `npm run lint` | PASS — Slice 11.1 candidate |
| `npm run typecheck` | PASS — Slice 11.1 candidate |
| `npm run test` | PASS — 139 files, 1,170 tests |
| `npm run build` | PASS — Vite 8.1.5; `index` 1,083.87 kB and the inherited large-chunk warning remains open as P11-006; `xlsx` is a separate 493.22 kB chunk |
| `git diff --check` | PASS after Slice 11.1 edits |

## Combined 11.1–11.2 checkpoint — 2026-08-31

This checkpoint saves accessibility hardening, the in-progress Indonesian
production localization, the approved Undian/Hasil labels, and the empty-state
layout fixes for Hasil and Riwayat. It is not acceptance of either slice.

The latest pre-checkpoint UI fix passed `npm run lint`, `npm run build` (including
the TypeScript build), its focused History empty-state test, and `git diff --check`.
The inherited large-chunk warning remains open. Earlier focused sidebar,
pending-results, and locale tests also passed.

The full suite has not returned to green after localization: outstanding test
failures and remaining copy review must be reconciled before slice completion.
The historical 11.1 full-suite PASS above does not apply to this checkpoint.
Chrome/Edge and assistive-technology acceptance remain pending. The latest
in-app browser check could not reach the History empty-state card because that
browser profile had no active Event; no visual PASS is claimed for that check.

## Verdict

**PHASE 11 NOT ACCEPTED.** Slice 11.0 establishes traceability and exposes the
remaining decisions and evidence gaps. Later slices may promote individual
rows only with identified, current evidence.
