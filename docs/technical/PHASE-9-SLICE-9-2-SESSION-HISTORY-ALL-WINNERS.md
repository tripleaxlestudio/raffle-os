# Phase 9 Slice 9.2 — Session History and All Winners

This slice refines the production History experience around the authoritative Slice 9.1 reconstruction projection. It is read-only and does not change persistence or draw behavior.

## Routes

- `/history` — event-scoped Session History.
- `/history/:drawSessionId` — Session Detail for one persisted official Live session.
- `/history/winners` — event-scoped All Winners view.

The existing operator sidebar remains unchanged. History links to All Winners locally, and All Winners links back to Session History.

## Read-model consumption

`reconstructOfficialHistoryForEvent` is the single event-scoped read boundary. It filters persisted sessions to the selected Event and `mode: 'live'`, then calls `reconstructOfficialHistorySession` for each session. The three views consume only those complete/incomplete projections; React does not join stores or infer redraw relationships.

## Views

Session History shows draw timestamp, category, prize, requested count, Confirmed/Pending/Cancelled counts, completion time, Live mode, status, incomplete-record warning, and a detail/review action.

Session Detail shows Event, session ID, mode, category, prize, draw/completion timestamps, status, eligible-pool count, requested count, and every retained WinnerRecord with sequence, exact ticket, lifecycle timestamps, status, and original-to-replacement context.

All Winners flattens reconstructed WinnerRecords across the selected Event’s official Live sessions and shows exact ticket, status, category, prize, originating session, sequence, draw timestamp, confirmation/cancellation timestamps, and lineage. Cancelled originals remain separate from replacements. Pending records are explicitly labelled Pending.

## Semantics and safety

Official History is Live-only. Practice results are not reconstructed, persisted, or presented as official history. Incomplete reconstruction is rendered with a clear operator warning while surviving evidence remains visible; missing relationships are shown as unavailable rather than fabricated. These routes perform reads only and do not create or modify DrawSessions, WinnerRecords, RedrawRecords, AuditRecords, Event scope, eligibility, or Audience state.

## Tests

Focused coverage includes event-scoped Live filtering and stable ordering, exact `00042`/`42` identity, session metadata, retained cancelled and pending records, replacement lineage, incomplete reconstruction warnings, and All Winners aggregation. Existing Slice 9.1 reconstruction tests remain in the suite.

## Deferred

Slice 9.3 filters/search/audit timeline work, export, reopening, and broader Phase 9 policy work remain intentionally deferred. Phase 9 is not marked accepted.
