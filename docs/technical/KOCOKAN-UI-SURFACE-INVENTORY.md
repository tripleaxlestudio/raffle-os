# Kocokan Production UI Surface Inventory

Baseline: `523da4642556aa8ae033f6cf61cd1f663d211249`, 2026-08-31.
This is source inspection, not a claim that all runtime states were exercised.
See [browser evidence](KOCOKAN-UI-VISUAL-BASELINE.md) for actual observations.
All future slice assignments refer to the [redesign plan](KOCOKAN-UI-REDESIGN-PLAN.md).

Slice 1 implementation/verification is recorded separately in the
[Slice 1 report](KOCOKAN-UI-SLICE-1.md). The tables below preserve the accepted
Slice 0 inventory; they are not rewritten as broader page acceptance.

## Reading the tables

Paths are repository-relative. To keep rows readable:

- `OP/` = `src/pages/operator/`; `UI/` = `src/shared/ui/`;
  `C/` = `src/shared/components/`; `DRAW/` = `src/ui/operator/draw/`;
  `IMPORT/` = `src/ui/operator/participant-import/`.
- Styles: **T** = `src/styles/tokens.css`; **P** = `primitives.css`;
  **O** = `operator.css`; **A** = `app.css`; **AUD** = `audience.css`.
  All styles live in `src/styles/`. T is inherited by every current surface.
- **Audience touch** means direct render/style coupling, not merely a button
  that publishes or opens Audience. Header controls affect Audience behavior
  but their chrome is Operator-owned. **Frozen** forbids redesign of internals.
- S1 owns primitive treatment; S2–S6 own page composition, raw-control adapters,
  and state-specific placement. S7 checks every row. A row can therefore have
  two owners without permitting duplicate CSS.

## Global surfaces

| Surface | Owning file/component | Styles | Shared primitives / patterns | Audience touch | Portal | Slice |
|---|---|---|---|---|---|---|
| App shell / scroll regions | `src/app/layouts/ProductionOperatorLayout.tsx` | T/A/O | OperatorSidebar, StartupRecoveryGate, Outlet | Hosts publisher; do not remount it | No | S1 |
| Sidebar, identity, active/disabled navigation, icons | `src/app/shell/OperatorSidebar.tsx` | T/A/O | Icon, NavLink; shared production/prototype renderer | No | No | S1; production opt-in only |
| Header/Event selector/context popover | `ProductionOperatorHeader` in `src/app/layouts/ProductionOperatorLayout.tsx` | T/A/O | Raw button, Link, Icon, menu keyboard/outside handling | No presentation; selection ownership frozen | No (absolute popover) | S1 |
| Audience shortcut and standby | Same header; `C/AudienceDisplayButton.tsx` | T/O/P | Icon, Button; managed launcher | Behavior-bound, no stage styling | No | S1 |
| Global connection state | `C/AudienceConnectionStatus.tsx`; header/Dashboard | T/O | Icon + stable data-connection-state | Presence semantics frozen | No | S1 |
| Global mode indicator | Header and `src/app/shell/ModeBadge.tsx` | T/A/O | `.mode-badge`, explicit mode text | No | No | S1; prototype stays legacy |
| Setup continuation footer | `C/ProductionSetupContinuation.tsx` | T/O/P | Button, Icon, ordered journey | No; navigation unlock contract frozen | No (fixed footer) | S2 |
| Persistence status | `C/OperatorPersistenceStatus.tsx` | T/P/O | StatusBanner, Button | No | No | S1 primitive / S6 composition |
| Settings toast | `OP/SettingsSaveToast.tsx` | T/O | Icon; raw close button; live-region/timers | No | No (fixed visual positioning) | S6 |
| Shared toast | `UI/Toast.tsx` | T/P | Button, role/status semantics | Shared usage must stay isolated | No | S1; consumers audited S6 |
| Tooltips | Native `title` on header/disabled navigation/actions | Browser chrome; O for host controls | No shared custom tooltip component found | No | Browser-owned, not React portal | S1/S6; no new tooltip engine implied |
| Reason-select dropdown portal | `ReasonSelect` in `OP/ProductionPendingResultsPage.tsx` | T/O + inline `StylesConfig` (hardcoded dark menu) | Existing `react-select` | No | Yes, `document.body`, fixed menu, z-index 2000 | S1 theme propagation design / S4 adapter |
| Modal portal | `UI/Modal.tsx`, `UI/ConfirmationDialog.tsx` | T/P/O | Button, Icon, explicit/inferred semantics, focus/inert | No; used from draw workflows | Yes, `document.body`, data-interface=operator | S1 foundation; dialog bodies S2–S6 |
| Side panel portal | `UI/SidePanel.tsx` | T/P | Button, Icon, focus restoration | Shared with prototype consumers; no direct Audience | Yes, `document.body` | S1; production consumers verified S6 |
| Application error boundary | `src/app/errors/AppErrorBoundary.tsx` | T/A | Sanitized message, reload button | May wrap Audience too: do not blanket theme | No; outside shell | S6 |
| Route errors / 404 | `src/app/errors/RouteErrorPage.tsx`, `src/pages/system/NotFoundPage.tsx` | T/A | Link; no raw-stack rendering | Shared route errorElement for display/dev | No; outside shell | S6 with explicit production ownership |
| Optional existing runtime diagnostics | `ProductionAudienceDiagnostics` in layout; `src/application/display-transport/RuntimeDiagnostics.tsx` | T/O | Definition lists, conditional debug UI | Reads transport diagnostics; do not change it | No | S6 chrome only; no new Log route |

## Production routes

The exact route mapping is `src/app/router.tsx`. Do not infer production usage
from file names: `LiveDrawPage`, `DashboardPage`, `HistoryPage`, `SettingsPage`
are prototype implementations, while production uses the files below.

| Route/surface | Owning file/component | Styles | Shared primitives | Audience touch | Portal | Slice |
|---|---|---|---|---|---|---|
| `/` | Router redirects to `/dashboard` | Shell only | Navigate | No | No | S1 verify unchanged |
| `/dashboard` | `OP/ProductionDashboardPage.tsx` | T/P/O | PageHeader, MetricCard, Card, ButtonLink, StatusBanner, connection badge | Launch/presence only | Header context only | S2; shared badge S1 |
| `/events` | `OP/EventsPage.tsx` | T/P/O | Input, Card, Button, Badge, ConfirmationDialog, Modal + raw form hooks | No | Activation/deletion dialogs | S2 |
| `/prize-categories` | `OP/PrizeCategoriesPage.tsx` | T/P/O | Card, Button, Input, Badge; raw number/text controls | No | No direct portal | S2 |
| `/participants` | `OP/ParticipantsPage.tsx` delegates to `IMPORT/ProductionParticipantImportPreview.tsx` | T/P/O | Card, Badge, Button, Select, Table, Pagination, ProgressStepper, Modal, ConfirmationDialog | No | Import/replace confirmation | S2 |
| `/draw/setup` | `OP/DrawSetupPage.tsx`; `DRAW/DrawPresentationSettings.tsx` | T/P/O | Card, FieldGroup, Input, Select, Toggle/Checkbox patterns, Badge, Button, Modal | Configuration only; no renderer | Pending review and Live continuation | S3 |
| `/draw/live` (landing/queue) | `OP/DrawSessionQueuePage.tsx` | T/P/O | Card, Badge, ButtonLink, Icon, native mode controls | Presence/launch only | No direct portal | S3 |
| `/draw/run/:drawSessionId` | `OP/DrawRunPage.tsx`; `DRAW/ProductionDrawPresentation.tsx` | T/P/O + AUD in preview | Header/recap/control deck, Card, Button, Modal, recovery dialog | **Direct live AudiencePresentation preview, frozen** | Quick redraw, selection, recovery | S3; related selection S4 |
| `/draw/pending` | `OP/ProductionPendingResultsLandingPage.tsx` | T/P/O | PageHeader, Card, ButtonLink, Icon, workspace states | No direct stage | No direct portal | S4 |
| `/draw/pending/:drawSessionId` | `OP/ProductionPendingResultsPage.tsx` | T/P/O + inline reason styles | Card, Badge, Button, Modal, ConfirmationDialog, react-select | Publishes committed state; no preview fork | Decision dialogs + body select menu | S4 |
| `/history` | `OP/ProductionHistoryPage.tsx` session list | T/P/O | Table, Badge, Button/Link, raw compact filters | Show/Hide actions; state contract frozen | Export menu is in-place, NOT portal | S5 |
| `/history/:drawSessionId` | Same file, detail branch | T/P/O | Card summaries, Table, Badge, audit timeline | Presentation actions if eligible | No direct portal | S5 |
| `/history/winners` | Same file, All Winners branch | T/P/O | Table, Badge, ButtonLink, filters | No direct renderer | No direct portal | S5 |
| `/settings` | `OP/ProductionSettingsPage.tsx` | T/O/P + AUD for static preview | Button, Icon; many raw inputs/selects/switches; SettingsSaveToast | **Direct AudiencePreviewSurface; test/launch actions** | No main portal; native menus | S6 |
| `/display` | `src/app/layouts/AudienceDisplayShell.tsx`, `src/pages/display/AudienceDisplayPage.tsx`, `src/ui/audience/AudiencePresentation.tsx` | T/AUD (plus shared imports) | Audience stages/EventBrand/ticket grids | **Entire presentation frozen** | None in normal public output | No redesign; S1/S3/S6/S7 isolation regression |

### Route/state variants that must not be missed

| Variant | Owner | Styles/primitives | Audience / portal | Slice |
|---|---|---|---|---|
| Import upload, reading, unsupported, parse error | ProductionParticipantImportPreview | O/P; file input, Button, StatusBanner | No / no | S2 |
| XLSX worksheet, column mapping, validation rows | Same production import file | O/P; Select, Table, field errors | No / confirmation only later | S2 |
| Strategy selection, replace acknowledgement, committing, success/failure | Same production import file | O/P; Card, ConfirmationDialog, Modal, status | No / yes | S2 |
| Saved participant preview, paging, empty/read failure | Same production import file | O/P; Table, Pagination, alert | No / no | S2 |
| Event activation and permanent deletion confirmation | EventsPage | O/P; Modal/Input/ConfirmationDialog | No / yes | S2; preserve exact-name guard and counts |
| Draw authoring vs persisted locked edit; capacity and custom count | DrawSetupPage | O/P; number input, presets, sections | Config only / review Modal | S3 |
| Ready/preflight/countdown/rolling/reveal/complete | DrawRunPage + ProductionDrawPresentation | O/P; Button/recap/locked ticket grids | Live preview frozen / recovery Modal | S3 |
| Timed/manual stop and sequential/simultaneous presentation controls | DrawPresentationSettings + ProductionDrawPresentation | O/P; radios/buttons | Settings/projection frozen / redraw Modal | S3 |
| Pending individual/multi-select, partial confirm, cancel/redraw reason | ProductionPendingResultsPage | O/P + inline select styles | Publication behavior / both portals | S4 |
| Multi-winner quick-redraw selection in Run | ProductionDrawPresentation | O/P; labels/checkboxes/Modal | Shared public renderer untouched / yes | S4 selection; S3 surrounding run chrome |
| Completed Pending and correction actions | ProductionPendingResultsPage | O/P; Card/ButtonLink | No new publication / correction dialog | S4 |
| History empty vs filtered-empty vs populated | ProductionHistoryPage | O/P; empty Card vs Table | Show/Hide behavior / no | S5 |
| History detail inconsistency/missing record/audit lineage | Same history file | O/P; status/Table/timeline | Read-only integrity / no | S5 |
| Settings Presentation, Display, Branding, Audio sections | ProductionSettingsPage | O/P; raw controls and section-nav buttons | Static preview frozen / native select only | S6 |
| Settings unsaved/saving/saved/error, audio unavailable, popup fallback | Same settings file + SettingsSaveToast | O/P; Button/status/toast/details | Existing display/audio tests / no | S6 |

## Cross-app state ownership

| State | Owning component/files | Styles | Primitive usage | Audience touch | Portal | Slice |
|---|---|---|---|---|---|---|
| Loading | `C/ProductionWorkspaceState.tsx` (ProductionLoadingState), route loading branches | T/P/O | Card, aria-live, PageHeader | No | No | S1 primitive / S6 composition; route owner fits |
| Empty/no Event | Same file (ProductionSetupRequired), Dashboard and landing/history branches | T/P/O | Card, ButtonLink, Icon | No | No | S2/S4/S5, final S6 audit |
| Blocked/invalid reference | DrawSetup/DrawRun; Dashboard invalid-reference; StatusBanner | T/P/O | Button, Card, warning | Recovery guard unchanged | Sometimes Modal | S3/S6 |
| Ready/capacity | DrawSetupPage, DrawRunPage, queue | T/P/O | Badge, capacity metrics, Start controls | Ready is not proof of display connection | Live confirm Modal | S3 |
| Live | Header, queue, DrawSetup, DrawRun, Pending | T/A/P/O | Explicit mode word/control, badge | Semantics frozen | Confirmation portals | S1/S3/S4 |
| Practice | Same ownership; ProductionDrawPresentation completion | T/A/P/O | Mode controls, practice notice/reset | Must not mutate official records | Applicable dialogs only | S1/S3 |
| Pending | Pending landing/detail, Run handoff, History rows | T/P/O | Winner rows, Badge, action bar | Public state contract unchanged | Decision portals | S4/S5 |
| Confirmed | Pending completion, History list/detail/All Winners | T/P/O | Badge, Table, ticket strings | Show confirmed presentation unchanged | Relevant correction only | S4/S5 |
| Cancelled | Pending/History detail and lineage | T/P/O | Badge, row/lineage, retained ticket | Never remove official history | Decision dialog before cancellation | S4/S5 |
| Recovery | `src/app/workspace/StartupRecoveryGate.tsx`; `DRAW/PresentationRecoveryDialog.tsx`; DrawRun | T/P/O | StatusBanner, OperatorPersistenceStatus, Modal | No reselection; preview projection unchanged | Yes for presentation recovery | S3 workflow placement / S6 system composition |
| Storage failure | OperatorPersistenceStatus; import/DrawRun/Pending/Settings errors | T/P/O | StatusBanner, retry Button, Modal | No protocol changes | Some blocking dialogs | S6 with route owner |
| Waiting/disconnected | AudienceConnectionStatus; draw connection view model; settings status | T/P/O | Icon, Badge, text | Existing presence/ack distinction frozen | No | S1/S3/S6 |
| Unavailable/publication failure | Same plus production fallback branches | T/P/O | Semantic status, action | Do not claim connected from old ack | Some recovery dialogs | S1/S6 |

`OP/ProductionWorkspaceBlockedPage.tsx` exists as an older presentation helper
but is NOT mounted by the current production router. Inventory it as dormant,
not an extra implemented workflow. Do not add a route to make it part of scope.

## Primitive/control inventory and duplicates

| Component type | Owner | Styles | Current pattern / duplication | Audience touch | Portal | Slice |
|---|---|---|---|---|---|---|
| Buttons and links | `UI/Button.tsx` | P/O | primary/secondary/quiet/danger; raw header, settings, start controls also exist | Shared imports; no global rewrite | Inherit portal context when nested | S1 foundation; raw controls S2–S6 |
| Cards | `UI/Card.tsx`, `C/MetricCard.tsx` | P/O | Card tone/padding plus many page-specific panels | Shared prototype use | No | S1/S2 |
| Tables | `UI/Table.tsx` | P/O | caption, scroll frame, header, empty slot; production History/Participants | No | No | S1 foundation; S2/S5 rows |
| Text/number inputs | `UI/Input.tsx`, raw controls in Events/Prize/Settings/Pending | P/O | FieldMessage/FieldGroup vs manually repeated labels | No | Some dialog fields | S1; raw fields owning slice |
| Selects | `UI/Select.tsx`; raw Settings; Pending ReasonSelect | P/O/inline | Native select vs existing react-select; native color-scheme currently dark | No | Pending menu yes | S1 foundation; S4/S6 adapters |
| Checkbox / switch | `UI/Checkbox.tsx`, `UI/Toggle.tsx`, raw Settings audio switch | P/O | Toggle uses input role=switch with track/thumb; keep this behavior | No | No standalone portal | S1/S6 |
| Segmented/radio controls | `UI/SegmentedControl.tsx`, DrawSetup, queue, DrawPresentationSettings | P/O | aria-pressed buttons vs native radios; do not swap behaviors | No | No | S1/S3 |
| Badges | `UI/Badge.tsx`, ModeBadge, AudienceConnectionStatus | P/O/A | Stable state variants; detached badges regroup in page slices | No direct renderer | Can be in Modal | S1 + owning composition |
| Status indicators/banners | `C/StatusBanner.tsx`, ReadinessChecklist, OperatorPersistenceStatus | P/O | Several copy/icon/stripe treatments | Presence semantics separate from snapshot acknowledgement | No (except nested dialogs) | S1/S6 |
| Tabs / section navigation | ProductionSettingsPage; History navigation; `UI/SegmentedControl.tsx` | P/O | Production section buttons vs prototype role=tablist; retain semantics, no invented tab API | Settings preview excluded | No | S5/S6 |
| Modals | `UI/Modal.tsx`, ConfirmationDialog, PresentationRecoveryDialog | P/O | Modal semantically infers some icons from English text; explicit props also exist | No presentation redesign | Body portal | S1 semantic API; S2–S6 bodies |
| Side panels | `UI/SidePanel.tsx` | P | Shared/dormant for some production paths; test/prototype usage remains | No | Body portal | S1; do not invent production usage |
| Dropdown menus | Header Event menu; History Export menu; ReasonSelect | O/inline | Three different owners/interaction contracts | No rendering | Only ReasonSelect uses portal | S1/S5/S4 respectively |
| Pagination | `UI/Pagination.tsx`, production participant preview | P/O | Button group; counts preserved | No | No | S1 foundation / S2 |
| File import controls | ProductionParticipantImportPreview | P/O | Native file picker, drag/input styling, mapping steps | No | Confirmation only | S2 |
| Toasts | `UI/Toast.tsx` vs SettingsSaveToast | P vs O | Duplicate visual treatments; preserve timers/live-region semantics | No | Neither currently portal | S1/S6 |
| Icons | `UI/Icon.tsx`; CSS chevrons/status dots; text markers | P/O | Existing SVG system, no icon dependency required | Audience has separate icons/decorations | No | S1 and page owners |

Prototype import step files (`IMPORT/ImportUploadStep.tsx`, ImportMappingStep,
ImportValidationStep, ImportSummaryStep) must not be mistaken for the production
import owner. The production file contains its own multi-step composition.

## Style boundary and gradient audit

Baseline stylesheet sizes: A 437 lines; T 146; P 1,131; O 7,197; AUD 840.
The two Operator layouts and Modal/SidePanel portals all currently use
`data-interface="operator"`; AudienceDisplayShell uses `audience`. Neither
AudiencePresentation nor AudiencePreviewSurface creates a complete independent
theme boundary for all inherited generic tokens. Hence changing root tokens
or all Operator tokens can change preview rendering even with untouched AUD.

Additional hazards:

- `app.css` hardcodes dark html/body fallback colors and duplicates shell rules
  later styled by O; change production roots explicitly, not all app base rules.
- P hardcodes native select `color-scheme: dark` and blur shadows on controls/
  panels/modals. Opt-in controls need explicit light/control styling.
- O contains live preview sizing/1920x1080 scaling at `.production-preview__viewport`
  and shared Settings preview selectors. These are not obsolete dashboard CSS.
- Pending ReasonSelect has hardcoded dark menu surfaces and a z-index 2000 body
  portal. Generic shell tokens alone cannot style its menu safely.
- Existing `!important` and duplicate selected-state selectors must be removed
  only with consumer evidence, not by globally defeating the cascade.

| Current gradient location (baseline line) | Consumer / role | Proposed disposition |
|---|---|---|
| `app.css:271` | Disconnected connection-status marker | S1 production opt-in icon; retain prototype behavior |
| `operator.css:533` | Duplicate disconnected marker | Same S1 boundary; no blind deletion |
| `operator.css:690` | Warning StatusBanner stripe | S1 flat/icon primitive; S6 composition audit |
| `operator.css:1243` | Import drop-zone pattern | S2 flat file-import treatment; check prototype consumers |
| `operator.css:5392` | Settings preview base background | Frozen preview internals, not Operator decoration |
| `operator.css:5524` | Duplicate Settings preview background | Preserve baseline rendering; isolate/retain with preview ownership |
| `operator.css:5525` | Shared `.settings-display-preview, .audience-preview-surface` fallback | Frozen presentation fallback; no flat Operator replacement inside preview |
| `operator.css:6590` | Legacy `.operator-audience-preview__frame` decoration | Consumer search before migration/removal; do not confuse this with the production live preview renderer |
| `audience.css:43,48,49` | Audience stage/background fallback | Frozen, excluded |
| `audience.css:63` | Audience stage overlay | Frozen, excluded |
| `audience.css:794` | Audience disconnected icon | Frozen, excluded |

No gradients were removed in Slice 0. New Kocokan Operator styling has a no-
gradient rule; existing frozen Audience/preview presentation is an explicit
exception. Do not duplicate Audience CSS into the new design system.

## Coverage completion rule

Before closing each owning slice, mark its route, component, portal, and state
rows in an appended evidence entry with commit, tests, viewports and observed
results. Before S7 closes, audit all rows plus raw controls with `rg`; any
unmigrated production Operator row is a remaining inconsistency, not an
implicit exception. Prototype/dormant rows remain recorded as excluded.
