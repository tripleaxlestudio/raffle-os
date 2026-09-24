# Slice 3 evidence index

See [implementation report](../../KOCOKAN-UI-SLICE-3.md) for exact scope,
commands, regression policy and untested/manual conditions.

- Starting revision: `c6e598ac25653e6d9b4874425d2f39bd9f040ecd`;
  branch `redesign/kocokan-ui`, owner accepted Slice 2 including refinements.
- Capture dates: 2026-08-31–2026-09-01, Asia/Jakarta.
- Browser: Codex in-app Chromium. Exact engine build not exposed by the
  permitted DOM inspection API; this is not external Chrome/Edge evidence.
- Origin: `http://127.0.0.1:5175`, separate from Slice 2's 5174.
- Real synthetic UI data: event `UJI SLICE 3 — Draw Console`, one Door Prize,
  `participants.csv` (120 exact strings), six-winner Practice. No official draw.
- Images are **JPEG**, verified by file signature and renamed from the initial
  `.png` capture names. `images.json` records actual pixel dimensions and hashes.
  Captures are viewports, including scrolled regions, not full-page proofs.

## Screenshots

| File/group | Evidence |
| --- | --- |
| `setup-before-1440x900.jpg` | Baseline Setup, missing/unconfigured data |
| `setup-1366x768.jpg`, `setup-1920x1080.jpg` | Saved real Setup at compact/wide desktop |
| `setup-manual-1440x900.jpg` | Saved quantity/manual-presentation controls, scrolled into view |
| `setup-controls-dirty-1440x900.jpg` | Dirty controls; NOT proof of saved insufficient capacity |
| `queue-fixture-before.jpg`, `run-fixture-before.jpg` | Before migration, synthetic production components, 1280×720 |
| `queue-fixture-live-1440x900.jpg` | Existing Live mode selection, lavender focus/selection and light deck; no Live execution |
| `queue-{1366x768,1440x900,1920x1080}.jpg` | Real Practice queue, unavailable Live and waiting Audience |
| `run-ready-{1366x768,1440x900,1920x1080}.jpg` | Real start gate; only Audience-owned preview is dark |
| `run-ready-resize-attempt-1440x900.jpg` | Retained duplicate from an unsuccessful viewport targeting attempt; NOT wide evidence |
| `run-manual-1440x900.jpg`, `run-reveal-1440x900.jpg` | Real synthetic Practice manual roll/reveal, leading zeroes preserved |
| `run-fixture-1366x768.jpg` | Synthetic reveal before the final secondary return-button refinement |
| `run-blackout-1366x768.jpg`, `recovery-1366x768.jpg` | Production components under controlled blackout/recovery fixture |
| `audience-fixture-1920x1080.jpg` | Renderer fixture WITHOUT AudienceLayout backdrop; not `/display` parity evidence |
| `display-1920x1080.jpg` | Actual frozen `/display` missing-context screen; popup/two-window acknowledgement not certified |

## Machine-readable evidence

- `full-comparison.json`: final full suite versus original accepted failure
  register; 140 unchanged, no changed/new failure, two previously recovered.
- `preflight-comparison.json`: every one of the 109 focused before/after test
  identities/status/signatures, plus full comparison against Slice 2.
- `source-scope.json`: six normalized TSX AST hashes; only className/theme hooks
  excluded. Frozen paths and existing test modifications must be empty.
- `preview-before.json`, `preview-after.json`, `preview-comparison.json`: eight
  non-empty matching computed-style samples, identical snapshot/600px monitor/
  1280×720 viewport. Blackout's empty selector is explicitly invalid evidence.
- `preview-initial-mismatch.json`: investigated viewport-size mismatch, retained
  transparently; superseded by the valid equal-size comparison.
- `blackout-comparison.json`: actual blackout DOM under legacy/Kocokan themes.
  Canvas background/dimensions match; foreground inheritance on empty DIVs
  differs, so `equal:false` is intentional and is NOT claimed as before/after
  regression evidence. No visible text exists in these blackout nodes.
- `responsive.json`: measured route/viewports, overflow and quantity alignment.
- `images.json`: JPEG pixel dimensions, byte counts and SHA256 checksums.

## Reproduce

Start Vite on a free isolated port. The HTML/JSX fixture is a development-only
evidence page, **not** a production app route or build input. Open
`/docs/technical/evidence/kocokan-ui-slice3/visual-fixture.html`. Controls render
the real production components with synthetic data. Connection claims and
callbacks are fixtures, not a real transport acknowledgement or persistence
operation. Do not use its Audience button as a real display-launch test.
Runtime presentation may use private Practice presentation storage/channel;
it does not select official winners or write official database records.

For real-route reproduction use the normal Event/Prize/Import/Settings/Setup UI
on the isolated origin. Do not inject storage or reuse the user's event data.
The fixture is not a replacement for integration/Chrome/Edge/owner acceptance.

Run comparator/audit commands from the repository root as listed in the report.
Regenerate image checksums with `node docs/technical/evidence/kocokan-ui-slice3/image-manifest.mjs`.
