# Phase 11 Plan — Accessibility, Performance, and Release Hardening

## 1. Status

**Planning artifact only — pending owner review and implementation approval.**

Owner update — 2026-08-31: Slice 11.2A is approved as the planning slot for UI
improvements and bounded feature additions, with individual items still subject
to scope approval. Comprehensive manual acceptance moves after packaging
implementation, as recorded in section 11. This does not approve unspecified
features or mark earlier slices accepted.

This document audits the post-Phase-10 baseline and proposes the final MVP
hardening slices. It creates no production behavior, schema, dependency, data,
or acceptance claim. The release-stage policy is defined separately in
[`../product/RELEASE-STAGES.md`](../product/RELEASE-STAGES.md).

## 2. Baseline

- Baseline commit: `a602c45` (`test: complete phase 10 recovery acceptance`).
- Branch before Phase 11 planning: `phase10/plan`.
- Phase 11 planning branch: `codex/phase11-planning`.
- `git status --short` was empty before the branch change and document work.
- Phase 10 implementation and automated acceptance are complete; owner
  Chrome/Edge sign-off remains pending.
- Phase 11 has no prior dedicated plan or acceptance document at this baseline.
- The roadmap ends at Phase 11. Deferred P2 backlog is not an implied Phase 12.

## 3. Objective

Turn the functionally complete local-first MVP into an evidence-backed
**Release Candidate** by:

1. removing critical accessibility and operational presentation defects;
2. making Bahasa Indonesia the approved default language across production
   Operator and Audience surfaces without changing stored domain identities;
3. validating supported browsers and target desktop/display viewports;
4. proving the required 10,000-participant and 100-winner scale behavior;
5. proving the agreed secure-selection performance target on a named device;
6. producing a reproducible local/offline release package and removing
   unintended development/debug/bundle content from it;
7. closing or explicitly waiving earlier manual acceptance debt; and
8. completing full PRD acceptance, operator rehearsal, known limitations, and
   an immutable RC evidence package.

Phase 11 does not itself declare a Release. Release requires the exact RC to
pass the agreed final rehearsal or controlled pilot and receive explicit owner
sign-off under `RELEASE-STAGES.md`.

## 4. Source-of-truth hierarchy

1. `docs/product/PRD.md` and its product invariants and acceptance criteria.
2. `TASKS.md`, especially Phase 11 scope and exit criteria.
3. `docs/product/RELEASE-STAGES.md` for readiness gates and promotion policy.
4. Accepted technical plans, ADRs, and acceptance records for implemented
   behavior.
5. This document for Phase 11 execution order and evidence boundaries.

If these sources conflict, implementation must stop at the conflict and obtain
an explicit decision. This plan does not amend the PRD.

## 5. Current baseline audit

### 5.1 Existing foundations to preserve

| Area | Current evidence and treatment |
|---|---|
| Focus presentation | A global `:focus-visible` rule and focused component rules already exist. Phase 11 audits coverage and correctness rather than replacing the design system. |
| Reduced motion | Reduced-motion media queries exist in shared, primitive, Operator, and Audience CSS. Coverage is partial and must be inventoried against every animated state. |
| Semantic UI | Production components already use labels, landmarks, status/alert regions, table semantics, and explicit mode/status text in many workflows. Phase 11 verifies the complete journey and fixes gaps. |
| Scale test fixture | `phase-5-performance.test.ts` constructs 10,000 participants and selects 1, 20, 50, and 100 winners. It intentionally records no enforceable timing threshold and therefore is not AC-NFR-002 acceptance. |
| Production commands | `lint`, `typecheck`, `test`, and `build` scripts exist and are required final gates. |
| Dev bootstrap guard | The browser acceptance bootstrap and `/dev/setup` route are guarded by `import.meta.env.DEV`. |
| Recovery | Phase 10 automated scenarios A-I pass across real Dexie boundaries under fake IndexedDB. Manual current Chrome/Edge owner evidence remains open. |
| Release warning | Accepted closeouts repeatedly record a non-blocking Vite large-chunk warning. It becomes an explicit Phase 11 investigation item. |

### 5.2 Known gaps requiring evidence or change

- There is no complete keyboard-navigation and focus-management matrix across
  Event, participant import, setup, run, Pending verification, redraw,
  History/export, Settings, dialogs, menus, and recovery gates.
- Existing reduced-motion rules do not by themselves prove that all decorative
  or rolling/countdown motion is removed or safely reduced.
- No recorded contrast audit exists for all tokens, semantic states, focus
  rings, disabled controls, overlays, and Audience branding combinations.
- Important Practice/Live, Pending, blackout, connection, destructive, and
  validation states require a systematic non-color-only review.
- Current Chrome/Edge evidence is fragmented across older phases and several
  acceptance records remain partial or deferred.
- The existing 10,000-participant performance test does not exercise a
  production browser with Web Crypto and does not enforce the PRD's less-than-
  one-second final-selection target.
- Import/XLSX work is main-thread and has no universal latency SLA; realistic
  browser profiling remains required.
- Production bundle contents and route/module boundaries have not received a
  final release audit. Prototype routes are currently declared in the shared
  router and are an investigation target, not a pre-judged deletion.
- Production user-facing copy is predominantly English and there is no
  approved localization boundary, message inventory, Indonesian terminology
  glossary, or localized-format acceptance record.
- `npm run build` creates a Vite `dist` directory, but no approved distribution
  format, reproducible packaging command, artifact manifest/checksum, local-host
  requirement, installation/launch procedure, or packaged-artifact smoke test
  is recorded. Opening the SPA directly from `file://` must not be assumed to
  satisfy BrowserRouter, module, BroadcastChannel, or same-origin requirements.
- There is no final operator rehearsal, full PRD acceptance record, known-
  limitations document, or immutable Release Candidate evidence record.

## 6. Earlier-phase acceptance debt

Phase 11 must reconcile the current implementation with these records. It must
not silently rewrite history or mark an old phase passed without observed
evidence.

| Phase | Recorded status | Phase 11 treatment |
|---|---|---|
| Phase 3 | Automated/source PASS; Chrome and Edge IndexedDB smoke pending | Execute or supersede with traceable equivalent current-browser persistence evidence. |
| Phase 4 | Functionally complete; cross-browser acceptance partial | Exercise production CSV/XLSX import, leading-zero preservation, validation, and atomic persistence in current Chrome and Edge. |
| Phase 6 | Automated verification passed; manual recovery/Live acceptance open | Reconcile stale wording against current Phase 10 recovery implementation, then run current production workflow evidence. |
| Phase 7 | Automated acceptance passed; manual integrated acceptance deferred | Run real two-window Operator/Audience, reconnect, blackout, privacy, and fullscreen checks. |
| Phase 10 | Implementation and automated acceptance complete; owner sign-off pending | Complete the documented current Chrome/Edge A-I-focused runbook using a disposable Event. |

A single Phase 11 rehearsal may supply evidence to multiple records only when
the matrix maps each observed step to every applicable acceptance ID and
preserves exact browser/device/session evidence. It must not merely state that
one broad run “covers everything.”

## 7. Scope

### 7.1 Required scope

- Operator keyboard navigation, focus visibility/order/restoration, semantic
  state, error recovery, contrast, and reduced-motion hardening.
- Non-color communication for every safety-critical state.
- Bahasa Indonesia as the default language for production Operator, Audience,
  recovery/error, accessibility, and operational guidance surfaces.
- Locale-safe date/time/number presentation while persisted timestamps, ticket
  strings, domain enum values, IDs, route contracts, audit semantics, and
  versioned export schemas remain stable.
- Current desktop Chrome and Edge verification.
- 1366 x 768, Operator 1440 x 900, and Audience 1920 x 1080 verification.
- Representative 10,000-participant import/filter/draw workflows.
- Draws up to 100 winners, including Audience fallback layout and History/
  export behavior where applicable.
- Secure-selection benchmark on an agreed event device.
- Production bundle, assets, dependencies, routes, seed/debug output, offline,
  and runtime-network audit.
- A reproducible release distribution with version/build manifest, checksums,
  third-party notices, launch instructions, local same-origin behavior, SPA
  fallback, offline operation, and packaged-artifact smoke evidence.
- An installed/portable Windows `Raffle OS Host.exe` that serves the production
  web build and launches normal Chrome/Edge without a development environment.
- Operator rehearsal, full PRD acceptance, known limitations, and RC evidence.
- Closure or explicit owner-approved disposition of earlier acceptance debt.

### 7.2 Conditional scope requiring explicit approval

- A user-facing high-readability Audience Display option.
- A user-facing large-number Audience Display option.

For the two Audience options, approval must define whether each is required for
the MVP RC, its setting/storage behavior, its interaction with branding and
winner layouts, and its acceptance scenarios. Without approval, Phase 11 only
improves the mandatory existing presentation and records the conditional item
as deferred.

The approved Windows Host direction still requires an ADR to identify the
selected technology, runtime/update model, supported Windows versions, signing
policy, install/uninstall behavior, application-data location, origin model,
BroadcastChannel/fullscreen behavior, license/security posture, and production
dependency tradeoffs before implementation.

### 7.3 Non-goals

- No backend, cloud sync, authentication, networked multi-device operation,
  online registration, payments, ticketing, messaging, or mobile remote.
- No backup/restore implementation; it remains conditional P2.
- No legal certification or claim of external audit.
- No broad visual redesign or new animation system.
- No weakening of Web Crypto selection or substitution of visual rolling for
  the final result.
- No deletion, reset, or mutation of official History to prepare acceptance
  data.
- No new dependency unless an evidenced gap cannot be met with browser APIs and
  the existing stack, and its purpose/tradeoffs receive explicit approval.
- No language switcher, multi-locale framework, or English/Indonesian runtime
  toggle unless separately approved. The approved MVP scope is an Indonesian-
  default production UI.
- No hosted/cloud deployment, NDI, or vMix plugin. No Host, installer, or
  desktop runtime implementation before the required ADR/spike is approved.

## 8. Decisions required before implementation completion

### 8.1 Benchmark device and timing contract

The owner must approve and record:

- device manufacturer/model or stable asset identifier;
- CPU, memory, operating-system build, and power mode;
- Chrome and Edge versions;
- whether the device is on AC power and what other event software is active;
- representative 10,000-participant dataset characteristics;
- exact measurement boundary for “final selection”; and
- run count and pass rule for the less-than-one-second target.

Until this contract is approved, Phase 11 may profile and report timings but
must not claim AC-NFR-002 passed.

### 8.2 Conditional Audience options

The owner must approve or defer high-readability and large-number modes. The
decision must be recorded before their implementation slice is authorized.

### 8.3 Acceptance authority and pilot policy

Record who may approve Beta, RC, and Release; whether an RC pilot is required;
whether such a pilot may use official Live Mode; and the fallback procedure.
The default is disposable rehearsal data and no official result before
Release.

### 8.4 Localization contract

Bahasa Indonesia is approved as the default language for the first MVP Release.
Slice 11.2 must fix and document:

- the Indonesian terminology glossary for Event, Participant, Practice, Live,
  Pending, Confirmed, Cancelled, redraw, replacement, eligible pool, Audience,
  blackout, History, audit, recovery, and export;
- which production copy, accessible names, validation, errors, toasts, empty
  states, confirmations, and operator guidance must be translated;
- `id-ID` date/time presentation while storage remains unambiguous ISO time;
- whether existing versioned CSV/XLSX headers remain stable or require a new
  explicitly versioned localized export contract; and
- fallback behavior for an accidentally missing message.

Internal domain enums, IDs, ticket strings, audit action semantics, storage
keys, routes, protocol fields, and persisted records must not be translated.
Prototype/dev-only diagnostics are outside the release-language gate unless
they are included in the approved production package.

### 8.5 Packaging contract

The approved product direction is a Windows local Host executable that serves
the production web application and launches the normal Chrome/Edge browser.
The target laptop must not require Laragon, XAMPP, Node.js, npm, Vite, PHP, an
external web server, or internet access. The detailed contract is recorded in
[`../architecture/LOCAL-HOST-RUNTIME.md`](../architecture/LOCAL-HOST-RUNTIME.md).

Slice 11.0 records the decision in the acceptance matrix. Slice 11.5A must
select and justify the Host/runtime and installer technology through an ADR and
focused spike before implementation dependencies are added.

The decision must cover artifact contents and size, reproducible build command,
checksums, third-party notices, supported Windows/browser/runtime versions,
same-origin Operator/Audience behavior, IndexedDB data location and upgrade
compatibility, install/update/uninstall/rollback behavior, offline launch,
security/signing expectations, and smoke-test procedure.

No `file://` launch, Electron/Tauri-style wrapper, specific Host runtime,
installer toolchain, or signing mechanism is approved by this plan alone.

## 9. PRD and task traceability

| Requirement | Phase 11 evidence |
|---|---|
| PRD compatibility 15.3; AC-NFR-003 | Current Chrome/Edge critical-workflow matrix and target viewport evidence. |
| PRD usability/accessibility 15.5 | Keyboard, focus, contrast, reduced motion, error recovery, and non-color audit. |
| Approved MVP release language | Indonesian production-copy inventory, glossary, localized UI/error/accessibility tests, and locale-format review without persisted-domain translation. |
| AC-NFR-001 | Realistic 10,000-participant import, filter, setup, and draw run without failure. |
| AC-NFR-002 | Approved-device production-browser secure-selection benchmark for up to 100 winners, outside animation. |
| AC-NFR-004 to AC-NFR-007 | Strict typecheck, domain `any` audit, required unit suites, and domain/UI separation review. |
| AC-EVT-001 to AC-EVT-004 | Local persistence, offline, refresh, exact Pending-result recovery, and IndexedDB/localStorage evidence. |
| AC-AUD-001 to AC-AUD-007 | Two-window transport, privacy, state/layout/readability, reconnect, branding, audio fallback, and 1920 x 1080 evidence. |
| AC-MOD/OPS | Practice/Live non-color distinction, isolation, confirmation, status, blackout, and destructive-action evidence. |
| AC-IMP/DRW/RNG/RES/HIS | Full operator rehearsal and focused automated/manual traceability. |
| TASKS Phase 11 release verification | Commands, bundle/dependency/assets, seed/debug cleanup, rehearsal, manual PRD acceptance, and known limitations. |
| Approved release packaging | Packaging ADR/decision, reproducible artifact, manifest/checksum/notices, offline launch, same-origin/SPA fallback, persistence-upgrade, and packaged smoke evidence. |
| `RELEASE-STAGES.md` RC gate | Immutable candidate identity, no RB0/RB1 blockers, limitations, evidence package, and owner RC decision. |

## 10. Implementation slices

### Slice 11.0 — Baseline, decisions, and acceptance matrix

Create a current evidence inventory without changing production behavior.
Reconcile Phase 3/4/6/7/10 acceptance debt, classify current findings with the
release-blocker model, define the benchmark contract, record conditional
Audience-option decisions, and build one traceability matrix from every PRD
acceptance ID to automated evidence, manual evidence, or an explicit gap.

Deliverables:

- accepted benchmark-device/timing contract;
- approved/deferred Audience-option decisions;
- approved localization glossary/contract;
- approved release-packaging format and ADR requirement;
- named acceptance authority and pilot policy;
- browser/viewport/workflow matrix;
- accessibility audit checklist;
- PRD acceptance evidence index;
- initial known-limitations and blocker register.

### Slice 11.1 — Accessibility and motion hardening

Audit and fix production Operator and Audience behavior. Cover tab order,
keyboard-only completion, skip/focus entry where needed, focus containment and
restoration for dialogs/menus, visible focus under every theme/state, semantic
names and status announcements, error recovery, contrast, reduced motion, and
non-color safety communication. Remove decorative animation that adds no
operational value.

Add focused component/integration regressions for every changed behavior. Use
manual keyboard and assistive-technology checks where DOM tests cannot prove
the user experience. Do not add an accessibility dependency by default.

### Conditional Slice 11.1A — Approved Audience readability options

Run only after the decisions in 8.2 authorize it. Implement the smallest
setting/domain/persistence/UI change necessary, preserve public-payload privacy,
and test 1, 6, 10, 20, and fallback-to-100 layouts with representative ticket
lengths and branding combinations.

### Slice 11.2 — Bahasa Indonesia localization

Inventory every user-facing production string and establish a small typed
message boundary using the existing stack unless a new dependency is separately
justified and approved. Translate Operator and Audience navigation, actions,
status, validation, confirmations, destructive warnings, recovery guidance,
errors, toasts, empty/loading states, accessible names, and operational copy
into clear Bahasa Indonesia.

Preserve domain and persistence contracts. Ticket numbers remain exact strings;
domain enums, audit actions, protocol fields, routes, storage keys, IDs, and ISO
timestamps are not translated. Format user-visible dates/times through approved
`id-ID` browser APIs. Do not silently rename versioned CSV/XLSX headers; follow
the decision recorded in 8.4.

Add tests that detect missing production messages, protect safety-critical
wording and accessible names, and verify that localization cannot modify domain
values or official records. Review long Indonesian labels at every target
viewport and Audience layout. A language switcher and English fallback UI are
not part of this slice.

### Slice 11.2A — UI improvements and bounded feature additions

Owner approved this slice designation on 2026-08-31. It is a planning slot,
not blanket implementation approval. The owner-approved item register is in
`TASKS.md`; 11.2A-01 covers the Audience connection indicator UI fix, and
11.2A-02 covers wider standby text and a clean Audience surface without
fullscreen controls. Browser fullscreen via F11 is the owner-approved Windows
workflow; do not place fullscreen buttons, status overlays, or shortcut hints
on the public stage. Existing protocol capability fields remain unchanged.

Collect proposed UI refinements and small operator-facing features. Before
implementing each item, record its purpose, affected screens, scope/exclusions,
domain or persistence impact, acceptance checks, and explicit owner approval in
the Phase 11 section of `TASKS.md`. Synchronize affected plans and acceptance
records; amend product requirements only with explicit approval when needed.

UI work may include layout, spacing, controls, tables, empty states, and
navigation clarity. Feature size must be assessed by behavioral/data impact,
not by the size of its UI. Changes to draw rules, eligibility, official History,
audit, recovery, persistence, or dependencies require a separate explicit
impact review and approval. Conditional Audience readability options remain
in Slice 11.1A. Existing non-goals and product invariants still apply.

Implement approved items in focused, reviewable groups: implement, verify, then
commit before starting the next group. Keep Indonesian copy and accessibility
consistent. Run focused regressions and the required automated slice gates;
comprehensive Chrome/Edge manual sign-off is deferred to the final session,
not replaced by automated tests. Reconcile the known 11.2 full-suite failures
before closing the next development slice.

### Slice 11.3 — Browser, viewport, and cross-phase acceptance

Execute in the final acceptance session after 11.5A-D, alongside 11.5E and
the final packaged-build benchmark. The slice ID and evidence obligations do
not change; deferral is not acceptance or a waiver.

Run the critical workflow in current Chrome and Edge using disposable Events.
Exercise 1366 x 768 and 1440 x 900 Operator layouts plus 1920 x 1080 Audience.
Close the traceable Phase 3/4/6/7/10 browser evidence, including real
IndexedDB, CSV/XLSX, reload/recovery, two-window BroadcastChannel, blackout,
fullscreen capability, reconnect, privacy, and repeated recovery.

Only defects demonstrated by the matrix are fixed in this slice. Every fix gets
the narrowest deterministic regression plus rerun of its affected manual row.

### Slice 11.4 — Scale and performance hardening

Create or reuse deterministic bounded fixtures for 10,000 participants and up
to 100 winners. Profile parsing/import, IndexedDB commit/read, eligibility,
candidate-pool construction, secure final selection, UI responsiveness,
Audience rendering, History, and export on the agreed environment.

The mandatory PRD SLA applies to the agreed final-selection boundary, outside
animation. Supporting pipeline timings must be reported separately so a fast
selector cannot hide a frozen UI or unusable import. Automated algorithm tests
remain deterministic and should avoid flaky wall-clock thresholds; the RC
timing claim comes from the approved real-browser benchmark protocol.

Optimize only measured bottlenecks. Preserve ticket strings, unbiased Web
Crypto selection, snapshot integrity, once-per-draw uniqueness, Practice
isolation, transaction atomicity, and public-payload privacy.

### Slice 11.5 — Release packaging, bundle, and production cleanup

First complete the approved Host technology ADR/spike from 8.5. Produce the
chosen reproducible local/offline distribution, version/build manifest, checksums,
third-party notices, launch/install/update/rollback guidance, and packaged smoke
test. Verify Operator and Audience share the required origin, SPA deep links
resolve after reload, IndexedDB persists across an allowed update, and the core
workflow launches and operates offline on the target Windows environment.

Inspect the packaged production build manifest/chunks and runtime behavior.
Explain each material chunk and dependency, verify SheetJS remains lazy and
offline, assess prototype route/module inclusion, remove unintended production
seed/debug entry points and output, and ensure the core workflow performs no
network call.

The existing large-chunk warning must receive one of these evidence-backed
dispositions:

1. reduce/code-split the material production path;
2. configure a justified limit after proving the chunk is intentional and
   acceptable on the benchmark device; or
3. record it as an accepted limitation with owner approval.

Raising the warning limit solely to silence the build is not acceptance.

The approved Host executable/runtime must not become a second draw engine or
persistence authority. Web Crypto, official IndexedDB records,
same-origin Audience transport, fullscreen behavior, and forward-compatible
stored data must remain governed by the existing application contracts.

Execute this slice through the bounded sub-slices defined in
`LOCAL-HOST-RUNTIME.md`:

- **11.5A:** architecture ADR and technology spike;
- **11.5B:** production loopback Host/server;
- **11.5C:** Windows launcher and lifecycle;
- **11.5D:** portable and installer packaging; and
- **11.5E:** clean-machine packaged production acceptance.

### Slice 11.6 — Integrated rehearsal and RC closeout

Freeze feature scope, identify the candidate commit, run all required commands,
complete manual PRD acceptance against the packaged Indonesian build, execute
the operator rehearsal, publish known limitations and operational runbooks,
reconcile exports with confirmed local History, and record the Beta/RC decision
under `RELEASE-STAGES.md`.

Any code change after candidate identification creates a new RC and requires
the impacted matrix plus full release commands to rerun.

## 11. Dependency and execution order

```text
11.0 Baseline, decisions, and evidence matrix
        |
        v
11.1 Accessibility hardening
        |
        v
11.2 Indonesian localization
        |
        v
11.2A Approved UI improvements and bounded feature additions
        |
        v
11.4 Scale/performance hardening
        |
        v
11.5A-D Packaging implementation, bundle, and cleanup
        |
        v
Final acceptance: 11.3 + 11.5E + final 11.4 benchmark
        |
        v
11.6 Integrated rehearsal and RC closeout
```

Conditional Slice 11.1A follows 11.0 approval and must complete before the
browser/viewport acceptance that certifies its presentation.

This owner-directed execution order was recorded on 2026-08-31. Slice numbers
remain stable. Manual acceptance for 11.1/11.2 remains pending until observed
in the final session; this schedule does not close the recorded automated-test
failures or waive any Beta/RC/Release gate.

Slice 11.4 still requires early profiling to justify optimization. Final
approved-device measurements run against the packaged build and must be
repeated after every performance-relevant change. Focused tests and full
automated slice gates remain required during development. Packaging work may
begin only after the 11.0 distribution decision, with Host implementation
subject to the 11.5A ADR/spike gate.

## 12. Automated verification requirements

- Preserve and extend focused tests at the narrowest domain/application/UI
  boundary for every functional change.
- Keep random-helper tests deterministic: verify bounds, rejection behavior,
  and duplicate prevention, never statistical randomness.
- Preserve exact `00042` and `42` identities through import, persistence,
  selection, Audience, History, recovery, CSV, and XLSX.
- Add keyboard/focus regressions for changed menus, dialogs, destructive
  confirmations, and recovery gates.
- Add reduced-motion and non-color state assertions where stable DOM/style
  contracts can express the requirement.
- Add localization inventory/coverage tests and assert that translation changes
  presentation only, never domain values, official records, or ticket strings.
- Keep 10,000/100 algorithm evidence non-flaky; do not disguise a device
  benchmark as a CI unit test.
- Verify production route/module guards and absence of debug globals/output
  with source/build tests where practical.
- Add packaged-artifact smoke automation where the selected distribution can be
  tested deterministically; retain real launch/update/browser checks manually.
- Run focused tests during each slice, followed by full `lint`, `typecheck`,
  `test`, and `build` before its completion report.

## 13. Manual browser and viewport matrix

The final matrix must record browser/version, OS, device, viewport, Event ID,
DrawSession ID where applicable, operator, date/time, result, and evidence.

| Journey | Chrome | Edge | Viewport/display | Required evidence |
|---|---|---|---|---|
| Event create/open/autosave/reload | Required | Required | 1366 x 768 and 1440 x 900 | Exact Event identity and persisted data; no duplicate or loss |
| CSV/XLSX import | Required | Required | Operator targets | Mapping, validation, `00042`/`42`, Replace/Merge atomicity |
| Practice rehearsal | Required | Required | Operator plus Audience | No official History/eligibility mutation |
| Live start and Pending recovery | Required | Required | Operator plus Audience | Same session/winner/snapshot after reload; no reselection |
| Partial confirmation and redraw | Required | Required | Operator targets | Status split, required reason, cancelled/replacement lineage |
| Audience transport | Required | Required | 1920 x 1080 | Two-window states, reconnect, blackout, privacy, fullscreen |
| History and export | Required | Required | Operator targets | Confirmed-only export reconciles; ticket strings preserved |
| Offline journey | Required | Required | Intended event setup | Core workflow completes without runtime network dependency |
| Keyboard/reduced motion | Required | Required | All targets | Complete critical actions, visible focus, reduced/nonessential motion |
| Indonesian localization | Required | Required | All production targets | Complete, clear copy; no clipping; correct accessible names and `id-ID` presentation; stable domain/export contract |
| 10,000/100 scale | Required on benchmark browser(s) | Compatibility run required | Agreed device and targets | No failure; separate pipeline and final-selection timings |
| Packaged artifact | Required | Required where browser-based | Target Windows/device | Offline launch, deep-link reload, same-origin Audience, persistence across approved update, checksum/version identity |

## 14. Operator rehearsal checklist

At minimum, the final rehearsal must include:

1. install/unpack and launch the identified packaged artifact, then verify its
   version/checksum, device power, browser/runtime version, viewport/display,
   offline readiness, storage readiness, Web Crypto, and Audience connection;
2. create/open a disposable Event and import a representative file containing
   exact `00042` and `42` tickets plus invalid/duplicate examples;
3. resolve validation, configure categories/rules, and verify eligible counts;
4. complete Practice without changing official eligibility or History;
5. complete Live start, Audience countdown/rolling/reveal, Pending
   verification, partial confirmation, cancellation, and reasoned redraw;
6. refresh Operator and Audience at the approved recovery points and verify
   exact identity/no duplicate records;
7. exercise disconnect, reconnect, blackout, Show/Hide, fullscreen capability,
   and audio failure fallback without private Audience data;
8. complete History/search/audit review and reconcile CSV/XLSX exports;
9. repeat the agreed scale/performance protocol; and
10. verify all production guidance and safety-critical copy in Bahasa Indonesia,
    including recovery and destructive confirmations; and
11. record limitations, deviations, blocker classification, operator notes,
    and the promotion decision.

## 15. Release artifacts produced during implementation

Phase 11 implementation is expected to create or update:

- the traceable Phase 11 acceptance record;
- the benchmark-device and performance evidence record;
- the browser/viewport/cross-phase evidence matrix;
- the accessibility audit and remediation record;
- the Indonesian terminology glossary, localization inventory, and coverage
  evidence;
- the packaging decision/ADR, reproducible packaging command, artifact
  manifest/checksum, third-party notices, and launch/update/rollback runbook;
- the operator rehearsal/runbook;
- the known-limitations document;
- affected earlier acceptance records, without erasing their historical
  baseline; and
- the RC promotion record using the template in `RELEASE-STAGES.md`.

Exact filenames should be fixed in Slice 11.0 so later slices append evidence
to stable documents rather than creating competing sources of truth.

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| “Polish” changes alter draw integrity | Keep domain selection/persistence boundaries unchanged unless a measured defect requires a focused fix and regression evidence. |
| Old acceptance records are marked passed by assumption | Preserve historical statements; append current evidence with exact browser/device/build identity. |
| Visual automation is mistaken for accessibility proof | Combine deterministic component tests with manual keyboard, contrast, motion, and real-browser review. |
| CI timing is flaky or faster than event hardware | Keep algorithm tests threshold-free; use the approved real-browser/device benchmark for the SLA. |
| Optimization corrupts ticket identity or ordering | Assert exact strings, snapshots, order, uniqueness, and export round-trip before and after every optimization. |
| Bundle warning is hidden rather than resolved | Require measured explanation, real code split, or explicit accepted limitation; never change the limit alone. |
| Brand colors break contrast/readability | Validate safe defaults and bounded user-configurable combinations; provide actionable fallback where required. |
| Translation changes domain/audit/export meaning | Translate presentation copy only; preserve internal values and version any approved export-label change. |
| Indonesian labels overflow accepted layouts | Test representative longest labels at every required viewport and adjust components without hiding critical actions. |
| Packaging changes origin or storage identity | Require an ADR and packaged tests for same origin, BroadcastChannel, IndexedDB location/upgrades, deep links, and rollback. |
| Installer/runtime adds security and maintenance risk | Compare options, minimize dependencies, document provenance/licenses/signing/update policy, and obtain explicit approval. |
| Acceptance data damages official History | Use named disposable Events and prohibit destructive manipulation of an official Event. |
| Stage labels overstate readiness | Require immutable evidence and explicit promotion; Phase 11 targets RC, not automatic Release. |

## 17. Exit criteria

Phase 11 is complete only when:

- all required available verification commands pass on the identified
  candidate commit;
- all PRD acceptance criteria are mapped to current passing evidence, an
  explicitly approved waiver, or a release-blocking open item;
- core workflows pass current Chrome and Edge manual acceptance;
- required target viewports and Audience layouts pass;
- keyboard, focus, contrast, reduced-motion, and non-color communication have
  no critical unresolved issue;
- production Operator/Audience/error/accessibility copy is complete in approved
  Bahasa Indonesia, fits target layouts, and leaves domain/persistence/export
  contracts stable or explicitly versioned;
- 10,000-participant and 100-winner workflows complete without failure;
- the approved secure-selection benchmark meets the PRD target;
- no RB0 or RB1 defect remains open;
- no critical data-integrity or Audience privacy issue remains;
- production bundle/dependency/asset/seed/debug findings have an accepted
  disposition;
- the approved release package is reproducible, identified by version and
  checksum, launches offline, preserves same-origin Operator/Audience behavior,
  reloads SPA routes, and preserves IndexedDB data across the approved update
  path;
- earlier Phase 3/4/6/7/10 acceptance debt is closed or explicitly waived;
- operator rehearsal, offline/recovery checks, and full PRD manual acceptance
  are recorded;
- known limitations and operational runbooks are published; and
- the owner or delegated authority records the Release Candidate decision.

If any required condition is not met, the build remains Alpha/Beta as supported
by its evidence. Phase 11 must not be marked complete merely because all planned
code slices were attempted.

## 18. Explicit implementation boundary

This plan authorizes no production-code, UI, schema, migration, dependency,
route, persistence, test-fixture, or production-data change by itself.
Implementation begins only after owner review of this plan and explicit
approval of the applicable slice. Conditional Audience options and any new
dependency require their own approvals.
