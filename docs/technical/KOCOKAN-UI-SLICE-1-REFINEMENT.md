# Kocokan UI Slice 1 — remaining light surface refinement

Date: 2026-08-31. Branch: `redesign/kocokan-ui`. Parent checkpoint: `6dce8f2`.
This addresses the owner's six screenshots and Slice 1 visual review request.
It does not start Slice 2 or redesign the Settings composition reserved for
Slice 6. Owner visual acceptance remains pending.

## Root causes and fixes

| Reported surface | Root cause | Applied fix |
|---|---|---|
| Dashboard metrics | The linked MetricCard branch built legacy `ui-card` classes directly instead of using the theme context. Its labels/stripes also read legacy colors. | Use the same theme mapping as the shared Card; consume optional Kocokan label/semantic tokens in the existing metric selectors. Links and values remain unchanged. |
| Prize category rows and description | Rows explicitly painted a dark `--surface-muted`; the raw textarea missed Input opt-in. | Use light surface/foreground fallbacks in the existing row styles and map the textarea's existing field/input classes. No list/form restructure. |
| Participant progress and file picker | ProgressStepper had only legacy primitive classes; the picker wrapper used an explicit dark surface. | Add exclusive Kocokan progress classes, preserving steps and ARIA state. Update picker surface/text tokens; preserve the real file input and Button action. |
| Settings navigation, cards and fields | Page-owned selectors explicitly read dark generic tokens; many native controls and upload labels bypassed shared primitives. Some surfaces used dark color mixes and blur shadows. | Use optional Kocokan tokens in those original selectors; map raw text/number/color/select controls and upload labels into existing input/button styles. Flatten Operator blur shadows. Keep grids, tabs, controls, save behavior and assets unchanged. |
| Draw Setup sections, capacity, mode and presentation choices | Nested sections painted their own dark surfaces regardless of the parent Card theme. | Use Kocokan light/selection/semantic foregrounds in the original section selectors; preserve selected, disabled and focus states and all setup behavior. |
| Draw queue/control deck | Explicit translucent dark backgrounds mixed with newly light parent Cards; inherited and explicit foreground colors conflicted. | Replace Operator-owned surface values with opaque light tokens and explicit matching foregrounds; preserve Latihan/Live labels, pressed state, session links and audience action. |
| Native appearance | The global legacy dark color scheme remained inherited by raw Settings controls. | Explicit light scheme on themed native nodes, without changing body/root or public preview inheritance. Preserve browser select arrows and input types. Upload labels receive the shared focus ring when their nested file input has keyboard focus. |

The initial audit preceded changes. Shared primitives were fixed at their theme
boundary first. Existing page selectors then consume `var(--kc-…, original)`
values; they do not redefine generic application tokens or require additional
specificity layers. No new `!important` declarations or page layout rules were
added. Existing legacy fallback values remain for non-Kocokan consumers.

## Files and scope

- Shared: `MetricCard.tsx`, `ProgressStepper.tsx`, and
  `KocokanFoundation.test.tsx` (one regression test for linked-card keyboard
  access, context isolation, href and step semantics).
- Page presentation hooks: `EventsPage.tsx` (the same raw textarea/date input
  omission), `PrizeCategoriesPage.tsx`, `ProductionSettingsPage.tsx`.
- Styling: `styles/kocokan/tokens.css`, `styles/kocokan/primitives.css`,
  `styles/operator.css`.
- Documentation: this report, the Slice 1 report/plan/TASKS references and
  [refinement evidence](evidence/kocokan-ui-slice1-refinement/).

No domain, persistence, migration, transport, route, localization, package,
Audience renderer or Audience stylesheet changed. No production dependency
was added. Stored ticket strings and official records are untouched.

The remaining page-owned runtime/detail compatibility bridges for
`locked-configuration`, `running-actions` and Pending Results stay under their
later slice ownership. This report does not claim those unvisited runtime
states are fully redesigned. Shared Kocokan Card/Input/Button styling does not
revert to legacy classes. ReasonSelect's page-owned redesign remains deferred.

## Visual verification

In-app Chromium, existing local Vite server. The current browser held a
disposable draft Event with empty participant/prize data. The user's populated
Chrome screenshots guided the fix, but that browser's stored Event was not
modified or reproduced through database writes.

- Dashboard, Prize Categories, Participant Import and Draw Setup: captured at
  1440×900. Dark panels reported by the owner now consume light tokens.
- Settings Branding, Presentation, Audio and Display: captured at 1366×768,
  1440×900 and 1920×1080, retaining the existing composition.
- The dev-only `fixture.html`/`fixture.jsx` renders actual MetricCard,
  ProgressStepper and DrawControlDeck components plus a category-row sample.
  Captured at all three sizes and with both deck mode selections. It uses
  in-memory render props, no persisted Event/session, no storage bypass or
  domain commands. Its links stay inside MemoryRouter and Audience launch is
  disabled. These screenshots supplement empty production states; they are
  not a functional Live draw test.
- The recorded dark-background heuristic returned no legacy dark Operator
  panels in the checked samples. It excludes Audience preview content and is
  a bounded RGB/size check, not a universal contrast certification.
- Display selects/number field and Branding text/color fields computed to
  light native appearance. Native file inputs stay intact. Full OS file
  dialogs and screen-reader operation still require manual acceptance.

Before/after style records at 1440×900 compare **exactly** for the 12-node
Settings Audience preview, 9-node public `/display` standby surface and
246-node legacy prototype shell subtree. Recorded properties include
foreground/background/gradient, fonts, borders, dimensions, spacing and
generic inherited theme tokens. This is evidence for those states, not an
exhaustive test of all public presentation states.

[Source audit](evidence/kocokan-ui-slice1-refinement/source-scope.json) also
confirms all 12 preview/safe-area CSS rules are unchanged and all existing
layout declaration values in `operator.css` match the parent checkpoint.
Reproduce with `node docs/technical/evidence/kocokan-ui-slice1-refinement/audit-scope.mjs`.
The existing public gradient and branding colors are intentionally retained.

## Automated verification

`npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, and
`git diff --check`: PASS. Build retains its existing >500 kB chunk warning.
The focused foundation run passes all 11 tests.

Full run command: `npm.cmd run test -- --maxWorkers=2 --reporter=json
--outputFile=node_modules/.tmp/kocokan-refine-tests.json`.
See [full comparison](evidence/kocokan-ui-slice1-refinement/full-suite-comparison.json)
for final totals and exact KB-001–KB-142 matching.

Focused command: `npm.cmd run test -- src/shared/ui
src/shared/components/SharedCompositions.test.tsx
src/pages/operator/ProductionSettingsDraft.test.ts
src/pages/operator/ProductionPresentationSettings.test.ts
src/pages/operator/ProductionAudioSettings.test.ts
src/pages/operator/ProductionDisplaySettings.test.ts
src/pages/operator/DrawSessionQueuePage.test.tsx
src/pages/operator/SettingsSaveToast.test.tsx
src/app/layouts/ProductionAudienceStatus.test.tsx src/app/router.test.tsx
src/ui/audience/AudiencePreviewSurface.test.tsx
src/infrastructure/browser/managed-audience-display.test.ts --maxWorkers=2
--reporter=json --outputFile=node_modules/.tmp/kocokan-refine-focused.json`.
Result: 16 files, 100 tests, 80 pass / 20 fail, zero skipped. All 20 failures
match the accepted register exactly; 122 other baseline tests are outside this
filtered run. See [focused comparison](evidence/kocokan-ui-slice1-refinement/focused-suite-comparison.json).

The first candidate full run had the same 142 failing identities, with seven
message differences because a newly prepended import changed the source-file
excerpt printed by old source-text assertions. The missing English strings
were identical to baseline. The new local import was grouped with the other
shared UI imports and verification rerun. No assertion, expected string,
baseline register or comparison normalization was changed.

Automated checks do not waive existing Phase 11 failures or replace owner,
Chrome/Edge, assistive-technology or two-window acceptance. No draw, import,
save, asset upload, Event switch or official record mutation was performed
during this refinement's browser review. Slice 2 remains unauthorized.
