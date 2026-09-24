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

## Owner planning update — 2026-08-31

Slice 11.2A is designated for UI improvements and bounded feature additions.
The planning slot is approved; individual item approvals are recorded in
`TASKS.md`. Item 11.2A-01 is the approved Audience connection indicator UI fix.
Approval alone does not imply implementation or acceptance PASS.

The execution order is 11.2A, 11.4 profiling/hardening, 11.5A-D packaging,
then the final acceptance session (11.3, 11.5E, and final 11.4 benchmark),
followed by 11.6 RC closeout. Add approved 11.2A items to affected acceptance
checks before the session. Earlier manual acceptance remains pending, and the
checkpoint's full-suite failures remain unresolved by this documentation-only
update. Required automated gates continue during development; all release
criteria remain unchanged.

## 11.2A-01 — Audience connection indicator clarity — 2026-08-31

**Implemented; focused checks PASS. Full-suite gate FAIL; owner Chrome/Edge
acceptance remains pending. Not a slice or release acceptance declaration.**

Owner supplied screenshots showing Waiting and Connected were insufficiently
distinct. The header's CSS depended on English accessible labels after the UI
had been translated. The fix uses stable `data-connection-state` keys and one
shared badge: amber/clock for Waiting, green/monitor-check for Connected, and
distinct icons/text for setup, reconnecting, unavailable, and publication error.
No animated status treatment was added.

Browser testing also reproduced a stale Dashboard Connected badge after the
last Audience tab closed: a historical snapshot acknowledgement was being
presented as current connection state. The Dashboard now subscribes to the
same existing presence store as the header. Transport, heartbeat timing, draw
selection, persistence, and audit code are unchanged. Snapshot-application
diagnostics elsewhere are not redefined by this UI fix.

### Verification

| Check | Result |
|---|---|
| Focused tests: `AudienceConnectionStatus.test.tsx`, `ProductionAudienceStatus.test.tsx`, `audience-presence.integration.test.ts`, `ProductionWorkspaceContext.test.ts` | PASS — 4 files / 14 tests; includes stale acknowledgement after disconnect |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS — existing large-chunk warning remains; index JS 1,086.83 kB |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run test -- --reporter=json --outputFile=node_modules/.tmp/phase11-2a-test-results.json` | FAIL — 33 files failed / 110 passed; 146 tests failed / 1,041 passed; both new test files pass |
| `git diff --check` | PASS |

Full-suite failures include stale pre-localization assertions (for example,
English navigation and draw labels). The earlier checkpoint already records
full-suite debt, but this run does not establish that every failure predates
11.2A-01. Full failure reconciliation remains separate pending work.

### Focused browser observations

- Surface: Codex in-app browser, Windows, `http://localhost:5173`, development
  working tree based on `81c645a`; not an immutable packaged candidate.
- Disposable Event: `UJI UI 11.2A — Status Audiens`, ID
  `24e47f28-dff7-4f33-ba7b-cfe8370df21c`; display configuration
  `ac02b41b-4c56-4866-b5e2-3c4ce9fdf4e3`. No participants, draw sessions, or
  official results were created. The Event remains in the isolated test profile.
- Observed both Waiting and Connected badges at Operator 1440 x 900 and
  1366 x 768 without clipping; screenshots inspected during the session.
- Connected used green tint/border/text and a monitor-check icon in both
  locations. Waiting used amber tint/border/text and a clock icon.
- Opened a real same-origin Audience tab, observed both indicators Connected,
  closed it, observed both return to Waiting after the existing liveness
  timeout, reopened it, and repeated the close check successfully.
- Header keyboard focus retained the visible 3px focus outline. Header Enter
  and Dashboard open-button actions did not expose a popup in this browser;
  popup launch is NOT accepted by this check. The separate tab was opened
  using scope IDs observed in the existing development diagnostics UI.
- Temporary viewport overrides were reset and test Audience tabs closed.
  These observations support B11-014/B11-019/B11-021 only; they do not change
  the full Chrome/Edge matrix rows from NOT RUN.

### Changed files and scope

- New: `src/shared/components/AudienceConnectionStatus.tsx` and its test;
  `src/app/layouts/ProductionAudienceStatus.test.tsx`.
- Modified: `src/app/layouts/ProductionOperatorLayout.tsx`,
  `src/pages/operator/ProductionDashboardPage.tsx`, `src/styles/operator.css`.
- Planning/evidence synchronized: `TASKS.md`, `PHASE-11-PLAN.md`, this record,
  and `PHASE-11-BROWSER-MATRIX.md`; earlier uncommitted planning edits preserved.
- Assumption: this item improves the existing connection indicator, not a new
  connection protocol or a claim that a snapshot is currently visible onscreen.
- No dependencies, schema changes, or automatic commit. Owner visual review,
  supported-browser popup verification, and the full-suite gate remain open.

## 11.2A-02 — Clean Audience standby (2026-08-31)

Owner-approved changes: remove the narrow 15ch standby heading cap, use a wider
responsive message area with more comfortable line spacing, and remove the
fullscreen button and its status overlay from all production Audience states.
Fullscreen is a browser operation (Windows F11), with no replacement control,
hint, or shortcut interception on the public stage. Public copy, branding,
safe-area configuration, assistive announcements, and draw data are unchanged.
The standalone fullscreen utility and display protocol remain unchanged.

### Focused verification

- `npm.cmd run test -- src/pages/display/AudienceProductionRoute.test.tsx src/ui/audience/StandbyStage.test.tsx src/application/display-transport/fullscreen-controller.test.ts src/shared/components/AudienceConnectionStatus.test.tsx src/app/layouts/ProductionAudienceStatus.test.tsx --maxWorkers=2`: PASS, 5 files / 22 tests.
- Route tests cover no fullscreen controls in connecting, disconnected,
  standby, countdown, rolling, reveal, pending handoff, and blackout states,
  including an environment with a supported Fullscreen API. Directly related
  route assertions were aligned with existing Indonesian copy.
- `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run typecheck`: PASS.
  Existing large-chunk warning remains (main JS 1,084.87 kB).
- `git diff --check`: PASS. Full suite was not rerun for this item; the prior
  11.2A-01 full-suite failures above remain unresolved, not waived.
- Codex in-app browser, localhost development build, same isolated disposable
  Event recorded above: inspected standby screenshots at 1920 x 1080,
  1366 x 768, and 1280 x 720. Text fits without horizontal overflow and no
  fullscreen controls/status are visible. At 1920 the heading occupies two
  lines (112px font, 1440px heading width); at smaller viewports it fits one
  line (81.96px and 76.8px respectively). Wrapping depends on available width.
- No participants, draws, or official results were created by this check.
  Browser observations used default branding, not the owner's uploaded image.
  Actual Chrome/Edge F11 entry/exit and owner branded-screen acceptance remain
  NOT RUN; this focused check does not complete the final browser matrix.

### Files and boundaries

- Modified: `src/pages/display/AudienceDisplayPage.tsx`,
  `src/pages/display/AudienceProductionRoute.test.tsx`, `src/styles/audience.css`.
- Added: `src/ui/audience/StandbyStage.test.tsx`.
- Updated: `TASKS.md`, `PHASE-11-PLAN.md`, `PHASE-11-BROWSER-MATRIX.md`, this record.
- Assumption: clean output means removing both the button and the windowed/
  fullscreen status, not replacing them with another public control.
- No dependencies or persistence changes. Earlier 11.2A-01 edits are preserved;
  no commit was requested or made.

### 11.2A-02 copy follow-up (2026-08-31)

Owner requested a simple wording correction: idle Audience heading is now
"Menunggu undian berikutnya", replacing "Menunggu presentasi berikutnya".
Only the string in `src/ui/audience/AudiencePresentation.tsx` and matching
assertions/fixture in `AudienceProductionRoute.test.tsx` and
`StandbyStage.test.tsx` changed; `TASKS.md` records this follow-up.
Layout, public state, other messages, and persisted data are unchanged.
Custom message settings/menu are explicitly deferred for discussion and are
not implemented. This supersedes the earlier instruction to preserve this
particular waiting copy; the earlier browser observations describe that prior copy.

Verification: `npm.cmd run test -- src/pages/display/AudienceProductionRoute.test.tsx src/ui/audience/StandbyStage.test.tsx --maxWorkers=2`
passed (2 files / 8 tests). `npm.cmd run lint`, `npm.cmd run build`, and
`git diff --check` passed; the existing large-chunk build warning remains.
No new browser or full-suite acceptance is claimed. No commit was made.

## Verdict

**PHASE 11 NOT ACCEPTED.** Slice 11.0 establishes traceability and exposes the
remaining decisions and evidence gaps. Later slices may promote individual
rows only with identified, current evidence.
