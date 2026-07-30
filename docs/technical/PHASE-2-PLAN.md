# Phase 2 — Static UI Prototype Implementation Plan

## Summary

Phase 1 is accepted and technically ready for Phase 2. Build a deterministic, high-fidelity prototype on the existing React/Router/Tailwind/Vitest stack without new dependencies or production behavior. Mock data remains presentation-only, ticket numbers remain strings, and Audience fixtures contain public information only.

Defaults adopted because no preference response was received:

- English interface copy.
- Include a static Settings screen and disconnected-safe Audience state.
- Select prototype states through URL query parameters, with navigation controls visible only in the Operator interface.
- Use text-only fictional event branding and local CSS; no external assets, fonts, or audio.

Current implementation status:

- Phase 2 Slice 1 — Design contract, Operator shell, and Dashboard is implemented and committed as `1b2c0d7`.
- Phase 2 Slice 2 — Participant Import prototype is the recommended next task and is not implemented.
- Slices 3 through 6 remain planned and are not implemented.
- This document records the complete approved Phase 2 scope; it does not expand that scope or claim completion of the phase.

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
- Documentation drift was non-blocking and should be corrected only during final Phase 2 closeout:
  - `TASKS.md` “Current Repository Baseline” and “Immediate Next Task” still describe the pre-Phase-1 scaffold.
  - `README.md` still says routing, strict mode, and tests are unavailable.
  - The historical Phase 1 plan describes packages as proposed; the newer Phase 1 acceptance record and current code supersede that status.

### Status after Slice 1

- `HEAD` is `1b2c0d7` (`feat: build Phase 2 dashboard prototype`).
- Slice 1 added the design contract, core reusable primitives, Operator shell refinement, deterministic Dashboard fixtures, Dashboard scenarios, focused styles, and tests.
- The post-Slice-1 baseline passes lint, typecheck, 41 tests across 6 files, and the production build.
- Participant Import, Draw Setup, Live Draw states, Pending Results, Redraw, History redesign, Settings redesign, and Audience Display states remain unimplemented.
- No dependency change was introduced by Slice 1.

## 2. Gap Analysis Against `TASKS.md` Phase 2

| Phase 2 area | Current state | Required gap closure |
|---|---|---|
| Tokens | Slice 1 added semantic design tokens for the Operator foundation | Complete any sizing, elevation, control, and semantic Pending/Confirmed/blackout/connection tokens required by later slices |
| Primitives | Slice 1 implemented Button, Input, Select, Checkbox, Toggle, Badge, Card, FieldMessage, and supporting helpers | Add Table, EmptyState, Modal, Toast, and ConfirmationDialog only in the slices that require them; preserve typed and accessible behavior |
| Operator shell | Slice 1 implemented the high-fidelity shell, event context, mode distinction, display status, and Operator-only prototype scenario control | Extend only where a later approved screen requires a shared shell capability |
| Dashboard | Slice 1 implemented deterministic Dashboard scenarios and focused tests | Preserve as a regression baseline; no redesign is planned |
| Participant Import | Inert route placeholder | Build the four-step static import prototype in Slice 2 |
| Draw Setup and Live Draw | Inert route placeholders | Build deterministic setup, ready, and running visual scenarios in Slice 3 |
| Pending, Redraw, History, Settings | Inert route placeholders | Build static Operator surfaces in Slice 4 |
| Audience Display | One inert placeholder | Build all presentation states, disconnected-safe state, and 1/6/10/20 winner layouts in Slice 5 |
| Mock data | Slice 1 provides deterministic Dashboard view-model fixtures and query scenarios | Add screen-specific immutable fixtures and public-only Audience fixtures in their respective slices |
| Prototype navigation | Slice 1 provides Dashboard query-driven scenarios | Add query-driven wizard, mode, draw, result, and display scenarios as each route is implemented |
| Accessibility | Slice 1 provides shared labels, descriptions, focus treatment, status cues, and primitive tests | Add dialog focus management, table semantics, screen-specific keyboard behavior, and manual contrast review |
| Tests | Foundation and Slice 1 primitive/Dashboard tests pass | Add scenario, screen, privacy, and responsive-structure tests per remaining slice |
| Manual review | Phase 1 and Slice 1 viewport review completed | Complete the full Phase 2 Chrome/Edge screen and state matrix during integration and acceptance |

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

1. **Slice 1 — Design contract, shell, and Dashboard** — Implemented and committed as `1b2c0d7`.
   - Complete tokens, core primitives, prototype types/fixtures, Operator shell refinement, and Dashboard.
   - Establish query-scenario parsing and integrated primitive tests.

2. **Slice 2 — Participant Import prototype** — Planned; not implemented.
   - Add remaining form/table primitives and all four wizard steps.
   - Cover leading zeroes, duplicates, empty rows, malformed rows, and replace/merge copy visually only.

3. **Slice 3 — Draw Setup and Live Draw** — Planned; not implemented.
   - Build deterministic Practice/Live, sufficient/insufficient, ready, confirmation, countdown, and rolling scenarios.
   - Keep winner generation and timers absent.

4. **Slice 4 — Pending Results, Redraw, History, and Settings** — Planned; not implemented.
   - Build visual confirmation, partial status, redraw, cancellation/replacement, history, and static settings surfaces.
   - Explicitly label all records as prototype data.

5. **Slice 5 — Audience Display** — Planned; not implemented.
   - Build all seven display states and the four required winner grids.
   - Add strict fixture and DOM privacy tests.

6. **Slice 6 — Integration and acceptance** — Planned; not implemented.
   - Complete mock happy-path navigation, keyboard review, Chrome/Edge viewport matrix, full verification, documentation corrections, and Phase 2 acceptance record.
   - Update `TASKS.md` only for items actually verified.

Each slice must run lint, typecheck, tests, and build and keep the Git diff limited to its purpose.

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

Record exact browser versions during execution.

| Browser | Interface | Viewport | Required review |
|---|---|---:|---|
| Chrome and Edge | Operator | 1440 × 900 | Every Operator screen, dialog, toast, and happy-path transition |
| Chrome and Edge | Operator | 1366 × 768 | Dense import, Pending, redraw, and history screens; no hidden critical action or horizontal page overflow |
| Chrome and Edge | Operator | 1920 × 1080 | Content max-width, shell balance, and readability |
| Chrome and Edge | Audience | 1920 × 1080 | Every state and 1/6/10/20 grid; safe areas and ticket dominance |
| Chrome and Edge | Audience | 1280 × 720 | Graceful desktop fallback and grid legibility |
| Chrome and Edge | Both | Primary viewport | Full keyboard path, visible focus, modal focus return, reduced-motion mode, and status recognition without color |

Audience review should also check a clean 16:9 capture surface with no scrollbars, cursor-dependent UI, operator controls, or internal data.

## 10. Phase 2 Acceptance Checklist

- [ ] No dependency or package-version change is introduced.
- [ ] Semantic tokens cover colors, typography, spacing, sizing, border, radius, elevation, focus, mode, result, connection, warning, error, and blackout states.
- [ ] All Phase 2 primitives exist with typed props and accessible behavior.
- [ ] Operator navigation and header are high fidelity and preserve route accessibility.
- [ ] Dashboard, import wizard, Draw Setup, Live ready/running, Pending, redraw, history, and Settings static screens are complete.
- [ ] Practice and Live are distinguishable through text, borders/shapes, and layout—not color alone.
- [ ] The complete mock happy path is deterministic and directly navigable.
- [ ] Audience standby, countdown, rolling, reveal, confirmed, blackout, and disconnected-safe states are directly accessible.
- [ ] Winner layouts are exactly hero, 3 × 2, 5 × 2, and 5 × 4 for 1, 6, 10, and 20.
- [ ] Ticket numbers remain strings and visually dominate reveal/confirmed layouts.
- [ ] Audience fixtures and DOM expose no operator-only or participant-internal data.
- [ ] No CSV/XLSX parsing, file reading, storage, persistence, draw selection, eligibility, BroadcastChannel, export, recovery, backend, or cloud code exists.
- [ ] No official confirmation, redraw, or history mutation is implied or performed.
- [ ] Keyboard navigation, focus, contrast, reduced motion, and viewport checks pass.
- [ ] `npm.cmd run lint`, `typecheck`, `test`, and `build` pass.
- [ ] Chrome and Edge pass the manual viewport matrix with versions recorded.
- [ ] Documentation no longer describes the repository as the default Vite scaffold.
- [ ] Only verified Phase 2 checkboxes are updated.
- [ ] The working tree contains no unrelated changes.

The checklist remains phase-wide and intentionally unchecked until the complete Phase 2 scope is implemented and verified. Slice 1 completion does not imply completion of Slice 2 or any later slice.

## 11. Risks and Open Questions

- The PRD remains version `0.1`, marked draft, with no named product owner. Prototype visual defaults must not be mistaken for approved production behavior.
- The PRD does not settle whether Pending tickets may be fully revealed. Phase 2 will show them with a neutral “under verification” label; Phase 6/8 still requires a product decision.
- Disconnected-safe behavior is unresolved. Phase 2 will use a message-only safe screen without stale winners; Phase 7 must obtain approval before implementing real recovery behavior.
- Multi-slot redraw presentation order and post-partial-confirmation Audience ordering remain unresolved. Phase 2 may demonstrate one deterministic arrangement only.
- Branding, animation durations, and audio constraints are undefined. Use fictional text branding, restrained CSS-only presentation, no runtime timers, and no audio.
- The stale README/TASKS baseline can confuse future audits; correct it during closeout without changing product requirements.
- The local extraneous `node_modules` entries are a reproducibility hygiene concern, but not a Phase 2 blocker and not authorization to reinstall or clean packages.
- Automated visual regression is unavailable; the manual matrix is mandatory.

## 12. Recommended Immediate Next Task

Implement only **Slice 2 — Participant Import prototype**:

- replace only the `/participants` placeholder with a deterministic, query-driven four-step static prototype;
- add immutable Participant Import view-model fixtures outside `src/domain`;
- add only the reusable Table, EmptyState, ProgressStepper, and FieldGroup UI needed by the slice;
- implement Upload, Column Mapping, Validation Review, and Import Summary views with safe query fallbacks and browser-history navigation;
- preserve ticket identifiers as strings and include leading-zero, duplicate, empty, malformed, missing-name, and whitespace-normalized fixture examples;
- make file selection, parsing, validation, replace, merge, download, and import actions presentation-only;
- add focused route, screen, accessibility, immutability, privacy, and scope tests;
- do not add dependencies, file APIs, parsing, persistence, domain models, mutation, export, Audience Display changes, or any later Phase 2 slice;
- verify lint, typecheck, tests, build, `git diff --check`, and the Participant Import flow at 1366 × 768, 1440 × 900, and 1920 × 1080.
