# Raffle OS Windows Local Host Runtime

## 1. Status

**Approved product direction — architecture and implementation technology
pending ADR and focused spike.**

This document records the desired Windows distribution model before any Host,
server, launcher, installer, or packaging code is implemented. It extends the
original browser-only delivery assumptions without changing the existing draw
engine, official-history model, or browser-local persistence authority.

The conceptual UX references are StageTimer.io and Bitfocus Companion: a small
Windows application shows local server status and provides actions to launch a
browser-based interface. Their visual design, code, licensing model, network
behavior, and product scope are not requirements to copy.

## 2. Product decision

Raffle OS will be distributed as:

```text
Windows event laptop
        |
        v
Raffle OS Host.exe
        |
        v
local production HTTP server
        |
        v
http://127.0.0.1:<fixed-port>
        |
        v
normal Chrome or Edge browser
        |
        +--> Operator UI
        +--> Audience Display route
```

The Host executable is a local runtime, server, launcher, and distribution
boundary. It is not a replacement draw engine and does not embed the Operator
inside an Electron-style browser by default.

A clean event laptop must not require Laragon, XAMPP, Node.js, npm, pnpm, Vite,
PHP, VS Code, an external web server, or an internet connection.

## 3. Target user experience

The installed or portable application should provide a compact Windows window
or tray surface with:

- application name, version, and runtime status;
- canonical local URL;
- clear Running, Starting, Stopped, and Error states;
- **Open Raffle OS**;
- **Open Audience Display** or an equivalent safe handoff into the browser;
- restart/stop controls where safe;
- actionable port, asset, server-start, and browser-launch failures; and
- explicit Exit behavior.

For the first milestone, host/interface and port should be read-only. The UI
must not invite an origin change before storage migration and LAN security are
designed.

The Host may auto-open the Operator after successful startup if the behavior is
user-controlled and browser selection is stable.

## 4. Existing application authority to preserve

- React/Vite remains the production web application.
- Domain and application services remain the only draw-behavior authority.
- Official winner selection continues to use Web Crypto.
- Visual animation remains presentation-only.
- Dexie/IndexedDB remains the official local persistence mechanism for the
  first packaging milestone.
- Operator and Audience remain separate browser route surfaces.
- BroadcastChannel remains the same-machine presentation transport.
- Practice Mode remains isolated from official Live records.
- Confirmation, redraw lineage, History, audit, export, and recovery invariants
  remain unchanged.

The Host must not select winners, mutate official History, translate domain
states, duplicate the presentation state machine, or become a second
persistence authority.

## 5. Initial packaging milestone

The first milestone is deliberately single-machine and localhost-only:

```text
Raffle OS Host.exe
        |
        +--> Operator browser tab
        |
        +--> Audience browser tab/window
                    |
                    +--> HDMI / projector / LED / vMix capture
```

Required behavior:

- serve the Vite production build without the Vite development server;
- bind only to the approved loopback address;
- use one stable canonical origin and fixed port;
- support BrowserRouter SPA fallback for production routes;
- return real 404 responses for missing assets rather than `index.html`;
- expose a minimal liveness/version health endpoint;
- launch the Operator in the selected supported browser;
- support a safe Audience launch flow;
- retain BroadcastChannel parity between same-origin browser contexts;
- keep IndexedDB data stable across Host restart and approved application
  update on the same browser profile and origin;
- fail visibly when the fixed port is occupied;
- prevent competing Host/server instances; and
- operate with networking disabled.

No LAN binding, WebSocket migration, Stage Controller, NDI, authentication,
host-native official database, or automatic updater is included.

## 6. Canonical origin and storage contract

IndexedDB data is scoped by browser profile and origin. The initial product
must select one exact canonical URL, provisionally:

```text
http://127.0.0.1:47882
```

The final port remains an ADR decision after a collision and compatibility
review. Once accepted, the Host must not silently switch to `localhost`, a LAN
address, another port, or a random free port.

The following are separate storage locations from the user's perspective:

```text
Chrome profile A + http://127.0.0.1:47882
Chrome profile B + http://127.0.0.1:47882
Edge profile A   + http://127.0.0.1:47882
http://localhost:47882
http://127.0.0.1:<different-port>
```

Therefore the Host must not blindly follow a changing system-default browser.
First-run browser selection should be explicit, persisted in Host settings, and
accompanied by a clear warning before switching browser/profile.

“Preserve data across packaging” means preserving data created at the approved
canonical origin in the same browser profile across Host/app upgrades. Data
created previously on a Laragon, Vite, or other development origin will not
automatically migrate. Any import/migration or backup/restore capability is a
separate explicitly approved data project.

## 7. Audience launch constraint

The current production Audience route requires `eventId` and
`displayConfigurationId` query parameters. A native Host does not own or read
the browser's active Event, so opening bare `/display` is not currently a valid
production shortcut.

The packaging ADR must choose a safe approach, such as:

1. a browser-side `/display/active` resolver that reads only the minimum active
   Event/display identifiers from the same IndexedDB origin and redirects to
   the scoped Audience URL; or
2. a Host action that opens the Operator's Display Settings, where the existing
   browser-owned workflow creates the scoped Audience URL.

The resolver, if approved, must not expose participant names, notes, check-in,
groups, or other private data and must not make the Host a database reader.

## 8. Host responsibilities

The initial Host owns only:

- starting and stopping the local production server;
- validating packaged web assets and build identity;
- binding the canonical loopback endpoint;
- serving static assets and SPA route fallback;
- reporting health/version and actionable runtime errors;
- selecting/remembering a supported browser;
- launching Operator and the approved Audience handoff;
- enforcing a single Host instance;
- coordinating graceful application shutdown; and
- exposing version, license, notices, and local runtime diagnostics.

It does not own Event, Participant, DrawSession, WinnerRecord, RedrawRecord,
AuditRecord, settings, export, or presentation-selection behavior.

## 9. Host technology direction

The leading candidate is a self-contained **.NET 10 LTS Windows Host** using:

- a small WinForms launcher/tray UI;
- ASP.NET Core/Kestrel for loopback HTTP serving;
- self-contained `win-x64` publishing so no .NET installation is required;
- normal operating-system URL handling or an approved explicit Chrome/Edge
  launcher; and
- named process primitives for single-instance behavior.

This is a recommendation, not an approved dependency or implementation. Slice
11.5A must compare it with at least a small Go and Rust feasibility baseline,
including executable/package size, startup, static-asset serving, Windows UI,
process lifecycle, signing/installer tooling, antivirus reputation, maintenance,
and future native NDI interop.

Electron is not preferred because the product intentionally uses the user's
normal browser and does not need a bundled Chromium runtime. Tauri is not
assumed because the desired Host is primarily a launcher/server rather than an
embedded webview application.

## 10. Server and security baseline

The initial server must:

- bind exactly to the approved loopback address, not `0.0.0.0`;
- reject unexpected Host headers;
- avoid permissive CORS;
- expose no remote command API;
- serve only packaged allow-listed static content;
- disable directory listing;
- set correct MIME, cache, CSP, and defensive response headers;
- cache fingerprinted assets while preventing stale `index.html` reuse;
- route only application navigation requests to SPA fallback;
- return an actionable health/version result without private Event data;
- use bounded timeouts and graceful shutdown; and
- log runtime diagnostics without participant or official-result leakage.

Localhost-only operation should not request a Windows Firewall exception or
administrator privileges. Future LAN mode requires a new security and network
authority decision.

## 11. Process lifecycle contract

- Only one Host/server instance may own the canonical port.
- A second launch should detect the healthy existing Host, open/focus the
  launcher or Operator, and exit without starting another server.
- Port conflict with a different process blocks startup with actionable
  guidance; no random-port fallback is allowed.
- Closing the launcher window should minimize/hide to tray by default rather
  than silently stopping the server.
- Server shutdown requires an explicit Exit action and clear warning.
- Windows logoff/shutdown should trigger bounded graceful shutdown.
- Browser launch failure leaves the URL visible and copyable.
- Host restart must not reset or migrate IndexedDB.
- Host cannot claim awareness of active Live work unless a later approved,
  authenticated runtime protocol provides that evidence.

## 12. Distribution artifacts

The first practical acceptance target should be a portable package:

```text
RaffleOS-Portable-x.y.z/
|-- RaffleOS.Host.exe
|-- web/
|   |-- index.html
|   `-- assets/
|-- version.json
|-- checksums.txt
|-- THIRD-PARTY-NOTICES.txt
`-- README.txt
```

An installed artifact should follow from the same verified payload:

```text
RaffleOS-Setup-x.y.z.exe
```

The installer should provide Start Menu integration, optional desktop shortcut,
upgrade and uninstall behavior, version metadata, application icon, and no
administrator requirement unless an evidenced packaging constraint requires
it. Code signing and release provenance must be decided before public
distribution.

Do not require a physically single-file executable for the first milestone.
A versioned directory/installer payload is easier to inspect, hash, repair, and
roll back. Embedding assets can be reconsidered after the Host is stable.

## 13. Phase 11 packaging sub-slices

### 11.5A — Architecture ADR and spike

- audit build, routing, origin, persistence, and Audience context;
- compare Host technologies and select one;
- approve canonical URL/port and browser pinning policy;
- define server, lifecycle, security, packaging, and update contracts;
- prototype only enough to retire material technology risks.

### 11.5B — Production local Host

- serve the approved `dist` payload;
- implement SPA fallback, health/version, headers, asset validation, fixed
  loopback binding, port-conflict handling, and graceful shutdown;
- add deterministic Host server tests.

### 11.5C — Windows launcher and lifecycle

- implement status UI/tray, Open Raffle OS, safe Audience handoff, selected
  browser persistence, single-instance behavior, diagnostics, and explicit
  shutdown;
- keep network/port controls read-only in localhost-only mode.

### 11.5D — Portable and installer packaging

- build Vite production assets and Host from one version identity;
- produce portable ZIP and installer payloads;
- include manifest, checksums, notices, icon, shortcuts, upgrade/uninstall, and
  signing decisions;
- verify no development runtime is bundled or required.

### 11.5E — Packaged production acceptance

- run on a clean Windows environment without development tools or network;
- verify routes, import/export, IndexedDB, refresh/recovery, Practice/Live,
  Audience BroadcastChannel, branding/audio/blackout, Host restart, browser
  restart, duplicate launch, port conflict, update persistence, and artifact
  identity;
- rerun all application and Host verification commands.

## 14. Future architecture boundary

Future LAN, Stage Controller, WebSocket, NDI, and host-native persistence may
extend the Host, but they are not acceptance requirements for initial packaging.

The Host design should provide replaceable boundaries for a future realtime hub
and native adapters without implementing them. Browser and future NDI output
must eventually consume one authoritative public presentation state; neither
may independently select or mutate a winner.

Remote Operator or Controller access will require an explicit network binding,
authentication/authorization, command, and threat model. BroadcastChannel must
never be presented as cross-device transport.

## 15. Initial acceptance gates

- Raffle OS launches on a clean supported Windows machine without Laragon,
  XAMPP, Node.js, npm, Vite, PHP, external server, or internet.
- The Host serves the exact identified production build at the canonical origin.
- Operator and the approved Audience handoff open in a supported pinned browser.
- Direct navigation and refresh work for every production SPA route.
- Same-browser/profile IndexedDB persists across browser and Host restart and
  the approved upgrade path.
- Existing selection, recovery, audit, redraw, export, and privacy invariants
  remain unchanged.
- Same-machine BroadcastChannel behavior remains correct.
- Missing/corrupt assets, port conflict, browser launch failure, server failure,
  duplicate Host launch, and shutdown are visible and safe.
- The portable and installer artifacts are reproducible, versioned, checksummed,
  licensed, documented, and tested offline.
- Full application and Host lint/type/test/build checks pass.
- Clean-machine Chrome and Edge acceptance evidence is recorded.

## 16. Explicit implementation boundary

This architecture direction does not authorize Host source code, a new runtime,
new production dependency, installer toolchain, route change, origin change,
schema migration, backup/restore, LAN binding, WebSocket, Controller, NDI, or
host-native persistence. Implementation begins only with an approved Slice
11.5A ADR/spike task.

