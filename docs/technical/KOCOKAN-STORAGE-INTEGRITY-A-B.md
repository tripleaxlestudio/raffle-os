# Kocokan — Storage Integrity Follow-up A + B

Tanggal: 3 Oktober 2026. Branch `main`; HEAD awal `26faf824c7998d46164170da8b3cb0181254705b`. Help Slice 1, Slice 2, dan acceptance sudah berada dalam history. Scope ini hanya centralized backup version metadata dan portable prize image round-trip. Tidak ada perubahan Help, draw selection, redraw, transport, presentation state machine, ConnectionsTab, StartupRecoveryGate, updater, installer, dependency, atau package version.

## Audit findings

**A terkonfirmasi:** DataStorageTab memanggil `createBackup(database)` dan storage service memberi default appVersion `0.1.0`. Karena format backup `version: 1` adalah schema version tersendiri, metadata appVersion stale bukan alasan menolak backup lama. Reader existing tidak menggunakan appVersion sebagai compatibility gate; perilaku ini dipertahankan.

**B terkonfirmasi gagal sebelum fix:** PrizeCategoriesPage memilih file PNG/JPEG/WebP (maksimal 5 MiB), menyimpan binary Blob serta id/name/type/size/createdAt ke `RaffleOS_PrizeAssets.prize_images` melalui DexiePrizeImageAssetRepository. PrizeCategory pada `RaffleOS_DB.prize_categories` hanya menyimpan `prizeImageAssetId`. Backup service membaca database utama dan kategori, tetapi tidak membaca database aset. JSON backup hanya membawa reference ID; restore pada profil bersih tidak dapat mengambil binary yang tidak ada. Preview tidak mengidentifikasi gambar hilang. Menggunakan profile sumber yang masih memiliki asset bisa menyamarkan masalah ini.

Model diperiksa di [prize types](../../src/domain/prizes/prize.types.ts), [asset types](../../src/domain/prizes/prize-asset.types.ts), [repository](../../src/infrastructure/persistence/repositories/prize-image-asset.repository.ts), [Operator page](../../src/pages/operator/PrizeCategoriesPage.tsx), dan [AudiencePrizeImage](../../src/ui/audience/AudiencePrizeImage.tsx). Object URL dibuat sementara dari Blob saat render, lalu direvoke; URL tersebut tidak menjadi persisted asset atau portable backup source. Audience renderer menggunakan local asset terlebih dahulu, dengan fallback runtime asset endpoint bila local asset tidak tersedia. Gambar hadiah ditampilkan pada standby undian berikutnya; tahap countdown/rolling/reveal tidak menampilkan gambar tersebut dalam implementasi saat ini.

## Backup version fix

DataStorageTab sekarang memberikan `KOCOKAN_APP_VERSION` secara eksplisit kepada `createBackup`. Sumber tetap `package.json` → define Vite → `src/config/app-version.ts`. Service memerlukan argumen versi, tanpa default hardcoded dan tanpa import konfigurasi UI/global version ke application storage layer. Test caller memeriksa argumen yang dikirim; browser membuktikan file hasil download mencatat 0.1.3 dari source terpusat saat ini.

Format tetap `kocokan-backup`, schema `version: 1`. AppVersion tetap metadata, bukan gate schema. Fixture backup lama appVersion 0.1.0 tetap tervalidasi dan dapat direstore. Tidak ada version bump atau migration database baru.

## Prize image storage model dan format extension

`data.prizeImageAssets?: SerializedPrizeImage[]` merupakan extension opsional pada schema v1. Backup baru menyertakan array (termasuk kosong bila tidak ada gambar). Setiap gambar berisi id, name, MIME type, ukuran byte, createdAt, base64 binary, dan SHA-256 byte asli. ID unik yang direferensikan kategori dibaca satu kali; hadiah yang memakai aset sama tidak menggandakan binary. Hanya prize image yang direferensikan kategori dalam backup dibawa, bukan seluruh orphan asset database.

Application layer mempunyai port kecil `PrizeImageBackupStore` untuk read/stage/discard. Adapter existing mengimplementasikannya; interface upload/render existing tidak diubah. Metode backup/restore membuka koneksi secara eksplisit sehingga tetap bekerja setelah owned adapter ditutup oleh effect replay React StrictMode. Browser run awal menemukan “Database has been closed”; fix dan regression test close/reopen ditambahkan, lalu smoke diulang berhasil.

Base64 dipilih mengikuti format JSON backup existing yang sudah memakai encoding ini untuk EventSettings assets. Encoding menggunakan potongan 8 KiB untuk menghindari call-stack/per-byte string fragmentation pada konversi. Gambar dibatasi 5 MiB per asset sesuai upload existing, dan extension memiliki limit agregat 64 MiB binary. Backup melebihi limit gagal dengan pesan jelas, tanpa truncate atau file parsial. Sebelum encoding diperiksa ukuran Blob terhadap metadata/MIME. Restore memeriksa metadata, duplicate ID, MIME, timestamp, canonical base64, decoded length dan semua referensi. Checksum diverifikasi async sebelum preview UI dan sebelum staging/restore commit. Parser tidak memakai regex rekursif pada payload besar; test menggunakan encoding 5 MiB dan agregat melebihi 64 MiB.

Base64 overhead binary adalah `4 × ceil(n / 3)` karakter, sekitar 33% sebelum metadata JSON. Batas binary extension 64 MiB berarti kira-kira 85,33 MiB karakter base64 ditambah metadata. Ini batas untuk prize image, bukan redesign/batas global seluruh data atau assets pada format existing. SHA-256 membuktikan byte fidelity/integrity, bukan autentikasi file backup.

## Backup/restore round-trip final

1. Backup membaca kategori dari database utama, mengambil unique referenced assets dari store terpisah dengan strict read, meng-encode dan mencatat checksum. Missing asset menyebabkan backup gagal; tidak mengekspor dangling reference sebagai sukses.
2. Download existing mengubah envelope menjadi JSON `.kocokan.json`. Browser test menggunakan tombol Buat Backup dan file yang benar-benar diunduh.
3. Restore reader memvalidasi extension jika ada; tidak membuang field. DataStorageTab juga memverifikasi checksum sebelum membuka preview. Preview menyebut jumlah gambar dan memberi peringatan untuk legacy references yang binary-nya tidak dibawa.
4. Setelah confirmation, executeRestore mengulangi shape/reference/checksum validation sebelum perubahan. Adapter men-stage gambar secara atomik di asset database dengan **ID baru**, tanpa menimpa/menghapus aset existing. Satu mapping ID dipakai bersama oleh kategori yang sebelumnya share satu asset.
5. Kategori diremap, lalu data utama diganti dalam transaksi replace-all existing. Bila write data utama gagal, transaksi rollback dan staged images dibuang. Bila staging gagal, data utama belum disentuh. Bila cleanup gagal, error eksplisit menyatakan cleanup aset sementara gagal dan data utama tetap dipertahankan.
6. Setelah main commit, gambar yang sudah tersedia direferensikan oleh kategori restored. Renderer membuat object URL baru dari Blob, termasuk setelah reload/reopen. UI sukses dibatasi pada data dalam file, bukan klaim seluruh data/aset aplikasi sudah lengkap.

### Compatibility dan legacy images

Backup v1 lama tanpa extension tetap diterima. Jika kategori lama mempunyai `prizeImageAssetId` tetapi file tidak membawa binary, preview memperingatkan jumlah hadiah terdampak; restore **melepas reference tersebut** dan memulihkan hadiah tanpa gambar. Ini menghindari reference ke aset tak-portable tanpa peringatan. Gambar lama tidak bisa direkonstruksi dari ID. Existing assets pada target tidak dihapus atau dijadikan sumber tebak-tebakan. Backup tanpa image tetap normal. File extension baru dengan missing asset/reference, invalid binary metadata atau checksum rusak ditolak sebelum database utama diganti.

Backward compatibility ditujukan untuk reader baru membaca file v1 existing. Aplikasi lama yang mengabaikan extension baru tidak otomatis mendapat dukungan restore prize image; tidak ada klaim forward compatibility tersebut.

### Atomicity boundary

IndexedDB tidak menyediakan satu transaksi lintas dua database. Solusi ini mempertahankan atomic replace-all data utama dan atomic staging asset, dengan fresh IDs serta compensating cleanup untuk kegagalan biasa. Tidak diklaim global cross-database transaction. Crash setelah staging sebelum main commit dapat menyisakan orphan asset, tetapi data lama dan reference-nya tidak ditimpa. Crash setelah main commit memiliki aset yang sudah committed lebih dahulu. Old/orphan assets tidak dibersihkan agresif pada scope ini; garbage collection memerlukan audit lifecycle tersendiri. Parallel manual restore/upload dan failure/power-loss di semua titik belum diaccept pada runtime nyata.

## Verification

### Focused tests

[prize-image-round-trip.test.ts](../../src/application/storage/prize-image-round-trip.test.ts) menambah integration coverage untuk: tanpa gambar; multiple images berbeda; shared association; JSON validation/preview; target database terpisah; close/reopen persistence; SHA-256 equality; missing asset backup failure; legacy 0.1.0/reference warning/detachment; encoding/size/duplicate/MIME/missing extension data; same-length checksum corruption; ukuran 5 MiB dan agregat 64 MiB; staging error tanpa perubahan current data; main write failure dengan rollback dan staged cleanup. Test hanya menggunakan unique fake-indexeddb databases, bukan event asli. Node Vitest environment menyediakan Blob/Web Crypto untuk service integration; tidak mengubah typing/runtime production.

AppSettingsPage.test.tsx menambah test bahwa caller memberikan centralized version. Existing storage, repository dan Audience rendering tests ikut dijalankan. Focused command:

```text
npm.cmd run test -- src/application/storage src/pages/operator/AppSettingsPage.test.tsx src/infrastructure/persistence/repositories/prize-image-asset.repository.test.ts src/ui/audience/AudiencePrizeImage.test.tsx
```

Hasil focused: **49/49 tests, 5 file PASS**. Typecheck, lint, dan build PASS setelah fix; build tetap memberi large-chunk warning existing. Diff check diperiksa sebelum commit. Awal typing test yang mengimpor Node declarations memengaruhi global timer types; diganti menjadi isolated Node test environment, tanpa mengubah source timer/protocol atau tsconfig.

### Browser/runtime acceptance

Existing bundled Playwright + installed Edge headless, Vite local test origin `http://127.0.0.1:5181`, dua fresh browser contexts. Source fixture dan target clean profile memiliki IndexedDB terpisah. Installed origin `127.0.0.1:47882` dan data user tidak disentuh. Tidak ada reset terhadap profil user. Source fixture memiliki empat hadiah: dua PNG berbeda, satu hadiah berbagi PNG pertama, dan satu tanpa gambar.

Tombol UI membuat download JSON dengan appVersion 0.1.3/schema1 dan dua unique assets. File itu diupload ke UI restore target kosong; preview menampilkan dua gambar; confirmation commit dijalankan. Setelah reload, ketiga thumbnail Operator tampil dengan naturalWidth > 0. Bytes target dibaca kembali dan kedua SHA-256 cocok source; shared mapping tetap sama dan gambar berbeda tidak tertukar. Actual AudiencePresentation dimount pada isolated restored profile dengan standby fixture yang mendukung gambar; image decode/naturalWidth dan reload/remount berhasil. Tidak ada broken object URL atau page error. Ini bukti renderer lokal, bukan full transport, official draw atau external AV acceptance. Draw presentation aktif tidak mempunyai prize image slot pada tahap countdown/rolling/reveal; tidak diubah untuk memenuhi test.

[Browser JSON](evidence/storage-integrity-ab/browser-verification.json), [restore preview](evidence/storage-integrity-ab/restore-preview.png), [Operator restored](evidence/storage-integrity-ab/operator-restored.png), [Audience standby restored](evidence/storage-integrity-ab/audience-restored.png). Ketiga screenshot ditinjau secara visual. Run awal browser gagal akibat closed asset adapter; rerun final berhasil. Interop import pada temporary test harness juga diperbaiki tanpa perubahan renderer aplikasi.

### Full-suite regression

Baseline Help acceptance: 1.557 total, 1.449 passed, 108 failed. Full suite baru menggunakan JSON reporter dan comparison file + full failure name terhadap `help-acceptance/full-suite-comparison.json`. Hasil: **1.571 total, 1.463 passed, 108 failed; 0 failure baru, 0 hilang, 108 unchanged**. Empat belas tes baru lulus; tidak ada timing failure tambahan pada run ini. [Comparison](evidence/storage-integrity-ab/full-suite-comparison.json) menyimpan seluruh nama kegagalan. Full suite **NOT PASS**, bukan waiver. Pemeriksaan focused/type/lint/build diulang jika ada penyesuaian akhir; tidak ada mass rewrite baseline tests.

## Known boundaries dan follow-up

Full suite diulang setelah validator restore memakai parsed object secara langsung, sehingga tidak membuat salinan JSON/base64 tambahan hanya untuk revalidation. Run awal dan run source final sama-sama menghasilkan 1.571 total / 1.463 passed / 108 failed, dengan identitas 108 failure unchanged. [Run awal](evidence/storage-integrity-ab/full-suite-first-run.json) juga disimpan. Tidak ada edit source setelah gates final tersebut.

- Acceptance hanya A dan prize image B. Tidak menyatakan backup fully complete untuk semua data/asset class. DisplayConfiguration embedded assets/fonts, audio, unrelated legacy validation dan seluruh backup classes belum diaudit oleh scope ini.
- Cross-database crash/parallel-operation acceptance dan orphan garbage collection terpisah, seperti boundary di atas. Read snapshot seluruh data ketika ada concurrent Live mutation bukan hal yang dibuktikan oleh fixture; manual restore tetap harus dilakukan ketika operasi acara telah selesai.
- Existing MIME/size upload policy dipertahankan; integration hash tests membuktikan byte fidelity, browser fixture membuktikan valid PNG decode. Semua malformed image codec/content bukan cakupan decoder acceptance baru.
- DataStorage statistics existing menghitung database utama; total tampilan ukuran penyimpanan belum menghitung seluruh database aset/fonts. Tidak diperbaiki di scope ini.
- ConnectionsTab/recovery Help access/bundle optimization, installer notices dan baseline suite failures tetap follow-up lain. Tidak ada perubahan Help accepted; teks batas backup di Help tetap benar dan tidak diganti menjadi jaminan kelengkapan.

## Files dan Git

Source berubah: storage-service.ts, storage-types.ts, prize-image-backup.ts, prize-image-asset.repository.ts, DataStorageTab.tsx, RestoreConfirmationModal.tsx. Tests: prize-image-round-trip.test.ts dan AppSettingsPage.test.tsx. Dokumen ini dan evidence storage-integrity-ab melengkapi laporan. Commit semantik tunggal memakai `fix(storage): preserve backup version and prize assets`; hash dibaca dari Git sesudah commit dan dilaporkan ke pemilik. Tidak ada push. `docs/copy/` dan draft produk Help existing tetap di luar staging.
