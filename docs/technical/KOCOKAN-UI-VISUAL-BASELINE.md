# Kocokan UI — Visual Baseline and Browser Checklist

## Evidence boundary

Captured 2026-08-31 in the Codex in-app browser on Windows at
`http://localhost:5173`, against production source checkpoint
`523da4642556aa8ae033f6cf61cd1f663d211249`. This is the existing development
server, not an immutable packaged release or Chrome/Edge owner acceptance.
No application source changed during capture. Screenshots document the old UI,
not a proposed redesign or an acceptance PASS.

Existing isolated test Event: `UJI UI 11.2A — Status Audiens`, draft, displayed
counts 0 participants / 0 prize categories / 0 Live sessions. No new Event,
participant, category, draw, winner, import, export, activation or settings save
was submitted. The Event activation dialog was opened and **cancelled**; the
Event remained Draft and the visible update timestamp remained 31 Aug 10.10.
Normal navigation/runtime presence occurred, but no official workflow was run.

The first browser attach timed out; one fresh-tab retry succeeded. The native
History menu closed between observations once; it was rechecked, reopened and
captured rather than using a stale locator. A modal DOM-evaluation attempt
timed out; screenshot and fresh DOM snapshot still showed the dialog. Cancel
succeeded and returned focus to its trigger. These tooling observations do not
establish application flakiness or constitute test-suite failures.

All 15 retained captures are JPEGs (the browser returns JPEG bytes), and their
decoded dimensions were checked against filenames. The committed
[screenshot manifest](evidence/kocokan-ui-baseline/screenshots.json) records
dimensions, byte sizes and SHA-256 hashes. An initial incomplete
Audience capture during viewport change was replaced by a stable 1920x1080
capture after checking the rendered viewport. No image editing was used.
Temporary viewport override was reset; the test Operator tab and the Audience
tab launched by this check were closed. No user tab was discarded.

## Screenshot register and observations

`OBS` = observed baseline state, not visual PASS. `NR` = not run/captured.
For compactness, screenshot links open the recorded viewport image.

| Surface/state | 1366x768 | 1440x900 | 1920x1080 | Actual observation |
|---|---|---|---|---|
| Dashboard, zero-count draft Event | [OBS](evidence/kocokan-ui-baseline/dashboard-1366x768.jpg) | [OBS](evidence/kocokan-ui-baseline/dashboard-1440x900.jpg) | [OBS](evidence/kocokan-ui-baseline/dashboard-1920x1080.jpg) | Dark shell, five metric blocks, next-draw/operations cards, amber Waiting badge; heading/actions visible in these captures |
| Participants, upload/no file + saved-preview failure | NR | [OBS](evidence/kocokan-ui-baseline/participants-1440x900.jpg) | NR | Four-step import, target card, upload control; saved-participant panel reports read failure; fixed setup footer right action clipped |
| Draw Setup, missing-category/unevaluated readiness | NR | [OBS](evidence/kocokan-ui-baseline/draw-setup-1440x900.jpg) | NR | Capacity panel dominates above fold; raw Event ID shown in disabled selector; lower controls require scroll; fixed setup footer clips right action |
| Live Draw queue, empty | NR | [OBS](evidence/kocokan-ui-baseline/live-queue-1440x900.jpg) | NR | Compact header and empty Card with Create Session; no run/preview available |
| Pending Results landing, empty | NR | [OBS](evidence/kocokan-ui-baseline/pending-1440x900.jpg) | NR | Large centered completion-like empty card; no actual pending winners |
| History, no official sessions | NR | [OBS](evidence/kocokan-ui-baseline/history-1440x900.jpg) | NR | Empty card and Export (0); populated table not exercised |
| History Export dropdown, open | NR | [OBS](evidence/kocokan-ui-baseline/history-export-menu-1440x900.jpg) | NR | Anchored menu, CSV keyboard focus ring, XLSX option; no export triggered. Source confirms in-place menu, not body portal |
| Settings Branding | NR | [OBS](evidence/kocokan-ui-baseline/settings-branding-1440x900.jpg) | NR | Grouped raw fields/assets; save disabled; footer occupies bottom and right action clips |
| Settings Display/static Audience preview | NR | [OBS](evidence/kocokan-ui-baseline/settings-preview-1440x900.jpg) | NR | Output/safety controls and static preview; English preview copy remains among Indonesian controls; this is NOT the live DrawRun preview |
| Event activation confirmation Modal | NR | [OBS](evidence/kocokan-ui-baseline/event-confirmation-modal-1440x900.jpg) | NR | Dark contained dialog with backdrop blur, mixed English/Indonesian, visible Cancel focus. Cancel returned focus to Activate trigger; no activation |
| Audience standby, no participants/results | [OBS](evidence/kocokan-ui-baseline/audience-1366x768.jpg) | [OBS](evidence/kocokan-ui-baseline/audience-1440x900.jpg) | [OBS](evidence/kocokan-ui-baseline/audience-1920x1080.jpg) | Standby heading and Event identity; no public buttons. Heading fits one line at smaller captures and two at 1920. Safe-area setting currently 0px |
| Event form/list | NR | DOM inspected; visible behind modal | NR | Existing draft and counts inspected; no submit |
| Prize Category form/list | NR | NR | NR | Source-inventoried only; no category created |
| DrawRun and live AudiencePresentation preview | NR | NR | NR | No persisted session in this profile; deliberately not seeded or fabricated |
| Pending detail/multi-redraw and ReasonSelect body portal | NR | NR | NR | No pending session; source-inventoried only |
| Populated History/detail/All Winners | NR | NR | NR | No official sessions; source-inventoried only |

Settings' managed open-display action created the real scoped Audience tab:
`/display?eventId=24e47f28-dff7-4f33-ba7b-cfe8370df21c&displayConfigurationId=ac02b41b-4c56-4866-b5e2-3c4ce9fdf4e3`.
The public page showed “Menunggu undian berikutnya”; the Operator later showed
“Terhubung”. This is a focused launch/standby observation only. Display-test,
Show/Hide, reconnect cycles, blackout, fullscreen/F11, actual draw and export
were not exercised. Those gates remain open.

## Existing issues observed (not fixed)

| ID | Observation | Classification / follow-up |
|---|---|---|
| VB-01 | Participants saved preview shows “Peserta tersimpan tidak dapat dibaca dengan aman” despite zero-count test Event | Pre-existing runtime observation. Root cause unknown; independent Phase 11 investigation, not silently styled away |
| VB-02 | Fixed setup continuation footer clips its right Next action on captured Participants/DrawSetup/Settings at 1440x900 | Pre-existing visual defect to address only within approved S2 footer scope, with viewport regression checks |
| VB-03 | Shared confirmation dialog still uses “Operator confirmation”, “Review the consequence”, “Cancel”, “Close” | Pre-existing localization debt; no mass copy rewrite in Slice 0. Reconcile separately before asserting localization completeness |
| VB-04 | Settings static preview shows English public sample text and a different presentation composition from live standby | Existing static preview limitation, not evidence of live synchronization failure. Freeze internals; broader preview convergence requires separate approval |
| VB-05 | Draw Setup with no category shows the Event identifier rather than display name in its disabled selector | Pre-existing state/copy observation; do not change the Event ownership/read model to improve screenshot |

These observations are not an exhaustive defect audit. Only the captured
states are known; no populated data, error injection, or full keyboard journey
was performed. In particular the DrawRun live preview still needs a valid
disposable persisted session before its no-change visual baseline is complete.

## Manual baseline and acceptance checklist

Run every row at **1366x768, 1440x900 and 1920x1080** unless it explicitly
requires a fullscreen output target. Record browser/version, viewport, commit,
Event/fixture, mode/state, screenshot, actual observation and pass/fail.
Use supported Chrome and Edge for final acceptance; in-app screenshots are
supporting evidence, not a replacement. Do not label an NR cell PASS.

Before implementation of an affected slice, capture any missing pre-change
state using a disposable test Event/profile through existing supported flows.
Do not reset real IndexedDB data or alter official History for a screenshot.
If establishing a valid Live fixture needs additional authority, ask first;
do not seed fake records or bypass command contracts. Unavailable automation
does not block preparation, but missing evidence must remain explicit.

### Global and interaction checks

- [ ] Shell/sidebar/header: long Event name, active/disabled nav, Waiting,
  Connected, reconnecting, unavailable/publication failure, no clipped actions.
- [ ] Event menu: keyboard arrows/Home/End/Escape/outside close, focus return,
  long options; no accidental selection while taking screenshots.
- [ ] Primary/secondary/success/danger/quiet/icon controls: hover, active,
  focus-visible, disabled/loading, keyboard labels, no layout shift.
- [ ] Modal types: information, confirmation, warning, destructive, recovery;
  narrow and wide multi-winner bodies; keyboard trap/inert background, focus
  return, long copy; destructive confirmation remains explicit.
- [ ] ReasonSelect body portal inside a decision modal: dark/legacy leakage,
  z-index/clipping, keyboard operation, selected state and modal inert behavior.
- [ ] SidePanel and Toast: overflow, live-region semantics, dismiss and timer
  behavior; error toast persistence; no overlay obscures a primary action.
- [ ] Native title/help text and validation descriptions remain reachable;
  error/disabled status is not communicated by color alone.
- [ ] Reduced-motion preference, 200% zoom/reflow where practical, tab order,
  visible focus, no body-horizontal overflow and usable table horizontal scroll.

### Route and state checks

- [ ] Dashboard: no Event, invalid reference, loading/read failure, ready Event,
  zero/many participants, pending results, next action, recent results if present.
  Do not invent a new metric/backend query merely to fill a redesign card.
- [ ] Events/Prize Categories: create/edit/read-only, long labels, activation
  and deletion confirmation, category ordering; preserve existing guards.
- [ ] Participants: no file, CSV/XLSX, worksheet choice, mappings, duplicates,
  leading-zero tickets, empty/malformed rows, strategy/replace acknowledgement,
  committing/success/failure, persisted table and pagination.
- [ ] Draw Setup: capacity shortfall, custom 1–100 alignment, quick counts,
  dirty/pristine/read-only, check-in/group filters, Live/Practice,
  Instant/Random Number Roll, timed/manual, sequential/simultaneous.
- [ ] Live queue/DrawRun: ready, missing/unknown session, preflight, hold-to-start,
  countdown, rolling, stop/reveal, pending handoff, Practice completion,
  quick redraw and interrupted recovery. Preserve immutable selected tickets.
- [ ] Pending: landing empty/multiple sessions, detail with 1/6/20/100 winners,
  persistent selection during hover/focus, partial confirmation, cancel/redraw
  reason, insufficient replacement capacity, complete/Start Next Draw.
- [ ] History: zero/filter-empty/1/5/10 sessions, compact table, all winners,
  detail and incomplete records, cancelled/replacement lineage, export menu.
- [ ] Settings: all four sections, unsaved/save/error, local assets, switches,
  disabled audio/test, display-test feedback, popup fallback, status ownership.
- [ ] Global loading/empty/blocked/recovery/storage failure and sanitized
  error boundary/404, including portals outside the production shell.

### Required workflow and isolation checks

- [ ] Dashboard -> Participants -> Draw Setup -> Live Draw -> Pending -> History.
- [ ] Settings -> Audience Display test -> normal standby; save/test ownership
  stays separate and no official results are created by a display test.
- [ ] History -> Show on Audience -> Hide/Standby, including reload and late join.
- [ ] Audience and live preview: compare the same public snapshot at baseline
  and after theme changes; render 1/6/10/20/fallback winners, exact leading zeroes,
  safe area, local branding, blackout, reconnect and F11. Preview outer frame
  may change, actual rendered presentation may not.
- [ ] `/dev/prototypes` and prototype display before/after shared primitive work:
  no unintended Kocokan tokens, typography, colors, spacing or portal styling.
- [ ] Compare computed baseline vs changed styles where inheritance is risky:
  generic `--app-bg`, `--text-primary`, `--accent`, spacing/radius/font tokens
  must not leak from the new production theme into preview internals.
- [ ] Final S7: every production row in the surface inventory has an explicit
  observed outcome; remaining legacy production styling is a blocker, not an
  undocumented exception. Re-run full suite and independent release gates.

## Handoff

Slice 0 has enough evidence to establish a traceable starting point and expose
coverage gaps. It does not authorize starting Slice 1, resolving unrelated
functional debt, or declaring the redesign/browser acceptance complete.
