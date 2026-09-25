# Kocokan v0.1.1

Kocokan v0.1.1 is the bootstrap updater release. Users on v0.1.0 must install
v0.1.1 manually once. Future stable updates can use the installed application's
user-confirmed update flow.

This release does not claim a v0.1.0 to v0.1.1 one-click update. The first
official one-click acceptance is reserved for v0.1.1 to v0.1.2.

## Highlights

- Stable GitHub release update checker.
- User-confirmed one-click update infrastructure for installed mode.
- Secure installer download with SHA256 verification.
- Registry- and path-authoritative installed-mode detection.
- Authoritative update safety gate that rereads draw, recovery, presentation,
  and Audience state before preparation and installation.
- Blocking while an Audience is connected, including standby.
- Graceful launcher-to-updater handoff, followed by relaunch and bounded result
  recovery.
- Privacy-safe Google Forms feedback reporting that remains user-reviewed and
  user-submitted.

## Packaging contract

- Fixed local origin: `http://127.0.0.1:47882`.
- Stable installer AppId and Program Files install root.
- Bundled Node.js runtime, production server, self-contained .NET launcher, and
  single-file updater helper.
- Browser profiles, IndexedDB, localStorage, events, and history are not
  removed by install or update.
- Package version source of truth: `0.1.1`.

## Safety and limitations

- Updates are never downloaded or installed silently at startup.
- Portable mode cannot prepare or install an update.
- The Windows build is unsigned; Windows SmartScreen may display a warning.
- Application data remains browser-local and scoped to the browser profile and
  fixed origin.
- There is no LAN mode or cloud synchronization.
- The real installed v0.1.1 to v0.1.2 upgrade remains a later owner acceptance
  gate.
- Known draw-command presentation assertion: **Not fully verified — Waived by
  owner** for this bootstrap release; the unrelated assertion was intentionally
  not changed.

## Release assets

- `Kocokan-Setup-0.1.1.exe`
- `Kocokan-Portable-0.1.1.zip`
- `checksums.txt`
- `RELEASE-NOTES.txt`
