# Phase 9 — History, Audit, and Export

Status: **Plan for review and approval**
Baseline branch: `phase8/slice-14d-subsequent-draw-lifecycle`
Baseline commit: `0e1185e86a9489eb4c8ebb2ccba9fc48971d0974`
Baseline decision: **Phase 8 formally accepted**

## 1. Phase 9 objective

Deliver the authoritative, read-oriented History, Audit, and Export layer on
top of the production lifecycle completed in Phase 8. An operator must be able
to reconstruct a completed draw from local records, inspect every material
state change in chronological order, follow cancellation and replacement
lineage, reopen an already-completed public result without drawing again, and
export the final confirmed results without changing ticket identity.

This phase completes the official-record read model and export boundary. It
does not introduce a new draw algorithm, change eligibility rules, or make the
Audience Display an authority for result generation.

## 2. Current baseline audit

### 2.1 Baseline evidence

The audit is against the accepted commit above, not the older Phase 8 audit
documents. `PHASE-8-ACCEPTANCE.md` records passing automated verification and
owner-confirmed Chrome/Edge validation, and explicitly leaves CSV/XLSX export
for Phase 9. Backup/restore is conditional P2 and is not implemented.

The repository already has the production persistence stores and repositories
for `draw_sessions`, `winner_records`, `redraw_records`, and `audit_records`,
with forward-only schema migrations. Phase 8 writes official Live lifecycle
records transactionally and retains cancelled originals.

### 2.2 Requirements already implemented

The following Phase 9 requirements are materially present and must be
preserved rather than reimplemented as if History were empty:

- DrawSession, WinnerRecord, RedrawRecord, and AuditRecord are persisted in
  IndexedDB and related by event/session/winner identifiers.
- Live sessions retain category/prize/configuration snapshots, mode, timestamps,
  candidate-pool snapshot, status, and winner records with string ticket numbers.
- Confirmation, cancellation, and redraw operations append audit records and
  retain the original WinnerRecord as `cancelled`.
- Redraw records explicitly link `originalWinnerRecordId` to
  `replacementWinnerRecordId` and store a typed reason, optional note, and
  timestamp.
- The production History route (`/history`) lists persisted Live sessions and
  `/history/:drawSessionId` reads a selected session.
- The current History read model joins session, event, category, winners,
  redraws, and related audit records; it exposes cancelled originals and direct
  replacement information.
- Current UI displays session status, winner counts, confirmed/cancelled
  counts, draw/completion timestamps, mode/status badges, cancellation reason,
  redraw reason, and original-to-replacement ticket lineage.
- Current UI has status filtering and a mode filter boundary, and synchronizes
  those filters into query parameters.
- Official persistence rejects duplicate/invalid writes and uses explicit
  state-transition validation. Redraw persistence is append-only per original
  winner, and command receipts provide idempotency protection.
- Eligibility and redraw tests already cover confirmed-winner exclusion,
  pending-in-flight exclusion, cancelled-winner behavior, exact ticket
  strings, replacement selection, and lifecycle persistence.

These capabilities are Phase 8 foundations. Phase 9 may refine their read
models and presentation, but must not weaken their transactional invariants.

### 2.3 Partial requirements

- **Draw-session history:** present for the selected Event and Live sessions,
  but not yet a complete history product. The list is coupled to the current
  page loader and does not provide the finalized cross-view query/read model.
- **History filters:** status and mode controls exist, but mode currently only
  exposes Live records because Practice is intentionally not persisted as
  official history. Final semantics must distinguish official Live history
  from rehearsal/non-official Practice history without implying Practice is an
  official result.
- **Cancellation reasons:** reasons and notes are persisted and shown for
  cancellation/redraw records, but there is no dedicated audit timeline that
  presents every event in one chronological sequence.
- **Original/replacement lineage:** direct one-step lineage is available in the
  read model and UI. Phase 9 must make the relationship complete, deterministic,
  and usable in all-winners, detail, audit, and export reconciliation views.
- **Official-record immutability:** repository and transaction guards exist,
  but Phase 9 needs an explicit read/write policy, user-facing safe failure
  behavior, and dedicated tests proving that history reads, reopening, and
  export cannot mutate or silently replace official records.
- **Final-result reconstruction:** the current read model can assemble a
  session-level view, but there is no formal reconstruction service/contract
  with completeness validation and dedicated tests for missing or inconsistent
  relationships.

### 2.4 Missing requirements

- All-winners view across the selected Event, with confirmed/cancelled status
  and session/category context.
- Chronological audit timeline covering draw start/completion/cancellation,
  winner confirmation/cancellation, redraw, and relevant actor/reason metadata.
- Search over the finalized history fields, including exact ticket-string
  matching and appropriate category/prize/session/event text.
- A clear, tested Practice/Live history policy and UI distinction. Practice
  must remain non-official and must not contaminate Live history or eligibility.
- Reopening a completed public result on the Audience Display by persisted
  session/result identifier, without invoking draw selection or creating a new
  DrawSession/WinnerRecord/AuditRecord.
- Final CSV schema and XLSX worksheet/schema documentation and implementation.
- Confirmed-results CSV export.
- Confirmed-results XLSX export.
- Round-trip tests proving `00042` remains `00042` in stored read models and
  both export formats, including spreadsheet cell typing/format behavior.
- Dedicated reconstruction, export pending-exclusion, redraw traceability,
  and official immutability tests required by the Phase 9 roadmap.

## 3. Scope

### In scope

- A domain/application read model for authoritative event history.
- Draw-session history list and detail views using persisted records.
- All-winners view, including confirmed winners and retained cancelled
  originals, with session/category/mode/status context.
- Chronological audit timeline with stable ordering by timestamp and ID,
  readable action labels, actor, reason/note, affected ticket(s), and lineage
  references.
- History filters and search with URL/state semantics defined in the plan's
  implementation slices.
- Explicit Practice/Live labeling and filtering policy.
- Public-result reopening for completed Live results on Audience Display,
  read-only and keyed by an existing DrawSession/result projection.
- Official-record immutability behavior and safe error handling.
- Final export schema decision and documentation.
- Confirmed-results CSV and XLSX export using the already approved `xlsx`
  dependency; no new production dependency is expected.
- Tests and manual acceptance for reconstruction, filtering/search, timeline,
  public reopening, export, leading zeroes, pending exclusion, lineage, and
  immutability.

### Non-goals

- No new selection algorithm, random source, eligibility rule, or redraw rule.
- No change to Phase 8 confirmation/cancellation/redraw command semantics except
  defects discovered while exposing their already-persisted evidence.
- No backend, cloud database, authentication, online registration, or remote
  audit service.
- No backup/restore, autosave feedback, interrupted-session operational
  recovery, storage-capacity diagnostics, or broader recovery safety work;
  those belong to Phase 10. Reopening an already completed public result is a
  history/read-model capability, not interrupted-session recovery.
- No accessibility, performance, browser compatibility, release cleanup, or
  large-dataset hardening program; those belong to Phase 11. Phase 9 still
  requires ordinary regression-safe semantics and accessible labels for new
  controls.
- No backup/restore implementation; it remains conditional P2 pending explicit
  approval.
- No legal certification or claim of external audit compliance.

## 4. Requirement traceability

### 4.1 TASKS.md mapping

| `TASKS.md` item | Phase 9 disposition | Planned evidence |
|---|---|---|
| Build draw-session history | Complete/refine | Reconstruction read model, list/detail UI, component and integration tests |
| Build an all-winners view | Implement | Event-scoped all-winners query/view and status/lineage tests |
| Build a chronological audit timeline | Implement | Stable audit projection, ordering tests, manual timeline review |
| Add history filters | Partial → complete | Status/mode/session/category/date/result filters with query-state tests |
| Add history search | Missing → implement | Exact ticket-string and text search tests |
| Distinguish Practice and Live records | Partial boundary → complete | Explicit non-official Practice policy, UI labels, isolation tests |
| Show cancellation reasons | Partial → complete | Timeline/detail/all-winners reason and note assertions |
| Show original-to-replacement relationships | Partial → complete | Lineage projection and multi-redraw traceability tests |
| Reopen completed public results without a new draw | Missing → implement | Audience route/projection test proving zero new commands/records |
| Prevent silent official overwrite/deletion | Partial guards → complete evidence | Repository rejection, append-only, export/reopen non-mutation tests |
| Decide/document export columns and worksheets | Missing → implement | This plan plus final schema section in implementation docs/tests |
| Export Confirmed results to CSV | Missing → implement | Byte/content and CSV parse tests |
| Export Confirmed results to XLSX | Missing → implement | Workbook/worksheet/cell-type tests |
| Preserve ticket identifiers as strings in CSV | Missing → implement | `00042` CSV round-trip test |
| Preserve ticket identifiers and leading zeroes in XLSX | Missing → implement | XLSX cell value/type/format round-trip test |
| Keep cancelled/replacement records available to audit | Partial → complete | Timeline/read-model lineage tests |
| Propose any export dependency for approval | Resolved by baseline | Reuse committed SheetJS CE `xlsx` 0.20.3; no new dependency request |
| Reconstruction of completed draw | Missing formal evidence → implement | Complete session reconstruction fixtures and failure cases |
| Export leading-zero ticket numbers | Missing → implement | CSV/XLSX round-trip tests |
| Export excludes non-final Pending results | Missing → implement | Pending-only/mixed-result export tests |
| Redraw history remains traceable | Partial → complete evidence | Original, replacement, reason, and audit ordering tests |
| Official record immutability rules | Partial → complete evidence | Mutation rejection and no-side-effect integration tests |

### 4.2 PRD mapping

| PRD requirement | Phase 9 implementation/evidence |
|---|---|
| FR-HIS-001 | The authoritative session/winner reconstruction projection exposes session ID, category, prize, timestamp, mode, eligible count, winner count, winner ticket strings, and confirmation status. Missing relationships fail safely rather than being silently invented. |
| FR-HIS-002 | Redraw/cancellation projections expose typed reason, optional note, original winner ID/ticket, replacement winner ID/ticket, and timestamps. |
| FR-HIS-003 | Official records remain append-only where required; terminal session/winner/redraw records cannot be silently overwritten or deleted. Read/reopen/export paths are side-effect free. |
| FR-HIS-004 | Session detail, all-winners, and chronological audit views show draw order, confirmation, cancellation, replacement, actor, and timestamps. |
| FR-HIS-005 | The operator can export final Confirmed results to CSV and XLSX from the selected Event, with documented schema and deterministic ordering. |
| FR-HIS-006 | Ticket identifiers are carried as strings through the projection and emitted in CSV/XLSX without numeric coercion or loss of leading zeroes. |
| AC-HIS-001 | Integrated UI/read-model tests assert all FR-HIS-001/002 fields and audit/lineage visibility for completed and redrawn sessions. |
| AC-HIS-002 | Persistence and integration tests assert no silent delete/overwrite, immutable terminal records, and no mutation from history/reopen/export. |
| AC-HIS-003 | CSV/XLSX tests assert only Confirmed results are exported, exact ticket strings survive, and the output reconciles to local Confirmed WinnerRecords. |

Related PRD constraints remain active: Practice must not write official final
history (`FR-MOD-003`), Live lifecycle changes must remain official and
auditable (`FR-MOD-004`), cancelled records must not be deleted, redraws must
retain reason and lineage, and final exports must reconcile to Confirmed local
records.

## 5. Proposed final export contract

The export contract must be approved as part of Phase 9 before UI wiring is
considered complete. The proposed MVP contract is:

### CSV

One data row per `confirmed` WinnerRecord, sorted deterministically by
`confirmedAt`, then draw-session creation time, then winner sequence, then
winner ID. The header is fixed and explicit:

`event_id,event_name,draw_session_id,draw_timestamp,confirmed_at,mode,category_id,category_name,prize_name,winner_record_id,sequence_number,participant_id,ticket_number,participant_display_name`

All fields are serialized as text in the CSV writer. `ticket_number` is never
parsed as a number. Cancelled originals and Pending records are excluded from
the confirmed-results export but remain available in History/Audit.

### XLSX

One workbook with a `Confirmed Results` worksheet containing the same columns
and row ordering as CSV. `ticket_number` must be written as a text cell and
must not be emitted with a numeric cell type or an inferred number format.
The workbook may include a `Metadata` worksheet only if it is documented and
does not change the confirmed-results row contract. Phase 9 should prefer one
clear results worksheet plus a small metadata sheet containing export time,
event ID/name, application/schema version, and row count.

The implementation must centralize column definitions and row projection so
CSV and XLSX cannot drift. Tests must compare both outputs to the same
confirmed-result projection.

## 6. Slice breakdown and implementation order

### Slice 9.1 — History read-model contract and reconstruction

Define a complete event/session history query and reconstruction result. It
must join persisted sessions, snapshots, winners, redraws, audits, event, and
category data; validate required relationships; sort deterministically; and
return typed incomplete/corrupt relation states rather than fabricating data.
Preserve the existing `history-read-model.ts` behavior while expanding it into
the shared authority for all History, Audit, and export consumers.

Deliverables: typed query/projection contracts, reconstruction service,
complete/missing-relation fixtures, and tests for completed, cancelled,
redrawn, mixed-status, and exact-ticket sessions.

### Slice 9.2 — Session History and All-Winners views

Refine the existing `/history` and `/history/:drawSessionId` screens around the
new read model. Add the Event-scoped all-winners view with session/category,
ticket, status, confirmation/cancellation time, and lineage context. Keep
cancelled originals visible and make the Live/Practice meaning explicit.

Deliverables: list/detail/all-winners UI, empty/loading/error states, route
tests, and regression coverage for the existing Phase 8 production journey.

### Slice 9.3 — Filters, search, and chronological audit timeline

Add search and finalized filter semantics. Search must preserve exact ticket
strings and support the operator-useful text fields chosen in the query
contract. Add a chronological timeline sourced from AuditRecords, with stable
timestamp/ID ordering and readable details for draw lifecycle, confirmations,
cancellations, redraws, and reasons/notes.

Deliverables: URL/state contract, filter/search projection tests, timeline
ordering/detail tests, and UI tests for no-match and mixed-result states.

### Slice 9.4 — Practice/Live distinction and public-result reopening

Document and implement the history policy: official History and exports are
Live-only; Practice is visibly labeled as rehearsal/non-official wherever a
Practice result can be viewed, and Practice cannot alter official history or
Live eligibility. Reopening a completed public result must load the persisted
public projection for an existing completed Live session in read-only mode.
It must not call selection, create a session, append a winner, append an audit,
or alter the Audience state authority.

Deliverables: explicit mode policy, result-reopen route/action, Audience
projection tests, zero-new-record assertions, and Practice isolation tests.

### Slice 9.5 — Official-record immutability and safe read boundaries

Audit every History/Audit/reopen/export path for accidental writes. Add or
formalize read-only repository/query interfaces and explicit rejection tests
for terminal-record overwrite/delete and duplicate lineage. Preserve additive
schema migration rules and existing command receipt behavior. Do not add
recovery or backup behavior here.

Deliverables: immutability policy, repository/application tests, no-side-effect
integration tests, and safe error states for missing/inconsistent records.

### Slice 9.6 — Export schema and CSV/XLSX implementation

Approve the schema in Section 5, centralize confirmed-result row projection,
implement CSV serialization and SheetJS XLSX generation, and expose export
actions from the appropriate official History context. The export must be
deterministic, Event-scoped, Confirmed-only, and local-first. Reuse the
committed `xlsx` 0.20.3 dependency; no dependency installation is planned.

Deliverables: schema documentation, export application service, CSV/XLSX
download boundary, filename policy, and unit/integration/round-trip tests.

### Slice 9.7 — Phase 9 integrated verification and acceptance evidence

Run the full automated suite and the Phase 9 manual matrix. Record exact
commands and outcomes in the Phase 9 acceptance record after approval and
implementation. Resolve only Phase 9 defects; defer Phase 10/11 work to its
own plans.

## 7. Dependencies

### Required before implementation

- Accepted Phase 8 baseline and its persisted lifecycle contracts.
- Existing IndexedDB schema/repositories for sessions, winners, redraws, and
  audits.
- Existing confirmation/cancellation/redraw audit payloads and exact string
  ticket handling.
- Existing SheetJS CE 0.20.3 dependency and legal notice; no new dependency
  approval is required unless implementation discovers a real gap.

### Ordering constraints

1. Establish reconstruction/read-model contracts before changing any UI.
2. Build all-winners and timeline projections from that same contract.
3. Finalize mode/filter/search semantics before export query wiring.
4. Prove public reopening is read-only before exposing the operator action.
5. Finalize the single confirmed-result row projection before implementing CSV
   and XLSX serializers.
6. Run immutability and cross-format reconciliation tests before manual
   acceptance.

### Risks and mitigations

- Existing History currently filters to Live sessions. Avoid a misleading
  Practice option by making the policy explicit and testing non-official
  Practice isolation.
- Audit detail is a structured union rather than one normalized event schema.
  Add typed action-specific projection/narrowing at the read boundary; do not
  spread unsafe casts into UI code.
- XLSX libraries may infer numeric ticket cells. Assert cell value/type and
  parse the generated workbook in tests.
- Corrupt/deleted related records must not be silently reconstructed. Show a
  safe incomplete/error relation and retain any surviving official evidence.
- Reopening a public result could accidentally reuse a draw-start path. Route
  it through a read-only projection/query and assert no command/persistence
  calls.

## 8. Automated test requirements

Tests must be added at the domain/application/infrastructure/UI boundaries
where behavior is implemented. At minimum:

### Reconstruction and read model

- Reconstruct a completed session with all required FR-HIS-001 fields.
- Reconstruct a partially confirmed session without treating Pending as final.
- Reconstruct cancellation and redraw with reason, note, original, and
  replacement lineage.
- Preserve sequence/timestamp/ID deterministic ordering.
- Fail safely for missing event/category/winner/replacement/audit relationships.
- Verify the all-winners projection includes confirmed winners and cancelled
  originals while retaining session context.

### Audit, filtering, and mode

- Timeline orders equal timestamps by stable ID and includes all lifecycle
  actions.
- Cancellation reasons and `other` notes are visible in detail/timeline.
- Search matches exact tickets including `00042`, not numeric `42`.
- Filters compose deterministically and preserve URL state as designed.
- Practice does not appear as an official Live record, alter Live eligibility,
  or enter confirmed export; Live remains explicitly auditable.

### Reopening and immutability

- Reopening a completed result renders the same persisted public result.
- Reopen performs no selection, no new DrawSession, no WinnerRecord, and no
  AuditRecord write.
- Terminal sessions/winners/redraws cannot be silently overwritten/deleted.
- History reads and exports are side-effect free.
- Existing append-only and command-idempotency behavior remains green.

### Export and ticket identity

- CSV contains only Confirmed results and excludes Pending and Cancelled rows.
- CSV preserves exact string values, quoting, headers, ordering, and Unicode.
- XLSX contains the agreed worksheet/columns and only Confirmed rows.
- XLSX ticket cells remain text and preserve `00042` after workbook round trip.
- CSV and XLSX rows reconcile one-to-one with the confirmed WinnerRecord
  projection.
- Empty confirmed-result export has the documented headers/worksheet and no
  fabricated rows.
- Multi-session, multi-category, redraw, duplicate-looking `42`/`00042`, and
  cancellation scenarios are covered.

Required verification commands after implementation, consistent with
`AGENTS.md`, are `npm run test`, `npm run lint`, `npm run typecheck`, and
`npm run build`; run `git diff --check` as a documentation/source hygiene
check. This planning task does not run implementation verification because no
Phase 9 code is being added.

## 9. Manual acceptance requirements

Manual acceptance is limited to Phase 9 behavior and ordinary usability of the
new controls. It does not substitute for Phase 11 release hardening.

1. Seed an Event with exact tickets `00042`, `42`, and additional winners;
   complete multiple Live sessions and confirm selected winners.
2. Open History and verify session metadata, counts, status, mode, timestamps,
   and category/prize values. Open detail and verify every winner remains
   visible after cancellation/redraw.
3. Open All Winners and verify confirmed, cancelled, and replacement context
   can be followed back to the originating session.
4. Open the audit timeline and verify chronological draw, confirmation,
   cancellation, and redraw events, including reason and `other` note.
5. Exercise status/mode/category/date/search filters, including exact search
   for `00042`; verify no-match and reset behavior.
6. Run a Practice draw and verify its rehearsal labeling, absence from
   official Live history/export, and no change to later Live eligibility.
7. Reopen a completed public result on Audience Display. Verify the exact
   persisted result appears, no new draw begins, and the operator/history
   records do not gain a new session, winner, or audit event.
8. Export confirmed results to CSV and XLSX. Verify headers/worksheet, row
   count, deterministic order, confirmed-only inclusion, and exact `00042`
   and `42` values.
9. Verify cancelled originals are absent from confirmed export but remain in
   History/Audit with replacement relationship and reason.
10. Attempt or simulate terminal-record overwrite/delete through the supported
    application boundary and verify a safe rejection with no data loss.
11. Reload between read, filter, detail, reopen, and export actions and verify
    the same official records are reconstructed. Operational interrupted
    recovery beyond this read-path check remains Phase 10.

## 10. Exit criteria

Phase 9 is complete only when all of the following are evidenced:

- A completed Live draw can be reconstructed from stored records with all
  minimum FR-HIS-001 fields and safe handling of incomplete relationships.
- History includes session detail, all winners, filters/search, mode
  distinction, cancellation reasons, and original-to-replacement lineage.
- A chronological audit timeline exposes the relevant lifecycle and redraw
  evidence in deterministic order.
- Completed public results can be reopened read-only without a new draw or new
  official records.
- Official records cannot be silently overwritten or deleted; read/reopen/export
  operations have no persistence side effects.
- CSV and XLSX schemas are documented and implemented, and exports contain
  only Confirmed results that reconcile to local confirmed records.
- Ticket numbers remain strings end-to-end, including leading zeroes in CSV and
  XLSX (`00042` remains `00042`).
- Redraw history remains visible and traceable in the audit trail.
- Required automated tests pass, including reconstruction, export,
  pending-exclusion, redraw traceability, Practice isolation, and immutability.
- Required manual acceptance is recorded as passed against the accepted Phase
  9 implementation baseline.
- No Phase 10 recovery/backup work or Phase 11 accessibility/performance/release
  hardening has been silently included.

Phase 9 does not authorize backup/restore. That remains conditional P2 and
requires explicit approval for a later milestone.
