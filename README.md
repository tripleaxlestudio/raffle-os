# KOCOKAN

by Tripleaxle Studio

Kocokan is a local-first raffle and event draw system with a production
Operator interface and a separate fullscreen Audience Display.

The repository name remains `raffle-os`; **Kocokan** is the product identity.

## What Kocokan provides

- A browser-based local Operator application for preparing and running event
  draws.
- A separate Audience Display for projectors, LED screens, fullscreen browser
  output, and vMix browser capture.
- Production workflows for participant import, draw setup and execution,
  pending-result decisions, confirmation, redraw, history, and export.
- Local-first persistence using browser IndexedDB.
- Local WebSocket transport between the packaged Operator and Audience
  surfaces.
- Windows distribution through a self-contained launcher, portable ZIP, and
  Inno Setup installer.

The packaged Windows application uses the fixed local origin
`http://127.0.0.1:47882`. It bundles the required runtime and does not require a
cloud service for normal operation.

## Data and release boundaries

- Application data is browser-profile and origin scoped; it is not cloud
  synchronized.
- The v0.1.0 Windows build is unsigned, so Windows SmartScreen may warn.
- There is no automatic updater in v0.1.0.
- Kocokan is not claimed to be legally certified or externally audited.

See [Kocokan v0.1.0 release notes](docs/releases/KOCOKAN-v0.1.0.md) for the
release scope, known limitations, and acceptance disposition.

## Technology

- React 19 and React DOM 19
- React Router 7
- TypeScript 6 in strict mode
- Vite 8 and Tailwind CSS 4
- Dexie/IndexedDB local persistence
- WebSocket local Audience transport
- Vitest and React Testing Library
- Self-contained .NET Windows launcher with bundled Node.js runtime

## Local development

Install locked dependencies:

```powershell
npm.cmd install
```

Common commands:

| Command | Purpose |
|---|---|
| `npm.cmd run dev` | Start the Vite development server |
| `npm.cmd run build` | Type-check and build the web application |
| `npm.cmd run build:runtime` | Build the packaged local runtime |
| `npm.cmd run lint` | Run ESLint |
| `npm.cmd run typecheck` | Run TypeScript checking without emit |
| `npm.cmd run test` | Run the Vitest suite once |

## Documentation

- [Product Requirements Document](docs/product/PRD.md)
- [Implementation roadmap](TASKS.md)
- [Local Host architecture](docs/architecture/LOCAL-HOST-RUNTIME.md)
- [P4 packaging and acceptance record](docs/technical/KOCOKAN-PACKAGING-P4.md)
- [Third-party notices](docs/legal/THIRD-PARTY-NOTICES.md)
- [Engineering guidelines](AGENTS.md)

Read the PRD and relevant technical documentation before changing product
behavior. Ticket identifiers must remain strings, official selection must use
Web Crypto, and the visual rolling animation must never determine the result.
