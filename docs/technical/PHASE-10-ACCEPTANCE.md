# Phase 10 Acceptance — Recovery and Operational Safety

## Status

**IMPLEMENTATION AND AUTOMATED ACCEPTANCE COMPLETE — OWNER MANUAL SIGN-OFF PENDING**

Phase 10.7 adds no new production behavior. It closes the automated recovery
matrix across the contracts, IndexedDB repositories and transactions, startup
resolver, Operator recovery gate, and Audience transport implemented in Slices
10.1–10.6.

Phase 10 cannot be marked owner-accepted until the focused Chrome and Edge
checks below are completed with an approved disposable Event. This document
does not claim those checks were run. Backup and restore remain deferred P2
scope and are not part of this acceptance.

## Automated Scenario A–I evidence

The integrated suite is
`src/application/workflow/phase10-recovery-acceptance.integration.test.tsx`.
It uses the real Dexie repositories and transaction boundaries over isolated
`fake-indexeddb` databases. Recovery itself remains read-only and has no
selector dependency.

| Scenario | Result | Integrated evidence |
|---|---|---|
| A. No active draw | PASS | A ready/non-unresolved Event boots to Dashboard; session, winner, and audit counts do not change. |
| B. Persisted Live selection | PASS | The same DrawSession ID, WinnerRecord objects, exact `42`/`00042` strings, snapshots, and Pending status return after startup recovery. |
| C. Partial confirmation | PASS | A real confirmation transaction preserves the Confirmed/Pending split; recovery adds no audit or command receipt. |
| D. Pre-selection interruption | PASS | A `drawing` session without persisted winners requires safe acknowledgement and creates no winner or audit. |
| E. Audience reconnect | PASS | Recovery projects the persisted public result through the real publisher/controller transport; a new Audience receives the retained same-session result. |
| F. Official write failure | PASS | Injected audit-write failure rolls the Live transaction back; the session remains ready and no winner, audit, or receipt is left. |
| G. Unsafe storage/schema | PASS | Unsupported-schema readiness blocks startup before active Event or official repositories are read; no reset path is called. |
| H. Startup conflict | PASS | The Operator recovery gate redirects fresh Draw Setup to the exact unresolved Pending route. |
| I. Repeated recovery | PASS | Three recovery reads are identical; replaying one committed command remains idempotent with stable session, winner, audit, and receipt counts. |

Focused verification at implementation time:

```text
npm.cmd run test -- src/application/workflow/phase10-recovery-acceptance.integration.test.tsx
```

Result: PASS — 1 test file, 9 tests.

Final verification for this Phase 10.7 change:

| Verification | Result |
|---|---|
| `npm.cmd run lint` | PASS |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run test` | PASS — 139 test files, 1,165 tests |
| `npm.cmd run build` | PASS — Vite production build completed; the existing large-chunk advisory remains non-blocking |
| `git diff --check` | PASS — only normal LF/CRLF normalization warnings were reported |

## Recovery invariants confirmed

- Recovery never selects a new winner and does not accept a random source.
- Official DrawSession, WinnerRecord, snapshot, redraw, audit, and receipt data
  remain authoritative over presentation checkpoints.
- Ticket identifiers remain exact strings, including leading zeroes.
- Partial confirmation and committed command receipts survive repeated reads.
- Ambiguous pre-selection state is acknowledged; it is not inferred as a
  successful selection.
- Failed official writes cannot appear as success or leave partial official
  records.
- Storage/schema failure blocks operation without automatic deletion or reset.
- Audience recovery exposes only the public projection of the persisted result.
- Terminal History is not opened for mutation by any recovery path.

## Owner Chrome/Edge sign-off runbook

### Preconditions

1. Use a disposable Event whose local data may be safely discarded after the
   check. Do not reset or seed an Event containing official History.
2. Include distinct tickets `00042` and `42`, at least two eligible
   participants, and one Live configuration with two winners.
3. Open Operator and Audience in two same-origin tabs/windows.
4. Record browser name/version, operating system, Event ID, DrawSession ID,
   date/time, and operator initials in the evidence table.

### Checks to repeat in current Chrome and current Edge

| Check | Action | Expected evidence |
|---|---|---|
| Normal refresh | Refresh Operator with no unresolved Live session. | Dashboard/setup returns normally and official record counts do not change. |
| Pending recovery | Start Live, then refresh during Reveal and again on Pending Verification. | The same DrawSession, WinnerRecord identities, and exact tickets return; no draw starts automatically. |
| Partial confirmation | Confirm one winner, refresh Operator. | Confirmed/Pending split is unchanged and no duplicate audit entry appears. |
| Pre-selection interruption | Reload or close/reopen during countdown before an official selection is persisted. | Safe acknowledgement/return path appears; no winner is invented. |
| Operator reload | Keep Audience open and reload Operator during countdown, rolling, reveal, and Pending handoff. | Audience becomes safe while disconnected, then restores only the latest authoritative public state. |
| Audience reload | Keep Operator open and reload Audience during the same stages. | Retained same-session state returns without a new result. |
| Both reload | Reload both tabs, then restore the Operator first. | The same public session/result returns when Audience reconnects. |
| Show/Hide and blackout | Exercise confirmed Show, Hide, and blackout around an Audience reload. | Latest retained public intent returns; no internal participant data is visible. |
| Repeated recovery | Reload both tabs at least three times. | Session/ticket/status identity stays stable and History/audit counts do not grow. |

Real storage failure injection remains automated because production recovery
does not expose a destructive database manipulation control. Manual acceptance
must not corrupt, downgrade, reset, or delete an official Event to manufacture
an error.

## Owner evidence record

| Browser | Version | Event / DrawSession | A–I focused checks | Evidence/notes | Initials/date |
|---|---|---|---|---|---|
| Chrome | Pending | Pending | Pending | Pending | Pending |
| Edge | Pending | Pending | Pending | Pending | Pending |

Owner acceptance decision: **PENDING**

## Scope boundary and remaining work

- Backup/restore remains conditional P2 and was not implemented.
- Phase 11 accessibility, broad compatibility, viewport, scale, performance,
  and release certification remain separate work.
- Phase 10 may be marked accepted only after the owner evidence record above is
  completed. Automated acceptance is complete even while that manual boundary
  remains open.
