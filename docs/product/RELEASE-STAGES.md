# Raffle OS Release Stages

## 1. Purpose

This document defines when a Raffle OS build may be called **Alpha**, **Beta**,
**Release Candidate**, or **Release**. The stages are operational readiness
gates, not feature-marketing labels. A stage is earned through recorded
evidence and an explicit decision; it must not be inferred from the presence of
code, a successful production build, or the completion of one implementation
phase alone.

This policy supplements the product requirements in [`PRD.md`](./PRD.md). If a
stage rule conflicts with the PRD, the PRD and the product invariants remain
authoritative and the conflict must be resolved before promotion.

## 2. Current project disposition

The post-Phase-10 baseline is treated as an **Internal Alpha** for planning
purposes. Core MVP capabilities exist and the automated recovery acceptance is
complete, but browser/manual acceptance debt and Phase 11 accessibility,
performance, compatibility, and release-hardening work remain open.

This disposition does not authorize official Live use. It is not a Beta,
Release Candidate, or Release declaration.

## 3. Rules shared by every stage

- Stage promotion requires an immutable build identity: version or release
  label, Git commit, build date, and evidence record.
- A later stage includes every gate from the earlier stages.
- A waiver must name the unmet gate, evidence available, operational risk,
  workaround, approver, and expiry or review point.
- A waiver cannot permit violation of a product invariant, selection-integrity
  rule, official-history rule, or Audience privacy boundary.
- Practice Mode must be used for rehearsal unless a separately approved pilot
  explicitly permits Live Mode.
- Alpha, Beta, and ordinary Release Candidate testing must use disposable or
  approved copied data. Official event history must never be reset or
  corrupted to manufacture a test condition.
- Local-first limitations, browser-storage limitations, and the absence of
  legal or external audit certification must remain visible in release
  documentation.
- Promotion is a product-owner or delegated acceptance-authority decision, not
  an automatic result of CI or a developer declaration.

## 4. Internal Alpha

### 4.1 Purpose

Internal Alpha validates that the MVP capabilities can work together on a
controlled development baseline. Defects, incomplete browser evidence, and UX
gaps are expected, but selection and data-integrity invariants must already be
protected.

### 4.2 Entry criteria

- The intended MVP workflow is represented in production code rather than
  presentation-only prototypes.
- Core domain logic is separated from React presentation code and can be
  tested independently.
- Official selection uses Web Crypto without a `Math.random()` fallback.
- Ticket numbers remain strings through the implemented path.
- Automated tests cover selection bounds, duplicate prevention, eligibility,
  Practice isolation, confirmation, redraw lineage, persistence, and recovery.
- The available lint, typecheck, test, and build commands have a recorded
  passing baseline, or every failure is explicitly classified.
- No known Release Blocker 0 issue is open.

### 4.3 Permitted use

- Development, automated testing, internal review, and deterministic
  rehearsal with disposable data.
- Practice Mode and Live-path simulation where the result is not treated as an
  official event result.

### 4.4 Exit to Beta

The build may leave Alpha only after the Beta entry criteria below are
supported by current evidence on the intended operator environment.

## 5. Beta

### 5.1 Purpose

Beta validates the product with representative operators and event-like data
on supported browsers and display arrangements. The product should be
functionally stable, but operational feedback and non-critical defects are
still expected.

### 5.2 Entry criteria

- All Alpha criteria remain satisfied.
- Critical Operator workflows can be completed by keyboard, with visible
  focus and no critical accessibility blocker.
- Important states are not communicated by color alone.
- Required reduced-motion behavior is available and verified.
- Production Operator and Audience copy is available in the approved release
  language. For the first MVP Release, Bahasa Indonesia is the required
  default release language.
- Critical workflows pass on current desktop Chrome and Edge.
- The Operator remains usable at 1366 x 768 and its target 1440 x 900.
- The Audience Display remains correct and readable at 1920 x 1080, 16:9.
- Representative import, eligibility, draw, verification, redraw, history,
  export, Audience, offline, and recovery rehearsals complete without a
  Release Blocker 0 or 1 issue.
- A 10,000-participant/100-winner test dataset can complete the required
  workflows without failure.
- Known limitations, recovery guidance, and the feedback channel are available
  to every Beta operator.

### 5.3 Permitted use

- Supervised operator trials and full rehearsals with disposable, synthetic,
  or explicitly approved copied data.
- Event-like two-window Operator/Audience testing on the intended hardware.

Beta does **not** authorize an official raffle result. Live Mode may be
exercised only as a clearly identified simulation whose records are not used as
official event outcomes.

### 5.4 Exit to Release Candidate

- Every required Phase 11 exit criterion is satisfied.
- Earlier-phase acceptance debt is closed or covered by a valid explicit
  waiver.
- No Release Blocker 0 or 1 issue remains open.
- The release-candidate evidence package is complete.

## 6. Release Candidate

### 6.1 Purpose

A Release Candidate is a build believed to be ready for production. Feature
scope is frozen. Only blocker fixes, evidence corrections, and release
documentation changes are allowed before the Release decision.

### 6.2 Entry criteria

- All Beta criteria remain satisfied.
- Phase 11 accessibility, localization, browser, viewport, scale, performance,
  production packaging, bundle, cleanup, and acceptance work is complete.
- `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` pass
  on the identified candidate commit.
- The agreed benchmark proves secure final selection of up to 100 winners in
  less than one second on the approved event device, outside visual animation.
- Manual PRD acceptance and the operator rehearsal checklist are complete.
- Offline operation, refresh recovery, Audience reconnect, partial
  confirmation recovery, and repeated recovery have current Chrome/Edge
  evidence.
- Confirmed CSV/XLSX exports reconcile with immutable local History.
- The production bundle contains no unintended development seed, debug output,
  prototype-only entry path, remote runtime dependency, or unexplained asset.
- The approved distribution package can launch offline on the target event
  device, keeps Operator and Audience on the required same origin, supports SPA
  route fallback, and is reproducible from the identified commit.
- The packaged Windows local Host serves the production build and launches the
  normal supported browser without Laragon, XAMPP, Node.js, npm, Vite, PHP, an
  external web server, or internet access on the target laptop.
- Known limitations and operational runbooks are complete.
- The exact candidate commit, browser versions, operating system, benchmark
  device, test dataset, packaging format, artifact checksum, results, approver,
  and date are recorded.

### 6.3 Change-control rule

Any code change after an RC is identified creates a new RC. The impacted
focused verification and the full release commands must be rerun. A fix must
not be applied directly to a previously approved artifact while retaining the
old RC identity.

### 6.4 Permitted use

- Final rehearsal with the exact intended browser, display, device, and
  operator arrangement.
- A controlled pilot only when the owner explicitly approves the data,
  operational risk, fallback, and treatment of the pilot result.

Without that approval, an RC still does not authorize an official raffle.

### 6.5 Exit to Release

- The exact RC passes the agreed final rehearsal or controlled pilot.
- No unresolved Release Blocker 0 or 1 issue exists.
- Known limitations are accepted by the owner.
- Product-owner or delegated acceptance-authority sign-off is recorded.

## 7. Release

### 7.1 Meaning

Release is the first stage that authorizes the identified artifact for
official Live raffle operation within its documented environment and known
limitations. Release does not imply legal certification, external audit, cloud
durability, or protection against a person with full access to the device.

### 7.2 Required release record

The release record must contain:

- product version and Git commit;
- artifact/build identity and build date;
- packaging format, artifact checksum, installation/launch instructions, and
  third-party notices;
- supported Chrome and Edge versions;
- supported operating system and target viewport/display configuration;
- benchmark device and dataset;
- verification-command results;
- manual acceptance and rehearsal results;
- known limitations and accepted waivers;
- rollback or fallback procedure;
- approver identity and approval date.

The intended first stable version may be labeled `1.0.0` after these gates are
met. Version assignment alone does not create a Release.

## 8. Release blocker classification

The `RB` labels below classify release defects. They are intentionally distinct
from the PRD's P0/P1/P2 feature-priority labels.

| Level | Meaning | Examples | Promotion effect |
|---|---|---|---|
| RB0 — Critical | Result integrity, official-history integrity, or privacy is unsafe | insecure/fallback selection, duplicate winner in one draw, wrong eligible pool, official result loss/overwrite, private participant data on Audience | Blocks Beta, RC, and Release; no waiver permitted |
| RB1 — High | A critical event workflow cannot finish safely on a supported environment | Live start/confirmation/recovery fails, supported browser cannot operate, export contradicts History, storage failure reports false success | Blocks RC and Release; Beta only in a controlled area that cannot encounter the defect |
| RB2 — Medium | Workflow completes safely but usability or reliability is materially degraded | confusing recovery guidance, non-critical keyboard gap, performance degradation outside the agreed SLA | May proceed only when documented, mitigated, and explicitly accepted |
| RB3 — Low | Cosmetic or minor polish issue with no integrity or operational consequence | spacing, non-blocking copy inconsistency, minor visual defect | Does not normally block promotion; remains tracked |

## 9. Promotion evidence template

| Field | Required evidence |
|---|---|
| Proposed stage | Alpha / Beta / RC / Release |
| Version and commit | Exact immutable identity |
| Date and environment | OS, browser versions, viewport/display, device |
| Automated verification | Commands, results, test counts, and failures/waivers |
| Manual verification | Matrix/runbook result and operator evidence |
| Scale/performance | Dataset, timing boundary, runs, result, benchmark device |
| Open blockers | RB level, owner, mitigation, and decision |
| Known limitations | Published limitation record |
| Decision | Approved / rejected / conditional, approver, and date |

## 10. Relationship to Phase 11

Phase 11 is expected to produce a **Release Candidate**, not to silently declare
a Release. Phase 11 closes accessibility, Bahasa Indonesia localization,
performance, compatibility, production packaging and cleanup, cross-phase
manual acceptance, known limitations, and the RC evidence package. Release
follows only after the exact packaged RC completes the agreed final rehearsal
or pilot and receives explicit owner sign-off.
