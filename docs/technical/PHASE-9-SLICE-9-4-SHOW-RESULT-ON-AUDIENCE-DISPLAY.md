# Phase 9 Slice 9.4 — Show Completed Result on Audience Display

This slice adds a presentation-only `Show on Audience Display` action to completed official Live Session Detail. It republishes an existing result; it does not reopen, replay, redraw, or create a new official event.

Eligibility requires a complete History reconstruction, Live mode, `completed` session status, and at least one confirmed WinnerRecord. Missing sessions, Practice sessions, Pending/non-final sessions, incomplete reconstructions, and results without confirmed winners are rejected safely.

The read-model boundary in `completed-result-projection.ts` selects only authoritative `confirmed` WinnerRecords, keeps their sequence order, and excludes cancelled originals and Pending records. Ticket numbers are passed as strings unchanged: `00042` and `42` remain distinct. Participant fields, notes, check-in data, group, eligibility, cancellation reasons, audit records, and repository objects never enter the public payload.

Publication reuses the existing ProductionWorkspaceProvider `OperatorPublisher`, transport scope, retained snapshot, acknowledgement, heartbeat, reconnect, and disconnected feedback. The source uses the existing `pending-handoff` protocol state with `verificationState: verified`; the Audience renderer presents it directly as the existing confirmed state without countdown, rolling, random selection, or Pending verification.

Result identity comes from persisted History. Branding, assets, safe-area margin, and blackout settings come from the current Event Settings and DisplayConfiguration; historical branding is not reconstructed.

The action performs zero official writes. It does not modify DrawSessions, WinnerRecords, RedrawRecords, AuditRecords, status, timestamps, lineage, eligibility, or the draw queue. Repeated publication and switching between sessions only replace retained Audience presentation state. Practice remains excluded from official History and this action.

Focused tests cover eligibility, confirmed-only projection, cancelled/Pending exclusion, sequence order, exact ticket strings, and Practice/non-final rejection. Slice 9.5+ work such as export, backup/restore, recovery, repository immutability redesign, and new Audience protocol/lifecycle work remains deferred.
