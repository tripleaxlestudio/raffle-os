# P4 - Windows Installer and Release Hardening

**Status: P4 RELEASE ACCEPTED BY OWNER**

Owner release decision: 2026-09-24. The owner accepted the existing packaging
evidence as sufficient for Kocokan v0.1.0 and waived the remaining acceptance
steps as release blockers. Waived items are **not fully verified** and must not
be represented as PASS:

- final same-version reinstall -> uninstall -> reinstall sequence;
- interactive installation of the final timestamped artifact;
- IndexedDB marker continuity after reinstall;
- remaining Phase 11 acceptance and additional browser acceptance; and
- a green full-application regression suite claim from packaging acceptance.

The accepted evidence comprises P2 portable acceptance, the owner's clean-laptop
operational test, successful installer build, packaging harness PASS,
server/transport focused tests PASS, valid final artifact checksums, and a clean
release-preparation worktree. The build remains unsigned, Windows SmartScreen
may warn, and v0.1.0 has no auto updater.

Date: 2026-09-23. Branch: `codex/packaging-pilot`.
Pre-P4 baseline: `18006e5ab9820c36926aa0af89b0fc164364be41`.
Launcher UI Polish V1 was already committed separately; starting worktree and
`git diff --check` were clean. Owner reports P2/P3 clean-laptop acceptance.

## Distribution design

- Inno Setup **6.7.3**, Windows 10+ x64-compatible, administrator installation
  into `{autopf}\Kocokan` (normally `C:\Program Files\Kocokan`).
- Product/display name **Kocokan**, publisher **Tripleaxle Studio**.
- `package.json` version **0.1.0** is the release source of truth. The lockfile
  root metadata matches. Build scripts pass it to .NET, manifest and Inno;
  the existing runtime build injects the same version into health/readiness.
  No readiness comparison/behavior changed. Direct ad-hoc `dotnet publish`
  without the release script is not a supported delivery command.
- Stable AppId `{5F39F696-B62A-49CA-A090-366BE7E49213}` across versions, normal
  Windows uninstall entry, common Start Menu shortcut, opt-in Desktop shortcut.
  Both shortcuts target `{app}\Kocokan.exe`, working directory `{app}`.
- Recursively wraps the portable output including self-contained .NET, bundled
  Node, server, web, manifest, checksums and notices; no directory flattening.
- Existing launcher mutex blocks setup/uninstall. A WMI check additionally
  detects Kocokan.exe across Windows sessions; failure to inspect blocks the
  operation. Setup asks the operator to Quit and retry, never force-closes.
  Restart Manager automatic closing/restarting is disabled.
- No browser/profile/cache/IndexedDB/localStorage access, reset, migration,
  `[UninstallDelete]` wildcard, or uninstaller custom data cleanup. Uninstall
  removes only files registered by Inno. Files created by users may remain.
  Logs in LocalAppData remain. Older shipped files are retained until uninstall;
  removal of obsolete assets is not attempted during this pilot upgrade.
- No official `.ico` exists. Preserve current placeholder. Future official
  multi-resolution Windows ICO is needed for executable/setup branding.
- Minimal best-effort logs: `%LOCALAPPDATA%\Kocokan\logs\launcher.log`, rotated
  above 256 KiB to one `.previous`. UTC, assembly version, start/exit and status
  enum only. No exception text, process output, participant/event/winner data,
  datasets or protocol content. Logging failure cannot escape into lifecycle.

## Build

Windows build machine requires Node/npm, locked dependencies, .NET SDK and
Inno compiler. Destination users require none of these. Node 22.23.2 and
self-contained .NET 8.0.31 remain pinned exactly as the accepted portable.

Official compiler download:
https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-6.7.3.exe

The downloaded compiler installer was verified with Valid Authenticode,
publisher Pyrsys B.V.; SHA256:
`9c73c3bae7ed48d44112a0f48e66742c00090bdb5bef71d9d3c056c66e97b732`.
The release script pins ISCC.exe and ISCmplr.dll hashes because these binaries
report FileVersion 0.0.0.0. Compiler installed in `.packaging-cache/inno-6.7.3`.
No new application dependency or dependency-version change.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-release-windows.ps1 -Zip
# Or pass -IsccPath "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-release-windows.ps1 -ReleaseDirectory artifacts/release/Kocokan-0.1.0
```

```text
artifacts/release/Kocokan-0.1.0[-timestamp]/
  Kocokan-Setup-0.1.0.exe
  Kocokan-Portable-0.1.0.zip   (with -Zip)
  portable/                  (complete portable tree)
  checksums.txt              (installer, ZIP, critical runtime/files)
  RELEASE-NOTES.txt           (version, commit, dirty flag, deployment notes)
  notices/
  acceptance/                (local installer test logs, when exercised)
```

Existing release folders are never deleted or overwritten. Builds use a new
timestamped directory when the version folder exists. Reproducible procedure,
not byte-for-byte reproducibility: build times and Inno timestamps can differ.
Manifest records exact source commit/dirty state and per-file SHA256.

Unsigned pilot: no certificate purchased/created, SmartScreen warning expected
and not a P4 failure. Future `-SignCommand` supplies Inno `/Srelease=...`, signs
setup and uninstaller; launcher signing would additionally need a publish-time
signing step before portable hashes. No auto updater or cloud update service.
Inno references: https://jrsoftware.org/isdl.php and
https://jrsoftware.org/ishelp/topic_setup_appmutex.htm .

## Acceptance procedure and evidence

Use `scripts/test-install-windows.ps1 -ReleaseDirectory <release> -Action ...`.
Actions: Install (refuses existing installation), Reinstall, BlockUpdate,
Verify, Stopped, Uninstall. Install selects the optional Desktop shortcut.
Harness validates product identity, all payload hashes, shortcuts, registry,
free fixed port, and no installed launcher/runtime after shutdown/uninstall.
Installer may request Windows UAC confirmation. No browser data is deleted.

Local initial candidate evidence:

| Check | Result |
| --- | --- |
| npm.cmd run lint | PASS |
| npm.cmd run build | PASS; existing >500 kB chunk warning |
| npm.cmd run build:runtime | PASS |
| Server + WebSocket/wire focused Vitest | 6 files, 19 tests PASS |
| Real portable launcher harness | 18 checks PASS |
| Fresh install into Program Files | PASS, no reboot |
| Uninstall metadata + both shortcuts | PASS |
| All installed payload hashes | 561/561 PASS |
| Start Menu shortcut launches installed runtime | PASS |
| Actual launcher visually Running | PASS |
| Launch button opens default Edge dashboard | PASS, canonical origin |
| Update while running | Blocked, existing health still ready |
| Browser marker | DRAFT `P4 ACCEPTANCE MARKER 2026-09-23`, saved/read back from IndexedDB; 0 participants, prizes, Live sessions; not selected as active |
| Reinstall / uninstall / reinstall continuity | Pending remaining local acceptance |

Source boundary comparison against baseline: `src/`, `server/`,
RuntimeController.cs, ChildJob.cs and LauncherForm.Layout.cs unchanged.
Built web and Node files match accepted UI-Polish portable checksums exactly.
Server bundle is byte-identical after replacing only the old runtime version
literal `0.0.0-packaging-pilot-p2` with `0.1.0`.

Initial compiler attempt used unsupported Pascal Script GetObject; corrected
to CreateOleObject/SWbemLocator before successful compile. Initial shell TLS
download failed inside sandbox, then succeeded with normal host access and
signature verification. These are build-environment issues, not hidden tests.

Full application suite not rerun: packaging-focused green does not establish
full-suite green or new draw/vMix acceptance. No P5 work is included.

## Source commits and remaining acceptance gate

- Implementation: `00adff24c0ef2fc713560147950c6367b36600b6`.
- Release verifier metadata-padding correction / final build source:
  `74a8ae2d7922cd8e54303367d53d72293994ca51`.
- Files added: `packaging/installer/Kocokan.iss`,
  `packaging/launcher/DiagnosticLog.cs`, `scripts/build-release-windows.ps1`,
  `scripts/test-install-windows.ps1`, `scripts/test-release-windows.ps1`, this report.
- Files modified: package.json/package-lock.json (root version only),
  packaging/README-PORTABLE.txt, launcher/Kocokan.csproj and Program.cs,
  scripts/package-windows.ps1, vite.runtime.config.ts (version injection only).

Focused commands executed:

```powershell
npm.cmd run lint
npm.cmd run test -- server src/application/display-transport/websocket-transport.test.ts src/application/display-transport/wire-codec.test.ts --maxWorkers=2
dotnet run --project packaging/harness/Kocokan.Harness.csproj -c Release -- C:\laragon\www\raffle-os\artifacts\release\Kocokan-0.1.0\portable
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-install-windows.ps1 -ReleaseDirectory artifacts/release/Kocokan-0.1.0 -Action Install
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-install-windows.ps1 -ReleaseDirectory artifacts/release/Kocokan-0.1.0 -Action BlockUpdate
git diff --check
```

The release command also executed `npm.cmd run build`, `npm.cmd run build:runtime`,
and self-contained `dotnet publish` successfully. PowerShell AST parsing of all
four packaging/test scripts passed.

Automatic approval review rejected clicking Yes on Quit and the same-version
Reinstall command, citing insufficient trusted authorization for those actions
from the attachment. A specific approval question was sent to the owner. No
alternate shutdown/reinstall path was used. Until that approval and the
remaining tests, **P4 acceptance is incomplete**, not a full pass. The initial
candidate remains installed/running; the Quit confirmation is pending.

Remaining sequence: approve Quit, verify port/process cleanup, install final
candidate over initial candidate, verify browser marker after reload, test
Desktop launch and Quit, uninstall and verify files/shortcuts/registry/process
cleanup, reinstall, verify the same IndexedDB marker again, final clean Quit.
The marker is an intentionally retained empty draft; no production data was
deleted and no official draw was performed. Actual 0.1.0 -> 0.1.1 testing is
deferred; same-version/build replacement is the requested current simulation.

## Final release artifact (built and owner-accepted for release)

Folder: `artifacts/release/Kocokan-0.1.0-20260923-165459-622/`.
Build source: `74a8ae2d7922cd8e54303367d53d72293994ca51`, `sourceDirty: false`.

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| Kocokan-Setup-0.1.0.exe | 73,161,369 | `a6b220e9c66442c7509b44ec7ac8dd3da941e02e64c9b2514703fd6dcfbc5468` |
| Kocokan-Portable-0.1.0.zip | 103,858,096 | `3e0f9c023bb0a66c7df10f4b52b133a9044318da6af338add9614639c6292631` |

`scripts/test-release-windows.ps1` on the final release: PASS, all 561 portable
file SHA256 entries, complete 562-file coverage including checksums.json,
installer/ZIP/critical-file release hashes, launcher/installer version metadata,
and canonical origin. Authenticode status: NotSigned. notices and release notes
are present. Initial artifact folder was retained without deletion.

Verifier corrections are test-only: trim Inno's padded version strings; avoid
wrapping ConvertFrom-Json's array in another array in Windows PowerShell 5.1.
The first final verification therefore failed its coverage-count assertion;
direct inspection confirmed 561 hashed files + checksums.json, and rerunning
the corrected verifier passed. No application artifact was modified to pass.

The final source-snapshot build reran web/runtime compilation successfully.
System install and interactive evidence above applies to the initial candidate
from the same application implementation, not a claim of installing this final
artifact. The owner waived that remaining final-artifact installation sequence
for v0.1.0; it remains not fully verified rather than PASS.

## Owner release disposition and branch audit

The final artifact is accepted for the v0.1.0 release by owner decision despite
the explicitly waived, not-fully-verified steps above. This acceptance does not
retroactively convert an unexecuted check into PASS.

Pre-release branch audit:

- `phase8/slice-14d-subsequent-draw-lifecycle` is **A - superseded by HEAD**.
  `git cherry` identifies its sole commit as patch-equivalent to history already
  in the release branch.
- `codex/wip-rescue-2026-09-08` is **B - rescue/archive only**. It is the original
  mixed-worktree safety snapshot used before the changes were reconstructed as
  focused semantic commits. The only files present there and intentionally not
  retained in HEAD are temporary Audience prize QA fixtures and their result
  JSON. No required v0.1.0 production source is unique to that branch.

Neither branch is merged as part of the release. No P5 or auto-update work is
authorized by this disposition.
