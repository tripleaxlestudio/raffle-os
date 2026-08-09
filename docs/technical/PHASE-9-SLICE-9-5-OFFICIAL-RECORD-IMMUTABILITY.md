# Phase 9 Slice 9.5 — Official Record Immutability

Status: implementation complete for Slice 9.5 only. Phase 9 is not accepted.

## Audit findings

The Phase 8 persistence baseline already provides the principal integrity controls:

- `DrawSessionRepository` creates snapshot-free drafts and exposes only explicit snapshot attachment and lifecycle transitions. Snapshot attachment is one-way, and lifecycle transitions are checked against the domain transition table.
- `WinnerRepository` appends only pending records, rejects conflicting IDs, sequences, participants, and tickets, and permits only domain-valid status transitions. Confirmed/cancelled records are retained.
- `RedrawRepository` appends records only after validating both winners and their relationships. One original winner can have only one direct redraw record.
- `AuditRepository` is append-only. IndexedDB uniqueness is normalized to the typed `DuplicateRecordError`.
- Command receipts retain their existing create/finalize/reconcile idempotency behavior.
- No normal production repository for official history exposes `delete`, `remove`, `put`, or arbitrary update operations. Maintenance/fixture code may use the database directly, but it is not an application boundary.
- Presentation checkpoints are separate operational state and are not official history records.

No schema migration or production dependency was required. No integrity gap requiring a persistence redesign was found.

## Policy

Official evidence is append-only except for explicitly supported lifecycle transitions:

- A DrawSession may progress through its valid pre-terminal lifecycle transitions. Once terminal (`completed` or `cancelled`), it cannot be arbitrarily replaced or reopened.
- Pending WinnerRecords may transition through confirmation or cancellation. Confirmed and Cancelled records remain retained evidence and cannot be rewritten or deleted through production repositories.
- A RedrawRecord is an append-only original-to-replacement relationship. A second conflicting direct relationship for the same original is rejected; the original and replacement remain traceable.
- AuditRecords are append-only. Existing IDs/content cannot be replaced, and no normal application repository deletes audit evidence.
- Command receipt semantics are unchanged.

Invalid writes fail explicitly with typed persistence/domain errors, including `ImmutableRecordError`, `DuplicateRecordError`, `RelationshipMismatchError`, `ValidationError`, and `RecordNotFoundError` as appropriate.

## Read boundaries

The History reconstruction boundary consumes named read-only repository contracts (`DrawSessionReadRepository`, `WinnerReadRepository`, `RedrawReadRepository`, and `AuditReadRepository`). History reconstruction, session detail, All Winners, filtering/search, and Audit Timeline receive query capabilities only; they do not receive a mutable database handle or write-capable repository through the application contract.

Read reconstruction preserves surviving records and returns a typed `complete` or `incomplete` result. Missing parents, winners, or malformed lineage become issues in the incomplete result. Reconstruction never repairs, fabricates, overwrites, or deletes records.

## Audience separation

Show/Hide Audience actions publish or retain presentation state through the display transport. They do not call official history repositories, create AuditRecords, or alter eligibility, draw queues, DrawSessions, WinnerRecords, RedrawRecords, or AuditRecords. Returning the Audience to Standby is presentation-only.

## Verification

Focused coverage verifies duplicate/conflicting official writes, lifecycle transitions, retained cancelled winners, redraw lineage rejection, append-only audit behavior, absent production delete/update methods, read-only History contracts, incomplete reconstruction, and sequential Audience result/Standby behavior. Existing Phase 8 lifecycle, confirmation, cancellation, redraw, command receipt, and Slice 9.1–9.4 tests remain part of the regression suite.

## Deferred

CSV/XLSX export, export controls, filenames, and worksheet schemas remain deferred to Slice 9.6 and were not implemented here.
