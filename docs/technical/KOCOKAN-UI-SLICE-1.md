# Kocokan UI Slice 1 — visual foundation and production shell

Date: 2026-08-31. Branch: `redesign/kocokan-ui`.
Scope: the separately approved Slice 1 only. Implementation is ready for
owner review, not owner acceptance. **Slice 2 has not started.** The separate
commit containing this report is the Slice 1 checkpoint (`git log -1 --
docs/technical/KOCOKAN-UI-SLICE-1.md`). Frozen production baseline remains
`523da4642556aa8ae033f6cf61cd1f663d211249`.

## Implementation and boundaries

Follow-up: the owner requested correction of remaining dark Operator surfaces.
The [Slice 1 refinement report](KOCOKAN-UI-SLICE-1-REFINEMENT.md) records the
fixes, new evidence and exact verification. It supersedes the deferred-dark
description below for the reported Dashboard/Prize/Import/Settings/Draw Setup/
control deck surfaces; original checkpoint results remain historical.

1. **Theme ownership.** `ProductionOperatorLayout` supplies `UiThemeContext`
   and `data-ui-theme="kocokan"`. The default context is `legacy`. Shared
   components select exclusive `kc-*` or legacy classes; caller classes stay
   intact. ProductionWorkspaceProvider, publisher placement/lifetime, route
   structure, event commands, and Audience launch ownership are unchanged.
   No theme is attached to body/html/root or every operator interface.
2. **Tokens.** `styles/kocokan/tokens.css` contains the warm page, white and
   muted surfaces, charcoal text/outline, purple primary/selection, semantic
   colors, 4px spacing scale, 12/16/20px radii, 2/4/6px hard shadows,
   system/monospace font references, type scale/weights, control heights,
   focus and reduced-motion treatment. No remote font, dependency or new
   gradient. Semantic foreground colors are darker for light surfaces.
   No generic `--app-bg`, `--text-primary`, `--accent`, space or radius token
   is reassigned. Native light color-scheme is limited to kc inputs/selects.
3. **Primitives.** Button/ButtonLink (primary, secondary, success, danger,
   quiet, square), Card (flat default, raised/interactive emphasis), Input,
   Select, Checkbox, Toggle, SegmentedControl, FieldGroup/messages, Table,
   Pagination, Badge, Toast, Modal, ConfirmationDialog and SidePanel opt in.
   PageHeader, SectionHeader, StatusBanner and AudienceConnectionStatus use
   explicit presentation classes. Native semantics/callbacks remain intact.
   Modal semantic icons use explicit tone in production; legacy copy-based
   icon behavior is retained only for legacy consumers.
4. **Shell.** KOCOKAN wordmark/monogram, approximately 240px sidebar/68px
   header, flat inactive navigation, outlined active selection, compact Event
   context/menu, existing Audience shortcut/Siaga action, and explicit
   Live/Latihan labels. Six connection keys and text/icon semantics are
   unchanged. Long Event names truncate in the trigger, remain in its title,
   and wrap in the menu. Navigation order, guards and callbacks are unchanged.
5. **Portals.** Modal and SidePanel retain their existing direct-body root,
   now marked with the context theme. Focus trap, background inert state,
   dismissal, restoration, roles and layers are retained. `ThemedSelectMenu`
   forwards react-select props/ref through its existing Menu component and
   adds the marker to its existing node. Pending's document.body host and
   page-owned hardcoded dark styles are unchanged; menu redesign is Slice 4.
6. **Expected cross-route effects.** Production consumers of shared
   primitives inherit light controls/cards/dialogs and compact shared headings.
   Existing page geometry selectors recognize the new classes, including
   table overflow, button sizing and multi-winner redraw modal grids. Raw
   copies of PageHeader markup in Prize Categories and Participant Import
   opt into the same header class mapping without restructuring either page.
   Bounded foreground fallbacks keep existing content readable on light Cards.
   Deferred dark sections retain light labels via separate `--kc-label`
   variables. These are component compatibility bridges, not generic token
   remapping or page composition redesign.

## Files

- New: `src/styles/kocokan/{tokens,primitives,shell}.css`,
  `src/shared/ui/{ui-theme.ts,ThemedSelectMenu.tsx,KocokanFoundation.test.tsx}`.
- Updated: production layout/sidebar, the shared primitives/components listed
  above, `ProductionPendingResultsPage.tsx` (adapter only),
  `PrizeCategoriesPage.tsx` and `ProductionParticipantImportPreview.tsx`
  (header presentation hooks only), stylesheet imports and bounded legacy CSS
  compatibility rules. Three existing test files contain shell coverage or
  revised visual class assertions. No behavior assertion was removed/skipped.
- Documentation: this report, redesign plan/TASKS authorization status,
  inventory links, and [evidence directory](evidence/kocokan-ui-slice1/).
  No domain, persistence, migration, protocol, router, Audience source/CSS,
  package/lockfile, or localization contract changed.

## Automated verification

Full command: `npm.cmd run test -- --maxWorkers=2 --reporter=json
--outputFile=node_modules/.tmp/kocokan-slice1-tests.json`.

**Overall FAIL**: 145 files (113 pass, 32 fail), 1,204 tests
(1,062 pass, 142 fail, zero skipped). Fourteen added tests pass.

The [exact comparison](evidence/kocokan-ui-slice1/full-suite-comparison.json)
matches relative file + full test name + first failure-message line against
every accepted KB-001–KB-142 record:

| Classification | Result |
|---|---:|
| Resolved baseline failures | 0 |
| Unchanged baseline failures | 142 |
| Changed failure signatures | 0 |
| New failures | 0 |
| Missing/skipped baseline tests | 0 |

The committed comparison includes every current failure and raw-report hash.
Reproduce with `node docs/technical/evidence/kocokan-ui-slice1/compare-tests.mjs`.
This is not a waiver of baseline defects or evidence that every failing
scenario is functionally safe. Initial candidate differences caused by old
visual class assertions were reviewed and updated to their namespaced
equivalents. One new test's whitespace-sensitive accessible name was corrected;
no production copy or functional behavior was changed to make it pass.

Focused run: **12 files, 110 tests: 90 pass, 20 fail**; all twenty failures
match the register exactly. The other 122 baseline failures belong to files
outside this filtered command (reported as missing from that report, not skipped
tests). See [focused comparison](evidence/kocokan-ui-slice1/focused-suite-comparison.json).
Command: `npm.cmd run test -- src/shared/ui src/app/shell
src/app/layouts/ProductionAudienceStatus.test.tsx
src/shared/components/AudienceConnectionStatus.test.tsx
src/infrastructure/browser/managed-audience-display.test.ts src/app/router.test.tsx
src/app/production-draw-run-route.test.tsx --maxWorkers=2 --reporter=json
--outputFile=node_modules/.tmp/kocokan-slice1-focused.json`.
The new foundation/header tests pass; remaining focused failures are exact
members of the baseline register. Coverage includes native form semantics,
literal tickets, buttons, table/pagination, connection states, body portals,
focus/Escape/inert, Toast live regions, Event menu selection/keyboard/long names,
mode labels, managed Audience launch and routing.

`npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, and
`git diff --check`: **PASS**. Build retains the existing >500kB chunk warning.
No test result is reported as browser or owner acceptance.

## Browser evidence and isolation

The in-app Chromium browser was used against the existing local dev server.
No production record was fabricated, no database reset/fixture bypass was used,
and no session/winner/import/history command was performed for screenshots.
The existing disposable draft Event was viewed; activation was opened/cancelled.

- Before: production shell/Event menu, production activation modal, `/display`
  standby, Settings static preview and representative prototype. Image names
  contain actual measured dimensions; some initial before surfaces were
  1280x720, so matching after captures also use that size.
- After shell/Event menu: **1366x768, 1440x900 and 1920x1080**. Header/sidebar
  measurements are 68px/240px; no body horizontal overflow. Foundation controls
  and dormant SidePanel are shown in a review-only Vite entry at all three
  sizes. Modal actions remain visible in the captured fixture/production
  dialog. Existing fixed continuation-footer clipping is still visible in
  page evidence and is not claimed fixed.
- Interactions observed: hover, keyboard focus ring, disabled controls,
  Event menu Home/End/Escape, modal/SidePanel Escape and focus return, background
  inert restoration, literal input, native select, checkbox/toggle, mode
  segments, pagination and toast dismissal. Six connection states are shown
  in the review fixture; only waiting/connected states were available live.
- **Pressed/reduced-motion limitation:** active translation/shadow and media
  rules were inspected in source; a held-pointer screenshot and OS reduced
  motion run were not produced by this browser API. Owner manual checks remain.
- `/display`: before/after recorded computed properties match exactly at
  1440x900; standalone appearance is unchanged. No Audience stylesheet or
  renderer was edited.
- Settings static preview: recorded colors, fonts, backgrounds/gradients,
  spacing and internal composition remain unchanged. Seven width/height
  measurements differ by at most **0.079 CSS px**, arising from the enclosing
  Operator frame's fractional layout; no wrapping/content change was observed.
  This is disclosed rather than represented as byte-identical geometry.
- Prototype: the representative legacy Dashboard matches all recorded visual
  properties except width of navigation hidden under a closed native details
  element. That hidden box has no visible pixels. No theme marker is present
  on the prototype shell. Visible appearance remains legacy.
- The review entry renders the **same AudiencePresentation** twice inside
  equal-size legacy and Kocokan Card frames. Recorded standby, three-ticket
  reveal and blackout styles match exactly. This is supplementary component
  evidence, **not a live DrawRun** or official result. The existing outer
  `.production-preview` frame explicitly preserves its legacy inherited color.

See [isolation comparison](evidence/kocokan-ui-slice1/isolation-comparison.json),
the computed-property captures, and image manifest in the evidence directory.
The fixture is a dev-only HTML entry, not a new application route or build entry.

## Deferred work and acceptance limits

Live DrawRun baseline remains **OPEN**: no safe valid session existed in the
disposable Event without setting up persisted draw data. Do not infer live
rolling/reveal/safe-area/branding integration acceptance from the render fixture.
The isolated standby/reveal/blackout checks support theme containment only.

Owner browser review and the remaining live preview/manual interaction checks
are still required for Slice 1 acceptance. Chrome/Edge and assistive-technology
sign-off are not claimed. Pending populated records, History details, live
DrawRun and every latent page-owned composition have not all been browser-walked.

Legacy metric tiles, setup workflow footer/stepper, page-specific panels,
raw textarea/date fields, reason menu, Settings internals and dormant prototype
pages intentionally retain their current visual ownership. Mixed light/dark
page areas are expected at this foundation stage; future page slices own their
composition. Saved Participant-preview read error, footer clipping, mixed
language copy, Draw Setup Event-ID display and static Settings-preview
limitations remain visible. No localization, packaging or functional debt was
fixed. Stop here for owner review; do not begin Slice 2 automatically.
