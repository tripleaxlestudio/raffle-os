# ADR-002: XLSX Parser Technology

## Status

Accepted — approved with the amendments in this revision.

## Decision

**Recommendation: `approve-sheetjs-ce-0.20.3`**

Approve SheetJS Community Edition 0.20.3, installed from the official SheetJS
CDN tarball and pinned exactly:

```text
https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

The exact proposed installation command is:

```text
npm install --save-exact https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

This command has not been run in this slice. No dependency, lockfile, source,
or test changes are authorized by this ADR alone.

## Context

Phase 4 needs a browser-local adapter from an XLSX `ArrayBuffer` to the
existing `RawImportRow` and validation pipeline. Ticket identifiers are data,
not numbers: text `00042` must remain `00042`; a numeric cell must retain its
numeric provenance; and neither formulas nor cached formula results may become
trusted ticket values.

The current repository has a bounded CSV parser, `RawImportRow` with
`Readonly<Record<string, unknown>>` values, typed parser failures, and a browser
file boundary with a 10 MiB maximum file size. XLSX remains an explicit
`parser-not-implemented` boundary. This decision designs the replacement
adapter only; it does not implement it.

## Candidate comparison

| Criterion | SheetJS CE 0.20.3 | ExcelJS 4.4.0 |
|---|---|---|
| Browser support | Official documentation covers browser scripts and Vite/bundlers; `XLSX.read` accepts an `ArrayBuffer`. | Official README supports the document-based browser build, but excludes streaming workbook readers/writers in browsers. |
| Vite and TypeScript | ESM/module distribution and bundled TypeScript declarations fit the current Vite 8 and strict TypeScript setup. | Has TypeScript declarations and a browserified distribution, but its CommonJS/browser compatibility surface is broader and needs more Vite verification. |
| ArrayBuffer parsing | Direct: `XLSX.read(arrayBuffer, options)`. | `workbook.xlsx.load(arrayBuffer)` is the document-based browser path. |
| Formatted cell text | Cell model directly exposes `w` formatted text and `z` number format when requested. This is the clearest fit for preserving a display such as `000042`. | `cell.text` is available, but the adapter must reconcile it with `cell.value`, formula objects, styles, and ExcelJS value unions. |
| Numeric cells and `000000` | Raw `t: "n"`, numeric `v`, format `z`, and displayed `w` can be retained together. | Numeric value, `numFmt`, and rendered text are represented through separate cell/style APIs. |
| String-cell preservation | `t: "s"` and `v` preserve text exactly; the adapter never uses numeric conversion. | String cell values are preserved, but the adapter still must discriminate the broader `CellValue` union. |
| Formula detection/evaluation | `cellFormula: true` exposes `f`; CE does not evaluate formulas. The adapter rejects any formula cell and ignores cached `v`. | Formula cells expose formula and cached result fields; ExcelJS does not provide a formula evaluator in this read path. The adapter would still have to reject both formula and result. |
| Worksheets and hidden sheets | `SheetNames` plus `Workbook.Sheets[].Hidden` expose all worksheets and visibility states 0/1/2. | Worksheet collection and worksheet state APIs expose the workbook structure and visibility metadata. |
| Merged cells | Worksheet `!merges` exposes merged ranges; adapter can retain only the anchor and diagnose continuation cells. | Merged ranges and master-cell behavior are modeled directly. |
| Blank cells | `sheetStubs: true` can expose blank stubs; absent cells remain absent. | Null/merged cell models distinguish absent and merged cells. |
| Dependencies | The official 0.20.3 package metadata reports no runtime dependencies. | 4.4.0 has a materially larger dependency graph, including JSZip and CSV/date/stream-related packages even when only document XLSX reading is used. |
| Bundle impact | Expected to add one material parser chunk; it is the smaller and more focused browser choice. Exact bytes must be measured in the approved implementation build. | Expected to be materially larger because of the browserified build and dependency/polyfill surface. Exact bytes were not measured because no dependency was installed. |
| Security history | The SheetJS repository Security tab did not list project-published advisories at review time. Separate GitHub Advisory Database records cover CVE-2023-30533 and CVE-2024-22363; the official CDN 0.20.3 line is outside both affected ranges. | The ExcelJS repository Security tab did not list project-published advisories at review time. The 4.4.0 release notes record a JSZip 3.10.1 upgrade, but current lockfile auditing remains required. |
| Maintenance status | Current CE documentation identifies `cdn.sheetjs.com` as the primary distribution and the SheetJS repository moved to `git.sheetjs.com`; this is an intentional non-registry supply-chain decision. | Stable 4.4.0 release with ongoing repository activity, but the pinned release is older and its browser support is less focused on this import-only use case. |
| Licensing | Apache-2.0. Preserve the license and required attribution/notice text in the application’s third-party notices. | MIT. Preserve the copyright and license notice. |
| Offline/local-first deployment | The dependency is bundled at build time from the pinned tarball; runtime parsing requires no network or remote service. | Also offline-capable after bundling. |
| Vitest testability | Pure `ArrayBuffer` input and plain cell objects are straightforward to exercise in Vitest/jsdom; real-browser checks remain appropriate for large files. | Also testable, but browser polyfills and the larger dependency surface increase setup and regression risk. |
| Bounded untrusted-file parsing | Use file, workbook, worksheet, row, column, cell, text, and output limits; disable HTML and never evaluate formulas. The adapter must fail closed when limits or cell semantics are exceeded. | Possible, but the same bounds do not reduce the larger parser/runtime attack surface or the cost of loading the browser bundle. |

## SheetJS distribution distinction

The dependency name is `xlsx`, but the public npm registry package currently
associated with that name is an outdated 0.18.x line and must not be used for
this decision. SheetJS’s current Community Edition distribution is the exact
tarball hosted at `cdn.sheetjs.com`; 0.20.3 is pinned in the URL above. The ADR
therefore does not recommend `npm install xlsx@0.20.3`, a floating CDN URL, or
an unofficial fork.

The CDN tarball is a supply-chain tradeoff: npm lockfile tooling and ordinary
registry advisory automation may not provide the same visibility. Approval
must therefore include recording the resolved tarball integrity in
`package-lock.json`, retaining the upstream license/notice files, and running
the project’s dependency/security review after installation.

## Approved decision amendments

The approved decision is SheetJS CE 0.20.3 from the exact official versioned
CDN tarball above. The first visible worksheet is selected by default; a named
worksheet is permitted only after explicit selection and only when it is
visible. The current proposed safety defaults remain in force. Formulas are
rejected, every numeric-source Ticket Number cell is rejected, and the `xlsx`
module must be dynamically imported only after an XLSX file has been selected.
CSV-only workflows and the initial Operator shell must not eagerly import
SheetJS.

## Security disposition

The known SheetJS prototype-pollution advisory is CVE-2023-30533 / GHSA-4r6h-
8v6p-xvw6. It affects SheetJS CE through 0.19.2 when specially crafted files
are read; the advisory identifies 0.19.3 as the fixed line, distributed from
the SheetJS CDN rather than the abandoned npm publication. This ADR selects
0.20.3, not the affected npm 0.18.5 package.

Also review CVE-2024-22363 / GHSA-5pgg-2g8v-p4x9. SheetJS CE through 0.20.1
is affected by a regular-expression denial of service (ReDoS); 0.20.2 and
later contain the remediation. The selected 0.20.3 version is outside that
affected range. Both CVE-2023-30533 and CVE-2024-22363 must be reviewed again
after dependency installation against the resolved artifact and lockfile.

Neither candidate is treated as a security boundary. The adapter must:

- reject files over 10 MiB before parsing;
- cap worksheets, rows, columns, processed cells, and cell text;
- parse only the selected visible worksheet by default and never auto-select a
  hidden or very-hidden worksheet;
- request formula metadata, never evaluate formulas, and reject a mapped Ticket
  Number formula or cached formula result;
- disable HTML/rich-text rendering and never inject workbook content into HTML;
- retain typed diagnostics for unsupported source types; after mapping, reject
  date, boolean, error, rich-text, unsupported, and every numeric Ticket Number
  cell intentionally;
- return typed diagnostics and no rows after a parser or safety failure; and
- run the future large-file and malformed-workbook tests in Vitest plus the
  required real-browser checks.

The Security tabs of both project repositories did not list project-published
advisories at review time. Separate records were found in the GitHub Advisory
Database for CVE-2023-30533 / GHSA-4r6h-8v6p-xvw6 and CVE-2024-22363 /
GHSA-5pgg-2g8v-p4x9. This distinction is not evidence that no vulnerabilities
exist. The resolved lockfile, npm/CDN artifact integrity, and current official
advisory records remain post-installation verification requirements.

## Proposed adapter contract (design only)

The future adapter should be a pure infrastructure boundary, for example:

```ts
export interface XlsxParserLimits {
  readonly maxWorkbookBytes: number
  readonly maxWorksheets: number
  readonly maxRows: number
  readonly maxColumns: number
  readonly maxProcessedCells: number
  readonly maxCellTextLength: number
}

export type XlsxWorksheetPolicy =
  | { readonly kind: 'first-visible' }
  | { readonly kind: 'named'; readonly name: string }

export interface XlsxParserOptions {
  readonly fileMetadata: ImportFileMetadata
  readonly worksheet: XlsxWorksheetPolicy
  readonly limits?: Partial<XlsxParserLimits>
}

export interface XlsxCellDiagnostic {
  readonly code:
    | 'formula-cell'
    | 'error-cell'
    | 'numeric-ticket-ambiguous'
    | 'date-cell'
    | 'boolean-cell'
    | 'rich-text-cell'
    | 'unsupported-cell'
    | 'merged-cell'
    | 'cell-text-too-long'
  readonly sheetName: string
  readonly rowNumber: number
  readonly columnNumber: number
  readonly message: string
}

export interface XlsxWorkbookDiagnostic {
  readonly code:
    | 'workbook-too-large'
    | 'too-many-worksheets'
    | 'worksheet-not-found'
    | 'hidden-worksheet-not-selectable'
    | 'too-many-rows'
    | 'too-many-columns'
    | 'too-many-cells'
    | 'invalid-workbook'
  readonly message: string
}

export interface XlsxParserSuccess {
  readonly ok: true
  readonly file: ImportFileMetadata
  readonly sheetName: string
  readonly worksheets: readonly {
    readonly name: string
    readonly hidden: boolean
  }[]
  readonly rows: readonly RawImportRow[]
  readonly provenance: readonly XlsxRowProvenance[]
  readonly diagnostics: readonly XlsxCellDiagnostic[]
}

export type XlsxCellSourceType =
  | 'blank'
  | 'string'
  | 'number'
  | 'formula'
  | 'date'
  | 'boolean'
  | 'error'
  | 'rich-text'
  | 'unsupported'

export interface XlsxCellProvenance {
  readonly sheetName: string
  readonly rowNumber: number
  readonly columnNumber: number
  readonly sourceType: XlsxCellSourceType
  readonly formattedText?: string
  readonly numberFormat?: string
  readonly formula?: string
  readonly cachedResultPresent?: boolean
}

export interface XlsxRowProvenance {
  readonly sheetName: string
  readonly rowNumber: number
  readonly cells: readonly XlsxCellProvenance[]
}

export interface XlsxParserFailure {
  readonly ok: false
  readonly diagnostics: readonly (XlsxWorkbookDiagnostic | XlsxCellDiagnostic)[]
}

export type XlsxParserResult = XlsxParserSuccess | XlsxParserFailure

export function parseXlsx(
  input: ArrayBuffer,
  options: XlsxParserOptions,
): XlsxParserResult
```

The final names may be adjusted to share the project’s parser diagnostic union,
but the following behavior is required:

1. Check `input.byteLength` against `maxWorkbookBytes` before calling SheetJS.
   Parse with formula metadata enabled, number formats enabled, formatted text
   enabled, worksheet stubs enabled, HTML disabled, and no formula evaluation.
2. Inspect worksheet names and visibility. Select the first visible sheet by
   default, or a named visible sheet after explicit operator selection. Report
   hidden and very-hidden sheets in diagnostics/metadata; never silently use
   them as the default.
3. Apply the recommended limits before emitting rows. Preserve the workbook’s
   one-based source row number; the header row remains a source row and data
   rows retain their exact worksheet row numbers.
4. Convert cells by type without coercion. Preserve typed provenance for every
   cell, and keep each raw row aligned with its provenance by sheet, source row,
   and source column:
   - actual string cells become exact strings, including `00042`;
   - numeric cells retain numeric source values and `number` provenance. They
     are never disguised as trusted strings. Numeric formatted display text
     such as `000042` is diagnostic evidence only;
   - formula cells retain `formula` provenance and cached values are never
     trusted or evaluated;
   - dates, booleans, error cells, rich text, and unsupported source cell types
     retain their typed provenance and are never implicitly stringified;
   - blank cells become `undefined`/empty raw values, not invented text;
   - merged continuation cells remain blank; only the anchor cell may provide a
     value, and ambiguous merged headers/data produce a diagnostic.
5. Preserve formatted text only as evidence supplied by the workbook/parser.
   The adapter must not pad, parse, format, or otherwise invent ticket digits.
6. Keep parsing separate from mapping. The parser does not know which source
   column will later map to `ticketNumber`; it must not discard an entire row
   because an unrelated or ignored column is numeric. Numeric cells in ignored
   columns do not automatically invalidate a row unless an explicit field
   policy rejects them.
7. After column mapping is selected, orchestration/validation inspects the
   provenance for the source column mapped to `ticketNumber`. If that mapped
   cell originated as numeric, formula, cached formula result, date, boolean,
   error, rich text, or unsupported, the row receives a fatal typed diagnostic
   and produces no `ValidatedParticipantDraft`. Only an actual string cell
   mapped to Ticket Number may become a valid ticket. This preserves
   compatibility with the existing Slice 1 validator: invalid mapped rows are
   withheld from its valid draft set rather than converted into trusted strings.
8. Emit rows and their aligned provenance when parsing completes within bounds.
   A fatal workbook or safety-limit failure produces no rows. Successful rows
   feed the existing header mapping and `validateParticipantImport` pipeline;
   they do not become persisted Participants in the adapter.

### Dynamic import boundary

The `xlsx` dependency must be code-split and dynamically imported only after an
XLSX file passes metadata and size validation. The initial Operator bundle and
CSV workflow must not eagerly import `xlsx`. Loading failure is a typed parser
failure with no emitted rows.

## Recommended default limits

These defaults align with the existing CSV/file boundary while adding workbook
and cell bounds:

| Limit | Default |
|---|---:|
| Maximum workbook bytes | 10 MiB |
| Maximum worksheets inspected | 8 |
| Maximum worksheet rows | 100,000 |
| Maximum columns | 100 |
| Maximum processed cells | 1,000,000 |
| Maximum cell text length | 10,000 characters |

The limits are safety defaults, not a claim that every workbook within them is
safe or fast. The implementation must expose them as named constants/options,
test exact boundary and over-limit behavior, and consider a worker or stale-
result discard for the browser UI when parsing a large selected file.

## Licensing and attribution

SheetJS CE 0.20.3 is Apache License 2.0. The implementation must retain the
upstream license and NOTICE/attribution material included by the approved
artifact and include the dependency in the project’s third-party notices. No
SheetJS Pro-only functionality may be used or implied.

The rejected ExcelJS alternative is MIT-licensed and would require retaining
its copyright and MIT license notice if selected in a later decision.

## Rejected alternative

Reject `approve-exceljs-4.4.0` for this slice. ExcelJS is technically capable of
browser document-based XLSX loading and has a useful typed model, formulas,
merges, visibility, and number formats. It is not rejected as unusable.

It is rejected for this bounded, read-only import boundary because its browser
distribution and transitive dependency/polyfill surface are materially heavier,
while the adapter would still need to build the same strict cell-type and
formula-rejection policy. SheetJS exposes the raw value, source type, number
format, formatted text, formula marker, worksheet visibility, and merge ranges
more directly for this exact contract, with no runtime dependencies in the
approved 0.20.3 package metadata. ExcelJS may be reconsidered only through a
new ADR if SheetJS fails the implementation’s browser, security, or fixture
acceptance tests.

## Consequences and follow-up approval

Positive consequences:

- exact text cells can be preserved without numeric coercion, while formatted
  numeric display text remains diagnostic evidence only;
- the parser remains local-first and browser-only at runtime;
- the adapter can remain pure and feed the existing staging/validation API;
- no custom ZIP/XML parser is introduced; and
- the dependency is pinned to a known official artifact rather than a floating
  release.

Costs and risks:

- the official CDN tarball requires deliberate provenance, integrity, license,
  and advisory handling outside ordinary npm-registry assumptions;
- the XLSX parser remains a material browser bundle and must be measured and
  code-split from the initial Operator shell;
- SheetJS still parses an untrusted archive, so application-level bounds do not
  eliminate parser denial-of-service risk; and
- formatted text is only trustworthy as presentation evidence, never as proof
  that a numeric cell was originally text.

This revision grants approval for SheetJS CE 0.20.3, the exact official
versioned CDN tarball and exact installation command, the documented default
limits, first-visible worksheet selection, named visible worksheet selection
only after explicit choice, formula rejection, rejection of every
numeric-source Ticket Number, and mandatory dynamic import/code splitting.
Implementation may proceed under these constraints. Post-installation
dependency, integrity, license, security, bundle, test, and browser checks are
verification requirements, not another approval gate. This ADR itself does
not install, commit, or push anything.

## Sources consulted

- SheetJS installation and distribution guidance:
  https://docs.sheetjs.com/docs/getting-started/installation/
- SheetJS cell object model (`v`, `t`, `z`, `w`, `f`, `r`, `h`):
  https://docs.sheetjs.com/docs/csf/cell/
- SheetJS formula metadata and no-evaluation import boundary:
  https://docs.sheetjs.com/docs/csf/features/formulae/
- Official SheetJS 0.20.3 source/package metadata:
  https://git.sheetjs.com/sheetjs/sheetjs/src/tag/v0.20.3/package.json
- Official SheetJS 0.20.3 distribution:
  https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
- SheetJS security page:
  https://github.com/SheetJS/sheetjs/security
- GitHub Advisory Database, CVE-2023-30533 / GHSA-4r6h-8v6p-xvw6:
  https://github.com/advisories/GHSA-4r6h-8v6p-xvw6
- GitHub Advisory Database, CVE-2024-22363 / GHSA-5pgg-2g8v-p4x9:
  https://github.com/advisories/GHSA-5pgg-2g8v-p4x9
- ExcelJS 4.4.0 README and browser guidance:
  https://github.com/exceljs/exceljs/blob/v4.4.0/README.md
- ExcelJS 4.4.0 release notes:
  https://github.com/exceljs/exceljs/releases/tag/v4.4.0
- ExcelJS 4.4.0 package metadata:
  https://registry.npmjs.org/exceljs/4.4.0
- ExcelJS security page:
  https://github.com/exceljs/exceljs/security

Reviewed for this ADR on 2026-08-04 against tested `HEAD`
`c6bfddaef5f5d24e04284bd0e02ab4d309ae5ab0`.
