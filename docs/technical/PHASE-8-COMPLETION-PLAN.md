# Phase 8 Product Integration Completion Plan

Status: historical completion plan. Phase 8 Slice 15 closeout is complete at
`0e1185e86a9489eb4c8ebb2ccba9fc48971d0974`; see
[`PHASE-8-SLICE-15-CLOSEOUT.md`](./PHASE-8-SLICE-15-CLOSEOUT.md) and
[`PHASE-8-ACCEPTANCE.md`](./PHASE-8-ACCEPTANCE.md) for the current verdict.

Baseline:

```text
fa8b36bd2acd2026e08028748a645658541c158f
```

This plan audits the product surface at the Phase 8 baseline. It does not
start Phase 9, claim manual acceptance, or alter Phase 6/7 evidence.

## 1. Honest current product-state summary

Raffle OS currently contains two different products behind overlapping routes:

1. A high-fidelity Phase 2 presentation prototype, driven by deterministic
   fixtures and URL scenarios.
2. A partially connected local-first production foundation, driven by
   IndexedDB repositories and application services for participant import,
   draw authoring, secure Live selection, pending decisions, recovery,
   authoritative history, and Audience transport.

The production foundation is meaningful and heavily tested, but it is not yet a
complete product journey. The visible sidebar still points to prototype pages
for Dashboard, Participants, Live Draw, Pending Results, History, and Settings.
Only the default Draw Setup route and the hidden parameterized production
routes reliably reach authoritative data.

At this baseline:

- the worktree baseline is `fa8b36bd2acd2026e08028748a645658541c158f`;
- automated Phase 8 evidence is green and manual acceptance remains `NOT RUN`;
- `/dashboard` renders fictional fixture data and does not read IndexedDB;
- `/participants` defaults to a fictional import prototype; production import
  requires `?workflow=production`;
- `/draw/setup` is production only when `scenario` is absent, but it can read
  only the preference-selected active Event and cannot create/select an Event;
- `/draw/live` and `/draw/results` are prototype-only regardless of query
  parameters;
- `/history` is prototype-only unless `?source=production` is supplied;
- `/settings` is prototype-only, including Display settings;
- `/draw/run/:drawSessionId` and `/draw/pending/:drawSessionId` are production
  routes, but require an internal DrawSession ID in the URL;
- `/display` is a real Audience transport consumer but has no persisted event
  or display configuration context and is disconnected until a publisher has
  started on the exact BroadcastChannel;
- the existing development acceptance seed is not a complete product seed:
  it has six participants, four checked-in participants, two ready sessions,
  no DisplayConfiguration, and no datasets for counts 10, 20, or larger;
- there is no ordinary UI to create an Event, create a PrizeCategory, select the
  active Event, configure the Display, or open a production DrawSession by
  identity.

The result is a credible service and presentation prototype, not an operator
ready local-first raffle application.

## 2. Route and page inventory

| Route / entry | Current source | Classification | Current behavior and gap |
|---|---|---|---|
| `/` | Router redirect | Navigation | Redirects to `/dashboard`; therefore the first visible product screen is the fixture Dashboard. |
| `/dashboard` | `prototype/dashboard.ts`, fixture scenarios | Fixture-driven prototype | Fictional event, metrics, readiness, activity, and connection state. `Set up next draw` links into production Draw Setup, creating a data-context discontinuity. |
| `/participants` | Prototype unless `workflow=production` | Mixed route; prototype by default | Visible sidebar destination shows inert fixture import. Production participant import exists only at `/participants?workflow=production`. |
| `/participants?workflow=prototype&step=...` | `prototype/data/participant-import.fixture.ts` | Prototype | Step navigation is functional URL navigation only; no file, participant, or persistence behavior. |
| `/participants?workflow=production` | IndexedDB Event, Participant repositories, import unit of work | Partially connected production | Reads the preference-selected Event and persists validated CSV/XLSX imports, but has no normal entry link and no Event-selection flow. |
| `/draw/setup` | Draw authoring service, IndexedDB | Production route | Reads the active Event, categories, configuration, session, eligibility, storage, and Web Crypto readiness. Event selector is disabled; Event and PrizeCategory creation are absent. |
| `/draw/setup?scenario=...` | `DrawSetupPrototypePage`, fixture data | Prototype | Static readiness/insufficient-pool screens. Any visible link containing `scenario` returns to prototype behavior. |
| `/draw/live` | `liveDrawFixture`, query scenario resolver | Prototype-only | Countdown, rolling, audience preview, and controls navigate between fixture states. No selection, timer, persistence, Audience publisher, or result exists. The sidebar points here. |
| `/draw/run/:drawSessionId` | Draw readiness query, secure draw command, presentation checkpoint/publisher | Production | Requires a manually known route ID. Selects and persists the authoritative result before presentation. This is not linked from the sidebar; Draw Setup can reach it after a valid handoff. |
| `/draw/results` | `pendingResultsFixtures`, `redrawFixture` | Prototype-only | Confirmation, cancellation, and redraw controls only navigate between static scenarios. The sidebar points here instead of the production pending route. |
| `/draw/pending/:drawSessionId` | IndexedDB session/winner/redraw data, pending-decision services, publisher | Production | Reads and mutates official Live results with receipt/idempotency handling, cancellation, pending redraw, confirmed redraw, history linkage, and committed Audience projection. Requires a route ID or Draw Run handoff. |
| `/history` | `historyFixture` | Prototype-only by default | Static sessions, winners, audit, lineage, and disabled export controls. The sidebar points here. |
| `/history?source=production` | All Events, Live DrawSessions, Winners, Categories, Redraws | Production read model | Reads authoritative official history and renders statuses, timestamps, actor, reasons, and lineage. It is only reachable through a hidden query or a production pending-route link. |
| `/settings` | `settingsFixture` | Prototype-only | Branding, presentation, audio, and display controls are default-valued and inert. Save is disabled; no asset, preference, or DisplayConfiguration is read or written. |
| `/display` | BroadcastChannel Audience controller and public UI | Production transport surface, partially connected | Listens on a hardcoded production channel/scope. It is intentionally safe when no publisher is present, but has no event/display setup route and uses hardcoded public context. |
| `/display/prototype?state=...&count=...` | Audience fixtures and scenario resolver | Prototype | Static standby, countdown, rolling, reveal, confirmed, blackout, and disconnected screens. Settings links here, so visible settings navigation leads to prototype display behavior. |
| `*` | `NotFoundPage` | Dead/error route | Safe not-found page with a Dashboard link; it does not recover a missing production session or offer product setup. |

## 3. Sidebar and visible navigation classification

The visible sidebar is not a production navigation model. Its destinations are:

| Sidebar label | Target | Classification today | Control state |
|---|---|---|---|
| Dashboard | `/dashboard` | Fixture-driven prototype | Functional navigation to static data |
| Participants | `/participants` | Prototype default | Functional navigation to inert fixture import |
| Draw Setup | `/draw/setup` | Production by default | Functional production authoring, but dependent on hidden active-event seed |
| Live Draw | `/draw/live` | Prototype-only | Functional navigation to inert fixture states |
| Pending Results | `/draw/results` | Prototype-only | Functional navigation to inert fixture decision screens |
| History | `/history` | Prototype default | Functional navigation to static history |
| Settings | `/settings` | Prototype-only | Functional tab navigation; all persistence/save controls inert |

The shell footer correctly says `Static prototype` for most of these views, but
that is not enough: a normal product user should not be routed from a visible
production workspace to a fixture screen. The completion rule is explicit:

> No visible production menu, primary action, or operational handoff may lead
> to prototype or inert behavior.

Prototype screens may remain available only behind an explicitly labeled
development/prototype surface that is not part of ordinary operator navigation.

## 4. Production versus prototype classification

### Authoritative production surfaces

- Participant import at the explicit production workflow path: reads the active
  Event and persists validated imports atomically.
- Draw Setup: reads and writes DrawConfiguration/DrawSession authoring data and
  evaluates readiness against authoritative participants and storage.
- Draw Run: revalidates the persisted session, selects with Web Crypto, writes
  snapshots/winners/audit/checkpoints atomically, and presents the locked result.
- Production Pending Results: reads authoritative records and exposes confirm,
  cancel, pending redraw, and confirmed-original redraw commands with receipt
  handling and lineage.
- Production History: reads Live sessions and related official records across
  Events.
- Audience `/display`: consumes the public projection and supports safe states,
  reconnect, blackout, and fullscreen behavior.

### Fixture-driven or prototype surfaces

- Dashboard and its scenario selector.
- Default Participants route and all prototype import steps.
- Draw Setup routes with a `scenario` parameter.
- Live Draw and all its query-driven stages.
- Pending Results and all query-driven scenarios/panels.
- Default History and its session/winner/audit/detail views.
- Settings and every branding, presentation, audio, and display control.
- Audience `/display/prototype`.

### Partially connected surfaces

- Operator shell: can resolve a preference-selected Event on selected routes,
  but still renders prototype event/mode/connection data in the general shell.
- Draw Setup: authoritative after a hidden active Event and category already
  exist, but cannot create or choose them.
- Production Draw Run: authoritative and reachable from Draw Setup, but not from
  a stable user-facing session list or operational navigation.
- Production Pending Results: authoritative and actionable, but only reachable
  through the internal session-ID route or Draw Run handoff.
- Audience: production protocol is real, but publisher startup, event identity,
  display configuration, and public branding are not product-configured.

## 5. Which pages read authoritative IndexedDB data

| Page/component | IndexedDB behavior |
|---|---|
| `OperatorLayout` on production Participants/Draw Setup | Reads `activeEventId` preference and the corresponding Event for header context. |
| `ProductionParticipantImportPreview` | Reads Event and persisted Participants; commits validated imports through the participant unit of work. |
| `DrawSetupPage` | Reads active Event, PrizeCategories, DrawConfiguration, DrawSession, preferences, participant eligibility, storage readiness, and Web Crypto readiness; saves authoring data. |
| `DrawRunPage` | Reads DrawSession, Event, configuration/category, authoritative eligibility, checkpoints, and Practice projection; executes the production draw command when the user starts. |
| `ProductionPendingResultsPage` | Reads DrawSession, Event, PrizeCategory, Winners, Redraws, checkpoint blackout state, and receipt-backed services; commits official decisions. |
| `ProductionHistoryPage` | Reads all Events, Live DrawSessions, Winners, categories, and Redraws; builds the official history read model. |
| Production service composition | Wires Event, Participant, PrizeCategory, DrawConfiguration, DrawSession, Winner, Preference, checkpoint, Redraw, receipt, persistence, and random-source repositories. |
| `AudienceDisplayPage` | Does not read IndexedDB. It reads only public BroadcastChannel envelopes. |

The following visible pages do not read authoritative data:

- Dashboard;
- default Participants;
- Live Draw;
- default Pending Results;
- default History;
- Settings; and
- Audience prototype.

## 6. Control behavior audit

### Functional production controls

- Production Participant file selection, parsing, mapping, validation, strategy
  selection, confirmation, and atomic commit.
- Draw Setup fields and save, readiness retry, Live handoff confirmation, and
  Practice/Live authoring mode selection.
- Draw Run hold-to-start/accessibility confirmation, presentation skip,
  presentation handoff, checkpoint recovery, and production retry.
- Production Pending Results selection, Select All Pending, confirm, cancel,
  pending redraw, confirmed redraw, reason/note validation, confirmation
  dialogs, and receipt-safe reload.
- Production History read-only rendering.
- Audience fullscreen control and transport-driven rendering.

### Functional but wrong-context controls

- Dashboard `Set up next draw` navigates to a real production route while the
  page itself supplies fictional event readiness and may have no active Event.
- Prototype Participant summary links to Draw Setup with `scenario=ready`,
  deliberately returning to prototype behavior.
- Settings `Preview display` links to `/display/prototype`, not production
  `/display`.
- Production pending links to production history and Draw Setup, but the first
  link to Pending Results from the sidebar is prototype.

### Inert or fixture-only controls

- All prototype Live Draw controls, including stage transitions and Review
  Pending Results.
- All prototype Pending Results confirmation/cancellation/redraw controls;
  they navigate fixture scenarios and never mutate persistence.
- Prototype import step buttons; they change the displayed step only.
- Settings inputs, toggles, asset buttons, audio controls, and Save settings.
- History prototype exports; they are disabled by design.
- Prototype display controls and scenario links.

The current product does not make the distinction safe enough because the inert
controls are located at ordinary sidebar destinations. The completion work must
either remove those destinations from production navigation or replace them with
real production pages before any manual acceptance is attempted.

## 7. Event and DrawSession selection flow

### Current flow

1. A development seed or another internal setup writes the `activeEventId`
   preference.
2. Production Participants and Draw Setup read that preference.
3. Draw Setup disables the Event field; it can only edit configuration for the
   already selected Event.
4. Draw authoring finds or creates a configuration/session for that Event and
   stores the selected mode on the ready DrawSession.
5. Handoff navigates to `/draw/run/:drawSessionId` using the internal session ID.
6. Draw Run reads the session ID from the URL and derives Event/configuration/
   category/eligibility from authoritative records.
7. Presentation handoff navigates to `/draw/pending/:drawSessionId`.
8. Pending Results continues to use the route session ID for decisions and
   public projection.
9. Production History discovers all Live sessions by scanning persisted Events;
   it is not the source of selection for the active operation.

### Product gaps

- There is no Event list, Event creation, Event open/select, or active-event
  switcher.
- There is no PrizeCategory creation or editing surface; Draw Setup can only
  select an existing category.
- There is no DrawSession list or user-facing session identity; a user must
  arrive through Draw Setup or know a route ID.
- There is no visible recovery entry point for an unresolved Live session.
- The active Event preference can be changed only through internal seed/setup
  mechanisms, not ordinary operation.
- Production route identity and shell context are split: some routes resolve the
  route session while others resolve the preference Event.

### Required selection model

Introduce a single production workspace context with:

- an Event list/create/open/select flow;
- persisted active Event selection with explicit readback and safe empty state;
- PrizeCategory management scoped to the selected Event;
- a DrawSession list showing ready, active, pending, completed, and cancelled
  states;
- explicit resume/recover actions for pending or presentation-interrupted
  sessions; and
- route links generated from persisted IDs rather than typed or copied IDs.

Ordinary operation must never require DevTools, manual route IDs, or internal
seed commands.

## 8. Why `/display` reports disconnected

`/display` creates an Audience controller on the hardcoded same-origin channel:

```text
raffle-os-display:production-event:public-display
```

It does not read IndexedDB and it does not start a publisher. The Audience
controller correctly remains in connecting/disconnected-safe state when it has
not received a valid public envelope from an Operator publisher.

The production publisher starts only when `ProductionDrawPresentation` or
`ProductionPendingResultsPage` is mounted. Those pages are reached through the
production Draw Setup handoff or a manually addressed production route. Opening
`/display` from Settings, or opening it before an Operator publisher exists,
therefore produces the observed disconnected state.

There are three product-level causes behind the symptom:

1. no production Display setup/launch workflow;
2. hardcoded transport scope instead of the selected Event/DisplayConfiguration;
3. visible operator navigation routes to prototype pages that never start the
   publisher.

This is not evidence that the Audience protocol is broken. It is evidence that
publisher startup and display context are not yet a complete product flow.

## 9. Display configuration and publisher startup

The persistence layer already has a validated `DisplayConfiguration` model and
repository with one configuration per Event, including resolution, safe-area
margin, and blackout appearance. The production UI does not compose or expose
that repository.

Current state:

- Settings renders fixture values and disabled save controls.
- `/display` uses hardcoded public context and hardcoded transport scope.
- Production Operator layouts can show a display indicator only on the
  production Draw Run/Pending shell.
- The publisher is started as a side effect of production presentation/pending
  pages, not from a user-controlled display launch or readiness workflow.
- There is no normal UI to open an Event's Audience route with the correct
  persisted display identity, test the connection, or show which display is
  active.

Required completion behavior:

- Settings must read/write the selected Event's DisplayConfiguration through a
  production service.
- The selected Event and DisplayConfiguration must produce the transport scope
  and public branding context.
- Operator must have an explicit `Open Audience Display` action and a
  connection/readiness state.
- Publisher lifecycle must be owned by the active production draw workspace,
  with safe start/stop/reconnect behavior and no mutation on publication
  failure.
- Audience must remain read-only and public-payload-only.

## 10. Implemented capabilities not connected to ordinary UI

The following capabilities are present in domain/application/infrastructure
code or tests but are not fully exposed through normal product navigation:

- Event repository create/update/select behavior;
- PrizeCategory repository create/update behavior;
- DisplayConfiguration repository create/update behavior;
- authoritative Participant repository and atomic import unit of work;
- candidate-pool eligibility evaluation, including check-in/group/previous
  winner rules and exact ticket strings;
- Web Crypto random source, bounded selection, and duplicate prevention;
- atomic Live DrawSession snapshot/winner/audit persistence;
- presentation checkpoints and recovery query/controller;
- command receipts and idempotent confirmation/cancellation/redraw services;
- redraw capacity evaluation and original-to-replacement lineage;
- committed-only public projection and privacy-safe protocol validation;
- BroadcastChannel reconnect, restore request, sequence protection, blackout,
  and fullscreen controllers;
- official history read model; and
- development seed/reset/inspect APIs.

These services are not a substitute for user-facing integration. Internal seed
APIs are test tools and must not become the product's event/setup workflow.

## 11. Missing deterministic data and setup for product testing

The current deterministic mechanisms are insufficient for product-level
testing:

- the browser acceptance seed is Phase 5-oriented, with six participants and
  only four checked in;
- it contains exact `00042` and `42`, but not enough eligible records for the
  required 6/10/20/larger winner-count scenarios;
- it contains two ready sessions but no DisplayConfiguration;
- the capacity profile creates many Participants but no Event-owned category,
  DrawConfiguration, or DrawSession;
- there is no normal UI to create the missing Event/category/display/session
  records;
- there is no deterministic product fixture that can be selected from inside
  the application without DevTools or an internal route ID;
- there is no reusable dataset matrix for pending, partial-confirmed,
  all-cancelled, completed, pending-redraw, confirmed-redraw, and blackout
  recovery states.

Required test setup work:

- define a product-level deterministic fixture contract with stable Event,
  DisplayConfiguration, PrizeCategories, Participants, exact tickets, and
  DrawSessions;
- cover winner counts 1, 6, 10, 20, and the supported upper-bound scenario;
- include checked-in/un-checked-in, groups, duplicate/near-duplicate ticket
  cases, previous winners, pending winners, cancelled originals, and redraw
  capacity boundaries;
- make the fixture loadable through a clearly development-only test harness or
  through ordinary product setup, without adding production bypasses; and
- include a clean reset/seed verification path for automated tests and a
  separate owner-facing setup path that does not require DevTools.

## 12. Required production completion work

The work is product integration within Phase 8, not a new Phase 9 feature set.

1. Replace the visible prototype-first shell with an authoritative production
   workspace context.
2. Add Event create/open/select and active-event persistence/readback.
3. Add PrizeCategory management and make Draw Setup depend on the selected
   Event/category context.
4. Promote Participant Import to the normal `/participants` destination.
5. Replace prototype Live Draw navigation with the production Draw Run handoff.
6. Replace prototype Pending Results navigation with a session-aware production
   queue and recovery entry point.
7. Promote official History to the normal `/history` destination.
8. Replace inert Settings with persisted production DisplayConfiguration and
   presentation settings that are in current Phase 8 scope.
9. Connect Event/display identity, public branding, connection status, and
   publisher lifecycle across Operator and Audience.
10. Add product-level deterministic test setup and recovery fixtures.
11. Remove or isolate prototype routes from ordinary production menus and
    primary actions.
12. Resolve visible production usability defects and verify responsive,
    accessibility, reduced-motion, and target viewport behavior.

CSV/XLSX export, backup/restore, online registration, authentication, cloud
storage, and other PRD features explicitly outside the existing Phase 8 plan
remain separate backlog items. They must not be silently presented as complete
by this work.

## 13. Slice breakdown beginning with Slice 8

### Slice 8 — Production workspace and route authority

- define one production shell/context for selected Event, mode, active session,
  and display status;
- make default sidebar destinations production routes;
- remove prototype scenario controls from production shells;
- route every operational CTA to authoritative pages or an explicit blocked
  setup state;
- add route-level tests proving no visible production route renders fixtures.

### Slice 9 — Event and PrizeCategory setup

- add Event list/create/open/select UI;
- persist and validate active Event selection;
- add PrizeCategory list/create/edit UI scoped to the selected Event;
- provide safe empty/loading/immutable Event states;
- make Draw Setup use explicit context rather than a hidden preference-only
  dependency;
- add repository, service, route, and browser-facing component tests.

### Slice 10 — Participant import as ordinary operation

- make `/participants` open the production import workflow;
- retain prototype import only behind an explicit development-only surface;
- connect successful import to selected Event context and refresh Dashboard/
  Draw Setup counts;
- expose persisted participant count and import status in production workspace;
- verify participant mutation lock and active-session guards in the UI.

### Slice 11 — Production draw queue and journey

- replace sidebar Live Draw with a production DrawSession queue/start surface;
- show ready, active, pending, completed, and cancelled sessions from IndexedDB;
- provide resume/recover actions without manual IDs;
- connect Draw Setup to Draw Run and Draw Run to Pending Results through
  generated links;
- make Pending Results the default decision route;
- preserve Practice/Live separation and explicit Live confirmation.

### Slice 12 — Production History and decision navigation

- promote the official history read model to `/history`;
- add session filtering/detail navigation from persisted records;
- link pending/completed/cancelled/redraw sessions into official history;
- keep exports clearly unavailable if still outside Phase 8, with no fake
  enabled control;
- remove fixture history from ordinary navigation.

### Slice 13 — Display configuration and Audience launch

- connect Settings to persisted DisplayConfiguration and selected Event
  branding/presentation data;
- add explicit Open Audience Display and connection-test actions;
- derive transport scope/public context from production configuration;
- start and recover the publisher from the production draw workspace;
- verify early join, late join, reconnect, blackout, fullscreen, multiple
  Audience windows, and publication-failure isolation.

### Slice 14 — Product-level deterministic setup and visual completion

- provide the approved deterministic product test dataset/harness;
- cover exact tickets and winner-count matrix;
- fix production layout, scrolling, clipping, focus, disabled-submission, and
  reduced-motion defects;
- add user-visible error/recovery states for missing Event, missing category,
  missing display configuration, stale session, and storage failure;
- complete route/source audits and remove accidental fixture imports.

### Slice 15 — Automated integration closeout

- run the full suite plus route/source leakage checks;
- verify production journey tests from selected Event through history;
- verify persistence, receipts, recovery, Audience privacy, and exact tickets;
- record build/lint/typecheck/test/diff evidence;
- prepare, but do not execute, owner-driven Chrome/Edge acceptance.

Manual browser acceptance begins only after Slice 15 is complete and the owner
has approved the product-level seed/setup. It is not a substitute for missing
UI integration.

## 14. Dependencies and ordering

```text
Existing Phase 6/7 contracts and Phase 8 mutation services
        |
        v
Slice 8: production shell and route authority
        |
        +--> Slice 9: Event/category context
        |          |
        |          v
        +--> Slice 10: participant import on selected Event
                   |
                   v
        Slice 11: DrawSession queue and end-to-end production journey
                   |
          +--------+---------+
          v                  v
Slice 12: History       Slice 13: Display/Audience
          \                  /
           +-------+--------+
                   v
        Slice 14: deterministic setup + visual completion
                   |
                   v
        Slice 15: automated closeout
                   |
                   v
        Owner Chrome/Edge manual acceptance
```

Ordering rules:

- Event selection precedes participant import and draw authoring.
- Participant import and eligibility must be authoritative before a session can
  be marked ready.
- DrawSession navigation must be user-generated before pending decisions can be
  accepted through the UI.
- History and Audience consume committed production records; they must not
  become authorities or invent state.
- Display configuration must be persisted before public branding and transport
  scope can be derived from the Event.
- Deterministic setup must exist before browser acceptance is scheduled.
- No slice may route an ordinary user to a prototype or inert control.

## 15. Definition of product-complete for Phase 8

Phase 8 product integration is complete only when a normal user, without
DevTools, manual route IDs, internal seed commands, or fixture query parameters,
can:

1. create/open/select a local Event;
2. create/select a PrizeCategory and configure a draw;
3. import and validate Participants for that Event;
4. see authoritative eligible counts and readiness;
5. open or resume the production DrawSession from visible navigation;
6. run Practice and Live with clear mode separation;
7. open a same-origin Audience Display from visible UI;
8. observe countdown, rolling, reveal, pending, partial confirmation, final
   confirmation, cancellation, pending redraw, confirmed redraw, blackout,
   reconnect, and safe recovery;
9. refresh/reopen without re-running selection or submitting a command twice;
10. inspect official History with timestamps, actor, reasons, status, and
    original/replacement lineage; and
11. use visible navigation for every step without encountering fixture data or
    inert production-looking controls.

The product-complete gate also requires the automated strategy in Section 16,
the approved deterministic data matrix, and owner-observed Chrome/Edge evidence
after implementation. This definition does not claim PRD features explicitly
outside Phase 8, such as export or backup/restore.

## 16. Automated verification strategy

Each slice must add or update tests at the layer it changes:

- route tests: default production paths, redirects, session-aware links,
  prototype isolation, and no fixture imports in production routes;
- component tests: loading/error/empty/success states, disabled controls,
  dialog focus/return, keyboard operation, reduced-motion behavior, and no
  clipped or nested-scroll layout assumptions where testable;
- service tests: Event selection, category ownership, participant import,
  DisplayConfiguration, session queue/recovery, and publisher lifecycle;
- persistence tests: active Event readback, atomic writes, migration
  compatibility, receipts, history lineage, checkpoint recovery, and no data
  loss on failed operations;
- draw/eligibility tests: exact string tickets, `00042` versus `42`, counts 1,
  6, 10, 20, supported larger counts, duplicate prevention, check-in/group
  rules, redraw capacity, and Practice/Live isolation;
- transport tests: public-only payload, no Participant/private fields, early and
  late Audience join, reconnect, ordering, blackout, fullscreen fallback, and
  publication failure not rolling back persistence;
- integration tests: selected Event -> import -> setup -> Draw Run -> Pending
  decisions -> History, including refresh/remount and no command from render;
- static/source audit tests: production route trees and visible navigation must
  not import prototype fixtures or link to prototype-only destinations.

Required verification commands for implementation slices remain:

```text
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
git diff --check
```

Automated green status does not close the manual gate.

## 17. Final owner-driven browser acceptance

Only after the complete UI journey exists, Slice 15 is green, and deterministic
product setup is available, the owner runs the prepared manual matrix:

- Chrome first, then targeted Edge parity;
- Operator `1440 x 900` and Audience `1920 x 1080`;
- normal visible routes only, with no DevTools setup or typed session IDs;
- core Live flow, cancellation, pending redraw, confirmed redraw, recovery,
  Audience integration, privacy/exact tickets, accessibility/layout, and all
  deferred Phase 6/7 browser debt;
- exact browser version, Event/session identity, action sequence, observed
  result, status, and screenshot/console/history evidence for every row.

No manual row may be marked `PASS` from automated evidence or expected behavior.
The current Phase 8 acceptance record remains unchanged until those owner
observations are supplied.

## 18. Risks, rollback, and exit criteria

### Risks

- routing changes can accidentally expose fixture behavior as official;
- Event/context changes can strand existing active-event preferences or sessions;
- category/display ownership errors can cross Event boundaries;
- publisher lifecycle changes can expose stale or private data;
- UI integration can create duplicate commands or refresh-triggered mutations;
- large participant/winner datasets can reveal performance, scrolling, or
  browser-storage failures;
- replacing prototype pages can remove useful design references before their
  production equivalents are verified.

### Rollback

- keep existing domain/persistence contracts additive and preserve stored data;
- roll back route/shell integration independently from mutation services;
- never delete IndexedDB records, audit evidence, receipts, or migrations to
  make a failed workflow appear clean;
- keep prototype assets available in an explicitly isolated development area
  until production replacements are accepted;
- if a UI slice fails, disable its production entry point with an honest blocked
  state rather than routing to a prototype or silently mutating data;
- do not downgrade the IndexedDB schema in place.

### Exit criteria

- every visible sidebar destination is production-connected or explicitly removed
  from the production menu;
- no ordinary route renders fixture data or presents an inert production-looking
  action;
- Event, category, participant, DrawSession, DisplayConfiguration, and active
  context flows work through normal UI;
- the complete Dashboard -> Participants -> Draw Setup -> Live Draw -> Pending
  Results -> History journey uses authoritative data;
- Audience launch, publisher startup, reconnect, blackout, fullscreen, and
  privacy behavior are UI-connected;
- deterministic product-level setup supports all required winner counts and
  exact-ticket cases;
- automated verification passes with no regression to Phase 6/7 contracts;
- owner-driven Chrome and Edge browser evidence is complete; and
- only then may the Phase 8 acceptance record be updated from `NOT YET
  ACCEPTED`.
