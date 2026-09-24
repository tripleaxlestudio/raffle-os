# Phase 9 Slice 9.3 — History Filters, Search, and Audit Timeline

## Scope

This slice adds read-only query helpers, URL-backed filters/search, and a typed chronological audit projection to the existing event-scoped official History read model. Slice 9.4 and later work is deferred.

## Official History semantics

History is Live-only. Practice records are excluded at `reconstructOfficialHistoryForEvent`; the UI shows a fixed `Official Live only` indicator and has no Practice selector. A legacy `mode` query parameter is ignored safely.

Filters are status, category ID, draw date (`from` inclusive and `to` inclusive by calendar date), and search. They compose with AND semantics and never mutate reconstructed records.

## Query contract

The stable parameters are:

| Parameter | Meaning |
|---|---|
| `q` | Search text; exact ticket-string matching plus case-insensitive category, prize, session ID, and event text matching |
| `status` | One persisted session status; absent/invalid means all |
| `category` | Persisted PrizeCategory ID |
| `from` / `to` | ISO calendar dates; invalid values are ignored |

Parameters serialize in `q`, `status`, `category`, `from`, `to` order. Reset clears them. URL state is not domain persistence and therefore has no official write side effects.

Ticket values remain strings: `00042` matches `00042`, not `42`. All Winners uses the same event-scoped query state.

## Audit projection

`projectAuditTimeline` converts persisted records into typed display entries. Supported persisted actions are `draw-session-started`, `draw-session-completed`, `draw-session-cancelled`, `winner-confirmed`, `winner-cancelled`, and `redraw-recorded`. Event/import records are not session timeline entries. Unknown valid/future records are retained as `Unknown audit action` with their ID and timestamp.

The projection resolves ticket and redraw relationships only from reconstructed winners/lineages. Missing relationships remain null/unavailable. Operator names, reasons, `normalizedNote`, resulting status, and original-to-replacement tickets are retained where persisted.

Timeline order is ascending timestamp, then lexicographic AuditRecord ID. This is independent of IndexedDB iteration order.

## Incomplete and read-only behavior

The Slice 9.2 incomplete reconstruction warning remains visible. Filtering, search, and projection do not create or update sessions, winners, redraws, audits, eligibility, or audience state.

## Tests

Focused coverage includes exact `00042` versus `42`, composed filters, invalid URL values, stable serialization, equal-timestamp audit ordering, actor/reason/note/redraw context, and unknown-action fallback. Existing reconstruction, History table/detail, redraw-lineage, exact-ticket, Practice exclusion, and incomplete-record tests remain in the suite.
