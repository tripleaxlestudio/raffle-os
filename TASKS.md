# Raffle OS Implementation Roadmap

This file tracks implementation progress for Raffle OS. `AGENTS.md` defines the engineering rules, while `docs/product/PRD.md` defines the product requirements. Complete phases sequentially unless an explicit dependency allows work to proceed in parallel. A phase is not complete until every applicable task and its verification checklist pass.

Do not mark a task complete based on intent. Update its status only after the result exists in the repository and has been verified.

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed
- `[!]` Blocked

Standard Markdown checkboxes render only `[ ]` and `[x]`. This project uses `[~]` and `[!]` as additional status conventions.

## Current Repository Baseline

### Confirmed current state

- [x] React 19 is installed as an application dependency.
- [x] React Router 7 provides application routing.
- [x] TypeScript 6 is installed and explicit `strict` mode is enabled.
- [x] Vite 8 is the current development and production build tool.
- [x] Tailwind CSS 4 is configured through the official Vite plugin.
- [x] Vitest 4, jsdom, React Testing Library, jest-dom, and user-event provide
  the automated test environment.
- [x] ESLint 10 is configured for TypeScript, React Hooks, and Vite React Refresh.
- [x] npm is the package manager and `package-lock.json` is committed.
- [x] The Phase 1 application foundation is implemented and accepted.
- [x] The Phase 2 deterministic static UI prototype is implemented and accepted.
- [x] Operator and Audience interfaces use separate layouts and route surfaces.
- [x] Semantic tokens, reusable typed presentation components, immutable mock
  fixtures, and query-driven prototype scenarios are implemented.
- [x] The repository contains 22 test files covering 182 passing tests at Phase
  2 acceptance.

### Confirmed npm scripts

- [x] `npm run dev` — starts the Vite development server.
- [x] `npm run build` — runs `tsc -b` and then the Vite production build.
- [x] `npm run lint` — runs ESLint across the repository.
- [x] `npm run preview` — previews the production build.
- [x] `npm run typecheck` — runs the TypeScript project build in no-emit mode.
- [x] `npm run test` — runs the Vitest suite once.
- [x] `npm run test:watch` — runs Vitest in watch mode.

### Confirmed implementation boundary

- [x] Current participant import, draw, result, redraw, history, settings, and
  Audience states are deterministic presentation prototypes only.
- [x] Production domain models and state transitions remain unimplemented.
- [x] IndexedDB persistence and stored-data migration remain unimplemented.
- [x] Production CSV/XLSX import and eligibility evaluation remain unimplemented.
- [x] Secure draw selection and official winner generation remain unimplemented.
- [x] Winner confirmation and redraw mutation remain unimplemented.
- [x] Operator/Audience synchronization remains unimplemented.
- [x] Export, recovery, backend, and cloud behavior remain unimplemented.

## Phase 0 — Documentation and Repository Foundation

### Documentation

- [x] Confirm `docs/product/PRD.md` exists and is the product source of truth.
- [x] Confirm root `AGENTS.md` exists and defines engineering rules.
- [x] Create the root `TASKS.md` implementation roadmap.
- [x] Replace the default Vite README with a concise Raffle OS project README.
- [x] Link the PRD, agent guide, roadmap, and acceptance records from the project README.
- [x] Document the current local development commands in the project README.

### Repository workflow

- [ ] Decide and document the Git branch naming convention.
- [ ] Decide and document the commit message convention.
- [ ] Define how roadmap checkbox updates are included with implementation commits.
- [ ] Ensure completed work is committed and the working tree is clean.

### Baseline verification

- [ ] Start the baseline with `npm run dev` and verify it loads locally.
- [ ] Run `npm run lint` and record the result.
- [ ] Run `npm run build` and record the result.
- [ ] Verify the baseline in a current desktop Chrome version.
- [ ] Verify the baseline in a current desktop Edge version.
- [ ] Document supported local environment assumptions, including Node.js/npm expectations once agreed.

### Exit criteria

- [x] Repository-level product, engineering, and roadmap documentation is discoverable.
- [ ] The baseline application runs locally.
- [ ] Existing lint and production-build commands pass.
- [ ] Chrome and Edge environment assumptions are documented.
- [ ] The working tree is clean after the phase commit.

## Phase 1 — Application Foundation

This phase creates structure only. It must not implement the real draw engine, participant import pipeline, persistence behavior, or official history.

### Technical decisions

- [x] Decide whether routing will use a small in-app browser-history abstraction or a proposed dependency.
- [x] Document the routing decision and tradeoffs before implementation.
- [x] Decide whether styling will use plain CSS, CSS Modules, or another approved approach.
- [x] Document design-token and component-style conventions.
- [x] Decide the unit and component testing approach.
- [x] Propose any required testing dependency for approval before installation.
- [x] Propose any routing or styling dependency for approval before installation.
- [x] Add only dependencies that have been explicitly approved.
- [x] Enable TypeScript strict mode and resolve all resulting baseline type errors.

### Application structure

- [x] Define an application-level folder structure that separates UI, domain, services, and infrastructure.
- [x] Create shared domain-type directories without implementing business behavior.
- [x] Create a global application shell.
- [x] Create a structurally separate Operator Panel layout.
- [x] Create a structurally separate Audience Display route.
- [x] Add a placeholder Dashboard route.
- [x] Add a placeholder Participants route.
- [x] Add a placeholder Draw Setup route.
- [x] Add a placeholder Live Draw route.
- [x] Add a placeholder Pending Results route.
- [x] Add a placeholder History route.
- [x] Add a placeholder Settings route.
- [x] Add a placeholder Audience Display route.
- [x] Add a not-found route.
- [x] Add an application-level error boundary.
- [x] Add basic responsive behavior for the desktop target sizes.
- [x] Add foundational design tokens without building the full design system.

### Verification

- [x] Verify every planned route is directly accessible.
- [x] Verify Operator and Audience interfaces do not share operator-only layout or controls.
- [x] Verify placeholder pages contain no draw, import, eligibility, or persistence logic.
- [x] Run available lint checks.
- [x] Run the production build.
- [x] Run tests if an approved test script has been added.

### Exit criteria

- [x] Every planned route is accessible.
- [x] Operator and Audience interfaces are structurally separate.
- [x] TypeScript strict checks, lint, and production build pass.
- [x] No business logic is embedded in placeholder pages.

## Phase 2 — Design System and Static UI Prototype

Use realistic mock data only. Do not add production draw, import, eligibility, audit, or persistence logic in this phase.

### Tokens and primitives

- [x] Define color tokens.
- [x] Define typography tokens.
- [x] Define spacing and sizing tokens.
- [x] Define border, radius, elevation, and focus tokens.
- [x] Define semantic status tokens for Practice, Live, Pending, Confirmed, warning, error, connection, and blackout states.
- [x] Build a reusable Button.
- [x] Build a reusable Input.
- [x] Build a reusable Select.
- [x] Build a reusable Checkbox.
- [x] Build a reusable Toggle.
- [x] Build a reusable Badge.
- [x] Build a reusable Card.
- [x] Build a reusable Modal.
- [x] Build a reusable Table.
- [x] Build a reusable Empty State.
- [x] Build a reusable Toast.
- [x] Build a reusable Confirmation Dialog.
- [x] Add accessible labels, focus states, and keyboard behavior to every interactive primitive.

### Operator static screens

- [x] Build Operator Panel navigation and header.
- [x] Build the Dashboard static UI.
- [x] Build the Participant Import static UI.
- [x] Build the Draw Setup static UI.
- [x] Build the Live Draw ready state.
- [x] Build the Live Draw running state.
- [x] Build the Pending Results static UI.
- [x] Build the Redraw panel static UI.
- [x] Build the History static UI.
- [x] Show visually distinct Practice and Live mock states without relying on color alone.

### Audience static screens

- [x] Build the Standby state.
- [x] Build the Countdown state.
- [x] Build the Rolling state.
- [x] Build the Winner Reveal state.
- [x] Build the Confirmed state.
- [x] Build the Blackout state.
- [x] Build a one-winner hero layout.
- [x] Build a 3 × 2 grid for 6 winners.
- [x] Build a 5 × 2 grid for 10 winners.
- [x] Build a 5 × 4 grid for 20 winners.
- [x] Keep ticket numbers visually dominant in every winner layout.

### Review and verification

- [x] Demonstrate the complete mock happy path without production behavior.
- [x] Review the Operator Panel at 1440 × 900.
- [x] Review the Audience Display at 1920 × 1080, 16:9.
- [x] Verify operator-only data is absent from the Audience Display mock payloads.
- [x] Review keyboard navigation, visible focus, contrast, and readability.
- [x] Confirm visual treatment resembles event-control software rather than a generic SaaS template.
- [x] Run available lint, test, and production-build commands.

### Exit criteria

- [x] The complete happy path can be demonstrated using mock data.
- [x] No production draw or persistence logic exists.
- [x] Ticket numbers remain visually dominant on the Audience Display.
- [x] The UI does not resemble a generic SaaS template.
- [x] Accessibility and readability checks pass.

## Phase 3 — Domain Model and Local Persistence

### Domain model

- [ ] Define the `Event` model.
- [ ] Define the `Participant` model with a string ticket identifier.
- [ ] Define the prize-category model.
- [ ] Define the draw-configuration model.
- [ ] Define the draw-session model.
- [ ] Define the winner model.
- [ ] Define the redraw-record model.
- [ ] Define the audit-record model.
- [ ] Define the public display-state model.
- [ ] Define discriminated status unions.
- [ ] Define and test allowed state transitions.

### Persistence decision and schema

- [ ] Compare direct IndexedDB use with any proposed persistence dependency.
- [ ] Obtain approval before adding a persistence dependency.
- [ ] Document the selected IndexedDB approach.
- [ ] Define the initial database schema.
- [ ] Add an explicit schema version.
- [ ] Add a migration mechanism before storing official records.
- [ ] Document stored-data backward-compatibility rules.

### Data access

- [ ] Create isolated repository or data-access modules.
- [ ] Persist events.
- [ ] Persist participants.
- [ ] Persist prize categories.
- [ ] Persist draw sessions.
- [ ] Persist winner history.
- [ ] Persist redraw and audit history.
- [ ] Store lightweight preferences separately from domain data.
- [ ] Add seed or demo-data utilities used only in development.
- [ ] Add explicit protection and confirmation around database reset.

### Verification

- [ ] Add persistence tests.
- [ ] Verify data survives browser refresh.
- [ ] Verify every stored ticket number remains a string.
- [ ] Verify leading zeroes survive a storage round trip.
- [ ] Verify persistence modules can be tested without React.
- [ ] Verify an incompatible schema fails safely or migrates explicitly.

### Exit criteria

- [ ] Data survives browser refresh.
- [ ] Stored ticket numbers remain strings.
- [ ] Leading zeroes are preserved.
- [ ] Persistence logic is isolated from React components.
- [ ] Schema changes are versioned.

## Phase 4 — Participant Import and Eligibility

### Current status

The Participant Import portion of Phase 4 is functionally complete. `/participants`
is production by default; `?workflow=prototype` preserves the Phase 2 fixture
workflow and `production-preview` is a production alias. CSV/XLSX parsing,
mapping, validation, atomic Replace/Merge persistence, audit append, and
bounded verification are implemented. Eligibility evaluation, candidate pools,
and draw behavior remain deferred to Phase 5. See
`docs/technical/PHASE-4-ACCEPTANCE.md` for fresh verification and browser
acceptance status.

### Import pipeline

- [x] Define typed raw-row, mapped-row, validation-result, and import-summary models.
- [x] Define the participant import pipeline independently of React.
- [ ] Decide whitespace normalization and duplicate-comparison rules from the PRD open questions.
- [x] Support CSV input.
- [x] Support XLSX input.
- [x] Propose any file-parsing dependency for approval before installation.
- [x] Add explicit column mapping.
- [x] Add a data preview before commit.
- [x] Preserve ticket identifiers as strings from file read onward.
- [x] Detect empty ticket numbers.
- [x] Detect duplicate ticket numbers.
- [x] Detect malformed rows.
- [x] Detect missing required columns.
- [x] Support optional participant name.
- [x] Support optional check-in status.
- [x] Support optional group.
- [x] Support optional notes.
- [x] Produce a reviewable invalid-row report.

### Import application behavior

- [x] Implement replace-import behavior with explicit confirmation.
- [x] Decide and document merge-conflict behavior.
- [x] Implement merge-import behavior without creating duplicate tickets.
- [ ] Add participant search.
- [ ] Add participant filters.
- [ ] Display participant validation and eligibility status.
- [ ] Add manual participant editing with revalidation.

### Tests

- [x] Test leading-zero preservation.
- [x] Test duplicate detection within a file.
- [x] Test conflicts against stored participants.
- [x] Test empty values.
- [x] Test malformed rows.
- [x] Test missing required columns.
- [x] Test replace confirmation behavior.
- [x] Test merge conflicts.
- [x] Test equivalent CSV and XLSX normalization.

### Exit criteria

- [ ] CSV and XLSX imports produce equivalent normalized participant records.
- [ ] Invalid records cannot silently enter the eligible pool.
- [ ] No ticket number is converted to a number.
- [x] Import errors are reviewable before confirmation.

## Phase 5 — Secure Draw Engine

### Secure selection

- [ ] Create a secure random-source module using `crypto.getRandomValues()`.
- [ ] Implement unbiased integer-range generation with rejection sampling or an equivalent method.
- [ ] Implement secure Fisher–Yates shuffle or equivalent selection without replacement.
- [ ] Add a guard that prevents official selection when Web Crypto is unavailable.
- [ ] Verify `Math.random()` is absent from the official draw-selection path.
- [ ] Prevent duplicate winners within one draw.

### Eligibility

- [ ] Implement eligibility filtering independently of React.
- [ ] Support winner counts of 1, 3, 6, 10, 20, and 50.
- [ ] Support a custom winner count up to 100.
- [ ] Exclude previous Confirmed winners when the one-win-per-event rule is active.
- [ ] Support once-per-category rules.
- [ ] Support the allow-repeat rule.
- [ ] Support check-in requirements.
- [ ] Reject a draw when eligible participants are fewer than requested winners.

### Draw record preparation

- [ ] Create an immutable eligible-pool snapshot.
- [ ] Record active filters and draw configuration with the snapshot.
- [ ] Record mode and timestamp.
- [ ] Keep final selection independent from all visual animation state.

### Tests and performance

- [ ] Test random-helper output bounds.
- [ ] Test rejection behavior without trying to prove randomness statistically.
- [ ] Test duplicate prevention.
- [ ] Test prior-winner exclusion.
- [ ] Test check-in eligibility.
- [ ] Test once-per-category eligibility.
- [ ] Test insufficient-pool rejection.
- [ ] Test immutability of the eligible snapshot.
- [ ] Test at least 10,000 participants and up to 100 winners.
- [ ] Verify final selection completes within the PRD target on an agreed benchmark device.

### Exit criteria

- [ ] Official selection uses Web Crypto API only.
- [ ] The same participant cannot be selected twice in one draw.
- [ ] Visual animation cannot change selected results.
- [ ] Selection completes within the PRD performance target.
- [ ] Domain tests pass.

## Phase 6 — Draw Setup and Live Workflow

The secure draw engine must pass Phase 5 verification before it is connected to Live Mode.

### Setup

- [ ] Connect Draw Setup UI to persisted domain data.
- [ ] Configure prize category.
- [ ] Configure prize name.
- [ ] Configure winner count.
- [ ] Configure eligibility rules.
- [ ] Display the current eligible-participant count.
- [ ] Add system-readiness checks for persistence and Web Crypto.

### Modes and start controls

- [ ] Add Practice Mode behavior.
- [ ] Add Live Mode behavior.
- [ ] Make Practice and Live visually distinct without relying on color alone.
- [ ] Add explicit confirmation before entering or starting Live Mode.
- [ ] Add hold-to-start for a Live draw.
- [ ] Lock the eligible-pool snapshot when a draw starts.
- [ ] Prevent participant edits during an active draw.

### Active draw workflow

- [ ] Create Pending winner records before operator confirmation.
- [ ] Add countdown state.
- [ ] Add rolling-presentation state.
- [ ] Add winner-reveal state.
- [ ] Add skip-animation control without changing results.
- [ ] Define and implement safe abort behavior.
- [ ] Add blackout behavior.
- [ ] Define recovery for interruption at each active state.

### Verification

- [ ] Verify setup-to-Pending happy path.
- [ ] Verify Practice Mode leaves official eligibility and records unchanged.
- [ ] Verify Live Mode creates an auditable draw session.
- [ ] Verify animations cannot trigger a reselection.
- [ ] Verify interrupted states recover without silently selecting again.
- [ ] Run available lint, test, and production-build commands.

### Exit criteria

- [ ] Operator can complete a draw from setup through Pending results.
- [ ] Practice Mode does not alter official records.
- [ ] Live Mode creates an auditable draw session.
- [ ] Interrupted actions have defined recovery behavior.

## Phase 7 — Operator and Audience Display Synchronization

Audience synchronization presents results generated elsewhere. It must never own or generate draw results.

### Communication

- [ ] Create an isolated BroadcastChannel communication module.
- [ ] Define typed public display messages.
- [ ] Ensure message payloads exclude operator-only participant data.
- [ ] Add a display-ready handshake.
- [ ] Define behavior when BroadcastChannel is unavailable.

### State synchronization

- [ ] Synchronize Standby.
- [ ] Synchronize Countdown.
- [ ] Synchronize Rolling.
- [ ] Synchronize Reveal.
- [ ] Synchronize Confirmed.
- [ ] Synchronize Blackout.
- [ ] Synchronize Restore.
- [ ] Show connection status in the Operator Panel.
- [ ] Add reconnect behavior.
- [ ] Preserve a safe display state after disconnection.
- [ ] Restore the correct presentation state after reconnection.

### Display workflow and tests

- [ ] Add a separate fullscreen workflow.
- [ ] Test one Operator window with one Audience Display window.
- [ ] Test multiple open Audience Display windows.
- [ ] Test disconnection during each presentation state.
- [ ] Add synchronization tests where practical.
- [ ] Verify display failure cannot corrupt draw-session data.

### Exit criteria

- [ ] Operator actions update the Audience Display reliably.
- [ ] Audience Display contains no operator controls or internal participant data.
- [ ] Disconnecting the display does not corrupt draw data.
- [ ] Reconnection restores the correct presentation state.

## Phase 8 — Winner Confirmation and Redraw

This phase depends on the draw-session, winner, redraw, and audit models from Phase 3 and secure selection from Phase 5.

### Product decisions

- [ ] Decide whether cancelled participants return to the pool for each redraw reason.
- [ ] Confirm the approved redraw-reason set.
- [ ] Decide how partial confirmation and redraw are presented to the Audience Display.

### Confirmation

- [ ] Confirm an individual Pending winner.
- [ ] Confirm all Pending winners.
- [ ] Cancel an individual Pending winner.
- [ ] Keep other valid winners unchanged during partial actions.
- [ ] Update one-win eligibility only after confirmation.

### Redraw

- [ ] Select multiple winners for redraw.
- [ ] Require a redraw reason in Live Mode.
- [ ] Require explanatory text when the reason is `other`.
- [ ] Select replacement winners through the secure draw engine.
- [ ] Preserve original winner records.
- [ ] Store explicit original-to-replacement relationships.
- [ ] Keep cancelled winners visible in audit history.
- [ ] Show a safe redraw presentation state on the Audience Display.

### Tests

- [ ] Test individual and confirm-all behavior.
- [ ] Test partial redraw without changing valid winners.
- [ ] Test required Live redraw reasons.
- [ ] Test cancelled-record preservation.
- [ ] Test replacement relationships.
- [ ] Test one-win eligibility updates only after confirmation.
- [ ] Test Practice redraw leaves Live records unchanged.

### Exit criteria

- [ ] Cancelled records remain visible.
- [ ] Replacement relationships are traceable.
- [ ] Valid winners are not changed during partial redraw.
- [ ] One-win eligibility updates only after confirmation.

## Phase 9 — History, Audit, and Export

Persistence and the official draw-session model must exist before this phase begins.

### History and audit

- [ ] Build draw-session history.
- [ ] Build an all-winners view.
- [ ] Build a chronological audit timeline.
- [ ] Add history filters.
- [ ] Add history search.
- [ ] Distinguish Practice and Live records.
- [ ] Show cancellation reasons.
- [ ] Show original-to-replacement relationships.
- [ ] Reopen completed public results on the Audience Display without creating a new draw.
- [ ] Prevent official records from being silently overwritten or deleted.

### Export

- [ ] Decide and document final export columns and worksheet structure.
- [ ] Export Confirmed results to CSV.
- [ ] Export Confirmed results to XLSX.
- [ ] Preserve ticket identifiers as strings in CSV output.
- [ ] Preserve ticket identifiers and leading zeroes in XLSX output.
- [ ] Keep cancelled and replacement records available to the audit view.
- [ ] Propose any export dependency for approval before installation.

### Tests

- [ ] Test reconstruction of a completed draw from stored records.
- [ ] Test export of leading-zero ticket numbers.
- [ ] Test export excludes non-final Pending results.
- [ ] Test redraw history remains traceable.
- [ ] Test official record immutability rules.

### Exit criteria

- [ ] A completed draw can be reconstructed from stored records.
- [ ] Exported ticket numbers preserve leading zeroes.
- [ ] Redraw history is included in the audit trail.

## Phase 10 — Recovery, Backup, and Operational Safety

Recovery and operational-safety work is part of MVP hardening. Backup and restore remain conditional P2 work under the PRD and must not be implemented until explicitly approved for a later milestone.

### Recovery and safety

- [ ] Add autosave-status feedback.
- [ ] Restore an interrupted Pending session without reselection.
- [x] Restore the last safe Audience Display state.
- [ ] Add protection against accidental event reset.
- [ ] Add explicit confirmation to every destructive action.
- [ ] Add storage-capacity warnings.
- [ ] Add an IndexedDB readiness diagnostic.
- [ ] Add a Web Crypto API readiness diagnostic.
- [ ] Add a BroadcastChannel readiness diagnostic.
- [ ] Add a storage-availability diagnostic.
- [x] Add recovery tests for refresh and interrupted sessions.

### Conditional P2 backup and restore

- [!] Obtain explicit product approval to include local event backup and restore in a later milestone.
- [!] Define and version the portable backup format after approval.
- [!] Add event backup export after approval.
- [!] Add event backup import after approval.
- [!] Validate backup format and schema version.
- [!] Add backup compatibility tests.
- [!] Verify invalid or incompatible backups fail without changing current data.

### Exit criteria

- [ ] Browser refresh does not silently lose active work.
- [ ] Dangerous actions require explicit confirmation.
- [ ] Runtime capability failures are reported before Live draw.
- [!] If backup/restore is approved, restored backups produce valid domain records.
- [!] If backup/restore is approved, invalid or incompatible backups fail safely.

## Phase 11 — Accessibility, Performance, and Release Hardening

### Slice 11.0 — baseline and acceptance control

- [x] Fix stable filenames for Phase 11 evidence and release records.
- [x] Inventory Phase 3, 4, 6, 7, and 10 acceptance debt without rewriting
  historical evidence.
- [x] Create the PRD acceptance evidence index and browser/viewport matrix.
- [x] Record approved localization and Windows Host product direction.
- [x] Create the initial release-blocker and known-limitation register.
- [ ] Approve or defer the high-readability and large-number Audience options.
- [ ] Approve the benchmark device and final-selection timing protocol.
- [ ] Name the Beta/RC/Release acceptance authority and approve the pilot policy.
- [x] Record fresh Slice 11.0 verification results.

### Accessibility and presentation

- [ ] Review keyboard navigation across all operator workflows.
- [x] Verify visible focus states in source, focused regressions, and sampled
  browser surfaces; full Chrome/Edge journey sign-off remains B11-019.
- [x] Complete the default-token color-contrast review; target-display branding
  combinations remain part of B11-016/B11-020.
- [x] Add reduced-motion support.
- [ ] Add a high-readability Audience Display option if approved.
- [ ] Add a large-number display option if approved.
- [x] Remove unnecessary animation.
- [x] Verify important states are not communicated through color alone.

### Bahasa Indonesia localization

Checkpoint 2026-08-31: the glossary, typed locale boundary, production copy
migration, and Undian/Hasil/empty-state UI refinements are saved with Slice 11.1.
Slice 11.2 remains in progress: full-suite failures, final copy review, and
Chrome/Edge B11-021 acceptance are still outstanding. See
`docs/technical/PHASE-11-ACCEPTANCE.md` for checkpoint evidence.

- [ ] Define and approve the Indonesian terminology glossary.
- [ ] Inventory all user-facing production Operator and Audience copy.
- [ ] Make Bahasa Indonesia the default language for production navigation,
  actions, statuses, validation, confirmations, errors, recovery guidance, and
  accessibility labels.
- [ ] Use `id-ID` presentation formats without translating stored timestamps,
  ticket strings, IDs, domain enums, audit semantics, routes, protocol fields,
  or storage keys.
- [ ] Preserve versioned CSV/XLSX contracts or explicitly version any approved
  localized export-header change.
- [ ] Verify Indonesian copy fits every required Operator viewport and Audience
  layout without hiding critical actions.

### Slice 11.2A — UI improvements and bounded feature additions

Owner update 2026-08-31: this slice is approved as a planning slot after 11.2,
before performance and packaging work. Individual approvals are recorded below;
this does not authorize unspecified features.

- [x] Designate Slice 11.2A for UI improvements and bounded feature additions.
- [ ] Collect proposed items and record purpose, affected screens, scope and
  exclusions, domain/persistence impact, and acceptance checks for each.
- [ ] Obtain owner approval for each item and synchronize affected requirements,
  plans, and acceptance records before implementation.
- [ ] Implement approved items in focused groups, verify, and commit each group.
- [ ] Reconcile the recorded 11.2 full-suite failures before closing the next
  development slice; keep required automated gates passing.
- [ ] Complete affected manual UI/browser acceptance in the final session.

Conditional Audience readability options remain in 11.1A. Changes affecting
draw rules, eligibility, official History/audit, recovery, persistence, or
dependencies require explicit impact review and approval, not an assumption
that a small UI means a small feature.

#### 11.2A-01 — Distinct Audience connection indicators

Owner request 2026-08-31: make Waiting and Connected clearly distinguishable.
Scope: shared visual treatment for the production header and Dashboard Operations
card, with distinct static icons, semantic tinted badges, Indonesian labels,
and locale-independent CSS state selectors. Both indicators use the existing
presence status store; a stale snapshot acknowledgement must not leave the
Dashboard connected after the Audience closes. Preserve existing open-display and
Settings actions. No transport, heartbeat, draw, persistence, or audit changes.
Acceptance: focused regressions for all indicator states and state changes;
browser checks for Waiting/Connected, keyboard focus, and target Operator widths.
Comprehensive Chrome/Edge release sign-off remains deferred.

- [x] Approve the bounded UI fix described above.
- [x] Implement the indicator fix and pass focused automated/browser checks;
  evidence is recorded in Phase 11 acceptance. Full-suite/owner gates stay open.

Execution order: **11.2A -> 11.4 profiling/hardening -> 11.5A-D packaging ->
final acceptance (11.3 + 11.5E + final 11.4 benchmark) -> 11.6 RC closeout**.
Only comprehensive manual acceptance is postponed. Focused tests and required
automated gates continue per slice; pending acceptance remains pending and all
release gates are unchanged.

#### 11.2A-02 — Clean Audience standby and browser fullscreen

Owner request 2026-08-31: widen the cramped standby waiting heading and remove
the bottom fullscreen button/status so the Audience output stays clean.
Use browser fullscreen (F11 on the supported Windows setup); do not add an
in-page replacement control or intercept the browser shortcut. Preserve the
waiting copy, branding, public state, safe areas, and winner selection/data.
Scope: Audience standby layout and removal of the fullscreen overlay in all
production Audience states. The existing protocol and standalone fullscreen
utility remain unchanged. No new dependency or persisted setting.
Acceptance: standby fits within the safe area at 1920 x 1080 and smaller
desktop viewports; no fullscreen controls or status overlay in standby, draw,
blackout, connecting, or disconnected states. Keep assistive state announcements.
Real Chrome/Edge F11 entry/exit remains a final manual acceptance check.

- [x] Approve the bounded Audience presentation fix described above.
- [x] Implement and verify; record focused tests and browser observations in `PHASE-11-ACCEPTANCE.md` (full browser acceptance remains pending).

Owner copy follow-up 2026-08-31 for 11.2A-02: replace the idle heading with
"Menunggu undian berikutnya". Copy only; no layout or state changes. Custom
messages/menu are deferred for a separate discussion, not approved for implementation.

### Browser, viewport, and scale verification

- [ ] Test the current desktop Chrome version.
- [ ] Test the current desktop Edge version.
- [ ] Test at 1366 × 768.
- [ ] Test the Operator Panel at 1440 × 900.
- [ ] Test the Audience Display at 1920 × 1080.
- [ ] Test at least 10,000 participant records.
- [ ] Test draws of up to 100 winners.
- [ ] Verify the secure selection performance target on the agreed device.

### Release verification

- [ ] Run `npm run lint`.
- [ ] Run a standalone typecheck if a typecheck script exists at that time.
- [ ] Run all tests if a test script exists at that time.
- [ ] Run `npm run build`.
- [ ] Review the production bundle for unexpected assets or dependencies.
- [ ] Approve the Windows local Host technology through an ADR and focused
  spike. The product direction is an installed/portable `Raffle OS Host.exe`
  that serves the production web build and opens normal Chrome/Edge.
- [ ] Produce a reproducible local/offline release package with a version/build
  manifest, checksums, third-party notices, and launch/update/rollback guidance.
- [ ] Verify a clean Windows event laptop requires no Laragon, XAMPP, Node.js,
  npm, Vite, PHP, external web server, or internet connection.
- [ ] Verify the packaged artifact preserves same-origin Operator/Audience
  behavior, SPA route fallback, offline launch, and IndexedDB data across the
  approved update path.
- [ ] Record Host security, signing, runtime, browser selection, canonical
  origin, data-location, install/update/uninstall, license, and dependency
  decisions before implementation.
- [ ] Remove development-only seed data from production paths.
- [ ] Remove debug output.
- [ ] Complete the operator rehearsal checklist.
- [ ] Complete manual acceptance testing against the PRD.
- [ ] Document known limitations.

### Exit criteria

- [ ] All required and available verification commands pass.
- [ ] Core workflows pass manual acceptance testing.
- [ ] No critical accessibility issue remains.
- [ ] No critical data-integrity issue remains.
- [ ] Production UI and operational guidance are complete in approved Bahasa
  Indonesia without changing stored domain identities.
- [ ] The approved release package is reproducible, identified by version and
  checksum, and passes offline launch and update-persistence smoke tests.
- [ ] Release limitations are documented.

## Separate Workstream — Kocokan Operator UI Redesign

Owner approval 2026-08-31: adopt the controlled visual modernization plan in
[`docs/technical/KOCOKAN-UI-REDESIGN-PLAN.md`](docs/technical/KOCOKAN-UI-REDESIGN-PLAN.md).
This is separate from Phase 11 functional requirements and its 11.2A items.
Do not renumber phases, broaden domain behavior, or change release gates.

- [x] Slice 0 — Baseline & Scope: preserve existing Phase 11 work at `523da46`,
  branch `redesign/kocokan-ui`, record verification/failure register, visual
  inventory, theme/CSS proposal, tokens and browser/manual checklist.
  Full-suite baseline is FAIL (142 tests); this preparation checkbox does not
  imply application acceptance. See the dedicated baseline record.
- [ ] Slice 1 — Visual System & App Shell: implementation and verification
  recorded in [Slice 1 report](docs/technical/KOCOKAN-UI-SLICE-1.md); owner
  visual acceptance remains pending. Requested light-surface corrections are
  recorded in the [refinement report](docs/technical/KOCOKAN-UI-SLICE-1-REFINEMENT.md).
  Separate execution approval received
  after Slice 0 acceptance. Full-suite baseline debt is not waived.
- [ ] Slice 2 — Dashboard & Event Preparation: execution authorized on
  2026-08-31; preflight blocked by 18 existing focused failures (45 pass,
  no new failures). See [preflight](docs/technical/KOCOKAN-UI-SLICE-2.md).
  Separate baseline reconciliation direction is required before implementation.
- [ ] Slice 3 — Draw Console.
- [ ] Slice 4 — Pending Results.
- [ ] Slice 5 — History.
- [ ] Slice 6 — Settings & Cross-App States.
- [ ] Slice 7 — Integrated Visual Acceptance.

Plan approval is not authorization to execute every slice automatically.
Implement, verify and commit each approved slice separately; stop for approval
before the next. Phase 11 defect/localization reconciliation is separately
owned and must not be mixed into redesign commits. Audience presentation and
prototype styling remain explicit exclusions.

## Deferred P2 Backlog

These items are not scheduled for MVP implementation and require separate scope approval:

- [ ] QR check-in.
- [ ] Mobile remote control.
- [ ] Networked multi-device operation.
- [ ] Cloud synchronization.
- [ ] Authentication and user roles.
- [ ] Ticketing integration.
- [ ] WhatsApp integration.
- [ ] Digital prize claiming.
- [ ] Theme marketplace.
- [ ] External legal-grade audit integration.

## Definition of Done for Every Coding Task

- [ ] The change implements only the requested scope.
- [ ] Product invariants remain preserved.
- [ ] TypeScript types are explicit.
- [ ] Relevant tests are added or updated.
- [ ] The available lint command passes.
- [ ] The available typecheck command passes, if one exists.
- [ ] The available test command passes, if one exists.
- [ ] The production build passes.
- [ ] UI is manually reviewed when applicable.
- [ ] Documentation is updated when behavior changes.
- [ ] A completion report is provided.
- [ ] The Git diff is reviewed for unrelated changes.

## Recommended Execution Order

1. Complete Phase 0 baseline verification and repository conventions.
2. Complete Phase 1 technical decisions and application foundation.
3. Phase 2 static UI using mock data is complete and accepted.
4. Define Phase 3 domain models and persistence. Persistence must exist before official history, audit, and recovery.
5. Implement Phase 4 import and eligibility foundations against the approved domain model.
6. Implement and fully test the Phase 5 draw engine. It must pass domain and performance verification before connection to Live Mode.
7. Connect the tested engine through Phase 6 setup and Live workflow.
8. Add Phase 7 Audience synchronization. Synchronization must present state and must not own draw-result generation.
9. Implement Phase 8 confirmation and redraw after the draw-session domain model exists. Confirmation and redraw depend on the winner, redraw, and audit relationships.
10. Build Phase 9 history and export after persistence and official record behavior are stable.
11. Complete Phase 10 recovery and operational safety. Perform backup/restore work only if its conditional P2 scope is approved.
12. Finish with Phase 11 accessibility, performance, acceptance, and release hardening.

## Immediate Next Task

Begin **Phase 3 planning** for the domain model and local persistence:

- review the Phase 3 roadmap against the PRD and accepted Phase 2 presentation
  contracts;
- define proposed domain types, state transitions, persistence boundaries, and
  schema-versioning rules;
- compare direct IndexedDB use with any proposed dependency and obtain approval
  before adding one;
- preserve ticket identifiers as strings and retain all product invariants; and
- produce an implementation plan before changing application behavior.

No Phase 3 implementation task is marked complete.
