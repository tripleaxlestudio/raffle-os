# Live Draw Production UI Audit

Audit-only completed. No application source files were modified, no branch was created, and no commit was made.

> Limitation: the supplied attachment contained the audit brief but no separate screenshot binaries. Visual conclusions are therefore based on the brief and current source/CSS.

## Repository state

- Branch: `phase8/slice-14b-6-production-draw-setup-custom-winner-alignment`
- HEAD: `7089dc45f3be48ff30238ffe0d0f4b9fc5ebe110`
- Worktree: clean
- `git diff --check`: passed
- `npm test -- --run`: not run because PowerShell execution policy blocked `npm.ps1`

## Route and component inventory

### Production

| Route | Mounted component |
|---|---|
| `/draw/live` | `src/pages/operator/DrawSessionQueuePage.tsx` |
| `/draw/run/:drawSessionId` | `src/pages/operator/DrawRunPage.tsx` |
| `/draw/pending/:drawSessionId` | `ProductionPendingResultsPage` |
| `/history` | `ProductionHistoryPage` |

Production draw components and services:

- Queue query/action model: `src/application/draw/draw-session-queue.ts`
- Readiness query: `src/application/draw/draw-readiness-query.ts`
- Start gate: `src/pages/operator/DrawRunPage.tsx`
- Practice and Live presentation: `src/ui/operator/draw/ProductionDrawPresentation.tsx`
- Audience publisher/runtime: `src/app/workspace/ProductionWorkspaceContext.tsx`
- Checkpoint persistence: `src/infrastructure/persistence/repositories/presentation-checkpoint.repository.ts`
- Recovery decision logic: `src/application/workflow/recovery-query.ts`
- Production styling: `src/styles/operator.css`, shared primitives, and tokens

### Prototype

| Route | Mounted component |
|---|---|
| `/dev/prototypes/draw/live` | `src/pages/operator/LiveDrawPage.tsx` |

Prototype support:

- Fixtures: `src/prototype/data/live-draw.fixture.ts`, `draw-setup.fixture.ts`
- Types: `src/prototype/operator-types.ts`
- Scenario resolver: `src/prototype/scenario-query.ts`
- Regions: `LockedConfiguration`, `SystemChecks`, `LiveReadyState`, `CountdownState`, and `RollingState`
- Scope tests: `src/prototype/DrawPrototypeScope.test.tsx`, `src/prototype/SliceFourScope.test.tsx`

No separate legacy production Live Draw route was found. `LiveDrawPage.tsx` is prototype-only and is mounted under `/dev/prototypes`.

### Boundary finding

`src/ui/operator/draw/AudiencePreview.tsx` imports the type `PrototypeAudiencePreview` from `src/prototype/operator-types.ts`. This is type-only leakage rather than fixture/runtime leakage, but it violates the intended production/prototype boundary and should be removed in a future implementation slice.

## Production UI defects

### Queue

Responsible file: `src/pages/operator/DrawSessionQueuePage.tsx`.

| Finding | Classification | Behavior-preserving fix? |
|---|---|---|
| Mode is rendered as concatenated text such as `Practice · rehearsal` | Data formatting/styling | Yes |
| Status uses raw enum transformation via `replace('-', ' ')` | Data formatting | Yes |
| `updatedAt` renders as a raw ISO timestamp | Data formatting | Yes |
| Mode/status are plain spans, not intentional badges | Styling/structure | Yes |
| Event, category, prize, mode, and status lack strong hierarchy | Structure/styling | Yes |
| No current/next priority treatment | Missing view-model/structure | Yes, using existing status ordering |
| Practice and Live are difficult to scan separately | Structure | Yes |
| Checkpoint displays `No checkpoint` or a raw stage | Data formatting | Yes |
| No grouped actionable, pending, or historical sections | View-model/structure | Yes |

The existing queue query already supports session status, mode, event/category/prize relations, winner count, updated timestamp, Live checkpoint, and action type. It does not expose a human-readable lifecycle label, recovery summary, readiness summary, or explicit priority class.

### Draw Run ready state

Responsible file: `src/pages/operator/DrawRunPage.tsx`.

Confirmed gaps:

- The header says `Review Before Start` instead of presenting a strong Live Draw control-room header.
- Mode appears in content but is not a consistent header badge.
- There is no dedicated system-readiness/preflight checklist.
- There is no production Audience preview in the ready state.
- Display resolution, safe area, connection, and publication state are absent.
- Configuration recap omits presentation timing, reveal style, celebration, winner layout, and audio state.
- The start gate is visually isolated from Audience readiness.
- There is no clear combined ready/blocked/warning summary.
- Large unused regions are likely at the target viewport.

These are primarily composition and view-model gaps. Existing production contracts already provide much of the required data.

### Countdown and rolling

Responsible file: `src/ui/operator/draw/ProductionDrawPresentation.tsx`.

Current treatment includes a presentation frame, event/category/prize context, countdown or rolling treatment, skip action, and blackout control.

Gaps:

- No configuration recap beside the active presentation.
- No Audience preview or publication state.
- No persisted checkpoint metadata visible to the operator.
- Countdown/rolling durations use `PRESENTATION_POLICY`, not persisted Event presentation settings.
- Rolling presentation is decorative text and does not expose configured presentation settings.
- Operator action hierarchy is weak.

### Reveal and Practice completion

Current result rendering is in `ProductionDrawPresentation.tsx`, with styles in `src/styles/operator.css`.

Confirmed issues:

- Winner cards are generic bordered list items.
- Layout is mostly hardcoded to five columns.
- Only one winner receives a hero layout.
- Two, six, ten, and larger winner counts lack intentional layouts.
- Persisted `winnerLayoutPreference` is not consumed.
- Reveal style and celebration effect are not consumed.
- The `pending-handoff` branch always renders Practice copy, even though Live also uses that controller stage before navigation.
- Blackout control is attached to the presentation header rather than a dedicated operator control region.
- Audience synchronization status is not shown.
- Practice completion lacks a strong finished-operator-state hierarchy.
- Exact ticket strings are preserved because `winner.ticketNumber` is rendered directly.

## Prototype visual anatomy

| Prototype region | Classification |
|---|---|
| Live Draw header | B — requires production view model |
| Event/category/prize context | A |
| Practice/Live badges | A |
| Readiness/status banner | B |
| Two-column operator workspace | A |
| Configuration recap | B |
| Category/prize/winner count | A |
| Eligible pool | A |
| Winning rule | A |
| Presentation timing summary | B — settings exist but are not loaded by Draw Run |
| System readiness checklist | B/C — data exists, composed preflight contract is missing |
| Participant data readiness | B |
| Eligibility readiness | B |
| Audience Display readiness | B/C — publisher status exists but has no Draw Run view model |
| Presentation sequence readiness | B |
| Operator confirmation readiness | B |
| Audience preview | B — production display data exists, but the production run surface does not consume it |
| Target resolution | A |
| Safe-area margin | A |
| Audience connection state | A/B — publisher status exists |
| Start-gate control | A |
| Countdown state | A visually, B for settings parity |
| Rolling state | A visually, B for persisted configuration |
| Winner reveal | B |
| Practice complete | B |
| Live pending handoff | B |
| Recovery after refresh | C visually — recovery contract exists, dedicated UI treatment is incomplete |
| Prototype warning/static copy | D — must not enter production |

## Production field mapping

| Prototype field | Production equivalent/source | Available | Safe to render |
|---|---|---:|---:|
| Event name | `DrawReadinessData.event.name` | Yes | Yes |
| Prize category | `DrawReadinessData.category.name` | Yes | Yes |
| Prize name | `DrawReadinessData.category.prizeName` | Yes | Yes |
| Practice/Live mode | `DrawSession.mode` | Yes | Yes |
| DrawSession status | `DrawSession.status` | Yes | Yes |
| Winner count | Readiness/configuration snapshot | Yes | Yes |
| Eligible pool | `authoritativeEligibleCount` | Yes | Yes |
| Winning rule | `DrawConfiguration.winningRule` | Yes | Yes |
| Countdown duration | `EventSettings.presentation.countdownDurationSeconds` | Persisted, not consumed by Run | After wiring |
| Rolling duration | `EventSettings.presentation.rollingDurationSeconds` | Persisted, not consumed by Run | After wiring |
| Reveal style | `EventSettings.presentation.revealStyle` | Persisted | After wiring |
| Celebration effect | `EventSettings.presentation.celebrationEffect` | Persisted | After wiring |
| Reduced motion | Presentation setting plus browser preference | Partial | Yes |
| Winner layout | `winnerLayoutPreference` | Persisted, unused | After wiring |
| Audio enabled | `EventSettings.audioEnabled` | Persisted | After wiring |
| Reveal cue | `EventSettings.revealCue` | Persisted | After wiring |
| Target resolution | `DisplayConfiguration.targetResolution` | Yes | Yes |
| Safe-area margin | `DisplayConfiguration.safeAreaMargin` | Yes | Yes |
| Audience connection | Publisher/presence status | Yes | Yes |
| Display publication state | Publisher status/diagnostics | Yes | Yes |
| Presentation checkpoint | `PresentationCheckpointRecord` | Yes for Live | Yes |
| Selected tickets | `WinnerRecord.ticketNumber` / Practice projection | Yes | Yes |
| Winner status | Winner records in pending/history flows | Yes | Yes after projection |
| Recovery state | `decideLiveRecovery()` | Yes | Yes after UI wiring |
| Blackout state | Checkpoint or Practice projection | Yes | Yes |
| Updated timestamp | `DrawSession.updatedAt` | Yes | After human formatting |

Raw enum/timestamp rendering currently exists in the queue status label, queue `updatedAt`, queue checkpoint stage, and some pending-result cards.

## State-machine audit

### Queue

| State | Source | Current treatment | Primary action |
|---|---|---|---|
| Draft | `DrawSession.status` | Session card | Open Draw Setup |
| Ready | `status === ready` | Session card | Start Practice/Live |
| Drawing | `status === drawing` | Session card | Resume presentation |
| Pending confirmation | `status === pending-confirmation` | Session card/pending landing | Review Pending Results |
| Completed | `status === completed` | Session card | View History |
| Cancelled | `status === cancelled` | Session card | View History |
| Blocked relation | Missing persisted relation | Warning banner | No operational action |
| Recovery available | Live checkpoint exists | Raw checkpoint metadata | Resume presentation |

There is no explicit queue-level stale state; stale conditions are discovered during readiness validation.

### Run

| State | Current source/treatment | Expected parity treatment |
|---|---|---|
| Loading | `DrawRunPage` loading header | Header plus loading status |
| Blocked | Readiness/error branch | Dedicated blocked preflight panel |
| Ready for start | Recap, banner, start card | Prototype recap + readiness + preview + start gate |
| Confirmation/start gate | Hold controller/dialog | Preserve behavior, improve hierarchy |
| Countdown | `PresentationController` | Active stage with preview/status |
| Rolling | `PresentationController` | Active stage with preview/status |
| Reveal | Winner list | Adaptive winner presentation |
| Practice complete | `pending-handoff` branch | Finished rehearsal result panel |
| Live pending handoff | Checkpoint/pending flow | Read-only official handoff state |
| Refresh recovery | Checkpoint loading/resume | Explicit recovery banner and stage metadata |
| Persistence failure | `PresentationError` | Result-preserved error panel |
| Audience publication failure | Publisher status | Isolated publication warning |
| Disconnected Audience | Publisher status | Visible connection warning |
| Blackout active | Checkpoint/Practice state | Clear blackout status and restore action |

Current integrity behavior is sound: draws are event-driven, readiness is rechecked, winners are read back, refresh does not reselect, Practice uses local projection, Live confirmation is explicit, and Audience publication is not persistence authority.

## Queue redesign recommendation

Use one authoritative queue with visual priority:

1. Action-required Live sessions
2. Ready sessions, with unresolved Live sessions first
3. Practice sessions
4. Completed/cancelled sessions as secondary history references

Each card should contain event identity, category/prize identity, Practice/Live badge, lifecycle badge, winner quantity, human-readable updated time, recovery checkpoint, primary action, secondary metadata, and relation/readiness warnings.

Practice and Live should remain distinct through labels, badges, grouping, and action copy. Completed/cancelled sessions should remain queryable but should not dominate the primary operational queue.

## Target Draw Run layout

At approximately 1440×900:

```text
Live Draw
Event · Category · Prize
Practice/Live badge · readiness badge

Status banner

┌──────────────────────────────────────┬────────────────────────────┐
│ Configuration recap                 │ Audience preview            │
│ Category                            │ Resolution / safe area      │
│ Prize                               │ Connection/publication      │
│ Winner count                        │                            │
│ Eligible pool                       │ Start gate                  │
│ Winning rule                        │ Primary action               │
│ Presentation summary                │ Guidance                     │
├──────────────────────────────────────┤                            │
│ System readiness / preflight         │                            │
│ Participant data                     │                            │
│ Eligibility                          │                            │
│ Audience Display                     │                            │
│ Presentation sequence               │                            │
│ Operator confirmation               │                            │
└──────────────────────────────────────┴────────────────────────────┘
```

State transformations:

- Countdown: preserve recap and preview; make countdown stage dominant.
- Rolling: show rolling stage and publication state; keep configuration accessible.
- Reveal: replace preflight with winner presentation and synchronization status.
- Practice complete: show winners, rehearsal-only explanation, blackout state, and return action.
- Live pending handoff: show official result locked and pending confirmation.
- Refresh recovery: show resumed checkpoint and recovery explanation.
- Blocked: replace start gate with typed cause and allowed recovery action.

## Reusable production primitives

Safe reuse opportunities:

- `PageHeader`
- `StatusBanner`
- `Badge`
- `Card`
- `SummaryList`
- `Button` / `ButtonLink`
- `ConfirmationDialog`
- `AudiencePreviewSurface`
- Toast system
- Publisher connection status
- Existing checkpoint/recovery controller
- Existing readiness query

Prototype-only references that must not be imported into production:

- `liveDrawFixture`
- `PrototypeAudiencePreview`
- `PrototypeSystemCheck`
- `PrototypeNavigator`
- `scenario-query`
- Prototype static ticket streams, totals, and navigation helpers

## Proposed implementation slices

### Slice A — Queue structure and formatting

Likely files: `DrawSessionQueuePage.tsx`, `draw-session-queue.ts`, `operator.css`, and a new production queue view-model/formatting module.

Preserve existing query and action mapping. Add tests for labels, timestamp formatting, checkpoint labels, actions, and blocked relations.

Risk: deciding whether completed/cancelled sessions remain prominent requires product confirmation.

### Slice B — Ready/preflight parity

Likely files: `DrawRunPage.tsx`, a production Draw Run view model, readiness components, and `operator.css`.

Preserve the hold controller, explicit Live confirmation, readiness recheck, and no-draw-on-render behavior.

### Slice C — Audience preview integration

Likely files: `AudiencePreview.tsx`, `DrawRunPage.tsx`, a production Audience preview adapter, and `ProductionWorkspaceContext.tsx`.

Preserve publisher authority, transport scope, and publication-failure isolation. Remove the prototype type import.

### Slice D — Countdown/rolling/reveal parity

Likely files: `ProductionDrawPresentation.tsx`, presentation policy wiring, and `operator.css`.

Preserve checkpoint persistence, reduced-motion behavior, no reselection, and skip semantics.

### Slice E — Practice complete and Live handoff

Likely files: `ProductionDrawPresentation.tsx`, `DrawRunPage.tsx`, pending-results integration, and winner-layout styles/view model.

Preserve Practice isolation, Live pending confirmation, exact ticket strings, and official handoff relationships.

### Slice F — Responsive/accessibility verification

Likely files: `operator.css` and focused component tests.

Verify Operator at 1440×900, Audience at 1920×1080, keyboard focus, reduced motion, scroll behavior, and clipped actions.

## Acceptance criteria

- Production `/draw/live` and `/draw/run/:drawSessionId` visibly resemble the prototype at 1440×900.
- No raw ISO timestamp or concatenated raw enum/status label is shown.
- Configuration recap fits without unnecessary scrolling.
- Audience preview and start gate form one intentional supporting column.
- System readiness is visible before starting.
- Practice and Live are distinguishable without relying only on color.
- Winner layouts adapt for 1, 2, 6, 10, 20, and larger counts.
- No nested/double scrollbars or clipped controls.
- Keyboard focus remains visible.
- Reduced-motion preferences are honored.
- Exact ticket values such as `00042` remain unchanged.
- No prototype fixtures, components, or types enter production.
- Audience publication failures do not alter persisted results.
- Refresh does not reselect winners or duplicate WinnerRecords.

## Final assessment

The production contracts are sufficient for most visual parity work. The primary gaps are:

1. A production Draw Run view model combining readiness, settings, display configuration, publisher status, and checkpoint state.
2. A production-owned Audience preview contract.
3. Human-readable queue formatting.
4. Preflight/readiness composition.
5. Settings-driven presentation timing and winner layout.
6. Dedicated recovery, Practice completion, and Live handoff treatments.
7. Removal of the production-to-prototype type import.

No application source files were modified or committed as part of this audit.
