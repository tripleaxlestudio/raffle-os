# Kocokan Packaging Pilot — Audit P0

- Tanggal audit: Rabu, 23 September 2026.
- Target event pertama: Minggu, 27 September 2026.
- Repository: `C:\laragon\www\raffle-os`.
- Branch asal: `codex/dashboard-refinement`.
- Branch packaging: `codex/packaging-pilot`.
- Commit dasar saat audit: `6fad028`.
- Status: **audit selesai; arsitektur usulan menunggu approval; belum ada implementasi packaging**.

## 1. Ruang lingkup dan kondisi Git

Prioritas pilot adalah portability dan runtime stability. Packaging merupakan layer tambahan; aplikasi utama tetap browser-based local web application.

Launcher hanya bertanggung jawab atas lifecycle server, URL/port, membuka browser, status runtime, dan shutdown. Audit ini tidak mengusulkan redesign Operator/Audience, perubahan draw engine, eligibility, persistence/domain logic, redraw, atau refactor besar.

Branch `codex/packaging-pilot` telah dibuat dari `codex/dashboard-refinement`. Tidak ada commit baru. Perubahan awal berikut tetap dipertahankan di working tree:

- `src/app/layouts/ProductionAudienceStatus.test.tsx` — modified.
- `src/pages/operator/ProductionDashboardPage.tsx` — modified.
- `src/styles/kocokan/dashboard.css` — modified.
- `docs/technical/KOCOKAN-INTEGRATION-CLEANUP-FAILURE-AUDIT.md` — untracked saat audit.
- `src/application/dashboard/` — untracked saat audit.

Branch ini belum merupakan baseline bersih. Identitas source release harus ditetapkan sebelum menghasilkan paket yang dapat direproduksi. Tidak dilakukan stash, reset, penghapusan, atau commit terhadap perubahan tersebut.

## 2. Arsitektur existing

| Bagian | Temuan |
|---|---|
| Build aplikasi | `npm run build` menjalankan `tsc -b && vite build`. Output web berada di `dist/`. |
| Isi build | `dist/index.html` dan aset JS/CSS. Folder `dist` yang ada bertanggal 22 September; belum dibuktikan sesuai working tree saat audit. |
| HTTP server | Disediakan Vite dev atau Vite preview. Belum ditemukan entry point server produksi mandiri. |
| WebSocket | Implementasi Node + `ws` di `server/display-realtime-hub.ts`, dipasang melalui plugin Vite untuk dev dan preview. |
| Endpoint | WebSocket `/ws/display`; gambar publik melalui HTTP `/display-assets/<id>`. |
| Port | Tidak dikonfigurasi khusus di `vite.config.ts`. Mengikuti default Vite: dev `5173`, preview `4173`, kecuali diubah melalui CLI. |
| SPA routing | React Router memakai `createBrowserRouter`. Fallback HTML ditangani Vite. |
| Penyimpanan | Browser-local melalui Dexie/IndexedDB. Hub menyimpan snapshot publik dan cache gambar di memori. |
| Launcher | Belum ada launcher native, single-instance guard, health endpoint produksi, atau packaging Windows. |

### 2.1 Alur development

```text
npm run dev
  → Node menjalankan Vite
  → Vite membuat HTTP server
  → plugin memasang hub WebSocket dan endpoint gambar
  → browser menerima HTML dan modul React
  → Operator/Audience memakai transport WebSocket + BroadcastChannel
```

Client membentuk URL WebSocket dari `window.location.host`, sehingga HTTP dan WebSocket menggunakan host/port yang sama. Hub memisahkan koneksi berdasarkan event dan display, meneruskan state publik, menyimpan snapshot terakhir untuk audience baru, serta melaporkan jumlah audience.

Kode terkait:

- `vite.config.ts`.
- `server/display-realtime-hub.ts`.
- `src/application/display-transport/websocket-transport.ts`.
- `src/application/display-transport/wire-codec.ts`.
- `src/infrastructure/display/production-display-transport.ts`.

### 2.2 Alur build dan preview

```text
npm run build → dist/
npm run preview → Vite melayani dist/ + plugin WebSocket
```

Menyalin `dist/` saja belum cukup: hub WebSocket dan endpoint gambar tidak ikut menjadi server executable. `tsconfig.node.json` memakai `noEmit`; build saat ini bukan pipeline distribusi server mandiri.

Vite menyatakan `vite preview` bukan server produksi. Sumber: [Deploying a Static Site — Vite](https://vite.dev/guide/static-deploy).

### 2.3 Audience Display

Route `/display` sudah ada, tetapi URL operasionalnya memerlukan konteks:

```text
http://127.0.0.1:47882/display?eventId=...&displayConfigurationId=...
```

Tanpa parameter tersebut, aplikasi menampilkan pesan konteks produksi tidak valid. Untuk pilot, gunakan tautan yang dibuat workflow Audience existing, termasuk saat memasukkannya ke vMix. Launcher tidak perlu membaca IndexedDB atau membuat resolver event baru.

Kode terkait: `src/app/router.tsx` dan `src/pages/display/AudienceDisplayPage.tsx`.

### 2.4 Dependencies dan lifecycle

Dependency networking utama adalah `ws` (`^8.21.3` dalam `package.json`). Hub juga menggunakan API Node seperti `node:http` dan `node:stream`. React/React Router menjalankan UI browser; Dexie menangani penyimpanan browser. Vite merupakan development dependency, tetapi sekarang masih menjadi penyedia HTTP dan lifecycle hub pada dev/preview.

Hub memeriksa koneksi loopback dan konteks role/scope. Cache gambar memiliki batas jumlah dan ukuran. Cache serta snapshot hub bersifat sementara, bukan penyimpanan resmi hasil undian.

Cleanup hub saat ini terkait event `close` HTTP server. Ini belum menjadi bukti graceful shutdown mandiri, terutama ketika koneksi WebSocket masih terbuka.

## 3. Ketergantungan development yang perlu dilepas

- Startup HTTP/WebSocket bergantung pada Vite dan proses npm/Node yang dijalankan manual.
- Hub belum menyediakan kontrak start/stop mandiri; pemasangannya masih internal ke plugin.
- Belum ada status runtime, penanganan port conflict untuk pengguna, atau koordinasi shutdown launcher/server.
- Belum ada paket teridentifikasi dengan versi, checksum, runtime, dan petunjuk penggunaan.

Laragon tidak tampak sebagai kebutuhan runtime aplikasi dari script dan server yang diaudit. Node dapat tetap menjadi runtime internal paket tanpa mengharuskan pengguna menginstalnya.

## 4. Usulan arsitektur packaging pilot

**Rekomendasi: portable folder/ZIP berisi launcher WinForms self-contained, runtime Node yang dibundel, server mandiri yang memakai hub existing, dan hasil Vite build.**

```text
Kocokan.exe — launcher native
  └─ runtime Node bundled — proses anak tersembunyi
       ├─ HTTP 127.0.0.1:47882
       ├─ web/ hasil Vite build
       ├─ /ws/display — hub existing
       └─ /display-assets/ — handler existing

Launch Kocokan → default browser → Operator
vMix Browser Input → URL Audience lengkap
```

User mengekstrak paket dan menjalankan `Kocokan.exe`. Laptop target tidak perlu menginstal Laragon, XAMPP, Node, npm, Bun, Vite, atau .NET secara manual. Runtime yang diperlukan ikut dalam distribusi.

.NET mendukung deployment self-contained yang membawa runtime bersama aplikasi. Sumber: [Microsoft — .NET application publishing](https://learn.microsoft.com/en-us/dotnet/core/deploying/).

### 4.1 Evaluasi opsi

| Opsi | Penilaian untuk pilot |
|---|---|
| WinForms + bundled Node | Rekomendasi. UI native kecil dan hub existing dipertahankan. Tradeoff: ukuran paket dan pengelolaan dua proses. |
| Node Single Executable Application | Layak untuk runtime server mandiri, tetapi memerlukan spike bundling dependency/aset. Tidak otomatis menyediakan GUI launcher. |
| .NET/Kestrel untuk seluruh server | Cocok secara arsitektur, tetapi porting hub ke C# menambah risiko perubahan perilaku sebelum event. |
| Go/Rust native | Kandidat jangka panjang; sekarang menambah toolchain serta pekerjaan porting atau pengelolaan sidecar yang sama. |
| Electron | Belum ada alasan teknis cukup untuk membawa Chromium ketika GUI utama tetap di browser default. |
| Tauri | Menambah lapisan WebView/toolchain tanpa kebutuhan render aplikasi utama di launcher. |

Node menyediakan fasilitas executable dengan script/aset tertanam. Sumber: [Node — Single executable applications](https://nodejs.org/download/release/latest-jod/docs/api/single-executable-applications.html).

Satu file executable fisik tidak dijadikan syarat pilot. Self-contained distribution dapat berupa satu folder portable. Pilihan awal untuk web adalah menyajikan folder `web/`, bukan embedding, agar mudah diperiksa, diberi checksum, dan diganti sebagai satu paket versi.

### 4.2 Batas server produksi

- Bind loopback saja.
- Layani hanya aset paket; tidak mengekspos filesystem umum atau directory listing.
- Sediakan fallback SPA untuk navigasi route aplikasi; missing asset tetap menghasilkan 404, bukan HTML.
- Pertahankan endpoint WebSocket dan gambar existing pada origin yang sama.
- Sediakan health/version tanpa data peserta atau hasil resmi.
- Validasi Host, hindari permissive CORS, dan jangan membuka remote command API.
- Terapkan MIME/cache yang sesuai, termasuk mencegah `index.html` lama tersaji setelah update.
- Launcher mengelola proses anak dan tidak menjadi persistence authority atau draw controller.

## 5. Port resolution

Kandidat awal: **`127.0.0.1:47882`**, sesuai dokumen Host existing. Belum dianggap final atau bebas benturan.

Usulan mekanisme:

1. Launcher menggunakan single-instance guard.
2. Server mencoba bind langsung ke port tetap; kegagalan bind menjadi error yang terlihat.
3. Jika instance Kocokan sendiri sudah berjalan, aktifkan launcher existing.
4. Jika port dipakai proses lain, tampilkan petunjuk dan tombol Retry. Jangan mematikan proses tersebut.
5. Jangan otomatis mencari port berikutnya.

Pergantian port mengubah origin browser dan dapat membuat data terlihat kosong. Port launcher disarankan read-only untuk pilot. Port alternatif hanya ditetapkan secara eksplisit saat persiapan, sebelum data event dibuat, kemudian dibekukan.

Dynamic port mempermudah startup saat benturan, tetapi menambah risiko storage identity dan perubahan URL vMix. Fixed port lebih sesuai untuk pilot local-first ini.

## 6. Launcher V1 dan shutdown

Launcher menyediakan nama aplikasi, status, URL, port, Launch Kocokan, Hide, dan Quit.

- `Starting → Running` hanya setelah server benar-benar siap.
- Jika proses server berhenti, status menjadi Error.
- Launch membuka default browser; jika gagal, URL tetap terlihat dan dapat disalin.
- Hide meminimalkan ke taskbar agar mudah dibuka kembali tanpa tray kompleks.
- Refresh atau menutup browser tidak menghentikan server.
- Quit meminta konfirmasi, menutup WebSocket dan HTTP dengan timeout terbatas, lalu memastikan proses anak selesai.
- Penutupan launcher tidak boleh meninggalkan server yatim; perilaku close window dan Windows shutdown harus diuji.
- Launcher tidak mengklaim mengetahui apakah draw Live sedang aktif.

Run at login, start minimized, auto updater, code signing, installer wizard kompleks, LAN, dan tray kompleks tidak menjadi syarat pilot.

## 7. Perbedaan dengan dokumentasi lama

`docs/architecture/LOCAL-HOST-RUNTIME.md` telah mencatat arah Host Windows. Bagian berikut perlu diselaraskan melalui ADR setelah approval:

| Dokumentasi lama | Konteks/usulan pilot sekarang |
|---|---|
| Kandidat .NET/Kestrel | Pertahankan hub TypeScript existing melalui bundled Node; WinForms hanya launcher/lifecycle. |
| WebSocket sebagai pekerjaan mendatang | Kode WebSocket sudah tersedia dan brief pilot mewajibkan mempertahankannya. |
| Browser dipilih dan dipertahankan | Brief terbaru meminta default browser; browser/profile event perlu tetap konsisten secara operasional. |
| Installer masuk rencana | Portable ZIP cukup untuk pilot. |

Dokumentasi lama belum diubah oleh audit. Usulan ini belum merupakan persetujuan dependency atau implementasi baru.

## 8. File yang kemungkinan dibuat atau diubah

Semua nama file baru di bawah bersifat usulan, bukan file yang telah diimplementasikan.

| Lokasi | Tujuan |
|---|---|
| `server/display-realtime-hub.ts` | Membuka pemasangan hub dan disposal mandiri sambil mempertahankan protokol. |
| `vite.config.ts` dan adapter plugin | Memastikan dev/preview tetap menggunakan hub yang sama. |
| `server/local-server.ts`, `server/runtime-entry.ts` — baru | HTTP produksi, static serving, SPA fallback, health, startup/shutdown. |
| `launcher/Kocokan.Launcher/` — baru | WinForms, status, single instance, browser launch, pengelolaan proses. |
| `scripts/package-windows.ps1` dan konfigurasi build runtime — baru | Portable ZIP berisi runtime, web, manifest, checksum, notices. |
| `package.json`, lockfile bila diperlukan | Script packaging dan dependency build yang disetujui. |
| Test server/lifecycle — baru atau perluasan existing | Bukti perilaku runtime dan paket. |
| Dokumen ADR, acceptance, dan petunjuk penggunaan — baru | Keputusan final serta prosedur install, launch, update, rollback, dan pengujian. |

Tidak ditemukan kebutuhan untuk mengubah UI Operator/Audience, draw engine, eligibility, schema persistence, atau redraw.

## 9. Risiko dan batas klaim

1. **Origin dan browser/profile.** Data development tidak otomatis muncul pada origin packaging. Ini bukan penghapusan data, tetapi merupakan risiko operasional terbesar. Dataset event harus disiapkan pada origin final sebelum rehearsal. Migrasi/backup baru bukan bagian implementasi packaging tanpa persetujuan terpisah.
2. **Server hidup bukan berarti Operator terus menjalankan draw.** Menutup browser tidak menghentikan server, tetapi controller aplikasi tetap berada di browser.
3. **Restart hub menghilangkan cache sementara.** Republish snapshot, gambar, dan reconnect harus diuji melalui paket.
4. **vMix.** Keberhasilan sebelumnya merupakan konteks dari pengguna. Paket baru masih perlu diuji langsung, termasuk gambar, refresh, dan reconnect.
5. **Toolchain.** Mesin audit memiliki Node `22.20.0` dan .NET SDK `8.0.301`. SDK .NET 10 tidak terlihat dalam daftar SDK. Versi build/runtime final perlu dipilih dan dipin.
6. **Baseline belum bersih.** Perubahan dashboard belum di-commit; identitas source release perlu ditetapkan untuk reproducibility.
7. **Full suite belum terbukti hijau.** Dokumen audit existing mencatat 108 kegagalan pada 8 September. Ini catatan historis, bukan hasil suite tanggal 23 September. Jangan mass-update test untuk memaksakan status hijau.
8. **Artifact unsigned.** Perilaku SmartScreen/antivirus pada mesin event perlu diperiksa saat acceptance; code signing bukan syarat pilot dari brief.

## 10. Implementation plan sebelum Jumat

| Waktu | Target hasil setelah approval |
|---|---|
| Rabu, 23 September | ADR ringkas, baseline full suite, server mandiri dengan hub existing, test HTTP/SPA/WS/shutdown. |
| Kamis, 24 September pagi | Launcher native, single-instance, status/error, Launch/Hide/Quit. |
| Kamis, 24 September sore | Portable ZIP pertama, checksum/notices, smoke test Windows tanpa runtime development. |
| Jumat, 25 September | Buffer perbaikan blocker, acceptance vMix/persistence/restart, dan rehearsal. |

Target paket pertama selesai Kamis; Jumat digunakan untuk validasi. Jadwal bergantung pada tersedianya laptop bersih dan vMix. Installer kompleks atau single-file conversion tidak boleh mengambil waktu dari acceptance inti.

## 11. Acceptance pilot

Seluruh butir di bawah merupakan target pengujian paket, bukan klaim telah lulus pada P0.

| ID | Kriteria |
|---|---|
| A | Build dapat dipindahkan ke Windows machine lain. |
| B | Mesin target tidak membutuhkan Laragon/Node/npm/Bun yang diinstal manual. |
| C | User menjalankan executable Kocokan. |
| D | Local server start. |
| E | Launcher menunjukkan Running setelah readiness terverifikasi. |
| F | Launch Kocokan membuka default browser. |
| G | Operator berfungsi. |
| H | Route Audience berfungsi dengan URL scope existing yang lengkap. |
| I | WebSocket Audience berfungsi. |
| J | vMix Browser Input menerima Audience melalui URL lengkap. |
| K | Refresh browser tidak mematikan server. |
| L | Menutup browser tidak mematikan server. |
| M | Quit launcher menghentikan server secara bersih. |
| N | Data local-first existing tidak rusak; persistence restart/update diuji pada origin/profile tetap. |
| O | Automated tests tidak mengalami regresi packaging; kegagalan baseline didokumentasikan dan ditinjau. |

Tambahan skenario runtime: port conflict, duplicate launch, missing assets, browser-launch failure, process crash, offline startup, deep-link refresh, reconnect, dan pemuatan ulang gambar publik.

## 12. Verifikasi yang telah dilakukan

### Perintah dan hasil

| Pemeriksaan | Hasil |
|---|---|
| `git status --short`, `git diff --stat`, `git diff --name-only`, pembacaan branch/commit | Perubahan awal teridentifikasi dan dipertahankan. |
| `git switch -c codex/packaging-pilot` | Berhasil setelah izin penulisan metadata Git; branch berasal dari `codex/dashboard-refinement`. |
| Pembacaan source, konfigurasi, PRD, dan dokumen Host/Phase 11 | Arsitektur di atas berdasarkan kode dan dokumen lokal. |
| `node --version` | `v22.20.0`. |
| `dotnet --list-sdks` | SDK `8.0.301`. |
| `npm.cmd run test -- server/display-realtime-hub.integration.test.ts src/application/display-transport/websocket-transport.test.ts` | Exit 0: **2 file / 2 test lulus**, durasi runner 34,42 detik. |

Lint, build baru, full suite, clean-machine acceptance, dan pengujian browser/vMix tidak dijalankan dalam audit ini. Hasil test terfokus tidak membuktikan acceptance paket atau seluruh aplikasi.

## 13. Keputusan yang menunggu approval

Usulan yang siap ditinjau:

- Portable ZIP Windows dengan launcher WinForms self-contained dan bundled Node.
- Hub/protokol existing dipertahankan; hanya adapter server/lifecycle yang dipisahkan dari Vite.
- Folder `web/` untuk hasil Vite build, tanpa kewajiban single-file embedding.
- Kandidat origin tetap `http://127.0.0.1:47882`, tanpa fallback port otomatis.
- Default browser mengikuti brief terbaru; browser/profile event dijaga konsisten.
- URL Audience lengkap dari workflow existing; tidak menambah resolver atau akses database dari launcher.
- Paket pertama ditargetkan Kamis, acceptance dan buffer pada Jumat.

**Stop pada P0. Implementasi packaging dimulai hanya setelah approval pengguna.**
