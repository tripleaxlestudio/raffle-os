# Kocokan Help — Slice 2: Content & Verification

Date: 3 October 2026. Branch: `main`. Starting HEAD: `bc5bc77c3c99f4004ed1cc13b601c2aca1d89ccb`. Scope follows the owner request for Slice 2. PRD was read for context; implemented source and tests determine feature claims.

## Implementation and evidence

The existing four Help routes and Slice 1 navigation remain intact. Guide now contains the ten-step production journey, optional checklist, operator/audience concepts, event and prize preparation, CSV/XLSX import, eligibility controls, display/AV setup, Practice/Live, running presentations, pending decisions/redraw, history/export, and four distinct storage/recovery flows. Six expandable troubleshooting articles use Gejala / Periksa / Coba / Jika masih terjadi and link to the existing guide anchors. Reporting uses the existing modal and warns about participant privacy and internet access.

| Content | Main production evidence | Relevant automated evidence |
|---|---|---|
| Preparation | EventsPage, PrizeCategoriesPage, production-setup-journey | Existing production page tests |
| Import | ProductionParticipantImportPreview, participant-import-file.service (10 MiB), mapping/validation and import command | Participant import parser, mapping, command and atomic persistence tests |
| Draw settings | DrawSetupPage, DrawPresentationSettings, draw-presentation.types | Eligibility/readiness and presentation-controller tests |
| Start/presentation | ProductionDrawPresentation, draw-command, presentation-controller | Presentation controller tests: manual Stop, instant reveal, legacy timer ignored; locked result is separate from animation |
| Confirm/redraw | ProductionPendingResultsPage, pending-decisions/redraw-workflow | Redraw workflow tests and persistence contracts: original cancellation and replacement relationship retained |
| Recovery | StartupRecoveryGate, live-session-recovery, startup-recovery-arbiter | recovery-contract and live-session-recovery tests: stored results take precedence, no selection from recovery |
| History/export | HistoryPage and history export implementation | Existing history/export tests; exported confirmed Live records and XLSX text ticket cells |
| Display/AV | DisplayDesignerPrototypePage on the production route, Operator publisher, audience window controls | Existing display/presentation tests; external AV equipment itself was not tested |
| Storage | storage-service, DataStorageTab, restore validation/confirmation | Existing storage tests; manual replacement is distinct from startup recovery |

These are source-backed instructions, not a claim that the entire domain suite passes. No domain behavior or real event data was modified or exercised by the Help browser test. Browser verification used a fresh isolated profile without an active event. Actual LED/proyector/vMix hardware acceptance remains outside this slice.

Important editorial boundaries:

- Selecting an active workspace differs from activating event status; import requires a mutable draft.
- Import documents supported strategies Gabung/Ganti, explicit confirmation, diagnostics, and leading-zero limitations. Ganti is not suggested as a workaround.
- Only current Tampil Langsung and Putar & Stop Manual controls are presented. Manual rolling has no timed stop/speed choice. Reduced-motion preferences may skip countdown.
- Redraw stores a replacement request and cancels the targeted original before returning to the manual rolling flow; it does not select the replacement in the pending-results action itself.
- Pending/unknown operations are reviewed before new actions. Recovery reads authoritative saved records, rather than issuing a fresh draw.
- Backup is manual and optional. Restore replaces current data after validation, preview and confirmation; it is not generic recovery advice or a completeness guarantee.
- AV instructions cover the browser output and matching local address only. No automatic vMix/LED/capture configuration, LAN access guarantee, or all-engine compatibility claim.
- About already uses the requested short wording, centralized version and Tripleaxle credit; no marketing or product license was added.

Advice deliberately omitted: arbitrary draw retry, duplicate redraw request, clearing site data/resetting database, deleting an event to retry import, generic restore for missing results, refresh/reopen of Audience during an uncertain Live state, and a full external hardware tutorial. Issues that cannot be resolved from supported readback controls lead to reporting.

## Release and notice audit

Local release history covers v0.1.0 and v0.1.1 from their tracked release documents, and v0.1.3 from the existing distribution notes/manifest plus annotated tag boundary. Dates are explicitly labelled tag dates. The preserved v0.1.3 summary is in [release evidence](../releases/KOCOKAN-v0.1.3.md). v0.1.2 was not editorially reconstructed from raw commits. Unknown installed versions retain the unavailable-notes fallback. Version source remains package.json → build define → app-version.ts.

[Notice audit](evidence/help-slice2/notices-audit.json) records exact lock/installed versions, bundle source-map hashes, scopes and hashes of unchanged upstream texts. `audit-help-notices.mjs` inspected web and server runtime source maps, found 25 npm package installations (including nested react-is), and included 3 Windows runtime components from the existing v0.1.3 manifest: Node 22.23.2 and .NET 8.0.31 runtimes. Total: 28 component entries. Development dependencies (279 lock entries) and production-marked packages not observed in the bundles are separately inventoried. All seven direct production dependencies are represented.

The existing packaging scripts were read to establish shipped Node/.NET and npm notice copying. No installer/runtime package was built or upgraded. Node/.NET composite license texts are preserved with embedded upstream notices rather than reduced to one umbrella identifier. The original SheetJS notice remains intact. No static font/image/audio files were found under src; generated SVG UI/icons are source, while imported user assets are outside the audit. This checks representative artifacts, not legal completeness or certification. The final installer for this Help change does not exist and must be rechecked when packaged. Product terms remain “Ketentuan penggunaan Kocokan belum dipublikasikan pada build ini.”

## Verification

| Gate | Result |
|---|---|
| typecheck | PASS |
| lint | PASS |
| Focused Help/navigation/About/settings/report tests | PASS, 64 tests across 6 files |
| build | PASS; large-chunk warning remains (local full notices increase the main bundle) |
| build:runtime with sourcemaps | PASS for the notice audit; no runtime code changed |
| diff check | PASS |
| Copied upstream notices | PASS: all 30 indexed notice files match the recorded upstream SHA-256 hashes; one initial line-ending normalization was corrected before finalizing the local commit |
| Full suite before | 1,553 total; 1,445 passed; 108 failed |
| Full suite after | 1,557 total; 1,449 passed; 108 failed — NOT PASS |
| Failure-name comparison | 0 new, 0 removed, 108 unchanged |
| Isolated browser internet-offline | PASS under the boundary below |
| Viewports / keyboard | PASS for checked interactions; not a complete accessibility certification |

Commands: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run build -- --sourcemap`, `npm.cmd run build:runtime -- --sourcemap`, `git diff --check`; focused Vitest paths `src/pages/operator/help`, `src/app/shell/OperatorSidebar.test.tsx`, `src/pages/operator/settings/AboutTab.test.tsx`, `src/pages/operator/AppSettingsPage.test.tsx`, `src/pages/operator/ReportIssueModal.test.tsx`; full suite with JSON reporter before/after. Initial focused run exposed an ambiguous old query after article CTAs were added; it was scoped to the reporting card and rerun successfully. No mass rewrite of baseline domain tests. Same installed environment and runner were used before/after. [Comparison](evidence/help-slice2/full-suite-comparison.json) contains the full names of all unchanged failures.

Browser acceptance used existing bundled Playwright and installed Edge headless, against the production preview at `http://127.0.0.1:5179`. It did not access installed runtime origin `127.0.0.1:47882` or its data. A refused proxy plus request-abort rules blocked every non-local request; an external probe failed with ERR_INTERNET_DISCONNECTED. The local HTTP runtime remained available. This proves Help works without internet, including direct route and refresh; it does not claim that stopping the local server or blocking loopback permits refresh (no service worker added).

At both 1440×900 and 1366×768 all four routes rendered and refreshed, returned to About, and had no horizontal document overflow. Guide anchors focused headings below the 67px header; checklist was usable. Keyboard Enter opened native disclosures and followed guide links; visible focus rings were inspected. Long Node license text wrapped, had a bounded scroll area and scrolled with PageDown. Google Forms was opened with innocuous test text and failed externally; no form was submitted, the modal closed normally and internal navigation continued with no page errors. No external Help content requests were attempted. [Browser results](evidence/help-slice2/browser-verification.json) and eight screenshots provide evidence. Checklist, support and long-license screenshots were visually reviewed.

Upstream notice text files have scoped Git attributes disabling line-ending conversion and textual diffs. This preserves their audited bytes, including original formatting, rather than rewriting third-party text to satisfy authored-code whitespace rules. The Help JSON embeds their text for normal on-screen reading.

## Files and git

Source: HelpPages.tsx, HelpGuideContent.tsx, help-support-content.ts, help-release-notes.ts, third-party-notices.json, help.css; tests: HelpNavigation.test.tsx and HelpContent.test.tsx. Audit/verification scripts: scripts/audit-help-notices.mjs and scripts/verify-help-browser.mjs. Documentation: this report, release evidence, THIRD-PARTY-NOTICES.md, copied notices in docs/legal/licenses/help, and evidence/help-slice2 JSON/screenshots. Package/lockfile/version, routes, selection, eligibility, persistence, transport, updater and installer source are unchanged.

One semantic commit contains this report; identify its hash with `git log -1 --format="%H %s"` (the commit cannot contain its own hash). The staged stat is recorded in evidence/help-slice2/staged-stat.txt. After commit tracked diff must be empty. The two pre-existing unrelated untracked paths remain: `docs/copy/` and `docs/product/KOCOKAN-HELP-MENUS-DRAFT.md`. No push requested or performed.

## Follow-up boundaries

- Owner decision: product terms/license remain unpublished.
- Release evidence: v0.1.2 summary not independently authored; future releases require evidence before adding notes.
- Not runtime-verified here: real event recovery/redraw/storage failure and external AV hardware; Help checks do not replace those acceptances. Full-suite baseline remains failing.
- Out of scope: DataStorageTab calls createBackup without passing the centralized version; the service default is 0.1.0, so backup metadata can be stale. Prize image asset round-trip needs a separate asset-specific audit before any completeness claim. No fix made here.
- Out of scope: ConnectionsTab includes simulated integration controls; Help does not present those as functional output integrations. StartupRecoveryGate can prioritize unresolved Live work and redirect away from Help; access during such a recovery needs a separate product decision.
- Distribution: re-audit final packaging and asset notices when a new installer is requested; no legal compliance claim. Main bundle size can be revisited with local lazy-loaded notices in a separate performance task.
