export const SUPPORT_ARTICLES = [
  {
    id: 'audiens-tidak-terhubung', title: 'Tampilan Audiens tidak terhubung', guide: 'tampilan-audiens-dan-persiapan-av', guideLabel: 'Tampilan Audiens dan Persiapan AV',
    symptom: 'Indikator belum menunjukkan Terhubung atau layar publik belum terlihat.',
    check: 'Periksa acara aktif, pengaturan tampilan yang tersimpan, dan apakah halaman Tampilan Audiens sudah dibuka pada setup lokal yang sama.',
    try: 'Gunakan Buka Tampilan Audiens dari Undian untuk membuka atau memfokuskan jendela. Jika pop-up diblokir, izinkan pop-up untuk aplikasi lokal lalu coba lagi. Lihat keluaran sebenarnya; jangan hanya mengandalkan preview.',
    unresolved: 'Jika status tetap belum terhubung, tunda mulai Live dan laporkan gejala serta status indikator. Jangan menghapus penyimpanan sebagai solusi koneksi.',
  },
  {
    id: 'keluaran-vmix', title: 'Keluaran vMix tidak muncul', guide: 'tampilan-audiens-dan-persiapan-av', guideLabel: 'Tampilan Audiens dan Persiapan AV',
    symptom: 'Tampilan Audiens ada di browser tetapi input/output vMix tidak memperlihatkannya, atau latar tidak sesuai.',
    check: 'Periksa Tampilan Audiens di browser terlebih dahulu. Cocokkan alamat dari Bagikan Tampilan dengan input browser pada perangkat operator. Alamat 127.0.0.1 tidak menunjuk komputer operator bila dibuka dari komputer lain.',
    try: 'Jika Tampilan Audiens belum berjalan, gunakan pemeriksaan koneksi di atas. Jika halaman browser sudah benar, periksa input dan output vMix bersama tim AV. Untuk kebutuhan transparan, periksa pilihan latar di Pengaturan Tampilan dan simpan perubahan.',
    unresolved: 'Laporkan apakah kendala juga terjadi pada halaman Audiens di browser atau hanya pada capture. Pengaturan perangkat eksternal dan jaminan kompatibilitas semua engine tidak tersedia dalam panduan ini.',
  },
  {
    id: 'impor-gagal', title: 'Impor peserta gagal', guide: 'peserta-dan-impor-data', guideLabel: 'Peserta dan Impor Data',
    symptom: 'Muncul File tidak didukung, File tidak dapat dibaca, masalah validasi, atau Impor gagal dengan aman.',
    check: 'Periksa format CSV/XLSX, ukuran file maksimal 10 MB, acara draf yang masih dapat diubah, dan pemetaan Nomor Tiket. Tinjau baris tidak valid, duplikat, serta pesan pemblokir.',
    try: 'Perbaiki file sumber atau pemetaan sesuai diagnostik sebelum konfirmasi. Gunakan Tinjau ulang bila impor gagal. Periksa konflik tiket yang sudah tersimpan saat memakai Gabung; jangan memilih Ganti sekadar untuk melewati pesan gagal.',
    unresolved: 'Laporkan pesan kesalahan tanpa melampirkan data peserta atau file sumber. Jangan menghapus acara untuk mencoba ulang.',
  },
  {
    id: 'hasil-tidak-terlihat', title: 'Hasil belum tersimpan / hasil tidak terlihat', guide: 'hasil-konfirmasi-dan-undi-ulang', guideLabel: 'Hasil, Konfirmasi, dan Undi Ulang',
    symptom: 'Pemenang belum terlihat, masih tertunda, atau muncul pesan perintah tidak diketahui/rekonsiliasi diperlukan.',
    check: 'Periksa acara aktif, sesi pada Undian/Hasil, dan Riwayat. Hasil tertunda belum sama dengan hilang atau sudah terkonfirmasi. Periksa pesan penyimpanan yang tampil.',
    try: 'Jangan jalankan undian baru sebelum status sesi diperiksa. Jika layar menyediakan Coba baca lagi, gunakan untuk membaca record tersimpan. Jika aplikasi meminta muat ulang untuk pemulihan, ikuti arahan itu; jangan buat permintaan undi ulang kedua.',
    unresolved: 'Jika status masih tidak jelas, hentikan keputusan Live baru dan Laporkan Masalah. Tidak ada saran mengulang draw, restore, atau reset sebagai pengganti peninjauan hasil.',
  },
  {
    id: 'setelah-refresh', title: 'Pemulihan setelah refresh', guide: 'penyimpanan-dan-pemulihan', guideLabel: 'Penyimpanan dan Pemulihan',
    symptom: 'Aplikasi menampilkan banner pemulihan, Perlu konfirmasi aman, atau pilihan sesi Live tersimpan.',
    check: 'Baca sesi dan status yang ditampilkan. Periksa bahwa Anda memakai profil browser dan alamat aplikasi yang sama.',
    try: 'Ikuti halaman pemulihan yang dipilih aplikasi dan tinjau hasil tersimpan. Jika diminta memilih sesi, pilih berdasarkan record sesi acara Anda. Jangan menekan mulai undian baru atau mengganti data untuk melewati konfirmasi aman.',
    unresolved: 'Bila record tidak dapat disimpulkan atau ada konflik, laporkan status pemulihan tanpa data acara/peserta. Tidak ada langkah seleksi ulang dalam panduan pemulihan ini.',
  },
  {
    id: 'penyimpanan-lokal', title: 'Kendala penyimpanan lokal', guide: 'penyimpanan-dan-pemulihan', guideLabel: 'Penyimpanan dan Pemulihan',
    symptom: 'Aplikasi menampilkan Penyimpanan lokal tidak tersedia, penyimpanan browser penuh, atau kegagalan membaca/menyimpan.',
    check: 'Periksa pesan pada layar dan penggunaan profil/alamat aplikasi yang benar. Status gagal menyimpan tidak sama dengan tindakan berhasil.',
    try: 'Tunda tindakan Live yang menulis data. Jika masalah sementara telah teratasi, gunakan Coba baca lagi atau Periksa kesiapan lagi bila kontrol itu tersedia. Pertahankan file sumber dan file cadangan manual yang sudah ada.',
    unresolved: 'Laporkan pesan yang terlihat. Jangan hapus data situs, reset database, atau restore backup sebagai langkah troubleshooting umum.',
  },
] as const
