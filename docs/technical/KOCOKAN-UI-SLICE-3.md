# Kocokan UI Slice 3 — Draw Console

Date: 2026-08-31–2026-09-01. Branch: `redesign/kocokan-ui`.
Status: **implemented and verified for owner review, not owner accepted**.
The focused Slice 3 commit containing this report follows accepted Slice 2
`c6e598ac25653e6d9b4874425d2f39bd9f040ecd`. No push, Slice 4 work, or Phase 11
reconciliation is included. [Approved scope](KOCOKAN-UI-SLICE-3-PLAN.md).

## Acceptance and preflight

The owner explicitly accepted Slice 2 at `c6e598a`, including compact upload
and pagination-chevron refinements. Its report and TASKS now record acceptance.
The earlier review-pending statements are historical, not the current decision.
The branch/HEAD were confirmed before implementation. The pending Slice 3 plan
was documentation from this task; no unrelated edits were staged.

Read PRD and the approved redesign/surface inventory/plan before implementation.
Audited consumers of exported DrawControlDeck, ProductionDrawRunHeader and
PresentationSupport. Default unthemed consumers remain legacy. Focused baseline
and before screenshots were captured before each affected visual area migrated.
The Operator data experiment used a separate dev origin, `127.0.0.1:5175`;
the existing Slice 2 server on 5174 was left alone.

## What changed

- Setup: compact five-metric capacity strip; divider-based identity, quantity,
  presentation and eligibility groups; flat support area; explicit light native
  mode radios; aligned preset/custom controls using subgrid. All seven quantity
  controls measured 44px high at the same top position at 1440px width.
- Queue: light deck header, selected-mode lavender treatment with native
  pressed/disabled semantics, flat summary/connection rows, primary operational
  action and secondary setup/Audience actions. Existing grouping/order retained.
- Run: white parent card, compact identity/metrics header, warm control surface,
  responsive controls/monitor columns, flat leading-zero ticket rows. Practice
  return is secondary to Reset; Live actions keep existing semantic variants.
- Blackout recovery control, presentation recovery body and quick-redraw
  confirmation chrome use light semantic surfaces. Blackout still hides the
  existing content region; it never blackens the Operator shell.
- Monitor heading/recap/frame are Operator-owned. The canvas renderer,
  `.production-preview` and `.production-preview__viewport` scaling rules are
  unchanged. The Slice 4 multi-winner selection grid/reason control are untouched.

### Files

Application changes are limited to the six TSX files listed in the approved
plan: DrawSetupPage, DrawSessionQueuePage, DrawRunPage, DrawPresentationSettings,
ProductionDrawPresentation and PresentationRecoveryDialog; plus the new
`src/styles/kocokan/draw.css` and one import in `src/styles/app.css`.
Added `src/ui/operator/draw/KocokanDrawConsole.test.tsx` (7 tests).
Documentation: TASKS, main redesign plan, Slice 2 acceptance, approved Slice 3
plan, this report, and [Slice 3 evidence](evidence/kocokan-ui-slice3/README.md).

No dependencies, domain/application/infrastructure code, schema, persistence,
route configuration, Audience source/style, prototype, shared tokens/primitives,
shell, Slice 2 stylesheet, or existing test file changed.

## Automated verification

The full suite remains **FAIL**, not PASS with an exception hidden in prose.
Comparison uses exact file + full test name + first failure-message line from
the accepted baseline register; it does not normalize or weaken assertions.

| Check | Result |
| --- | --- |
| Approved focused preflight, 10 files / 109 tests | 51 pass, 58 baseline fail, 0 skipped |
| Same focused set after migration | 51 pass, 58 identical fail; all 109 status/signature records unchanged |
| New theme/semantics/isolation tests | 7/7 pass |
| Queue + new tests after final visual refinements | 2 files, 11/11 pass |
| Full suite | 146 files, 1,214 tests: 1,074 pass, 140 identical baseline fail, 0 skipped |
| Newly passing old baseline tests in this slice | 0; KB-043/044 were already passing in Slice 2 and remain passing |
| Changed signatures / entirely new failures / previously passing regressions | 0 / 0 / 0 |
| Lint / typecheck / production build / diff whitespace | PASS |
| Whole TSX audit, excluding only classes/theme hooks | All six normalized AST hashes unchanged |

Focused before/after uses the exact command in the approved plan with JSON
reporter and `--maxWorkers=2`. Setup-only verification also retained its 20
baseline failures; Queue's four tests passed. Full command:

```text
npm.cmd run test -- --maxWorkers=2 --reporter=json --outputFile=node_modules/.tmp/kocokan-slice3-closeout-full.json
npm.cmd run test -- src/ui/operator/draw/KocokanDrawConsole.test.tsx src/pages/operator/DrawSessionQueuePage.test.tsx --maxWorkers=2
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
git diff --check
node docs/technical/evidence/kocokan-ui-slice1/compare-tests.mjs node_modules/.tmp/kocokan-slice3-closeout-full.json docs/technical/evidence/kocokan-ui-slice3/full-comparison.json
node docs/technical/evidence/kocokan-ui-slice3/compare-preflight.mjs
node docs/technical/evidence/kocokan-ui-slice3/audit-scope.mjs
```

Filtered-out tests are not skipped: 82 original registered failures are outside
the focused filter, while two registered failures already recovered in Slice 2.
The full comparison covers the entire register. Raw JSON reports stay in ignored
`node_modules/.tmp`; committed comparisons retain hashes and exact failures.
The additional before/after script compares every focused test and compares
full failures against Slice 2, so recovered tests cannot silently regress.

The build retains its pre-existing >500kB chunk warning. Git emitted host
global-ignore permission and LF/CRLF warnings; these are not test failures.
No package or broad environment changes were made to suppress warnings.

## Browser evidence and limits

Used the Browser skill for real local UI interaction and screenshot/computed
style inspection. Browser identity/engine-version limitation and measured
viewports are in the evidence index; this is not Chrome/Edge owner sign-off.
Synthetic event: `UJI SLICE 3 — Draw Console`, one Door Prize, 120 imported
ticket strings `00001`–`00120`; saved default branding and Practice configuration.
No official Live draw/history was created. The practice selection produced
`00061`, `00089`, `00050`, `00072`, `00029`, `00012`, in that order.

| Area | Observed evidence | Remaining limitation |
| --- | --- | --- |
| Setup | Missing-data before view; saved/dirty metrics; preset 6; custom 101 invalid under max 100; timed controls, manual/20-per-second/sequential saved and retained after reload; native mode choices light and explicit | Exhaustive invalid inputs, locked/conflict and successfully saved insufficient-capacity state not browser-certified |
| Queue | Real Practice deck, unavailable Live disabled, truthful Audience waiting state, link enters start gate without selection; fixture switches existing Live/Practice deck and shows confirmed connection | Multiple/blocked decks and two empty branches rely on existing automated coverage, not new browser evidence |
| Start gate | Ready on all target desktop widths; short hold released without starting; accessible confirmation Cancel/Escape; focus returned; reload remained ready | Busy/failing Live gate not browser-exercised; baseline failing tests are not claimed PASS |
| Runtime | Actual Practice countdown → manual rolling → sequential reveal; exact ticket order retained; reset confirmation opened and canceled; actual control screenshots | Reset execution, timed rollover, Live handoff/quick-redraw cancellation, multi-redraw and full official recovery not newly browser-certified |
| Recovery/blackout | Synthetic production components: white Operator shell during blackout; recovery portal light, focused review action, Escape does not dismiss; review callback exits fixture | Fixture callbacks/connection are synthetic, not official persistence/transport acceptance |
| Accessibility | Labeled pressed/checked/disabled controls; visible focus on mode control; start dialog focus restoration; recovery Escape guard | Full keyboard traversal, reduced-motion visual matrix, screen reader and OS high contrast remain manual follow-up |
| Responsive | Setup/Queue/start gate at 1366×768, 1440×900 and 1920×1080; no document horizontal overflow; controls reachable by vertical scrolling | This is selected-state evidence, not every error/dialog at every size |
| Audience | Eight equal-size before/after preview samples unchanged; actual `/display` missing-context state captured at 1920×1080 | Managed popup did not become a controllable tab; real same-snapshot two-window acknowledgement/fullscreen acceptance remains pending |

### Isolation investigation

Eight valid preview samples compare the same public fixture snapshot, 600px
monitor width and 1280×720 viewport: ready, countdown, rolling, reveal 1/6/10/20,
and 50-winner fallback. All captured DOM computed properties are identical
before/after; font, colors, safe-area layout and scaling were included. An early
comparison used different viewport sizes and mismatched; it was investigated,
retained as invalid evidence, then rerun at identical sizes successfully.

The original blackout selector returned zero nodes because the frozen renderer
omits the preview marker in that branch; it is explicitly **not** a passing
comparison. A separate actual blackout-DOM comparison confirms the same black
1920×1080 canvas. Switching the whole fixture from legacy to Kocokan changes
inherited foreground color on its two empty blackout DIVs (there is no text),
so that record is not labeled whole-style equality. Background/dimensions match;
this is theme-switch evidence, not a before/after regression. The renderer and
scaling source are unchanged, and the new blackout DOM test passes.

The standalone Audience fixture omits AudienceLayout and therefore does not
reproduce the `/display` backdrop. Its screenshot only illustrates the renderer
fixture, not full Audience visual acceptance. Actual `/display` remains dark.

During synthetic setup preparation an empty-pool save showed the existing atomic
save error. No partial save was claimed. Later attempts to capture insufficient
capacity overlapped hot reload; the retained image is correctly labeled **dirty
controls**, not an insufficient-capacity PASS. No speculative functional fix
was bundled. A hot reload also resumed the private Practice presentation's
manual stage; the same selected six tickets remained after stopping it again.

## Review boundary

Assumption: the approved regression policy permits only the exact existing
failure identities/signatures; it does not waive manual release gates. All
uncovered states above remain explicit follow-up, not implied PASS.
Recovery remains read-only with respect to winner selection; AST and frozen-path
audits confirm no business/control-flow changes. Tests were neither deleted nor
weakened. No new Skip/Pause/Resume action was added; the existing countdown
`Lewati animasi` action was preserved.

Stop here for owner visual review. Slice 3 is not accepted until the owner says
so, and Slice 4 is not started. No release-ready or official-Live readiness claim.
