# Phase 2 — Static UI Prototype Implementation Plan

## Summary

Phase 1 and Phase 2 are accepted. Phase 2 delivered a deterministic,
high-fidelity prototype on the existing React/Router/Tailwind/Vitest stack
without new dependencies or production behavior. Mock data remains
presentation-only, ticket numbers remain strings, and Audience fixtures contain
public information only.

Defaults adopted because no preference response was received:

- English interface copy.
- Include a static Settings screen and disconnected-safe Audience state.
- Select prototype states through URL query parameters, with navigation controls visible only in the Operator interface.
- Use text-only fictional event branding and local CSS; no external assets, fonts, or audio.

Current implementation status:

- Slices 1 through 6 are implemented and verified.
- Acceptance-gap corrections were committed as `56dfd64`.
- The redraw drawer structure, focus behavior, backdrop layering, responsive
  layout, scrolling, footer actions, and PrototypeNavigator interaction were
  corrected in `c4ab9f8`.
- The accepted Phase 2 implementation commit is
  `c4ab9f88bdf69dca264ef5543aa695becffdaa89`.
- The accepted suite contains 22 test files and 182 passing tests; lint,
  typecheck, and the production build pass.
- The complete manual Chrome and Edge viewport, keyboard, accessibility,
  reduced-motion, contrast, and status review passes.
- This document records the completed approved Phase 2 scope and does not
  expand it into production raffle behavior.

## 1. Repository Readiness Audit

### Approved planning baseline

- Git was clean before and after verification on `main`; at planning time, `HEAD` and `origin/main` both pointed to `a253bf5bbc956ac5f62129abb3b29b1ab82455c8`.
- Git emitted a non-blocking warning because the sandbox could not read the user-level global ignore file.
- Runtime at planning time: Node `22.20.0`, npm `10.9.3`.
- Installed application dependencies: React `19.2.8`, React DOM `19.2.8`, React Router `7.18.2`.
- The existing development stack included TypeScript `6.0.3`, Vite `8.1.5`, Tailwind `4.3.3`, Vitest `4.1.10`, jsdom, Testing Library, and ESLint. No state-management, persistence, parsing, icon, animation, or component-library dependency was needed.
- `npm.cmd list --depth=0` reported several extraneous local packages. They were not declared Phase 2 dependencies and did not affect verification; do not clean or alter them as part of Phase 2.
- The Phase 1 code provided:
  - browser routing and direct routes;
  - separate Operator and Audience layouts;
  - error and not-found handling;
  - typed Practice/Live and connection-status badges;
  - foundational semantic CSS variables;
  - inert route placeholders;
  - 28 foundation tests.
- No IndexedDB, storage, parsing, random-selection, eligibility, BroadcastChannel, export, network, or file-reading code was found under `src`.
- Required planning verification passed:
  - `npm.cmd run lint`: PASS, no diagnostics.
  - `npm.cmd run typecheck`: PASS.
  - `npm.cmd run test`: PASS, 4 files and 28 tests.
  - `npm.cmd run build`: PASS, 41 modules transformed.
- At planning time, documentation drift was non-blocking and reserved for final
  Phase 2 closeout:
  - `TASKS.md` “Current Repository Baseline” and “Immediate Next Task” described
    the pre-Phase-1 scaffold.
  - `README.md` said routing, strict mode, and tests were unavailable.
  - The historical Phase 1 plan describes packages as proposed; the newer Phase 1 acceptance record and current code supersede that status.
- The Phase 2 documentation closeout resolves the first two drift items.

### Historical status after Slice 1

- At that checkpoint, `HEAD` was `1b2c0d7` (`feat: build Phase 2 dashboard
  prototype`).
- Slice 1 added the design contract, core reusable primitives, Operator shell refinement, deterministic Dashboard fixtures, Dashboard scenarios, focused styles, and tests.
- The post-Slice-1 baseline passes lint, typecheck, 41 tests across 6 files, and the production build.
- At that checkpoint, Participant Import, Draw Setup, Live Draw states, Pending
  Results, Redraw, History redesign, Settings redesign, and Audience Display
  states were not yet implemented.
- No dependency change was introduced by Slice 1.

### Final accepted status

- Branch `main` and upstream `origin/main` both pointed to the accepted
  implementation commit
  `c4ab9f88bdf69dca264ef5543aa695becffdaa89` before documentation closeout.
- All six implementation slices are complete.
- The final automated acceptance audit passed lint, typecheck, all 182 tests
  across 22 files, the production build with 96 modules transformed, and
  `git diff --check`.
- Manual verification by Ismail on 30 July 2026 passed the full Chrome and Edge
  viewport matrix, keyboard and focus checks, reduced-motion rendering,
  contrast, status recognition, Audience safe areas, and redraw-drawer review.
- No package or dependency change was introduced between the accepted Phase 1
  documentation commit and the accepted Phase 2 implementation commit.
- Production import, persistence, eligibility, secure draw selection,
  confirmation, redraw mutation, synchronization, export, recovery, backend,
  and cloud behavior remain unimplemented.

## 2. Gap Analysis Against `TASKS.md` Phase 2

| Phase 2 area | Accepted state | Resolution |
|---|---|---|
| Tokens | Complete semantic token coverage | Colors, typography, spacing, sizing, borders, radii, elevation, focus, modes, results, connection, warning, error, blackout, and layering are covered |
| Primitives | Complete | Button, Input, Select, Checkbox, Toggle, Badge, Card, Modal, Table, EmptyState, Toast, ConfirmationDialog, and supporting compositions are typed and tested |
| Operator shell | Complete | High-fidelity event-control shell, active navigation, mode distinction, display status, and Operator-only prototype navigation are present |
| Dashboard | Complete | Deterministic Dashboard scenarios and focused tests are present |
| Participant Import | Complete static prototype | Upload, mapping, validation, and summary scenarios are query-driven and presentation-only |
| Draw Setup and Live Draw | Complete static prototype | Practice/Live, sufficient/insufficient, ready, countdown, and rolling scenarios are deterministic |
| Pending, Redraw, History, Settings | Complete static prototype | Partial-result accounting, redraw relationships, history detail, and static settings surfaces are present |
| Audience Display | Complete static prototype | Seven states and exact 1/6/10/20 winner layouts are implemented with public-only data |
| Mock data | Complete | Screen-specific immutable fixtures and public-only Audience fixtures are present |
| Prototype navigation | Complete | Supported query scenarios are directly navigable with safe fallbacks |
| Accessibility | Complete for Phase 2 | Labels, focus, modal and drawer containment/return, semantic tables, keyboard paths, contrast, reduced motion, and non-color status cues passed |
| Tests | Complete | 22 files and 182 tests cover components, routes, scenarios, privacy, scope, and the deterministic happy path |
| Manual review | Complete | Chrome and Edge passed the full required viewport and presentation matrix |

## 3. Component Inventory

### Reusable primitives

- `Button`: primary, secondary, danger, quiet, loading, disabled, and icon-label variants.
- `Input`, `Select`, `Checkbox`, `Toggle`: labels, descriptions, errors, disabled states, and minimum target size.
- `Badge`: mode, result, connection, warning, and neutral variants with non-color cues.
- `Card`: default, raised, interactive, and status-accented variants.
- `Modal`: controlled presentation, labelled dialog, initial focus, Escape close, focus containment, and focus return.
- `ConfirmationDialog`: Modal specialization with explicit consequence and confirm/cancel actions.
- `Table`: semantic table shell, sortable-looking headers without real sorting, empty state, and dense operator layout.
- `EmptyState`: icon/marker, title, explanation, and optional action.
- `Toast`: status/alert semantics, dismiss action, and deterministic local rendering.

### Shared compositions

- `PageHeader`, `SectionHeader`, `StatusBanner`, `MetricCard`, `SummaryList`, `ProgressStepper`, `FieldGroup`, and `PrototypeNavigator`.
- Refine existing `ModeBadge` and `ConnectionStatus` on top of the shared Badge contract.
- Use inline SVG or CSS markers where icons materially help; add no icon dependency.

### Operator compositions

- Readiness checklist, event summary, participant stats, import drop-zone mock, mapping table, validation summary, draw configuration panel, winner-count presets, eligible-pool summary, draw control deck, Pending winner table/cards, redraw form, history table, and audit relationship detail.

### Audience compositions

- `AudienceStage`, `EventBrand`, `DisplayStateLabel`, `CountdownStage`, `RollingStage`, `WinnerStage`, `WinnerGrid`, `TicketTile`, `BlackoutStage`, and `DisconnectedStage`.

## 4. Mock-Data Architecture and Interfaces

Keep prototype contracts outside `src/domain`; they are typed view models, not premature production domain models.

- Define immutable fixture types such as:
  - `PrototypeEvent`
  - `PrototypeParticipantRow`
  - `PrototypeImportScenario`
  - `PrototypeDrawConfiguration`
  - `PrototypeWinner`
  - `PrototypeHistoryEntry`
  - `PrototypeScenarioId`
- Define `PublicAudienceScenario` as a discriminated union for:
  - `standby`
  - `countdown`
  - `rolling`
  - `winner-reveal`
  - `confirmed`
  - `blackout`
  - `disconnected`
- Audience types may contain only public event branding, prize labels, presentation state, and string ticket numbers. They must not permit participant name, check-in, group, notes, eligibility detail, redraw reason, or internal IDs.
- Use frozen, deterministic TypeScript constants. Include leading-zero examples such as `"000123"` and never generate runtime values with `Math.random()`, `Date.now()`, parsing, storage, or network APIs.
- Resolve scenarios through a small pure query parser with safe defaults:
  - `/participants?step=review`
  - `/draw/setup?mode=live&scenario=insufficient`
  - `/draw/live?state=ready|running&mode=practice|live`
  - `/draw/results?panel=summary|redraw`
  - `/display?state=reveal&count=6`
- Operator prototype controls may update route/query state. `/display` must render no scenario picker or operator control.
- Local React state is allowed only for UI demonstrations such as opening a dialog, choosing a mock tab, dismissing a toast, or advancing to another deterministic scenario. It must not mutate fixture records or claim to perform a draw, confirmation, redraw, import, or save.

## 5. Proposed Folder Structure

```text
src/
├── app/
│   └── shell/                     # refined Operator shell
├── pages/
│   ├── operator/                  # thin route-level screen composition
│   └── display/
├── prototype/
│   ├── data/                      # immutable fictional fixtures
│   ├── audience-types.ts
│   ├── operator-types.ts
│   ├── scenarios.ts
│   └── scenario-query.ts
├── shared/
│   ├── components/                # PageHeader, StatusBanner, etc.
│   └── ui/                        # reusable primitives
├── ui/
│   ├── operator/                  # operator-specific compositions
│   └── audience/                  # public display compositions
├── styles/
│   ├── tokens.css
│   ├── app.css
│   ├── primitives.css
│   ├── operator.css
│   └── audience.css
└── test/
    └── setup.ts
```

Tests should remain near the components or pages they verify. Do not create production domain, service, persistence, import-pipeline, or communication directories during Phase 2.

## 6. Screen-by-Screen Implementation Plan

| Route/surface | Static scenarios and content | Primary prototype action |
|---|---|---|
| Operator shell | Event identity, Practice/Live marker with shape/text differences, display connection, blackout affordance, active navigation, prototype scenario menu | Navigate to the next relevant screen; no mode or blackout behavior |
| `/dashboard` | Event readiness, participant totals, display state, configured prize, next draw summary, recent mock activity | “Set up next draw” routes to Draw Setup |
| `/participants` | Four wizard views: file selection, column mapping, validation review, import summary; realistic valid/duplicate/empty/malformed rows | Advance the query-driven wizard; never read a file or commit data |
| `/draw/setup` | Category, prize, presets 1/3/6/10/20/50, custom-count appearance, check-in/group/winner-rule controls, eligible summary, insufficient-pool warning | “Review draw” routes to Live Draw ready state |
| `/draw/live?state=ready` | Configuration recap, Live/Practice warning, display readiness, presentation sequence, static hold-to-start treatment | Open a visual confirmation dialog or route to running scenario |
| `/draw/live?state=running` | Countdown/rolling progress presentation, locked-looking configuration, Audience preview, skip/abort affordances | Navigate to Pending Results; no timer or result generation |
| `/draw/results` | Pending winner cards/table, selected and partially confirmed visual scenarios, clear internal participant details restricted to Operator | “Review and confirm” changes only the displayed scenario |
| Redraw panel | Open from Pending Results; single/multi-selection, approved reason list, required “other” note appearance, cancelled-to-replacement preview | Close or advance to replacement preview without changing records |
| `/history` | Search/filter appearance, session table, status badges, cancelled rows, replacement linkage, chronological detail | Open a static session detail; no export |
| `/settings` | Polished static branding, timing, audio, and display-preference controls using fictional values | “Preview display” opens a display scenario; no file loading or saving |
| `/display?state=standby` | Text-only event identity, prize teaser, waiting message | Direct query navigation only |
| `countdown` | Dominant countdown numeral and draw label | Direct query navigation only |
| `rolling` | Clearly presentational ticket stream/tiles with reduced-motion fallback; no candidate logic | Direct query navigation only |
| `reveal` | Ticket numbers plus neutral “Results under verification” treatment | Support counts 1, 6, 10, and 20 |
| `confirmed` | Same result layouts with unmistakable Confirmed marker | Support counts 1, 6, 10, and 20 |
| `blackout` | Completely dark safe surface with no branding or controls | Direct query navigation only |
| `disconnected` | Safe public connection-interrupted message and no stale winner data | Direct query navigation only |

Winner layouts:

- 1: single hero ticket.
- 6: exact 3 × 2 grid.
- 10: exact 5 × 2 grid.
- 20: exact 5 × 4 grid.
- Ticket numbers remain the largest and highest-contrast content.
- Counts beyond 20 remain deferred; Phase 2 must not imply the later fallback-to-100 requirement is complete.

## 7. Recommended Implementation Slices

1. **Slice 1 — Design contract, shell, and Dashboard** — Complete; committed as `1b2c0d7`.
   - Complete tokens, core primitives, prototype types/fixtures, Operator shell refinement, and Dashboard.
   - Establish query-scenario parsing and integrated primitive tests.

2. **Slice 2 — Participant Import prototype** — Complete; committed as `0d7431e`.
   - Add remaining form/table primitives and all four wizard steps.
   - Cover leading zeroes, duplicates, empty rows, malformed rows, and replace/merge copy visually only.

3. **Slice 3 — Draw Setup and Live Draw** — Complete; committed as `b46ede3`.
   - Build deterministic Practice/Live, sufficient/insufficient, ready, confirmation, countdown, and rolling scenarios.
   - Keep winner generation and timers absent.

4. **Slice 4 — Pending Results, Redraw, History, and Settings** — Complete; committed as `9f66113`.
   - Build visual confirmation, partial status, redraw, cancellation/replacement, history, and static settings surfaces.
   - Explicitly label all records as prototype data.

5. **Slice 5 — Audience Display** — Complete; committed as `000bab2`.
   - Build all seven display states and the four required winner grids.
   - Add strict fixture and DOM privacy tests.

6. **Slice 6 — Integration and acceptance** — Complete; acceptance-gap
   corrections committed as `56dfd64`, redraw-drawer corrections committed as
   `c4ab9f8`, and documentation closeout recorded separately.
   - Complete mock happy-path navigation, keyboard review, Chrome/Edge viewport matrix, full verification, documentation corrections, and Phase 2 acceptance record.
   - Update `TASKS.md` only for items actually verified.

Each slice ran lint, typecheck, tests, and build with a Git diff limited to its
purpose. Final acceptance passed 22 test files and 182 tests, and the production
build transformed 96 modules.

## 8. Testing Strategy

- Preserve the existing error, redirect, route, shell-separation, and not-found tests.
- Replace placeholder assertions as each route becomes a real static screen.
- Primitive tests:
  - roles, labels, descriptions, disabled states, variants;
  - keyboard tab order;
  - modal Escape, initial focus, focus containment, and focus return;
  - confirmation cancel/confirm callbacks;
  - Toast status/alert semantics;
  - semantic table markup.
- Scenario tests:
  - supported query values render the expected state;
  - invalid values fall back safely;
  - query changes do not create or mutate data;
  - ticket identifiers render exactly with leading zeroes.
- Screen tests:
  - one primary action per screen;
  - Practice/Live text and structural distinction;
  - insufficient-pool explanation;
  - import validation counts;
  - Pending, Cancelled, Replaced, and Confirmed presentation;
  - direct access to every display state and grid.
- Privacy tests:
  - Audience fixture types and objects exclude internal fields;
  - Audience DOM never renders participant names, check-in, group, notes, redraw reasons, or operator controls.
- Avoid randomness statistics, persistence tests, parsing tests, timers, visual snapshots, and domain-behavior claims.
- Use manual review for layout, visual focus, contrast, ticket dominance, and responsive behavior because jsdom cannot validate them.

## 9. Manual Viewport Matrix

Reviewer: Ismail. Verification date: 30 July 2026.

- Microsoft Edge `150.0.4078.99` (Official build) (64-bit)
- Google Chrome `150.0.7871.187` (Official Build) (64-bit), Stable cohort

| Browser | Interface | Viewport | Result |
|---|---|---:|---|
| Microsoft Edge | Operator | 1440 × 900 | PASS |
| Microsoft Edge | Operator | 1366 × 768 | PASS |
| Microsoft Edge | Operator | 1920 × 1080 | PASS |
| Google Chrome | Operator | 1440 × 900 | PASS |
| Google Chrome | Operator | 1366 × 768 | PASS |
| Google Chrome | Operator | 1920 × 1080 | PASS |
| Microsoft Edge | Audience | 1920 × 1080 | PASS |
| Microsoft Edge | Audience | 1280 × 720 | PASS |
| Google Chrome | Audience | 1920 × 1080 | PASS |
| Google Chrome | Audience | 1280 × 720 | PASS |

The supplied manual evidence also records PASS for keyboard focus and tab order,
modal and redraw-drawer containment and focus return, Escape behavior, disabled
semantics, reduced-motion rendering, contrast and readability, non-color mode
and result-status recognition, Audience safe areas and ticket dominance,
blackout purity, disconnected stale-data protection, clipping and scrollbar
checks, and the event-control visual character.

## 10. Phase 2 Acceptance Checklist

- [x] No dependency or package-version change is introduced.
- [x] Semantic tokens cover colors, typography, spacing, sizing, border, radius, elevation, focus, mode, result, connection, warning, error, and blackout states.
- [x] All Phase 2 primitives exist with typed props and accessible behavior.
- [x] Operator navigation and header are high fidelity and preserve route accessibility.
- [x] Dashboard, import wizard, Draw Setup, Live ready/running, Pending, redraw, history, and Settings static screens are complete.
- [x] Practice and Live are distinguishable through text, borders/shapes, and layout—not color alone.
- [x] The complete mock happy path is deterministic and directly navigable.
- [x] Audience standby, countdown, rolling, reveal, confirmed, blackout, and disconnected-safe states are directly accessible.
- [x] Winner layouts are exactly hero, 3 × 2, 5 × 2, and 5 × 4 for 1, 6, 10, and 20.
- [x] Ticket numbers remain strings and visually dominate reveal/confirmed layouts.
- [x] Audience fixtures and DOM expose no operator-only or participant-internal data.
- [x] No CSV/XLSX parsing, file reading, storage, persistence, draw selection, eligibility, BroadcastChannel, export, recovery, backend, or cloud code exists.
- [x] No official confirmation, redraw, or history mutation is implied or performed.
- [x] Keyboard navigation, focus, contrast, reduced motion, and viewport checks pass.
- [x] `npm.cmd run lint`, `typecheck`, `test`, and `build` pass.
- [x] `git diff --check` passes.
- [x] Chrome and Edge pass the manual viewport matrix with versions recorded.
- [x] Documentation no longer describes the repository as the default Vite scaffold.
- [x] Only verified Phase 2 checkboxes are updated.
- [x] The working tree contains no unrelated changes.

The checklist is complete based on the final automated acceptance audit and the
supplied manual verification record.

## 11. Risks and Open Questions

- The PRD remains version `0.1`, marked draft, with no named product owner. Prototype visual defaults must not be mistaken for approved production behavior.
- The PRD does not settle whether Pending tickets may be fully revealed. Phase 2
  uses a neutral “under verification” label; Phase 6/8 still requires a product
  decision.
- Phase 2 uses a message-only disconnected-safe screen without stale winners;
  Phase 7 must obtain approval before implementing real recovery behavior.
- Multi-slot redraw presentation order and post-partial-confirmation Audience
  ordering remain unresolved. Phase 2 demonstrates one deterministic
  arrangement only.
- Branding, animation durations, and audio constraints are undefined. Phase 2
  uses fictional text branding, restrained CSS-only presentation, no runtime
  timers, and no audio.
- The README and TASKS baseline drift is corrected in Phase 2 documentation
  closeout without changing product requirements.
- The local extraneous `node_modules` entries are a reproducibility hygiene concern, but not a Phase 2 blocker and not authorization to reinstall or clean packages.
- Automated visual regression is unavailable; the manual matrix is mandatory.

## 12. Phase 3 Planning

The next task is a bounded Phase 3 planning effort:

- reconcile the Phase 3 roadmap with the PRD and accepted Phase 2 presentation
  contracts;
- propose explicit domain types and allowed state transitions for events,
  participants, prize categories, draw configurations, sessions, winners,
  redraw records, audit records, and public display state;
- define persistence boundaries, schema versioning, migrations, stored-data
  compatibility, and safe database-reset behavior;
- compare direct IndexedDB use with any proposed persistence dependency and
  obtain approval before changing dependencies;
- preserve ticket identifiers as strings and retain all accepted product
  invariants; and
- plan isolated, React-independent domain and persistence tests.

This closeout does not mark or implement any Phase 3 task.
