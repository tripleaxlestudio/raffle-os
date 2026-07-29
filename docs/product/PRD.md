# Product Requirements Document — Raffle OS

## 1. Informasi Dokumen

| Atribut | Nilai |
|---|---|
| Nama produk | Raffle OS |
| Jenis dokumen | Product Requirements Document (PRD) awal |
| Versi | 0.1 |
| Status | Draf untuk validasi |
| Tanggal | 29 Juli 2026 |
| Bahasa | Indonesia |
| Platform target | Aplikasi web lokal untuk Chrome dan Edge desktop |
| Sumber persyaratan | Brief produk awal dan kondisi repositori saat dokumen dibuat |
| Pemilik produk | Belum ditentukan |

### 1.1 Tujuan dokumen

Dokumen ini menjadi acuan bersama untuk ruang lingkup, perilaku, integritas pengundian, model data, kriteria penerimaan, dan prioritas pengembangan MVP Raffle OS. Dokumen ini tidak menyatakan bahwa fitur-fitur tersebut sudah diimplementasikan.

### 1.2 Kondisi awal repositori

Pada saat PRD ini dibuat, repositori masih berupa scaffold React, TypeScript, dan Vite. Karena itu, seluruh kemampuan produk di bawah merupakan persyaratan yang harus dibangun dan diverifikasi.

---

## 2. Ringkasan Eksekutif

Raffle OS adalah aplikasi web **local-first** untuk menjalankan undian acara berbasis nomor tiket. Produk memisahkan **Panel Operator**, yang berisi konfigurasi dan kontrol operasional, dari **Tampilan Audiens**, yang menampilkan proses undian secara fullscreen melalui layar LED, proyektor, atau tangkapan vMix.

MVP harus tetap dapat digunakan tanpa koneksi internet. Data acara, peserta, sesi undian, dan riwayat resmi disimpan secara lokal di browser. Operator dapat mengimpor peserta dari CSV atau XLSX, menetapkan aturan kelayakan dan hadiah, menjalankan pengundian yang adil, memverifikasi hasil tertunda, mengonfirmasi atau mengundi ulang pemenang, serta mengekspor hasil akhir.

Integritas hasil merupakan prinsip utama. Pemilihan pemenang harus menggunakan Web Crypto API dan metode acak tanpa bias; animasi visual tidak boleh menentukan hasil akhir. Setiap pengundian Live harus menyimpan snapshot pool yang memenuhi syarat, filter aktif, waktu, hasil, status konfirmasi, alasan pembatalan, dan hubungan pemenang pengganti.

---

## 3. Latar Belakang dan Pernyataan Masalah

Operasi undian acara sering dijalankan dalam situasi bertekanan tinggi, dengan waktu terbatas, koneksi internet yang tidak dapat diandalkan, dan tuntutan transparansi di hadapan audiens. Pengelolaan peserta menggunakan spreadsheet saja mudah menimbulkan masalah seperti:

- nomor tiket dengan nol di depan berubah menjadi angka;
- data kosong atau duplikat masuk ke pool;
- peserta yang tidak memenuhi syarat tetap terpilih;
- pemenang terpilih lebih dari sekali;
- proses penggantian pemenang tidak memiliki jejak audit;
- layar operator atau data internal terlihat oleh audiens;
- hasil hilang setelah refresh atau gangguan browser; dan
- animasi visual dianggap sebagai sumber hasil acak.

Raffle OS diperlukan sebagai alat operasi lokal yang menggabungkan pengelolaan data, kontrol siaran, pemilihan acak yang dapat dipertanggungjawabkan, verifikasi hasil, dan riwayat yang tidak ditimpa secara diam-diam.

---

## 4. Tujuan Produk

### 4.1 Tujuan utama

1. Memungkinkan operator menjalankan alur undian lengkap tanpa internet.
2. Menjaga nomor tiket sebagai string dari impor hingga ekspor, termasuk nol di depan.
3. Mencegah peserta tidak layak, duplikat, atau pemenang berulang masuk ke hasil yang tidak semestinya.
4. Memisahkan kontrol internal dari presentasi publik.
5. Memungkinkan pemilihan banyak pemenang dalam satu pengundian dengan hasil di bawah satu detik pada laptop acara tipikal.
6. Menyediakan verifikasi, konfirmasi, pengundian ulang, dan jejak audit yang jelas.
7. Memulihkan sesi tertunda setelah refresh agar operasi acara dapat dilanjutkan.
8. Memberikan perbedaan yang tidak ambigu antara Practice Mode dan Live Mode.

### 4.2 Prinsip produk

- **Local-first:** fungsi inti tidak bergantung pada jaringan atau layanan eksternal.
- **Integritas sebelum efek visual:** hasil akhir dipilih secara independen dari animasi.
- **Aman untuk siaran:** Tampilan Audiens hanya menunjukkan informasi publik yang diperlukan.
- **Operasi eksplisit:** tindakan Live atau destruktif memerlukan konfirmasi yang jelas.
- **Riwayat dapat ditelusuri:** hasil resmi tidak dihapus atau ditimpa secara diam-diam.
- **Satu aksi utama:** setiap layar mengarahkan operator pada satu tindakan primer yang jelas.

---

## 5. Metrik Keberhasilan

Metrik berikut adalah target penerimaan produk, bukan klaim kondisi saat ini.

| Area | Metrik | Target MVP | Cara verifikasi |
|---|---|---:|---|
| Kinerja data | Jumlah peserta per acara | Minimal 10.000 | Uji dataset representatif |
| Kinerja draw | Waktu pemilihan hasil akhir | < 1 detik untuk hingga 100 pemenang, di luar animasi | Pengukuran pada laptop acara tipikal |
| Kapasitas draw | Pemenang dalam satu draw | Hingga 100 | Uji batas |
| Ketepatan tiket | Nol di depan terjaga | 100% dari impor, tampilan, riwayat, hingga ekspor | Uji round-trip |
| Integritas | Duplikat dalam satu draw | 0 | Unit test dan uji integrasi |
| Integritas | `Math.random` dipakai untuk hasil akhir | 0 penggunaan | Review kode dan test |
| Kelayakan | Pemenang di luar snapshot eligible | 0 | Unit test dan audit hasil |
| Ketahanan | Data penting bertahan setelah refresh | 100% untuk skenario penerimaan | Uji refresh dan pemulihan |
| Isolasi mode | Practice mengubah riwayat/eligibilitas Live | 0 kejadian | Uji regresi |
| Audit | Redraw Live tanpa alasan | 0 | Validasi UI dan domain |
| Offline | Alur inti dapat selesai tanpa internet | 100% skenario inti | Uji browser dalam kondisi offline |
| Kompatibilitas | Browser desktop | Chrome dan Edge versi terkini | Matriks uji kompatibilitas |

Definisi “laptop acara tipikal” harus dibakukan sebelum uji penerimaan performa; lihat Pertanyaan Terbuka.

---

## 6. Pengguna dan Peran

MVP tidak memiliki login, autentikasi, atau sistem role berbasis akun. “Peran” di bawah menggambarkan tanggung jawab pengguna, bukan kontrol akses teknis.

| Peran | Kebutuhan utama | Tugas utama |
|---|---|---|
| Operator acara | Kontrol cepat, aman, dan jelas saat acara berlangsung | Membuka acara, mengoperasikan Tampilan Audiens, memulai draw, memverifikasi, mengonfirmasi, melakukan redraw, dan mengaktifkan blackout |
| Penyelenggara acara | Data peserta, hadiah, aturan, dan branding yang benar | Mengimpor dan memvalidasi peserta, mengatur kategori/hadiah, memilih aturan kelayakan, serta menyiapkan logo, latar, warna, dan audio opsional |
| Audiens | Hasil yang mudah dibaca dan pengalaman undian yang meyakinkan | Melihat standby, countdown, rolling, reveal, hasil terkonfirmasi, blackout, atau status aman saat koneksi antartampilan terputus |

Satu orang dapat menjalankan tanggung jawab operator dan penyelenggara pada acara yang sama.

---

## 7. Asumsi dan Batasan

### 7.1 Asumsi

1. Aplikasi dijalankan di satu perangkat operator melalui browser desktop.
2. Panel Operator dan Tampilan Audiens berada pada origin browser yang sama agar dapat berkomunikasi melalui BroadcastChannel.
3. Peserta diidentifikasi secara unik dalam konteks acara oleh nomor tiket yang sudah dinormalisasi sebagai string.
4. File CSV/XLSX disiapkan oleh penyelenggara dan minimal memiliki satu kolom nomor tiket.
5. Konfirmasi kehadiran pemenang dilakukan secara operasional oleh operator; MVP tidak menyediakan QR check-in.
6. “Satu peserta hanya boleh menang sekali” diterapkan berdasarkan identitas record peserta/nomor tiket dalam satu acara.
7. Zona waktu yang ditampilkan mengikuti waktu lokal perangkat, sementara timestamp harus disimpan dalam format yang tidak ambigu.
8. Branding dan audio berasal dari file lokal yang dipilih pengguna; produk tidak mengambil aset dari layanan cloud.
9. Practice Mode dapat meniru seluruh presentasi draw, tetapi tidak menghasilkan catatan resmi atau mengubah eligibilitas Live.
10. Ekspor final mencakup hasil resmi yang sudah dikonfirmasi; hasil Pending atau pemenang yang dibatalkan tetap tersedia dalam audit, tetapi tidak dianggap hasil final.

### 7.2 Batasan

- Tidak ada backend, basis data cloud, sinkronisasi lintas perangkat, atau autentikasi pada MVP.
- Ketahanan data mengikuti kapasitas dan kebijakan penyimpanan browser lokal.
- Penutupan seluruh tab, penghapusan data situs, mode private/incognito, atau kerusakan perangkat dapat menghilangkan data lokal.
- BroadcastChannel menghubungkan konteks browser lokal; mekanisme ini bukan komunikasi jaringan.
- Target desain utama Panel Operator adalah 1440 × 900.
- Target desain utama Tampilan Audiens adalah 1920 × 1080 dengan rasio 16:9.
- Resolusi LED kustom dipertimbangkan setelah kebutuhan dasarnya tervalidasi.

---

## 8. Ruang Lingkup MVP

### 8.1 Pengelolaan acara

- Membuat acara baru.
- Membuka acara yang tersimpan secara lokal.
- Menyimpan perubahan penting secara otomatis.
- Menyimpan preferensi ringan terpisah dari data domain.

### 8.2 Data peserta

- Impor CSV dan XLSX.
- Preview data dan pemetaan kolom sebelum impor.
- Kolom wajib: nomor tiket.
- Kolom opsional: nama peserta, status check-in, grup, dan catatan.
- Validasi nilai kosong, nomor tiket duplikat, dan baris tidak valid.
- Mode impor mengganti atau menggabungkan data.
- Filter peserta eligible sebelum pengundian.

### 8.3 Konfigurasi dan pelaksanaan draw

- Kategori hadiah, nama hadiah, jumlah pemenang, dan aturan kelayakan.
- Preset jumlah pemenang 1, 3, 6, 10, 20, dan 50 serta nilai kustom hingga 100.
- Opsi mewajibkan check-in.
- Aturan kemenangan: sekali per acara sebagai default, boleh menang lagi, atau sekali per kategori.
- Tampilan jumlah peserta eligible secara aktual.
- Pemblokiran start bila pool lebih kecil dari jumlah pemenang.
- Countdown, rolling, dan reveal untuk banyak pemenang dalam satu draw.

### 8.4 Verifikasi, konfirmasi, dan redraw

- Hasil awal berstatus Pending.
- Konfirmasi seluruh atau sebagian pemenang.
- Pemilihan satu atau beberapa pemenang untuk redraw.
- Alasan redraw wajib pada Live Mode.
- Pemenang yang dibatalkan tetap berada di audit trail.
- Hubungan pemenang yang dibatalkan dengan penggantinya tersimpan.

### 8.5 Panel Operator dan Tampilan Audiens

- Area Panel Operator: Dashboard, Participants, Draw Setup, Live Draw, Pending Verification, Redraw, Draw History, dan Settings.
- Pembukaan Tampilan Audiens pada jendela atau tab terpisah.
- Status koneksi Tampilan Audiens.
- Kontrol blackout.
- Mode Practice dan Live yang dibedakan secara visual dan perilaku.
- Layout responsif untuk jumlah pemenang utama.

### 8.6 Penyimpanan, riwayat, dan ekspor

- IndexedDB untuk acara, peserta, sesi, dan riwayat.
- localStorage hanya untuk preferensi ringan.
- BroadcastChannel untuk sinkronisasi Panel Operator dan Tampilan Audiens.
- Pemulihan sesi Pending setelah refresh.
- Ekspor hasil final ke CSV atau XLSX.
- Backup dan restore acara dapat ditempatkan pada milestone MVP lanjutan setelah format dan kebutuhannya diputuskan.

---

## 9. Di Luar Ruang Lingkup MVP

Fitur berikut tidak boleh diasumsikan sebagai bagian dari MVP:

- pendaftaran online;
- QR check-in;
- basis data cloud;
- login, autentikasi, dan role multi-pengguna;
- remote control melalui perangkat seluler;
- integrasi platform ticketing;
- integrasi WhatsApp;
- voting online;
- klaim hadiah digital; dan
- audit eksternal berstandar legal.

---

## 10. Perjalanan Pengguna End-to-End

### 10.1 Persiapan acara

1. Penyelenggara membuat acara baru atau membuka acara lokal yang sudah ada.
2. Penyelenggara mengimpor file CSV/XLSX.
3. Sistem menampilkan preview, mendeteksi kandidat kolom, dan meminta pemetaan kolom.
4. Sistem memvalidasi nomor tiket kosong, duplikat, dan baris tidak valid tanpa mengubah nomor tiket menjadi angka.
5. Penyelenggara memilih untuk mengganti data peserta atau menggabungkannya.
6. Sistem menampilkan ringkasan hasil impor sebelum komit.
7. Penyelenggara menetapkan branding acara dan, bila digunakan, audio lokal.

### 10.2 Konfigurasi draw

1. Operator memilih Practice atau Live Mode.
2. Operator mengisi kategori hadiah, nama hadiah, dan jumlah pemenang.
3. Operator memilih aturan kemenangan dan filter kelayakan, termasuk opsi wajib check-in.
4. Sistem menghitung serta menampilkan jumlah peserta eligible.
5. Sistem memblokir draw bila jumlah eligible tidak mencukupi.

### 10.3 Persiapan siaran

1. Operator membuka Tampilan Audiens di jendela atau tab terpisah.
2. Sistem menunjukkan status terhubung pada Panel Operator.
3. Tampilan Audiens masuk ke status standby dan menampilkan branding publik.
4. Operator dapat menguji blackout dan alur presentasi di Practice Mode.

### 10.4 Pengundian

1. Operator melakukan konfirmasi tambahan atau hold-to-start untuk Live draw.
2. Sistem membekukan snapshot pool eligible dan filter aktif.
3. Sistem memilih hasil akhir menggunakan Web Crypto API.
4. Tampilan Audiens menjalankan countdown dan rolling yang tidak memengaruhi hasil.
5. Sistem melakukan reveal seluruh pemenang pada draw tersebut.
6. Panel Operator menerima hasil berstatus Pending.

### 10.5 Verifikasi dan penyelesaian

1. Operator memverifikasi pemenang tanpa menampilkan data internal di Tampilan Audiens.
2. Operator mengonfirmasi semua atau sebagian pemenang.
3. Jika ada pemenang tidak valid/absen, operator memilih satu atau beberapa pemenang untuk redraw dan mengisi alasan pada Live Mode.
4. Sistem menyimpan pembatalan, alasan, dan hubungan ke pemenang pengganti.
5. Ketika aturan satu kemenangan aktif, pemenang yang dikonfirmasi dikeluarkan dari pool draw selanjutnya.
6. Operator meninjau riwayat dan mengekspor hasil final.

### 10.6 Pemulihan gangguan

1. Jika Panel Operator di-refresh saat hasil masih Pending, sistem memuat sesi tersebut dari IndexedDB.
2. Jika BroadcastChannel terputus, Tampilan Audiens masuk ke disconnected-safe state tanpa menampilkan kontrol atau data internal.
3. Setelah koneksi pulih, keadaan presentasi diselaraskan kembali tanpa membuat draw baru atau mengganti hasil yang sudah dipilih.

---

## 11. Persyaratan Fungsional Terperinci

Kata **harus** menunjukkan persyaratan wajib. Setiap ID digunakan untuk penelusuran ke kriteria penerimaan.

### 11.1 Acara dan penyimpanan

| ID | Persyaratan |
|---|---|
| FR-EVT-001 | Sistem harus memungkinkan pengguna membuat acara baru dengan identitas lokal yang unik. |
| FR-EVT-002 | Sistem harus memungkinkan pengguna membuka acara yang sudah tersimpan pada browser yang sama. |
| FR-EVT-003 | Sistem harus melakukan autosave atas perubahan penting tanpa memerlukan koneksi internet. |
| FR-EVT-004 | Sistem harus menyimpan acara, peserta, sesi, dan riwayat di IndexedDB. |
| FR-EVT-005 | Sistem hanya boleh menggunakan localStorage untuk preferensi ringan, bukan untuk dataset peserta atau riwayat resmi. |
| FR-EVT-006 | Sistem harus memulihkan sesi draw Pending setelah refresh. |

### 11.2 Impor dan pengelolaan peserta

| ID | Persyaratan |
|---|---|
| FR-IMP-001 | Sistem harus menerima file CSV dan XLSX. |
| FR-IMP-002 | Sistem harus menampilkan preview baris dan pemetaan kolom sebelum data diimpor. |
| FR-IMP-003 | Nomor tiket harus menjadi satu-satunya kolom wajib. |
| FR-IMP-004 | Nama, status check-in, grup, dan catatan harus tersedia sebagai kolom opsional. |
| FR-IMP-005 | Nomor tiket harus diperlakukan sebagai string pada pembacaan, validasi, penyimpanan, tampilan, draw, dan ekspor. |
| FR-IMP-006 | Sistem harus mempertahankan nol di depan pada nomor tiket. |
| FR-IMP-007 | Sistem harus mendeteksi nomor tiket kosong, duplikat, dan baris tidak valid serta menjelaskan masalah per baris. |
| FR-IMP-008 | Baris tidak valid tidak boleh masuk ke pool eligible tanpa koreksi atau keputusan eksplisit yang valid. |
| FR-IMP-009 | Pengguna harus dapat memilih mode replace atau merge sebelum komit impor. |
| FR-IMP-010 | Pada mode replace, sistem harus meminta konfirmasi eksplisit sebelum mengganti data peserta acara. |
| FR-IMP-011 | Pada mode merge, sistem harus mencegah terciptanya nomor tiket duplikat. |
| FR-IMP-012 | Sistem harus menampilkan ringkasan jumlah baris valid, invalid, kosong, dan duplikat sebelum komit. |

### 11.3 Kelayakan dan konfigurasi draw

| ID | Persyaratan |
|---|---|
| FR-DRW-001 | Konfigurasi draw harus memuat nama kategori hadiah, nama hadiah, jumlah pemenang, dan aturan kelayakan. |
| FR-DRW-002 | Sistem harus menyediakan preset 1, 3, 6, 10, 20, dan 50 serta jumlah kustom 1–100. |
| FR-DRW-003 | Sistem harus mendukung filter berdasarkan data peserta yang tersedia, termasuk check-in dan grup. |
| FR-DRW-004 | Sistem harus menyediakan opsi untuk mewajibkan check-in. |
| FR-DRW-005 | Aturan default harus membatasi satu peserta untuk menang sekali dalam satu acara. |
| FR-DRW-006 | Sistem harus mendukung aturan boleh menang lagi dan sekali per kategori. |
| FR-DRW-007 | Sistem harus menghitung dan menampilkan jumlah peserta eligible setelah seluruh filter serta aturan kemenangan diterapkan. |
| FR-DRW-008 | Sistem harus mencegah start jika jumlah eligible lebih kecil daripada jumlah pemenang. |
| FR-DRW-009 | Sistem harus mencegah satu peserta terpilih dua kali dalam draw yang sama. |
| FR-DRW-010 | Live draw harus menggunakan konfirmasi tambahan atau interaksi hold-to-start. |
| FR-DRW-011 | Sebelum hasil dipilih, sistem harus membekukan snapshot pool eligible dan konfigurasi aktif untuk sesi tersebut. |

### 11.4 Mode Practice dan Live

| ID | Persyaratan |
|---|---|
| FR-MOD-001 | Panel Operator harus membedakan Practice Mode dan Live Mode secara visual dengan jelas. |
| FR-MOD-002 | Practice Mode tidak boleh mengubah eligibilitas Live. |
| FR-MOD-003 | Practice Mode tidak boleh menulis hasil ke riwayat final/resmi. |
| FR-MOD-004 | Live Mode harus menulis hasil, perubahan status, dan audit redraw ke penyimpanan resmi lokal. |
| FR-MOD-005 | Peralihan mode yang dapat memengaruhi alur aktif harus meminta konfirmasi. |

### 11.5 Panel Operator

| ID | Persyaratan |
|---|---|
| FR-OPS-001 | Panel Operator harus menyediakan Dashboard, Participants, Draw Setup, Live Draw, Pending Verification, Redraw, Draw History, dan Settings. |
| FR-OPS-002 | Panel Operator harus menampilkan status koneksi Tampilan Audiens. |
| FR-OPS-003 | Panel Operator harus memiliki kontrol blackout. |
| FR-OPS-004 | Tindakan Live dan tindakan destruktif harus meminta konfirmasi eksplisit. |
| FR-OPS-005 | Informasi internal peserta hanya boleh tersedia di Panel Operator. |
| FR-OPS-006 | Setiap layar harus memiliki satu tindakan utama yang paling menonjol sesuai konteksnya. |

### 11.6 Tampilan Audiens

| ID | Persyaratan |
|---|---|
| FR-AUD-001 | Tampilan Audiens harus dapat dibuka di jendela atau tab terpisah. |
| FR-AUD-002 | Tampilan Audiens harus mendukung penggunaan fullscreen untuk LED, proyektor, atau tangkapan vMix. |
| FR-AUD-003 | Tampilan Audiens tidak boleh menampilkan kontrol operator atau data peserta internal. |
| FR-AUD-004 | Tampilan Audiens harus memiliki state standby, countdown, rolling, winner reveal, confirmed, blackout, dan disconnected-safe. |
| FR-AUD-005 | Nomor tiket harus menjadi elemen visual paling dominan pada reveal dan confirmed. |
| FR-AUD-006 | Layout utama harus mendukung 1 pemenang sebagai hero tunggal, 6 sebagai 3 × 2, 10 sebagai 5 × 2, dan 20 sebagai 5 × 4. |
| FR-AUD-007 | Layout harus tetap dapat menampilkan preset lain dan jumlah kustom hingga 100 secara terbaca sesuai keterbatasan layar. |
| FR-AUD-008 | Branding harus mendukung logo, gambar latar, dan warna; audio bersifat opsional. |
| FR-AUD-009 | Komunikasi state dari Panel Operator harus menggunakan BroadcastChannel. |
| FR-AUD-010 | Saat kanal terputus, Tampilan Audiens harus masuk ke disconnected-safe state dan tidak mengarang hasil atau melanjutkan ke hasil baru. |

### 11.7 Hasil, konfirmasi, dan redraw

| ID | Persyaratan |
|---|---|
| FR-RES-001 | Semua hasil baru harus berstatus Pending sebelum keputusan operator. |
| FR-RES-002 | Operator harus dapat mengonfirmasi semua pemenang Pending sekaligus. |
| FR-RES-003 | Operator harus dapat mengonfirmasi pemenang Pending secara individual. |
| FR-RES-004 | Operator harus dapat memilih satu atau beberapa pemenang untuk redraw. |
| FR-RES-005 | Live redraw harus mewajibkan alasan: absent, invalid ticket, ineligible, previous winner, operator error, atau other. |
| FR-RES-006 | Jika alasan other dipilih, sistem harus meminta keterangan teks. |
| FR-RES-007 | Pemenang yang dibatalkan harus tetap tersimpan di audit trail. |
| FR-RES-008 | Sistem harus menyimpan hubungan eksplisit antara pemenang yang dibatalkan dan pemenang penggantinya. |
| FR-RES-009 | Redraw hanya boleh memilih dari pool yang valid setelah peserta yang dibatalkan dan seluruh peserta yang tidak lagi eligible dikeluarkan sesuai aturan aktif. |
| FR-RES-010 | Pemenang Confirmed harus menjadi tidak eligible untuk draw berikutnya bila aturan sekali menang yang relevan aktif. |
| FR-RES-011 | Konfirmasi sebagian harus mempertahankan pemenang lain sebagai Pending sampai dikonfirmasi atau dibatalkan. |

### 11.8 Riwayat dan ekspor

| ID | Persyaratan |
|---|---|
| FR-HIS-001 | Setiap Live draw harus menyimpan ID sesi, kategori, hadiah, tanggal/waktu, mode, jumlah eligible, jumlah pemenang, nomor tiket pemenang, dan status konfirmasi. |
| FR-HIS-002 | Riwayat harus menyimpan alasan pembatalan dan hubungan pengganti untuk setiap redraw. |
| FR-HIS-003 | Sistem tidak boleh menghapus atau menimpa diam-diam riwayat resmi. |
| FR-HIS-004 | Pengguna harus dapat meninjau urutan draw, konfirmasi, pembatalan, dan penggantian. |
| FR-HIS-005 | Sistem harus dapat mengekspor hasil final ke CSV atau XLSX. |
| FR-HIS-006 | Ekspor harus mempertahankan nomor tiket sebagai string, termasuk nol di depan. |

---

## 12. Persyaratan Integritas Draw dan Keacakan

### 12.1 Sumber dan metode acak

1. Pemilihan pemenang final harus menggunakan `crypto.getRandomValues()` dari Web Crypto API sebagai sumber entropi.
2. `Math.random()` tidak boleh digunakan pada jalur kode pemilihan pemenang final.
3. Sistem harus memakai secure Fisher–Yates shuffle atau metode ekuivalen yang dapat dibuktikan tidak bias.
4. Konversi bilangan acak ke rentang indeks harus menghindari modulo bias, misalnya melalui rejection sampling.
5. Algoritma harus memilih tanpa replacement sehingga satu peserta tidak dapat muncul dua kali dalam draw yang sama.

### 12.2 Pemisahan hasil dan presentasi

- Hasil final harus dipilih dari snapshot eligible yang dibekukan sebelum animasi reveal.
- Countdown, rolling, suara, durasi animasi, frame rate, atau item visual yang ditampilkan tidak boleh memengaruhi hasil.
- Mengulang animasi tidak boleh menghasilkan pemilihan ulang.
- Tampilan Audiens hanya menerima state dan hasil yang sudah ditentukan oleh domain draw.

### 12.3 Rekaman setiap Live draw

Setiap Live draw harus menyimpan setidaknya:

- ID sesi draw;
- ID acara;
- kategori dan hadiah;
- timestamp pemilihan;
- mode;
- snapshot peserta eligible atau referensi snapshot yang dapat direkonstruksi secara utuh;
- jumlah peserta eligible;
- filter dan aturan kemenangan aktif;
- jumlah pemenang yang diminta;
- pemenang yang dipilih;
- status setiap pemenang;
- urutan serta alasan redraw; dan
- hubungan pemenang lama dengan pemenang pengganti.

### 12.4 Batas klaim audit

MVP menyediakan audit trail operasional lokal, bukan audit eksternal berstandar legal. Produk tidak boleh mengklaim sertifikasi, verifikasi pihak ketiga, atau keamanan terhadap manipulasi perangkat oleh pihak yang memiliki akses penuh ke browser dan sistem operasi.

---

## 13. Entitas Data dan Definisi Status

### 13.1 Entitas utama

| Entitas | Tujuan | Atribut minimum |
|---|---|---|
| Event | Konteks satu acara undian | `eventId`, nama, waktu dibuat/diubah, branding, preferensi acara |
| Participant | Record peserta yang dapat dinilai eligibilitasnya | `participantId`, `eventId`, `ticketNumber` sebagai string, nama opsional, check-in, grup, catatan, status validasi |
| ImportSession | Rekaman proses impor sebelum/ketika dikomit | `importId`, nama file, jenis file, mapping, mode replace/merge, ringkasan validasi, timestamp |
| PrizeConfiguration | Konfigurasi hadiah untuk draw | `categoryId`, nama kategori, nama hadiah, jumlah pemenang, filter, aturan kemenangan |
| DrawSession | Satu operasi pemilihan awal | `drawSessionId`, `eventId`, konfigurasi, mode, snapshot eligible, timestamp, status sesi |
| WinnerRecord | Hasil untuk satu slot pemenang | `winnerRecordId`, `drawSessionId`, participant/ticket, urutan, status, waktu konfirmasi |
| RedrawRecord | Audit penggantian satu pemenang | `redrawId`, winner asal, winner pengganti, alasan, catatan opsional, timestamp |
| DisplayState | State presentasi yang dikirim ke Tampilan Audiens | state, ID sesi terkait, payload publik, waktu pembaruan |
| Preference | Preferensi UI ringan | kunci, nilai, waktu pembaruan |

Nama atribut di atas bersifat konseptual; implementasi boleh menggunakan penamaan berbeda selama makna dan relasinya dipertahankan.

### 13.2 Definisi status peserta

| Status | Arti |
|---|---|
| Valid | Baris peserta lolos validasi dasar dan dapat dievaluasi oleh aturan eligibility |
| Invalid | Baris gagal validasi dan tidak boleh masuk pool |
| Eligible | Peserta memenuhi seluruh filter dan aturan untuk draw tertentu |
| Ineligible | Peserta tidak memenuhi satu atau lebih filter/aturan untuk draw tertentu |

`Eligible` dan `Ineligible` bersifat hasil perhitungan pada konteks draw, bukan status permanen yang menggantikan data sumber.

### 13.3 Definisi status sesi draw

| Status | Arti |
|---|---|
| Draft | Konfigurasi belum dijalankan |
| Running | Presentasi draw sedang berlangsung |
| Pending Verification | Hasil sudah dipilih tetapi keputusan operator belum selesai |
| Partially Confirmed | Sebagian hasil dikonfirmasi dan sebagian masih Pending |
| Completed | Seluruh slot hasil telah dikonfirmasi atau diselesaikan melalui redraw |
| Interrupted | Sesi aktif terganggu dan harus dipulihkan sebelum tindakan berikutnya |

### 13.4 Definisi status pemenang

| Status | Arti | Dampak |
|---|---|---|
| Pending | Terpilih, belum diputuskan | Belum menjadi hasil final |
| Confirmed | Disetujui operator | Menjadi hasil final dan memengaruhi eligibility sesuai aturan |
| Cancelled | Dibatalkan dengan alasan | Tetap ada di audit, bukan hasil final |
| Replaced | Cancelled dan sudah memiliki pengganti | Menunjuk ke WinnerRecord pengganti |

### 13.5 Definisi state Tampilan Audiens

| State | Perilaku publik |
|---|---|
| Standby | Menampilkan identitas/branding acara dan menunggu draw |
| Countdown | Menampilkan hitung mundur |
| Rolling | Menampilkan animasi kandidat tanpa menentukan hasil |
| Winner Reveal | Mengungkap nomor tiket terpilih |
| Confirmed | Menampilkan hasil yang telah dikonfirmasi sesuai arahan operator |
| Blackout | Menampilkan layar gelap/aman |
| Disconnected-safe | Menampilkan keadaan aman saat komunikasi antartampilan terputus tanpa memperlihatkan data internal |

---

## 14. State Kesalahan dan Pemulihan

| Skenario | Perilaku yang diharapkan | Pemulihan |
|---|---|---|
| File bukan CSV/XLSX yang didukung | Impor ditolak dengan pesan yang jelas | Pilih file yang didukung |
| File tidak dapat dibaca | Tidak ada data dikomit | Coba file lain; data sebelumnya tetap utuh |
| Kolom tiket belum dipetakan | Tombol komit dinonaktifkan | Petakan kolom nomor tiket |
| Tiket kosong/duplikat/baris invalid | Baris ditandai dan dihitung | Perbaiki sumber atau keluarkan baris invalid sebelum komit |
| Konflik duplikat saat merge | Record konflik tidak diduplikasi | Tampilkan konflik dan ringkasan hasil merge |
| Pool eligible kosong | Start diblokir | Ubah filter, data, atau aturan |
| Pool eligible lebih kecil dari jumlah pemenang | Start diblokir dan selisih ditampilkan | Kurangi jumlah pemenang atau tambah eligible |
| Web Crypto tidak tersedia/gagal | Draw tidak boleh menghasilkan fallback dari `Math.random` | Hentikan draw dan tampilkan kesalahan yang dapat ditindaklanjuti |
| Refresh sebelum draw dimulai | Konfigurasi tersimpan dipulihkan | Lanjutkan dari draft terakhir |
| Refresh setelah hasil dipilih tetapi masih Pending | Hasil yang sama dipulihkan | Lanjutkan verifikasi; jangan memilih ulang |
| BroadcastChannel terputus | Tampilan Audiens masuk disconnected-safe | Sambungkan/buka ulang display lalu sinkronkan state |
| Popup/jendela display diblokir browser | Panel Operator menjelaskan bahwa display belum terbuka | Pengguna mengizinkan popup atau membuka tab secara manual |
| Audio gagal dimuat/diputar | Draw tetap dapat berjalan secara visual | Beri peringatan non-blocking dan opsi lanjut tanpa audio |
| Penyimpanan lokal gagal atau kuota penuh | Operasi yang membutuhkan persistensi Live diblokir | Informasikan risiko dan minta pengguna membebaskan ruang sebelum melanjutkan |
| Aplikasi ditutup saat sesi Running | State terakhir yang aman ditandai Interrupted | Pulihkan ke verifikasi/keadaan aman tanpa membuat hasil baru |
| Redraw Live tanpa alasan | Aksi diblokir | Pilih alasan dan isi catatan bila `other` |
| Ekspor gagal | Riwayat lokal tidak berubah | Tampilkan kesalahan dan izinkan mencoba kembali |

Tidak ada state kesalahan yang boleh menghapus data resmi atau memilih hasil baru secara diam-diam.

---

## 15. Persyaratan Nonfungsional

### 15.1 Kinerja dan skala

- Sistem harus mendukung minimal 10.000 peserta dalam satu acara.
- Sistem harus mendukung hingga 100 pemenang dalam satu draw.
- Seleksi hasil akhir harus selesai dalam waktu kurang dari satu detik pada laptop acara tipikal, di luar waktu animasi.
- Interaksi Panel Operator harus tetap responsif saat menghitung filter untuk dataset target.

### 15.2 Ketahanan dan offline

- Seluruh alur inti harus berfungsi tanpa internet setelah aplikasi tersedia pada perangkat.
- Data penting harus bertahan setelah refresh.
- Autosave tidak boleh merusak record terakhir yang valid.
- Pemulihan tidak boleh mengganti hasil draw yang sudah dipilih.

### 15.3 Kompatibilitas

- Mendukung versi desktop terkini Chrome dan Edge.
- Panel Operator dioptimalkan untuk 1440 × 900.
- Tampilan Audiens dioptimalkan untuk 1920 × 1080, 16:9.
- Layout harus menurun secara wajar pada viewport desktop lain tanpa menyembunyikan aksi kritis.

### 15.4 Arsitektur dan kualitas kode

- Implementasi menggunakan TypeScript strict mode.
- Penggunaan tipe `any` harus dihindari.
- Logika domain, termasuk randomisasi, eligibility, status, konfirmasi, dan redraw, harus dipisahkan dari komponen React.
- Efek visual tidak boleh berisi atau menduplikasi keputusan domain pemilihan hasil.
- Unit test wajib mencakup helper randomisasi, filter eligibility, pencegahan duplikat, dan perilaku redraw.

### 15.5 Usability dan aksesibilitas operasional

- Kontras dan ukuran nomor tiket harus memadai untuk layar besar.
- Informasi penting tidak boleh dibedakan hanya melalui warna.
- Fokus keyboard harus terlihat pada kontrol operator.
- Pesan kesalahan harus menjelaskan masalah dan tindakan pemulihan.
- Status Practice/Live, koneksi display, blackout, dan Pending harus mudah dikenali sekilas.

### 15.6 Arah visual

- Panel Operator menggunakan tampilan gelap dan berorientasi produksi, terinspirasi perangkat lunak kontrol siaran.
- Tampilan Audiens bersifat event-branded, celebratory, dan sangat mudah dibaca.
- Produk harus menghindari tampilan dashboard SaaS generik.
- Glow, gradient, dan efek glass digunakan secara terkendali agar tidak mengurangi keterbacaan.

---

## 16. Keamanan, Privasi, dan Auditabilitas

### 16.1 Keamanan operasional

- Live draw memerlukan konfirmasi tambahan atau hold-to-start.
- Replace data peserta, perpindahan mode berisiko, redraw, dan tindakan destruktif memerlukan konfirmasi.
- Kegagalan Web Crypto harus menghentikan pemilihan hasil; tidak ada fallback acak yang lebih lemah.
- Tampilan Audiens tidak boleh menerima atau menampilkan nama, catatan, status internal, atau data peserta lain kecuali nomor tiket dan data publik yang memang dibutuhkan untuk reveal.

### 16.2 Privasi

- Data peserta tetap pada browser/perangkat lokal pada MVP.
- Produk tidak boleh mengirim data ke backend, cloud, analitik, atau layanan pihak ketiga sebagai bagian fungsi inti.
- Preview impor dan riwayat harus menghindari paparan data ke Tampilan Audiens.
- Penyelenggara bertanggung jawab atas sumber data, hak penggunaan, retensi, dan pengamanan perangkat fisik.

### 16.3 Auditabilitas

- Setiap Live draw dan redraw harus memiliki ID serta timestamp.
- Snapshot eligibility dan aturan aktif harus dapat dihubungkan ke hasil.
- Pembatalan tidak menghapus WinnerRecord.
- Redraw menyimpan alasan dan relasi asal-pengganti.
- Riwayat resmi tidak boleh ditimpa secara diam-diam.
- Ekspor final harus dapat direkonsiliasi dengan record Confirmed pada riwayat lokal.

### 16.4 Batas keamanan

Karena MVP tidak menggunakan autentikasi, backend, atau audit eksternal, aplikasi tidak dapat mencegah pengguna yang memiliki akses penuh ke perangkat untuk mengubah atau menghapus data browser melalui alat sistem. Mitigasi MVP berfokus pada pencegahan kesalahan operasional dan jejak audit di dalam aplikasi.

---

## 17. Kriteria Penerimaan

Semua butir berikut harus dapat dicentang melalui pengujian. Kriteria P0 wajib lulus sebelum MVP digunakan untuk Live draw.

### 17.1 Acara, penyimpanan, dan offline

- [ ] AC-EVT-001 — Pengguna dapat membuat acara, refresh browser, lalu membuka kembali acara dengan data penting tetap tersedia.
- [ ] AC-EVT-002 — Dengan jaringan dinonaktifkan, pengguna dapat membuka data lokal, mengimpor peserta, mengatur draw, menjalankan Practice dan Live, memverifikasi hasil, melakukan redraw, serta mengekspor hasil.
- [ ] AC-EVT-003 — Dataset peserta, sesi, dan riwayat tersimpan di IndexedDB; localStorage hanya berisi preferensi ringan.
- [ ] AC-EVT-004 — Refresh pada hasil Pending memulihkan ID sesi, snapshot, hasil yang sama, dan status sebelumnya tanpa seleksi ulang.

### 17.2 Impor peserta

- [ ] AC-IMP-001 — CSV dan XLSX dengan minimal kolom tiket dapat dipreview, dipetakan, dan diimpor.
- [ ] AC-IMP-002 — Nilai tiket `000123` tetap persis `000123` setelah impor, penyimpanan, draw, riwayat, dan ekspor.
- [ ] AC-IMP-003 — Preview menandai serta menghitung tiket kosong, duplikat, dan baris invalid sebelum komit.
- [ ] AC-IMP-004 — Tidak ada baris invalid yang masuk pool draw.
- [ ] AC-IMP-005 — Replace meminta konfirmasi sebelum komit dan menghasilkan dataset sesuai file baru.
- [ ] AC-IMP-006 — Merge mempertahankan record yang valid dan tidak menciptakan tiket duplikat.
- [ ] AC-IMP-007 — Field opsional nama, check-in, grup, dan catatan dapat dipetakan tanpa menjadikannya wajib.

### 17.3 Eligibility dan konfigurasi

- [ ] AC-DRW-001 — Preset 1, 3, 6, 10, 20, dan 50 tersedia; input kustom menerima 1–100 dan menolak nilai di luar rentang.
- [ ] AC-DRW-002 — Perubahan filter atau aturan langsung memperbarui jumlah eligible.
- [ ] AC-DRW-003 — Opsi wajib check-in mengeluarkan peserta yang belum check-in.
- [ ] AC-DRW-004 — Tombol start tidak dapat digunakan ketika jumlah eligible lebih kecil dari jumlah pemenang, dan UI menjelaskan penyebabnya.
- [ ] AC-DRW-005 — Aturan default mencegah pemenang Confirmed menang lagi pada kategori berikutnya.
- [ ] AC-DRW-006 — Aturan “boleh menang lagi” dan “sekali per kategori” menghasilkan pool sesuai definisinya.

### 17.4 Keacakan dan integritas

- [ ] AC-RNG-001 — Review kode membuktikan jalur seleksi hasil akhir menggunakan Web Crypto API dan tidak menggunakan `Math.random()`.
- [ ] AC-RNG-002 — Implementasi rentang acak menghindari modulo bias.
- [ ] AC-RNG-003 — Unit test membuktikan satu peserta tidak dapat terpilih dua kali dalam draw yang sama.
- [ ] AC-RNG-004 — Semua pemenang berasal dari snapshot eligible sesi terkait.
- [ ] AC-RNG-005 — Mengubah durasi, frame, urutan rolling, atau mengulang animasi tidak mengubah hasil final.
- [ ] AC-RNG-006 — Kegagalan Web Crypto menghentikan draw dan tidak memakai sumber acak cadangan yang tidak memenuhi syarat.

### 17.5 Mode dan kontrol operator

- [ ] AC-MOD-001 — Operator dapat membedakan Practice dan Live tanpa hanya mengandalkan warna.
- [ ] AC-MOD-002 — Menyelesaikan Practice draw tidak menambah riwayat resmi dan tidak mengubah pool Live.
- [ ] AC-MOD-003 — Live draw memerlukan konfirmasi tambahan atau hold-to-start.
- [ ] AC-OPS-001 — Panel Operator menyediakan seluruh area navigasi yang dipersyaratkan.
- [ ] AC-OPS-002 — Status koneksi display dan status blackout terlihat jelas.
- [ ] AC-OPS-003 — Tindakan Live/destruktif yang ditentukan tidak dapat selesai tanpa konfirmasi eksplisit.

### 17.6 Tampilan Audiens

- [ ] AC-AUD-001 — Display dapat dibuka terpisah dan menerima state melalui BroadcastChannel.
- [ ] AC-AUD-002 — Display tidak memperlihatkan kontrol operator, nama peserta, check-in, grup, atau catatan.
- [ ] AC-AUD-003 — Semua state standby, countdown, rolling, winner reveal, confirmed, blackout, dan disconnected-safe dapat dipicu dan tampil benar.
- [ ] AC-AUD-004 — Layout 1, 6, 10, dan 20 masing-masing tampil sebagai hero, 3 × 2, 5 × 2, dan 5 × 4 pada 1920 × 1080.
- [ ] AC-AUD-005 — Nomor tiket menjadi elemen visual dominan dan tetap terbaca pada target 1920 × 1080.
- [ ] AC-AUD-006 — Putusnya BroadcastChannel tidak membuat display menampilkan hasil baru atau data internal.
- [ ] AC-AUD-007 — Logo, latar, warna, dan audio opsional dapat diterapkan dari aset lokal; kegagalan audio tidak membatalkan draw.

### 17.7 Verifikasi, redraw, dan riwayat

- [ ] AC-RES-001 — Hasil awal selalu Pending dan dapat dikonfirmasi seluruhnya atau per pemenang.
- [ ] AC-RES-002 — Konfirmasi sebagian tidak mengubah status pemenang Pending lainnya.
- [ ] AC-RES-003 — Operator dapat memilih beberapa pemenang dalam satu tindakan redraw.
- [ ] AC-RES-004 — Live redraw ditolak sampai alasan dipilih; alasan `other` juga mewajibkan keterangan.
- [ ] AC-RES-005 — Pemenang Cancelled tetap muncul di riwayat dan terhubung ke penggantinya.
- [ ] AC-RES-006 — Redraw tidak memilih peserta yang tidak eligible atau peserta yang sudah menempati slot aktif pada draw yang sama.
- [ ] AC-HIS-001 — Riwayat Live memuat seluruh field minimum pada FR-HIS-001 dan FR-HIS-002.
- [ ] AC-HIS-002 — Tidak tersedia alur yang menghapus atau menimpa riwayat resmi secara diam-diam.
- [ ] AC-HIS-003 — Ekspor CSV dan XLSX memuat hasil Confirmed serta mempertahankan nomor tiket sebagai string.

### 17.8 Kinerja, kompatibilitas, dan kualitas

- [ ] AC-NFR-001 — Impor, filter, dan draw dapat dijalankan dengan 10.000 peserta tanpa kegagalan.
- [ ] AC-NFR-002 — Seleksi hingga 100 pemenang selesai dalam < 1 detik pada perangkat benchmark yang disepakati.
- [ ] AC-NFR-003 — Alur kritis lulus pada Chrome dan Edge desktop versi terkini.
- [ ] AC-NFR-004 — TypeScript strict mode aktif dan pemeriksaan tipe lulus.
- [ ] AC-NFR-005 — Tidak ada penggunaan `any` yang tidak disetujui pada kode domain.
- [ ] AC-NFR-006 — Unit test untuk randomisasi, eligibility, pencegahan duplikat, dan redraw lulus.
- [ ] AC-NFR-007 — Logika domain dapat diuji tanpa merender komponen React.

---

## 18. Prioritas Pengembangan P0, P1, dan P2

Prioritas di bawah menunjukkan urutan delivery. P0 adalah penghalang penggunaan Live. P1 melengkapi pengalaman MVP setelah fondasi P0 stabil. P2 adalah peningkatan lanjutan atau item yang memerlukan keputusan tambahan.

### P0 — Wajib untuk Live draw

| Area | Cakupan |
|---|---|
| Model domain dan penyimpanan | Event, Participant, DrawSession, WinnerRecord, RedrawRecord; IndexedDB; autosave; pemulihan Pending |
| Impor | CSV/XLSX, string ticket, preview, mapping, validasi, replace/merge |
| Eligibility | Filter, check-in, aturan menang, hitung eligible, blokir pool kurang |
| Integritas draw | Web Crypto, unbiased selection, tanpa replacement, snapshot pool |
| Mode | Isolasi Practice/Live dan konfirmasi start Live |
| Operasi | Draw setup, live controls, Pending verification, konfirmasi, multi-redraw dengan alasan |
| Audit | Riwayat resmi, status, alasan pembatalan, relasi pengganti |
| Audience Display | Jendela terpisah, state inti, BroadcastChannel, blackout, disconnected-safe |
| Ketahanan | Offline, refresh recovery, penanganan storage/crypto failure |
| Kualitas | Strict TypeScript, pemisahan domain/UI, unit test wajib |

### P1 — Pelengkap MVP

| Area | Cakupan |
|---|---|
| Presentasi | Layout teroptimasi untuk 1, 6, 10, 20 serta fallback hingga 100 |
| Branding | Logo, latar, warna, audio opsional dari aset lokal |
| Operasional | Dashboard, penyempurnaan status koneksi, Settings, umpan balik error yang lengkap |
| Ekspor | CSV dan XLSX final yang dapat direkonsiliasi dengan riwayat |
| Kinerja | Profiling dan optimasi untuk 10.000 peserta/100 pemenang |
| Kompatibilitas | Validasi Chrome/Edge dan target resolusi utama |

### P2 — Lanjutan setelah kebutuhan tervalidasi

| Area | Cakupan |
|---|---|
| Portabilitas lokal | Backup dan restore acara, jika diputuskan masuk milestone MVP lanjutan |
| Display | Dukungan dan preset resolusi LED kustom |
| Penyempurnaan | Variasi branding/presentasi tambahan yang tidak mengubah integritas draw |

Item di luar ruang lingkup pada Bagian 9 tidak otomatis menjadi P2.

---

## 19. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Spreadsheet mengubah tiket menjadi angka | Nol di depan hilang; identitas salah | Perlakukan tiket sebagai string di seluruh pipeline; uji round-trip |
| Bias dalam konversi nilai Web Crypto ke indeks | Hasil tidak adil | Rejection sampling dan unit test helper rentang |
| Animasi terikat pada hasil | Integritas sulit dijelaskan dan rawan bug | Pisahkan domain selection dari presentasi |
| Refresh/penutupan tab saat Pending | Operator kehilangan konteks atau mengundi ulang | Persist hasil sebelum presentasi; recovery berbasis ID sesi |
| Data situs browser terhapus | Data acara dan riwayat hilang | Jelaskan batas local-first; prioritaskan backup/restore setelah format disepakati |
| Kuota IndexedDB penuh | Live record gagal disimpan | Pemeriksaan write; blokir Live bila persistensi gagal; pesan pemulihan |
| Display terputus saat reveal | Audiens melihat state tidak konsisten | Disconnected-safe, heartbeat/status, dan sinkronisasi state saat pulih |
| Popup diblokir | Display tidak terbuka | Status koneksi jelas dan instruksi membuka tab manual |
| Operator keliru menjalankan Live | Hasil resmi tidak disengaja | Diferensiasi mode dan hold-to-start/konfirmasi |
| Redraw menghilangkan pemenang lama | Audit tidak lengkap | Status Cancelled/Replaced tanpa delete dan relasi eksplisit |
| Dataset besar membuat UI macet | Operasi lambat saat acara | Uji 10.000 peserta, pemrosesan efisien, profiling |
| Audio/autoplay diblokir browser | Presentasi tidak sesuai | Preflight audio dan fallback visual non-blocking |
| Tidak ada autentikasi | Siapa pun yang mengakses perangkat dapat mengoperasikan aplikasi | Pengamanan fisik perangkat dan konfirmasi aksi kritis; dokumentasikan batas |
| Data pribadi muncul di display | Pelanggaran privasi | Payload BroadcastChannel khusus publik dan pengujian kebocoran data |
| Definisi peserta unik ambigu | Aturan sekali menang salah pada data tertentu | Tetapkan nomor tiket sebagai identitas MVP; validasi pada Pertanyaan Terbuka |

---

## 20. Pertanyaan Terbuka

Pertanyaan berikut memerlukan keputusan produk sebelum atau selama implementasi. Tidak ada yang boleh dijawab dengan menambahkan backend, cloud, autentikasi, pembayaran, atau registrasi online.

1. Field minimum apa yang wajib untuk membuat sebuah acara selain nama acara?
2. Apakah spasi di awal/akhir nomor tiket harus dipangkas, dan apakah perbandingan duplikat bersifat case-sensitive?
3. Bagaimana nilai check-in pada CSV/XLSX dipetakan ke boolean, misalnya `yes/no`, `1/0`, atau nilai lokal lain?
4. Pada mode merge, apakah field peserta yang sudah ada diperbarui dari file baru atau record lama selalu dipertahankan?
5. Apakah satu orang dengan beberapa nomor tiket dianggap beberapa peserta, mengingat identitas MVP saat ini berbasis nomor tiket?
6. Ketika pemenang Pending dibatalkan, apakah ia harus dikeluarkan hanya dari sesi/redraw aktif atau juga dari draw berikutnya untuk alasan tertentu?
7. Apakah hasil Pending boleh ditampilkan penuh ke audiens sebelum dikonfirmasi, atau reveal hanya menandai hasil sementara tanpa label status?
8. Setelah konfirmasi sebagian, bagaimana urutan presentasi pemenang Confirmed dan Pending di Tampilan Audiens?
9. Apakah redraw beberapa slot ditampilkan sekaligus atau satu per satu?
10. Format kolom, urutan, nama sheet, dan metadata audit apa yang wajib ada pada ekspor CSV/XLSX?
11. Apakah waktu disimpan dalam UTC dan ditampilkan dalam waktu lokal perangkat, atau ada zona waktu acara yang dapat dikonfigurasi?
12. Berapa durasi default countdown, rolling, reveal, dan transisi; apakah operator dapat mengubahnya?
13. Format, ukuran, dan batas kapasitas aset logo, background, dan audio lokal apa yang didukung?
14. Perilaku pasti disconnected-safe yang diinginkan: freeze state publik terakhir, blackout otomatis, atau layar pesan koneksi?
15. Perangkat keras dan dataset apa yang menjadi definisi resmi “laptop acara tipikal” untuk target < 1 detik?
16. Berapa lama data acara dan riwayat lokal perlu dipertahankan?
17. Apakah backup/restore acara menjadi syarat milestone MVP lanjutan, dan format portabel apa yang digunakan?
18. Siapa pemilik produk dan pihak yang berwenang menyetujui PRD serta hasil acceptance test?

