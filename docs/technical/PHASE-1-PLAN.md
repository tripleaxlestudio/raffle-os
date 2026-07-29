# Phase 1 Repository Audit and Implementation Plan

This document records the approved conceptual plan for **Phase 1 — Application Foundation**. It is planning documentation only. No package or planned capability described here should be treated as installed or implemented until the repository proves otherwise.

## 1. Loaded Project Guidance

The following project guidance was found, read completely, and understood during the audit:

- `AGENTS.md` — engineering constraints and product invariants.
- `TASKS.md` — ordered implementation roadmap and Phase 1 checklist.
- `docs/product/PRD.md` — product scope, UX direction, integrity requirements, and acceptance criteria.

No blocking conflicts were found. The apparent TypeScript wording difference is reconciled by `AGENTS.md`: strict mode is required, but the current tsconfig files do not explicitly enable it. Enabling strict mode is therefore planned Phase 1 work.

## 2. Repository Baseline Audit

### Git and stack

| Item | Verified state |
|---|---|
| Branch | `main`, tracking `origin/main` |
| Working tree | Clean before and after audit verification |
| Framework | React 19 |
| Language | TypeScript 6 |
| Build tool | Vite 8 |
| Linter | ESLint 10 with TypeScript, React Hooks, and React Refresh rules |
| Package manager | npm 10.9.3 with lockfile v3 |
| Runtime used during audit | Node.js 22.20.0 |
| Installed browsers detected | Chrome 150 and Edge 150 |

### Current dependencies

| Dependency | Declared | Lockfile resolution |
|---|---:|---:|
| `react` | `^19.2.7` | `19.2.8` |
| `react-dom` | `^19.2.7` | `19.2.8` |

Current dev dependencies are:

- `@eslint/js`
- `@types/node`
- `@types/react`
- `@types/react-dom`
- `@vitejs/plugin-react`
- `eslint`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `globals`
- `typescript`
- `typescript-eslint`
- `vite`

The audited lockfile contained 187 package entries.

### Existing npm scripts

- `npm run dev`
- `npm run build` — runs `tsc -b && vite build`
- `npm run lint`
- `npm run preview`

There is currently no `test`, `test:watch`, or standalone `typecheck` script.

### Existing files and capabilities

- Application source consists of `main.tsx`, `App.tsx`, starter CSS, and Vite/React starter assets.
- Public assets are the Vite favicon and starter icon sprite.
- Documentation consists of the default Vite README, `AGENTS.md`, `TASKS.md`, and the PRD.
- Application routing does not exist.
- A project styling system does not exist. Starter global CSS contains variables and nested CSS but is not a Raffle OS design system.
- Tests and a test runner do not exist.
- Persistence and IndexedDB modules do not exist.
- Product domain models and domain modules do not exist.
- The Operator Panel and Audience Display do not exist.
- The current application is still the default Vite starter.

## 3. Verification Results

The following commands were run during the audit:

| Command | Exit status | Result |
|---|---:|---|
| `npm run lint` | 1 | PowerShell blocked `npm.ps1` under the machine execution policy; ESLint did not start |
| `npm.cmd run lint` | 0 | ESLint completed with no diagnostics |
| `npm run build` | 1 | PowerShell blocked `npm.ps1`; the build did not start |
| `npm.cmd run build` | 0 | TypeScript build and Vite production build passed |

The successful production build:

- used Vite 8.1.5;
- transformed 20 modules;
- completed in 234 ms; and
- emitted no build warnings.

Git inspection emitted a warning that `C:\Users\User\.config\git\ignore` could not be read. This did not affect the repository's clean status and does not block Phase 1.

On this Windows environment, use `npm.cmd` when PowerShell execution policy blocks the `npm.ps1` wrapper.

## 4. Gap Analysis Against Phase 1

| Phase 1 requirement | Current repository state | Missing work | Dependency or decision required | Risk |
|---|---|---|---|---|
| Routing | None | Router, nested routes, redirects, route tests | Proposed `react-router` package | Medium |
| Styling | Starter CSS only | Tailwind integration and semantic tokens | Proposed Tailwind packages | Medium |
| Testing | None | Runner, DOM environment, setup, scripts | Proposed Vitest and Testing Library stack | High |
| Folder architecture | Flat starter | App, pages, shell, domain types, shared, and test structure | Architecture decision approved conceptually | Medium |
| Domain types | None | Minimal mode and connection-status unions | No package | Medium |
| Operator shell | None | Shared layout, sidebar, header, and content outlet | Router required | Medium |
| Audience separation | None | Independent top-level shell and route | Router required | High |
| Placeholder pages | None | Eight inert route pages | Router and shared placeholder | Low |
| Error boundary | None | Global render fallback and route error fallback | React and Router APIs | Medium |
| Not-found route | None | Wildcard route and recovery link | Router required | Low |
| Responsive foundation | Starter-only | Desktop shell sizing and Audience safe area | Tailwind and tokens | Medium |
| Design tokens | Starter variables | Shared contract plus separate interface themes | Tailwind and CSS variables | Medium |

## 5. Technical Decisions

These decisions are approved conceptually. The packages remain **uninstalled** and require explicit approval before installation.

### Routing

**Recommendation:** React Router Data Mode with route objects, `createBrowserRouter`, and `RouterProvider`.

Planned behavior:

- Install the currently uninstalled production package `react-router`.
- Export a reusable `RouteObject[]` so tests can construct a `createMemoryRouter`.
- Use a nested Operator route with `<Outlet>`.
- Keep `/display` as a top-level sibling that never renders Operator navigation.
- Redirect `/` to `/dashboard`.
- Require an `index.html` fallback from the eventual local HTTP host for direct deep links.

React Router is recommended over a custom History API router because it supplies nested layouts, redirects, wildcard matching, error elements, accessible links, and memory-router testing without creating project-owned routing infrastructure.

TanStack Router offers stronger route inference but adds unnecessary setup for this fixed, parameter-free Phase 1 route map. Minimal browser-API routing avoids a dependency but would require the project to own history handling, matching, redirects, errors, and test infrastructure.

Reference: [React Router installation](https://reactrouter.com/start/declarative/installation) and [createBrowserRouter](https://reactrouter.com/api/data-routers/createBrowserRouter).

Tradeoff: React Router adds one production dependency, and BrowserRouter requires a local host with SPA fallback.

### Styling

**Recommendation:** Tailwind CSS with CSS custom properties.

Proposed, currently uninstalled dev dependencies:

- `tailwindcss`
- `@tailwindcss/vite`

Use Tailwind utilities for layout and component composition. Store semantic colors and interface-specific theme values in CSS custom properties rather than hard-coding palette utilities throughout JSX. Use Tailwind v4 `@theme inline` aliases so utilities can reference the semantic variables.

This approach supports a production-oriented Operator theme and an independently replaceable Audience theme while remaining local and avoiding runtime styling dependencies.

Reference: [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite) and [Tailwind theme variables](https://tailwindcss.com/docs/theme).

Tradeoffs:

- It adds build-time packages and utility classes to JSX.
- It requires discipline so arbitrary utility values do not bypass tokens.
- Phase 1 must define only the token contract and conservative defaults; the complete visual system belongs to Phase 2.

Alternatives considered:

- CSS Modules plus custom properties: strong isolation and no additional styling dependency, but not the selected conceptual approach.
- Global CSS only: lowest setup cost but weaker scaling and component isolation.

### Testing

**Recommendation:** Vitest with React Testing Library in jsdom.

Proposed, currently uninstalled dev dependencies:

- `vitest`
- `jsdom`
- `@testing-library/react`
- `@testing-library/dom`
- `@testing-library/user-event`
- `@testing-library/jest-dom`

Planned scripts:

- `typecheck`: `tsc -b`
- `test`: `vitest run`
- `test:watch`: `vitest`

Use explicit Vitest imports rather than global test functions. Keep future domain tests as plain TypeScript tests; use Testing Library only for route, shell, and interaction behavior.

Reference: [Vitest setup](https://vitest.dev/guide/) and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/).

Tradeoff: jsdom is not a real browser, so Chrome and Edge smoke checks remain required. Coverage tooling is intentionally deferred.

### Proposed dependencies requiring approval

No package in this table is currently installed.

| Classification | Proposed package |
|---|---|
| Production | `react-router` |
| Development | `tailwindcss` |
| Development | `@tailwindcss/vite` |
| Development | `vitest` |
| Development | `jsdom` |
| Development | `@testing-library/react` |
| Development | `@testing-library/dom` |
| Development | `@testing-library/user-event` |
| Development | `@testing-library/jest-dom` |

## 6. Proposed Phase 1 Architecture

### Create during Phase 1

```text
src/
├── main.tsx
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   ├── errors/
│   │   ├── AppErrorBoundary.tsx
│   │   └── RouteErrorPage.tsx
│   ├── layouts/
│   │   ├── OperatorLayout.tsx
│   │   └── AudienceDisplayShell.tsx
│   └── shell/
│       ├── OperatorSidebar.tsx
│       ├── OperatorHeader.tsx
│       ├── ModeBadge.tsx
│       └── ConnectionStatus.tsx
├── domain/
│   └── types/
│       ├── app-mode.ts
│       ├── display-connection.ts
│       └── index.ts
├── pages/
│   ├── operator/
│   │   ├── DashboardPage.tsx
│   │   ├── ParticipantsPage.tsx
│   │   ├── DrawSetupPage.tsx
│   │   ├── LiveDrawPage.tsx
│   │   ├── PendingResultsPage.tsx
│   │   ├── HistoryPage.tsx
│   │   └── SettingsPage.tsx
│   ├── display/
│   │   └── AudienceDisplayPage.tsx
│   └── system/
│       └── NotFoundPage.tsx
├── shared/
│   └── components/
│       └── RoutePlaceholder.tsx
├── styles/
│   ├── app.css
│   └── tokens.css
└── test/
    ├── setup.ts
    └── environment.test.ts
```

Phase 1 should also create:

- `vitest.config.ts`; and
- one concise architecture decision document under `docs/technical/`.

The minimal Phase 1 domain types are planned as:

- `AppMode = 'practice' | 'live'`
- `DisplayConnectionStatus = 'disconnected' | 'connecting' | 'connected'`

They support typed shell placeholders only and contain no transitions or business behavior.

Unused Vite starter component CSS and starter source/public assets may be removed when their imports are removed. The default README must remain untouched because its replacement is a separate Phase 0 documentation task.

### Defer until later phases

```text
src/domain/events/
src/domain/participants/
src/domain/draws/
src/domain/winners/
src/domain/history/
src/domain/settings/
src/infrastructure/persistence/
src/services/display-communication/
src/services/export/
src/features/participant-import/
```

Do not create empty deferred directories merely to imply architecture that does not yet exist.

## 7. Proposed Route Map

| Route | Layout | Phase 1 behavior |
|---|---|---|
| `/` | Operator | Replace-redirect to `/dashboard` |
| `/dashboard` | Operator | Dashboard placeholder |
| `/participants` | Operator | Participants placeholder |
| `/draw/setup` | Operator | Draw Setup placeholder |
| `/draw/live` | Operator | Live Draw placeholder |
| `/draw/results` | Operator | Pending Results placeholder |
| `/history` | Operator | History placeholder |
| `/settings` | Operator | Settings placeholder |
| `/display` | Audience | Independent fullscreen-ready placeholder |
| `*` | Neutral system page | Not-found page with a link to `/dashboard` |

Operator pages should be nested beneath `OperatorLayout`, which owns navigation, header, and `<Outlet>`.

`/display` must be a sibling route and must not inherit the Operator layout. This prevents operator navigation, controls, and internal status from appearing on the public-facing display.

Phase 1 must not introduce loaders, actions, data fetching, draw behavior, or persistent route state.

## 8. Foundational Component Plan

Minimum Phase 1 components:

- `App` — global composition of `AppErrorBoundary` and `RouterProvider`.
- `OperatorLayout` — desktop grid and route outlet.
- `OperatorSidebar` — semantic navigation using `NavLink`.
- `OperatorHeader` — static event placeholder, mode badge, and connection status.
- `ModeBadge` — typed presentation of Practice or Live with no mode-changing behavior.
- `ConnectionStatus` — typed presentation placeholder with no BroadcastChannel behavior.
- `RoutePlaceholder` — consistent title, purpose, and “foundation only” message.
- `AudienceDisplayShell` — fullscreen-safe wrapper with its own theme scope.
- `AppErrorBoundary` — catches React render failures and offers a safe reload action.
- `RouteErrorPage` — safely narrows unknown router errors.
- `NotFoundPage` — handles unmatched paths.

Phase 1 must not add the Phase 2 primitive library, modal system, toast system, tables, form controls, production display states, or animation.

## 9. Design Token Foundation

Place tokens in `src/styles/tokens.css` and import Tailwind and the tokens through `src/styles/app.css`.

Use three layers:

1. `@theme inline` exposes semantic variables to Tailwind utilities.
2. `:root` defines shared typography, spacing, radii, and layout metrics.
3. `[data-interface="operator"]` and `[data-interface="audience"]` assign independent theme values.

### Minimum semantic token contract

- Background: `--app-bg`
- Surfaces: `--surface`, `--surface-raised`
- Text: `--text-primary`, `--text-muted`
- Border: `--border-default`
- Accent: `--accent`
- Status: `--status-live`, `--status-practice`, `--status-success`, `--status-warning`, `--status-danger`, `--status-disconnected`
- Typography: system sans and local monospace stacks; no remote fonts
- Layout: `--operator-sidebar-width`, `--operator-header-height`, `--content-max-width`
- Spacing: shared base scale plus `--content-padding`
- Radius: small, medium, and large
- Audience safe area: `--audience-safe-inline`, `--audience-safe-block`

### Provisional default palette

- Operator background/surfaces: `#080c12`, `#101720`, `#17212d`
- Operator primary/muted text: `#f4f7fb`, `#94a3b8`
- Operator border/accent: `#283445`, `#22d3ee`
- Audience background/text/accent: `#05070b`, `#ffffff`, `#fbbf24`
- Live/practice/success/danger: `#ef4444`, `#f59e0b`, `#22c55e`, `#ef4444`

Status must always use text, labels, or other cues in addition to color. Future Audience branding should override only Audience-scoped variables and must not mutate Operator tokens.

### Responsive baseline

- Operator sidebar: `15rem`
- Operator header: `4rem`
- Operator content: fluid remaining column
- Content padding: `clamp(1rem, 2vw, 2rem)`
- Audience safe area: `clamp(1.5rem, 5vw, 6rem)`

Mobile-specific navigation is outside Phase 1. The foundation should remain stable across supported desktop viewports from 1366 × 768 upward.

## 10. Implementation Slices

### Slice 1 — Foundation dependencies and configuration

- **Objective:** Install the approved stack, enable strict TypeScript, and establish testing/tooling without changing the visible starter UI.
- **Likely changes:** `package.json`, lockfile, tsconfigs, Vite config, new Vitest config/test setup, and a technical decision document under `docs/technical/`.
- **Proposed dependencies:** All routing, Tailwind, and testing packages listed in Section 5; every package requires approval before installation.
- **Scripts:** Add `typecheck`, `test`, and `test:watch`.
- **Test:** Add one test proving the jsdom and jest-dom setup works.
- **Verification:** `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test`, and `npm.cmd run build`.
- **Review checkpoint:** The dependency diff contains only approved packages, strict mode is explicit, and the test runner exits successfully.
- **Must remain unimplemented:** Routes, layouts, placeholders, tokens, domain behavior, persistence, import, and draw logic.

### Slice 2 — Route tree and inert pages

- **Objective:** Replace the starter application with the route tree and placeholder pages.
- **Likely changes:** App router, page modules, `main.tsx`, shared placeholder, and removal of unused starter files/assets.
- **Proposed dependencies:** None beyond Slice 1.
- **Verification:** Lint, typecheck, tests, and build.
- **Review checkpoint:** All paths resolve, `/` redirects, and the wildcard renders Not Found.
- **Must remain unimplemented:** Operator styling beyond structural hooks and all product behavior.

### Slice 3 — Operator shell

- **Objective:** Add the nested Operator layout, semantic navigation, header, mode badge, and disconnected placeholder.
- **Likely changes:** Operator layout/shell components and route tests.
- **Proposed dependencies:** None.
- **Verification:** Automated route-shell tests plus manual review at 1440 × 900.
- **Review checkpoint:** Every Operator page shares one shell and active navigation is accessible.
- **Must remain unimplemented:** Mode switching, event selection, connection handling, and Live controls.

### Slice 4 — Audience shell separation

- **Objective:** Add the standalone `/display` interface.
- **Likely changes:** Audience shell/page and separation tests.
- **Proposed dependencies:** None.
- **Verification:** Confirm `/display` lacks Operator navigation, mode controls, participant content, and Operator header.
- **Review checkpoint:** Fullscreen-ready structure at 1920 × 1080.
- **Must remain unimplemented:** BroadcastChannel, display states, winner data, animation, and fullscreen API control.

### Slice 5 — Error handling and navigation hardening

- **Objective:** Add the global render fallback, router error fallback, not-found behavior, and keyboard-visible navigation.
- **Likely changes:** Error components and focused tests.
- **Proposed dependencies:** None.
- **Verification:** Test unknown routes and intentional render failures, then run all available checks.
- **Review checkpoint:** Errors are safely narrowed from `unknown` and do not expose internal details.
- **Must remain unimplemented:** Telemetry, remote reporting, persistence recovery, and audit logging.

### Slice 6 — Tailwind tokens and responsive foundation

- **Objective:** Apply the semantic token contract and baseline desktop styling.
- **Likely changes:** Tailwind CSS entrypoint, token file, structural class names, and index metadata/title.
- **Proposed dependencies:** Tailwind packages approved and installed in Slice 1.
- **Verification:** Full automated checks plus manual Chrome and Edge review at 1366 × 768, 1440 × 900, and 1920 × 1080.
- **Review checkpoint:** Operator and Audience themes are independent, status is not color-only, and no generic Vite/SaaS appearance remains.
- **Must remain unimplemented:** Phase 2 UI primitives, detailed screen designs, event branding controls, and production animation.

After Slice 6 passes, update only the verified Phase 1 checkboxes in `TASKS.md`.

## 11. Phase 1 Acceptance Checklist

- [ ] `react-router`, Tailwind, and the test stack are installed only after approval.
- [ ] TypeScript `strict: true` is explicit.
- [ ] `/` redirects to `/dashboard`.
- [ ] All required placeholder routes are directly accessible.
- [ ] Operator routes render under one nested Operator layout.
- [ ] `/display` does not inherit Operator navigation or controls.
- [ ] Unknown paths render the not-found page.
- [ ] Global render and route errors have safe fallback UI.
- [ ] Placeholder pages contain no business logic.
- [ ] No participant-import logic exists.
- [ ] No IndexedDB or persistence logic exists.
- [ ] No random-selection or draw engine exists.
- [ ] No eligibility, confirmation, redraw, export, or BroadcastChannel logic exists.
- [ ] No production animation exists.
- [ ] `npm.cmd run typecheck` passes.
- [ ] `npm.cmd run lint` passes.
- [ ] `npm.cmd run test` passes.
- [ ] `npm.cmd run build` passes.
- [ ] Route tests cover the root redirect, all pages, layout separation, and not-found handling.
- [ ] Current Chrome and Edge smoke checks pass.
- [ ] Operator foundation is usable at 1440 × 900.
- [ ] Audience foundation is usable at 1920 × 1080.
- [ ] Git diff contains no unrelated changes.

## 12. Risks and Open Questions

| Item | Why it matters | Recommended default | Effect of a different choice |
|---|---|---|---|
| SPA deep-link hosting | BrowserRouter requires fallback to `index.html` | Continue with BrowserRouter and require fallback from the local host | If fallback cannot be guaranteed, switch to HashRouter and accept `/#/display` URLs |
| Dependency approval | None of the selected foundation packages are installed | Approve only the package list in this document | Removing React Router or Tailwind substantially changes Slices 1–6 |
| Tailwind token discipline | Arbitrary utilities could fragment theming | Require semantic custom-property aliases for colors and layout metrics | Direct palette utilities would make Audience branding and later theme changes harder |
| Browser testing | jsdom cannot validate real layout or fullscreen behavior | Require manual Chrome and Edge checks in Slice 6 | Deferring this leaves desktop compatibility unverified |
| Default branding | No Raffle OS brand assets exist | Use a text-only “Raffle OS” identity and provisional tokens | Supplied brand assets would replace presentation defaults without changing architecture |

The technical approaches are approved conceptually, but approval of this document alone does not install or authorize unlisted packages. Installation work must remain limited to the explicit package list in Section 5.

## 13. Recommended Immediate Next Task

Implementation should begin with **Slice 1 — Foundation dependencies and configuration only**. Do not implement all of Phase 1 in one task.

### Draft prompt

> Audit the repository state against `AGENTS.md`, `TASKS.md`, the PRD, and the approved `docs/technical/PHASE-1-PLAN.md`. Implement only Phase 1 Slice 1.
>
> Install `react-router` as a production dependency. Install `tailwindcss`, `@tailwindcss/vite`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, and `@testing-library/jest-dom` as dev dependencies. Do not add other packages.
>
> Enable TypeScript strict mode in the application and Node configs. Add `typecheck`, `test`, and `test:watch` scripts. Integrate the Tailwind Vite plugin, add a separate Vitest configuration using jsdom, add explicit test cleanup/matcher setup, and add one minimal environment test proving the test harness works. Document the approved routing, styling, and testing decisions in one concise document under `docs/technical/`.
>
> Do not implement routes, layouts, pages, design tokens, participant import, persistence, draw logic, eligibility, BroadcastChannel, history, redraw, export, or animation. Do not replace the starter UI in this slice.
>
> Run `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test`, and `npm.cmd run build`. Report changed files, dependency changes, results, assumptions, and remaining risks. Review the Git diff for unrelated changes.

