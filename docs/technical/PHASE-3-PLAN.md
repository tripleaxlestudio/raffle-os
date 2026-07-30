# Phase 3 — Domain Model and Local Persistence Plan

## 1. Executive Summary

### Purpose of Phase 3
The purpose of Phase 3 is to establish explicit, production-grade domain models and a robust, typed local persistence infrastructure using IndexedDB for Raffle OS. Phase 3 creates the data foundation required for state transitions, entity relationships, and historical records without connecting real persistence to the presentation prototype UI or implementing participant file import, secure draw selection, eligibility calculation, or live workflow behaviors.

### Accepted Phase 2 Baseline
Phase 2 delivered a high-fidelity, deterministic static UI prototype accepted on 30 July 2026 (`c4ab9f88bdf69dca264ef5543aa695becffdaa89`). The codebase contains 22 test files with 182 passing tests covering Operator and Audience presentation layouts, semantic design tokens, reusable accessible UI primitives, query-driven mock scenarios, and exact winner grid layouts. Phase 2 relies strictly on frozen, immutable presentation mock fixtures under `src/prototype/data/` and view models in `src/prototype/operator-types.ts` and `src/prototype/audience-types.ts`. It contains no persistence, domain entity logic, or state mutation.

### Production Capabilities Added in Phase 3
Phase 3 will design and introduce:
- Strict TypeScript domain entity models for events, participants, prize categories, draw configurations, draw sessions, winner records, redraw records, audit entries, display states, and application preferences.
- Typed discriminated status unions and validated state transition rules for domain entities.
- An IndexedDB database schema (Version 1) with indexes optimized for event isolation and lookup by ticket string.
- Versioned schema migration infrastructure and stored-data backward-compatibility rules.
- Isolated repository interfaces and IndexedDB data-access implementations separated from React components.
- Normalized persistence error domain types.
- Development-only seed and safe database-reset utilities with explicit confirmation boundaries.
- Unit and integration tests for domain models, database operations, transaction integrity, and repositories.

### Product Capabilities Explicitly Deferred
Phase 3 will **not** implement:
- CSV or XLSX file reading, parsing, preview, or import mapping (deferred to Phase 4).
- Participant eligibility filtering or pool calculation logic (deferred to Phase 4 / Phase 5).
- Web Crypto random selection, Fisher–Yates shuffle, or winner selection algorithms (deferred to Phase 5).
- Official winner confirmation, redraw mutations, or live draw workflow state machines (deferred to Phase 6 / Phase 8).
- BroadcastChannel messaging or Operator/Audience display synchronization (deferred to Phase 7).
- CSV/XLSX export or audit trail generation for export files (deferred to Phase 9).
- Interrupted-session UI recovery workflows or backup/restore features (deferred to Phase 10).
- UI component integration with real local storage (deferred to Phase 6+).
- Audio, fullscreen browser control, backend services, cloud databases, authentication, or payment functionality.

### Rationale for Architectural Order
Establishing domain models and persistence before import, draw execution, and live workflows is critical to project integrity:
1. **Prevents Prototype-to-Production Bleed**: Defining strict production entities prevents presentation view models (which use dummy fields like `fileSize` or `strategyLabel`) from accidentally becoming database models.
2. **Enforces Product Invariants at the Schema Layer**: Ticket identifiers must be preserved as strings with leading zeroes from the moment data structures are defined.
3. **Establishes Audit and History Relationships**: Redraw, cancellation, and replacement linkages depend on immutable primary keys and entity relationships that must be designed before winner confirmation logic is written.
4. **Enables Deterministic Unit Testing**: Repositories can be fully tested in isolation without React rendering or live UI state interference.

---

## 2. Repository Readiness Audit

### Verified Current Facts
- **Git Branch**: `main`
- **Git Upstream**: `origin/main`
- **Working-Tree Status**: Clean (verified via `git status --short`).
- **Target OS**: Windows (Powershell environment).
- **Installed Production Dependencies** (`package.json`):
  - `react`: `^19.2.7`
  - `react-dom`: `^19.2.7`
  - `react-router`: `^7.18.2`
- **Installed Development Dependencies** (`package.json`):
  - `@eslint/js`: `^10.0.1`, `eslint`: `^10.6.0`, `eslint-plugin-react-hooks`: `^7.1.1`, `eslint-plugin-react-refresh`: `^0.5.3`
  - `@tailwindcss/vite`: `^4.3.3`, `tailwindcss`: `^4.3.3`
  - `@testing-library/dom`: `^10.4.1`, `@testing-library/jest-dom`: `^7.0.0`, `@testing-library/react`: `^16.3.2`, `@testing-library/user-event`: `^14.6.1`
  - `@types/node`: `^24.13.2`, `@types/react`: `^19.2.17`, `@types/react-dom`: `^19.2.3`
  - `@vitejs/plugin-react`: `^6.0.3`, `vite`: `^8.1.1`
  - `globals`: `^17.7.0`, `jsdom`: `^29.1.1`, `typescript`: `~6.0.2`, `typescript-eslint`: `^8.62.0`, `vitest`: `^4.1.10`
- **Confirmed npm Scripts**:
  - `npm run dev` — starts Vite dev server.
  - `npm run build` — runs `tsc -b && vite build`.
  - `npm run lint` — runs ESLint across the workspace.
  - `npm run preview` — previews production build.
  - `npm run typecheck` — runs TypeScript compiler in no-emit mode.
  - `npm run test` — runs Vitest suite once.
  - `npm run test:watch` — runs Vitest in watch mode.
- **Test Baseline**: 22 test files, 182 tests passing cleanly.
- **Source Structure**:
  - `src/app/` (shell, layouts, routing, error boundary, happy path integration test)
  - `src/domain/types/` (currently contains only `AppMode` and `DisplayConnectionStatus`)
  - `src/pages/` (operator pages and audience page)
  - `src/prototype/` (mock fixtures, query parsers, scenario definitions, presentation types)
  - `src/shared/` (ui primitives, shared compositions)
  - `src/styles/` (CSS tokens, app, audience, operator, primitives styles)
  - `src/test/` (vitest setup and environment tests)
  - `src/ui/` (audience and operator UI compositions)
- **Accepted Documentation Records**:
  - `docs/technical/PHASE-1-ACCEPTANCE.md` (accepted 30 July 2026)
  - `docs/technical/PHASE-2-PLAN.md` (accepted 30 July 2026)
  - `docs/technical/PHASE-2-ACCEPTANCE.md` (accepted 30 July 2026)
  - `docs/technical/ADR-001-foundation-stack.md` (accepted foundation stack)
- **Existing View Models & Fixtures**: Presentation view types (`PrototypeParticipantRow`, `PrototypeWinnerRecord`, `PrototypePendingResultsFixture`, etc.) exist under `src/prototype/` for static screen display only.
- **Production Domain Entities**: Do **not** exist yet (only placeholder app mode and connection status types under `src/domain/types/`).
- **IndexedDB / Persistence Libraries**: **None** installed or present in `package.json`. No IndexedDB code exists in `src/`.
- **`localStorage` / `sessionStorage`**: Not used anywhere in the codebase.
- **Migrations / Repositories / Data Access Modules**: **None** exist.

### Verification Results
All five safe verification commands were executed and passed cleanly:
1. `npm.cmd run lint`: Exit code 0 (no ESLint diagnostics).
2. `npm.cmd run typecheck`: Exit code 0 (`tsc -b` passed).
3. `npm.cmd run test`: Exit code 0 (22 test files passed, 182 tests passed).
4. `npm.cmd run build`: Exit code 0 (`tsc -b && vite build` succeeded, 96 modules transformed).
5. `git diff --check`: Exit code 0 (no whitespace issues).

### Conflict Audit
No conflicts exist between PRD v0.1, AGENTS.md, TASKS.md, Phase 2 acceptance records, and current code. All documents agree that Phase 2 is presentation-only and Phase 3 establishes domain models and local persistence without implementing participant file import, eligibility filtering, draw execution, or live UI coupling.

---

## 3. Phase 3 Scope

### Foundations Planned for Phase 3
Phase 3 will plan and establish the following architectural foundations:
- **Explicit Domain Entity Models**: TypeScript types and interfaces representing domain concepts.
- **Entity Identifiers**: Standardized UUID generator and composite identifier patterns.
- **Status Discriminated Unions**: Explicit states for events, draw sessions, winners, and participants.
- **Domain Invariants**: Programmatic rules enforcing string ticket numbers, leading-zero retention, immutability of official history, and mode isolation.
- **IndexedDB Persistence & Schema**: Object store definitions, primary keys, and indices.
- **Schema Versioning & Migration Infrastructure**: Upgrade transaction handlers and version tracking.
- **Repository Pattern & Interfaces**: Data-access boundaries separating domain storage from presentation.
- **Transaction Boundaries**: Multi-store atomic transaction helpers for draw execution and redraw tracking.
- **Development Seed Data**: Fictional, valid domain entity records for local development.
- **Database Reset Safeguards**: Protected utility functions requiring explicit multi-step confirmation flags before wiping local IndexedDB stores.
- **Persistence Automated Tests**: Isolated Vitest test suite testing database creation, migrations, CRUD operations, transaction rollbacks, index queries, and ticket string integrity using an in-memory IndexedDB test provider.
- **Data Compatibility Rules**: Version validation ensuring old or unsupported database schemas fail safely without corrupting data.

### Capabilities Explicitly Excluded from Phase 3
Phase 3 will **not** implement:
- CSV or XLSX file selection, drag-and-drop, parsing, or column mapping.
- Real file import pipeline or preview modal validation against files.
- Eligible participant pool calculation, filter matching logic, or check-in evaluation algorithms.
- Web Crypto `getRandomValues()` draw selection engine or Fisher–Yates shuffle implementation.
- Winner selection, countdown/rolling execution timers, or live winner generation.
- Operator confirmation UI actions, partial confirmation mutations, or redraw panel execution.
- BroadcastChannel messaging, display state broadcasting, or Operator-to-Audience sync.
- CSV/XLSX export functions or download triggers.
- Backup file creation, JSON backup export, or backup file import/restore.
- Interrupted-session recovery workflow UI hooks.
- Audio file loading, audio playback cues, or Web Audio API integration.
- Fullscreen browser API triggers or window management.
- Any backend API, cloud sync, authentication, user accounts, or payment processing.

---

## 4. Domain Model Proposal

Phase 3 proposes explicit production domain models under `src/domain/`. Every entity is strictly typed, avoiding `any` or loose record types.

### 4.1 Entity Models

#### 1. `Event`
- **Purpose**: Represents the top-level context for a raffle event.
- **Required Fields**:
  - `id`: `EventId` (string UUID)
  - `name`: `string` (non-empty)
  - `status`: `EventStatus` ('draft' | 'ready' | 'live' | 'completed' | 'archived')
  - `createdAt`: `string` (ISO 8601 UTC)
  - `updatedAt`: `string` (ISO 8601 UTC)
- **Optional Fields**:
  - `description`: `string`
  - `scheduledAt`: `string` (ISO 8601 UTC)
- **Identifier Type**: `EventId` (branded string UUID)
- **Status Fields**: `status`
- **Relationships**: Parent entity for `Participant`, `PrizeCategory`, `DrawSession`, `AuditRecord`.
- **Invariants**: `name` must be trimmed and non-empty. Deleting an event with confirmed `DrawSession` records is prohibited.

#### 2. `Participant`
- **Purpose**: Represents an individual participant entry eligible for drawing within an event.
- **Required Fields**:
  - `id`: `ParticipantId` (string UUID)
  - `eventId`: `EventId` (string UUID)
  - `ticketNumber`: `string` (ticket identifier, **must remain string at all times**)
  - `createdAt`: `string` (ISO 8601 UTC)
  - `updatedAt`: `string` (ISO 8601 UTC)
- **Optional Fields**:
  - `name`: `string` (participant name)
  - `group`: `string` (department, company, or table)
  - `isCheckedIn`: `boolean` (check-in status, default `false`)
  - `notes`: `string`
- **Identifier Type**: `ParticipantId` (branded string UUID)
- **Status Fields**: `isCheckedIn`
- **Relationships**: Belongs to `Event`. Referenced by `WinnerRecord`.
- **Invariants**: `ticketNumber` **MUST ALWAYS BE A STRING**. Leading zeroes must be preserved (e.g. `"00042"`). `ticketNumber` must never be parsed or converted to `number`.

#### 3. `PrizeCategory`
- **Purpose**: Defines a category or tier of prizes within an event (e.g., "Grand Prize", "Door Prize").
- **Required Fields**:
  - `id`: `PrizeCategoryId` (string UUID)
  - `eventId`: `EventId` (string UUID)
  - `name`: `string` (category name)
  - `prizeName`: `string` (name of the specific item/prize)
  - `displayOrder`: `number` (sorting priority)
  - `createdAt`: `string` (ISO 8601 UTC)
- **Optional Fields**:
  - `description`: `string`
  - `sponsorName`: `string`
- **Identifier Type**: `PrizeCategoryId` (branded string UUID)
- **Relationships**: Belongs to `Event`. Referenced by `DrawConfiguration`.

#### 4. `DrawConfiguration`
- **Purpose**: Captures the operational rules and parameters for a specific draw session.
- **Required Fields**:
  - `id`: `DrawConfigurationId` (string UUID)
  - `eventId`: `EventId` (string UUID)
  - `prizeCategoryId`: `PrizeCategoryId` (string UUID)
  - `requestedWinners`: `number` (integer between 1 and 100)
  - `winningRule`: `WinningRule` ('one-per-event' | 'one-per-category' | 'allow-repeats')
  - `requireCheckIn`: `boolean`
  - `createdAt`: `string` (ISO 8601 UTC)
- **Optional Fields**:
  - `eligibleGroupFilter`: `string` (optional group constraint)
- **Identifier Type**: `DrawConfigurationId` (branded string UUID)
- **Invariants**: `requestedWinners` must satisfy `1 <= requestedWinners <= 100`.

#### 5. `DrawSession`
- **Purpose**: Represents a distinct draw execution instance (either Practice or Live).
- **Required Fields**:
  - `id`: `DrawSessionId` (string UUID)
  - `eventId`: `EventId` (string UUID)
  - `configurationId`: `DrawConfigurationId` (string UUID)
  - `mode`: `AppMode` ('practice' | 'live')
  - `status`: `DrawSessionStatus` ('draft' | 'ready' | 'drawing' | 'pending-confirmation' | 'confirmed' | 'cancelled' | 'partially-replaced' | 'completed')
  - `eligibleSnapshotCount`: `number` (count of eligible participants when draw started)
  - `createdAt`: `string` (ISO 8601 UTC)
  - `updatedAt`: `string` (ISO 8601 UTC)
- **Optional Fields**:
  - `completedAt`: `string` (ISO 8601 UTC)
- **Identifier Type**: `DrawSessionId` (branded string UUID)
- **Relationships**: Belongs to `Event`. References `DrawConfiguration`. Contains multiple `WinnerRecord` instances.
- **Invariants**: Live draw sessions must create an auditable, immutable snapshot record upon execution. Practice sessions must be flagged as `mode: 'practice'` and cannot alter live eligibility.

#### 6. `WinnerRecord`
- **Purpose**: Represents a selected winning ticket slot within a draw session.
- **Required Fields**:
  - `id`: `WinnerRecordId` (string UUID)
  - `drawSessionId`: `DrawSessionId` (string UUID)
  - `participantId`: `ParticipantId` (string UUID)
  - `ticketNumber`: `string` (preserved string ticket number)
  - `sequenceNumber`: `number` (1-indexed draw order)
  - `status`: `WinnerStatus` ('pending' | 'confirmed' | 'cancelled' | 'replaced')
  - `createdAt`: `string` (ISO 8601 UTC)
  - `updatedAt`: `string` (ISO 8601 UTC)
- **Optional Fields**:
  - `participantName`: `string` (denormalized for display audit)
  - `confirmedAt`: `string` (ISO 8601 UTC)
  - `cancelledAt`: `string` (ISO 8601 UTC)
- **Identifier Type**: `WinnerRecordId` (branded string UUID)
- **Relationships**: Belongs to `DrawSession`. References `Participant`. Target of `RedrawRecord`.
- **Invariants**: `ticketNumber` must be a string with intact leading zeroes. Confirmed live winners alter eligibility for subsequent draws when `winningRule` is `'one-per-event'`.

#### 7. `RedrawRecord`
- **Purpose**: Records an audit trail entry when a winner is cancelled and replaced during Live mode.
- **Required Fields**:
  - `id`: `RedrawRecordId` (string UUID)
  - `drawSessionId`: `DrawSessionId` (string UUID)
  - `originalWinnerRecordId`: `WinnerRecordId` (string UUID)
  - `replacementWinnerRecordId`: `WinnerRecordId` (string UUID)
  - `reason`: `RedrawReason` ('absent' | 'invalid-ticket' | 'ineligible' | 'previous-winner' | 'operator-error' | 'other')
  - `createdAt`: `string` (ISO 8601 UTC)
- **Optional Fields**:
  - `reasonNote`: `string` (required if `reason === 'other'`)
- **Identifier Type**: `RedrawRecordId` (branded string UUID)
- **Relationships**: Belongs to `DrawSession`. Links `originalWinnerRecordId` to `replacementWinnerRecordId`.
- **Invariants**: In Live mode, `reason` is strictly required. If `reason` is `'other'`, `reasonNote` must be a non-empty string. Both original and replacement records must remain visible in audit history.

#### 8. `AuditRecord`
- **Purpose**: Append-only log tracking major operational actions within an event.
- **Required Fields**:
  - `id`: `AuditRecordId` (string UUID)
  - `eventId`: `EventId` (string UUID)
  - `action`: `AuditAction` ('event-created' | 'participants-imported' | 'draw-started' | 'winner-confirmed' | 'winner-cancelled' | 'redraw-executed' | 'database-reset')
  - `actor`: `string` (e.g. `'operator'`)
  - `detail`: `string` (human-readable summary)
  - `timestamp`: `string` (ISO 8601 UTC)
- **Identifier Type**: `AuditRecordId` (branded string UUID)
- **Invariants**: Audit records are append-only. They cannot be updated or deleted through standard repository calls.

#### 9. `DisplayConfiguration`
- **Purpose**: Presentation settings for the Audience Display.
- **Required Fields**:
  - `id`: `DisplayConfigurationId` (string UUID)
  - `eventId`: `EventId` (string UUID)
  - `targetResolution`: `string` (e.g., `'1920x1080'`)
  - `safeAreaMargin`: `number` (pixels)
  - `blackoutAppearance`: `'pure-black' | 'branded'`
  - `updatedAt`: `string` (ISO 8601 UTC)
- **Identifier Type**: `DisplayConfigurationId` (branded string UUID)

#### 10. `ApplicationPreference`
- **Purpose**: Lightweight key-value application settings stored independently from event domain data.
- **Required Fields**:
  - `key`: `string` (e.g., `'active_event_id'`, `'theme_mode'`)
  - `value`: `unknown` (JSON-serializable value)
  - `updatedAt`: `string` (ISO 8601 UTC)

---

### 4.2 Important Domain Invariants
1. **String Ticket Identifiers**: Ticket numbers must be strings (`type TicketNumber = string`). Leading zeroes must be preserved throughout storage, indexing, querying, and presentation (e.g., `"00123"`). Ticket numbers must **NEVER** be converted to `number` or passed through `parseInt()`.
2. **Prototype Isolation**: Prototype fixtures in `src/prototype/data/` must **NEVER** be inserted into the production IndexedDB instance or imported by domain entities.
3. **Official Record Immutability**: Confirmed live winner records and audit logs must never be overwritten or deleted during normal application workflows.
4. **Redraw Traceability**: Redraw operations must set the original winner status to `'replaced'` or `'cancelled'` and preserve explicit links to the replacement winner in a `RedrawRecord`.
5. **Practice / Live Separation**: Practice draws must be explicitly tagged (`mode: 'practice'`) and stored separately or filtered out from official eligibility calculations.
6. **Timestamp Standard**: All timestamps must be saved in machine-readable ISO 8601 UTC format (`YYYY-MM-DDTHH:mm:ss.sssZ`). Human-readable display text must be calculated at render time using local browser formatting helpers.

---

### 4.3 Identifier Strategy Recommendation

We compare three primary ID generation strategies:

| Strategy | Pros | Cons | Recommendation |
|---|---|---|---|
| **`crypto.randomUUID()`** | Standard browser native API, zero dependencies, collision-resistant 128-bit UUID v4, supported in all modern Chrome/Edge browsers. | Opaque random string (36 chars). | **RECOMMENDED** for primary entity IDs (`EventId`, `ParticipantId`, `DrawSessionId`, etc.). |
| **Composite IDs** (e.g., `event1:ticket001`) | Human-readable, self-describing, natural uniqueness scope. | Coupling entity identity to mutable properties; refactoring keys requires complex index updates. | **RECOMMENDED** only for compound index keys (e.g. `[eventId+ticketNumber]`). |
| **IndexedDB Auto-Increment Keys** | Sequential numbers (`1, 2, 3...`), simple integer storage. | Auto-increment IDs leak sequence order, complicate multi-database sync, and vary by insertion order. | **REJECTED** for entity primary keys. |

> **CRITICAL RULE**: `Math.random()` **MUST NEVER BE USED** to generate entity identifiers or random values.

---

## 5. State and Status Model

### 5.1 Discriminated Unions

```typescript
export type EventStatus =
  | 'draft'
  | 'ready'
  | 'live'
  | 'completed'
  | 'archived'

export type DrawSessionStatus =
  | 'draft'
  | 'ready'
  | 'drawing'
  | 'pending-confirmation'
  | 'confirmed'
  | 'cancelled'
  | 'partially-replaced'
  | 'completed'

export type WinnerStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'replaced'

export type ParticipantValidationStatus =
  | 'valid'
  | 'invalid'

export type ParticipantImportStrategy =
  | 'replace'
  | 'merge'
```

### 5.2 Permitted State Transitions

```
[EventStatus]
  draft ─────────► ready ─────────► live ─────────► completed ─────────► archived
    │               │               │
    └───────────────┴───────────────┴─────────────► archived (direct archive)

[DrawSessionStatus]
  draft ─────────► ready ─────────► drawing ─────────► pending-confirmation ─────────► confirmed
                                                             │                          │
                                                             ├─► partially-replaced ────┼─► completed
                                                             │                          │
                                                             └─► cancelled ─────────────┘

[WinnerStatus]
  pending ─────────► confirmed
     │
     └─────────────► cancelled ─────────► replaced
```

### 5.3 State Enforcement Responsibilities

| State Transition | Phase 3 Responsibility | Deferred Phase Responsibility |
|---|---|---|
| `EventStatus` transitions | Store status unions in IndexedDB; provide type safety. | UI workflow triggers for archiving and starting events (Phase 6). |
| `DrawSessionStatus` transitions | Persist draw session records and status changes atomically. | Draw execution state machine, timers, hold-to-start (Phase 5/6). |
| `WinnerStatus` transitions | Model `WinnerRecord` status updates and `RedrawRecord` relationships. | Operator confirmation/redraw UI workflows (Phase 8). |
| `ParticipantValidationStatus` | Model `status` field on `Participant`. | CSV/XLSX file validation pipeline (Phase 4). |

---

## 6. Prototype-to-Domain Boundary

### Architectural Boundary Rules
1. **Strict Type Separation**: Prototype presentation types (`src/prototype/operator-types.ts`, `src/prototype/audience-types.ts`) will coexist with production domain types (`src/domain/`). Prototype types will **NOT** be imported into production persistence modules.
2. **No Automatic Fixture Replacement**: Existing mock scenario queries (`/draw/setup?mode=live&scenario=insufficient`) will continue to read frozen presentation fixtures from `src/prototype/data/`. Production persistence will not replace prototype fixtures until an explicitly approved UI integration slice in a later phase.
3. **Explicit Mapper Layer**: When UI components eventually transition to production persistence, explicit mapper functions (e.g., `mapDomainWinnerToPresentationViewModel()`) will transform domain entities into UI presentation models.
4. **Deterministic Prototype Tests**: All 182 existing Phase 2 tests rely on deterministic query scenarios and frozen mock fixtures. Phase 3 must guarantee that no production persistence code breaks these tests.

### Proposed Directory Layout (Domain & Infrastructure)

```text
src/
├── domain/                         # Phase 3 Production Domain Models
│   ├── events/
│   │   ├── event.types.ts
│   │   └── event.invariants.ts
│   ├── participants/
│   │   ├── participant.types.ts
│   │   └── participant.invariants.ts
│   ├── prizes/
│   │   └── prize.types.ts
│   ├── draws/
│   │   ├── draw-session.types.ts
│   │   └── draw-configuration.types.ts
│   ├── winners/
│   │   ├── winner.types.ts
│   │   └── redraw.types.ts
│   ├── audit/
│   │   └── audit.types.ts
│   └── shared/
│       ├── identifiers.ts
│       ├── timestamps.ts
│       └── result.ts
├── infrastructure/                 # Phase 3 Infrastructure Layer
│   └── persistence/
│       ├── db.ts                   # Dexie database class / schema definition
│       ├── schema/
│       │   ├── schema-v1.ts
│       │   └── migrations.ts
│       ├── repositories/
│       │   ├── event.repository.ts
│       │   ├── participant.repository.ts
│       │   ├── prize.repository.ts
│       │   ├── draw-session.repository.ts
│       │   ├── winner.repository.ts
│       │   ├── audit.repository.ts
│       │   └── preference.repository.ts
│       └── errors/
│           └── persistence-errors.ts
└── application/                    # Application Abstractions (Repositories contracts)
    └── repositories/
        ├── event-repository.interface.ts
        ├── participant-repository.interface.ts
        ├── prize-repository.interface.ts
        ├── draw-session-repository.interface.ts
        ├── winner-repository.interface.ts
        ├── audit-repository.interface.ts
        └── preference-repository.interface.ts
```

> **Note**: Do not create these directories during this planning task. They will be created during Phase 3 implementation slices.

---

## 7. IndexedDB Technology Decision

### 7.1 Comparison of Options

We compare three options for local persistence:

| Criteria | 1. Native IndexedDB API | 2. Dexie.js (`dexie`) | 3. `idb` (Jake Archibald) |
|---|---|---|---|
| **TypeScript Support** | Low (requires manual casting and EventListener handling) | **Excellent** (first-class typed tables, queries, and compound indexes) | Good (lightweight Promise wrappers over native types) |
| **Schema Versioning** | Complex `onupgradeneeded` event handling, error-prone | **Built-in fluent versioning** (`db.version(1).stores({...})`) | Manual version check inside `openDB` upgrade callbacks |
| **Migration Support** | Manual cursor-based transformations | **Built-in `.upgrade()` handlers** with typed table context | Manual transformation inside upgrade callback |
| **Transaction Handling** | Verbose `db.transaction(['a', 'b'], 'readwrite')` | **Clean transaction syntax** `db.transaction('rw', db.tableA, ...)` | Promise-based native transactions |
| **Testability** | Difficult to mock natively in jsdom without third-party DOM mocks | **Seamless** with `fake-indexeddb` in Vitest | Requires `fake-indexeddb` |
| **Bundle Impact** | 0 KB (browser native) | ~25 KB (minified + gzipped) | ~2 KB (minified + gzipped) |
| **Maintenance Risk** | Low (W3C standard API) | Low (widely adopted, active maintenance since 2014) | Low (maintained by Chrome team member) |
| **Learning Curve** | High (verbose event-driven API) | Low (Clean async/await fluent API) | Medium (Promise wrapper over raw IDB) |

### 7.2 Recommendation: Dexie.js (`dexie`)

We recommend **Dexie.js (`dexie`)** as the persistence framework for Raffle OS.

#### Tradeoffs & Approval Requirements:
- **Current Status**: `dexie` is **NOT** currently installed in `package.json`.
- **Proposed Production Dependency**: `dexie` (`^4.0.10`).
- **Why Preferred over Native IndexedDB**:
  1. Native IndexedDB code requires hundreds of lines of boilerplate for transactions, index cursors, and upgrade events, increasing maintenance risk.
  2. Dexie provides compile-time TypeScript checks for store entities and compound indexes.
  3. Dexie makes atomic multi-store transactions (e.g. creating a `DrawSession`, `WinnerRecord`, and `AuditRecord` together) concise and reliable.
- **Disadvantages**: Adds a ~25 KB production bundle dependency.
- **Approval Gate**: Explicit approval is required before installing `dexie`.

### 7.3 Test Environment Dependency: `fake-indexeddb`

For automated testing in Vitest / jsdom without requiring a real browser process:
- **Proposed Development Dependency**: `fake-indexeddb` (`^6.0.0`).
- **Purpose**: Provides an in-memory, fully compliant IndexedDB engine that executes inside Vitest/jsdom tests.
- **Alternatives**: Running tests in real browsers via Playwright/Puppeteer (much slower, complex test setup).
- **Approval Gate**: Explicit approval is required before installing `fake-indexeddb`.

---

## 8. Database Schema Proposal

### Database Name: `RaffleOS_DB` (Version 1)

```typescript
// Proposed Dexie Schema Definition
export interface RaffleOSSchema {
  events: 'id, name, status, createdAt'
  participants: 'id, eventId, ticketNumber, [eventId+ticketNumber], isCheckedIn, group'
  prize_categories: 'id, eventId, displayOrder'
  draw_configurations: 'id, eventId, prizeCategoryId'
  draw_sessions: 'id, eventId, mode, status, createdAt'
  winner_records: 'id, drawSessionId, participantId, ticketNumber, status, sequenceNumber'
  redraw_records: 'id, drawSessionId, originalWinnerRecordId, replacementWinnerRecordId'
  audit_records: 'id, eventId, action, timestamp'
  preferences: 'key'
}
```

### Table Details

| Store Name | Primary Key | Indexes | Unique Constraints | Deletion Behavior | Primary Query Patterns |
|---|---|---|---|---|---|
| `events` | `id` | `name`, `status`, `createdAt` | `id` | Prohibited if confirmed draws exist. | Get all events; get active event by status. |
| `participants` | `id` | `eventId`, `ticketNumber`, `[eventId+ticketNumber]`, `isCheckedIn`, `group` | `id`, `[eventId+ticketNumber]` | Cascade delete with Event in draft mode. | Query by `eventId`; query single ticket via compound key `[eventId+ticketNumber]`. |
| `prize_categories` | `id` | `eventId`, `displayOrder` | `id` | Prohibited if referenced by active configuration. | List categories for event sorted by `displayOrder`. |
| `draw_configurations` | `id` | `eventId`, `prizeCategoryId` | `id` | Allowed in draft mode. | Get configuration for draw setup. |
| `draw_sessions` | `id` | `eventId`, `mode`, `status`, `createdAt` | `id` | Prohibited if status is `'confirmed'`. | Fetch latest live/practice draw session by `eventId`. |
| `winner_records` | `id` | `drawSessionId`, `participantId`, `ticketNumber`, `status`, `sequenceNumber` | `id` | Immutably preserved for audit. | List winners for a `drawSessionId`; check if `participantId` is already a confirmed winner. |
| `redraw_records` | `id` | `drawSessionId`, `originalWinnerRecordId`, `replacementWinnerRecordId` | `id` | Immutably preserved for audit. | Fetch replacement lineage for a cancelled winner. |
| `audit_records` | `id` | `eventId`, `action`, `timestamp` | `id` | Append-only; deletion prohibited. | Query chronological audit timeline for event. |
| `preferences` | `key` | None | `key` | Key-value overwrites allowed. | Get/set app settings (e.g. `active_event_id`). |

---

## 9. Schema Versioning and Migration Strategy

### Database Initialization & Version 1
- **Database Name**: `RaffleOS_DB`
- **Initial Version**: `1`
- **Version Control File**: `src/infrastructure/persistence/schema/schema-v1.ts`

### Schema Evolution Rules
Every schema change after Version 1 must follow strict discipline:
1. **Migration Code**: Increment database version number (e.g. `.version(2)`) and write an explicit `.upgrade(tx => { ... })` function in `src/infrastructure/persistence/schema/migrations.ts`.
2. **Migration Tests**: Write a dedicated Vitest suite testing the schema upgrade using pre-seeded Version N data transformed into Version N+1 structures.
3. **No Destructive Drops**: Existing object stores or columns must not be dropped without data transformation or explicit deprecation paths.
4. **Unsupported Version Failure**: If an open database request encounters a database version higher than the current code supports, open fails with a typed `UnsupportedSchemaVersionError` without mutating local data.
5. **No Deployment Rollbacks**: IndexedDB cannot automatically "rollback" schema migrations once committed to a user's browser storage. All migrations must be forward-only and strictly tested.

---

## 10. Repository and Data-Access Architecture

### Architecture Pattern: Repositories with IndexedDB Implementation
We separate domain storage interfaces from IndexedDB specifics using the Repository Pattern.

```
React UI / Hooks (Phase 6+) ──► Application Service ──► Repository Interface ──► Dexie IndexedDB Implementation
```

### Proposed Repository Interfaces

```typescript
export interface EventRepository {
  findById(id: EventId): Promise<Event | null>
  findAll(): Promise<Event[]>
  save(event: Event): Promise<void>
  delete(id: EventId): Promise<void>
}

export interface ParticipantRepository {
  findById(id: ParticipantId): Promise<Participant | null>
  findByTicketNumber(eventId: EventId, ticketNumber: string): Promise<Participant | null>
  findByEventId(eventId: EventId, options?: { limit?: number; offset?: number }): Promise<Participant[]>
  save(participant: Participant): Promise<void>
  saveBatch(participants: Participant[]): Promise<void>
  countByEventId(eventId: EventId): Promise<number>
  deleteAllByEventId(eventId: EventId): Promise<void>
}

export interface PrizeRepository {
  findCategoriesByEventId(eventId: EventId): Promise<PrizeCategory[]>
  saveCategory(category: PrizeCategory): Promise<void>
}

export interface DrawSessionRepository {
  findById(id: DrawSessionId): Promise<DrawSession | null>
  findLatestByEventId(eventId: EventId, mode?: AppMode): Promise<DrawSession | null>
  save(session: DrawSession): Promise<void>
}

export interface WinnerRepository {
  findByDrawSessionId(drawSessionId: DrawSessionId): Promise<WinnerRecord[]>
  findConfirmedByEventId(eventId: EventId): Promise<WinnerRecord[]>
  save(winner: WinnerRecord): Promise<void>
  saveBatch(winners: WinnerRecord[]): Promise<void>
}

export interface AuditRepository {
  findByEventId(eventId: EventId): Promise<AuditRecord[]>
  append(audit: AuditRecord): Promise<void>
}

export interface PreferenceRepository {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
}
```

### Transaction Boundaries & Error Normalization
- **Multi-Store Transactions**: Operations involving multiple stores (e.g. saving a `DrawSession` and its `WinnerRecord` entries) must run inside a single Dexie write transaction (`db.transaction('rw', [db.draw_sessions, db.winner_records, db.audit_records], async () => { ... })`).
- **Error Normalization**: All native IndexedDB / Dexie exceptions must be caught inside repositories and re-thrown as typed domain errors (`PersistenceError`).

---

## 11. Seed and Development Data Strategy

### Development Seed Rules
- Seed execution must be **explicitly triggered** (e.g., via a developer utility function or CLI helper). It must **NEVER** run automatically in production builds.
- Seed data must use fictional names, events, and ticket numbers.
- Ticket numbers must include string leading zeroes (e.g. `"000101"`, `"000102"`, `"000999"`).
- Seeding must check for existing data and refuse to overwrite local databases unless an explicit `overwrite: true` parameter is provided.
- Seed records must conform strictly to production domain entity schemas.
- Sample dataset size for development testing:
  - **Standard Dev Seed**: 1 Event, 2 Prize Categories, 500 Participants (including leading-zero tickets and check-in statuses).
  - **Performance Dev Seed**: 1 Event, 10,000 Participants (for testing index query performance).

---

## 12. Data Integrity and Safety

### Safeguard Matrix

| Potential Risk | Enforcement Mechanism | Failure Handling |
|---|---|---|
| **Duplicate Ticket in Event** | Compound index `[eventId+ticketNumber]` in `participants` store. | Repository throws `DuplicateRecordError`; write is aborted. |
| **Numeric Ticket Coercion** | TypeScript strict string types (`type TicketNumber = string`) + repository string checks. | Runtime error if non-string passed. |
| **Malformed Stored Record** | Schema validation helpers on read/write in repository layer. | Throws `ValidationError`; prevents corrupted data from entering domain. |
| **Partial Transaction Failure** | Atomic multi-store Dexie transactions. | Transaction auto-rolls back all writes cleanly. |
| **Storage Quota Exceeded** | Catch `QuotaExceededError` in repository error normalizer. | Throws `StorageQuotaError` with user-facing recovery guidance. |
| **Browser Private Mode** | Storage availability diagnostic check on DB initialization. | Throws `DatabaseUnavailableError`; warns operator before session starts. |
| **Accidental Reset / Delete** | Multi-step confirmation flag required in reset utility functions. | Hard-reset blocked unless explicit confirmation token provided. |
| **Cross-Event Data Leakage** | All primary queries filtered strictly by `eventId`. | Isolated dataset returned per event. |

---

## 13. Error Model

### Typed Domain Persistence Errors

All persistence errors inherit from a base `PersistenceError` class in `src/infrastructure/persistence/errors/persistence-errors.ts`:

```typescript
export abstract class PersistenceError extends Error {
  abstract readonly code: string
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class DatabaseUnavailableError extends PersistenceError {
  readonly code = 'DATABASE_UNAVAILABLE'
}

export class SchemaMigrationError extends PersistenceError {
  readonly code = 'SCHEMA_MIGRATION_FAILED'
}

export class RecordNotFoundError extends PersistenceError {
  readonly code = 'RECORD_NOT_FOUND'
}

export class DuplicateRecordError extends PersistenceError {
  readonly code = 'DUPLICATE_RECORD'
}

export class ValidationError extends PersistenceError {
  readonly code = 'VALIDATION_FAILED'
}

export class StorageQuotaError extends PersistenceError {
  readonly code = 'STORAGE_QUOTA_EXCEEDED'
}

export class TransactionError extends PersistenceError {
  readonly code = 'TRANSACTION_FAILED'
}

export class UnsupportedSchemaVersionError extends PersistenceError {
  readonly code = 'UNSUPPORTED_SCHEMA_VERSION'
}
```

### Error Handling Classification

| Error Type | Recoverable? | User-Facing Message | Action |
|---|---|---|---|
| `DatabaseUnavailableError` | No | "Local browser storage is unavailable or blocked by private browsing mode." | Block Live Mode startup. |
| `SchemaMigrationError` | No | "Database migration failed. Your stored data has been preserved." | Halt startup; log diagnostic details. |
| `RecordNotFoundError` | Yes | "The requested record could not be found." | Log warning; return fallback UI state. |
| `DuplicateRecordError` | Yes | "A participant with ticket number X already exists in this event." | Highlight input field for operator. |
| `StorageQuotaError` | Conditional | "Browser storage is full. Please free space on your device." | Warn operator; block new imports. |

---

## 14. Testing Strategy

### 14.1 Test Scope & Requirements
- **Domain Model Tests**: Verify string ticket retention, leading zero preservation, invariant enforcement, and state transition validation without any database or React component dependencies.
- **Database Tests**: Test Dexie database initialization, Version 1 schema creation, index lookups, transaction rollbacks, and record survival across database re-open cycles using `fake-indexeddb`.
- **Repository Tests**: Test typed returns, `[eventId+ticketNumber]` compound index lookups, error normalization, and batch operations.
- **Seed Tests**: Test that development seeding produces valid domain entities, preserves leading-zero ticket strings, and refuses silent overwrites.
- **Regression Tests**: Verify that all 22 Phase 2 test files and 182 tests continue to pass without any regression.

### 14.2 Isolated Test Database Approach
All persistence tests will run in Vitest using `fake-indexeddb` to ensure fast, isolated, in-memory execution without touching real browser profiles or requiring Playwright/Puppeteer.

---

## 15. Performance and Capacity Planning

### Targets & Capacity Constraints
- **Participant Dataset Scale**: Support at least **10,000 participants** per event.
- **Draw Session Scale**: Support multiple draw sessions per event with up to **100 winners** per draw.
- **Query Performance**: Index lookups for `[eventId+ticketNumber]` and `eventId` must complete in **< 10 ms** for a 10,000 participant store.
- **Bounded Memory Reads**: Repository methods must support pagination (`limit`/`offset`) or stream cursors to prevent loading all 10,000 participant objects into memory simultaneously when only a subset is requested.

---

## 16. Security and Privacy

### Security & Privacy Rules
1. **Local-First Isolation**: All participant and draw data remains stored strictly inside the local browser profile's IndexedDB instance. No network requests or cloud calls are made.
2. **Unencrypted Browser Storage**: IndexedDB storage is unencrypted by default in web browsers. Anyone with access to the physical device and browser user profile can inspect local IndexedDB records via DevTools.
3. **Audience Display Privacy Boundary**: The Audience Display interface must **NEVER** query or receive full `Participant` records (which may contain names, groups, check-in status, or notes). Audience messages must contain string ticket numbers and public prize labels only.
4. **Local Audit Limitations**: Local IndexedDB audit trails prevent operational mistakes, but do not constitute tamper-proof or legally certified audit logs against a device administrator.

---

## 17. Proposed Phase 3 Folder Structure

```text
src/
├── domain/                                 # [NEW in Phase 3] Production Domain Models
│   ├── events/
│   │   ├── event.types.ts
│   │   └── event.invariants.ts
│   ├── participants/
│   │   ├── participant.types.ts
│   │   └── participant.invariants.ts
│   ├── prizes/
│   │   └── prize.types.ts
│   ├── draws/
│   │   ├── draw-session.types.ts
│   │   └── draw-configuration.types.ts
│   ├── winners/
│   │   ├── winner.types.ts
│   │   └── redraw.types.ts
│   ├── audit/
│   │   └── audit.types.ts
│   └── shared/
│       ├── identifiers.ts
│       ├── timestamps.ts
│       └── result.ts
├── infrastructure/                         # [NEW in Phase 3] Infrastructure & Storage
│   └── persistence/
│       ├── db.ts                           # Dexie database definition
│       ├── schema/
│       │   ├── schema-v1.ts
│       │   └── migrations.ts
│       ├── repositories/
│       │   ├── event.repository.ts
│       │   ├── participant.repository.ts
│       │   ├── prize.repository.ts
│       │   ├── draw-session.repository.ts
│       │   ├── winner.repository.ts
│       │   ├── audit.repository.ts
│       │   └── preference.repository.ts
│       ├── seed/
│       │   └── dev-seed.ts                 # Explicit development seed helper
│       └── errors/
│           └── persistence-errors.ts
├── application/                            # [NEW in Phase 3] Abstract Interfaces
│   └── repositories/
│       ├── event-repository.interface.ts
│       ├── participant-repository.interface.ts
│       ├── prize-repository.interface.ts
│       ├── draw-session-repository.interface.ts
│       ├── winner-repository.interface.ts
│       ├── audit-repository.interface.ts
│       └── preference-repository.interface.ts
├── prototype/                              # [UNCHANGED] Prototype Fixtures & View Models
│   ├── data/
│   ├── operator-types.ts
│   └── audience-types.ts
└── pages/                                  # [UNCHANGED] Prototype Presentation Screens
```

---

## 18. Implementation Slices

Phase 3 is divided into seven (7) reviewable implementation slices:

### Slice 1: Domain Contracts and Invariants
- **Objective**: Create production TypeScript domain entity models, status discriminated unions, branded identifier utilities, timestamp helpers, and domain invariant validation functions.
- **Files Created/Modified**:
  - [NEW] `src/domain/shared/identifiers.ts`
  - [NEW] `src/domain/shared/timestamps.ts`
  - [NEW] `src/domain/events/event.types.ts`
  - [NEW] `src/domain/participants/participant.types.ts`
  - [NEW] `src/domain/prizes/prize.types.ts`
  - [NEW] `src/domain/draws/draw-session.types.ts`
  - [NEW] `src/domain/winners/winner.types.ts`
  - [NEW] `src/domain/audit/audit.types.ts`
  - [NEW] `src/domain/domain.test.ts`
- **Proposed Dependencies**: None.
- **Tests**: Unit tests for string ticket retention, leading zero preservation, state union validation, and invariant checks.
- **Verification Commands**: `npm run lint`, `npm run typecheck`, `npm run test`.
- **Explicit Non-Goals**: No database code or persistence dependencies installed in Slice 1.
- **Commit Boundary**: `feat(domain): define Phase 3 domain entity models and invariants`

### Slice 2: Persistence Dependencies and Database Schema Version 1
- **Objective**: Obtain explicit approval, install `dexie` and `fake-indexeddb`, define the Dexie database class `RaffleOSDatabase`, Version 1 schema, indices, and error domain classes.
- **Files Created/Modified**:
  - [MODIFY] `package.json` (add `dexie` to dependencies, `fake-indexeddb` to devDependencies)
  - [NEW] `src/infrastructure/persistence/errors/persistence-errors.ts`
  - [NEW] `src/infrastructure/persistence/schema/schema-v1.ts`
  - [NEW] `src/infrastructure/persistence/db.ts`
  - [NEW] `src/infrastructure/persistence/db.test.ts`
- **Proposed Dependencies**: `dexie` (`^4.0.10`), `fake-indexeddb` (`^6.0.0`).
- **Tests**: Test database creation, store indexing, compound key `[eventId+ticketNumber]`, error mapping, and database re-opening in `fake-indexeddb`.
- **Verification Commands**: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- **Commit Boundary**: `feat(persistence): establish Dexie schema v1 and test setup`

### Slice 3: Repository Interfaces and Event / Participant Repositories
- **Objective**: Create application repository interfaces and Implement `DexieEventRepository` and `DexieParticipantRepository`.
- **Files Created/Modified**:
  - [NEW] `src/application/repositories/event-repository.interface.ts`
  - [NEW] `src/application/repositories/participant-repository.interface.ts`
  - [NEW] `src/infrastructure/persistence/repositories/event.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/participant.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/repositories.test.ts`
- **Proposed Dependencies**: Uses installed `dexie`.
- **Tests**: Test Event CRUD, Participant batch insertions, string ticket lookups, and compound key uniqueness.
- **Verification Commands**: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- **Commit Boundary**: `feat(persistence): implement event and participant repositories`

### Slice 4: Draw Session, Winner, Redraw, and Audit Repositories
- **Objective**: Implement `DexieDrawSessionRepository`, `DexieWinnerRepository`, `DexieAuditRepository`, and `DexiePreferenceRepository` with atomic transaction boundaries.
- **Files Created/Modified**:
  - [NEW] `src/application/repositories/draw-session-repository.interface.ts`
  - [NEW] `src/application/repositories/winner-repository.interface.ts`
  - [NEW] `src/application/repositories/audit-repository.interface.ts`
  - [NEW] `src/application/repositories/preference-repository.interface.ts`
  - [NEW] `src/infrastructure/persistence/repositories/draw-session.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/winner.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/audit.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/preference.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/draw-persistence.test.ts`
- **Proposed Dependencies**: Uses installed `dexie`.
- **Tests**: Test atomic transactions, winner records, redraw relationships, and append-only audit entries.
- **Verification Commands**: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- **Commit Boundary**: `feat(persistence): implement draw, winner, audit, and preference repositories`

### Slice 5: Development Seed and Reset Utilities
- **Objective**: Create developer seed data utilities and explicit database reset helpers with confirmation guards.
- **Files Created/Modified**:
  - [NEW] `src/infrastructure/persistence/seed/dev-seed.ts`
  - [NEW] `src/infrastructure/persistence/seed/reset-db.ts`
  - [NEW] `src/infrastructure/persistence/seed/seed.test.ts`
- **Proposed Dependencies**: Uses installed `dexie`.
- **Tests**: Test that seed execution inserts valid domain models with string ticket numbers and refuses silent overwrites.
- **Verification Commands**: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- **Commit Boundary**: `feat(persistence): add development seed and safe reset utilities`

### Slice 6: Storage Diagnostics and Compatibility Boundary
- **Objective**: Create storage diagnostics (storage quota estimation, private browsing checks, database readiness checks) and schema migration error boundary helpers.
- **Files Created/Modified**:
  - [NEW] `src/infrastructure/persistence/diagnostics/storage-diagnostics.ts`
  - [NEW] `src/infrastructure/persistence/diagnostics/diagnostics.test.ts`
- **Proposed Dependencies**: Uses browser StorageManager API (`navigator.storage.estimate()`).
- **Tests**: Test storage quota checks, unavailable storage fallbacks, and diagnostic health reporting.
- **Verification Commands**: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- **Commit Boundary**: `feat(persistence): add storage diagnostics and health reporting`

### Slice 7: Phase 3 Acceptance Audit and Documentation Closeout
- **Objective**: Run full verification suite, verify Phase 1 and Phase 2 regression safety, complete `docs/technical/PHASE-3-ACCEPTANCE.md`, and update `TASKS.md`.
- **Files Created/Modified**:
  - [NEW] `docs/technical/PHASE-3-ACCEPTANCE.md`
  - [MODIFY] `TASKS.md` (update Phase 3 checkboxes)
- **Proposed Dependencies**: None.
- **Tests**: Full repository suite (`vitest run`).
- **Verification Commands**: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `git diff --check`.
- **Commit Boundary**: `docs: close Phase 3 acceptance`

---

## 19. Phase 3 Acceptance Checklist

- [ ] Production domain entity models exist for Event, Participant, PrizeCategory, DrawConfiguration, DrawSession, WinnerRecord, RedrawRecord, AuditRecord, DisplayConfiguration, and ApplicationPreference under `src/domain/`.
- [ ] Prototype presentation view types (`src/prototype/`) remain completely separate from production domain models.
- [ ] Ticket numbers are typed as strings (`type TicketNumber = string`) and maintained as strings in all domain entities and database indices.
- [ ] Leading zeroes are verified to survive database write and read cycles in repository tests.
- [ ] Only approved persistence dependencies (`dexie`, `fake-indexeddb`) are installed after explicit user approval.
- [ ] Schema Version 1 is defined with object stores for events, participants, prize categories, draw configurations, draw sessions, winner records, redraw records, audit records, and preferences.
- [ ] Migration infrastructure (`migrations.ts`) is established and tested.
- [ ] Required stores and indexes (including compound index `[eventId+ticketNumber]`) exist and are verified.
- [ ] Isolated repository interfaces (`src/application/repositories/`) and Dexie implementations (`src/infrastructure/persistence/repositories/`) exist.
- [ ] Persistence errors are normalized into typed `PersistenceError` domain classes.
- [ ] Repository tests verify that stored data survives database close and re-open cycles in `fake-indexeddb`.
- [ ] Event data remains strictly isolated by `eventId`.
- [ ] Development seed utilities produce valid domain records without silent overwrites of existing data.
- [ ] Database reset functions require explicit multi-step confirmation flags.
- [ ] **No CSV/XLSX file parsing** or import preview logic is implemented in Phase 3.
- [ ] **No Web Crypto random selection engine** or draw selection algorithm is implemented in Phase 3.
- [ ] **No participant eligibility filtering** or pool calculation logic is implemented in Phase 3.
- [ ] **No official winner confirmation** or live redraw UI mutation is implemented in Phase 3.
- [ ] **No BroadcastChannel messaging** or Operator/Audience synchronization is implemented in Phase 3.
- [ ] **No CSV/XLSX export**, file download, backup/restore, audio, or backend code is implemented in Phase 3.
- [ ] All 22 Phase 2 test files and 182 existing tests continue to pass cleanly.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `git diff --check` all pass with zero errors.
- [ ] Documentation reflects accepted Phase 3 scope.
- [ ] The Git working tree is clean.

---

## 20. Risks and Open Questions

| Item | Decision / Option | Recommended Default | Impact of Alternative Choice |
|---|---|---|---|
| **1. Persistence Dependency** | Native IndexedDB vs Dexie.js | **Dexie.js (`dexie`)** | Using native IndexedDB requires ~300+ lines of low-level event callback code, increasing bug risk. |
| **2. Test Database Engine** | `fake-indexeddb` vs Browser integration testing | **`fake-indexeddb`** | Playwright/Puppeteer browser tests would slow unit test execution from <1s to >30s. |
| **3. Participant Ticket Uniqueness** | Scoped per event vs Globally unique across all events | **Scoped per event** (`[eventId+ticketNumber]`) | Global uniqueness would prevent different events from reusing standard ticket number ranges (`001-500`). |
| **4. Event Hard Deletion** | Prohibit deletion if confirmed draws exist vs Allow cascade delete | **Prohibit deletion if confirmed draws exist** | Cascade delete would destroy historical audit logs for completed live raffles. |
| **5. Audit Record Immutability** | Append-only starting in Phase 3 vs Editable logs | **Append-only starting in Phase 3** | Editable audit logs compromise event transparency and historical auditability. |
| **6. Preference Storage** | IndexedDB `preferences` store vs Browser `localStorage` | **IndexedDB `preferences` store** | `localStorage` is synchronous and can block the main thread; IndexedDB keeps all storage unified. |
| **7. Schema Migration Strategy** | Eager validation on database open vs Lazy record migration on read | **Eager migration in Dexie `.upgrade()`** | Lazy migration spreads schema transformation logic across repositories, complicating tests. |
| **8. Quota Exceeded Handling** | Fail-fast with user warning vs Silent storage pruning | **Fail-fast with `StorageQuotaError`** | Pruning would silently destroy old event records or participant data. |

---

## 21. Recommended Immediate Next Task

### Task Recommendation
The recommended immediate next task after approval of this plan is **Phase 3 — Slice 1: Domain Contracts and Invariants**.

Slice 1 focuses purely on defining TypeScript domain models, status discriminated unions, identifier helpers, and domain invariant functions under `src/domain/`. It does **NOT** install persistence dependencies (`dexie`), touch `package.json`, or create database schema files.

### Draft Prompt for Phase 3 Slice 1

```text
Execute Phase 3 — Slice 1: Domain Contracts and Invariants for Raffle OS.

Requirements:
- Do not install new dependencies or modify package.json in Slice 1.
- Do not create database schema files or IndexedDB implementation code in Slice 1.
- Do not modify prototype presentation files (src/prototype/) or React components.

Tasks:
1. Create `src/domain/shared/identifiers.ts` providing branded identifier types (EventId, ParticipantId, DrawSessionId, etc.) and a UUID generator using `crypto.randomUUID()`.
2. Create `src/domain/shared/timestamps.ts` providing ISO 8601 UTC timestamp helpers.
3. Create explicit production domain entity types and invariants:
   - `src/domain/events/event.types.ts` & `event.invariants.ts`
   - `src/domain/participants/participant.types.ts` & `participant.invariants.ts` (enforcing string ticket numbers & leading-zero preservation)
   - `src/domain/prizes/prize.types.ts`
   - `src/domain/draws/draw-session.types.ts` & `draw-configuration.types.ts`
   - `src/domain/winners/winner.types.ts` & `redraw.types.ts`
   - `src/domain/audit/audit.types.ts`
4. Add comprehensive unit tests in `src/domain/domain.test.ts` testing domain models, ticket number string retention, leading zero preservation, and invariant rules.
5. Verify all existing Phase 1 & Phase 2 tests continue to pass.

Run verification commands:
- npm run lint
- npm run typecheck
- npm run test
- npm run build
- git diff --check
```
