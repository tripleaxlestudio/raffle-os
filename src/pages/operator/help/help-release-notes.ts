// Editorial summaries of local release documents/artifacts and annotated release tags.
// Dates refer to local release tags; they do not assert a GitHub publication timestamp.
export const HELP_RELEASE_NOTES = [
  {
    version: '0.1.3', tagDate: '28 September 2026',
    added: [],
    fixed: ['Pembaruan aplikasi tidak lagi diblokir oleh status presentasi lama pada sesi undian yang sudah selesai atau dibatalkan.'],
    notes: ['Pemeriksaan keamanan pembaruan tetap berlaku. Tampilan Audiens yang masih terhubung, termasuk pada Siaga, dapat menunda pembaruan.'],
  },
  {
    version: '0.1.1', tagDate: '25 September 2026',
    added: ['Pemeriksaan rilis stabil dan alur pembaruan dengan konfirmasi pengguna untuk aplikasi terpasang.', 'Pelaporan masalah melalui formulir yang dapat ditinjau sebelum dibuka di Google Forms.'],
    fixed: [],
    notes: ['Pengguna versi 0.1.0 perlu memasang versi ini secara manual terlebih dahulu. Rilis ini menyediakan fondasi pembaruan; tidak menyatakan uji upgrade satu klik antarversi sudah selesai.', 'Mode portable tidak memasang pembaruan melalui alur aplikasi terpasang.'],
  },
  {
    version: '0.1.0', tagDate: '24 September 2026',
    added: ['Alur Panel Operator untuk persiapan acara, undian, peninjauan pemenang, dan riwayat.', 'Tampilan Audiens terpisah dan distribusi aplikasi lokal untuk Windows.'],
    fixed: [],
    notes: ['Data tetap lokal pada profil browser dan alamat aplikasi. Tidak ada sinkronisasi cloud.', 'Catatan rilis ini tidak menyatakan seluruh pengujian aplikasi lulus.'],
  },
] as const
