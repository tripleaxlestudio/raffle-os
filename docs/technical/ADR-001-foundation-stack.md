# ADR-001: Foundation Stack

## Status

Accepted.

## Context

Raffle OS needs a small application-foundation stack before routes, product
interfaces, or domain behavior are implemented. The stack must support separate
Operator and Audience interfaces, a styling approach that can keep their themes
independent, and browser-oriented component tests while preserving the
local-first architecture.

The repository began this slice as the default React and Vite starter. It had no
routing dependency, Tailwind integration, test runner, or explicit TypeScript
strict mode.

## Decision

### Routing

Use React Router through the `react-router` package. It provides route matching,
nested layouts, redirects, error handling, and memory-based testing without
requiring Raffle OS to maintain a custom History API abstraction.

Route definitions and application routes are deferred to a later Phase 1 slice.

### Styling

Use Tailwind CSS through its official Vite plugin. Tailwind utilities will be
paired with CSS custom properties so semantic values and the Operator and
Audience themes can evolve independently without spreading fixed palette values
through components.

Tailwind is integrated as build tooling in this slice, but no Tailwind styles,
design tokens, or visual changes are applied yet.

### Testing

Use Vitest with React Testing Library and jsdom. Vitest aligns with the Vite and
TypeScript toolchain, React Testing Library supports behavior-focused component
tests, and jsdom supplies a lightweight DOM environment for automated tests.
Shared setup loads jest-dom matchers and performs React Testing Library cleanup
after each test.

Real-browser checks remain necessary for layout, fullscreen behavior, and
Chrome/Edge compatibility because jsdom does not implement a complete browser
rendering environment.

## Approved Dependencies

Production:

- `react-router`

Development:

- `tailwindcss`
- `@tailwindcss/vite`
- `vitest`
- `jsdom`
- `@testing-library/react`
- `@testing-library/dom`
- `@testing-library/user-event`
- `@testing-library/jest-dom`

## Key Tradeoffs

- React Router adds a production dependency and browser-history routing will
  require the eventual local host to serve the application entry point for deep
  links.
- Tailwind adds build-time tooling and utility classes; CSS custom-property
  discipline is required to prevent fragmented themes and arbitrary values.
- jsdom makes tests fast and local, but cannot replace manual browser and
  viewport verification.
- The selected test stack adds several development dependencies, accepted in
  exchange for DOM assertions, interaction helpers, and accessible
  behavior-oriented tests.

## Explicitly Deferred Capabilities

This decision does not implement application routes, Operator or Audience
layouts, placeholder pages, design tokens, participant import, IndexedDB or
other persistence, draw or eligibility logic, winner confirmation, redraw,
BroadcastChannel communication, history, export, production animation, or any
visual redesign of the Vite starter.
