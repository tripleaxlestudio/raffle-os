# Phase 3 Acceptance Record

## Executive Result

**PHASE 3 PARTIALLY COMPLETE**

The Phase 3 automated and source acceptance audit is **PASS** at the tested
commit. Domain contracts, IndexedDB Schema Version 1, migrations, repositories,
official-history transaction boundaries, development seed, guarded reset, and
storage diagnostics satisfy the committed Phase 3 scope.

Phase 3 is not declared passed because the required manual IndexedDB smoke
procedure has not yet been run in either Google Chrome or Microsoft Edge. Those
two browser checks are the only remaining acceptance work. No browser result is
inferred from automated tests or invented in this record.

## Acceptance Metadata

| Item | Result |
|---|---|
| Phase | Phase 3 — Domain Model and Local Persistence |
| Audit date | 31 July 2026 (Asia/Jakarta) |
| Accepted branch | `main` |
| Tested implementation commit | `4d51b2beb4cc99cb44ea0f05005bf8cc4536be6a` |
| Tested upstream | `origin/main` at `4d51b2beb4cc99cb44ea0f05005bf8cc4536be6a` |
| Pre-audit working tree | Clean; `git status --short` produced no entries |
| Automated/source acceptance | **PASS** |
| Manual Chrome smoke test | **PENDING — NOT RUN** |
| Manual Edge smoke test | **PENDING — NOT RUN** |
| Executive result | **PHASE 3 PARTIALLY COMPLETE** |

The audit was run from the clean committed state before this document was
created. `HEAD` and `origin/main` were an exact match. No source, test,
dependency, package, plan, task, project-instruction, README, or earlier
acceptance file was changed for this audit.

## Commit and Worktree Preconditions

| Check | Exit code | Evidence | Result |
|---|---:|---|---|
| `git status --short` | 0 | No output before document creation | PASS |
| `git rev-parse HEAD` | 0 | `4d51b2beb4cc99cb44ea0f05005bf8cc4536be6a` | PASS |
| `git rev-parse origin/main` | 0 | `4d51b2beb4cc99cb44ea0f05005bf8cc4536be6a` | PASS |
| Slice 6 fix ancestry check | 0 | Git confirmed the fix commit follows the original Slice 6 implementation commit | PASS |

Git emitted a Windows-environment warning while reading status:
`unable to access 'C:\Users\User/.config/git/ignore': Permission denied`.
This did not change the exit code, tracked state, untracked state, or clean-tree
result.

## Fresh Automated Verification

All commands below were run against the exact clean committed state identified
above. Results were not copied from an earlier audit.

| Command | Exit code | Exact current result | Acceptance |
|---|---:|---|---|
| `npm.cmd list dexie fake-indexeddb --depth=0` | 0 | `dexie@4.4.4`; `fake-indexeddb@6.2.5` | PASS |
| `npm.cmd run lint` | 0 | ESLint completed without diagnostics | PASS |
| `npm.cmd run typecheck` | 0 | `tsc -b` completed successfully under the committed strict TypeScript configuration | PASS |
| `npm.cmd run test` | 0 | **31 test files passed; 425 tests passed** | PASS |
| `npm.cmd run build` | 0 | TypeScript and Vite build passed; **96 modules transformed** | PASS |
| `git diff --check` | 0 | No whitespace errors or warnings before document creation | PASS |
| `npm.cmd audit` | 1 | One high-severity React Router advisory, `GHSA-qwww-vcr4-c8h2` | ACCEPTED DISPOSITION |
| `npm.cmd audit --omit=dev` | 1 | The same one high-severity React Router advisory; no separate development-only advisory | ACCEPTED DISPOSITION |

The production build reported:

```text
dist/index.html                   0.50 kB │ gzip:   0.30 kB
dist/assets/index-B7dmjLYO.css  100.12 kB │ gzip:  15.77 kB
dist/assets/index-BypoxCZp.js   399.40 kB │ gzip: 115.73 kB
✓ 96 modules transformed.
✓ built in 1.14s
```

The test run reported:

```text
Test Files  31 passed (31)
Tests       425 passed (425)
Duration    46.01s
```

### Command warnings and advisory disposition

The first restricted-environment attempt to run `npm.cmd audit` could not
reach the npm audit endpoint and could not write an npm log under the user npm
cache. It returned exit code 1 without an advisory report. The command was
rerun with registry access; the registry-backed result is the result recorded
in the matrix.

Both registry-backed audit commands reported:

- package: `react-router`;
- installed/locked version: `7.18.2`;
- affected range reported by npm: `7.12.0 - 8.2.0`;
- severity: high;
- advisory: `GHSA-qwww-vcr4-c8h2`;
- npm's proposed forced remediation: install `react-router@7.11.0`, identified
  by npm as a breaking change.

The advisory states that it affects applications using unstable React Server
Components APIs. The committed application is a client-only Vite application:
`src/app/router.tsx` uses `createBrowserRouter`, `src/app/App.tsx` uses
`RouterProvider`, and `vite.config.ts` contains only the React and Tailwind Vite
plugins. The source audit found no React Server Components configuration or
unstable RSC API usage. The advisory is therefore not applicable to the current
Phase 3 deployment architecture and does not block Phase 3 acceptance. It must
be reassessed if RSC APIs are introduced or the router architecture changes.
No forced downgrade, dependency edit, or package-file change was made during
this audit. Advisory reference:
<https://github.com/advisories/GHSA-qwww-vcr4-c8h2>.

Lint, typecheck, tests, and the build emitted no warnings. The build's current
module count is 96; this record does not reuse a different historical count.

## Automated and Source Acceptance Matrix

| Area | Evidence at the tested commit | Result |
|---|---|---|
| Domain contracts and invariants | Strict typed contracts and focused invariant tests cover Events, Participants, prize and draw configuration, sessions and snapshots, winners, redraws, audit records, display configuration, preferences, string tickets, and lifecycle rules | PASS |
| Schema Version 1 and migrations | Exactly ten stores are registered; migration tests cover schema registration, indexes, reopen behavior, and unsupported newer versions | PASS |
| Ticket integrity | Participant tickets are strings; the schema uses unique `&[eventId+ticketNumber]`; automated tests retain leading zeroes through storage and lookup | PASS |
| Repository boundaries | Each Version 1 store has an intentional repository owner; official records avoid generic overwrite paths | PASS |
| Official-history atomicity | Draw history persistence validates relationships and rolls back cross-store work on failure | PASS |
| Winner/redraw history | Winner event, session, category, participant, ticket, candidate membership, and sequence are validated; redraw lineage preserves cancelled original and pending replacement records | PASS |
| Prototype isolation | Automated source tests keep React, routes, pages, UI, and Phase 2 prototype fixtures disconnected from production persistence | PASS |
| Deferred-scope isolation | No production CSV/XLSX import, eligibility evaluator, candidate construction, winner selection, shuffle, BroadcastChannel, export, cloud, authentication, or payment behavior was added | PASS |
| Dependency audit | One RSC-only React Router advisory is present in the installed version but is not applicable to this client-only non-RSC architecture | PASS — accepted disposition |

## Seed, Reset, and Diagnostics

| Capability | Current evidence | Result |
|---|---|---|
| Development seed | Explicit invocation only; deterministic standard data covers all ten stores; tickets retain exact leading zeroes; existing data is refused; the capacity profile uses deterministic IDs, tickets from `"000001"` through `"010000"` at the default 10,000 target, bounded 1,000-record batches, and a single rollback-capable transaction | **PASS** |
| Guarded reset | Requires the exact target database name, explicit permanent-data-loss acknowledgement, and exact `DELETE <database-name>` confirmation text; closes and deletes the named database; normalizes failure; makes no false claim that an audit record inside the deleted database survives reset | **PASS** |
| Storage diagnostics | Uses an isolated temporary database to execute open, schema, write, read, verify, record delete, delete verification, close, and database delete stages; reports the failed stage and attempts cleanup on every failure path | **PASS** |

## Resolved Historical Slice 6 Finding

The original Slice 6 implementation at `ec6c936` had a relationship-validation
defect in its capacity seed path and three negative tests mutated properties
that were not part of the actual snapshot contracts. That historical finding
is resolved by the tested follow-up commit `4d51b2b`.

The fix:

- preserves the capacity Event context while validating every bounded
  participant batch;
- validates the actual `configurationSnapshot` identity and required fields
  against the referenced DrawConfiguration;
- validates the actual `candidateEntries` collection, including exact
  Participant ticket correspondence; and
- requires each WinnerRecord participant ID and exact ticket-number pair to be
  present in the DrawSession candidate snapshot.

The corrected rejection tests mutate the records actually passed to the seed
writer, retain their rejection assertions, and prove all ten Version 1 stores
remain empty after each failed validation. The fresh full suite passes with 31
test files and 425 tests.

## Manual Chrome and Edge IndexedDB Smoke Procedure

### Status

This procedure is executable but was **not run** during this audit. Run it
independently in current stable Google Chrome and Microsoft Edge, record each
browser's exact version, and do not change the status to PASS without observing
every assertion and cleanup check.

Use a development-only browser profile if possible. The procedure intentionally
creates and finally deletes `RaffleOS_Smoke_Test`. It does not use
`RaffleOS_DB`.

### 1. Start the committed application

From the repository root:

```powershell
npm.cmd run dev
```

Open the local URL printed by Vite in the browser under test. Open Developer
Tools, select **Console**, and keep that application tab as the only tab using
the smoke database.

### 2. Import the real modules, create the database, and seed the standard profile

Paste and run this complete block:

```js
const DB_NAME = 'RaffleOS_Smoke_Test'
const HISTORY_EVENT_ID = '22222222-2222-4222-8222-222222222222'
const DRAFT_EVENT_ID = '11111111-1111-4111-8111-111111111111'
const SEEDED_PARTICIPANT_ID =
  '66666666-6666-4666-8666-000000000001'
const SEEDED_TICKET = '000001'

const dbModule = await import(
  '/src/infrastructure/persistence/db.ts'
)
const seedModule = await import(
  '/src/infrastructure/persistence/seed/dev-seed.ts'
)

const { RaffleOSDatabase } = dbModule
const { seedDevelopmentDatabase } = seedModule

const smokeDb = new RaffleOSDatabase(DB_NAME)
await smokeDb.openSupported()
console.assert(smokeDb.isOpen(), 'Smoke database did not open')
console.assert(smokeDb.name === DB_NAME, 'Wrong database opened')

const seedResult = await seedDevelopmentDatabase({
  database: smokeDb,
  profile: 'standard',
})
console.table(seedResult.counts)
console.assert(seedResult.profile === 'standard')
console.assert(seedResult.counts.events === 2)
console.assert(seedResult.counts.participants === 20)
console.assert(seedResult.counts.prize_categories === 2)
console.assert(seedResult.counts.draw_configurations === 1)
console.assert(seedResult.counts.display_configurations === 2)
console.assert(seedResult.counts.draw_sessions === 1)
console.assert(seedResult.counts.winner_records === 3)
console.assert(seedResult.counts.redraw_records === 1)
console.assert(seedResult.counts.audit_records === 2)
console.assert(seedResult.counts.preferences === 2)

const seededParticipant = await smokeDb.participants.get(
  SEEDED_PARTICIPANT_ID,
)
console.log(seededParticipant)
console.assert(
  seededParticipant?.id === SEEDED_PARTICIPANT_ID,
  'Actual seeded Participant ID was not found',
)
console.assert(
  seededParticipant?.eventId === HISTORY_EVENT_ID,
  'Seeded Participant belongs to the wrong Event',
)
console.assert(
  seededParticipant?.ticketNumber === SEEDED_TICKET,
  'Leading-zero ticket changed',
)
console.assert(
  typeof seededParticipant?.ticketNumber === 'string',
  'Ticket is not a string',
)
```

The fixture contains participants 1 through 20. The command deliberately uses
the real first fixture record and ticket `"000001"`.

### 3. Close, reload, and re-import

Run:

```js
smokeDb.close()
location.reload()
```

After the page has reloaded, open the Console again and run this new block. A
reload creates a new JavaScript context, so the modules and database handle are
intentionally imported and created again:

```js
const DB_NAME = 'RaffleOS_Smoke_Test'
const HISTORY_EVENT_ID = '22222222-2222-4222-8222-222222222222'
const DRAFT_EVENT_ID = '11111111-1111-4111-8111-111111111111'
const SEEDED_PARTICIPANT_ID =
  '66666666-6666-4666-8666-000000000001'
const SEEDED_TICKET = '000001'

const dbModule = await import(
  '/src/infrastructure/persistence/db.ts'
)
const seedModule = await import(
  '/src/infrastructure/persistence/seed/dev-seed.ts'
)
const diagnosticModule = await import(
  '/src/infrastructure/persistence/diagnostics/storage-diagnostics.ts'
)
const resetModule = await import(
  '/src/infrastructure/persistence/seed/reset-db.ts'
)

const { RaffleOSDatabase } = dbModule
const { seedDevelopmentDatabase } = seedModule
const { runStorageCapabilityDiagnostic } = diagnosticModule
const { resetDatabase } = resetModule
console.assert(typeof seedDevelopmentDatabase === 'function')

const smokeDb = new RaffleOSDatabase(DB_NAME)
await smokeDb.openSupported()
console.assert(smokeDb.isOpen(), 'Reopened database is not open')

const reopenedParticipant = await smokeDb.participants.get(
  SEEDED_PARTICIPANT_ID,
)
console.assert(
  reopenedParticipant?.ticketNumber === SEEDED_TICKET,
  'Seeded record did not survive reload/reopen with leading zeroes',
)
```

### 4. Verify the compound Event-and-ticket lookup

Continue in the same reloaded Console:

```js
const compoundLookup = await smokeDb.participants
  .where('[eventId+ticketNumber]')
  .equals([HISTORY_EVENT_ID, SEEDED_TICKET])
  .first()

console.log(compoundLookup)
console.assert(
  compoundLookup?.id === SEEDED_PARTICIPANT_ID,
  'Compound [eventId+ticketNumber] lookup failed',
)
console.assert(
  compoundLookup?.ticketNumber === '000001',
  'Compound lookup lost leading zeroes',
)
```

### 5. Prove event-scoped ticket uniqueness

The standard fixture already contains the draft Event and the history Event.
Insert ticket `"000001"` into the draft Event, where that ticket does not yet
exist:

```js
const smokeTimestamp = new Date().toISOString()
const crossEventParticipant = {
  id: crypto.randomUUID(),
  eventId: DRAFT_EVENT_ID,
  ticketNumber: SEEDED_TICKET,
  name: 'Cross-event smoke participant',
  isCheckedIn: false,
  group: 'Smoke',
  notes: undefined,
  createdAt: smokeTimestamp,
  updatedAt: smokeTimestamp,
}

await smokeDb.participants.add(crossEventParticipant)

const crossEventLookup = await smokeDb.participants
  .where('[eventId+ticketNumber]')
  .equals([DRAFT_EVENT_ID, SEEDED_TICKET])
  .first()

console.assert(
  crossEventLookup?.id === crossEventParticipant.id,
  'The same ticket was not accepted in another Event',
)
console.assert(crossEventLookup?.ticketNumber === '000001')
```

Now attempt a duplicate in that same draft Event. The unique compound index must
reject it:

```js
let duplicateError
try {
  await smokeDb.participants.add({
    ...crossEventParticipant,
    id: crypto.randomUUID(),
    name: 'Same-event duplicate smoke participant',
  })
} catch (error) {
  duplicateError = error
  console.log('Expected duplicate rejection:', error)
}

console.assert(
  duplicateError?.name === 'ConstraintError',
  'Same-event duplicate ticket was not rejected with ConstraintError',
)
console.assert(
  await smokeDb.participants
    .where('[eventId+ticketNumber]')
    .equals([DRAFT_EVENT_ID, SEEDED_TICKET])
    .count() === 1,
  'Duplicate attempt changed the same-event ticket count',
)
```

### 6. Run the storage diagnostic and prove temporary cleanup

Use a deterministic diagnostic database name so cleanup can be inspected:

```js
const DIAGNOSTIC_DB_NAME = 'RaffleOS_Smoke_Diagnostic'
const diagnosticResult = await runStorageCapabilityDiagnostic({
  databaseName: DIAGNOSTIC_DB_NAME,
})

console.log(diagnosticResult)
console.assert(
  diagnosticResult.success === true,
  'Storage diagnostic failed',
)
console.assert(
  diagnosticResult.cleanupSucceeded === true,
  'Storage diagnostic cleanup failed',
)

const databasesAfterDiagnostic = await indexedDB.databases()
console.table(databasesAfterDiagnostic)
console.assert(
  !databasesAfterDiagnostic.some(
    (database) => database.name === DIAGNOSTIC_DB_NAME,
  ),
  'Temporary diagnostic database still exists',
)
console.assert(
  databasesAfterDiagnostic.some(
    (database) => database.name === DB_NAME,
  ),
  'Smoke database disappeared before guarded reset',
)
```

### 7. Run the guarded reset and prove database cleanup

The reset confirmation text is intentionally exact:

```js
const resetResult = await resetDatabase({
  database: smokeDb,
  confirmation: {
    databaseName: 'RaffleOS_Smoke_Test',
    acknowledgePermanentDataLoss: true,
    confirmationText: 'DELETE RaffleOS_Smoke_Test',
  },
})

console.log(resetResult)
console.assert(resetResult.status === 'deleted')
console.assert(resetResult.databaseName === 'RaffleOS_Smoke_Test')

const databasesAfterReset = await indexedDB.databases()
console.table(databasesAfterReset)
console.assert(
  !databasesAfterReset.some(
    (database) => database.name === 'RaffleOS_Smoke_Test',
  ),
  'Guarded reset did not delete RaffleOS_Smoke_Test',
)
console.assert(
  !databasesAfterReset.some(
    (database) => database.name === 'RaffleOS_Smoke_Diagnostic',
  ),
  'Diagnostic database was not cleaned up',
)
```

### 8. Record manual evidence

Complete this table only after running the full procedure independently in each
browser:

| Browser | Exact version | Open/seed | Reload/reopen and `"000001"` | Compound lookup | Cross-event allowed | Same-event duplicate rejected | Diagnostic cleanup | Guarded reset cleanup | Result |
|---|---|---|---|---|---|---|---|---|---|
| Google Chrome | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | **NOT RUN** |
| Microsoft Edge | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | **NOT RUN** |

## Remaining Acceptance Work

Only these checks remain:

1. Run the complete procedure above in Google Chrome and record the exact
   browser version and observed results.
2. Run the complete procedure above in Microsoft Edge and record the exact
   browser version and observed results.
3. Change the executive result to **PHASE 3 PASSED** only after both rows are
   supported by observed PASS evidence.

Until then, the correct status remains **PHASE 3 PARTIALLY COMPLETE**.
