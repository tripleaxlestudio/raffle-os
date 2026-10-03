# Kocokan 0.1.4 installer and autoupdate test preparation

Tanggal: 3 Oktober 2026. Pemilik meminta installer 0.1.4 agar dapat menguji autoupdate. Paket disiapkan untuk rilis stabil publik yang dibaca updater existing; tidak ada perubahan mekanisme updater atau pemasangan upgrade pada komputer pemilik oleh agent.

## Source and artifacts

- Build commit: `e9fcd7f61c61299aedf34d2f3d6b29ef652870f1`, branch `main`, version `0.1.4`.
- Folder: `artifacts/release/Kocokan-0.1.4/`.
- Manifest mencatat `sourceDirty: true` karena dua dokumen untracked existing (`docs/copy/` dan `docs/product/KOCOKAN-HELP-MENUS-DRAFT.md`). Semua tracked source bersih saat build; dokumen tersebut tidak disertakan dalam payload. Flag dipertahankan apa adanya.
- Script build hanya diperbarui pada catatan rilis agar tidak menyebut upgrade 0.1.2 ke 0.1.3. Runtime/installer/updater behavior tidak diubah.
- Dua branch unmerged diperiksa: `phase8/slice-14d-subsequent-draw-lifecycle` patch-equivalent/superseded menurut `git cherry`; `codex/wip-rescue-2026-09-08` rescue/archive only, snapshot campuran lama, dengan tiga fixture QA Audience yang sengaja tidak disertakan. Tidak ada merge branch tambahan.

| Asset | Bytes | SHA256 |
| --- | ---: | --- |
| Kocokan-Setup-0.1.4.exe | 95137756 | `3744676d02eb5e8ee641af5df789926eb52c8a4b61aaf8f8a0f568441bc9f8f6` |
| Kocokan-Portable-0.1.4.zip | 133519143 | `4e3e46a20f14b8ed9d74278a9f9319941232c9133c4d8d39afabb69f54ec6d67` |
| checksums.txt | 559 | `35d97aa37a037431cbdd3c66ac5d86c83880d9e5e0736dc481a0fa8a4a2d8bf9` |
| RELEASE-NOTES.txt | 627 | `9529cab91e7f1fa1414f9d8ea0968bfa6ca52318e30d29f9601549e6a2d8daaa` |

## Verification

- PowerShell parser for build script: PASS; `git diff --check`: PASS.
- `scripts/build-release-windows.ps1 -Zip`: PASS, termasuk `npm.cmd run build`, `npm.cmd run build:runtime`, launcher/updater .NET publish, Inno Setup compilation, portable ZIP.
- `scripts/test-release-windows.ps1 -ReleaseDirectory artifacts/release/Kocokan-0.1.4`: PASS, 563 portable hashes, complete coverage, release SHA256, version and launcher/installer metadata, fixed origin `http://127.0.0.1:47882`.
- `npm.cmd run test -- server/update src/application/update src/infrastructure/update --maxWorkers=2`: 11 files / 94 tests PASS.
- `dotnet run --project packaging/harness/Kocokan.Harness.csproj -c Release -- artifacts/release/Kocokan-0.1.4/portable`: 24 checks PASS. Port 47882 kosong sebelum dan sesudah harness; tidak ada existing process dihentikan. Test memakai child process dan handoff fixture milik harness, bukan menjalankan installer pada instalasi pemilik.
- Full suite pada source checkpoint: 1604 total, 1496 passed, 108 unchanged baseline failures; tetap NOT PASS, bukan waiver. Tidak diulang untuk perubahan teks packaging saja. Lint sebelumnya PASS; PowerShell packaging script tidak tercakup ESLint.
- Installer Authenticode: NotSigned, sama dengan distribusi sebelumnya.

## Real upgrade acceptance

Installed manifest yang dibaca pada `C:\Program Files\Kocokan\manifest.json` masih 0.1.3. Installed runtime tidak sedang listening saat audit, sehingga capability API live belum diperiksa. Repo/rilis sebelumnya publik dengan latest stable v0.1.3. Updater existing membaca latest stable GitHub Release dan membutuhkan asset bernama `Kocokan-Setup-0.1.4.exe` serta `checksums.txt`.

Rilis 0.1.4 dimaksudkan sebagai target uji pemilik dari 0.1.3. Real installed upgrade, UAC, relaunch, dan kesinambungan data setelah update belum diuji pada closeout packaging; tidak diklaim PASS dan tidak ada waiver baru. Jalankan Kocokan installed 0.1.3, pastikan tidak ada sesi aktif/pending dan tutup Audience, lalu Settings → Tentang → Periksa Pembaruan → Update Sekarang → Pasang Pembaruan. Setelah relaunch, verifikasi versi 0.1.4 dan data acara/peserta/hadiah/riwayat tetap tersedia.

Tag harus menunjuk build commit `e9fcd7f`, dan empat asset harus diunggah lengkap sebelum draft dijadikan latest stable. Hasil verifikasi publication/anonymous download dicatat setelah proses selesai.

## Publication status

Annotated tag `v0.1.4` telah dibuat terhadap build commit `e9fcd7f61c61299aedf34d2f3d6b29ef652870f1` dan di-push bersama `main`. Upload empat asset melalui `gh release create --draft --verify-tag` **ditolak automatic approval review sebelum command berjalan**: permintaan installer/autoupdate testing belum dianggap izin eksplisit untuk publikasi payload ke GitHub. Tidak ada workaround atau upload lain dilakukan. Rilis stabil tetap 0.1.3; installer lokal siap, tetapi autoupdate belum dapat menemukan 0.1.4. Publikasi asset dan verifikasi download menunggu persetujuan eksplisit pemilik.

### Publication completed after owner approval

Pemilik kemudian memberi izin eksplisit melalui pesan **“boleh silahkan”** untuk upload keempat artefak dan publikasi rilis stabil. Status menunggu izin di atas adalah catatan historis.

- [GitHub Release v0.1.4](https://github.com/tripleaxlestudio/raffle-os/releases/tag/v0.1.4) dipublikasikan setelah draft memiliki keempat asset lengkap; `isDraft: false`, `isPrerelease: false`, latest stable 0.1.4.
- Metadata SHA256 GitHub dan ukuran keempat asset sesuai tabel lokal sebelum publication.
- Anonymous GET ke `https://api.github.com/repos/tripleaxlestudio/raffle-os/releases/latest` memastikan `tag_name: v0.1.4`, non-draft/non-prerelease, serta URL/nama asset yang dibutuhkan updater.
- Keempat asset diunduh ulang dengan `curl.exe` tanpa autentikasi, dan SHA256 semuanya identik dengan file lokal. Bukti unduhan disimpan lokal pada `artifacts/release/Kocokan-0.1.4/public-verification/` (ignored).
- Real installed upgrade tetap menunggu uji pemilik. Publikasi, validasi metadata, dan checksum tidak mengubah status tersebut menjadi PASS.
