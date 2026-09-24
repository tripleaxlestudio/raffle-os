# Phase 8 Manual Integrated Acceptance Runbook

Status: preparation only. This document does not change the Phase 8 verdict.

Manual browser acceptance is deferred until Slice 15 is complete and the
owner-approved product-level seed/setup exists. This runbook is preparation
only; do not execute the matrix before that gate.

Baseline to verify before testing:

```text
fa8b36bd2acd2026e08028748a645658541c158f
```

The owner must record the browser result before marking any row `PASS`.

## 1. Start and baseline

Use Chrome first. From `C:\laragon\www\raffle-os`:

```powershell
npm.cmd install
npm.cmd run dev -- --host localhost
```

Open:

```text
http://localhost:5173/dashboard
```

Before the browser run, record:

- browser name and full version;
- application commit (`git rev-parse HEAD`);
- seed profile and session ID;
- Operator viewport (target `1440 x 900`);
- Audience viewport (target `1920 x 1080`);
- action sequence, observed result, status, and screenshot/evidence reference.

## 2. Safe reset and existing deterministic seed

The development build installs `window.__raffleAcceptance` on the first page.
It is available only while running Vite in development mode. It targets the
default IndexedDB database `RaffleOS_DB` and performs an exact-name,
acknowledged delete through the application reset service.

In the DevTools Console on `/dashboard`, run:

```js
await window.__raffleAcceptance.reset()
await window.__raffleAcceptance.seed()
await window.__raffleAcceptance.inspect()
```

The expected current acceptance seed is:

- Event: `Raffle OS Phase 5 Acceptance`, ID
  `aaaaaaa5-0000-4000-8000-000000000001`;
- PrizeCategory: `Acceptance Prize` / `Acceptance Test Prize`;
- Participants: 6;
- exact tickets: `00042`, `42`, `00043`, `00044`, `00045`, `00046`;
- checked-in participants: 4 (`00042`, `42`, `00043`, `00044`);
- DrawSessions: live and practice, both ready;
- live DrawSession ID:
  `aaaaaaa5-0000-4000-8000-000000000005`;
- practice DrawSession ID:
  `aaaaaaa5-0000-4000-8000-000000000004`;
- requested winners: 2;
- display configurations: 0.

Select the live acceptance session before opening the production route:

```js
await window.__raffleAcceptance.useLive()
```

For practice-only checks, use `usePractice()` instead. Do not call reset while
an Operator or Audience window is using the database. Close both windows first,
reset, reseed, then reload the application.

## 3. Routes and windows

Production Operator routes:

```text
http://localhost:5173/dashboard
http://localhost:5173/participants
http://localhost:5173/draw/setup
http://localhost:5173/draw/run/aaaaaaa5-0000-4000-8000-000000000005
http://localhost:5173/draw/pending/aaaaaaa5-0000-4000-8000-000000000005
http://localhost:5173/history
http://localhost:5173/settings
```

Production Audience route:

```text
http://localhost:5173/display
```

Open Operator and Audience in separate same-origin windows or tabs. Use the
Operator window at `1440 x 900` and the Audience window at `1920 x 1080`.
Open Audience before the Operator publisher for the early-join case; close it,
complete a mutation, and reopen it for the late-join case.

To observe public transport without posting or altering application behavior,
run this in a separate same-origin DevTools Console before the relevant action:

```js
const phase8PublicObserver = new BroadcastChannel(
  'raffle-os-display:production-event:public-display',
)
phase8PublicObserver.onmessage = (event) => console.log('public envelope', event.data)
```

Only inspect received messages. Do not call `postMessage()` and do not replace
`BroadcastChannel` or any application method. Close the observer afterward:

```js
phase8PublicObserver.close()
```

## 4. Ordered owner checklist

Run each batch from a fresh seeded database when isolation is important. A
mutation is observed only after the page has rendered the committed result and
the corresponding reload/remount check has completed.

### Batch A — Core Live flow

1. Open Audience, then the live DrawSession route.
2. Start the Live draw and observe countdown, rolling, and reveal.
3. Follow the handoff to pending results.
4. Confirm one winner and observe partial confirmation.
5. Confirm the remaining winner and observe final confirmation and completed
   session.
6. Refresh at pending and completed states; verify no new draw or command is
   submitted.

### Batch B — Cancellation

From a fresh Live seed, verify one pending cancellation, multiple pending
cancellations, required reason validation, and required note validation when
reason is `other`. Verify final pending cancellation while another winner is
confirmed and an all-cancelled session. In History verify original records,
actor, canonical timestamps, reason, note, and no replacement record.

### Batch C — Pending redraw

From a fresh Live seed, redraw one and then multiple pending winners. Verify the
replacement ticket is not visible before commit; after commit the original is
cancelled, the replacement is pending, and History contains explicit lineage.
Exercise insufficient capacity and verify zero mutation: no cancellation, no
replacement, and no history change.

### Batch D — Confirmed redraw

Complete a session, invoke the separate confirmed-redraw action, and verify the
destructive warning. After confirmation verify original cancelled,
replacement pending, `completed` to `pending-confirmation`, unaffected winners
still confirmed, and replacement not automatically confirmed.

### Batch E — Recovery and duplicate protection

Double-click confirmation, cancellation, and redraw controls. Verify disabled
submission state, one committed mutation, and receipt/idempotency behavior.
Refresh after each committed mutation and reopen the pending route. Use only
supported test controls for timeout/unknown reconciliation; if no supported
control exists, record the scenario as `NOT RUN`, not `PASS`. Confirm refresh or
remount never resubmits a command.

### Batch F — Audience integration

Verify early join, late join, pending/partial-confirmed status, cancellation
removal after commit, replacement appearance only after commit, disconnect and
reconnect, multiple Audience windows, blackout before and after mutation,
reconnect during blackout, fullscreen enter/exit, and denial/fallback. Confirm
an Audience transport failure does not roll back official persistence.

### Batch G — Privacy and exact data

Inspect every public envelope. It may contain protocol metadata, scope/session
identity, stage, timing, blackout intent, mode, exact ticket strings, and public
winner statuses only. It must not contain Participant name, group, check-in,
internal IDs, command IDs, receipts, actor, reasons, notes, audits, candidate
snapshot, or eligibility data. Verify `00042` and `42` remain distinct.

The current seed can verify exact-ticket preservation, but it cannot exercise
winner counts 1, 6, 10, 20, or a larger supported count. Record those rows as
blocked by seed setup unless an owner-approved, production-supported dataset is
provided.

### Batch H — Layout and accessibility

Use keyboard-only selection and actions. Verify dialog focus and focus return,
Escape/cancel behavior where supported, disabled actions during submission,
reduced-motion behavior, no nested/double scrollbar, no clipped buttons, and
large-count modal/list scrolling. Capture Operator at `1440 x 900` and Audience
at `1920 x 1080`.

### Batch I — Edge parity

Repeat the highest-risk paths in current Edge: complete confirmation,
cancellation, pending redraw, confirmed redraw, receipt/reload recovery,
Operator/Audience reconnect, blackout/fullscreen, privacy payload, exact
tickets, and layout/accessibility.

## 5. Deferred Phase 6 and Phase 7 debt

Include these rows in the evidence log; they remain deferred in the existing
acceptance records:

- Phase 6 valid Live refresh without an invalid-transition error;
- pending route refresh;
- orphan recovery and mutation-lock browser smoke;
- Phase 7 same-origin Chrome/Edge Operator and Audience windows;
- late join, reconnect, blackout, fullscreen, multiple Audience windows;
- privacy payload inspection and exact ticket/count checks;
- layout/accessibility checks in both target viewports.

## 6. Evidence record

Use one record per scenario with this shape:

```text
Scenario / batch:
Browser and full version:
Viewport:
Seed profile:
Event / DrawSession identity:
Preconditions:
Actions:
Observed browser result:
Expected result:
Status: PASS | FAIL | NOT RUN | BLOCKED
Screenshot / console / history evidence:
Notes and defect link:
```

Do not replace an observed result with automated test output. Do not change
`docs/technical/PHASE-8-ACCEPTANCE.md` or its verdict during this preparation
run. Any later acceptance-document correction must be documentation-only and
must preserve the distinction between automated evidence and owner-observed
browser evidence.

## Preparation conclusion

The existing application provides a usable deterministic reset/seed path for
the limited Phase 5 acceptance dataset through `window.__raffleAcceptance`.
It does not provide a complete deterministic Phase 8 seed path: the acceptance
profile lacks the participant volume and display configuration required by the
matrix, while the capacity profile lacks the draw entities. This is the setup
blocker for full integrated acceptance. No application code, production route,
manual acceptance row, or Phase 8 verdict was changed by this preparation.
