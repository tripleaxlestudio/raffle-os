# Phase 4 Acceptance Record

## 1. Executive result

**PHASE 4 FUNCTIONALLY COMPLETE — CROSS-BROWSER ACCEPTANCE PARTIAL**

The committed implementation provides the production Participant Import path
for bounded CSV/XLSX staging, mapping, validation, atomic Replace/Merge
transactions, audit append, and bounded persisted verification. The supplied
Microsoft Edge manual Participant Import evidence is recorded below. Chrome
was not run and was explicitly waived by the project owner for route
promotion, so Phase 4 is not fully cross-browser verified.

Eligibility evaluation, candidate pools, draw selection, winner confirmation,
redraw mutation, and other Phase 5+ capabilities remain out of scope.

## 2. Tested commit and upstream

| Item | Value |
|---|---|
| Tested `HEAD` | `d98367a9b3845af0d2615e2cedf4eaaa6f6ab0da` |
| `origin/main` | `d98367a9b3845af0d2615e2cedf4eaaa6f6ab0da` |
| Branch | `main` |
| Tested date | 2026-08-04 |

## 3. Git/worktree preconditions

- `git status --short`: clean before verification.
- `git fetch origin main --prune`: exit code 0.
- `HEAD` equals `origin/main`: confirmed before testing.
- Slice 6B route promotion is committed at `d98367a`.
- `/participants` is production by default; `?workflow=prototype` preserves
  Phase 2; `production-preview` remains a production alias.
- Required pre-change baseline: 41 test files and 499 tests.
- No commit or push was performed during this closeout.

## 4. Slice inventory and commit hashes

| Slice/change | Commit |
|---|---|
| Slice 1: staging validation | `13a904738e7c36237fcde973acd9abe867858aa8` |
| Slice 2: bounded CSV pipeline | `d776368561a34412321229289bcd95b2adbab8a3` |
| Phase 4 plan | `a04e79b039cd177daa2fe4aec55a3a3b67e83598` |
| Slice 3: browser preview and mapping | `c6bfddaef5f5d24e04284bd0e02ab4d309ae5ab0` |
| ADR-002: SheetJS decision | `9835440a53cbf30bfa88c1b54489199aaff651c9` |
| Slice 4: bounded XLSX adapter | `41d7f72777313121576d74f118b969af01b64f34` |
| Persistence defaults repair | `2435345cbbab0ba15a34c04a69c85f0668b513a9` |
| Slice 5: atomic import transactions | `add791577eb9a3777da9d78aa3883efcf1578984` |
| Slice 6A: production integration | `545c9237337bb558b971d5f0a1f534d9091ae813` |
| Slice 6A preview completion | `b50cb4e5a8fb18e3198f35053097e56bdc041c66` |
| Slice 6B: route promotion | `d98367a9b3845af0d2615e2cedf4eaaa6f6ab0da` |

## 5. Dependency and license record

| Package | Tested version | Record |
|---|---:|---|
| `xlsx` | 0.20.3 | Exact official SheetJS CDN tarball; Apache-2.0 notices retained; dynamic async chunk. |
| `dexie` | 4.4.4 | Local persistence transaction boundary. |
| `fake-indexeddb` | 6.2.5 | Test-only IndexedDB implementation. |

ADR-002 remains the source of truth. SheetJS 0.20.3 is outside the affected
ranges recorded for CVE-2023-30533 and CVE-2024-22363. `npm audit` cannot fully
evaluate the provenance or contents of the CDN tarball.

## 6. Fresh automated verification matrix

| Command | Exit code | Exact result |
|---|---:|---|
| `npm.cmd list xlsx dexie fake-indexeddb --depth=0` | 0 | `xlsx@0.20.3`, `dexie@4.4.4`, `fake-indexeddb@6.2.5` |
| `npm.cmd run lint` | 0 | Passed; no warnings printed |
| `npm.cmd run typecheck` | 0 | Passed |
| `npm.cmd run test` | 0 | 41 files; 499 tests; Vitest duration 42.64s |
| `npm.cmd run build` | 0 | 131 modules transformed |
| `git diff --check` | 0 | Passed |
| `npm.cmd audit` | 1 | High `brace-expansion` GHSA-rgw5-rvv9-x895 and React Router GHSA-qwww-vcr4-c8h2 |
| `npm.cmd audit --omit=dev` | 1 | High React Router GHSA-qwww-vcr4-c8h2 |

Build sizes were `index-CID75PxL.css` 107.18 kB (16.61 kB gzip),
`xlsx-Cl_0CZaL.js` async chunk 493.22 kB (160.65 kB gzip), and
`index-BlvgmJdR.js` 559.16 kB (164.95 kB gzip). Vite emitted its standard
warning for chunks over 500 kB after minification; this is a follow-up, not a
functional failure.

## 7. CSV acceptance

Tests cover UTF-8 BOM, CRLF/LF, quoted commas, escaped quotes, multiline
fields, empty cells, duplicate headers, inconsistent columns, duplicate
tickets, malformed quotes, exact `00042` and `42`, and input/row/column/cell
limits. Parser failure produces zero drafts.

## 8. XLSX acceptance

Generated in-memory workbooks cover plain text and Excel shared-string cells,
numeric and formatted numeric cells, formulas with cached values, booleans,
dates, errors, blank/stub cells, hidden and very-hidden sheets, visible-sheet
selection, merged cells, invalid workbooks, and workbook/worksheet/row/column/
cell/text bounds. Numeric and formula Ticket Number cells are rejected;
formatted display text does not invent leading zeroes. The adapter returns
provenance and typed diagnostics and loads asynchronously after XLSX selection.

## 9. Mapping and validation acceptance

Mapping requires one Ticket Number source column, prevents duplicate source
consumption, keeps optional fields optional, and makes suggestions reviewable.
Invalid rows do not produce drafts. Exact ticket strings remain strings from
source row through validated draft, command, Participant, verification, and
reopen.

## 10. Replace/Merge transaction acceptance

Tests cover selected-Event-only Replace, rollback after insertion/audit
failure, Merge preservation, exact conflict rejection before writes, audit
append in the same transaction, no success audit on failure, immutable Events,
same tickets in different Events, and distinct `00042`/`42` records.
Participant IDs are generated in the application command boundary, outside
React. Raw files and staging rows are not persisted.

## 11. UI and route acceptance

Tests cover production `/participants`, the `production-preview` alias,
explicit prototype query, invalid-query fallback, real active Event identity,
safe no-Event and immutable-Event states, keyboard file selection, visible
mapping labels, no automatic strategy selection, explicit confirmation,
double-submit blocking, delayed success, safe retry, friendly errors, bounded
horizontal tables, bounded persisted verification, and Audience isolation.

## 12. Performance methodology and results

Environment: Windows workspace; Node/npm versions were taken from the current
environment; application build was a Vite production build. Import fixtures
are generated in memory and exercise moderate and near-limit parser,
validation, XLSX, and transaction bounds. Each automated test case ran once;
the full suite ran once with a 42.64s Vitest duration. The build transformed
131 modules and produced the chunks above.

The implementation enforces named byte, character, row, column, cell,
worksheet, workbook, and preview limits and uses bounded persisted reads. No
universal millisecond guarantee is asserted. Large XLSX parsing remains
main-thread work and browser responsiveness is device-dependent. A future Web
Worker may be considered; none was introduced in Phase 4.

## 13. Microsoft Edge manual evidence

Per the supplied evidence, the manual Microsoft Edge Participant Import
workflow is **PASS** for native IndexedDB open/write/reopen, CSV Merge, reload
survival, duplicate Merge rejection, CSV Replace, XLSX text ticket, Excel
shared-string correction, XLSX numeric rejection, XLSX formula rejection,
invalid inputs producing no persistence changes, and exact ticket preservation.

Browser version, Windows version, reviewer, and date were not supplied and
remain unverified. The post-route-promotion regression is **not independently
verified from supplied evidence**; no PASS is invented.

## 14. Chrome waiver and NOT RUN status

- Google Chrome manual workflow: **NOT RUN**.
- Chrome requirement: **explicitly waived by the project owner for route
  promotion**.
- Cross-browser acceptance: **INCOMPLETE**.
- Phase 4 is not fully cross-browser verified.

## 15. Security advisory disposition

The production-only audit reported React Router RSC-mode advisory
`GHSA-qwww-vcr4-c8h2`; the project is client-only and non-RSC, so the existing
accepted disposition remains. The full audit also reported development-only
`brace-expansion` `GHSA-rgw5-rvv9-x895`. No `npm audit fix --force` was run.
The SheetJS CVE disposition and CDN-artifact limitation remain as described in
ADR-002. `npm audit` does not fully evaluate that CDN artifact.

## 16. Scope-control audit

Source review and scope tests found no Phase 4 implementation of eligibility,
candidate pools, Web Crypto selection, Fisher–Yates shuffle, `Math.random()`
winner selection, Live draw execution, winner confirmation, redraw execution,
BroadcastChannel, export, backup/restore, backend, cloud, authentication, or
payments. Audience receives no import data.

## 17. Known limitations

- Chrome was not run and remains waived/incomplete.
- Edge post-promotion regression was not independently evidenced.
- Browser XLSX parsing has no universal latency SLA and is main-thread work.
- A Vite bundle-size warning remains.
- Audit advisories require ongoing dependency review.

## 18. Deferred Phase 5 capabilities

Eligibility rules, eligible-pool snapshots, secure winner selection, draw
execution, Live Mode result generation, confirmation, redraw, synchronization,
export, and recovery remain deferred to later phases as documented in the
roadmap.

## 19. Final acceptance decision

Phase 4 is accepted as **functionally complete with partial browser
acceptance**. It is not a full cross-browser acceptance because Chrome was not
run and the post-promotion Edge regression was not independently observed.

## 20. Approval/sign-off

| Role | Name | Date | Decision |
|---|---|---|---|
| Project owner | __________________ | __________ | __________________ |
| Engineering reviewer | __________________ | __________ | __________________ |
| Acceptance authority | __________________ | __________ | __________________ |
