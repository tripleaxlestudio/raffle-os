# Phase 11 Slice 11.0 Baseline and Decision Register

## Status

**BASELINE RECORDED — OWNER DECISIONS REMAIN OPEN**

This record fixes the Phase 11 evidence structure, inventories the inherited
baseline, and separates observed evidence from assumptions. It changes no
production behavior, dependency, schema, or stored data.

## Baseline identity

| Field | Value |
|---|---|
| Phase 10 baseline | `a602c45` — `test: complete phase 10 recovery acceptance` |
| Approved Phase 11 plan | `d4a6adf` — `docs: define phase 11 release hardening plan` |
| Implementation branch | `codex/phase11` |
| Initial stage | Internal Alpha for planning purposes |
| Release language | Bahasa Indonesia is approved as the default production language |
| Packaging direction | Windows local Host serving the production web build in normal Chrome/Edge |

The exact candidate commit and artifact identity remain unset. Phase 11 does
not create a Release or authorize official Live operation by itself.

## Stable evidence files

Later slices must update these paths instead of creating competing records:

| Evidence | Stable path | First owning slice |
|---|---|---|
| Baseline and decision register | `docs/technical/PHASE-11-BASELINE.md` | 11.0 |
| PRD acceptance index and Phase 11 verdict | `docs/technical/PHASE-11-ACCEPTANCE.md` | 11.0 |
| Browser, viewport, and cross-phase matrix | `docs/technical/PHASE-11-BROWSER-MATRIX.md` | 11.0, executed in 11.3 |
| Accessibility audit and remediation | `docs/technical/PHASE-11-ACCESSIBILITY-AUDIT.md` | 11.1 |
| Indonesian glossary, inventory, and coverage | `docs/product/INDONESIAN-LOCALIZATION.md` | 11.2 |
| Benchmark contract and measurements | `docs/technical/PHASE-11-PERFORMANCE.md` | 11.0, executed in 11.4 |
| Windows Host technology decision | `docs/architecture/ADR-003-windows-local-host.md` | 11.5A |
| Packaging and artifact runbook | `docs/operations/WINDOWS-PACKAGING.md` | 11.5 |
| Operator rehearsal | `docs/operations/OPERATOR-REHEARSAL.md` | 11.6 |
| Known limitations | `docs/product/KNOWN-LIMITATIONS.md` | 11.0, finalized in 11.6 |
| RC promotion record | `docs/product/RELEASE-CANDIDATE.md` | 11.6 |

## Inherited evidence inventory

| Area | Inherited evidence | Current Phase 11 disposition |
|---|---|---|
| Persistence | Phase 3 source/automated acceptance passed; Chrome and Edge smoke rows remain NOT RUN | Current-browser evidence required |
| Participant import | Phase 4 automated and Edge evidence passed; Chrome was waived for route promotion | Full current Chrome and Edge production import required |
| Draw presentation | Phase 6 automated evidence passed; recovery-related browser rows remained open | Supersede through current recovery/browser matrix |
| Audience transport | Phase 7 automated integration passed; manual two-window/fullscreen acceptance was deferred | Real two-window Chrome and Edge evidence required |
| Recovery | Phase 10 implementation and automated A-I acceptance passed | Owner Chrome/Edge sign-off remains pending |
| Scale | Deterministic 10,000-participant and 1/20/50/100-winner test exists | Real-browser pipeline and device timing are not yet accepted |
| Accessibility | Global focus and partial reduced-motion CSS exists | Complete workflow, contrast, focus, semantics, and motion audit required |
| Localization | No production localization contract or coverage mechanism exists | Required release gap; Slice 11.2 |
| Bundle | Vite build passes with an inherited large-chunk warning | Explain, split, or explicitly accept after measurement |
| Packaging | `dist` can be built, but no approved Host technology or release artifact exists | ADR/spike and reproducible offline package required |

Inherited PASS labels are historical evidence. They are not a substitute for
fresh verification on the eventual candidate commit.

## Decision register

| ID | Decision | Status | Current rule / next evidence |
|---|---|---|---|
| D11-001 | Default release language | APPROVED | Bahasa Indonesia; presentation only, with stored domain identities unchanged |
| D11-002 | Windows distribution direction | APPROVED DIRECTION | Local Host executable plus normal Chrome/Edge; technology remains subject to ADR-003 and spike |
| D11-003 | High-readability Audience option | OWNER DECISION REQUIRED | Do not implement until approved or deferred |
| D11-004 | Large-number Audience option | OWNER DECISION REQUIRED | Do not implement until approved or deferred |
| D11-005 | Benchmark device and timing protocol | OWNER DECISION REQUIRED | Record exact hardware, OS, browsers, power mode, dataset, timing boundary, repetitions, and pass rule |
| D11-006 | Beta/RC/Release acceptance authority | OWNER DECISION REQUIRED | Name the person or delegated role allowed to sign promotion records |
| D11-007 | RC pilot policy | OWNER DECISION REQUIRED | Default is disposable data and no official result; any Live pilot requires explicit risk/fallback approval |
| D11-008 | Localized export headers | PENDING SLICE 11.2 | Preserve existing versioned headers unless an explicitly versioned replacement is approved |
| D11-009 | Host runtime, canonical port, browser pinning, signing, and installer | PENDING ADR-003 | No runtime or production dependency is approved by the planning direction alone |

## Browser and viewport contract

The required matrix is fixed as follows:

- current desktop Google Chrome and Microsoft Edge;
- Windows target environment;
- Operator at 1366 x 768 and 1440 x 900;
- Audience at 1920 x 1080, 16:9;
- same-origin Operator/Audience windows;
- network disabled for the offline journey; and
- disposable Events only unless a separately approved pilot says otherwise.

Every execution row must record browser/version, OS, device, viewport, Event
ID, DrawSession ID when applicable, operator initials, time, result, and notes
or captured evidence.

## Accessibility audit contract

Slice 11.1 must cover the complete production journey, including navigation,
menus, dialogs, Live confirmations, Pending verification, redraw, History,
Settings, recovery gates, blackout, and Audience states. Evidence must address:

- keyboard-only completion and logical tab order;
- visible focus, containment, and restoration;
- landmarks, names, descriptions, status/alert announcements, and errors;
- contrast for normal, disabled, focus, semantic, overlay, and branding states;
- reduced motion and removal of nonessential animation; and
- non-color identification of Practice/Live, connection, blackout, Pending,
  destructive, recovery, and validation states.

DOM tests may support but cannot replace manual keyboard, visual contrast, or
assistive-technology checks.

## Initial blocker and limitation register

| ID | Level | Finding | Evidence / disposition |
|---|---|---|---|
| P11-001 | RB1 | Required Indonesian production UI is not implemented | Source inventory shows production English copy; blocks RC until Slice 11.2 passes |
| P11-002 | RB1 | Current Chrome/Edge integrated workflow evidence is incomplete | Phase 3/4/6/7/10 acceptance records contain NOT RUN, waiver, deferred, or pending rows |
| P11-003 | RB1 | No approved executable Host or reproducible offline release package exists | `npm run build` only produces web assets; blocks RC packaging gate |
| P11-004 | RB1 | Required benchmark device and `< 1 second` protocol are not approved or executed | Existing unit-scale test deliberately has no wall-clock acceptance threshold |
| P11-005 | RB2 | Prototype modules/routes are statically included by the shared router | Audit in Slice 11.5; remove or isolate only with focused regression evidence |
| P11-006 | RB2 | Production build has an inherited large-chunk warning | Measure and split, justify, or obtain owner acceptance; do not only raise the limit |
| P11-007 | RB2 | Full accessibility/contrast/motion evidence does not exist | Audit and remediate in Slice 11.1 |
| P11-008 | Limitation | Browser-local data is profile-and-origin scoped | Must remain visible in packaging/update guidance; no automatic dev-origin migration is promised |
| P11-009 | Limitation | Backup/restore remains deferred P2 | Must not be implied by packaging or recovery claims |

No RB0 integrity or Audience-privacy defect was identified by this documentation
and source baseline audit. That statement is not a fresh runtime acceptance
result.

## Slice 11.0 exit checklist

- [x] Stable evidence filenames are fixed.
- [x] Earlier Phase 3/4/6/7/10 acceptance debt is inventoried.
- [x] Browser, viewport, accessibility, and evidence-recording contracts are fixed.
- [x] Localization and packaging decisions already made by the owner are recorded.
- [x] Initial blocker and known-limitation register exists.
- [ ] High-readability and large-number Audience options are approved or deferred.
- [ ] Benchmark device and timing protocol are approved.
- [ ] Acceptance authority and pilot policy are approved.
- [x] Fresh branch verification is recorded in `PHASE-11-ACCEPTANCE.md`.

Slice 11.1 may begin after this baseline is committed. Conditional Audience
options and the final benchmark claim remain gated by their owner decisions.
