# Phase 4 — Participant Import Pipeline Implementation Plan

## 1. Executive summary

Phase 4 delivers the production Participant Import pipeline for Raffle OS. The
pipeline accepts bounded CSV and XLSX sources, preserves ticket identifiers as
exact strings, stages and diagnoses rows before persistence, previews the
result for an Operator, and commits validated Participants atomically using
explicit replace or merge semantics.

The only required Participant field is `Ticket Number`. Participant Name,
Group, Notes, and Check-in remain optional. Phase 4 keeps import logic outside
React presentation code and keeps prototype fixtures outside production
persistence.

The plan is being written after the first two implementation slices landed.
Those slices are recorded as completed history below; they are not presented
as work that this plan predates.

## 2. Current repository baseline

The tested repository baseline is:

| Item | Verified value |
|---|---|
| Tested `HEAD` | `d98367a9b3845af0d2615e2cedf4eaaa6f6ab0da` |
| `origin/main` | `d98367a9b3845af0d2615e2cedf4eaaa6f6ab0da` |
| Working tree before this document | Clean |
| Stack | React 19, React Router 7, TypeScript 6, Vite 8, Tailwind CSS 4, Vitest 4, Dexie 4 |
| Lint | Passed |
| Typecheck | Passed |
| Tests | 41 test files passed; 499 tests passed |
| Build | Passed; Vite transformed 96 modules |
| Whitespace check | `git diff --check` passed before this document |

`git fetch origin main --prune` completed before inspection, and `HEAD` equals
`origin/main`. Slice 2 changed only the participant-import application
modules and their focused tests. No dependency, UI, persistence, IndexedDB,
or Phase 3 implementation changes were introduced by Slice 2.

## 3. Implemented-before-plan disclosure

This formal plan was created after both initial Phase 4 slices were already
implemented, committed, and pushed:

1. **Slice 1 — Participant Import Staging Contracts and Pure Validation** was
   implemented in commit
   `13a904738e7c36237fcde973acd9abe867858aa8`.
2. **Slice 2 — Participant CSV Parsing and File-Format Boundary** was
   implemented in commit
   `d776368561a34412321229289bcd95b2adbab8a3`.

`PHASE-4-PLAN.md` did not exist before either implementation.

## 4. Phase 4 scope and exclusions

In scope are import staging contracts, CSV and XLSX parsing, file metadata and
format validation, browser file selection, column mapping, row normalization,
validation diagnostics, preview and summary, replace and merge strategies,
atomic Participant persistence, Participants page integration, and import
audit evidence.

The following are explicitly excluded from Phase 4: eligibility evaluation,
production candidate-pool construction, winner selection, Web Crypto draw
selection, Fisher–Yates shuffle, Live draw execution, winner confirmation,
redraw execution, BroadcastChannel synchronization, exports, backup/restore,
backend, cloud, authentication, and payments.

## 5. Current Slice 1 implementation

Slice 1 is implemented and committed in the application boundary at
`src/application/participant-import/`.

Its contracts include `SupportedFileType`, `ImportFileMetadata`,
`ParticipantImportSourceMetadata`, `RawImportRow`, `ParticipantImportField`,
`ColumnMapping`, `NormalizedStagingRow`, `ValidationIssue`,
`ValidatedParticipantDraft`, `ImportStrategy`, `ImportSummary`,
`ParticipantImportRowResult`, and `ParticipantImportValidationResult`.

`validateImportFileMetadata` and `parseSupportedFileType` provide typed format
handling. `validateParticipantImport` maps raw rows, preserves string values,
normalizes optional fields, parses supported Check-in values, compares ticket
duplicates exactly, and emits no draft for a row containing an error.
`Ticket Number` is the only required field; numeric ticket input is rejected
at the raw-row boundary rather than converted. Summary reconciliation reports
total, valid, invalid, empty-ticket, malformed, duplicate, issue, and strategy
counts.

Focused tests cover `00042`, numeric-ticket rejection, missing versus optional
fields, exact duplicates (`00042` and `42` remain distinct), invalid-row draft
suppression, valid optional fields, summary counts, and unsupported file
metadata.

## 6. Current Slice 2 implementation

Slice 2 is implemented and committed in commit
`d776368561a34412321229289bcd95b2adbab8a3`.

`parseCsv` in `csv-parser.ts` is a deterministic bounded parser with
`DEFAULT_CSV_PARSER_LIMITS` of 1,000,000 input characters, 100,000 data rows,
100 columns, and 10,000 characters per cell. It handles a UTF-8 BOM, CRLF and
LF endings, quoted commas, escaped quotes, multiline quoted fields, empty
cells, trailing cells, exact source row numbers, duplicate headers, and
column-count consistency. It does not coerce values, so ticket text remains
text.

Typed `CsvParserDiagnosticCode` values report empty input, missing headers,
quote errors, inconsistent columns, and each safety-limit failure.
`parseParticipantImport` detects CSV/XLSX from extension or MIME metadata,
dispatches CSV into `parseCsv` and Slice 1 validation, returns typed
`unsupported-format` results, and returns an explicit
`parser-not-implemented` result for XLSX. Parser failures produce no
Participant drafts. `index.ts` exports the contracts, limits, parsers, and
validation entry points.

Focused tests cover CSV syntax, limits, exact strings, validation integration,
parser failure draft suppression, unsupported formats, and the explicit XLSX
boundary.

## 7. Import staging and application model

The production flow will be:

`File` → source metadata and bounded read → format adapter → raw rows → header
mapping → normalized staging rows → row diagnostics and valid drafts → preview
summary → explicit strategy confirmation → persistence command → appended
import audit evidence.

The parser and validator remain pure application services. A valid draft is
not yet a Participant because it has no event ownership, identity, or
persistence timestamp. Slice 5 will enrich drafts with event ID, generated
Participant ID, and timestamps only inside the import transaction boundary.
Prototype fixture types and records remain unavailable to this path.

## 8. CSV and XLSX parsing strategy

CSV continues to use the existing bounded deterministic parser and must preserve
source row numbers from the file, including the header offset. Slice 3 adds
bounded browser text reading and metadata validation without pretending that a
file has been imported.

Slice 4 must first compare suitable browser XLSX dependencies and obtain
explicit approval before changing `package.json` or the lockfile. The review
must cover bundle size, browser support, security posture, maintenance, and
licensing. A custom ZIP/XML XLSX parser is prohibited. The selected adapter
must preserve formatted ticket text when genuinely available, reject
ambiguous numeric cells, never invent lost leading zeroes, never evaluate
formulas, and normalize failures into the existing typed diagnostic model.
The adapter output must enter the same staging and validation pipeline as CSV.

## 9. File safety and processing bounds

All file paths must enforce limits before unbounded work. At minimum, enforce
maximum file bytes, decoded text characters, rows, columns, cell length, and
preview rows. Reject unsupported MIME/extension combinations and detect empty
files before parsing. Browser reads must be cancellable or safely discard stale
results when the Operator selects another file.

Limits must be named constants or typed options, surfaced in diagnostics, and
tested at boundary and over-limit values. No row after a parser failure may
become a draft. XLSX adapter limits must bound workbook/sheet selection and
cell processing as well as final row output.

## 10. Column mapping and normalization rules

The mapping UI must require exactly one source column for `ticketNumber` and
allow null mappings for `name`, `group`, `notes`, and `isCheckedIn`. It must
prevent two target fields from silently consuming the same source column and
must make any automatic header suggestion reviewable and explicit.

Ticket values are read as strings only. Whitespace policy must be consistent
and documented: presentation whitespace may be trimmed at the field boundary,
but no numeric conversion, padding, or leading-zero invention is allowed.
`00042` remains `00042`; `42` remains `42`.

Optional text fields remain absent when empty. Check-in accepts the existing
boolean forms (`true/false`, `yes/no`, `1/0`, case-insensitively) and reports a
typed error for other values. Normalization must retain source row numbers and
must not make optional fields required.

## 11. Validation and diagnostic model

Validation uses the existing `ValidationIssueCode` and typed parser diagnostics,
with row number, optional target field, severity, and human-readable message.
Future XLSX and browser boundary failures should extend these unions rather
than use untyped exceptions in the UI.

The preview distinguishes parser failure from row validation failure. It shows
valid, invalid, empty-ticket, malformed, duplicate, and total counts, and lists
issues by source row. Exact duplicate comparison is scoped to the current
import first, then checked against persisted Participants during commit. An
invalid row can never enter the valid draft set or production persistence.

## 12. Replace and merge semantics

Both strategies operate only on validated drafts for one selected Event.

* **Replace** requires explicit confirmation, is allowed only where the Event
  and its history policy permit participant replacement, and replaces the
  Event's participant dataset as one transaction. It must not silently delete
  official history or bypass existing immutability rules.
* **Merge** retains existing Participants, adds non-conflicting drafts, and
  reports exact event-scoped ticket conflicts without creating duplicates.
  The open PRD question about whether matching records update optional fields
  remains unresolved; implementation must obtain an approved decision before
  treating a matching ticket as an update.

Neither strategy permits partial success unless a later approved design makes
that behavior explicit in the summary and audit record. A duplicate ticket in
the same Event is a conflict even if it appears in separate input sources.
Tickets may repeat across different Events.

## 13. Atomic persistence design

Slice 5 should add an import application command and a repository/unit-of-work
boundary rather than writing directly from the Participants page. It should
reuse the current `ParticipantRepository` validation, event ownership checks,
event-scoped `[eventId+ticketNumber]` uniqueness, and persistence error
normalization. The current repository already provides bounded reads,
`createBatch`, and guarded draft-event participant deletion; import-specific
transaction composition must preserve those protections.

The replace transaction should snapshot or operate within one Dexie read-write
transaction covering the Event's participant records and the import audit
record. Merge should validate all conflicts before insertion, then atomically
insert the complete accepted batch and append audit evidence. Any validation,
uniqueness, quota, relationship, or audit failure rolls back every write.
No direct table writes from React are permitted, and no successful result may
be shown before the transaction resolves.

Browser persistence readiness remains conditional on the unresolved real-browser
IndexedDB opening issue described in Section 19. Slice 5 may be implemented
and tested with repository/transaction tests, but Slice 6 must not claim
successful browser persistence until Chrome and Edge verification pass.

## 14. Audit behavior

Each committed import should append an immutable audit record containing the
Event scope, import identifier, file name/type and relevant metadata, mapping,
strategy, summary, timestamp, and outcome. Failed transactions must not leave
an audit record claiming success. If failure evidence is retained, it must be
typed as a failed attempt and be deliberately covered by the audit contract.

Audit records must not replace or delete official draw history. The plan does
not claim legal certification or external audit certification.

## 15. UI integration boundaries

Slice 3 introduces the real browser `File` boundary, selection, metadata,
header preview, mapping controls, and validation preview. It must provide
loading, empty, unsupported, parser-error, and validation-error states. XLSX
may be selectable only when the UI clearly says its parser is not implemented.
It must not persist or claim import success.

Slice 6 replaces the fixture-driven Participants workflow with selection,
preview, mapping, validation, summary, replace/merge confirmation, persistence
result, retry, and failure handling. Ticket rendering must be exact text.
Browser history may preserve safe workflow state, but raw files and sensitive
row data should not be placed in URLs. Operator-only import data remains in the
Operator layout; Audience routes remain isolated and receive no participant
table or import controls.

## 16. Proposed directory structure

The following is a target structure; files are not claimed to exist until a
slice implements them:

```text
src/application/participant-import/
  participant-import-staging.types.ts
  participant-import-staging.ts
  csv-parser.types.ts
  csv-parser.ts
  participant-import-parser.types.ts
  participant-import-parser.ts
  participant-import-file.service.ts       # Slice 3
  participant-import-command.ts            # Slice 5
  participant-import-audit.types.ts        # Slice 5, if required
src/infrastructure/import/
  xlsx-parser.adapter.ts                    # Slice 4, approved dependency
src/application/persistence/
  repositories/participant-repository.interface.ts
  participant-import-unit-of-work.interface.ts # Slice 5
src/infrastructure/persistence/
  repositories/participant.repository.ts
  transactions/participant-import-unit-of-work.ts # Slice 5
src/ui/operator/participant-import/
  ImportUploadStep.tsx
  ImportMappingStep.tsx
  ImportValidationStep.tsx
  ImportSummaryStep.tsx
```

Names may be adjusted during implementation if the final boundary remains
small, typed, and separate from presentation.

## 17. Detailed implementation slices

### Slice 3 — Browser file selection, preview, and column mapping

Add the browser File boundary, bounded CSV text reading, metadata checks, file
selection UI, parsed header preview, explicit mappings, and validation preview.
Use the existing Slice 1/2 APIs. Implement all loading, empty, unsupported,
parser-error, and validation-error states. No IndexedDB persistence, replace or
merge commit, or claimed import success. XLSX selection must explain the
parser-not-implemented result.

### Slice 4 — XLSX technology decision and parser implementation

Before code, compare candidates and obtain dependency approval. Document the
bundle, browser, security, maintenance, and licensing tradeoffs. Implement an
adapter using the approved dependency, with text-preserving ticket handling,
formula rejection/no evaluation, bounded workbook processing, and typed
diagnostics. Do not implement a custom ZIP/XML parser.

### Slice 5 — Replace and merge import transaction

Define exact replace/merge conflict behavior, event ownership, Participant
creation, existing-record treatment, AuditRecord append, and complete rollback.
Connect only validated drafts through repository and transaction boundaries.
Prove no silent overwrite, no partial success, and event-scoped uniqueness.

### Slice 6 — Participants page production integration

Replace the static prototype workflow with the production flow. Connect file
selection, preview, mapping, validation, summary, strategy confirmation,
persistence result, retry, and failure states. Preserve exact ticket rendering,
safe browser history, Operator/Audience isolation, and the Phase 3 browser
persistence gate.

### Slice 7 — Integration, performance, and acceptance

Add realistic CSV/XLSX fixtures; verify large-file bounds, exact ticket
preservation, duplicates, malformed rows, rollback, reload/reopen survival,
and Chrome/Edge behavior. Complete documentation closeout and create the Phase
4 acceptance record. Phase 4 is not passed merely because automated tests pass
while the browser persistence defect remains unresolved.

## 18. Testing strategy

Automated tests should cover parser syntax and all configured bounds, BOM and
line endings, quoted/multiline cells, row numbers, exact strings, XLSX adapter
cells, formula rejection, unsupported formats, mapping, normalization,
optional fields, diagnostics, duplicate behavior, and summary reconciliation.

Persistence tests must cover event-scoped uniqueness, replace and merge
semantics, conflict behavior, Participant identity creation, audit append,
failure rollback, quota/error normalization, and prototype fixture isolation.
Component tests must cover keyboard-accessible file selection, loading and
error states, preview/mapping controls, explicit confirmations, exact ticket
display, retry, and no success state before commit completion.

## 19. Phase 3 persistence dependency

Phase 3 automated and source verification passed, but its historical formal
status remains **partially complete**. Phase 4 has supplied Microsoft Edge
Participant Import evidence, while Google Chrome was not run and was waived by
the project owner for route promotion. The Phase 4 acceptance record is the
source of truth for current import status; this historical Phase 3 record is
not rewritten.

Pure parsing, validation, file preview, mapping, and production persistence are
implemented and covered by automated tests. Browser acceptance remains partial
as recorded in `PHASE-4-ACCEPTANCE.md`; no full cross-browser claim is made.

## 20. Manual Chrome and Edge matrix

The Phase 3 smoke procedure in `docs/technical/PHASE-3-ACCEPTANCE.md` should
be rerun and extended for import behavior. Record exact browser versions and
observed results; do not infer browser success from jsdom or fake IndexedDB.

| Check | Google Chrome | Microsoft Edge |
|---|---|---|
| `openSupported` and schema open | NOT RUN / waived | PASS in supplied Edge evidence |
| CSV select/read/preview | NOT RUN / waived | PASS in supplied Edge evidence |
| XLSX selection boundary or parser | NOT RUN / waived | PASS in supplied Edge evidence |
| mapping and validation preview | NOT RUN / waived | PASS in supplied Edge evidence |
| replace commit and reload | NOT RUN / waived | PASS in supplied Edge evidence |
| merge conflict and reload | NOT RUN / waived | PASS in supplied Edge evidence |
| exact leading-zero ticket after reopen | NOT RUN / waived | PASS in supplied Edge evidence |

## 21. Acceptance checklist

- [ ] CSV and approved XLSX files with a Ticket Number column can be selected,
  previewed, mapped, validated, and imported.
- [ ] `000123` remains exactly `000123`; `00042` and `42` remain distinct.
- [ ] No numeric coercion or invented leading zeroes occur.
- [ ] Empty, malformed, duplicate, and invalid rows are diagnosed before commit.
- [ ] Invalid rows never become Participant records or draw candidates.
- [ ] Parser failures produce no drafts.
- [ ] File, row, column, cell, and workbook processing is bounded.
- [ ] Replace requires explicit confirmation and has atomic rollback.
- [ ] Merge prevents event-scoped duplicate tickets and reports conflicts.
- [ ] Optional Name, Group, Notes, and Check-in fields remain optional.
- [ ] Import audit evidence records approved metadata, mapping, strategy,
  summary, timestamp, and outcome.
- [ ] Prototype fixtures never enter production persistence.
- [ ] Automated lint, typecheck, tests, build, and whitespace checks pass.
- [ ] Chrome and Edge persistence/import checks pass with recorded versions.
- [ ] Phase 3 is not declared passed until its browser persistence defect is
  resolved and accepted.

## 22. Risks and open questions

The main risks are XLSX bundle and licensing cost, spreadsheet libraries that
silently coerce formatted numeric cells, large or malicious files, ambiguous
Check-in values, and the unresolved real-browser IndexedDB opening behavior.
Atomic replace also depends on the exact Phase 3 event-history immutability
policy.

Open decisions requiring explicit approval include the XLSX dependency, the
merge treatment of an existing ticket's optional fields, the exact whitespace
policy, the supported XLSX sheet-selection rule, the file-size ceiling exposed
to Operators, and whether failed import attempts are audited as records or
only surfaced diagnostically.

## 23. Recommended immediate next task

The original recommendation below is historical and is superseded by the
completed Slice 7 closeout. The next implementation planning task is Phase 5;
do not add eligibility, candidate pools, randomness, or winner selection to
Phase 4.

**Phase 4 Slice 3 — Browser file selection, preview, and column mapping.**

Begin with the browser `File` boundary and bounded CSV read service, then wire
the existing parser and validator into a reviewable Operator preview. Keep the
work persistence-free and explicitly surface the XLSX parser boundary until
Slice 4 has an approved technology decision.

## Final verification record

After creation of this document, verify that only
`docs/technical/PHASE-4-PLAN.md` is changed. Do not commit or push this plan.

| Required report item | Value |
|---|---|
| Tested HEAD | `d98367a9b3845af0d2615e2cedf4eaaa6f6ab0da` |
| Slice 1 commit | `13a904738e7c36237fcde973acd9abe867858aa8` |
| Slice 2 commit | `d776368561a34412321229289bcd95b2adbab8a3` |
| Current baseline | lint passed; typecheck passed; 41 test files/499 tests passed; build passed; `git diff --check` passed |
| File created | `docs/technical/PHASE-4-ACCEPTANCE.md` |
| Remaining risks | Chrome NOT RUN and waived for route promotion; Edge post-promotion regression not independently evidenced; bundle-size warning; audit advisories |
