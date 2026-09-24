# Kocokan Packaging Pilot P1 — Standalone Production Server

Tanggal: 23 September 2026. Branch: `codex/packaging-pilot`.

## 1. Approval dan batas pekerjaan

Pengguna menyetujui portable Windows distribution, WinForms self-contained,
bundled Node, standalone HTTP server, hub WebSocket existing, Vite production
assets, default browser, dan origin tetap `http://127.0.0.1:47882`.

P1 ini berhenti pada standalone server dan pengujiannya. WinForms, pengadaan
binary Node untuk distribusi, portable ZIP final, installer, dan acceptance
clean-machine/vMix belum dikerjakan. Tidak ada Electron/Tauri, fallback port
dinamis, redesign, perubahan domain draw, atau migrasi data.

Approval terbaru menjadi acuan pilot atas bagian rencana lama di
`docs/architecture/LOCAL-HOST-RUNTIME.md` yang masih mengusulkan Kestrel dan
menempatkan WebSocket sebagai fitur mendatang. Dokumen P0 tetap sebagai catatan
historis audit sebelum approval.

## 2. Packaging Pilot Baseline

**SHA: `f1d9f42bb89f2350aa25f4783e5c06360813747b`**

Sebelum mengubah kode packaging, perubahan awal diamankan dalam dua commit:

| Commit | Isi |
|---|---|
| `b7b15d7` | Dashboard operational refinements, Audience monitor, contextual next action, Live progress, recent audit activity, CSS, dan test terkait. |
| `f1d9f42` | Dokumen audit kegagalan integration cleanup dan audit Packaging Pilot P0. |

File dashboard yang sebelumnya modified/untracked:

- `src/app/layouts/ProductionAudienceStatus.test.tsx`.
- `src/pages/operator/ProductionDashboardPage.tsx`.
- `src/styles/kocokan/dashboard.css`.
- `src/application/dashboard/recent-activity.ts`.
- `src/application/dashboard/recent-activity.test.ts`.

Sesudah commit baseline, `git status --porcelain=v1` menghasilkan output kosong.
Tidak ada reset, stash, penghapusan, atau kehilangan perubahan existing.
Perubahan P1 sesudah titik tersebut merupakan perubahan baru yang terpisah dari
baseline; tidak ada source dashboard/domain yang diedit dalam implementasi P1.

## 3. Runtime hasil implementasi

```text
Build machine
  npm run build          → dist/ (Vite web assets)
  npm run build:runtime  → dist-runtime/kocokan-server.cjs

Node menjalankan kocokan-server.cjs
  → validasi dan muat aset produksi
  → HTTP bind 127.0.0.1:47882
  → pasang display realtime hub existing
  → nyatakan ready setelah listen berhasil
       ├─ / dan deep links → aset/SPA
       ├─ /health → readiness + versi
       ├─ /ws/display → WebSocket existing
       └─ /display-assets/<id> → public image PUT/GET existing
```

Bundle runtime mencakup `ws` dan kode server yang diperlukan. Vite hanya dipakai
saat build, tidak menjadi HTTP server produksi atau runtime dependency bundle.
Tidak ada dependency baru atau perubahan package version/lockfile.

### Hub dan adapter Vite

- `attachDisplayRealtimeHub()` mengembalikan `middleware` dan `dispose()`.
- Adapter Vite terpisah memasang middleware yang sama pada dev dan preview.
- Adapter menunggu disposal hub sebelum menutup server Vite.
- Disposal idempotent: hentikan upgrade hub, kirim close frame WebSocket `1001`,
  terminasi peer yang tidak menutup dalam batas waktu, lalu bersihkan cache.
- Jalur upload/message yang masih pending tidak mengisi ulang cache setelah
  hub disposed.
- Upgrade `/ws/display` yang tidak valid mendapat respons penolakan; upgrade
  lain tetap diserahkan kepada Vite, termasuk HMR.

**Wire contract tidak diubah:** codec, protocol version, envelope, role/scope,
snapshot replay, presence frame, dan endpoint gambar tetap memakai implementasi
existing. Perubahan hanya pemasangan, disposal, dan penolakan upgrade invalid.

Saat bundling, akselerator native opsional `ws` dinonaktifkan melalui flag resmi
`WS_NO_BUFFER_UTIL` dan `WS_NO_UTF_8_VALIDATE`. Ini mempertahankan jalur JavaScript
yang didukung `ws`, menghindari dependency native pada mesin target dan shim
optional peer dependency saat build; tidak mengubah format pesan.

### HTTP, aset, dan readiness

- CLI selalu bind `127.0.0.1:47882`; tidak membaca port alternatif dari environment
  dan menolak argumen `--port`.
- Port conflict gagal secara jelas tanpa mematikan pemilik port atau pindah port.
- `testPort` hanya injeksi API untuk automated tests yang terisolasi; tidak
  diekspos pada CLI produksi.
- Aset dibaca ke allow-list immutable sebelum bind. Tidak ada lookup filesystem
  dari URL request, directory listing, dotfile, source map, atau symlink asset.
- Batas total web assets: 256 MiB. Update file web membutuhkan restart runtime.
- `index.html` dan entry script/style lokal yang dirujuk harus tersedia sebelum
  server menyatakan ready.
- Deep link navigasi SPA mendapatkan HTML. Missing static asset, namespace
  assets/WS yang tidak tersedia, dan non-HTML request yang tidak cocok mendapat 404.
- Mendukung GET/HEAD, MIME sesuai ekstensi, dan `no-cache` pada web assets agar
  update tidak tertahan cache lama. Cache public display asset tetap existing.
- Host harus canonical. Cross-origin request ditolak tanpa permissive CORS.
- Traversal, dotfile, backslash/drive path, dan URL malformed ditolak.
- `/health` menghasilkan hanya `application`, `version`, `status`, dan `ready`;
  tidak berisi peserta, event, hasil, atau path filesystem.

### Shutdown

- `close()` idempotent dan mengubah status menjadi `stopping` sebelum cleanup.
- HTTP berhenti menerima koneksi baru; hub mengirim close frame kepada peers.
- Koneksi tersisa ditutup setelah grace period default 1.500 ms.
- Setelah selesai, status menjadi `stopped`, port terlepas, dan startup baru dapat
  memakai port yang sama.
- CLI menangani SIGINT/SIGTERM. Private parent-process IPC `{ "type": "shutdown" }`
  juga tersedia untuk harness Windows, serta shutdown saat parent IPC disconnect.
- Tidak ada HTTP endpoint shutdown atau remote command API.
- Kontrak integrasi launcher native belum dikerjakan; Node IPC yang diuji tidak
  boleh dianggap sebagai implementasi komunikasi WinForms yang telah selesai.

## 4. Menjalankan tanpa launcher

Dari root repository pada mesin development (Node 22 yang dipakai verifikasi:
`22.20.0`):

```powershell
npm.cmd run build
npm.cmd run build:runtime
node .\dist-runtime\kocokan-server.cjs
```

Atau setelah kedua build tersedia:

```powershell
npm.cmd run start:server
```

URL: `http://127.0.0.1:47882/`.
Readiness: `http://127.0.0.1:47882/health`.
Hentikan server langsung di terminal dengan Ctrl+C.

Default web root adalah `../dist` relatif terhadap lokasi bundle, bukan working
directory shell. Untuk layout paket berbeda:

```powershell
node .\dist-runtime\kocokan-server.cjs --web-root "C:\path\Kocokan\web"
```

Output stdout satu baris JSON saat siap:

```json
{"type":"ready","origin":"http://127.0.0.1:47882","version":"0.0.0-packaging-pilot-p1"}
```

Saat shutdown selesai: `{"type":"stopped"}`. Startup gagal mengeluarkan pesan
stderr dan exit code 1. Tidak ada fallback ke Vite atau port lain.

Audience tetap memakai URL dari workflow aplikasi:

```text
http://127.0.0.1:47882/display?eventId=...&displayConfigurationId=...
```

P1 masih dijalankan dengan binary Node mesin development. Tidak membutuhkan npm
atau Vite saat bundle dieksekusi langsung, tetapi binary Node yang dibundel untuk
end-user belum menjadi deliverable tahap ini.

## 5. File implementasi

### Baru

- `server/display-realtime-vite-plugin.ts` — adapter dev/preview.
- `server/production-assets.ts` — validasi dan allow-list web assets.
- `server/local-server.ts` — HTTP server produksi dan lifecycle.
- `server/runtime-entry.ts` — CLI, readiness, shutdown.
- `vite.runtime.config.ts` — build bundle Node mandiri.
- `server/local-server.integration.test.ts` — HTTP, assets, WS, readiness, conflict,
  dan shutdown.
- `server/display-realtime-vite-plugin.integration.test.ts` — lifecycle dev/preview.
- `server/runtime-process.integration.test.ts` — proses bundle di luar repo.
- Dokumen ini.

### Diubah

- `server/display-realtime-hub.ts` — pemasangan/disposal reusable.
- `server/display-realtime-hub.integration.test.ts` — lokasi import adapter.
- `vite.config.ts` — lokasi import adapter.
- `package.json` — `build:runtime` dan `start:server`.
- `tsconfig.node.json` — include konfigurasi build runtime.
- `.gitignore`, `eslint.config.js` — generated `dist-runtime` diabaikan.

## 6. Hasil verifikasi

| Command/pemeriksaan | Hasil |
|---|---|
| Baseline `npm.cmd run lint` | PASS. |
| Baseline `npm.cmd run build` | PASS. |
| Baseline full suite, JSON reporter | Exit 1: 1.284 pass / 108 fail, 1.392 test, 175 file; juga ada timeout saat worker ditutup. |
| P1 `npm.cmd run lint` | PASS, termasuk source/test/config baru. |
| P1 `npm.cmd run build` | PASS; peringatan ukuran web chunk tetap ada. |
| P1 `npm.cmd run build:runtime` | PASS; bundle sekitar 158 kB, tanpa Vite runtime. |
| `npm.cmd run test -- server src/application/display-transport/websocket-transport.test.ts src/application/display-transport/wire-codec.test.ts --maxWorkers=2` | **PASS: 6 file / 18 test** pada source akhir. |
| Full suite P1 `--maxWorkers=2 --reporter=json` | Exit 1: 1.293 pass / 108 fail, 1.401 test, 176 file; tidak ada pesan worker termination timeout pada run ini. |
| Perbandingan failure baseline dengan full suite P1 | Seluruh 108 identitas test dan baris error pertama sama; tidak ada failure baru atau signature berubah pada run tersebut. |
| Smoke bundle dengan `dist` aplikasi asli | Root, health, Audience deep link, draw deep link, JS dan CSS entry memberi HTTP 200; shutdown exit 0. |
| Smoke konfigurasi Vite asli melalui `createServer()` | Root, Audience deep link, `/@vite/client`, dan `/src/main.tsx` memberi HTTP 200; server ditutup setelah verifikasi. Script `npm run dev` tetap `vite`. |
| `git diff --check` | PASS. |

Full suite P1 dimulai sebelum empat test baru untuk built-process dan Vite
dev/preview ditambahkan. Keempat test tersebut tercakup dan PASS dalam run
terfokus terakhir (18 test). Angka full suite tidak diklaim mencakup test yang
belum ditemukan saat run tersebut dimulai.

Test bundle mengompilasi runtime ke temporary directory di luar repository dan
menjalankannya tanpa project `node_modules`. Test ini memverifikasi real WS frames,
fixed-port conflict, shutdown IPC, port reuse, penolakan port override, dan startup
gagal jika aset hilang. Ini bukan clean-machine Windows acceptance karena binary
Node tetap berasal dari mesin development.

Report JSON lokal untuk penelusuran:

- `C:\Users\User\AppData\Local\Temp\kocokan-p1-baseline-tests.json`.
- `C:\Users\User\AppData\Local\Temp\kocokan-p1-final-tests.json`.

## 7. Known issues dan tahap berikutnya

- Full suite tetap FAIL dengan 108 kegagalan baseline; tidak diubah atau dilemahkan
  demi packaging. Lihat audit integration cleanup untuk konteks historis.
- Identitas failure dan baris pertama yang sama tidak membuktikan assertion
  sesudah titik kegagalan telah lolos.
- Data IndexedDB dari origin development tidak berpindah otomatis. Data pilot
  harus disiapkan di origin canonical dan browser/profile yang konsisten.
- Menutup browser tidak menghentikan server, tetapi controller draw tetap berada
  di browser; server tidak mengambil alih jalannya draw.
- Cache snapshot/gambar hub hanya di memori. Republish/reconnect dengan browser
  asli dan vMix sesudah restart tetap memerlukan acceptance.
- Browser visual/manual, vMix, clean machine tanpa development runtime, portable
  ZIP, bundling Node binary, dan WinForms belum diverifikasi/dikerjakan.
- Automated built-process test memakai port pilot tetap dan mengharuskan port
  47882 kosong sebelum test; test API server lain memakai port ephemeral terisolasi.
- Batas RAM web asset 256 MiB perlu ditinjau jika paket nantinya memuat media besar.

**P1 berhenti setelah server standalone dan test terkait PASS. Jangan mulai
WinForms dari status dokumen ini tanpa instruksi tahap berikutnya.**

Commit baseline sudah tersimpan. Perubahan implementasi P1 dan dokumen ini
ditinggalkan belum di-commit untuk review; working tree bersih yang disyaratkan
telah diverifikasi sebelum implementasi dimulai.
