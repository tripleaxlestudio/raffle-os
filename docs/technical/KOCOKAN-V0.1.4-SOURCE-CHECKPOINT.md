# Kocokan 0.1.4 — source checkpoint

Tanggal: 3 Oktober 2026. Scope pemilik: cek perubahan terakhir, push ke `main`, dan tetapkan versi 0.1.4. Ini checkpoint source; tidak membuat installer, tag, atau GitHub Release.

## Perubahan yang diperiksa

Delapan commit sejak `origin/main` awal (`d5c4577`): infrastruktur dan konten Help (`bc5bc77`, `578b4fc`, `26faf82`), backup versi/gambar hadiah (`7cbd212`), audit serta akses Help saat recovery (`f68a1da`, `e74ec12`), pembukaan Audience tanpa callback popup (`41a049a`), dan posisi input upload designer (`49e500e`). Pemeriksaan source tidak menemukan masalah baru yang menghalangi checkpoint ini. Bukti acceptance terdahulu tetap memiliki batas yang tercatat dalam dokumen masing-masing.

Perubahan lokal yang disertakan:

- `src/app/layouts/ProductionOperatorLayout.tsx`: Siaga mengirim appearance terbaru melalui resolver existing, termasuk fallback branding lama.
- `src/app/layouts/ProductionAudienceStatus.test.tsx`: memastikan kesamaan background/logo dengan preview, fallback legacy, dan larangan Siaga saat drawing/pending.
- `src/styles/audience.css`: tiket confirmed mendapat background hijau serta teks putih melalui variabel tampilan.
- `package.json`, `package-lock.json`: versi root menjadi 0.1.4; dependency tidak diubah. UI tetap memakai rantai versi terpusat dari package melalui define Vite dan `app-version.ts`.

Dokumen untracked yang sudah ada, `docs/copy/` dan `docs/product/KOCOKAN-HELP-MENUS-DRAFT.md`, dipertahankan tanpa dimasukkan ke commit ini karena merupakan inventaris/draft terpisah.

## Validasi

- `npm.cmd run lint`: PASS.
- `npm.cmd run build`: PASS; peringatan bundle >500 kB masih ada.
- `git diff --check`: PASS.
- Full suite awal: 1.604 total, 1.495 passed, 109 failed. Satu failure tambahan pada tes redraw handoff; `npm.cmd run test -- src/pages/operator/ProductionPendingResultsRedrawFlow.test.tsx` lulus 2/2 saat dijalankan sendiri.
- Full suite diulang tanpa lint/build bersamaan: 1.604 total, 1.496 passed, 108 failed, exit 1. Dibandingkan identitas file + full test name pada baseline recovery Help: 0 failure baru, 0 hilang, 108 unchanged. Hasil awal tetap dicatat; indikasi masalah timing bukan bukti full suite hijau.
- Tes pada run penuh untuk header/dashboard Audience (32), public projection (16), recovery Help (22), recovery gate (3), backup gambar (13), domain appearance (4), managed Audience window (4), Audience appearance (5), konten Help (4), dan navigasi Help (15) semuanya lulus.

[Perbandingan suite](evidence/v014-source-checkpoint/full-suite-comparison.json) menyimpan identitas seluruh failure dan hasil run awal. Full suite tetap **NOT PASS**, tanpa waiver baru.

## Batas dan tindak lanjut

Tidak ada uji visual browser/vMix baru, build installer, uji installed upgrade, tag, atau publikasi GitHub Release pada checkpoint ini. Halaman Yang Baru tetap menggunakan fallback apabila belum ada catatan rilis resmi untuk 0.1.4. Kegagalan baseline dan timing redraw perlu ditindaklanjuti terpisah; tidak ada test unrelated diubah untuk menutupi hasil. Push dilakukan biasa tanpa force; hash final dan kesamaan remote dilaporkan setelah push.
