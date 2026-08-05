# Phase 8 Acceptance

Audit date: 2026-08-05  
Baseline: `7220da3d6f9bfd3c9187eb2db45333fc18caced7`  
Branch: `phase8/slice-7-audience-recovery-acceptance`  
Final commit: this acceptance commit; verify with `git rev-parse HEAD`.

## Automated evidence

| Command | Result |
|---|---|
| `npm.cmd run test` | PASS — 86 files, 754 tests |
| `npm.cmd run test -- src/application/display-transport src/application/pending-decisions src/pages/operator/ProductionPendingResultsPage.test.tsx src/pages/display/AudienceProductionRoute.test.tsx` | PASS — 14 files, 73 tests |
| `npm.cmd run test -- src/pages/display/AudienceProductionRoute.test.tsx src/application/display-transport/phase7-integration.test.tsx` | PASS — 2 files, 10 tests |
| `npm.cmd run lint` | PASS |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run build` | PASS; Vite emitted a non-blocking large-chunk warning |
| `git diff --check` | PASS |

The full suite includes the Slice 1–6 pending-decision, receipt, persistence,
history, redraw, recovery, Phase 5 selection/persistence, and Phase 7
transport/projection/privacy regressions. No Phase 6 or Phase 7 historical
acceptance document was rewritten.

## Slice 7 evidence

- `authoritative-projection.ts` derives the public source only from records
  read after persistence. Cancelled records are excluded from active public
  winners; pending and confirmed records retain only public ticket/status
  data; an all-cancelled committed session publishes an empty active set.
- `ProductionPendingResultsPage` remount/reload reads authoritative session,
  winners, redraw records, and checkpoint blackout state. It starts or updates
  the existing Operator publisher from that read; it does not execute a
  command, select a replacement, or infer a result during render.
- The Phase 7 protocol now carries an optional public `winnerStatuses` list.
  It is validated for length and vocabulary, preserved through serialization,
  and passed to Audience without Participant, actor, command, receipt, reason,
  note, audit, candidate, or eligibility fields.
- The Audience maps an all-confirmed committed projection to its existing
  confirmed presentation state, keeps unresolved results provisional, and
  renders an all-cancelled committed projection as a safe no-active-winners
  state. Existing status-less Phase 7 envelopes remain compatible.
- Publication failures are reported as Audience transport/projection status;
  official persistence is not rolled back. The existing receipt services and
  transaction boundaries remain the mutation authority.
- Schema v3, command receipts, confirmation, cancellation, redraw lineage,
  and history behavior are covered by the prior Slice 2–6 implementation and
  remain unchanged by this slice. No new schema version was added.

## Focused regression groups

| Group | Evidence |
|---|---|
| Confirmation/cancellation/redraw and receipt idempotency | Full pending-decision suite PASS |
| Committed-only Audience filtering and exact ticket strings | New authoritative projection tests PASS |
| Public protocol validation, ordering, reconnect, blackout, privacy | Full Phase 7 transport suite PASS |
| Audience confirmed/provisional rendering and no operator controls | Audience route and Phase 7 integration tests PASS |
| Practice/Live isolation and prototype-route isolation | Full suite PASS |
| Refresh/read-only recovery and no command from render | Production pending and recovery suites PASS |

## Manual integrated acceptance matrix

No Chrome or Edge browser-control/attachment tooling was available in this
execution. No manual result is fabricated; every mandatory manual row is
`NOT RUN` and has no evidence reference.

| Row | Browser / viewport / seed | Expected and observed result | Status | Evidence |
|---|---|---|---|---|
| Valid Live flow: countdown, rolling, reveal, pending, partial/final confirm | Chrome latest; 1440×900; owner seed required | Not executed | NOT RUN | — |
| Cancellation: pending, multiple, all-cancelled, existing confirmed, reason/note/history | Chrome latest; 1440×900; owner seed required | Not executed | NOT RUN | — |
| Pending redraw: single/multiple, capacity, post-commit replacement, lineage | Chrome latest; 1440×900; owner seed required | Not executed | NOT RUN | — |
| Confirmed redraw: warning, completed→pending-confirmation, pending replacement, unaffected winner | Chrome latest; 1440×900; owner seed required | Not executed | NOT RUN | — |
| Recovery: refresh at pending/confirm/cancel/redraw, timeout, replay, duplicate submit | Chrome latest; 1440×900; owner seed required | Not executed | NOT RUN | — |
| Operator/Audience same-origin windows, late join, reconnect, multiple displays | Chrome latest; 1440×900 + 1920×1080; owner seed required | Not executed | NOT RUN | — |
| Blackout/fullscreen: before/after mutation and reconnect during blackout | Chrome latest; 1920×1080; owner seed required | Not executed | NOT RUN | — |
| Privacy inspection of public transport payload | Chrome latest; same-origin session; owner seed required | Not executed | NOT RUN | — |
| Exact tickets `00042` and `42`; counts 1/6/10/20/larger | Chrome latest; target viewports; owner seed required | Not executed | NOT RUN | — |
| Layout/accessibility: keyboard, focus, dialogs, reduced motion, scrolling, clipping | Chrome latest; 1440×900 + 1920×1080; owner seed required | Not executed | NOT RUN | — |
| Deferred Phase 6 debt: valid Live refresh, pending refresh, orphan recovery, mutation guard | Chrome latest; 1440×900; owner seed required | Not executed | NOT RUN | — |
| Deferred Phase 7 debt: Chrome/Edge windows, fullscreen, reconnect, blackout, privacy, multiple Audience | Chrome and Edge latest; 1440×900 + 1920×1080; owner seed required | Not executed | NOT RUN | — |
| Valid Live flow | Edge latest; 1440×900; owner seed required | Not executed | NOT RUN | — |
| Cancellation and history | Edge latest; 1440×900; owner seed required | Not executed | NOT RUN | — |
| Pending and confirmed redraw | Edge latest; 1440×900; owner seed required | Not executed | NOT RUN | — |
| Recovery and receipt reconciliation | Edge latest; 1440×900; owner seed required | Not executed | NOT RUN | — |
| Operator/Audience synchronization | Edge latest; 1440×900 + 1920×1080; owner seed required | Not executed | NOT RUN | — |
| Blackout/fullscreen | Edge latest; 1920×1080; owner seed required | Not executed | NOT RUN | — |
| Privacy and exact ticket/count checks | Edge latest; target viewports; owner seed required | Not executed | NOT RUN | — |
| Layout/accessibility and deferred Phase 6/7 debt | Edge latest; target viewports; owner seed required | Not executed | NOT RUN | — |

Owner checklist: run the matrix in current Chrome and Edge using same-origin
separate Operator/Audience windows, record exact browser versions, viewport,
seed/session identity, action sequence, observed result, and evidence links;
repeat after any browser-facing fix.

## Warnings and limitations

- Manual Chrome/Edge integrated acceptance is outstanding.
- The production Audience publisher is local-first BroadcastChannel transport;
  transport availability is intentionally non-blocking to official storage.
- The production build reports a large JavaScript chunk warning; this is not a
  correctness failure and is outside Slice 7 scope.
- No backend, cloud, authentication, export, backup/restore, Phase 9 work, or
  persistent mutation lock was added.

## Verdict

`PHASE 8 NOT YET ACCEPTED`

Automated acceptance is green, but the mandatory manual browser gates remain
`NOT RUN`.
