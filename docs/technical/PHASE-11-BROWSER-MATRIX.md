# Phase 11 Browser, Viewport, and Cross-Phase Matrix

## Status

**NOT RUN — comprehensive execution is scheduled after 11.5A-D, combining
Slice 11.3, packaged acceptance in 11.5E, and the final 11.4 benchmark before
11.6 closeout (owner schedule update 2026-08-31).**

Include the approved 11.2A UI/feature items in the affected rows and add
traceable checks if the existing matrix does not cover an item's acceptance
criteria. Item 11.2A-01 covers header/Dashboard connection indicator clarity;
item 11.2A-02 covers wide standby text and removal of public fullscreen UI.
Their focused evidence is in `PHASE-11-ACCEPTANCE.md`. Focused checks continue
per slice; postponement does not mark any row passed or waive a release gate.

Use disposable Events. Never reset or mutate official History to create a test
condition. Record actual observations only.

## Environment record

| Field | Chrome run | Edge run |
|---|---|---|
| Date/time | Pending | Pending |
| Operator initials | Pending | Pending |
| Git commit / artifact version | Pending | Pending |
| Windows version | Pending | Pending |
| Browser version and profile | Pending | Pending |
| Device / power mode | Pending | Pending |
| Event ID | Pending | Pending |
| Relevant DrawSession IDs | Pending | Pending |

## Execution matrix

Use `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`. Link evidence or describe the
observation in Notes.

| ID | Journey | Viewport/display | Chrome | Edge | Required evidence / notes |
|---|---|---|---|---|---|
| B11-001 | Event create/open/autosave/reload | 1366 x 768 | NOT RUN | NOT RUN | Exact Event identity; no duplicate or loss |
| B11-002 | Event create/open/autosave/reload | 1440 x 900 | NOT RUN | NOT RUN | Layout usable and primary action visible |
| B11-003 | CSV import mapping/validation/commit | Operator targets | NOT RUN | NOT RUN | Empty/invalid/duplicate handling; `00042` distinct from `42` |
| B11-004 | XLSX import mapping/validation/commit | Operator targets | NOT RUN | NOT RUN | Text-source ticket preservation and numeric ambiguity rejection |
| B11-005 | Replace and Merge atomicity | Operator targets | NOT RUN | NOT RUN | Explicit confirmation, correct counts, no partial write |
| B11-006 | Practice setup/run/finish | Operator + Audience | NOT RUN | NOT RUN | No official History or Live eligibility mutation |
| B11-007 | Live start through Pending | Operator + Audience | NOT RUN | NOT RUN | Confirmation, snapshot identity, Pending result |
| B11-008 | Pending refresh recovery | Operator + Audience | NOT RUN | NOT RUN | Same session/winners/tickets; no reselection |
| B11-009 | Partial confirmation and refresh | Operator targets | NOT RUN | NOT RUN | Confirmed/Pending split and audit counts stable |
| B11-010 | Multi-winner redraw | Operator targets | NOT RUN | NOT RUN | Required reason; cancelled/replacement lineage |
| B11-011 | Audience state sequence | 1920 x 1080 | NOT RUN | NOT RUN | Standby/countdown/rolling/reveal/confirmed |
| B11-012 | Audience layouts | 1920 x 1080 | NOT RUN | NOT RUN | 1 hero, 6 = 3x2, 10 = 5x2, 20 = 5x4, fallback to 100 |
| B11-013 | Audience privacy | 1920 x 1080 | NOT RUN | NOT RUN | No names, notes, check-in, groups, or controls |
| B11-014 | Disconnect/reconnect/reload | 1920 x 1080 | NOT RUN | NOT RUN | Safe state and same authoritative result after reconnect |
| B11-015 | Blackout, Show/Hide, browser fullscreen | 1920 x 1080 | NOT RUN | NOT RUN | Explicit state and safe content; F11 entry/exit on Windows, no in-page fullscreen controls/status overlay (11.2A-02 owner decision) |
| B11-016 | Branding and audio failure | 1920 x 1080 | NOT RUN | NOT RUN | Local assets only; audio failure cannot cancel draw |
| B11-017 | History, audit, CSV/XLSX export | Operator targets | NOT RUN | NOT RUN | Confirmed-only export reconciles; exact ticket strings |
| B11-018 | Three repeated recovery cycles | Operator + Audience | NOT RUN | NOT RUN | Stable identity and record counts |
| B11-019 | Keyboard-only critical journey | All targets | NOT RUN | NOT RUN | Logical order, visible focus, no keyboard trap |
| B11-020 | Reduced-motion journey | All targets | NOT RUN | NOT RUN | Nonessential motion removed/reduced; result unchanged |
| B11-021 | Indonesian UI and accessible copy | All targets | NOT RUN | NOT RUN | Complete copy, correct meaning, no clipping; 11.2A-02 standby heading fits the safe area without the former narrow three-line stack |
| B11-022 | 10,000 participants / 100 winners | Agreed benchmark | NOT RUN | NOT RUN | No failure; pipeline and selection timings separated |
| B11-023 | Offline core journey | Intended setup | NOT RUN | NOT RUN | No runtime network dependency |
| B11-024 | Packaged launch and deep-link reload | Target Windows | NOT RUN | NOT RUN | Version/checksum, SPA fallback, same origin |
| B11-025 | Packaged update persistence | Target Windows | NOT RUN | NOT RUN | Same browser/profile/origin IndexedDB preserved |

## Cross-phase closure mapping

| Earlier record | Rows required before closure |
|---|---|
| Phase 3 persistence smoke | B11-001, B11-003/B11-004, B11-008, B11-018 |
| Phase 4 import acceptance | B11-003, B11-004, B11-005, B11-017 |
| Phase 6 browser recovery | B11-007, B11-008, B11-009, B11-018 |
| Phase 7 manual integration | B11-006, B11-011 through B11-016 |
| Phase 10 owner sign-off | B11-001, B11-007 through B11-010, B11-014, B11-018 |

Earlier acceptance records retain their historical wording. When these rows
run, append a dated Phase 11 evidence reference to the earlier record rather
than rewriting old NOT RUN or deferred statements.
