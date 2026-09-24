# Phase 9 Acceptance

## Final status

**PHASE 9 ACCEPTED**

Accepted baseline: `89b0962f66af351d6b40a897a4800e9bf5345603`

Phase 9 is accepted on the basis of the implementation in the accepted
baseline, the automated verification below, and the owner/manual evidence
accumulated during Slices 9.1 through 9.6. No additional manual acceptance
round is required for Slice 9.7.

## Final verification

| Verification | Result |
|---|---|
| `npm run test` | PASS — 130 test files, 1,101 tests |
| Focused Phase 9 regression | PASS — 11 test files, 63 tests |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS; Git reported only normal LF/CRLF normalization warnings |

The host PowerShell execution policy blocks `npm.ps1`; each npm script was
run through `npm.cmd`, invoking the same package scripts without changing
the project or its dependencies.

Focused coverage includes history reconstruction, Session History, Session
Detail, All Winners, filters/search, Audit Timeline, redraw lineage, exact
ticket strings, retained Audience state, History Show/Hide behavior, official
record immutability, CSV/XLSX export, and leading-zero preservation.

## Phase 9 requirement traceability

| Requirement | Status | Evidence |
|---|---|---|
| FR-HIS-001 | PASS | Reconstructed Live session read model exposes session, category/prize, timestamps, mode, eligible count, winner count, ticket strings, and confirmation state; incomplete relationships fail safely. |
| FR-HIS-002 | PASS | Cancellation/redraw projections retain reason, note, original and replacement records, lineage, and timestamps. |
| FR-HIS-003 | PASS | Terminal official records are append-only/immutable at the production boundary; History, reopen, Show/Hide, filtering, audit, and export paths are read-only. |
| FR-HIS-004 | PASS | Session Detail, All Winners, and the chronological Audit Timeline retain draw order, confirmation, cancellation, replacement, actor, reason, note, and timestamps. |
| FR-HIS-005 | PASS | Event-scoped confirmed-result CSV and XLSX exports use the documented deterministic schema and ordering. |
| FR-HIS-006 | PASS | Ticket identifiers remain strings end-to-end; `42` and `00042` remain distinct in History, Audience projections, CSV, and XLSX text cells. |
| AC-HIS-001 | PASS | Integrated reconstruction, History, All Winners, filters/search, timeline, lineage, and exact-ticket tests pass. |
| AC-HIS-002 | PASS | Repository rejection, append-only, terminal immutability, read-only reconstruction, and no-side-effect Audience/export tests pass. |
| AC-HIS-003 | PASS | CSV/XLSX tests prove confirmed-only inclusion, pending/cancelled exclusion, redraw replacement inclusion, exact strings, and cross-format projection reconciliation. |

## Confirmed-result export contract

- Official History and exports are Live-only. Practice is labelled rehearsal and
  is not an official record or export source.
- CSV and XLSX include Confirmed winners only.
- Pending winners and cancelled originals are excluded.
- Confirmed redraw replacements are included as confirmed winner records.
- Exact ticket strings, including leading zeroes such as `00042`, are preserved.
- XLSX ticket cells are explicitly text cells.
- CSV and XLSX are generated from the same confirmed-result projection and
  reconcile one-to-one.
- Export filenames use local device calendar time. XLSX metadata may retain its
  export timestamp as UTC ISO.
- Export is read-only and does not mutate Event, History, Audience, or audit
  state.

## Owner/manual evidence accumulated during Phase 9

The following evidence was completed during implementation and is accepted as
sufficient for closeout:

- History UI was reviewed in production.
- Session Show works against a persistent Audience Display.
- Sequential Show A -> B updates Audience in real time.
- An active historical result can be Hidden.
- Hide returns Audience to Standby without refresh.
- The export dropdown UI was manually reviewed and fixed.
- CSV export was manually generated and inspected.
- XLSX export was manually generated and inspected.
- Exact leading-zero tickets such as `00042` were verified.
- Filename local-time refinement was completed.
- CSV/XLSX projection reconciliation is covered by automated tests.

## Scope boundary

Phase 9 closes History reconstruction, Session History, Session Detail, All
Winners, filters/search, Audit Timeline, Live-only official semantics,
read-only completed-result Show/Hide, official-record immutability evidence,
and confirmed CSV/XLSX export.

No Phase 10 or Phase 11 features were added. Interrupted-session recovery,
backup/restore, accessibility hardening, performance/release hardening, and
other later-phase work remain deferred to their own approved plans.
