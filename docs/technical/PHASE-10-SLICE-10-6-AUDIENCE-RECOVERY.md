# Phase 10 Slice 10.6 — Audience reconnect and presentation recovery

Status: implementation and automated verification complete; owner-driven Chrome/Edge two-tab acceptance remains required.

## Outcome

Audience publication now starts from persisted authoritative recovery state when the Operator reloads with one recoverable Live session. The bootstrap publisher no longer has to emit a temporary Standby snapshot before the recovered Pending or presentation state is available.

`projectAudienceRecoverySource` accepts only startup decisions that contain persisted official winners (`resume-pending` or `resume-verification`). It returns no recovery projection for ambiguous, acknowledgement-required, setup, storage-failure, normal, or conflicting-session outcomes. This keeps unresolved selection outcomes off the public display.

For an accepted recovery decision:

- persisted WinnerRecords determine ticket strings and public Pending/Confirmed statuses;
- cancelled WinnerRecords and participant-internal fields are excluded;
- a matching presentation checkpoint restores countdown, rolling, reveal, pending handoff, and blackout intent;
- absent or untrusted checkpoints fall back to the authoritative Pending handoff;
- persisted Event and Display settings restore public branding and framing;
- no selector, draw command, persistence writer, audit writer, or History mutation is reachable from the projection.

Protocol v1, epoch/sequence ordering, restore requests, acknowledgements, retained snapshots, duplicate/stale rejection, and liveness behavior remain unchanged.

## Automated evidence

Focused tests cover:

- Operator publisher replacement after reload with the same DrawSession and exact tickets;
- Audience reload receiving the retained authoritative snapshot;
- disconnect-safe and retained restoration during countdown, rolling, reveal, and pending handoff;
- exact distinction between `00042` and `42`;
- partial confirmation status restoration;
- retained blackout intent;
- checkpoint-free fallback to Pending handoff;
- no pre-reveal ticket exposure during countdown;
- cancellation filtering and absence of participant display names;
- ambiguous recovery producing no public recovery projection.

Focused verification command:

```text
npm.cmd run test -- src/application/display-transport/audience-recovery.test.ts src/application/display-transport/phase10-audience-recovery.integration.test.ts src/application/display-transport/authoritative-projection.test.ts src/application/display-transport/synchronization-slice5.test.ts src/application/display-transport/audience-presence.integration.test.ts src/pages/display/AudienceProductionRoute.test.tsx
```

Result: 6 test files passed, 27 tests passed.

## Manual acceptance boundary

The in-app local smoke check verified that the production Audience route opened without console errors and exposed no Operator controls or internal participant data. The browser profile had no active Event or seeded Pending session. Loading the available development fixture would require destructive local-database reset confirmation, so no reset or seed action was performed.

Before Phase 10 acceptance, the owner-driven Chrome and Edge matrix must still verify two real tabs with a disposable approved dataset:

1. reload Operator while Audience remains open;
2. reload Audience while Operator remains open;
3. reload both tabs;
4. disconnect/reload during countdown, rolling, reveal, and Pending handoff;
5. verify confirmed Show/Hide and blackout retention;
6. verify the same DrawSession and exact tickets return with no new result or internal data.

This slice does not claim Chrome/Edge manual acceptance and does not close Phase 10.7.

## Scope exclusions

- No BroadcastChannel replacement or protocol version change.
- No NDI, remote display, backend, cloud, or cross-device synchronization.
- No backup/restore implementation.
- No draw selection, redraw, confirmation, or official History mutation change.
- No new dependency or schema migration.
