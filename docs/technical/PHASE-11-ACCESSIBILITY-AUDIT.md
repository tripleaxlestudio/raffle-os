# Phase 11.1 Accessibility and Motion Audit

## Status

**IMPLEMENTATION COMPLETE — CURRENT CHROME/EDGE AND ASSISTIVE-TECHNOLOGY
SIGN-OFF PENDING**

This record covers the core Slice 11.1 remediation on 2026-08-28. It does not
claim Phase 11 acceptance and it does not replace the required B11-019 and
B11-020 runs in `PHASE-11-BROWSER-MATRIX.md`.

Conditional Slice 11.1A is excluded. D11-003 and D11-004 still require owner
approval or deferral, so no high-readability or large-number Audience setting
was added.

## Scope and method

The review covered production navigation, menus, dialogs, participant import,
Draw setup and operation, Pending verification, redraw, History, Settings,
recovery messaging, blackout, and Audience presentation states. Evidence came
from source inspection, focused React/Vitest regressions, calculated token
contrast, and component-level observation in the in-app Chromium browser.

DOM automation supports the findings below but does not substitute for a
keyboard-only end-to-end run, a visual review in current Chrome and Edge, or a
screen-reader run on the release candidate.

## Findings and remediation

| ID | Finding | Resolution and evidence |
|---|---|---|
| A11-001 | The production Operator shell had no direct keyboard entry to main content. | Added a first-focus skip link and a programmatically focusable `main`; router regression verifies order and target. |
| A11-002 | Event and History export menus did not provide complete menu-key behavior or deterministic focus entry/restoration. | Added controlled IDs, `aria-controls`, initial focus, Arrow/Home/End navigation, Escape dismissal, and trigger focus restoration; covered by focused tests. |
| A11-003 | Modal content portaled outside the Operator token scope and background content was still exposed while a modal was active. | The modal layer now carries the Operator interface scope; sibling roots become `inert`, page scrolling is locked, and prior inert/focus state is restored on close. Modal tests cover containment support and cleanup. |
| A11-004 | The SidePanel backdrop was a keyboard and accessibility-tree stop even though it only duplicated dismissal. | Backdrop remains pointer-operable but is removed from sequential focus and the accessibility tree; the named dialog and close control remain available. |
| A11-005 | Several custom focus rules removed outlines or used an invalid focus token as a complete shadow value. | Replaced them with explicit high-contrast outlines for event menus, metric cards, draw-mode choices, redraw choices, and export items. |
| A11-006 | Repeated same-tone `StatusBanner` instances could produce duplicate description IDs. | IDs now come from React `useId`; a regression verifies unique relationships. |
| A11-007 | Audience changes and blackout lacked a consistent polite announcement, and countdown semantics incorrectly described the value as static. | Added one atomic live status for every authoritative Audience state, an explicit blackout status, and accurate countdown naming. Announcements do not imply that rolling selects the result. |
| A11-008 | Reduced-motion handling did not cover sequential winner reveal, rolling updates, the Settings toast, or all decorative CSS transitions/animations. | Added a shared media-query hook, immediate authoritative ticket reveal, stopped synthetic rolling updates, immediate toast completion, and global/component reduced-motion CSS. Result data and draw selection remain unchanged. |
| A11-009 | Core muted text, focus boundaries, primary actions, and danger actions needed a defined contrast floor. | Adjusted semantic tokens and separated danger-action tokens; ratios are recorded below. |
| A11-010 | Settings connection changes and the native branding color picker needed clearer semantics. | Connection state is an atomic polite status; each color picker has an explicit accessible name. |
| A11-011 | Replace-import confirmation used unstyled native actions, weakening visual priority and focus consistency. | Reused the shared primary/secondary Button treatment and added a regression for action hierarchy. |

## Contrast evidence

Ratios were calculated from the shipped default Operator tokens using WCAG
relative luminance. Disabled controls are not used to convey an available
action; their disabled state is also exposed semantically.

| Use | Foreground / background | Ratio | Result |
|---|---|---:|---|
| Muted normal text | `#858d9d` / `#1d212b` | 4.82:1 | PASS for normal text |
| Primary action text | `#f4f6fa` / `#6957ea` | 4.68:1 | PASS for normal text |
| Primary hover text | `#f4f6fa` / `#7059e6` | 4.56:1 | PASS for normal text |
| Danger action text | `#ffffff` / `#b93642` | 5.72:1 | PASS for normal text |
| Danger hover text | `#ffffff` / `#c83f4d` | 4.91:1 | PASS for normal text |
| Strong boundary | `#626b7c` / `#171a22` | 3.24:1 | PASS for non-text UI |
| Focus indicator | `#9b92ff` / `#171a22` | 6.58:1 | PASS for non-text UI |

User-selected branding can create combinations outside the default palette.
Those combinations remain part of B11-016/B11-020 visual acceptance and must
be checked on the target display.

## Non-color communication

- Practice and Live use persistent text labels and confirmation language, not
  color alone.
- connection, reconnect, blackout, Pending, recovery, and validation states
  expose textual status or alert content;
- destructive and official-history actions retain explicit labels,
  consequences, and required acknowledgements/reasons; and
- Audience verification/confirmation states use text and structure in addition
  to styling.

## Manual observations available in this slice

| Surface | Environment | Observation |
|---|---|---|
| Operator Events | In-app Chromium, 1440 × 900 and 1366 × 768 | No horizontal page/main overflow; primary form and action remained usable. This is not a Chrome/Edge matrix result. |
| Event menu | In-app Chromium, 1366 × 768 | Focus entered the menu, visible 3 px outline was present, Escape closed it and restored trigger focus. |
| Modal | In-app Chromium, Practice prototype | Named modal exposed `aria-modal`; initial focus was visible, non-modal roots were inert, and Escape restored focus. |
| Audience 20-ticket reveal | In-app Chromium, 1920 × 1080 component prototype | 5 × 4 ticket grid fit without viewport overflow; ticket strings remained dominant; verification state used text as well as visual styling. This is not a production two-window acceptance run. |

The skip-link behavior, complete focus trap, and reduced-motion result
invariance have automated regressions, but still require human execution in
the release browser matrix.

## Automated evidence

Focused regressions cover the changed Operator shell, menus, modal/side panel,
status banners, Settings toast, import confirmation, and Audience semantics and
reduced-motion behavior. Final repository command results are recorded in
`PHASE-11-ACCEPTANCE.md`.

## Remaining acceptance evidence

The following work remains release-blocking evidence, not known unremediated
code defects:

- execute the full disposable-event critical journey keyboard-only in current
  Chrome and Edge (B11-019), including Live confirmation, Pending, redraw,
  History, Settings, recovery, blackout, and error recovery;
- execute the same journey with reduced motion enabled in both browsers and
  verify the authoritative result never changes (B11-020);
- perform an assistive-technology pass on Windows, including landmarks,
  dialogs, errors, status announcements, and Audience state changes;
- visually inspect all built-in semantic/overlay states and representative
  approved branding combinations on the target Operator and Audience displays;
  and
- run the production two-window Audience sequence and record browser versions,
  device, Event/DrawSession identifiers, operator, timestamp, and evidence in
  the Phase 11 browser matrix.

## Slice verdict

No known critical accessibility code defect remains from this source and
component-level audit. Slice 11.1 implementation is complete, but the
Accessibility release gate remains **IN PROGRESS** until B11-019, B11-020, and
the assistive-technology/visual sign-off above are recorded on a release
candidate.
