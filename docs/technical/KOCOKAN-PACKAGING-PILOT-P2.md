# Packaging Pilot P2 — Windows portable launcher

Date: 2026-09-23. Branch: `codex/packaging-pilot`.
P1 approved baseline commit: `e1c309033af18c7c89945003f9aa19bb9a496bad`.
P2 was accepted by the owner on 2026-09-23 and approved for commit closeout.
The accepted artifact was built before this closeout: its manifest records the
P1 HEAD and `sourceDirty: true`. The artifact is preserved without rebuilding
or rewriting that provenance. Closeout changes no tested application behavior.

## Scope and architecture

Native WinForms launcher, bundled Node, and a self-contained portable Windows
x64 folder. No installer, signing, updater, single-file conversion or LAN mode.
No changes to draw, eligibility, redraw, persistence schema, Operator UI,
Audience renderer, existing route handling or WebSocket wire protocol.

Launcher starts only its absolute-path `runtime/node.exe`, using the packaged
`server/kocokan-server.cjs --web-root <package>/web --launcher-stdio`.
Working directory is the package root; spaces in paths use ArgumentList.
NODE_OPTIONS and NODE_PATH are removed from the child environment. npm, npx,
Vite, Laragon and repository node_modules are not runtime dependencies.

Starting -> Running requires both the owned child's ready record (expected
origin/version) and HTTP /health with a successful response, ready=true,
application=kocokan, matching runtimeVersion and status=running. Startup is
bounded to 20 seconds; requests use a 700 ms timeout. Crash/timeout => Error
and manual Retry. There is no automatic restart loop.

Port 47882 is fixed. An exclusive preflight bind detects conflicts, with a
second check through actual child startup errors for bind races. Conflict
message: `Port 47882 sedang digunakan aplikasi lain.` No alternate ports or
termination of the conflicting owner. A per-Windows-session named mutex
prevents duplicate launchers; a registered Windows message restores the first
window. Across Windows sessions the fixed port still prevents a second server.

Launch is enabled only in Running and uses the Windows default URL handler.
Failure is nonfatal and the read-only URL remains visible. Hide minimizes to
taskbar. Opening the executable again restores the existing window.

Quit and window X share a confirmation (default No), transition to Stopping,
cancel pending startup, write `shutdown` to the inherited anonymous stdin pipe,
and wait up to 5 seconds. Fallback kills only the owned child tree, then waits
up to 3 seconds. A Windows Job Object with KILL_ON_JOB_CLOSE prevents orphans
on abnormal launcher exit. Pipe EOF also triggers graceful runtime shutdown.
The existing Node IPC shutdown and signal handling remain supported. No HTTP
shutdown endpoint or display-protocol command was added. Port reuse is checked
after child shutdown; an unrelated new listener is reported, never killed.

## Build and pinned inputs

Build machine: Windows x64, existing .NET SDK 8.0.301, npm dependencies installed
from the committed package-lock.json. No new npm production dependency.

- TargetFramework: `net8.0-windows`.
- RuntimeIdentifier: `win-x64`.
- SelfContained: `true`; PublishSingleFile/PublishTrimmed: `false`.
- Microsoft.NETCore.App and Microsoft.WindowsDesktop.App: **8.0.31**, pinned in
  the launcher project. End users do not need .NET installed.
- Node: **22.23.2 Windows x64**.
- Official archive: https://nodejs.org/dist/v22.23.2/node-v22.23.2-win-x64.zip
- Official checksums: https://nodejs.org/dist/v22.23.2/SHASUMS256.txt
- ZIP SHA256: `1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97`.
- node.exe SHA256: `0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4`.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/package-windows.ps1 -Zip
```

The script builds web and runtime, publishes the launcher, verifies the pinned
Node archive hash, copies Node/server/web, collects Node/.NET/production npm
licenses, writes manifest and per-file checksums, and optionally generates ZIP.
It uses a new timestamped output each time, without deleting previous builds.
Network is needed on the build machine for uncached Node/.NET inputs. It fails
on a bad cached archive rather than executing it. Build steps are repeatable;
ZIP bytes are not claimed deterministic because timestamps/manifest dates vary.

Underlying publish command:

```powershell
dotnet publish packaging/launcher/Kocokan.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o <output>
```

Microsoft deployment reference:
https://learn.microsoft.com/en-us/dotnet/core/deploying/

## Artifact

Final folder:
`C:\laragon\www\raffle-os\artifacts\Kocokan-Pilot-20260923-111736`

ZIP: same path plus `.zip`.
Folder: **257,513,506 bytes (245.584 MiB), 562 files**.
ZIP: **103,878,188 bytes (99.066 MiB)**.
Per-file checksum verification: zero mismatches.

```text
Kocokan-Pilot-20260923-111736/
  Kocokan.exe
  Kocokan.dll, Kocokan.deps.json, Kocokan.runtimeconfig.json
  .NET runtime DLLs and localization directories
  runtime/node.exe
  server/kocokan-server.cjs
  web/index.html, web/assets/...
  manifest.json
  checksums.json
  README.txt
  notices/  (Node, .NET, production dependency licenses)
```

The additional DLLs are intentional: self-contained folder deployment, not a
single-file executable. Keep the whole folder together. Run `Kocokan.exe`, wait
for Running, then Launch Kocokan. The fixed origin is http://127.0.0.1:47882/.

Relocation test copy: `C:\Users\User\AppData\Local\Temp\Kocokan P2 portable smoke`.
Read-only process inspection confirmed that this copy runs its own bundled
Node/server/web paths, including spaces, without repository runtime paths.

## Files

New: `packaging/launcher/{Kocokan.csproj,Program.cs,RuntimeController.cs,ChildJob.cs}`,
`packaging/harness/{Kocokan.Harness.csproj,Program.cs}`,
`packaging/README-PORTABLE.txt`, `scripts/package-windows.ps1`, this report.

Modified: `server/runtime-entry.ts` (private stdio lifecycle),
`server/runtime-process.integration.test.ts` (shutdown/EOF coverage),
`vite.runtime.config.ts` (P2 identity), `.gitignore`, `eslint.config.js`
(generated packaging output exclusions).

## Automated verification

| Command/check | Result |
| --- | --- |
| `git diff --check` before P1 commit | PASS |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS; existing >500 kB chunk warning |
| `npm.cmd run build:runtime` | PASS |
| Packaging script with `-Zip` on Windows PowerShell 5.1 | PASS |
| `npm.cmd run test -- server src/application/display-transport/websocket-transport.test.ts src/application/display-transport/wire-codec.test.ts --maxWorkers=2` | 6 files / **19 tests PASS** |
| `dotnet run --project packaging/harness/Kocokan.Harness.csproj -c Release -- "C:\Users\User\AppData\Local\Temp\Kocokan P2 portable smoke"` | **18 checks PASS** |
| Artifact checksums | PASS, zero mismatches |

Harness compiles the actual RuntimeController and ChildJob source; successful
readiness uses the real bundled server. Fault fixtures are used only to simulate
stalled startup/ignored shutdown and wrong health identity/version. Checks cover
startup, actual child ownership, root/dashboard/scoped Audience routes, crash
and Retry, graceful shutdown/port reuse, foreign port preservation, Retry after
conflict resolution, startup timeout, forced child-only fallback, Quit during
Starting, invalid health identity, real executable startup from unrelated cwd,
duplicate executable, and abnormal parent death cleanup.

Initial focused test failed because the user's P1 runtime still occupied 47882;
it was not killed by this work. After that port became free, tests passed.
Initial packaging exposed PowerShell 5.1's inability to parse npm's empty root
JSON key; the script now maps only that key before ignoring root metadata.
Initial harness run hit an uncaught startup HTTP timeout in its polling code;
it was corrected and the full relocated harness passed. These failures are not
hidden by the final successful results.

Full application suite was not rerun for this packaging-only change. P1 report
records 108 pre-existing failing tests; this focused PASS does not imply a green
full suite or broader production acceptance.

## Interactive local smoke

Computer Use inspection was performed on the actual portable WinForms window
and default Edge browser. Launcher was also run from the relocated folder.

| Scenario | Evidence/result |
| --- | --- |
| Launch exe, Starting -> Running | Running inspected visually; Starting/readiness transition covered in harness |
| Fixed URL/port, hidden runtime | UI shows canonical URL and 47882; child uses CreateNoWindow and redirected handles |
| Launch default browser | PASS, Edge opened root then existing redirect to /dashboard |
| Dashboard and deep-link refresh | PASS, styled dashboard rendered; current default profile has no selected active event |
| Existing scoped Audience URL on canonical origin | PASS, renderer shows connecting/waiting for Operator snapshot |
| Close Kocokan browser tabs | PASS, health remained ready; unrelated user browser tabs/windows preserved |
| Reopen browser | PASS via Launch button, canonical dashboard tab returned |
| Hide | PASS, window minimized; health remained ready |
| Duplicate exe while minimized | PASS, duplicate exits 0 and same window restored |
| Quit and X confirmation | Both dialogs inspected; No cancels and leaves Running |
| Quit shutdown, port reusable, restart | Verified with real runtime/controller harness and interactive final shutdown/restart |

Browser failure dialog was implemented but not induced by changing the user's
default-handler settings. Full closure of the user's browser process was not
performed because it contains unrelated tabs. No live draw, migration, event
import, or participant-data modification was performed for packaging smoke.

## Assumptions, limitations, P3 recommendation

- This is local-machine packaging acceptance, not clean-machine acceptance.
- Existing project overview text predates later implemented phases. The explicit
  approved P1/P2 packaging instructions govern this work; requirements were not
  rewritten and the existing standalone transport architecture was retained.
- Browser data stays in its existing profile/origin. Copying the portable folder
  does not transfer IndexedDB or migrate development-origin data.
- Audience route/render smoke is not an active-event sync, reconnect, vMix, or
  draw-integrity acceptance claim. The inspected Audience had no published
  Operator snapshot.
- .NET/Node are pinned, not auto-updated. Patch refresh requires a reviewed rebuild.
- Artifact is unsigned, as requested; no installer or code-signing work started.
- Owner approved the P2 source for semantic commit closeout. P3 remains blocked
  on separate owner approval; no P3 implementation is part of this closeout.
- P3: extract the ZIP onto a clean Windows x64 machine without Node, .NET SDK,
  npm or Laragon; test offline startup and all launcher lifecycle cases, default
  browser data/profile continuity, scoped active Audience reconnect, and vMix
  capture. Record Windows version and package hashes. Installer/polish requires
  separate owner approval.
