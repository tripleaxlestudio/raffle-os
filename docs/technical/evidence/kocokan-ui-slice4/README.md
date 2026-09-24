# Kocokan UI Slice 4 evidence

Evidence ini dibuat 2026-09-01 dari branch `redesign/kocokan-ui`, base
`93f3785`, menggunakan fixture visual terisolasi tanpa official Live write.

## Screenshots

- `active-20-1440x900.png` — workspace aktif dengan 20 winner dan right context.
- `selected-hover-1440x900.png` — selected lavender bertahan ketika row hover.
- `reason-menu-1440x900.png` — decision dialog dan themed reason-select portal.
- `completed-1440x900.png` — next-action hierarchy serta audit sekunder.
- `hundred-bottom-1366x768.png` — row ke-100 dan action bar tetap terjangkau.

`visual-fixture.html` dan `visual-fixture.tsx` adalah fixture development-only
untuk menguji count/state dan tidak masuk production route atau build.

## Machine-readable evidence

- `regression-comparison.json` — exact preflight/after comparison.
- `source-scope.json` — source allowlist dan forbidden-surface audit.
- `images.json` — ukuran dan SHA-256 screenshot.

Automated screenshot dan fixture bukan pengganti owner acceptance, pemeriksaan
manual Chrome/Edge, assistive technology, atau two-window acceptance.
