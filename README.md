# Kocokan

**Aplikasi undian acara yang berjalan lokal, dengan Panel Operator dan Tampilan Audiens terpisah.**

Dikembangkan oleh **Tripleaxle Studio**.

Kocokan membantu tim acara menyiapkan peserta dan hadiah, menjalankan undian berdasarkan nomor tiket, meninjau pemenang, dan menampilkan prosesnya di layar publik. Cocok untuk acara dengan proyektor, LED screen, atau keluaran browser yang ditangkap melalui vMix.

Operasional inti berjalan di komputer acara tanpa memerlukan koneksi internet. Data disimpan lokal; internet diperlukan untuk mengunduh aplikasi, memeriksa atau mengunduh pembaruan, dan membuka layanan dukungan daring.

[Unduh untuk Windows](https://github.com/tripleaxlestudio/raffle-os/releases/latest) · [Laporkan masalah](https://github.com/tripleaxlestudio/raffle-os/issues/new/choose) · [Panduan pengembangan](#pengembangan-lokal)

## Dua tampilan untuk dua peran

| Tampilan | Fungsi |
| --- | --- |
| **Panel Operator** | Menyiapkan acara, hadiah, peserta, aturan undian, tampilan, dan keputusan hasil. |
| **Tampilan Audiens** | Menampilkan nomor tiket dan presentasi undian pada layar acara, tanpa kontrol operator. |

Panel Operator ditargetkan untuk layar **1440 × 900**; Tampilan Audiens untuk **1920 × 1080, 16:9**. Kocokan menyediakan halaman Audiens untuk ditangkap perangkat AV; pengaturan vMix, proyektor, dan LED processor tetap dilakukan oleh tim acara.

## Fitur yang tersedia

- **Acara dan hadiah:** kelola acara aktif serta kategori hadiah, nama hadiah, sponsor, dan gambar.
- **Impor peserta:** CSV/XLSX dengan pemetaan kolom, pratinjau, dan validasi tiket kosong, duplikat, atau tidak valid. Nomor tiket disimpan sebagai teks agar nol di depan tetap terjaga.
- **Aturan kelayakan:** filter grup, kewajiban check-in, dan aturan kemenangan per acara atau kategori.
- **Latihan dan Live:** coba presentasi melalui Latihan tanpa mengubah kelayakan atau hasil resmi Live.
- **Undian:** pilih pemenang menggunakan Web Crypto API, dengan gaya Tampil Langsung atau Putar & Stop Manual.
- **Peninjauan hasil:** pemenang Live masuk sebagai hasil tertunda sebelum dikonfirmasi. Undi ulang memerlukan alasan dan mempertahankan catatan pemenang yang dibatalkan beserta hubungannya dengan pengganti.
- **Riwayat dan ekspor:** tinjau sesi Live dan ekspor hasil Live terkonfirmasi ke CSV/XLSX.
- **Pengaturan tampilan:** atur logo, tema, warna, latar, tipografi, dan presentasi Audiens.
- **Pemulihan dan bantuan:** penanganan sesi yang terputus, panduan penggunaan, pelaporan masalah, serta informasi lisensi.
- **Distribusi Windows:** installer dan paket portable, dengan launcher serta runtime yang dibundel.

Animasi putaran hanya menyajikan proses undian; animasi tidak menentukan hasil akhir.

## Memulai di Windows

1. Buka [halaman rilis](https://github.com/tripleaxlestudio/raffle-os/releases/latest).
2. Pilih installer `Kocokan-Setup-<versi>.exe`, atau ekstrak paket `Kocokan-Portable-<versi>.zip` untuk penggunaan portable.
3. Jalankan Kocokan melalui launcher. Aplikasi menggunakan browser Chrome atau Edge pada komputer yang sama.
4. Siapkan **Acara → Hadiah → Peserta → Pengaturan Tampilan → Pengaturan Undian**.
5. Buka Tampilan Audiens, jalankan Latihan, dan periksa keluaran layar sebelum memakai Live.

Distribusi Windows membundel runtime yang diperlukan. Pengguna tidak perlu memasang Node.js, npm, Laragon, atau .NET secara terpisah.

Alamat aplikasi terpasang dan portable adalah **`http://127.0.0.1:47882`**. Alamat ini menunjuk komputer yang menjalankan Kocokan; jangan menganggapnya sebagai alamat yang dapat diakses dari komputer lain.

## Data dan pembaruan

Data aplikasi disimpan di **IndexedDB pada profil browser dan alamat aplikasi yang digunakan**. Membuka aplikasi pada browser, profil, atau origin berbeda tidak otomatis membuka data yang sama. Menghapus data situs dapat menghapus data Kocokan. Gunakan backup manual melalui pengaturan Data & Penyimpanan sebelum acara bila diperlukan.

Kocokan tidak menyediakan sinkronisasi cloud. Operasional undian inti tidak bergantung pada layanan cloud.

Aplikasi terpasang memiliki pemeriksaan rilis stabil dan alur pembaruan dengan konfirmasi pengguna. Pembaruan dapat diblokir saat sesi atau Tampilan Audiens masih aktif. Mode portable tidak memasang pembaruan melalui alur aplikasi terpasang.

## Status dan batasan

Kocokan masih berada pada seri **0.1.x**. Versi source saat README ini diperbarui adalah **0.1.4**.

- Installer 0.1.4 belum ditandatangani secara digital; Windows dapat menampilkan peringatan SmartScreen.
- Publikasi installer dan verifikasi checksum tidak berarti upgrade pada instalasi pengguna sudah lolos uji. Penerimaan upgrade terpasang ke 0.1.4 masih menunggu verifikasi.
- Pemeriksaan lokal pada **5 Oktober 2026**: lint dan build berhasil; seluruh suite mencatat **1.496 tes berhasil dan 108 gagal dari 1.604 tes**. Suite belum lulus sepenuhnya.
- Kocokan tidak diklaim memiliki sertifikasi hukum atau audit eksternal.

Lihat [catatan installer dan verifikasi 0.1.4](docs/technical/KOCOKAN-V0.1.4-INSTALLER.md) untuk bukti rilis dan batas penerimaannya.

## Pengembangan lokal

Gunakan **Node.js 22.13 atau lebih baru dalam seri 22**, serta npm. Dari direktori repository:

```powershell
npm.cmd ci
npm.cmd run dev
```

Buka alamat yang ditampilkan server pengembangan. Alamat pengembangan dapat berbeda dari origin tetap distribusi Windows; data pada keduanya terpisah.

| Perintah | Fungsi |
| --- | --- |
| `npm.cmd run dev` | Menjalankan server pengembangan |
| `npm.cmd run build` | Memeriksa TypeScript dan membangun aplikasi web |
| `npm.cmd run build:runtime` | Membangun server lokal untuk distribusi |
| `npm.cmd run start:server` | Menjalankan server lokal yang sudah dibangun |
| `npm.cmd run lint` | Memeriksa kode dengan ESLint |
| `npm.cmd run typecheck` | Menjalankan pemeriksaan proyek TypeScript |
| `npm.cmd run test` | Menjalankan seluruh suite Vitest |
| `npm.cmd run test:watch` | Menjalankan tes dalam mode watch |

Stack utama: React 19, React Router 7, TypeScript 6 dengan strict mode, Vite 8, Tailwind CSS 4, Dexie/IndexedDB, dan WebSocket lokal. Distribusi Windows menggunakan launcher .NET serta runtime Node.js yang dibundel.

## Dokumentasi dan kontribusi

- [Persyaratan produk](docs/product/PRD.md)
- [Roadmap implementasi](TASKS.md)
- [Pengemasan Windows dan catatan penerimaan](docs/technical/KOCOKAN-PACKAGING-P4.md)
- [Installer dan verifikasi rilis 0.1.4](docs/technical/KOCOKAN-V0.1.4-INSTALLER.md)
- [Informasi komponen pihak ketiga](docs/legal/THIRD-PARTY-NOTICES.md)
- [Panduan perubahan kode](AGENTS.md)

Dokumen PRD dan roadmap awal memuat konteks perencanaan historis. Periksa source dan catatan penerimaan yang relevan sebelum menyimpulkan status implementasi.

Kontribusi harus menjaga nomor tiket sebagai string, pemilihan resmi melalui Web Crypto, pemisahan Latihan dan Live, serta riwayat resmi yang tidak ditimpa atau dihapus diam-diam. Baca `AGENTS.md` dan dokumentasi terkait sebelum mengubah perilaku produk.

Nama produk adalah **Kocokan**. Repository saat ini masih bernama `raffle-os`; beberapa nama internal dipertahankan untuk kompatibilitas data dan distribusi.

