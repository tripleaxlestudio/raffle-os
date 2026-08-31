# Kocokan UI Redesign — Slice 0 Baseline

## Status and identity

**Preparation only. No redesign implementation. Baseline test gate FAIL.**
This record is new evidence, not a rewrite of historical Phase 11 acceptance.

- Date: 2026-08-31 (Asia/Jakarta).
- Repository: `C:\laragon\www\raffle-os`.
- Original branch/HEAD: `codex/phase11` / `81c645a`.
- Preservation checkpoint: `523da4642556aa8ae033f6cf61cd1f663d211249`
  (`chore: preserve phase 11.2A audience UI checkpoint`).
- Dedicated branch: `redesign/kocokan-ui`, created AFTER the checkpoint and
  a clean `git status --short`.
- The application tree for all verification below equals that checkpoint.
  Slice 0 adds documentation/evidence only. No source, dependency, test,
  schema, route, theme, or application config edits were made.
- The separate Slice 0 commit is the commit introducing this file. Its parent
  is the production checkpoint; it is deliberately not mixed into Phase 11.

## Dirty worktree audit and preservation

Classification: A = existing Phase 11 work (including its focused tests);
B = documentation-only; C = local/non-content noise; D = redesign work.
All 16 initially reported paths were inspected. There was **no D work**.

| Initial changed file | Class | Owning scope / finding |
|---|---|---|
| `src/app/layouts/ProductionOperatorLayout.tsx` | A | 11.2A-01: stable connection-state badge, localized labels, existing launcher |
| `src/pages/operator/ProductionDashboardPage.tsx` | A | 11.2A-01: uses current presence store rather than old acknowledgement for status |
| `src/shared/components/AudienceConnectionStatus.tsx` (new) | A | 11.2A-01: shared icon/text presentation for six existing states |
| `src/shared/components/AudienceConnectionStatus.test.tsx` (new) | A | 11.2A-01: stable state keys/icons and localized labels |
| `src/app/layouts/ProductionAudienceStatus.test.tsx` (new) | A | 11.2A-01: header/Dashboard status synchronization and managed launch |
| `src/styles/operator.css` | A | 11.2A-01: replaces locale-dependent indicator selectors and obsolete dot treatment |
| `src/pages/display/AudienceDisplayPage.tsx` | A | 11.2A-02: removes in-page fullscreen overlay/subscription; browser F11 remains |
| `src/pages/display/AudienceProductionRoute.test.tsx` | A | 11.2A-02: public clean-output checks, related Indonesian assertions |
| `src/styles/audience.css` | A | 11.2A-02: wider standby layout and removal of fullscreen-overlay CSS |
| `src/ui/audience/AudiencePresentation.tsx` | A | 11.2A-02 copy follow-up: Menunggu undian berikutnya |
| `src/ui/audience/StandbyStage.test.tsx` (new) | A | 11.2A-02: standby branding/copy/safe-area structure |
| `TASKS.md` | B | 11.2A scope approval/register, 01/02 and copy follow-up |
| `docs/technical/PHASE-11-PLAN.md` | B | 11.2A planning slot and owner-directed final acceptance schedule |
| `docs/technical/PHASE-11-ACCEPTANCE.md` | B | Existing 01/02 evidence, earlier FAIL and manual limits preserved verbatim |
| `docs/technical/PHASE-11-BROWSER-MATRIX.md` | B | Schedule and bounded 01/02 criteria; no invented PASS |
| `src/ui/operator/draw/audience-connection-view-model.ts` | C | Mixed working-copy line endings; normalized Git blob equals HEAD, no content delta |

The C file's `git hash-object` and `git rev-parse HEAD:<path>` both returned
`e5149e048985e9a0c52a8d18f8059b5caa279adf`. Staging refreshed the index without
a content change; it is not in the preservation commit. No file was discarded,
reset, stashed, or overwritten. A line-ending warning also mentioned
`DrawSessionQueuePage.test.tsx`; it was not an initial changed-content path.

Decision: legitimate A+B work should be committed first. It was preserved
exactly as audited in the Phase 11 checkpoint: **15 files, 585 insertions,
143 deletions**. No redesign preparation was included in that commit. Its
message explicitly leaves full-suite and manual acceptance open. A later
redesign commit adds this baseline, not retroactive changes to those records.

The first `git add` was denied access to `.git/index.lock`; the same scoped
operation succeeded with required elevation. Subsequent commit/branch operations
used approved elevated Git access. No permission workaround or destructive
Git operation was used.

## Verification environment and commands

Windows PowerShell, Node `v22.20.0`, npm `10.9.3`, Vitest `4.1.10`;
build output reports Vite `8.1.5`. Versions are the installed baseline, not
a dependency update. Existing `node_modules` and committed lockfile were used;
no install, update, or package change was made.

| Command | Result |
|---|---|
| `npm.cmd run test -- src/pages/display/AudienceProductionRoute.test.tsx src/ui/audience/StandbyStage.test.tsx src/application/display-transport/fullscreen-controller.test.ts src/shared/components/AudienceConnectionStatus.test.tsx src/app/layouts/ProductionAudienceStatus.test.tsx --maxWorkers=2` | PASS, exit 0; 5 files / 22 tests; 10.49s; run before preservation commit against identical content |
| `npm.cmd run test -- --reporter=json --outputFile=node_modules/.tmp/kocokan-slice0-baseline-tests.json` | FAIL, exit 1; 144 files: 112 pass / 32 fail; 1,190 tests: 1,048 pass / 142 fail / 0 skipped |
| `npm.cmd run lint` | PASS, exit 0 |
| `npm.cmd run typecheck` | PASS, exit 0 (`tsc -b` is the actual package script) |
| `npm.cmd run build` | PASS, exit 0; 319 transformed modules; Vite reports 1.17s for bundling, not total command duration |
| `git diff --check` | PASS, exit 0; existing LF/CRLF warnings are not whitespace errors |
| `git diff --cached --check` before preservation commit | PASS, exit 0 |
| `git status --short` after preservation and before branch baseline | Empty; clean starting worktree |

Full test reporter's nested suite totals are 337 suites / 268 passed / 69 failed.
Those are NOT file counts. Start timestamp from JSON: `1788148788146`.
Use file and assertion totals above when comparing future runs.

Build artifacts (generated/ignored, not committed):

| Artifact | Size | gzip |
|---|---:|---:|
| `dist/index.html` | 0.50 kB | 0.30 kB |
| `dist/assets/index-DGA7S6hU.css` | 251.48 kB | 35.71 kB |
| `dist/assets/xlsx-Cl_0CZaL.js` | 493.22 kB | 160.65 kB |
| `dist/assets/index-Esq257vY.js` | 1,084.86 kB | 298.37 kB |

The existing >500 kB chunk warning remains. No chunk splitting or performance
change was attempted in Slice 0.

## Failure classification

Every failing test has an exact name, file, initial failure message and
`pre-existing` classification in the committed
[142-entry register](evidence/kocokan-ui-baseline/test-failures.json).
Stable IDs `KB-001` through `KB-142` enable signature comparison.

“Pre-existing” means present **before redesign at this production checkpoint**.
It does NOT assert that every failure predates 11.2A, nor that failures are
harmless, nor that the blocked behavioral checks passed.

| Category | Current assessment |
|---|---|
| Pre-existing | All 142 failures were observed before any redesign changes. Many stop on mixed-language labels, copy, accessible names, or static-source assertions. |
| Environment-related | Git lock permission denial resolved with elevation; Git ignore/line-ending warnings; first browser attach timeout recovered on one retry. These did not prevent final test/lint/typecheck/build execution. |
| Test instability | Not established. The full suite was run once; do not infer flakiness from different totals in earlier runs with different source content. |
| Actual code defect | Not conclusively adjudicated for each failed behavior. Existing mixed localization and browser findings need independent triage; do not categorize all tests as “just stale” without checking behavior. No defect was fixed here. |

Examples checked against source:

- Router assertions expect “Settings Undian”; the current navigation renders
  “Pengaturan Undian”. Many draw/history tests seek old English controls.
- Draw preflight tests partly expect Indonesian but the underlying preflight
  view model still returns English values such as “Connected” and “Eligible pool”.
  This is baseline localization/assertion disagreement, not evidence that
  readiness guards are correct or incorrect.
- Queue timestamp expectation uses `Aug`/colon, while actual localized output
  contains `Agu` and `23.42`.
- Several modal/prototype tests seek “Batal” where the shared default remains
  “Cancel”. Settings source-string assertions expect earlier English text.

No test was skipped, weakened, edited, or “fixed” for the baseline.
Reconciliation belongs to separately approved Phase 11 work; preserve exact
test intent and commit fixes independently. A future change in error signature
even within the same failing test is a potential regression. Equal failure
counts alone do not prove equivalence.

### Failed-file register

| Test file | Failed assertions | Ownership/classification |
|---|---:|---|
| `src/app/PhaseTwoHappyPath.test.tsx` | 1 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/app/production-draw-run-route.test.tsx` | 9 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/app/router.test.tsx` | 8 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/app/errors/ErrorHandling.test.tsx` | 2 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/application/display-transport/audience-liveness.test.tsx` | 3 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/application/display-transport/audience-render-commit.integration.test.tsx` | 2 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/application/display-transport/phase7-integration.test.tsx` | 1 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/application/display-transport/settings-display-integration.test.ts` | 4 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/application/draw/draw-run-preflight.test.ts` | 3 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/application/workflow/phase10-recovery-acceptance.integration.test.tsx` | 1 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/pages/display/AudienceDisplayPage.test.tsx` | 8 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/pages/operator/DrawSessionQueuePage.test.tsx` | 2 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/pages/operator/DrawSetupPage.test.tsx` | 19 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/pages/operator/DrawSetupRoute.test.tsx` | 1 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/pages/operator/EventsPage.test.tsx` | 3 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/pages/operator/LiveDrawPage.test.tsx` | 2 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/pages/operator/PendingResultsPage.test.tsx` | 3 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/pages/operator/ProductionAudioSettings.test.ts` | 3 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/pages/operator/ProductionDisplaySettings.test.ts` | 2 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/pages/operator/ProductionHistoryPage.test.tsx` | 10 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/pages/operator/ProductionHistoryTable.test.tsx` | 3 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/pages/operator/ProductionHistoryViews.test.tsx` | 2 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/pages/operator/ProductionPresentationSettings.test.ts` | 2 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/pages/operator/SettingsPage.test.tsx` | 1 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/shared/components/OperatorPersistenceStatus.test.tsx` | 2 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/shared/components/ProductionSetupContinuation.test.tsx` | 15 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/shared/ui/CorePrimitives.test.tsx` | 1 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/shared/ui/Modal.test.tsx` | 2 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/ui/audience/RandomNumberRollStage.test.tsx` | 1 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/ui/audience/WinnerStage.test.tsx` | 1 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/ui/operator/draw/draw-session-queue-view-model.test.ts` | 4 | Pre-existing at baseline; Phase 11 reconciliation |
| `src/ui/operator/draw/ProductionDrawPresentation.test.tsx` | 21 | Pre-existing at baseline; Phase 11 reconciliation |

### Raw evidence retention

Raw JSON remains in the ignored local path
`node_modules/.tmp/kocokan-slice0-baseline-tests.json` (2,278,131 bytes).
SHA-256:
`1dde8e0cc7950f294af09e7fb090d478b7e5d2dd5d56d3cba725b4d7f75ecdb5`.

The committed compact register retains every failure identity and first
message, not the full DOM dumps/stack traces. The raw local report can be
lost by dependency cleanup; use its hash to verify an archived copy, or rerun
the exact command at the baseline commit. Do not compare a later run as though
it were the same evidence.

## Scope outcome

Final documentation/evidence checks: all relative Markdown links in the four
new redesign documents resolved; every one of the 142 failure identities and
first messages matched the raw report; all 15 screenshot dimensions matched
filenames and hashes were recorded. The application/source/package/config
diff against the production checkpoint was empty. Historical Phase 11
acceptance and browser-matrix files were unchanged by Slice 0.

- Existing Phase 11 work preserved and independent from Slice 0.
- New [plan](KOCOKAN-UI-REDESIGN-PLAN.md) owns roadmap reconciliation, frozen
  contracts, theme/CSS architecture, target tokens and slice acceptance.
- New [inventory](KOCOKAN-UI-SURFACE-INVENTORY.md) owns routes, states, primitives,
  portals, shared-style hazards and existing-gradient disposition.
- New [visual baseline](KOCOKAN-UI-VISUAL-BASELINE.md) distinguishes observed
  states/screenshots from unexercised manual checklist rows.
- No application redesign or functional test-debt remediation performed.
- **Slice 1 remains unstarted and requires approval.** Slice 0 completion is
  a preparation milestone, not a green application/release acceptance.
