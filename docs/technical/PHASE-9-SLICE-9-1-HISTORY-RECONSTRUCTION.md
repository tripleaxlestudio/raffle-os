# Phase 9 Slice 9.1 — History Reconstruction

This slice adds the authoritative read-oriented reconstruction contract for persisted DrawSession history. It does not add new persistence tables, migrations, commands, or History UI.

## Contract

`reconstructOfficialHistorySession(drawSessionId, repositories)` reads one DrawSession and relates its Event, DrawConfiguration, PrizeCategory, immutable configuration and candidate-pool snapshots, WinnerRecords, RedrawRecords, and Event AuditRecords. The result is either `complete` or `incomplete`; a missing session returns `null`.

The projection exposes a session summary, all winners, all redraw records, reconstructed original-to-replacement lineages, and deterministically ordered audits. Winner status is preserved exactly, including pending and cancelled records. A cancelled original is never replaced or removed from the collection.

## Relationship and ordering rules

The configuration snapshot is the persisted source for category/prize names, requested winner count, and the candidate-pool snapshot is the source for the eligible count. Current configuration/category records are read to validate ownership and snapshot consistency. Sessions are identified by their persisted ID; winners are ordered by authoritative `sequenceNumber`, then WinnerRecord ID. Redraws are ordered by `createdAt`, then RedrawRecord ID. Audits are ordered by timestamp, then AuditRecord ID. No IndexedDB iteration order is used.

Ticket numbers are carried as `TicketNumber` strings from persistence to the projection. No numeric conversion, parsing, normalization, or numeric comparison occurs, so `00042` and `42` remain distinct.

## Incomplete/corrupt data

The service does not invent missing records. It preserves trustworthy records and returns `kind: 'incomplete'` with typed issue codes for missing Event, configuration/category, WinnerRecord, broken ownership, inconsistent snapshots, missing redraw endpoints, or malformed lineage. A redraw is only exposed as a lineage when its original and replacement are present, belong to the session/event, the original is persisted as cancelled, and the endpoints differ.

## Read-only guarantee

The service depends only on `findById`, `findByDrawSessionId`, and `findByEventId` repository capabilities. It does not create or mutate sessions, winners, audits, redraws, eligibility, events, or display state.

## Tests and limitations

Focused tests cover complete reconstruction, mixed confirmed/pending/cancelled states, redraw traceability, exact ticket identity, deterministic tie-breaking, missing relationships, and the read-only boundary. Broader History consumers, visual audit timeline, reopening, export, and immutability hardening remain deferred to later Phase 9 slices.
