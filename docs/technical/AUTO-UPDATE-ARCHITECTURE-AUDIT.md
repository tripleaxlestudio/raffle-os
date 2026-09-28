# Auto Update Architecture Audit

Date: 2026-09-28  
Repository: `tripleaxlestudio/raffle-os`  
Audited baseline: Kocokan `v0.1.1`  
Status: Audit only — no updater implementation, version bump, tag, release, or installer execution

## Executive summary

The current status is **A — the updater already exists substantially in production source**. It is not only a UI or mock implementation.

The following path is present:

```text
Settings UI
  -> GitHub stable-release discovery
  -> local update API
  -> Node download and SHA256 verification
  -> WinForms launcher handoff
  -> detached updater
  -> Inno Setup
  -> launcher relaunch
  -> install result recovery
```

It must not yet be described as fully production-ready because:

- a real installed `v0.1.1 -> v0.1.2` upgrade has not been accepted;
- the installer is unsigned;
- updater observability does not yet provide the required event coverage;
- browser/UI recovery after the runtime restart has not been demonstrated end to end; and
- the audit machine does not currently contain an installed Kocokan instance, so an actual upgrade could not be exercised.

## 1. Current packaging architecture

Kocokan is not packaged with Electron or Tauri. Its Windows architecture consists of:

- React and Vite for the browser frontend;
- a bundled Node.js runtime for the local HTTP and WebSocket server;
- a self-contained .NET 8 WinForms launcher;
- a separate self-contained `Kocokan.Updater.exe`; and
- Inno Setup 6.7.3 for the installer.

The executable entry point is `packaging/launcher/Program.cs`. The launcher:

1. acquires a single-instance mutex;
2. opens the WinForms launcher;
3. starts the local runtime when the form is shown;
4. can open the default browser at `http://127.0.0.1:47882/`; and
5. remains alive after the browser opens and owns the Node runtime lifecycle.

`packaging/launcher/RuntimeController.cs` starts:

```text
runtime\node.exe server\kocokan-server.cjs
  --web-root web
  --launcher-stdio
```

The server remains bound exclusively to `127.0.0.1:47882` through `server/local-server.ts`.

The installer configuration is `packaging/installer/Kocokan.iss`, with:

- the normal install directory `{autopf}\Kocokan`, usually `C:\Program Files\Kocokan`;
- stable AppId `{5F39F696-B62A-49CA-A090-366BE7E49213}`;
- administrator installation;
- Windows 10 or newer, x64-compatible; and
- a common Start Menu shortcut and optional Desktop shortcut.

## 2. Current version architecture

The primary version source is `package.json`, currently `0.1.1`.

Version propagation is:

- frontend: `vite.config.ts` -> `__KOCOKAN_APP_VERSION__` -> `src/config/app-version.ts`;
- Node runtime: `vite.runtime.config.ts` -> `__KOCOKAN_RUNTIME_VERSION__`;
- launcher and updater assembly metadata: `$productVersion` from `scripts/package-windows.ps1`;
- portable manifest: the same `$productVersion`; and
- Inno `AppVersion`, executable metadata, and installer filename: `/DProductVersion` from `scripts/build-release-windows.ps1`.

When the official release pipeline is used, the UI, runtime, launcher, updater, manifest, and installer version all originate from `package.json`.

Remaining mismatch risks:

- root version metadata in `package-lock.json` must remain synchronized;
- ad-hoc `dotnet publish` or direct ISCC compilation outside the release script can produce inconsistent metadata; and
- the `Build` and `Release Channel` values in Settings > Tentang are still statically displayed as `Development`, which may be misleading in an installed release even though the version number is dynamic.

## 3. Existing updater status

The current updater is not a mock. The repository already includes:

- release and version checking;
- exact installer asset resolution;
- checksum parsing;
- streaming download with progress;
- SHA256 verification;
- a local update API and per-runtime mutation token;
- installed, portable, and development capability detection;
- an authoritative operational safety gate;
- a global draw/update lock;
- launcher handoff;
- a detached updater;
- Inno Setup invocation;
- launcher relaunch; and
- install result recovery after restart.

The main architecture record is `docs/technical/P5.3-ONE-CLICK-UPDATE.md`.

The implementation has reached the one-click update path in source and automated contracts, but has not passed a real installed-version upgrade acceptance.

## 4. Settings update UI current behavior

The initial button reads `Periksa Pembaruan`; after a completed check it reads `Periksa Lagi`.

The handler in `src/pages/operator/settings/AboutTab.tsx` runs two operations in parallel:

- `checkForUpdate(currentVersion, githubReleaseClient)`; and
- `localUpdateClient.detectCapabilities()`.

The button therefore performs a real GitHub request and is not a mock-only state transition.

Public release-check states are:

- `idle`;
- `checking`;
- `up-to-date`;
- `update-available`; and
- `error`.

Native update preparation additionally uses:

- `preparing`;
- `downloading`;
- `verifying`;
- `ready-to-install`;
- `installing`; and
- `error`.

The copy `Anda menggunakan versi terbaru.` is static presentation text, but it is only rendered after the version comparison reports that the remote version is not newer. The status itself is not hardcoded.

For an installed runtime with an authoritatively safe workspace, the UI already supports:

- `Update Sekarang`;
- download progress;
- verification state; and
- `Pasang Pembaruan`.

## 5. GitHub release discovery feasibility

Stable-release discovery is already implemented with:

```text
GET https://api.github.com/repos/tripleaxlestudio/raffle-os/releases/latest
```

The browser client is `src/infrastructure/update/github-release-client.ts`. The Node server validates the selected release again through `server/update/release-resolver.ts` before preparation.

Both paths reject draft and prerelease responses. The server also requires an exact stable `vX.Y.Z` tag.

The public GitHub release was verified read-only during this audit. `v0.1.1` is the latest stable release, is neither draft nor prerelease, and contains exactly:

- `Kocokan-Setup-0.1.1.exe`;
- `Kocokan-Portable-0.1.1.zip`;
- `RELEASE-NOTES.txt`; and
- `checksums.txt`.

## 6. Version comparison

The repository does not use a semver dependency. `src/application/update/update-checker.ts` contains a strict numeric helper that accepts only:

```text
X.Y.Z
vX.Y.Z
```

Expected behavior is implemented:

| Current | Remote | Result |
| --- | --- | --- |
| `0.1.1` | `0.1.2` | Update available |
| `0.1.2` | `0.1.2` | Up to date |
| `0.1.2` | `0.1.1` | Up to date; no downgrade |
| malformed | any | Nonfatal error |

The server separately requires the requested version to equal the latest resolved release and to be newer than the current runtime version.

## 7. Installer asset resolution

The current resolution strategy is appropriately strict:

- exact installer name: `Kocokan-Setup-X.Y.Z.exe`;
- exact checksum asset: `checksums.txt`;
- exactly one match for each required asset;
- exact official repository, tag, and filename path; and
- no selection of the Portable ZIP as the update installer.

This is safer than substring matching or choosing the first `.exe` asset returned by GitHub.

## 8. Download architecture

The Node local runtime owns the download. This is preferable to either the browser frontend or WinForms launcher because Node can safely:

- stream to disk;
- write under `%LOCALAPPDATA%`;
- calculate SHA256 during streaming;
- report progress;
- use a temporary `.part` file;
- atomically rename a verified download; and
- remove partial downloads after failure.

`server/update/download-manager.ts` stores updates under:

```text
%LOCALAPPDATA%\Kocokan\updates\<version>\
```

Existing boundaries include:

- installer size from 1 MiB through 512 MiB;
- checksum response no larger than 1 MiB;
- HTTPS only;
- at most five redirects;
- an allowlist of GitHub download hosts;
- a 15-minute installer timeout;
- byte-count validation; and
- failed `.part` cleanup.

## 9. Checksum validation

`checksums.txt` is already consumed by the updater.

The parser requires:

```text
<64 hexadecimal SHA256 characters><two spaces><filename>
```

Only the exact installer filename is accepted. The `.part` file is renamed to its final installer name only after:

- the received byte count matches release metadata;
- the actual file size matches; and
- the computed streaming SHA256 matches `checksums.txt`.

Security limitation: the installer and checksum come from the same GitHub release. This protects download integrity but does not provide independent publisher authenticity. The installer is unsigned and the updater does not currently verify an Authenticode publisher.

## 10. Installer and update behavior

The source architecture supports an in-place `v0.1.1 -> v0.1.2` update because the installer retains a stable:

- AppId;
- install directory; and
- product identity.

Files are copied into `{app}` with `ignoreversion`.

Kocokan must close before installation. The installer:

- does not force-close Kocokan;
- performs a WMI process check;
- refuses installation while `Kocokan.exe` is still running; and
- disables Restart Manager automatic closing and restarting.

The detached updater:

1. waits for the launcher PID to exit;
2. waits for the launcher mutex to disappear;
3. verifies that port 47882 is free;
4. starts Inno Setup elevated with `/SILENT`;
5. deliberately does not use `/VERYSILENT`;
6. classifies success, cancellation, or failure; and
7. attempts one launcher relaunch.

Potential issue: the installer replaces matching files but has no explicit cleanup policy for files shipped by an older version and removed from a later payload.

## 11. User data persistence

Domain data is stored in the browser profile at the fixed origin `http://127.0.0.1:47882`, not under Program Files.

The main storage locations are:

- primary IndexedDB database: `RaffleOS_DB`;
- prize image and display-font database: `RaffleOS_PrizeAssets`;
- Practice presentation state: localStorage keys using `raffle-os:practice-result:v1:`;
- launcher log: `%LOCALAPPDATA%\Kocokan\logs`; and
- update staging and result metadata: `%LOCALAPPDATA%\Kocokan\updates`.

The installer contains no browser-profile access, cache clearing, IndexedDB reset, localStorage cleanup, wildcard `[UninstallDelete]`, or custom data deletion.

With the same browser and profile, replacing the installed executable should not remove:

- events;
- participants;
- draw history;
- settings;
- logos, backgrounds, and audio;
- prize images; or
- display fonts.

Operational risk: changing the default browser or browser profile can make existing data appear missing even though it remains in the previous profile.

## 12. Relaunch strategy

The existing detached-updater and launcher-relaunch strategy is appropriate for this architecture.

The following behavior has not yet been demonstrated in a real upgrade:

- whether an existing browser tab recovers automatically after the server returns;
- whether Settings > Tentang shows the consumed install result without a manual reload;
- whether Operator and Audience reconnect safely across the runtime gap; and
- whether the final UX should refresh the existing tab or open a new browser tab.

The updater relaunches `Kocokan.exe`, but normal launcher startup does not automatically open the browser. The effective user experience may therefore be:

```text
Install
  -> launcher and server restart
  -> existing browser tab requires refresh
```

The target `Install & Restart` experience must not be marked accepted until this is tested end to end.

## 13. Logging and observability

Current logging is minimal. `packaging/launcher/DiagnosticLog.cs` records only:

- `launcher-start`;
- `launcher-exit`; and
- launcher runtime-state changes.

The following requested update events are not currently implemented as durable operational logs:

- `update-check-started`;
- `update-check-success`;
- `update-check-failed`;
- `update-available`;
- `update-not-available`;
- `download-started`;
- `download-progress`;
- `download-completed`;
- `checksum-failed`;
- `installer-launch`; and
- `installer-launch-failed`.

The update result file stores only `version`, `result`, and `timestamp`.

Recommendation: add a bounded, privacy-safe update log in the native/server layer. Download progress should be bucketed, for example every 10%, rather than logged for every chunk. Logs must not include tokens, asset URLs, user paths, Event data, participant data, or raw exception payloads.

## 14. Network and offline behavior

The architecture preserves local-first behavior:

- update checks are explicitly initiated by the user;
- no update is downloaded during normal startup;
- GitHub timeout, rate limit, malformed response, or offline failure becomes a nonfatal Settings error;
- the local server, draw workflow, and Audience Display do not depend on GitHub availability; and
- preparation only acquires the update lock after the operator requests an update and the workspace passes the safety gate.

If preparation fails, the update lock is released. If preparation reaches `ready-to-install`, the lock remains active until installation or runtime restart. The current UI does not offer an obvious cancel/reset control for this state, which is an operational risk if the operator downloads an update but decides not to install it.

## 15. Risks and blockers

In priority order:

1. **Real upgrade is not accepted:** installed `v0.1.1 -> v0.1.2` has not been exercised.
2. **Unsigned installer:** SHA256 verification is not a replacement for code signing and publisher verification.
3. **Updater logging is incomplete.**
4. **Browser recovery after relaunch is not proven.**
5. **No installed Kocokan was present on the audit machine:** neither the expected HKLM uninstall entry nor `C:\Program Files\Kocokan\Kocokan.exe` was found.
6. **Ready-to-install lock:** there is no clear UI cancel/reset path.
7. **Stale installed files:** files removed from future packages may remain in the installation directory.
8. **GitHub dependency:** discovery and download remain subject to offline state, timeouts, rate limits, and GitHub availability.
9. **Misleading metadata:** Build and Release Channel currently always display `Development`.
10. **No Authenticode validation:** the updater does not verify the installer publisher before execution.
11. **No application rollback:** there is no rollback mechanism for a partially failed installer replacement.

## 16. Recommended implementation plan

### Phase A — Release discovery

Status: mostly implemented.

- Retain the public `/releases/latest` endpoint.
- Retain stable-only validation and exact official repository URLs.
- Add update-check observability.
- Add or retain coverage for rate limits, offline behavior, malformed assets, and duplicate assets.
- Do not create `v0.1.2` during this phase.

### Phase B — Update UI states

- Clarify the `Update tersedia`, `Mengunduh`, `Memverifikasi`, `Siap dipasang`, `Memasang`, and post-restart states.
- Rename the final action to `Pasang & Mulai Ulang` only after that behavior is confirmed.
- Add a safe cancel/reset path before installation or a clearly documented way to release the update lock.
- Make Build and Release Channel metadata authoritative instead of always displaying `Development`.

### Phase C — Download

Status: the core implementation is already strong.

- Retain the Node runtime as the download owner.
- Exercise a real installer download using a controlled candidate release.
- Test disk-full, permission failure, timeout, disconnect, retry, and `.part` cleanup.
- Add bounded download-progress logging.

### Phase D — Checksum validation

Status: SHA256 validation is implemented.

- Retain exact filename and SHA256 matching.
- Add Authenticode signing and publisher verification before production acceptance.
- Make the release pipeline fail when a production release requires signing but the installer is unsigned.

### Phase E — Installer handoff

- Test installed-mode detection on a real v0.1.1 installation.
- Test UAC approval and cancellation.
- Test graceful launcher shutdown and forced-stop abort behavior.
- Verify stable AppId, install directory, shortcuts, registry metadata, and stale-file behavior.
- Log installer launch and result without sensitive paths or data.

### Phase F — Relaunch

- Verify the relaunched `/health` endpoint reports `0.1.2`.
- Decide whether the supported browser UX refreshes the existing tab or opens a new one.
- Verify the install result file is consumed once.
- Verify no update lock remains after restart.
- Verify the Operator and Audience return to a safe state.

### Phase G — v0.1.1 to v0.1.2 acceptance

Recommended acceptance sequence:

1. Install the official v0.1.1 build.
2. Create non-production marker data in IndexedDB, localStorage, and asset storage.
3. Prepare an exact-name v0.1.2 candidate installer and checksum.
4. Check for the update from v0.1.1.
5. Download and validate the installer.
6. Start installation through the Settings UI.
7. Verify graceful shutdown, installer execution, and relaunch.
8. Verify the footer, Settings > Tentang, health endpoint, executable metadata, and registry all report `0.1.2`.
9. Verify Event, history, settings, and asset markers remain intact.
10. Verify normal offline operation after the update.
11. Verify the update checker does not offer a downgrade.
12. Only after owner acceptance, prepare the release commit, tag, and public v0.1.2 release.

## Audit verification

- Focused updater Vitest: **12 files, 111 tests passed**.
- Launcher update contracts: **22 of 22 passed**.
- Detached updater contracts: **14 of 14 passed**.
- Public v0.1.1 GitHub release metadata: **verified read-only**.
- Installer executed: **no**.
- Version bump, tag, or release created: **no**.
- Updater code changed: **no**.

## Final recommendation

Do not reimplement the updater from zero. Preserve the current architecture and focus next on:

1. update logging and observability;
2. a safe cancel/reset path for the ready-to-install lock;
3. signed-installer trust and Authenticode validation;
4. browser behavior during launcher/server relaunch; and
5. real installed `v0.1.1 -> v0.1.2` acceptance.

Stop before publishing `v0.1.2` until the implementation phases and acceptance gates are explicitly approved.
