# Raffle OS

Raffle OS is a local-first event raffle application for drawing one or multiple winners from ticket-number participant data. It is designed around a separate Operator Panel and fullscreen Audience Display for LED screens, projectors, or vMix capture.

> **Project status:** Raffle OS is in early development. The repository currently contains a React, TypeScript, and Vite starter scaffold plus product documentation and an approved Phase 1 technical plan. Production raffle functionality has not yet been implemented.

## Product Goals

The following are product goals, not completed features:

- Remain local-first and usable without an internet connection.
- Import participant data identified by ticket numbers.
- Draw one or multiple winners in a single operation.
- Preserve leading zeroes by treating ticket numbers as strings.
- Keep the Operator Panel separate from the fullscreen Audience Display.
- Support winner confirmation, redraw, history, and an operational audit trail.
- Use the Web Crypto API for official winner selection.
- Remain practical and readable during professional event operations.

## Current Repository Status

| Area | Current status |
|---|---|
| Application | Default Vite React starter; Raffle OS screens and workflows are not implemented |
| React | React 19 (`^19.2.7`; lockfile resolved to 19.2.8 during the baseline audit) |
| TypeScript | TypeScript 6 (`~6.0.2`; lockfile resolved to 6.0.3); strict mode is planned but not explicitly enabled |
| Vite | Vite 8 (`^8.1.1`; lockfile resolved to 8.1.5) |
| ESLint | ESLint 10 with TypeScript, React Hooks, and React Refresh rules |
| npm scripts | `dev`, `build`, `lint`, and `preview` |
| Documentation | `AGENTS.md`, `TASKS.md`, `docs/product/PRD.md`, and `docs/technical/PHASE-1-PLAN.md` |
| Routing | Not implemented; no routing package is currently installed |
| Tests | No test runner, test script, or tests currently exist |
| Persistence | Not implemented |
| Draw engine | Not implemented |

## Planned MVP Capabilities

The planned MVP includes:

- Event setup.
- CSV and XLSX participant import.
- Duplicate and invalid-ticket validation.
- Prize-category and winner-count configuration.
- Secure selection of multiple winners.
- Practice and Live Mode.
- A separate fullscreen Audience Display.
- Pending-result verification.
- Partial redraw.
- Draw history and an audit trail.
- CSV or XLSX result export.
- Local persistence and interrupted-session recovery.

Implementation progress is tracked in [TASKS.md](TASKS.md).

## Technology

### Current

The following technology is confirmed in the repository:

- React
- TypeScript
- Vite
- ESLint
- npm

### Planned and Subject to Approval

The approved Phase 1 plan proposes the following foundations. They may not be installed and must not be treated as currently available until `package.json` confirms them:

- React Router
- Tailwind CSS
- Vitest
- React Testing Library
- An IndexedDB persistence approach in a later phase

See [the Phase 1 technical plan](docs/technical/PHASE-1-PLAN.md) for the proposed packages, tradeoffs, and implementation slices.

## Requirements

Local development currently requires:

- Node.js
- npm
- Git
- A current desktop version of Chrome or Edge for manual review

Node.js 22.20.0 and npm 10.9.3 were used during the repository baseline audit. These are verified environment versions, not declared universal minimums; `package.json` does not currently define an `engines` requirement.

## Local Development

Install the current dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Run the configured linter:

```bash
npm run lint
```

Run the TypeScript and production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

There is currently no standalone `typecheck` or `test` script.

## Project Documentation

- [Product Requirements Document](docs/product/PRD.md) — approved product scope, behavior, constraints, and acceptance criteria.
- [Phase 1 Technical Plan](docs/technical/PHASE-1-PLAN.md) — audited baseline and approved application-foundation plan.
- [Implementation Roadmap](TASKS.md) — ordered phases and implementation progress.
- [Agent Guidelines](AGENTS.md) — engineering rules and product invariants for coding agents.

Read the PRD and relevant technical documentation before implementing product features. If project documents conflict, report the conflict rather than choosing silently.
