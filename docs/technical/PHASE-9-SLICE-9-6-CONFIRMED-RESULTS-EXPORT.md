# Phase 9 Slice 9.6 — Confirmed Results Export

Status: implementation complete; manual owner review remains required. Phase 9 is not accepted by this document.

## Contract

The application builds one deterministic, read-only projection from the selected Event's reconstructed History boundary. It includes Live `WinnerRecord`s with `confirmed` status only. Pending records and cancelled originals remain in History/Audit but are excluded. A confirmed redraw replacement is included as its own confirmed record, retaining the persisted session, category, prize, participant, and timestamps.

Columns are emitted in this exact order in both formats:

`event_id`, `event_name`, `draw_session_id`, `draw_timestamp`, `confirmed_at`, `mode`, `category_id`, `category_name`, `prize_name`, `winner_record_id`, `sequence_number`, `participant_id`, `ticket_number`, `participant_display_name`.

Rows are ordered by persisted `confirmedAt`, then DrawSession `createdAt`, then winner sequence, then WinnerRecord ID. IDs provide stable tie-breaking. Persisted timestamps are not regenerated. Missing participant display names are emitted as empty text.

## Formats

CSV uses a fixed header, CRLF row endings, RFC-style quote escaping, Unicode text, and header-only output when there are zero confirmed results. All values are serialized as text; ticket values such as `00042` are never parsed or numerically sorted.

XLSX uses the approved SheetJS CE 0.20.3 dependency. `Confirmed Results` contains the same header and rows as CSV. `ticket_number` cells are explicitly written with SheetJS string type (`t: 's'`). `Metadata` contains Event ID, Event name, export timestamp, schema version, and confirmed row count. Empty exports retain both worksheets and contain no fabricated result rows.

Filenames are `<sanitized-event-name>-confirmed-results-YYYYMMDDHHmm.<csv|xlsx>`, using the actual export timestamp in ISO form and replacing Windows-invalid characters with hyphens. The Event record is not modified.

## UI and safety

Production History exposes one compact Event-scoped Export control beside Open Draw Sessions and All Winners. The menu reports the confirmed row count and offers CSV/XLSX. Generation and download are read-only: no IndexedDB writes, audit records, Audience messages, or domain mutations are performed. Failures remain in the page as actionable retryable status.

## Verification

Focused tests cover confirmed-only projection, multi-session ordering, cancellation/redraw filtering, exact `42` versus `00042` identity, participant display names, CSV escaping and empty output, XLSX worksheet/column contract, text-cell ticket round-trip, and filename policy. The full Phase 9.1–9.5 and Phase 8 suites remain regression requirements.

Manual XLSX opening with real seeded `00042` and `42` data is intentionally deferred to owner review before Slice 9.7. No Slice 9.7 acceptance or closeout work is included.
