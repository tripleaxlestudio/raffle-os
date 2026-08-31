# Kontrak Lokalisasi Bahasa Indonesia

## Status

**KONTRAK SLICE 11.2 — IMPLEMENTASI DAN BUKTI BROWSER BERJALAN**

Bahasa Indonesia (`id-ID`) adalah bahasa produksi bawaan untuk MVP pertama.
Kontrak ini hanya mengubah presentasi. Identitas domain, penyimpanan, audit,
transport, dan ekspor resmi tetap stabil.

## Glosarium yang disetujui

| Istilah internal/Inggris | Presentasi Bahasa Indonesia |
|---|---|
| Event | Acara |
| Participant | Peserta |
| Practice Mode | Mode Latihan |
| Live Mode | Mode Live |
| Live Draw (menu, judul, dan tautan) | Undian |
| Pending Results (menu, judul, dan tautan) | Hasil |
| Pending / Pending Confirmation | Menunggu Konfirmasi |
| Confirmed | Dikonfirmasi |
| Cancelled | Dibatalkan |
| redraw | undi ulang |
| replacement | pengganti |
| eligible pool | peserta memenuhi syarat |
| Audience Display | Tampilan Audiens |
| standby | siaga |
| blackout | layar hitam |
| History | Riwayat |
| audit | audit |
| recovery | pemulihan |
| export | ekspor |

`Live` dipertahankan sebagai istilah operasional yang dikenal, tetapi selalu
ditampilkan sebagai `Mode Live` bila menunjukkan mode. Nomor tiket tidak pernah
diterjemahkan atau diformat sebagai angka.

## Cakupan produksi

Wajib berbahasa Indonesia: navigasi Operator, halaman produksi, tindakan,
status, validasi, konfirmasi, peringatan destruktif, pemulihan, kesalahan,
toast, empty/loading state, petunjuk operasional, Tampilan Audiens, accessible
name, dan pengumuman live region. Diagnostik yang hanya tersedia melalui flag
development tidak termasuk release-language gate.

Inventaris source produksi yang diperiksa mencakup:

- shell, header, sidebar, error boundary, route error, dan startup recovery;
- Acara, kategori hadiah, impor Peserta, pengaturan undian, antrean/proses
  undian, verifikasi, undi ulang, Riwayat, dan Pengaturan;
- presentasi serta kontrol Tampilan Audiens; dan
- komponen bersama yang menyajikan status, konfirmasi, persistence, serta
  kelanjutan setup pada route produksi.

## Batas data dan kontrak

Hal berikut tidak boleh diterjemahkan: ID, nomor tiket, enum domain, action
audit, route, storage key, protocol field, nama channel, timestamp ISO yang
disimpan, dan record resmi. Formatter `id-ID` hanya dipakai saat menampilkan
tanggal, waktu, atau jumlah kepada pengguna.

Header CSV/XLSX versi 1 tetap dalam bentuk berversi saat ini. Slice 11.2 tidak
mengubah nama, urutan, atau semantik header. Header lokal hanya boleh dibuat
melalui versi ekspor baru dan keputusan produk terpisah.

## Pesan hilang

Katalog produksi bertipe di `src/shared/localization/production-locale.ts`.
Key yang tidak ada harus gagal pada typecheck; nilai kosong gagal pada pengujian
coverage. Tidak ada language switcher atau fallback UI bahasa Inggris pada
slice ini. Error teknis dari storage dapat dipertahankan sebagai detail, tetapi
bingkai tindakan, akibat, dan recovery guidance harus berbahasa Indonesia.

## Acceptance

- coverage katalog, formatter `id-ID`, accessible copy, dan invariansi kontrak
  data harus lulus otomatis;
- copy harus diperiksa pada Operator 1366 × 768 dan 1440 × 900 serta Tampilan
  Audiens 1920 × 1080 tanpa menyembunyikan tindakan kritis; dan
- B11-021 memerlukan hasil manual Chrome dan Edge sebelum gate lokalisasi dapat
  dinyatakan PASS.
