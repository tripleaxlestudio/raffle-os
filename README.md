# Raffle OS

Raffle OS is a planned local-first event raffle application centered on ticket
numbers. The interface is split into a production-oriented Operator Panel and a
standalone fullscreen Audience Display for LED screens, projectors, or vMix
capture.

> **Project status:** Phase 1 application foundation and the Phase 2
> deterministic static UI prototype are implemented and accepted. The current
> screens use immutable mock fixtures and query-selected scenarios; they do not
> perform production raffle operations.

## Implemented Presentation Prototype

The Phase 2 prototype includes:

- a high-fidelity Operator shell, navigation, dashboard, participant-import
  wizard, draw setup, live-draw states, pending results, redraw drawer, history,
  and settings;
- a structurally separate Audience Display with standby, countdown, rolling,
  reveal, confirmed, blackout, and disconnected-safe states;
- exact hero, 3 × 2, 5 × 2, and 5 × 4 winner layouts for 1, 6, 10, and 20
  tickets;
- reusable typed presentation primitives with accessible focus and dialog
  behavior;
- deterministic, query-driven mock scenarios; and
- Vitest and Testing Library coverage for routing, components, screens,
  accessibility semantics, scope boundaries, and the complete mock happy path.

These are presentation prototypes only. Production file import, persistence,
eligibility evaluation, secure winner selection, confirmation and redraw
mutation, Operator/Audience synchronization, export, recovery, audio,
fullscreen control, backend services, and cloud behavior are planned for later
phases and are not implemented.

## Interfaces and Routes

Operator routes share the Operator layout:

| Route | Prototype surface |
|---|---|
| `/` | Redirects to `/dashboard` |
| `/dashboard` | Event-control dashboard |
| `/participants` | Participant Import wizard |
| `/draw/setup` | Draw configuration |
| `/draw/live` | Ready and running draw presentation |
| `/draw/results` | Pending Results and redraw presentation |
| `/history` | Draw sessions, winners, audit log, and session detail |
| `/settings` | Branding, presentation, audio, and display settings |

The Audience Display is a separate interface at `/display`. Unknown paths use
the not-found route.

Prototype states are selected with URL query parameters. Examples:

```text
/participants?step=review
/draw/setup?mode=live&scenario=insufficient
/draw/live?state=running&mode=practice&stage=countdown
/draw/results?scenario=partial
/draw/results?panel=redraw&selection=multiple
/history?view=session-detail
/settings?section=display
/display?state=reveal&count=6
/display?state=confirmed&count=20
/display?state=blackout
/display?state=disconnected
```

Query changes select deterministic presentation fixtures. They do not import,
draw, confirm, redraw, persist, synchronize, or export data.

## Technology

- React 19 and React DOM 19
- React Router 7
- TypeScript 6 with explicit strict mode
- Vite 8
- Tailwind CSS 4 through the official Vite plugin
- Vitest 4 with jsdom
- React Testing Library, jest-dom, and user-event
- ESLint 10
- npm with a committed lockfile

React, React DOM, and React Router are the production dependencies. No
persistence or state-management library is installed.

## Local Development

Install dependencies:

```bash
npm install
```

Available scripts:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Run the TypeScript project build and create a Vite production build |
| `npm run lint` | Run ESLint across the repository |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Run the TypeScript project build in no-emit mode |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

Node.js 22.20.0 and npm 10.9.3 were recorded during the Phase 2 planning audit.
They are verified environment versions, not declared universal minimums;
`package.json` does not define an `engines` requirement.

## Project Documentation

- [Product Requirements Document](docs/product/PRD.md) — approved product
  scope, behavior, constraints, and acceptance criteria.
- [Phase 1 Acceptance](docs/technical/PHASE-1-ACCEPTANCE.md) — permanent
  application-foundation acceptance record.
- [Phase 2 Plan](docs/technical/PHASE-2-PLAN.md) — implementation plan and
  completed acceptance checklist.
- [Phase 2 Acceptance](docs/technical/PHASE-2-ACCEPTANCE.md) — permanent static
  prototype acceptance record.
- [Implementation Roadmap](TASKS.md) — ordered phases and verified progress.
- [Agent Guidelines](AGENTS.md) — engineering rules and product invariants.

Read the PRD and relevant technical documentation before implementing product
features. If project documents conflict, report the conflict rather than
choosing silently.
