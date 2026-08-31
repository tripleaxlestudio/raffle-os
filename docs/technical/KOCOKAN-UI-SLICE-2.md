# Kocokan UI Slice 2 — Dashboard and Event Preparation

Date: 2026-08-31. Branch: `redesign/kocokan-ui`.

Status: implemented for owner review under the revised regression gate.
The owner explicitly authorized proceeding with unchanged baseline failures,
without Phase 11 reconciliation. The preflight below is retained as historical
evidence; its former stop decision is superseded by that authorization.
Slice 3 has not started and is not authorized.

## Preservation checkpoint

The starting working tree contained the Slice 1 light-surface refinement plus
additional header, card and empty-state changes, including Draw queue tests.
These are preserved separately from future Slice 2 implementation. The older
refinement evidence describes its recorded snapshot, not every later edit in
the starting working tree. Passing assertions in the current preflight do not
retroactively change those historical reports.

The preflight normalized line endings in `src/styles/operator.css` to LF after
`git diff --check` reported carriage returns as trailing whitespace. CSS content
and declarations were preserved. No domain, persistence, Audience, package or
route behavior was changed by this preflight.

## Focused test gate: FAIL

Command:

```text
npm.cmd run test -- src/pages/operator/EventsPage.test.ts
src/pages/operator/EventsPage.test.tsx
src/ui/operator/participant-import/ProductionParticipantImportPreview.test.tsx
src/shared/components/ProductionSetupContinuation.test.tsx
src/pages/operator/DrawSessionQueuePage.test.tsx
src/shared/ui/KocokanFoundation.test.tsx --maxWorkers=2 --reporter=json
--outputFile=node_modules/.tmp/kocokan-slice2-before.json
```

Result: 6 files; 63 tests; 45 passed, 18 failed, zero skipped.
All 18 failing identities and first-message signatures match the accepted
baseline exactly: KB-065–067 and KB-098–112. No new or changed failures.
KB-043 and KB-044 already pass in the inherited working tree; their assertions
were not changed during this preflight. The other 122 baseline entries were
outside this filtered run, not skipped by the test runner.

- EventsPage: 3 failures, including stale status/label expectations and a
  missing cancellation button assertion. Root-cause reconciliation remains
  separate; do not assume every failure is harmless copy debt.
- ProductionSetupContinuation: 15 failures referencing older English copy.
- Import preview, Event form validation, Draw queue and foundation tests pass.

Comparison uses the unchanged Slice 1 comparison script and original baseline
register. See [exact comparison](evidence/kocokan-ui-slice2/preflight-comparison.json).

`npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, and
`git diff --check` pass on the preserved checkpoint. Build retains a warning
for chunks larger than 500 kB. The full suite was not rerun in this preflight;
the focused gate failure remains FAIL regardless of build success.

## Browser observation and boundary

The existing local Operator dashboard was inspected in in-app Chromium at
1440 by 900. It shows the existing draft Event with zero participants/prizes
and locked preparation navigation. No Event, participant, Live result or
browser storage was mutated. This observation is not Slice 2 visual acceptance.

At preflight time, the plan required stopping for separate reconciliation
direction. The owner subsequently replaced that gate: unchanged failure
identities/signatures may remain FAIL / pre-existing without blocking visual
implementation. Any changed/new failure must be investigated. No behavioral
assertions may be weakened, skipped or rewritten to improve totals.

## Implementation

- Dashboard: move the next-draw and operational controls ahead of supporting
  metrics; group the existing import/setup actions in a quiet preparation strip.
  Retain the same counts, source queries, state derivation, links and actions.
- Events: group identity/schedule fields, give the form primary emphasis, use
  flat divided saved-event rows and a clear current-event marker. Activation
  remains explicit and visually secondary to form submission. Deletion guards,
  exact-name confirmation, counts and handlers remain unchanged.
- Prize Categories: group identity/additional details, use compact paired
  fields and divided prize rows. Archived/read-only guards remain unchanged.
- Import: organize target/file, mapping, raw data, validation, strategy and
  persisted records in reading order. Validation and both tables use full
  content width; the final decision area separates strategy from confirmation.
  Native radios, checkbox acknowledgement, file chooser, mapping/worksheet
  selection, paging and atomic commit commands are retained.
- ProductionSetupContinuation: numbered steps, completion/current cues and
  a footer constrained to the content width. The original footer hook remains
  for shell clearance; no readiness, unlock, navigation or completion logic
  changes. Its visual effect also appears on Settings and Draw Setup through
  this existing shared footer; their page compositions remain out of scope.

Page-owned classes opt in using the existing `useUiClass` API, with new
`kocokan/dashboard.css` and `kocokan/preparation.css` ownership. Unthemed
consumers retain legacy hooks. No shared primitive, shell, token or legacy
Operator stylesheet was edited in Slice 2. Old rules remain deliberately for
unthemed consumers; final unused-CSS removal remains Slice 7's consumer audit.

### Files

Application files modified: `ProductionDashboardPage.tsx`, `EventsPage.tsx`,
`PrizeCategoriesPage.tsx`, `ProductionParticipantImportPreview.tsx`,
`ProductionSetupContinuation.tsx`, and `styles/app.css` (two imports only).
New styles: `styles/kocokan/dashboard.css`, `styles/kocokan/preparation.css`.
Documentation: this report, the redesign plan, TASKS and this slice's evidence.
No dependency, database schema, route, domain or Audience change.

## Verification and regression decision

Final focused command uses the same six-file selection as preflight, output
`node_modules/.tmp/kocokan-slice2-after.json`. Full command:

```text
npm.cmd run test -- --maxWorkers=2 --reporter=json
--outputFile=node_modules/.tmp/kocokan-slice2-full.json
```

| Required category | Focused comparison | Full-suite comparison |
|---|---|---|
| A. Newly passing during Slice 2 | 0; all 45 preflight passes retained | No baseline failures resolved by Slice 2; KB-043/044 already passed before this slice |
| B. PRE-EXISTING / UNCHANGED BASELINE FAILURES | 18: KB-065–067, KB-098–112 | 140 exact baseline identities/signatures |
| C. Changed baseline failures | 0 | 0 |
| D. New failures | 0 | 0 |

Focused totals: 63 tests, 45 passed, 18 failed. Full totals: 145 files,
1,207 tests, 1,067 passed, 140 failed, zero skipped. Both test runs remain
**FAIL overall**. The revised visual regression gate has no detected
regression; it does not convert historical failures to PASS.

Exact comparisons: [focused](evidence/kocokan-ui-slice2/focused-comparison.json)
and [full](evidence/kocokan-ui-slice2/full-comparison.json). The original
baseline register and comparison algorithm were not modified.

`npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, and
`git diff --check`: PASS. The existing build chunk-size warning remains.
The [source audit](evidence/kocokan-ui-slice2/source-scope.json) compares 137
JSX behavior attributes against checkpoint `b5c8775`; every compared attribute
is unchanged. Frozen paths and all test files are unchanged. Reproduce with
`node docs/technical/evidence/kocokan-ui-slice2/audit-scope.mjs`.

## Browser evidence and observations

In-app Chromium against a separate development origin `127.0.0.1:5174`.
Created a clearly labelled synthetic draft and prize via normal UI. Merged
one synthetic XLSX row and 25 synthetic CSV rows, without deleting any data
or drawing official winners. The user's existing origin/data was untouched.

- Event: disabled blank-name submit; create and explicitly select a draft;
  activate dialog cancelled by Escape with focus returning to its trigger;
  permanent-delete dialog opened and cancelled without deletion.
- Prize: empty/list views; creation; edit prefill and cancellation; Next remains
  blocked before a saved category and becomes enabled afterwards.
- Import: empty storage read error remains visible; CSV empty/duplicate rows;
  25-row raw paging and page-size reset; XLSX worksheet switch from A to B;
  exact `00011`/`00092` ticket display; merge dialog and successful atomic
  merge; replacement confirmation disabled without acknowledgement, then
  cancelled without deletion; saved table paging and 26-row page-size view.
- Dashboard reviewed at 1366×768, 1440×900 and 1920×1080: operational action
  is prominent, metric labels fit, preparation actions remain reachable.
- Import and footer inspected at all three desktop targets: content scrolls
  vertically, no document horizontal overflow; footer actions remain inside
  the content viewport. Early Event evidence revealed a legacy `width:100%`
  footer overflow, corrected locally with `width:auto` and bounded left/right.
- Screenshots in this evidence directory capture visited states. Earlier
  Slice 1 screenshots remain the historical visual reference; screenshots
  with different synthetic data are not pixel-equality comparisons.

### Existing issue observed, deliberately not fixed

When there are zero persisted participants, `getPersistedParticipantsForEvent`
passes `limit: totalCount` (zero), while the repository's existing validator
requires a positive limit. The current UI therefore shows its safe read-error
message. Both files are unchanged from `b5c8775`. After the synthetic merge,
the persisted preview reads normally. This is a separate functional follow-up,
not a visual regression or an authorized Phase 11 fix.

## Limits and owner review

No full Chrome/Edge, assistive-technology or two-window owner acceptance is
claimed. Actual Live/pending/archived and all storage-failure combinations
were not exhaustively exercised in the browser; existing automated coverage
and the unchanged behavior audit supplement the visited synthetic states.
No official Live result was created. Audience presentation and preview
internals remain frozen. The owner must review this slice before Slice 3.

## Owner review refinement: compact upload and pagination chevron

The owner requested matching card heights by making Upload compact, without
enlarging the selected Event card. The original column proportions and natural
Event card height are preserved. Upload spacing and file-picker padding are
reduced; content can still wrap and grow without a fixed card height. Import
pagination now reserves 36px for the existing chevron, including the value 100.
Only `src/styles/kocokan/preparation.css` changes application presentation.

In-app Chromium checks on the isolated synthetic-data origin at 1440x900 and
1920x1080 show both initial cards at 174.59px high, with their original unequal
widths. Upload was previously 240.59px high. The saved-record page-size control
was changed to 100 and its chevron inspected visually, without overlapping text.
Evidence: `refinement-equal-cards-1440x900.png`,
`refinement-compact-upload-1920x1080.png`, and
`refinement-pagination-1440x900.png` in the Slice 2 evidence directory.

Verification: lint and build pass (existing bundle-size warning remains);
`ProductionParticipantImportPreview.test.tsx` passes all 25 tests; diff check
passes. No assertions or behavior changed. The broader baseline comparison
above belongs to the completed Slice 2 run and was not rerun for this CSS-only
refinement. No new passing tests are claimed; known baseline debt remains FAIL.
Slice 3 remains unstarted and owner visual acceptance is still pending.
