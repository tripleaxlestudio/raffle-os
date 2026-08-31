# Kocokan UI Slice 2 — preflight

Date: 2026-08-31. Branch: `redesign/kocokan-ui`.

The owner authorized Slice 2 after receiving its Dashboard, Event, Prize
Categories, Participant/import and setup-continuation scope. This authorizes
the visual slice, not separate Phase 11 defect/localization reconciliation.
No Slice 2 application implementation has started.

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

The redesign plan requires stopping when a slice cannot pass its focused
contract because of baseline debt. Next required decision: authorize a
separate reconciliation of the 18 Event/setup-continuation failures before
returning to the approved Slice 2 visual work. Do not weaken behavioral
assertions or relabel this overall failure as PASS.
