# Project Overview

Raffle OS is a planned local-first web application for running event raffles with ticket numbers. It separates a production-oriented Operator Panel from a fullscreen Audience Display intended for LED screens, projectors, or vMix capture.

The Phase 1 application foundation and Phase 2 deterministic static UI prototype are implemented and accepted. Phase 4 production Participant Import is implemented for bounded CSV/XLSX staging, mapping, validation, and local atomic persistence with audit evidence. The repository contains routing, separate Operator and Audience layouts, safe error handling, semantic styling and tokens, reusable accessible presentation components, deterministic mock scenarios, high-fidelity static screens, and automated tests.

Draw-related screens remain presentation-only. Eligibility, candidate-pool construction, secure draw selection, winner confirmation, redraw mutation, Operator/Audience synchronization, export, interrupted-session recovery, backend services, and cloud behavior remain unimplemented. Later-phase product capabilities remain planned and must not be described as implemented unless the code confirms them.

# Source of Truth

- Read `docs/product/PRD.md` before implementing product features.
- Read other relevant documentation under `docs/` when it exists.
- If requirements conflict, do not choose silently. Report the conflict before implementation.
- Prefer the most recently approved project documentation. If approval or recency is unclear, ask for direction.
- Do not change product requirements unless explicitly instructed.

# Current Technology

The currently confirmed stack is:

- React 19
- React Router 7
- TypeScript 6
- Vite 8
- Tailwind CSS 4 through the official Vite plugin
- Vitest 4 with jsdom 29
- React Testing Library 16, jest-dom 7, and user-event 14
- ESLint 10
- npm with a committed lockfile

React, React DOM, React Router, Dexie, and the approved SheetJS CE 0.20.3 tarball are current production dependencies. Tailwind CSS, the testing stack, and fake-indexeddb are development dependencies. No state-management library is installed.

The application and Node TypeScript configurations explicitly enable `strict: true`.

# Product Invariants

- The MVP must remain local-first and usable without internet.
- Do not add a backend, cloud database, authentication, payment, or online registration unless explicitly added to the approved scope.
- Treat ticket numbers as strings at all times.
- Never remove leading zeroes.
- Use the Web Crypto API for final winner selection.
- Never use `Math.random()` for official winner selection.
- Never select one participant twice in the same draw.
- Visual rolling animation must not determine or alter the final result.
- Keep the Operator Panel and Audience Display as separate interfaces.
- Practice Mode must not modify official winner eligibility or Live history.
- Confirmed Live Mode results must have an audit trail.
- Redraw must preserve both the cancelled winner and the relationship to the replacement winner.
- Never silently overwrite or delete official draw history.

# Architecture Rules

- Keep domain logic separate from React presentation components.
- Do not place random draw logic directly inside page components.
- Keep participant import, eligibility, draw engine, persistence, display communication, and export logic in separate modules or services.
- Prefer small, focused, typed components.
- Avoid global mutable state.
- Do not introduce a new state-management library without a clear need.
- Do not add a dependency when browser APIs or existing dependencies are sufficient.
- Explain the purpose, need, and tradeoffs of every new production dependency before adding it.
- Do not claim that planned modules or architecture already exist.

# TypeScript Rules

- TypeScript strict mode must remain enabled.
- Avoid `any`.
- Avoid unsafe type assertions.
- Define explicit domain types for participants, events, draw sessions, winners, statuses, and redraw records.
- Use discriminated unions for important application states when appropriate.
- Catch errors as `unknown` and narrow them safely.
- Preserve ticket identifiers as strings through import, validation, storage, drawing, display, history, and export.

# UI and UX Rules

- The Operator Panel should feel like professional event-control software, not a generic SaaS dashboard.
- Provide one clear primary action per screen.
- Make Practice and Live Mode visually distinct without relying on color alone.
- Require explicit confirmation for destructive actions and actions affecting Live Mode.
- The Audience Display must not expose operator controls or internal participant data.
- Ticket numbers must be the visually dominant element on the Audience Display.
- Optimize the Operator Panel for 1440 × 900.
- Optimize the Audience Display for 1920 × 1080 at 16:9.
- Avoid excessive gradients, glass effects, glow, and decorative motion.
- Prioritize accessibility, contrast, readability, and visible system state over decoration.

# Data and Draw Integrity

- Validate duplicate, empty, and malformed ticket numbers before they enter an eligible pool.
- Never coerce ticket numbers to numeric values.
- Verify that the eligible participant count is sufficient before starting a draw.
- For each official draw, store or prepare to store the eligible-pool snapshot, active filters, timestamp, mode, and selected winners.
- Require a redraw reason in Live Mode.
- Keep cancelled winners visible in audit history.
- Preserve an explicit relationship between each cancelled winner and replacement winner.
- Do not claim that the system is legally certified or externally audited.

# Testing Expectations

- Add tests whenever implementing domain logic.
- Random-helper tests must verify bounds and duplicate prevention; they must not attempt to prove randomness statistically.
- Eligibility tests must cover previous winners, check-in requirements, and category rules.
- Import tests must cover leading zeroes, duplicates, empty values, and malformed rows.
- Redraw tests must verify cancellation history and replacement relationships.
- Practice Mode tests must verify that Live eligibility and official records remain unchanged.
- Do not claim tests were run when no corresponding script or runner exists.

# Commands and Verification

The following npm scripts currently exist:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Run the TypeScript project build, then create a Vite production build |
| `npm run lint` | Run ESLint across the repository |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Run the TypeScript project build in no-emit mode |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

Before completing a coding task:

- Run `npm run lint` when the changed files are covered by ESLint.
- Run `npm run build` for application or TypeScript changes.
- Run other relevant scripts only if they exist in `package.json` at that time.
- Report any command that could not be run and why.

# Change Discipline

- Implement only the requested scope.
- Do not perform unrelated refactors.
- Do not modify product requirements without explicit instruction.
- Do not silently change package versions.
- Do not delete existing data migrations or audit-related logic.
- Once local persistence exists, preserve backward compatibility for stored local data.
- For a large task, present a brief plan before editing.
- Keep changes reviewable and grouped by purpose.
- Preserve unrelated user changes in the worktree.

# Completion Report

Every completed implementation task must report:

1. What changed.
2. Files created or modified.
3. Commands run and their results.
4. Assumptions made.
5. Remaining risks or follow-up work.
