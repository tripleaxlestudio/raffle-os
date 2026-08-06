# Phase 8 Audience Runtime Diagnostic

This development-only diagnostic records a bounded, in-memory trace for the production Operator-to-Audience lifecycle. It does not change transport behavior, persistence, protocol semantics, presentation behavior, or official raffle workflows.

## Browser procedure

1. Close every localhost:5173 tab/window.
2. Restart Vite.
3. Open one Operator tab at /settings.
4. Open one Audience window using the generated production link.
5. Clear both traces.
6. Record standby behavior.
7. Start Display Test.
8. Record Audience result.
9. Stop Display Test.
10. Record Audience result.
11. Start Display Test again.
12. Navigate Operator:
    Settings → Dashboard → Live Draw → Pending Results.
13. Record whether publisher instance, epoch, and channel remain stable.
14. Copy both traces.
15. Do not refresh unless recording refresh recovery separately.

The Operator panel is available from the development-only “Audience publisher diagnostics” disclosure. The Audience panel is available from “Audience runtime diagnostics”. Each panel shows the last 30 side-specific entries. The trace store is a per-window in-memory ring buffer capped at 200 entries; it is never written to IndexedDB.

## Result table

| Expected state | Observed Operator state | Observed Audience state | First mismatching trace event | PASS/FAIL |
|---|---|---|---|---|
| Standby is published and rendered |  |  |  |  |
| Display Test is sent, accepted, acknowledged, and rendered |  |  |  |  |
| Stop returns Audience to standby |  |  |  |  |
| Second Display Test is sent and rendered |  |  |  |  |
| Settings → Dashboard → Live Draw → Pending Results keeps publisher instance, epoch, and channel stable |  |  |  |  |

## Trace interpretation

Start at the first mismatch, not the final visible state. Compare `publisherControllerInstanceId`, `currentRoute`, `channelName`, `scope`, `epoch`, and `sequence`, then follow `direction`, `messageType`, validation/order results, controller before/after, rendered state, acknowledgement status, and cleanup reason.

The copied JSON contains only timestamp, side, route, instance identity, Event/display scope, channel, epoch/sequence, direction, message type, public state, validation/order results, controller state, rendered state, acknowledgement status, rejection reason, and cleanup/dispose reason. It excludes participant data, winner details, command payloads, receipts, audit content, reasons/notes, candidate data, and eligibility data.

## Development controls

- `Copy trace as JSON` copies the current safe trace as JSON.
- `Clear trace` clears the current window’s trace.
- Diagnostics are gated by `import.meta.env.DEV` and are not rendered in production builds.
