# Audit: Random Number Roll Presentation Mode

## A. Feasibility verdict

**POSSIBLE WITH MINOR CONTRACT CHANGE**

The feature can be added as a presentation-layer capability after authoritative winner selection. The Draw Engine, eligibility rules, persistence, audit trail, redraw logic, and command receipts do not need to change.

The main required change is extending the presentation/configuration contracts so rolling behavior is persisted and safely reconstructed across reconnects.

## B. Existing reusable architecture

The current code already provides:

- A production presentation state machine:

  `countdown → rolling → reveal → pending-handoff`

  in `src/domain/workflow/presentation-workflow.types.ts` and `src/application/workflow/presentation-controller.ts`.
- Authoritative result locking before presentation in `src/pages/operator/DrawRunPage.tsx`.
- Secure winner selection through Web Crypto, Fisher–Yates shuffling, candidate snapshots, duplicate prevention, and bounded winner counts.
- Atomic persistence of sessions, winners, and audit records.
- Presentation checkpoints containing stage and timing metadata, but not winner or participant data.
- Privacy-safe Audience projection. Winner tickets are projected only for `reveal` and `pending-handoff`; rolling does not expose them.
- Ordered, epoch-aware BroadcastChannel transport with retained snapshots, restore requests, reconnect handling, liveness monitoring, and safe disconnected states.
- A reusable Audience `RollingStage`, although it currently renders a static ticket stream and is not wired to production rolling values.

## C. Current state and gaps

### Presentation/state architecture

The `rolling` state is fully implemented as a lifecycle state, including controller transitions, checkpoint persistence, resume-after-refresh behavior, operator publisher updates, Audience protocol support, and Audience renderer selection.

However, it is currently only a generic presentation placeholder. Production rolling currently renders “SELECTING” with decorative symbols in `src/ui/operator/draw/ProductionDrawPresentation.tsx`.

The production Audience receives only `stage: 'rolling'` and no ticket values. Its `RollingStage` can render ticket values when supplied, but the production projection explicitly forbids tickets during rolling.

### Draw Engine separation

Winner selection occurs before `PresentationController.start()` is invoked. The authoritative path is:

1. Build eligibility pool.
2. Freeze candidate snapshot.
3. Select winners using Web Crypto.
4. Create `WinnerRecord`s.
5. Persist the official result atomically.
6. Lock the result for presentation.
7. Run countdown/rolling/reveal presentation.

Therefore:

> Yes. Random Number Roll can be implemented purely as a presentation layer after authoritative winner selection.

The animation must never call candidate-pool construction, eligibility evaluation, winner selection, redraw selection, persistence, confirmation/cancellation, or audit services.

### Configuration model

Current production presentation settings are event/application-level settings:

- countdown duration;
- rolling duration;
- reveal style;
- celebration effect;
- reduced-motion preference;
- winner layout.

They are defined in `src/domain/settings/presentation-settings.types.ts` and edited through `src/pages/operator/ProductionSettingsPage.tsx`.

Draw Setup currently stores only draw eligibility and winner configuration in `DrawConfiguration`. It has no per-draw presentation fields. The current Draw Run reads timing from global event settings rather than a draw-specific snapshot.

For the requested UX, the safest model is:

- Event Settings: defaults only.
- Draw Configuration: per-draw presentation choice.
- Draw Session configuration snapshot: immutable copy used during that draw.
- Presentation checkpoint: runtime stage/timestamp/blackout recovery data only.

### Multi-winner behavior

The existing public projection supports up to 100 tickets, so 1, 6, 10, 20, and 50 winners are structurally supported.

Recommended behavior:

- Generate all rolling slots locally in the Audience renderer.
- Use one authoritative rolling message containing mode, duration, speed, slot count, start timestamp, and safe display-format metadata.
- Do not publish animation frames through BroadcastChannel.
- Let each Audience Display derive its own animation frames locally.
- At reveal, publish the authoritative winner tickets once.

All-together reveal is straightforward. Sequential reveal is also feasible if the Audience derives visible slot count from `revealStartedAt` and `revealMode`.

For 50 winners, use a bounded grid/layout or staged reveal rather than creating 50 large simultaneous animated elements.

## D. Recommended architecture

Add a typed presentation configuration, for example:

```ts
type PresentationMode = 'instant-reveal' | 'random-number-roll'
type RevealMode = 'all-together' | 'sequential'

interface DrawPresentationConfiguration {
  presentationMode: PresentationMode
  rollDurationSeconds: number
  rollSpeed: number
  revealMode: RevealMode
}
```

Recommended flow:

1. Draw Setup loads event defaults.
2. Operator selects presentation mode and options.
3. Save the configuration with the draw.
4. Draw command snapshots that configuration into the `DrawSession`.
5. Winner selection remains unchanged.
6. Draw Run starts the existing controller with the persisted configuration.
7. Operator publisher sends one rolling state containing timing/configuration metadata.
8. Audience locally animates values using `requestAnimationFrame` or a timer.
9. Reveal publishes authoritative tickets.
10. Audience derives all-together or sequential reveal locally.
11. Reconnect uses the retained rolling/reveal timestamp and configuration to reconstruct the correct display state.

Rolling values should not be generated from the candidate pool. Because ticket numbers are arbitrary strings, the implementation also needs a clear display-format policy for synthetic values. A safe option is to pass only non-sensitive formatting metadata, such as slot count and ticket width, rather than participant or candidate data.

## E. Exact files likely affected

Likely production changes:

- `src/domain/draws/draw-configuration.types.ts` — add validated presentation configuration.
- `src/domain/draws/draw-session.types.ts` — add immutable presentation configuration snapshot.
- `src/domain/draws/draw.invariants.ts` — validate the new configuration.
- `src/application/draw/draw-authoring.types.ts` — add Draw Setup draft fields.
- `src/application/draw/draw-authoring-service.ts` — validate and persist per-draw presentation settings.
- `src/pages/operator/DrawSetupPage.tsx` — add the primary presentation controls.
- `src/ui/operator/draw/ProductionDrawPresentation.tsx` — consume persisted configuration.
- `src/application/workflow/presentation-controller.ts` — accept configuration-driven duration and reveal behavior.
- `src/domain/workflow/presentation-checkpoint.types.ts` — possibly add configuration/version metadata for recovery.
- `src/application/display-transport/public-projection.ts` — add safe rolling metadata without winner leakage.
- `src/application/display-transport/protocol.ts` — extend the public display-state contract.
- `src/application/display-transport/operator-publisher.ts` — publish rolling configuration once.
- `src/application/display-transport/audience-controller.ts` — preserve and validate extended public state.
- `src/pages/display/AudienceDisplayPage.tsx` — pass rolling configuration to the renderer.
- `src/ui/audience/RollingStage.tsx` — implement local-only animation.
- `src/ui/audience/WinnerStage.tsx` — support all-together/sequential reveal.
- `src/ui/audience/audience-view.types.ts` — add typed rolling/reveal metadata.
- `src/styles/audience.css` — add bounded multi-winner layouts and reduced-motion behavior.
- `src/infrastructure/persistence/repositories/draw-configuration.repository.ts` — persist and validate the new configuration.
- `src/infrastructure/persistence/schema/schema-v1.ts` and `migrations.ts` — add an additive schema migration if per-draw settings are persisted.

## F. Schema/persistence impact

If Random Number Roll remains an event-level default, no schema migration is required, but that does not fully satisfy the requested Draw Setup UX.

For the preferred per-draw configuration model, an additive IndexedDB migration is required because `DrawConfiguration` currently has no presentation fields.

The migration should preserve all existing records and provide defaults for existing configurations, such as:

- `presentationMode: 'instant-reveal'`;
- current rolling duration;
- current reveal style mapped to the new reveal mode.

No changes are required to `WinnerRecord`, `RedrawRecord`, audit records, command receipts, candidate snapshots, or eligibility persistence.

## G. Risks

### Winner leakage

Do not include candidate tickets or winner tickets in rolling messages. The current projection correctly excludes tickets during rolling and should retain that invariant.

### Presentation becoming authoritative

Keep random generation inside `RollingStage` or a dedicated presentation-only service. It must not import or call Draw Engine, eligibility, persistence, or pending-decision services.

### Reconnect behavior

Rolling state must include enough metadata to reconstruct the display:

- stage start timestamp;
- duration;
- speed;
- slot count;
- presentation mode;
- reveal mode;
- safe formatting metadata.

A reconnecting Audience should resume locally derived animation, not request individual animation frames.

### Multi-display divergence

Independent displays may show different synthetic rolling values if each generates locally. That is acceptable only if rolling values are decorative. If all displays must show identical values, use a deterministic presentation seed and frame schedule derived from public session metadata, still without candidate data.

### Arbitrary ticket formats

Ticket numbers are strings and may not be numeric or uniformly padded. The product needs an explicit policy for synthetic rolling values. This is currently undefined.

### Reduced motion

Existing reduced-motion handling skips animation and transitions directly to reveal. Random Number Roll must preserve that behavior.

### Manual acceptance

Phase 8 acceptance records manual Chrome/Edge validation as not run. Browser validation remains necessary for late Audience join, reconnect during rolling, refresh during rolling, 1/6/10/20/50 winners, exact ticket strings such as `00042`, reduced motion, and multiple Audience windows.

## H. Recommended implementation slices

1. Add and validate the presentation configuration contract.
2. Persist per-draw configuration with backward-compatible defaults.
3. Add Draw Setup controls while preserving current settings as defaults.
4. Pass the immutable configuration into Draw Run and the presentation controller.
5. Extend the public rolling contract with timestamp/configuration metadata only.
6. Implement local Audience rolling animation.
7. Implement all-together and sequential local reveal behavior.
8. Add reconnect, late-join, privacy, and reduced-motion tests.
9. Add multi-winner rendering tests for 1, 6, 10, 20, and 50 winners.
10. Run manual browser acceptance before calling the feature production-ready.

## I. Recommendation

Random Number Roll is technically safe, but it should wait until the current Phase 8 UI refinement changes are settled and manually accepted.

Implement it as a focused presentation enhancement with per-draw configuration and local Audience animation. Do not modify the Draw Engine or official result workflow.

## Verification and assumptions

- Audited the current local worktree, including its uncommitted Phase 8 changes.
- No files were modified and no commits were created during the audit.
- Targeted tests passed: **23 files, 143 tests**.
- The current worktree contains uncommitted UI changes in audited production presentation files; those changes were preserved.
- The older Phase 8 planning document is partly stale: current code has schema version 4 and command receipts although some documentation describes earlier schema state.
