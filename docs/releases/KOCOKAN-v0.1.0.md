# Kocokan v0.1.0

Kocokan is a local-first raffle and event draw system for an Operator interface
and a separate Audience Display.

## Highlights

- Production Operator workflow for event preparation and draw operation.
- Audience Display suitable for a browser, projector, LED output, or vMix
  browser capture.
- Draw, pending-result, confirmation, history, and audited redraw workflows.
- Browser-local persistence for events, configuration, and official records.
- WebSocket transport between the packaged Operator and Audience surfaces.
- Windows launcher, portable ZIP, and Windows installer distributions.

## Packaging

- Fixed local origin: `http://127.0.0.1:47882`.
- Bundled Node.js runtime and production server.
- Self-contained .NET Windows launcher.
- Inno Setup installer for Windows x64.
- Package version source of truth: `0.1.0`.

## Acceptance disposition

P4 was accepted for release by the owner on 2026-09-24 using the existing
portable, clean-laptop, installer-build, packaging-harness, focused transport,
and checksum evidence.

The following items were not fully verified and were waived by the owner for
v0.1.0; they are not claimed as PASS:

- final same-version reinstall/uninstall continuity;
- interactive installation of the final timestamped artifact;
- IndexedDB marker continuity after reinstall;
- remaining Phase 11 and additional browser acceptance; and
- a green full-application regression suite under packaging acceptance.

## Known limitations

- The Windows build is unsigned; Windows SmartScreen may display a warning.
- Application data remains browser-local in IndexedDB and is scoped to the
  browser profile and fixed origin.
- There is no cloud synchronization.
- There is no automatic updater.
- Same-version reinstall/uninstall continuity was not fully exercised before
  release.
- Packaging acceptance does not claim that the full application regression
  suite is green.
- The Windows executable and installer still use placeholder icon branding.

## Release assets

- `Kocokan-Setup-0.1.0.exe`
- `Kocokan-Portable-0.1.0.zip`
- `checksums.txt`
- `RELEASE-NOTES.txt`
