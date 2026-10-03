import { ButtonLink } from '../../../shared/ui/index.ts'
import { GUIDE_SECTIONS } from './help-guide-sections.ts'

type GuideSectionId = typeof GUIDE_SECTIONS[number]['id']

export function HelpGuideContent({ sectionId }: { readonly sectionId: GuideSectionId }) {
  switch (sectionId) {
    case 'mengenal-kocokan':
      return <>
        <p>Panel Operator berisi pengaturan, kontrol undian, dan peninjauan hasil. Tampilan Audiens adalah halaman terpisah untuk layar publik. Tampilkan halaman Audiens, bukan Panel Operator, pada layar acara.</p>
        <p>Acara aktif menentukan data hadiah, peserta, dan sesi yang sedang dikelola. Periksa nama acara pada bagian atas sebelum mengambil tindakan.</p>
        <p>Latihan digunakan untuk mencoba presentasi tanpa membuat hasil resmi. Live digunakan untuk undian resmi. Pemenang Live yang belum dikonfirmasi tampil sebagai hasil tertunda; hasil tersebut belum sama dengan hasil akhir. Riwayat menampilkan sesi Live beserta status dan hubungan penggantinya.</p>
      </>
    case 'persiapan-acara':
      return <ol>
        <li>Buka Acara melalui nama acara di bagian atas. Isi Nama Acara, lalu pilih Buat Acara. Deskripsi dan Jadwal tersedia bila diperlukan.</li>
        <li>Pada Acara tersimpan, pilih Jadikan Aktif untuk memilih ruang kerja. Label AKTIF menandai acara yang sedang dipilih. Aktifkan Acara adalah tindakan terpisah yang mengubah status acara dan meminta konfirmasi; selesaikan persiapan data draf lebih dahulu.</li>
        <li>Buka Hadiah atau Kelola Kategori Hadiah. Isi Nama kategori dan Nama hadiah. Nama sponsor, gambar hadiah, detail tambahan, dan Urutan tampilan tersedia sesuai kebutuhan. Pilih Buat Kategori Hadiah atau Simpan perubahan.</li>
        <li>Jumlah pemenang diatur pada Pengaturan Undian. Ikuti urutan Acara → Hadiah → Peserta → Pengaturan Tampilan → Pengaturan Undian; menu berikutnya dapat diblokir sampai langkah sebelumnya selesai.</li>
      </ol>
    case 'peserta-dan-impor-data':
      return <>
        <ol>
          <li>Buka Peserta dengan acara draf yang masih dapat diubah. Pilih file CSV atau XLSX melalui Pilih file. File dibatasi 10 MB; untuk XLSX, pilih Lembar kerja bila beberapa lembar terlihat tersedia.</li>
          <li>Periksa Pratinjau baris mentah. Pada Petakan kolom sumber, hubungkan Nomor Tiket yang wajib. Nama, Grup, Check-in, dan Catatan dapat dipetakan jika tersedia.</li>
          <li>Tinjau Diagnostik dan ringkasan validasi: Draf valid, Baris tidak valid, Duplikat, dan Masalah pemblokir. Perbaiki masalah pemblokir sebelum melanjutkan. Baris yang tidak valid tidak dikirim ke penyimpanan; periksa jumlah draf valid yang akan diimpor.</li>
          <li>Pilih Strategi impor secara eksplisit. Gabung mempertahankan peserta yang ada; konflik nomor tiket yang sama menolak seluruh operasi. Ganti menghapus peserta acara yang ada dan menggantinya dengan batch tervalidasi; gunakan hanya bila memang ingin mengganti data, lalu baca dan centang pengakuan pada konfirmasi.</li>
          <li>Pilih Tinjau dan konfirmasi impor, periksa acara, strategi, dan jumlah baris. Setelah konfirmasi selesai, periksa Peserta Tersimpan dan jumlah peserta yang terbaca kembali.</li>
        </ol>
        <p>Simpan nomor tiket sebagai teks dalam file sumber. Nol di depan seperti 00123 harus tetap terlihat pada pratinjau dan Peserta Tersimpan. Jika spreadsheet sudah mengubahnya menjadi angka, jangan menganggap aplikasi dapat menebak nol yang hilang. Sel formula atau tiket angka yang ambigu dapat diblokir oleh validasi.</p>
      </>
    case 'pengaturan-undian':
      return <>
        <ol>
          <li>Pilih Hadiah pada Pengaturan Undian; Kategori mengikuti hadiah tersimpan. Tentukan Jumlah pemenang khusus antara 1–100 atau gunakan pilihan cepat.</li>
          <li>Periksa Aturan kemenangan: Sekali per Acara, Sekali per kategori, atau Boleh menang lagi. Formulir baru menggunakan Sekali per Acara dan mode Latihan; sesi tersimpan mempertahankan pengaturannya.</li>
          <li>Isi Filter grup memenuhi syarat bila perlu; kosongkan untuk semua grup. Wajib check-in membatasi peserta pada yang sudah check-in.</li>
          <li>Pilih Gaya pengungkapan: Tampil Langsung atau Putar & Stop Manual. Formulir baru menggunakan Tampil Langsung. Tidak ada pilihan rolling berwaktu atau pengaturan kecepatan pada kontrol ini.</li>
          <li>Periksa Ringkasan peserta memenuhi syarat dan Pemenang diminta, lalu simpan perubahan. Lanjutkan hanya saat aplikasi menyatakan Undian siap dilanjutkan.</li>
        </ol>
        <p>Undian diblokir jika peserta memenuhi syarat tidak cukup, ada sesi Live lain yang belum selesai, data belum siap, atau penyimpanan/pemilihan aman tidak tersedia. Ikuti pesan pada layar. Sesi yang sudah dimulai dapat terkunci; jangan membuat sesi baru untuk melewati pemeriksaan tersebut.</p>
      </>
    case 'tampilan-audiens-dan-persiapan-av':
      return <>
        <h3>Fitur Kocokan</h3>
        <p>Atur logo, tema, warna, latar, nomor tiket, countdown, dan tipografi pada Pengaturan Tampilan. Pratinjau memperlihatkan draft lokal; simpan perubahan agar diterapkan pada Tampilan Audiens. Bagikan Tampilan menyediakan alamat halaman publik.</p>
        <p>Gunakan Buka Tampilan Audiens pada Undian. Periksa indikator Terhubung dan lihat keluaran sebenarnya. Jika pembukaan jendela diblokir browser, izinkan pop-up untuk aplikasi lokal lalu coba tombol itu kembali. Tombol Siaga di bagian atas tersedia bila pengaturan siap dan tidak ada undian aktif atau hasil yang menunggu verifikasi.</p>
        <h3>Perangkat eksternal</h3>
        <p>Gunakan halaman Tampilan Audiens pada browser/output yang ditangkap LED, proyektor, atau input browser vMix. Ambil alamat dari Bagikan Tampilan pada acara yang benar. Jika memakai latar transparan, periksa juga hasil pada output tujuan.</p>
        <p>Kocokan tidak mengatur input vMix, capture, LED processor, atau output perangkat secara otomatis. Runtime lokal terpasang digunakan pada perangkat operator; alamat 127.0.0.1 menunjuk perangkat itu sendiri. Jangan menganggap alamat tersebut dapat dibuka dari komputer lain. Uji setup AV aktual sebelum acara.</p>
      </>
    case 'latihan-dan-live':
      return <>
        <h3>Latihan</h3><p>Pilih Latihan untuk memeriksa kesiapan layar dan presentasi sebelum acara. Hasil latihan tidak menjadi hasil resmi dan tidak mengubah kelayakan kemenangan Live. Pilihan mode yang belum memiliki sesi tersimpan bisa tidak tersedia pada Undian; siapkan sesi dari Pengaturan Undian.</p>
        <h3>Live</h3><p>Pastikan acara, hadiah, peserta, dan layar siap, lalu pilih Live. Pengaturan Live dan mulai undian meminta konfirmasi sesuai layar. Melanjutkan dari pengaturan membuka gerbang mulai; belum sama dengan memilih pemenang. Periksa kembali mode sebelum tindakan resmi.</p>
      </>
    case 'menjalankan-undian':
      return <>
        <ol>
          <li>Buka sesi siap dari Undian. Tinjau acara, hadiah, jumlah pemenang, mode, dan kesiapan Tampilan Audiens.</li>
          <li>Gunakan kontrol mulai yang ditampilkan. Untuk Live, baca ringkasan dan konfirmasi pada dialog sebelum memulai.</li>
          <li>Presentasi mengikuti konfigurasi. Tampil Langsung mengungkap pemenang setelah hitung mundur; pada preferensi gerak berkurang, hitung mundur dapat dilewati. Putar & Stop Manual terus memutar nomor sampai operator menekan Stop; tidak berhenti otomatis karena durasi.</li>
          <li>Setelah pemenang tampil pada Live, pilih Tinjau Pemenang dan lanjutkan peninjauan hasil. Jangan menganggap pemenang yang baru tampil sudah dikonfirmasi.</li>
        </ol>
        <p>Nomor yang bergerak adalah presentasi. Hasil resmi dipilih oleh proses pemilihan aplikasi, bukan dari nomor visual yang kebetulan terlihat saat tombol ditekan. Bantuan ini tidak menyatakan sertifikasi hukum atau audit eksternal.</p>
      </>
    case 'hasil-konfirmasi-dan-undi-ulang':
      return <>
        <ol>
          <li>Buka Hasil atau Tinjau Pemenang pada sesi terkait. Periksa tiket dan kehadiran pemenang sebelum membuat keputusan.</li>
          <li>Pilih pemenang tertunda satu per satu atau gunakan Pilih Semua yang Tertunda. Konfirmasi membuka dialog; Konfirmasi secara resmi menerapkan keputusan pada pemenang yang dipilih. Pemenang tertunda lain tetap menunggu keputusan.</li>
          <li>Untuk penggantian, pilih pemenang yang memang perlu diganti lalu Undi Ulang. Periksa kapasitas pengganti, pilih alasan, dan isi Catatan jika alasan Lainnya dipilih. Baca dampak sebelum Undi ulang secara resmi.</li>
          <li>Keputusan menyimpan permintaan penggantian dan membatalkan pemenang yang dipilih. Aplikasi kembali ke layar undi ulang dengan rolling dan Stop manual. Pengganti belum langsung dipilih saat tombol Undi Ulang pada peninjauan ditekan.</li>
          <li>Jalankan alur yang ditampilkan, lalu tinjau dan konfirmasi pengganti. Pemenang asli yang dibatalkan dan hubungan penggantinya tetap terlihat pada record/riwayat.</li>
        </ol>
        <p>Batalkan adalah tindakan berbeda dari Undi Ulang. Jangan gunakan keduanya sebagai cara menyegarkan layar. Koreksi pemenang yang sudah terkonfirmasi juga memengaruhi hasil resmi; lakukan hanya bila benar-benar diperlukan dan baca dialognya.</p>
        <p>Jika muncul pesan bahwa perintah tidak diketahui atau handoff tidak dapat dibaca, hentikan tindakan baru dan ikuti peninjauan record tersimpan. Jangan membuat permintaan pengganti kedua untuk mengatasi tampilan yang belum berubah.</p>
      </>
    case 'riwayat-dan-ekspor':
      return <>
        <p>Buka Riwayat untuk sesi Live pada acara aktif. Gunakan pencarian/filter yang tersedia, buka detail sesi, atau lihat Semua Pemenang. Periksa status tertunda, terkonfirmasi, dan dibatalkan serta Linimasa Audit. Riwayat bukan daftar hasil Latihan.</p>
        <p>Kontrol tampil/sembunyikan pada riwayat mengatur presentasi hasil yang tersedia ke Tampilan Audiens; bukan konfirmasi pemenang atau undian baru. Periksa layar publik setelah tindakan. Kontrol dapat diblokir saat presentasi/sesi lain sedang aktif atau hasil belum memenuhi syarat tampil.</p>
        <p>Pilih Ekspor → CSV atau XLSX. Ekspor memakai acara aktif dan hanya hasil Live terkonfirmasi; pemenang tertunda atau dibatalkan tidak menjadi hasil akhir ekspor. File memuat identitas sesi/acara, waktu, kategori/hadiah, urutan, tiket, dan nama peserta bila tersedia.</p>
        <p>Nomor tiket ditulis sebagai teks pada XLSX. Saat membuka CSV di spreadsheet, impor kolom tiket sebagai teks agar aplikasi spreadsheet tidak menghilangkan nol di depan.</p>
      </>
    case 'penyimpanan-dan-pemulihan':
      return <>
        <h3>Penyimpanan aplikasi</h3><p>Data disimpan lokal pada browser/perangkat yang digunakan melalui tindakan aplikasi. Perhatikan status tersimpan atau pesan kegagalan; perubahan pada preview atau formulir belum tentu sudah disimpan. Data mengikuti profil browser dan alamat aplikasi. Menggunakan profil/alamat lain tidak otomatis menampilkan data yang sama.</p>
        <h3>Setelah refresh</h3><p>Aplikasi membaca sesi Live yang belum selesai dan dapat mengarahkan ke pekerjaan tersimpan. Ikuti status seperti Pekerjaan Live tersimpan berhasil dipulihkan, Perlu konfirmasi aman, atau pilihan sesi. Pemulihan membaca hasil yang tersimpan tanpa memilih pemenang baru. Sesi yang selesai diarahkan ke riwayat; sesi sebelum pemilihan dapat diarahkan kembali ke pengaturan.</p><p>Jika status tidak pasti atau ada beberapa sesi, tinjau record yang ditampilkan dan jangan mulai undian baru untuk menggantikan hasil yang belum terlihat.</p>
        <h3>Backup manual — opsional</h3><p>Buka Settings → Data & Penyimpanan → Buat Backup. Pastikan file .kocokan.json terunduh dan simpan salinannya bila diperlukan. Backup bukan syarat Live dan bukan proses otomatis. File dapat memuat informasi acara/peserta; simpan secara terbatas dan jangan lampirkan ke laporan masalah.</p>
        <h3>Restore manual</h3><p>Pulihkan Backup membuka pemilihan file, validasi, dan preview berisi tanggal, versi, jumlah acara/peserta, serta riwayat. Restore menggantikan seluruh data Kocokan yang saat ini tersimpan. Baca preview dan konfirmasi hanya bila memang ingin mengganti data, setelah operasi Live selesai. Gunakan Batal bila file atau cakupannya tidak sesuai.</p><p>Restore bukan solusi umum untuk hasil yang belum terlihat. Cadangan tidak menjamin setiap aset atau keadaan dapat dipulihkan; periksa hasil pemulihan secara terpisah. Jangan hapus data situs atau reset penyimpanan untuk menyelesaikan kendala sebelum memeriksa sesi.</p>
      </>
    case 'kendala-umum':
      return <><p>Mulai dari pemeriksaan yang aman untuk layar, impor, hasil, atau penyimpanan. Hindari tindakan baru pada sesi Live yang statusnya belum jelas.</p><ButtonLink to="/help/support" variant="secondary">Buka Kendala Umum</ButtonLink></>
    case 'alur-cepat-kocokan':
    case 'checklist-sebelum-acara':
      return null
  }
}
