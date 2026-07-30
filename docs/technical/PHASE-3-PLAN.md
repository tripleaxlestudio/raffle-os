# Phase 3 — Domain Model and Local Persistence Plan

## 1. Executive Summary

### Purpose of Phase 3

Phase 3 establishes explicit production domain models and a robust, typed local
persistence foundation using IndexedDB. It creates the contracts needed for
future state transitions, entity relationships, candidate-pool snapshots, and
immutable official history without connecting persistence to the Phase 2
prototype UI or implementing participant import, eligibility calculation,
secure winner selection, or live workflow behavior.

### Accepted Phase 2 Baseline

Phase 2 delivered a high-fidelity deterministic static UI prototype accepted on
30 July 2026 (`c4ab9f88bdf69dca264ef5543aa695becffdaa89`). The
codebase contains 22 test files with 182 passing tests covering Operator and
Audience layouts, semantic design tokens, reusable accessible presentation
components, query-driven mock scenarios, and exact winner grid layouts. Phase 2
uses frozen presentation fixtures under `src/prototype/data/` and presentation
types in `src/prototype/operator-types.ts` and
`src/prototype/audience-types.ts`. It contains no production persistence,
domain mutation, or draw behavior.

### Production Foundations Added in Phase 3

Phase 3 will introduce:

- strict TypeScript domain models for Event, Participant, PrizeCategory,
  DrawConfiguration, DrawSession, WinnerRecord, RedrawRecord, AuditRecord,
  DisplayConfiguration, and ApplicationPreference;
- explicit lifecycle and immutability rules for draft and official records;
- an IndexedDB Version 1 schema, including persisted display configuration;
- unique event-scoped participant tickets and unique winner selection sequence
  positions;
- versioned schema migration infrastructure and backward-compatibility rules;
- one repository interface and one Dexie implementation owner for every
  Version 1 store;
- a cross-store transaction coordinator for draw-history persistence;
- normalized persistence error types and a storage-capability diagnostic;
- development-only seed and guarded database-reset utilities; and
- unit and integration tests for domain rules, schema, repositories,
  transactions, migrations, diagnostics, and record survival after reopen.

### Product Capabilities Explicitly Deferred

Phase 3 will **not** implement:

- CSV or XLSX file reading, parsing, preview, validation staging, or mapping
  (Phase 4);
- participant eligibility calculation or candidate-pool construction
  (Phase 4 / Phase 5);
- Web Crypto selection, Fisher–Yates shuffling, or winner selection (Phase 5);
- Operator confirmation actions, redraw execution workflows, or Live draw UI
  mutation (later workflow phases);
- BroadcastChannel communication or Operator/Audience synchronization
  (Phase 7);
- export, backup/restore, or interrupted-session UI recovery;
- connection of prototype pages, routes, fixtures, or components to production
  persistence; or
- audio, fullscreen control, backend services, cloud storage, authentication,
  or payments.

Phase 3 defines persistence commands and atomicity rules that later workflows
will call. Tests may use synthetic domain records to prove these boundaries,
but no Phase 3 UI or selection algorithm will invoke them.

### Rationale for Architectural Order

1. **Prototype isolation**: production models cannot accidentally inherit dummy
   presentation fields or deterministic fixture behavior.
2. **Data integrity first**: string ticket identifiers, scoped uniqueness, and
   immutable history are defined before file import or winner selection.
3. **Explicit historical relationships**: cancellation and replacement are
   append-oriented relationships between stable records.
4. **Testable persistence**: repositories and transactions can be verified
   independently of React and live event workflows.

---

## 2. Repository Readiness Audit

### Verified Current Facts

- **Git branch**: `main`
- **Git upstream**: `origin/main`
- **Current HEAD at this readiness audit**:
  `28f5af8755590b86b6c543584197e62bd97c014b`
- **Current `origin/main` at this readiness audit**:
  `28f5af8755590b86b6c543584197e62bd97c014b`
- **HEAD/upstream relationship**: exact match at audit time.
- **Working tree before this plan revision**: clean, verified with
  `git status --short`.
- **Target environment**: Windows PowerShell; Chrome and Edge desktop are the
  product browsers.
- **Installed production dependencies**: React 19, React DOM 19, and React
  Router 7.
- **Installed development foundation**: Vite 8, TypeScript 6 in strict mode,
  Tailwind CSS 4, Vitest 4 with jsdom 29, React Testing Library, and ESLint 10.
- **Persistence dependencies**: neither `dexie` nor `fake-indexeddb` is
  installed.
- **Production domain state**: no production entities exist beyond the current
  small app-mode and display-connection types.
- **Persistence state**: no IndexedDB database, migration, repository, or
  production storage integration exists.
- **Prototype state**: `src/prototype/` remains frozen deterministic
  presentation data and types.
- **Test baseline**: 22 test files and 182 passing tests.

### Confirmed Commands

The repository exposes these Windows verification commands:

```text
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
git diff --check
```

The accepted Phase 2 record reports all five commands passing. Phase 3
implementation must run them again at each applicable slice and at final
acceptance; this plan revision itself does not re-run application verification
because it changes documentation only.

### Conflict Audit

No product-requirement conflict was identified. The PRD and accepted Phase 2
record agree that the application remains local-first, ticket numbers remain
strings, official history cannot be silently overwritten, the pure-black
Audience blackout is the accepted contract, and the current UI remains a
presentation-only prototype.

---

## 3. Phase 3 Scope

### Foundations Planned for Phase 3

- production domain contracts and invariant functions;
- branded string identifiers generated with `crypto.randomUUID()`;
- explicit state unions and transition guards;
- immutable configuration and candidate-pool snapshot contracts on
  DrawSession;
- IndexedDB Version 1 stores, indexes, schema registration, and migrations;
- repository interfaces and Dexie implementations for every store;
- intentional mutation commands instead of generic persistence saves;
- cross-store transaction ownership for official draw history;
- development seed, safe reset, and storage-capability diagnostics;
- fake IndexedDB tests plus final manual Chrome and Edge smoke checks; and
- strict isolation from the Phase 2 presentation prototype.

### Capabilities Explicitly Excluded from Phase 3

- real participant files, invalid-row staging, or import commit behavior;
- eligibility filters being evaluated against participants;
- creation of an official candidate pool from production participants;
- winner selection or use of Web Crypto for a draw result;
- official confirmation/redraw application use cases and UI controls;
- display synchronization, export, recovery UI, backup/restore, or cloud
  behavior; and
- any change to Phase 2 pages, routes, fixtures, or presentation tests except
  verifying they continue to pass.

---

## 4. Domain Model Proposal

All production models live under `src/domain/`. They must avoid `any`, unsafe
assertions, numeric ticket coercion, and imports from `src/prototype/`.

### 4.1 Entity Models

#### 1. `Event`

- **Fields**: `id: EventId`, non-empty `name`, optional `description` and
  `scheduledAt`, `status: EventStatus`, `createdAt`, and `updatedAt`.
- **Lifecycle**: draft metadata can be intentionally updated. Status changes use
  a validated transition command. Hard deletion is prohibited after official
  history exists.
- **Relationships**: parent of all event-scoped entities.

#### 2. `Participant`

- **Fields**: `id: ParticipantId`, `eventId`, `ticketNumber: TicketNumber`,
  optional `name`, `group`, `notes`, `isCheckedIn`, `createdAt`, and
  `updatedAt`.
- **Invariant**: `ticketNumber` is always a string and preserves leading zeroes.
  The pair `(eventId, ticketNumber)` is unique.
- **Persisted-state boundary**: Participant has no
  `ParticipantValidationStatus`. A persisted Participant is already a valid
  production record. Empty, duplicate, malformed, or otherwise invalid file
  rows belong to a future Phase 4 import-staging model and must never be stored
  as Participant records.

#### 3. `PrizeCategory`

- **Fields**: `id: PrizeCategoryId`, `eventId`, non-empty `name`, non-empty
  `prizeName`, `displayOrder`, optional `description` and `sponsorName`, and
  `createdAt`.
- **Lifecycle**: create and update while draft; prohibit deletion or mutation
  that would invalidate a used DrawConfiguration or historical snapshot.
- **Repository boundary**: has a dedicated `PrizeCategoryRepository`; it is not
  folded into Event or DrawConfiguration persistence.

#### 4. `DrawConfiguration`

- **Fields**: `id: DrawConfigurationId`, `eventId`, `prizeCategoryId`,
  `requestedWinners` from 1 through 100, `winningRule`, `requireCheckIn`,
  optional `eligibleGroupFilter`, and `createdAt`/`updatedAt`.
- **Immutability decision**: `updateDraft` is allowed only until a DrawSession
  using the configuration first enters `drawing`. From that point, the
  DrawConfiguration is immutable; changed rules require a new
  DrawConfiguration ID.
- **Historical rule**: DrawSession stores its own immutable
  `DrawConfigurationSnapshot`, so historical meaning never depends on a
  mutable join.
- **Repository boundary**: has a dedicated `DrawConfigurationRepository`.

#### 5. `DrawSession`

- **Fields**: `id: DrawSessionId`, `eventId`, `configurationId`,
  `mode: AppMode`, `status: DrawSessionStatus`,
  `configurationSnapshot: DrawConfigurationSnapshot | null`,
  `candidatePoolSnapshot: CandidatePoolSnapshot | null`, `createdAt`,
  `updatedAt`, and optional `completedAt`.
- **Draft rule**: both snapshots may be null while the session is draft or
  ready.
- **Start rule**: before transition to `drawing`, a later Phase 5 use case must
  atomically attach both snapshots. Once attached, neither snapshot can be
  edited.
- **Terminal rule**: a completed or cancelled official DrawSession cannot be
  overwritten by a general update. Only validated status transitions are
  exposed.

`DrawConfigurationSnapshot` contains at least:

- source `configurationId`;
- `prizeCategoryId`, category name, and public prize name;
- `requestedWinners`, `winningRule`, `requireCheckIn`, and normalized active
  group filter;
- snapshot format version; and
- `capturedAt`.

`CandidatePoolSnapshot` contains at least:

- snapshot format version and `capturedAt`;
- the active filter/rule values used to construct it;
- an immutable ordered collection of candidate entries, each containing
  `participantId` and the exact string `ticketNumber`; and
- `eligibleSnapshotCount`, which must equal the number of candidate entries.

`eligibleSnapshotCount` alone is explicitly insufficient: it cannot prove
which participants were eligible, preserve their ticket strings, or reconstruct
the pool from later-mutated Participant records.

Phase 3 defines, persists, validates, and round-trips the snapshot structures.
Phase 5 remains responsible for evaluating eligibility, constructing the
production candidate list, freezing it before selection, verifying sufficient
capacity, and using the frozen entries as the sole selection input.

#### 6. `WinnerRecord`

- **Fields**: `id: WinnerRecordId`, denormalized `eventId` and
  `prizeCategoryId`, `drawSessionId`, `participantId`,
  `ticketNumber: TicketNumber`, `sequenceNumber`, `status: WinnerStatus`,
  `createdAt`, `updatedAt`, and optional `confirmedAt`/`cancelledAt`.
- **Participant snapshot**: an optional participant display name may be copied
  for local Operator audit, but Audience messages remain public-only.
- **Sequence semantics**: `sequenceNumber` is an immutable, 1-based selection
  sequence within one DrawSession. The pair
  `(drawSessionId, sequenceNumber)` is unique. Initial results use sequential
  values; a redraw replacement receives the next unused sequence rather than
  reusing or overwriting the original record's sequence. UI relationship
  presentation may display the replacement in the original logical result
  position by following RedrawRecord lineage.
- **Denormalization decision**: both `eventId` and `prizeCategoryId` are stored.
  `eventId` supports efficient event history and one-per-event queries.
  `prizeCategoryId` is also retained because one-per-category eligibility and
  category history are core query paths. The query benefit justifies the
  consistency cost only with mandatory relationship validation.
- **Relationship validation**: on append, the repository/transaction must
  verify that `eventId` equals the parent DrawSession `eventId`,
  `prizeCategoryId` equals the DrawSession configuration snapshot category,
  the Participant belongs to the same Event, and the copied ticket matches the
  Participant ticket and candidate snapshot entry.
- **Identity rule**: `participantId`, `ticketNumber`, `eventId`,
  `prizeCategoryId`, `drawSessionId`, and `sequenceNumber` never change after
  creation.

#### 7. `RedrawRecord`

- **Fields**: `id: RedrawRecordId`, denormalized `eventId`, `drawSessionId`,
  `originalWinnerRecordId`, `replacementWinnerRecordId`, required
  `reason: RedrawReason`, optional `reasonNote`, and `createdAt`.
- **Role**: append-only evidence that one cancelled WinnerRecord was replaced by
  a distinct WinnerRecord. It owns the reason and relationship; it does not
  mutate either record's participant identity.
- **Validation**: both winners must exist, share the same Event and
  DrawSession, be distinct IDs, and the original must be `cancelled`. A
  replacement initially enters as `pending`. If that replacement is later
  cancelled, a new RedrawRecord links it to another new replacement, preserving
  the entire chain.
- **Repository boundary**: has a dedicated append-only `RedrawRepository`.

#### 8. `AuditRecord`

- **Fields**: `id: AuditRecordId`, `eventId`, `action`, `actor`, structured-clone
  safe detail, and `timestamp`.
- **Lifecycle**: append-only. No update or normal delete method exists.
- **Limitation**: this local audit trail is operational evidence, not
  tamper-proof or legally certified evidence.

#### 9. `DisplayConfiguration`

- **Fields**: `id: DisplayConfigurationId`, unique `eventId`,
  `targetResolution`, non-negative `safeAreaMargin`,
  `blackoutAppearance: 'pure-black'`, `createdAt`, and `updatedAt`.
- **Persistence decision**: retained and persisted in Phase 3 through a
  `display_configurations` store, dedicated repository interface, Dexie
  implementation, tests, implementation slice, and acceptance item.
- **Blackout contract**: the only Phase 3 value is the literal
  `'pure-black'`, matching accepted Phase 2 behavior. A branded blackout is not
  supported. Any future alternative requires an explicit product decision and
  is outside this plan.
- **UI boundary**: persistence is implemented without connecting the Settings
  prototype or Audience page to it.

#### 10. `ApplicationPreference`

Application preferences use a closed typed registry rather than
`value: unknown` or unconstrained generics:

```typescript
export interface ApplicationPreferenceRegistry {
  activeEventId: EventId | null
  lastOperatorMode: AppMode
}

export type ApplicationPreferenceKey =
  keyof ApplicationPreferenceRegistry

export type ApplicationPreference<
  K extends ApplicationPreferenceKey = ApplicationPreferenceKey,
> = {
  [P in K]: {
    key: P
    value: ApplicationPreferenceRegistry[P]
    updatedAt: IsoTimestamp
  }
}[K]
```

Registry values must be structured-clone safe: no functions, symbols, DOM
nodes, class instances, cyclic graphs, or `undefined`. Each key has a runtime
validator and a specific return type. Adding a key requires updating the
registry, validator, migration consideration, and tests.

### 4.2 Important Domain Invariants

1. Ticket numbers remain strings from domain creation through IndexedDB keys
   and queries; leading zeroes are never normalized away.
2. Prototype fixtures and types never enter production persistence.
3. Invalid import rows are staging data, not Participant records.
4. A used DrawConfiguration and attached DrawSession snapshots are immutable.
5. Confirmed/completed official records cannot be overwritten through a
   generic save operation.
6. Practice records remain explicitly marked and cannot affect future Live
   eligibility or official history.
7. All stored timestamps use unambiguous ISO 8601 UTC strings.
8. Denormalized winner relationship fields are validated against their parent
   DrawSession, configuration snapshot, Participant, and candidate snapshot.
9. AuditRecord and RedrawRecord are append-only.
10. A redraw creates a new WinnerRecord; no WinnerRecord silently becomes a
    different participant.

### 4.3 Identifier Strategy Recommendation

| Strategy | Use | Decision |
|---|---|---|
| `crypto.randomUUID()` | Stable entity primary keys | Recommended; browser-native and collision resistant. |
| Compound indexes | Scoped uniqueness and query keys | Recommended for event tickets and winner sequence positions. |
| IndexedDB auto-increment | Entity identity | Rejected because insertion order should not define identity. |

`Math.random()` must never generate official winner results or production
entity IDs.

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
  | 'completed'
  | 'cancelled'

export type WinnerStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
```

`ParticipantValidationStatus` and `ParticipantImportStrategy` are not
Participant domain state in Phase 3. Phase 4 may define separate import-staging
types for invalid rows and replace/merge intent.

### 5.2 Winner and Redraw Lifecycle

```text
new selection
     │
     ▼
  pending ───────────────► confirmed
     │                         │
     └──────────────┬──────────┘
                    │ explicit redraw transaction
                    ▼
                cancelled  (terminal)
                    │
                    └── RedrawRecord ──► new replacement WinnerRecord (pending)
```

- The original WinnerRecord always ends in terminal status `cancelled` when
  replaced.
- A replacement is a new WinnerRecord with its own immutable ID, participant,
  ticket, and selection sequence.
- A replacement starts `pending`, then may become `confirmed` or `cancelled`.
  Cancelling it creates another RedrawRecord and another new pending
  replacement.
- `replaced` is not a WinnerStatus. It is relationship presentation derived
  when a RedrawRecord points from a cancelled winner to a replacement.
- `pending -> confirmed`, `pending -> cancelled`, and the exceptional
  `confirmed -> cancelled` transition are intentional commands. The latter is
  allowed only inside an audited redraw transaction with a required Live
  reason.
- `cancelled` is terminal. Identity and selection fields never transition.

### 5.3 State Enforcement Responsibilities

| Area | Phase 3 responsibility | Deferred responsibility |
|---|---|---|
| Event lifecycle | Types, transition guards, repository commands | Operator workflow triggers |
| DrawSession lifecycle | Types, snapshot contracts, immutable persistence | Draw execution state machine |
| Winner lifecycle | Append and validated status-transition boundaries | Confirmation/redraw use cases and UI |
| Redraw | Append-only relationship contract and atomic persistence boundary | Candidate selection and operator workflow |
| Participant import validation | Exclude invalid rows from Participant domain | Phase 4 staging and file validation |

---

## 6. Prototype-to-Domain Boundary

### Architectural Boundary Rules

1. `src/prototype/` presentation types are never imported by domain,
   application repository, or persistence infrastructure modules.
2. Existing scenario URLs continue to use frozen mock fixtures throughout
   Phase 3.
3. A future UI-integration phase must add explicit domain-to-view-model mappers.
4. Production persistence must not be instantiated by current pages, route
   loaders, hooks, or Audience components.
5. All 182 accepted Phase 2 tests must remain deterministic and passing.

### Proposed Directory Layout

```text
src/
├── domain/
│   ├── events/
│   │   ├── event.types.ts
│   │   └── event.invariants.ts
│   ├── participants/
│   │   ├── participant.types.ts
│   │   └── participant.invariants.ts
│   ├── prizes/
│   │   └── prize.types.ts
│   ├── draws/
│   │   ├── draw-configuration.types.ts
│   │   ├── draw-session.types.ts
│   │   └── draw.invariants.ts
│   ├── winners/
│   │   ├── winner.types.ts
│   │   ├── redraw.types.ts
│   │   └── winner.invariants.ts
│   ├── audit/
│   │   └── audit.types.ts
│   ├── display/
│   │   └── display-configuration.types.ts
│   ├── preferences/
│   │   └── application-preference.types.ts
│   └── shared/
│       ├── identifiers.ts
│       ├── timestamps.ts
│       └── result.ts
├── application/
│   └── persistence/
│       ├── repositories/
│       │   ├── event-repository.interface.ts
│       │   ├── participant-repository.interface.ts
│       │   ├── prize-category-repository.interface.ts
│       │   ├── draw-configuration-repository.interface.ts
│       │   ├── display-configuration-repository.interface.ts
│       │   ├── draw-session-repository.interface.ts
│       │   ├── winner-repository.interface.ts
│       │   ├── redraw-repository.interface.ts
│       │   ├── audit-repository.interface.ts
│       │   └── preference-repository.interface.ts
│       └── draw-persistence-unit-of-work.interface.ts
└── infrastructure/
    └── persistence/
        ├── db.ts
        ├── schema/
        │   ├── schema-v1.ts
        │   └── migrations.ts
        ├── repositories/
        │   ├── event.repository.ts
        │   ├── participant.repository.ts
        │   ├── prize-category.repository.ts
        │   ├── draw-configuration.repository.ts
        │   ├── display-configuration.repository.ts
        │   ├── draw-session.repository.ts
        │   ├── winner.repository.ts
        │   ├── redraw.repository.ts
        │   ├── audit.repository.ts
        │   └── preference.repository.ts
        ├── transactions/
        │   └── dexie-draw-persistence-unit-of-work.ts
        ├── diagnostics/
        │   └── storage-diagnostics.ts
        ├── seed/
        │   ├── dev-seed.ts
        │   └── reset-db.ts
        └── errors/
            └── persistence-errors.ts
```

These paths are planned; this planning task creates none of them.

---

## 7. IndexedDB Technology Decision

### 7.1 Comparison of Options

| Criteria | Native IndexedDB | Dexie | `idb` |
|---|---|---|---|
| Strict TypeScript ergonomics | Manual and verbose | Strong typed tables and queries | Good Promise wrapper |
| Schema/migrations | Manual upgrade events | Declarative versions and upgrade handlers | Manual upgrade callback |
| Multi-store transactions | Verbose | Concise and testable | Promise-based native model |
| Compound indexes | Manual key/index handling | Direct schema support | Native index wrappers |
| Testability in Vitest | Needs an IndexedDB test provider | Works with `fake-indexeddb` | Works with `fake-indexeddb` |
| Production dependency cost | None | Moderate | Small |

### 7.2 Recommendation: Dexie

Dexie remains the recommended persistence layer because typed tables, compound
indexes, migrations, and multi-store transactions materially reduce
implementation risk. This is a proposed new production dependency and requires
explicit approval before installation. Its exact version and bundle impact must
be verified at implementation approval time rather than silently inferred from
this plan.

### 7.3 Test Environment: `fake-indexeddb`

`fake-indexeddb` remains the recommended development dependency for isolated
Vitest persistence tests. It does not replace final real-browser smoke checks.
Installation and exact version also require explicit approval.

---

## 8. Database Schema Proposal

### Database Name: `RaffleOS_DB` (Version 1)

```typescript
// Proposed Dexie Version 1 store strings
const schemaV1 = {
  events: 'id, name, status, createdAt',
  participants:
    'id, eventId, ticketNumber, &[eventId+ticketNumber], isCheckedIn, group',
  prize_categories: 'id, eventId, displayOrder',
  draw_configurations: 'id, eventId, prizeCategoryId',
  display_configurations: 'id, &eventId',
  draw_sessions:
    'id, eventId, configurationId, mode, status, createdAt',
  winner_records:
    'id, eventId, prizeCategoryId, drawSessionId, participantId, ticketNumber, status, sequenceNumber, &[drawSessionId+sequenceNumber], [eventId+status], [eventId+prizeCategoryId+status]',
  redraw_records:
    'id, eventId, drawSessionId, &originalWinnerRecordId, replacementWinnerRecordId, createdAt',
  audit_records: 'id, eventId, action, timestamp, [eventId+timestamp]',
  preferences: 'key',
} as const
```

`&[eventId+ticketNumber]` is intentionally unique and scoped per Event.
`ticketNumber` remains a string component of the compound key.

`&[drawSessionId+sequenceNumber]` is also intentionally unique. It prevents two
WinnerRecords from claiming the same immutable selection sequence in one
DrawSession. Redraws append a replacement with the next sequence and use
RedrawRecord for logical replacement presentation, so the constraint never
requires deletion or mutation of the original.

### Table Details, Ownership, and Test Coverage

| Version 1 store | Primary/index decision | Repository owner | Slice | Required focused tests |
|---|---|---|---:|---|
| `events` | `id`; status/name indexes | EventRepository | 3 | create, update draft, transition, protected delete |
| `participants` | `id`; unique `&[eventId+ticketNumber]` | ParticipantRepository | 3 | leading-zero lookup, scoped uniqueness, bounded event reads |
| `prize_categories` | `id`; event/order indexes | PrizeCategoryRepository | 4 | event isolation, draft update, referenced-record guard |
| `draw_configurations` | `id`; event/category indexes | DrawConfigurationRepository | 4 | draft update, immutability after use, relationship validation |
| `display_configurations` | `id`; unique `&eventId` | DisplayConfigurationRepository | 4 | one per event, pure-black validation, reopen survival |
| `draw_sessions` | `id`; event/mode/status indexes | DrawSessionRepository | 5 | transitions, snapshot immutability, terminal protection |
| `winner_records` | `id`; event/category/session indexes; unique sequence compound index | WinnerRepository | 5 | append, denormalized validation, duplicate sequence rejection |
| `redraw_records` | `id`; unique original-winner index | RedrawRepository | 5 | append-only lineage, reason rules, relationship validation |
| `audit_records` | `id`; chronological event compound index | AuditRepository | 5 | append-only behavior and ordered event query |
| `preferences` | typed `key` | PreferenceRepository | 4 | key-specific validation, structured-clone-safe round trip |

No Version 1 table may be added during implementation without adding its
domain owner, repository interface, Dexie implementation, implementation slice,
migration consideration, tests, and acceptance coverage.

### Deletion Behavior

- Event deletion is limited to a deliberate draft-only operation when no
  official history exists.
- Participant/category/configuration deletion cannot invalidate snapshots or
  official history.
- DrawSession, WinnerRecord, RedrawRecord, and AuditRecord official history is
  never deleted through standard repositories.
- DisplayConfiguration may be replaced only through an event-scoped update
  command.
- Preferences may be set by their typed key.
- A full developer database reset is a separate guarded utility, not a
  repository operation.

---

## 9. Schema Versioning and Migration Strategy

### Database Initialization and Version 1

- database name: `RaffleOS_DB`;
- initial version: `1`;
- schema declaration: `schema/schema-v1.ts`;
- version registration and forward migrations: `schema/migrations.ts`; and
- database class/table typing: `db.ts`.

`migrations.ts` is part of the actual Slice 2 file list and has its own test
coverage; it is not merely an acceptance aspiration.

### Schema Evolution Rules

1. Increment the Dexie version and add an explicit forward-only migration.
2. Test an upgrade from a seeded prior-version database, including leading-zero
   tickets and official history.
3. Preserve or explicitly transform old data; do not silently drop stores or
   official records.
4. Fail a database newer than supported with
   `UnsupportedSchemaVersionError` before mutating data.
5. Treat committed browser migrations as irreversible deployments and document
   recovery behavior.
6. Review new typed preference keys and snapshot-format versions for migration
   needs.

---

## 10. Repository and Data-Access Architecture

### Architecture Pattern

```text
Future UI/use case
    → application persistence contract
        → repository or draw persistence unit of work
            → Dexie implementation
                → IndexedDB
```

### Intentional Repository Commands

Official or historical entities do not expose universal `save` methods.
Representative boundaries are:

```typescript
interface EventRepository {
  findById(id: EventId): Promise<Event | null>
  findAll(): Promise<Event[]>
  create(event: Event): Promise<void>
  updateDraft(event: Event): Promise<void>
  transitionStatus(
    id: EventId,
    from: EventStatus,
    to: EventStatus,
    at: IsoTimestamp,
  ): Promise<void>
  deleteDraft(id: EventId): Promise<void>
}

interface ParticipantRepository {
  findById(id: ParticipantId): Promise<Participant | null>
  findByTicketNumber(
    eventId: EventId,
    ticketNumber: TicketNumber,
  ): Promise<Participant | null>
  findByEventId(
    eventId: EventId,
    page: { limit: number; offset: number },
  ): Promise<Participant[]>
  countByEventId(eventId: EventId): Promise<number>
  createBatch(participants: readonly Participant[]): Promise<void>
  updateOperationalFields(
    id: ParticipantId,
    changes: ParticipantOperationalChanges,
  ): Promise<void>
  deleteDraftEventParticipants(eventId: EventId): Promise<void>
}

interface PrizeCategoryRepository {
  findById(id: PrizeCategoryId): Promise<PrizeCategory | null>
  findByEventId(eventId: EventId): Promise<PrizeCategory[]>
  create(category: PrizeCategory): Promise<void>
  updateDraft(category: PrizeCategory): Promise<void>
  deleteDraft(id: PrizeCategoryId): Promise<void>
}

interface DrawConfigurationRepository {
  findById(id: DrawConfigurationId): Promise<DrawConfiguration | null>
  findByEventId(eventId: EventId): Promise<DrawConfiguration[]>
  createDraft(configuration: DrawConfiguration): Promise<void>
  updateDraft(configuration: DrawConfiguration): Promise<void>
  deleteUnused(id: DrawConfigurationId): Promise<void>
}

interface DisplayConfigurationRepository {
  findByEventId(eventId: EventId): Promise<DisplayConfiguration | null>
  create(configuration: DisplayConfiguration): Promise<void>
  updateForEvent(configuration: DisplayConfiguration): Promise<void>
}

interface DrawSessionRepository {
  findById(id: DrawSessionId): Promise<DrawSession | null>
  findLatestByEventId(
    eventId: EventId,
    mode?: AppMode,
  ): Promise<DrawSession | null>
  createDraft(session: DrawSession): Promise<void>
  attachSnapshotsAndTransitionToDrawing(
    id: DrawSessionId,
    snapshots: DrawStartSnapshots,
  ): Promise<void>
  transitionStatus(
    id: DrawSessionId,
    from: DrawSessionStatus,
    to: DrawSessionStatus,
    at: IsoTimestamp,
  ): Promise<void>
}

interface WinnerRepository {
  findByDrawSessionId(id: DrawSessionId): Promise<WinnerRecord[]>
  findConfirmedByEventId(id: EventId): Promise<WinnerRecord[]>
  findConfirmedByEventAndCategory(
    eventId: EventId,
    prizeCategoryId: PrizeCategoryId,
  ): Promise<WinnerRecord[]>
  append(winner: WinnerRecord): Promise<void>
  appendBatch(winners: readonly WinnerRecord[]): Promise<void>
  transitionStatus(
    id: WinnerRecordId,
    from: WinnerStatus,
    to: WinnerStatus,
    at: IsoTimestamp,
  ): Promise<void>
}

interface RedrawRepository {
  findByDrawSessionId(id: DrawSessionId): Promise<RedrawRecord[]>
  findByOriginalWinnerId(id: WinnerRecordId): Promise<RedrawRecord | null>
  append(record: RedrawRecord): Promise<void>
}

interface AuditRepository {
  findByEventId(eventId: EventId): Promise<AuditRecord[]>
  append(record: AuditRecord): Promise<void>
}

interface PreferenceRepository {
  get<K extends ApplicationPreferenceKey>(
    key: K,
  ): Promise<ApplicationPreferenceRegistry[K] | null>
  set<K extends ApplicationPreferenceKey>(
    key: K,
    value: ApplicationPreferenceRegistry[K],
    at: IsoTimestamp,
  ): Promise<void>
}
```

The concrete method names may be refined during implementation, but these
capability limits are acceptance requirements. There is no generic overwrite
path for confirmed/completed DrawSession, WinnerRecord, RedrawRecord, or
AuditRecord data.

### Cross-Store Transaction Ownership

Repositories own single-store validation and access. Cross-store atomicity is
owned by `DrawPersistenceUnitOfWork` in the application boundary and
`DexieDrawPersistenceUnitOfWork` in infrastructure.

The coordinator provides intentional operations for:

- appending a started DrawSession snapshot, selected WinnerRecords, and the
  corresponding AuditRecord atomically;
- transitioning one or more winner statuses with AuditRecords atomically; and
- cancelling an original winner, appending a distinct pending replacement,
  appending RedrawRecord, updating the DrawSession state if required, and
  appending AuditRecord atomically.

These are persistence transactions, not Phase 3 selection or Operator
workflows. They accept already-created, already-policy-validated records from
future application use cases, then enforce relationship consistency and
rollback all stores on failure. UI components and independent repositories do
not open their own overlapping multi-store write transactions.

### Relationship Validation and Error Normalization

- Cross-store validation occurs inside the same transaction as the write to
  avoid time-of-check/time-of-use inconsistencies.
- Duplicate tickets and duplicate session sequence positions map to
  `DuplicateRecordError`.
- Missing or mismatched parents map to typed validation/relationship errors.
- Dexie/native errors are normalized once at the infrastructure boundary and
  preserve their cause without exposing implementation exceptions to React.

---

## 11. Seed and Development Data Strategy

### Development Seed Rules

- Seeding is explicitly invoked and never runs automatically in production.
- All data is fictional and uses valid production contracts.
- Leading-zero tickets are included.
- Default seeding refuses existing data; any overwrite path requires a guarded
  reset first rather than silent per-record replacement.
- A standard seed covers every Version 1 store.
- A capacity seed provides 10,000 Participants for bounded-query and index
  benchmark work.
- Official-history seeds use append/transition commands and the transaction
  coordinator rather than bypassing repository immutability.

### Database Reset Limitation

The reset helper requires an explicit multi-step confirmation token and returns
a structured result describing success or failure. A record written to
`audit_records` in `RaffleOS_DB` cannot survive deletion of that same database.
Therefore Phase 3 makes **no persistent audit guarantee for a full database
reset**. A pre-reset log would be deleted with the database and must not be
described as durable evidence. Durable external reset logging is out of scope.

---

## 12. Data Integrity and Safety

### Safeguard Matrix

| Risk | Enforcement | Failure behavior |
|---|---|---|
| Duplicate ticket within Event | Unique `&[eventId+ticketNumber]` | Abort and return `DuplicateRecordError` |
| Duplicate winner sequence | Unique `&[drawSessionId+sequenceNumber]` | Abort without altering prior winner history |
| Numeric ticket coercion | `TicketNumber` string type plus runtime validation | Reject before write |
| Mismatched denormalized winner fields | Transactional parent/snapshot validation | Roll back all related writes |
| Configuration changed after use | `updateDraft` guard plus immutable session snapshot | Reject mutation |
| Candidate history reduced to a count | Full candidate snapshot contract | Reject draw-start persistence without complete snapshot |
| Partial official write | Dexie multi-store transaction coordinator | Roll back every participating store |
| Generic official overwrite | No generic save/put capability in repository contracts | Compile-time/API boundary plus runtime guard |
| Storage unavailable | Destructive-free capability diagnostic | Return `DatabaseUnavailableError` and block future Live startup |
| Accidental full reset | Explicit confirmation token and separate utility | Refuse reset; never claim its in-database audit survives |
| Cross-event leakage | Required event-scoped indexes and relationship checks | Reject mismatches and return only scoped data |

---

## 13. Error Model

All persistence errors derive from `PersistenceError` and narrow caught
`unknown` values safely. Planned types include:

- `DatabaseUnavailableError`;
- `SchemaMigrationError`;
- `UnsupportedSchemaVersionError`;
- `RecordNotFoundError`;
- `DuplicateRecordError`;
- `RelationshipMismatchError`;
- `ValidationError`;
- `ImmutableRecordError`;
- `StorageQuotaError`; and
- `TransactionError`.

`DatabaseUnavailableError` messaging must state that local storage failed the
capability check. It must not claim the browser is in private/incognito mode,
because browser mode cannot be reliably inferred from storage behavior.

---

## 14. Testing Strategy

### 14.1 Automated Test Scope

- **Domain tests**: string ticket retention, absence of Participant validation
  state, configuration/snapshot immutability, winner lifecycle, redraw chains,
  pure-black display configuration, and typed preference validation.
- **Database/schema tests**: all ten Version 1 stores, exact unique compound
  indexes, schema open/reopen, forward migration harness, and unsupported
  version handling.
- **Repository tests**: every repository in the ownership table, bounded reads,
  typed returns, relationship guards, and intentional mutation commands.
- **Transaction tests**: success and rollback across DrawSession,
  WinnerRecord, RedrawRecord, and AuditRecord stores.
- **Snapshot tests**: configuration and full candidate entries survive
  close/reopen; count matches entries; snapshots reject mutation after start.
- **Seed/reset tests**: every store receives valid seed data, leading zeroes
  survive, overwrite is refused, confirmation is required, and no false reset
  audit-survival claim exists.
- **Diagnostics tests**: success and each failure stage of the capability probe,
  with cleanup attempted in all paths.
- **Regression tests**: the existing 22 test files and 182 tests remain passing
  and no prototype UI imports or initializes production persistence.

### 14.2 Isolated Database Approach

Automated persistence tests use `fake-indexeddb` with a unique database name per
test and guaranteed cleanup. Real browser behavior is covered by final manual
smoke checks rather than assumed from the in-memory implementation.

### 14.3 Storage-Capability Diagnostic

The diagnostic does not attempt private-browsing detection. It:

1. opens a uniquely named temporary IndexedDB database;
2. creates a temporary object store;
3. writes a sentinel record;
4. reads it back and verifies its value;
5. deletes the record and verifies cleanup;
6. closes the database; and
7. deletes the temporary database in a `finally` path.

The result reports which capability stage failed and any normalized error. The
probe must never write production event data.

---

## 15. Performance and Capacity Planning

### Capacity and Query Guidance

- Support at least 10,000 Participants per Event.
- Support multiple DrawSessions per Event and up to 100 initial winners per
  draw.
- Use indexed queries for event ticket, event history, category history, and
  draw-session winner lookups.
- Require explicit bounded reads (`limit` plus cursor/offset policy) for
  participant lists; do not load an entire Event when a subset is requested.
- Prohibit unnecessary `toArray()` calls or full-store scans in normal lookup
  paths.
- Benchmark both cold and warm indexed queries against representative data.

There is no universal “less than 10 ms” persistence acceptance threshold.
IndexedDB latency depends on browser, hardware, profile state, dataset, cache
state, and test environment. Each benchmark record must include:

- Chrome/Edge version;
- operating system and relevant hardware description;
- dataset size and shape;
- query/index used and requested result bound;
- cold/warm methodology, iteration count, and summary measurements; and
- any discovered full scan or unbounded allocation.

Performance acceptance is based on correct index use, bounded memory behavior,
absence of avoidable scans, and recorded measurements. The PRD's separate
sub-one-second final selection target remains for the future draw engine and is
not redefined here.

---

## 16. Security and Privacy

1. All Phase 3 data remains inside the local browser profile; no network or
   cloud request is added.
2. IndexedDB is not an application-level encryption boundary. A person with
   device/profile access may inspect it.
3. Audience code never queries Participant repositories or receives full
   Participant records.
4. Local audit records reduce accidental operational ambiguity but are neither
   tamper-proof nor legally certified.
5. Deleting site data or the full database destroys records, including any
   audit record stored in that database.
6. The storage diagnostic reports capability, not private/incognito status.

---

## 17. Proposed Phase 3 Folder Structure

The authoritative proposed layout is the structure in Section 6. In addition,
tests are colocated by concern:

```text
src/
├── domain/domain.test.ts
├── infrastructure/persistence/
│   ├── db.test.ts
│   ├── schema/migrations.test.ts
│   ├── repositories/configuration-repositories.test.ts
│   ├── repositories/core-repositories.test.ts
│   ├── repositories/draw-history-repositories.test.ts
│   ├── transactions/draw-persistence-unit-of-work.test.ts
│   ├── diagnostics/storage-diagnostics.test.ts
│   └── seed/seed-and-reset.test.ts
└── prototype/                              # unchanged and disconnected
```

---

## 18. Implementation Slices

Phase 3 is divided into seven reviewable slices.

### Slice 1: Domain Contracts and Invariants

- **Objective**: define every promised production domain type, snapshot,
  lifecycle, preference registry, and invariant without database code.
- **Files**:
  - [NEW] `src/domain/shared/identifiers.ts`
  - [NEW] `src/domain/shared/timestamps.ts`
  - [NEW] `src/domain/shared/result.ts`
  - [NEW] `src/domain/events/event.types.ts`
  - [NEW] `src/domain/events/event.invariants.ts`
  - [NEW] `src/domain/participants/participant.types.ts`
  - [NEW] `src/domain/participants/participant.invariants.ts`
  - [NEW] `src/domain/prizes/prize.types.ts`
  - [NEW] `src/domain/draws/draw-configuration.types.ts`
  - [NEW] `src/domain/draws/draw-session.types.ts`
  - [NEW] `src/domain/draws/draw.invariants.ts`
  - [NEW] `src/domain/winners/winner.types.ts`
  - [NEW] `src/domain/winners/redraw.types.ts`
  - [NEW] `src/domain/winners/winner.invariants.ts`
  - [NEW] `src/domain/audit/audit.types.ts`
  - [NEW] `src/domain/display/display-configuration.types.ts`
  - [NEW] `src/domain/preferences/application-preference.types.ts`
  - [NEW] `src/domain/domain.test.ts`
- **Tests**: all Section 14 domain cases, including DisplayConfiguration,
  ApplicationPreference, snapshots, and winner/redraw semantics.
- **Dependencies**: none.
- **Verification**:
  `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test`,
  `npm.cmd run build`, `git diff --check`.
- **Non-goals**: no dependency installation, IndexedDB, import logic, or UI.
- **Commit boundary**: `feat(domain): define Phase 3 domain contracts`

### Slice 2: Persistence Dependencies, Schema Version 1, and Migrations

- **Objective**: after explicit approval, install approved dependencies and
  define the database, all ten stores, exact indexes, error types, and migration
  infrastructure.
- **Files**:
  - [MODIFY] `package.json`
  - [MODIFY] `package-lock.json`
  - [NEW] `src/infrastructure/persistence/errors/persistence-errors.ts`
  - [NEW] `src/infrastructure/persistence/schema/schema-v1.ts`
  - [NEW] `src/infrastructure/persistence/schema/migrations.ts`
  - [NEW] `src/infrastructure/persistence/schema/migrations.test.ts`
  - [NEW] `src/infrastructure/persistence/db.ts`
  - [NEW] `src/infrastructure/persistence/db.test.ts`
- **Tests**: schema opens with every store and exact unique indexes; migration
  harness; reopen survival; unsupported versions; error normalization.
- **Dependencies**: proposed `dexie` and `fake-indexeddb`, with exact versions
  approved at implementation time.
- **Verification**: all five Windows commands listed in Slice 1.
- **Commit boundary**: `feat(persistence): establish schema v1 and migrations`

### Slice 3: Event and Participant Repositories

- **Objective**: implement Event and Participant contracts and Dexie owners.
- **Files**:
  - [NEW] `src/application/persistence/repositories/event-repository.interface.ts`
  - [NEW] `src/application/persistence/repositories/participant-repository.interface.ts`
  - [NEW] `src/infrastructure/persistence/repositories/event.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/participant.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/core-repositories.test.ts`
- **Tests**: intentional commands, event isolation, bounded reads, string ticket
  round trips, and unique `&[eventId+ticketNumber]`.
- **Verification**: all five Windows commands listed in Slice 1.
- **Commit boundary**: `feat(persistence): add event and participant repositories`

### Slice 4: Configuration and Preference Repositories

- **Objective**: implement the remaining mutable-configuration stores and typed
  preferences.
- **Files**:
  - [NEW] `src/application/persistence/repositories/prize-category-repository.interface.ts`
  - [NEW] `src/application/persistence/repositories/draw-configuration-repository.interface.ts`
  - [NEW] `src/application/persistence/repositories/display-configuration-repository.interface.ts`
  - [NEW] `src/application/persistence/repositories/preference-repository.interface.ts`
  - [NEW] `src/infrastructure/persistence/repositories/prize-category.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/draw-configuration.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/display-configuration.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/preference.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/configuration-repositories.test.ts`
- **Tests**: draft-only category/configuration mutation, configuration
  immutability after use, one DisplayConfiguration per Event, pure-black-only
  validation, typed preferences, and reopen survival.
- **Verification**: all five Windows commands listed in Slice 1.
- **Commit boundary**:
  `feat(persistence): add configuration and preference repositories`

### Slice 5: Draw History Repositories and Unit of Work

- **Objective**: implement DrawSession, WinnerRecord, RedrawRecord, and
  AuditRecord owners plus the cross-store transaction coordinator.
- **Files**:
  - [NEW] `src/application/persistence/repositories/draw-session-repository.interface.ts`
  - [NEW] `src/application/persistence/repositories/winner-repository.interface.ts`
  - [NEW] `src/application/persistence/repositories/redraw-repository.interface.ts`
  - [NEW] `src/application/persistence/repositories/audit-repository.interface.ts`
  - [NEW] `src/application/persistence/draw-persistence-unit-of-work.interface.ts`
  - [NEW] `src/infrastructure/persistence/repositories/draw-session.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/winner.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/redraw.repository.ts`
  - [NEW] `src/infrastructure/persistence/repositories/audit.repository.ts`
  - [NEW] `src/infrastructure/persistence/transactions/dexie-draw-persistence-unit-of-work.ts`
  - [NEW] `src/infrastructure/persistence/repositories/draw-history-repositories.test.ts`
  - [NEW] `src/infrastructure/persistence/transactions/draw-persistence-unit-of-work.test.ts`
- **Tests**: snapshot immutability, denormalized field validation, unique
  sequence positions, winner transitions, redraw lineage, append-only audit,
  atomic success, and full rollback.
- **Non-goal**: no selection, eligibility, confirmation UI, or redraw UI use
  case.
- **Verification**: all five Windows commands listed in Slice 1.
- **Commit boundary**: `feat(persistence): add immutable draw history boundaries`

### Slice 6: Seed, Reset, and Storage Diagnostics

- **Objective**: add explicit development seed/reset utilities and a
  storage-capability probe.
- **Files**:
  - [NEW] `src/infrastructure/persistence/seed/dev-seed.ts`
  - [NEW] `src/infrastructure/persistence/seed/reset-db.ts`
  - [NEW] `src/infrastructure/persistence/seed/seed-and-reset.test.ts`
  - [NEW] `src/infrastructure/persistence/diagnostics/storage-diagnostics.ts`
  - [NEW] `src/infrastructure/persistence/diagnostics/storage-diagnostics.test.ts`
- **Tests**: every Version 1 store is seeded, safe refusal/confirmation behavior,
  no durable same-database reset-audit claim, and complete open/write/read/delete
  diagnostic paths with cleanup.
- **Verification**: all five Windows commands listed in Slice 1.
- **Commit boundary**: `feat(persistence): add seed reset and storage diagnostics`

### Slice 7: Phase 3 Acceptance and Documentation Closeout

- **Objective**: run the full automated suite, perform Chrome and Edge
  IndexedDB smoke checks, verify prototype isolation, and record acceptance.
- **Files**:
  - [NEW] `docs/technical/PHASE-3-ACCEPTANCE.md`
  - [MODIFY] `TASKS.md`
- **Automated verification**:
  `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test`,
  `npm.cmd run build`, `git diff --check`.
- **Manual verification**: Section 19 browser checklist.
- **Commit boundary**: `docs: close Phase 3 acceptance`

Every Version 1 store is owned by exactly one repository implementation slice:
Events and Participants in Slice 3; PrizeCategory, DrawConfiguration,
DisplayConfiguration, and preferences in Slice 4; DrawSession, WinnerRecord,
RedrawRecord, and AuditRecord in Slice 5.

---

## 19. Phase 3 Acceptance Checklist

### Domain and Integrity

- [ ] All ten production entity/value contracts exist, including
  DisplayConfiguration and ApplicationPreference.
- [ ] Participant contains no persisted validation status; invalid import rows
  are explicitly deferred to Phase 4 staging.
- [ ] Ticket numbers remain strings and leading zeroes survive write, indexed
  lookup, close, and reopen.
- [ ] WinnerStatus is only `pending | confirmed | cancelled`; `replaced` is
  derived from RedrawRecord relationships.
- [ ] A redraw leaves the original WinnerRecord as terminal `cancelled` and
  appends a distinct pending replacement without changing participant identity.
- [ ] Used DrawConfigurations and attached DrawSession snapshots are immutable.
- [ ] DrawSession includes immutable configuration and full candidate-pool
  snapshot contracts; eligible count alone is never presented as reconstructive
  evidence.
- [ ] WinnerRecord includes `eventId` and `prizeCategoryId`, and transactional
  validation proves they match DrawSession, configuration snapshot,
  Participant, and candidate snapshot.
- [ ] DisplayConfiguration persists exactly one configuration per Event and
  supports only the accepted pure-black blackout.
- [ ] ApplicationPreference uses the typed structured-clone-safe registry and
  runtime validation.

### Schema, Repositories, and Transactions

- [ ] Version 1 contains exactly the ten stores in Section 8, including
  `display_configurations`.
- [ ] Participants use the unique compound index
  `&[eventId+ticketNumber]`.
- [ ] WinnerRecords use the unique compound index
  `&[drawSessionId+sequenceNumber]`.
- [ ] `migrations.ts` and migration tests are implemented in Slice 2.
- [ ] Every Version 1 store has its listed domain owner, repository interface,
  Dexie implementation, slice, and focused tests.
- [ ] PrizeCategory, DrawConfiguration, RedrawRecord, and
  DisplayConfiguration have dedicated repository boundaries.
- [ ] Confirmed/completed official records have no generic save/overwrite path.
- [ ] RedrawRecord and AuditRecord repositories are append-only.
- [ ] Cross-store draw-history writes are owned by
  DrawPersistenceUnitOfWork and roll back atomically on any error.
- [ ] Production persistence remains disconnected from all Phase 2 UI,
  fixtures, routes, and components.

### Diagnostics, Performance, and Reset Safety

- [ ] Storage capability is diagnosed by a temporary
  open/write/read/delete/cleanup probe without claiming private-mode detection.
- [ ] Database reset requires explicit confirmation and documentation states
  that an audit record in the deleted database cannot survive full deletion.
- [ ] Repository query paths use indexes and bounded reads without unnecessary
  full scans.
- [ ] Benchmarks record browser, environment, dataset, query, bounds,
  methodology, and measurements; no universal 10 ms threshold is asserted.

### Automated and Manual Verification

- [ ] All accepted Phase 2 tests continue to pass.
- [ ] `npm.cmd run lint` passes.
- [ ] `npm.cmd run typecheck` passes.
- [ ] `npm.cmd run test` passes.
- [ ] `npm.cmd run build` passes.
- [ ] `git diff --check` passes.
- [ ] Manual Chrome IndexedDB smoke check passes:
  database opens; a test record survives reload/reopen; lookup of a ticket such
  as `"00042"` succeeds without losing zeroes; cleanup succeeds; and no
  prototype UI is connected to production persistence.
- [ ] Manual Edge IndexedDB smoke check passes with the same five checks.
- [ ] Phase 3 acceptance records the tested Chrome and Edge versions and the
  exact accepted commit.

### Scope Exclusions

- [ ] No CSV/XLSX parsing or import staging is implemented.
- [ ] No eligibility calculation or production candidate-pool construction is
  implemented.
- [ ] No winner selection or Web Crypto draw engine is implemented.
- [ ] No official confirmation/redraw UI workflow is implemented.
- [ ] No BroadcastChannel, export, backup/restore, recovery UI, backend, cloud,
  authentication, or payment behavior is implemented.

---

## 20. Risks and Open Questions

| Item | Phase 3 decision | Remaining consideration |
|---|---|---|
| Persistence dependency | Recommend Dexie after explicit approval | Verify exact version and bundle impact at installation |
| Test database | Recommend `fake-indexeddb` after explicit approval | Real-browser smoke checks remain mandatory |
| Participant uniqueness | Unique per Event with `&[eventId+ticketNumber]` | Phase 4 defines normalization before commit without numeric coercion |
| Winner sequence | Unique per DrawSession; replacements append the next sequence | UI later resolves logical replacement position from lineage |
| Configuration history | Freeze configuration after first use and snapshot it on DrawSession | Future edits create a new configuration |
| Candidate history | Define and persist full snapshot structure | Phase 5 constructs and validates real eligible pools |
| Prize category denormalization | Store on WinnerRecord for indexed eligibility/history | Transaction must reject parent mismatch |
| Display configuration | Persist one per Event | UI wiring remains deferred |
| Reset audit | No same-database survival guarantee | External durable logging is out of scope |
| Performance | Environment-aware indexed benchmarks | Acceptance record must preserve measurements and context |

---

## 21. Recommended Immediate Next Task

### Task Recommendation

After approval of this plan, begin **Phase 3 — Slice 1: Domain Contracts and
Invariants**. Slice 1 installs no dependency, creates no database, and changes
no prototype presentation code.

### Draft Prompt for Phase 3 Slice 1

```text
Execute Phase 3 — Slice 1: Domain Contracts and Invariants for Raffle OS.

Requirements:
- Do not install dependencies or modify package files.
- Do not create IndexedDB/schema/repository code.
- Do not modify src/prototype/, React components, pages, routes, or tests except
  for adding the new focused domain test file.

Tasks:
1. Add branded identifiers and ISO UTC timestamp helpers.
2. Define Event, Participant, PrizeCategory, DrawConfiguration, DrawSession,
   WinnerRecord, RedrawRecord, AuditRecord, DisplayConfiguration, and the typed
   ApplicationPreference registry.
3. Define immutable DrawConfigurationSnapshot and CandidatePoolSnapshot
   contracts.
4. Exclude ParticipantValidationStatus from Participant production state.
5. Encode winner/redraw lifecycle rules: cancelled original, new pending
   replacement, and relationship-derived "replaced" presentation.
6. Add focused invariant tests, including ticket strings and leading zeroes.

Run:
- npm.cmd run lint
- npm.cmd run typecheck
- npm.cmd run test
- npm.cmd run build
- git diff --check
```
