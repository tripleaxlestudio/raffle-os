# Kocokan UI Redesign — Controlled Visual Modernization

## Decision and authorization

Owner approval: 2026-08-31. The eight-slice migration is approved as a plan.
**Slice 0 is accepted. The owner separately authorized Slice 1 only on
2026-08-31. Slice 1 implementation is awaiting owner review; Slice 2 is not
authorized.** See [Slice 1 evidence and limitations](KOCOKAN-UI-SLICE-1.md).
This is a dedicated visual
modernization workstream, not a new functional Phase 11 item or a Phase rename.

The public product identity for the future Operator theme is **KOCOKAN**:
playful, confident soft neo-brutalism for an event-control console. It is not a
marketing website, not a palette-only reskin, and not border + shadow on every
nested container. Strong outlines and small hard shadows belong to major
cards, primary controls, active navigation, operational blocks, and dialogs;
supporting content normally stays flat.

### Relationship to existing plans

- [Phase 11 plan](PHASE-11-PLAN.md) retains its functional requirements,
  independent acceptance gates, numbering, and broad-redesign non-goal within
  that workstream. This separately approved plan owns the redesign.
- [TASKS.md](../../TASKS.md) links this workstream independently; it does not
  silently add redesign to 11.2A or change the release sequence.
- Historical acceptance documents are not rewritten. Existing failure debt
  remains visible in the [new baseline](KOCOKAN-UI-REDESIGN-BASELINE.md).
- Product behavior continues to follow [PRD](../product/PRD.md) and the later
  approved production decisions. New visual branding does not rename routes,
  database keys, packages, identifiers, or historical product documents.
- Packaging, localization defect reconciliation, new diagnostics, and new
  Audience features remain independently owned/approved work. No new feature
  is authorized just because it appears on a redesigned screen.

## Immutable starting point

- Starting branch: `codex/phase11`.
- Prior HEAD: `81c645a`.
- Preserved Phase 11 checkpoint / production baseline:
  `523da4642556aa8ae033f6cf61cd1f663d211249`.
- Redesign branch: `redesign/kocokan-ui`, created from that clean checkpoint.
- Slice 0 commit contains only planning, inventory, and baseline evidence.
  Its parent identifies the frozen production tree; find it with
  `git log --oneline -- docs/technical/KOCOKAN-UI-REDESIGN-PLAN.md`.
- No visible or invisible theme infrastructure was necessary in Slice 0.

## Frozen contracts

Presentation-layer changes only. Keep draw engine, eligibility, Web Crypto
selection, ticket strings/leading zeroes, confirmation, cancellation, redraw
lineage, Live/Practice semantics, Event ownership, history reconstruction,
exports, command receipts, recovery, local persistence/schema/migrations, and
route behavior unchanged. Never hide an error or change a readiness guard to
make a visual screenshot look better. Never derive a winner from animation.

Audience protocol, BroadcastChannel, publisher lifetime, acknowledgements,
state machine, reconnect, blackout, safe area, branding assets, and browser
fullscreen remain frozen. In particular the baseline already includes the
owner-approved removal of public fullscreen controls: do not reintroduce them.

`/display` is NOT to be redesigned. Live Operator previews continue to render
`AudiencePresentation`; only their external frame/control chrome may change.
No fork of presentation CSS or replacement preview renderer is permitted.
The existing Settings static preview is separately inventoried; do not silently
turn it into another live publisher or a new presentation engine.

## Theme isolation decision (implemented in Slice 1; awaiting review)

Use an explicit production opt-in, such as `data-ui-theme="kocokan"`, plus
namespaced `--kc-*` tokens and `kc-*` presentation classes. Do not attach the
theme to `html`, `body`, `:root`, every `[data-interface="operator"]`, or every
legacy `.ui-*` selector. Those are shared with prototypes and fallback/portal
surfaces and are insufficient isolation boundaries.

1. Put the provider/marker on production Operator ownership only. Keep
   `ProductionWorkspaceProvider` and publisher mount boundaries unchanged.
2. Do NOT map generic inherited variables (`--app-bg`, `--text-primary`,
   `--radius-*`, `--space-*`, `--accent`) across the whole production shell:
   Audience previews currently inherit several of these. New components read
   `--kc-*` directly; legacy/Audience descendants keep their baseline values.
3. Shared React primitives may consume a small presentation-only theme context
   to opt their own DOM root into `kc-*` styling. The default is legacy. Avoid
   broad descendant selectors such as `[data-ui-theme] h1`/`button`/`svg`.
   If font or line-height inheritance would reach preview internals, style the
   Operator text/control elements explicitly, not the shared ancestor. Do not
   add a blanket light `color-scheme` ancestor affecting preview internals.
4. React portals retain React context, NOT CSS inheritance. Modal/SidePanel
   portal roots must explicitly carry the production theme marker. Scope all
   their tokens to that root; do not depend on a body-level theme mutation.
   Preserve existing focus trap, inert handling, dismissal and return-focus.
5. The Pending `react-select` body portal is a distinct adapter: opt in its
   menu root and token styles explicitly. Preserve its existing portal host
   during Slice 1; do not move it outside/inside modal inert boundaries
   without independent keyboard/pointer verification. Its page-owned styling
   integration belongs to Slice 4. No replacement select dependency.
6. RouteErrorPage/AppErrorBoundary/NotFound render outside the normal shell.
   Their production-only opt-in must distinguish `/display` and `/dev/*`
   failures; never infer all operator-looking errors are production. Retain
   existing recovery links and error-sanitization behavior. Integration is
   Slice 6, using the same primitive API.
7. `/dev/prototypes` remains on the legacy theme. The router currently mounts
   prototype routes separately but not all are DEV-gated; changing route
   exposure is explicitly NOT part of this redesign.
8. Verify computed colors/fonts/spacing and screenshots of Audience, live
   preview, static preview, and prototypes before/after Slice 1. A boundary
   is accepted only with evidence, not because a data attribute exists.

## CSS architecture decision

Current imports: `app.css` imports Tailwind, tokens, primitives, operator, and
audience styles. `app.css` also contains shell/base styling; unlayered legacy
rules and repeated selectors make blindly appending overrides risky.

Proposed new ownership (create only as the owning slice needs each file):

```text
src/styles/
  app.css                 existing bootstrap/base imports; no global rewrite
  tokens.css              existing legacy/Audience tokens retained
  primitives.css          legacy primitive compatibility until consumers retire
  operator.css            legacy rules reduced only after verified migration
  audience.css            frozen presentation styling
  kocokan/
    tokens.css            --kc-* on explicit theme roots only
    primitives.css        opt-in primitive rules, interactions and portals
    shell.css             production shell/chrome only
    dashboard.css         Slice 2
    preparation.css       Events, Prize Categories, Participants/import (Slice 2)
    draw.css              setup/queue/run chrome only (Slice 3)
    pending.css           Slice 4, including reason-select adapter
    history.css           Slice 5
    settings.css          Slice 6, excluding preview internals
    states.css            Slice 6 composed fallback/recovery states
```

Migration order: new design system first -> opt in primitives/shell -> migrate
page compositions by slice -> remove obsolete production declarations after a
consumer audit. Do not reorganize 7,197 lines in Slice 0 or 1.

For a migrated primitive, prefer mutually exclusive legacy vs Kocokan class
selection; keep layout hooks only where necessary. For page styles, rename
the migrated visual hooks deliberately rather than winning specificity wars.
Evaluate CSS cascade layers explicitly: a new layered stylesheet will not
automatically override existing unlayered declarations. New namespaced rules
should have one owning file, not a giant global override sheet. No broad
`!important`, no magic-number copies, and no thousands of appended rules.

Legacy cleanup requires `rg` evidence for static and dynamic class consumers,
including prototypes, tests, portals and Audience preview CSS in operator.css.
Where prototypes still consume old rules, retain them as intentionally isolated
legacy compatibility, not a second production design system. By Slice 7 no
production Operator surface may accidentally remain on legacy styling;
prototype and Audience exceptions must be listed explicitly.

## Target token specification (proposal only)

No CSS is applied by this document. Values are starting design choices to
verify for contrast and visual hierarchy in Slice 1. Foreground-on-fill tokens
are separate from body text so purple buttons do not inherit dark body text.

| Token (`--kc-` prefix) | Proposed value | Purpose |
|---|---|---|
| `page` | `#F6F3ED` | Warm page background |
| `surface` | `#FFFFFF` | Main content |
| `surface-muted` | `#EEEAE3` | Quiet supporting area |
| `text` | `#24212B` | Readable charcoal body/headings |
| `text-muted` | `#625C6B` | Secondary text, not low-opacity tiny text |
| `outline` | `#29232F` | Structural stroke/hard shadow |
| `divider` | `#D3CDD8` | Flat nested rows, not another heavy box |
| `primary` / `primary-hover` | `#6D3ADB` / `#5B2DBD` | Brand purple action |
| `on-primary` | `#FFFFFF` | Primary action label |
| `selection` / `selection-outline` | `#EDE3FF` / `#6D3ADB` | Persistent lavender selection |
| `success` / `success-surface` | `#176746` / `#E1F3E8` | Ready/connected/confirmed |
| `warning` / `warning-surface` | `#795000` / `#FFF0C2` | Caution/pending, with icon/text |
| `danger` / `danger-surface` | `#A62F3F` / `#FCE5E5` | Destructive action/error |
| `on-danger` | `#FFFFFF` | Destructive button label |
| `info` / `info-surface` | `#50368D` / `#F0EAFE` | Neutral information/recovery |
| `disabled-surface` / `disabled-text` | `#E5E0E8` / `#716A79` | Non-interactive state, no tactile lift |

Live/Practice retain explicit words and selected/pressed semantics; do not
use red as selection fill. Ready/connected colors are not a substitute for
actual readiness/presence. Destructive dialogs stay light with a destructive
button; no full red modal. Cancelled history remains visible/read-only.

| Token group | Proposed specification |
|---|---|
| Border | `border=2px`, `divider-width=1px`; reserve bold outline for major surfaces |
| Radius | `radius-control=12px`, `radius-card=16px`, `radius-modal=20px`, badge may use full radius |
| Hard shadow | `shadow-control=2px 2px 0 var(--kc-outline)`, `shadow-card=4px 4px 0 var(--kc-outline)`, `shadow-modal=6px 6px 0 var(--kc-outline)`; zero blur |
| Space | `space-1..6,8,10,12` = `4,8,12,16,20,24,32,40,48px`; no global legacy spacing overwrite |
| Control | compact `36px`, normal `44px`, important `52px`; square icon controls use matching size; table rows stay compact |
| Focus | `focus=#5B2DBD`, `focus-width=3px`, `focus-offset=3px`; white separation where a purple control needs it |
| Typography | existing system sans stack; local geometric personality through weight/tracking; existing mono stack for tickets |
| Scale | `12/14/16/18/24/32px`; operational labels 14px, body 16px; important metrics 32–40px; tabular numbers |
| Weight/leading | `500/650/750/800`; body 1.5, controls 1.2, headings 1.15; headings tracking about -0.025em |
| Shell | initial sidebar 240px, compact header 68px, page gap 20–24px; final fit verified at all targets |
| Motion | color/shadow/transform 120ms ease-out; hover at most -1px; press +1/+2px with collapsed shadow; no layout reflow |
| Reduced motion | no lift/translation, immediate state; preserve visible focus and non-color cues |

No gradients, glass, neon, remote fonts, or new dependencies. Existing gradients
are catalogued in the inventory; Audience gradients are frozen exceptions,
not targets for removal to satisfy the Operator theme rule.

## Slice ownership and acceptance

| Slice | Declared scope | Slice-specific acceptance |
|---|---|---|
| 0 — Baseline & Scope | Preservation, branch, evidence, plan, inventory, token proposal | Traceable clean starting commit; exact failure register; no application changes; separate docs/evidence commit; stop for approval |
| 1 — Visual System & App Shell | Opt-in theme infrastructure, shared primitives, shell/sidebar/header/Event context/Audience shortcut/status | No preview/prototype leakage; keyboard/portal/disabled behaviors retained; shared controls consistent; header fits target widths; full suite required |
| 2 — Dashboard & Event Preparation | Dashboard, Events, Prize Categories, Participants, import steps/pagination, setup continuation | Workflow-led dashboard; compact grouped forms; import mapping/validation/atomic commit behavior retained; no data mutation for styling |
| 3 — Draw Console | Draw Setup, Live queue, Draw Run, presentation controls/outer preview frame | Capacity and count readable; custom input alignment; explicit Live/Practice; all runtime controls/recovery handoffs retained; preview internals frozen |
| 4 — Pending Results | Landing/detail, compact grids, selection and confirm/cancel/redraw dialogs/reason menu | Selected state persists under hover/focus; compact wide grids; Start Next Draw prioritized; no decision semantics or receipts changed |
| 5 — History | List, detail, All Winners, filters, export menu and Show/Hide chrome | List stays table-first; tickets/lineage readable; export untouched; Show/Hide follows retained Audience state |
| 6 — Settings & Cross-App States | Presentation/Display/Branding/Audio, existing diagnostics/test controls, all composed loading/empty/blocked/error/recovery/fallback/toast states | Grouped controls; real switches retained; display-test/save behavior unchanged; no stray legacy portal/fallback styling; no new Log feature |
| 7 — Integrated Visual Acceptance | Every inventoried route/state, all targets and Audience/prototype exclusions | Full test suite; before/after visual review; critical journeys; obsolete-production CSS audit; clean final tree; no release claim without owner acceptance |

Every implementation slice MUST:

1. Change only its declared surfaces; list intentional cross-route primitive
   effects. No unplanned functional fix bundled into a visual commit.
2. Preserve frozen contracts and existing behavioral tests.
3. Run relevant focused tests; adjust only assertions strictly coupled to
   intentionally changed visual markup, without weakening behavior.
4. Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, and
   `git diff --check`.
5. Visually inspect affected routes, states, portals, keyboard focus, and
   viewport fit; record observations, not just screenshots or computed values.
6. Run the full suite at Slice 1, Slice 7, and any other slice affecting shared
   primitives or broad infrastructure. It is mandatory in Slice 0 too.
7. Compare exact failure IDs/signatures against baseline, never just totals.
   A new/different failure requires investigation; pre-existing failures are
   not waived, and an overall FAIL must remain reported as FAIL.
8. End with one traceable focused commit and a clean worktree, then obtain
   approval before the next slice. Temporary tooling/output stays ignored;
   reviewable evidence is committed deliberately.

Phase 11 failure reconciliation must be authorized and committed independently.
Do not turn this baseline's failure list into a permanent ignore list. If a
future slice cannot pass its focused contract because of baseline debt, stop
and obtain direction for separate reconciliation; do not silently relabel it
PASS. Final release acceptance still requires the independent release gates.

## Exact proposed Slice 1 boundary

Create the three foundation stylesheets (`kocokan/tokens.css`,
`kocokan/primitives.css`, `kocokan/shell.css`) and a minimal theme context/helper
only if needed for deterministic portal propagation. Opt in
`ProductionOperatorLayout`, production `OperatorSidebar`, header/context menu,
AudienceConnectionStatus and launch/standby chrome. Add public KOCOKAN wordmark
treatment only in production; keep navigation targets, order and unlock guards.

Implement opt-in Button/ButtonLink (primary/secondary/success/danger/quiet and
square icon treatment), Card hierarchy, forms/real Toggle/Checkbox/Segmented,
Badge, Table, Modal/ConfirmationDialog, SidePanel, Pagination and Toast visual
contracts. Semantic modal variants must be explicit rather than newly inferred
from localized copy. Keep legacy defaults for non-production consumers.

Primitive appearance may propagate across production pages; this is declared
Slice 1 scope, not permission to restructure those page compositions. Migrate
raw page-owned controls/menus in their owning slices; inventory marks them
pending until then. Keep page content, state derivation, event callbacks,
publisher lifecycle, routing and imports/exports logic intact.

Exclude Dashboard composition, Event/import layout, Draw console layout,
Pending winner grids/reason adapter, History filters/rows, Settings layout,
fallback composition, any business logic, and all Audience internals.
Do not remove the monolithic legacy CSS in Slice 1. Require full-suite
comparison plus focused primitives/modal/shell/router/status tests and a real
preview/prototype isolation check. **Approval to start Slice 1 is still pending.**

## Linked evidence

- [Baseline, classification and verification](KOCOKAN-UI-REDESIGN-BASELINE.md)
- [Surface and gradient inventory](KOCOKAN-UI-SURFACE-INVENTORY.md)
- [Visual baseline and manual checklist](KOCOKAN-UI-VISUAL-BASELINE.md)
- [Per-test failure register](evidence/kocokan-ui-baseline/test-failures.json)
