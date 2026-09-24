# Phase 10 Slice 10.1 — Recovery contracts

## Audit findings

The accepted baseline has DrawSession statuses `draft`, `ready`, `drawing`, `pending-confirmation`, `completed`, and `cancelled`. WinnerRecords are `pending`, `confirmed`, or `cancelled`; redraw lineage is append-only through RedrawRecord. Command receipts distinguish `started`, `committed`, `failed`, and `unknown`, and reconciliation exposes missing, committed, in-progress, and conflict outcomes. Presentation checkpoints are versioned, session-keyed, presentation-only records containing stage, timing, blackout intent, and policy/format versions.

Official state is authoritative. A checkpoint is never evidence that selection occurred. A matching checkpoint without WinnerRecords is a presentation interruption; a persisted WinnerRecord set is recovered by identity, ticket string, status, session snapshots, and redraw records. Terminal sessions are returned read-only.

`interrupted` is rejected for this slice. The existing `drawing` state plus the typed `safe-acknowledgement-required` decision distinguishes selection outcome unknown from presentation interruption and from persisted selection. Adding a persisted status would add migration and transition surface without improving safety: the absence or presence of persisted WinnerRecords is the authoritative distinction, while unresolved receipts are handled explicitly before interpretation.

## Contract

`decideRecovery` in `src/application/workflow/recovery-contract.ts` is a pure read decision. It does not receive a selector or persistence writer, creates no records, and returns the exact session, WinnerRecords, RedrawRecords, snapshots, ticket strings, and receipt/checkpoint observations needed by later recovery slices.

Receipt resolution gives committed records precedence, unresolved records an explicit acknowledgement decision, and failed-only records a not-committed result. Checkpoint mismatch, unsupported, or corrupt observations cannot override official records.

## Boundary

This slice adds no UI, startup routing, storage health UI, Audience transport, randomization, or schema migration. Later slices may adapt repositories to provide `RecoveryContractInput` and route the returned decision.
