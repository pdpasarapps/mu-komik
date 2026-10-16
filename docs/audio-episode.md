# Audio dan Subtitle Episode

Kreator khusus dapat menambahkan satu audio MP3 untuk setiap episode. Admin memberikan atau mencabut status kreator audio di `/admin/users`; kreator biasa tidak melihat opsi audio dan API menolak permintaan unggah mereka. File audio maksimal 50 MB, diunggah langsung ke Cloudflare R2 melalui URL PUT bertanda tangan yang berlaku lima menit. Subtitle disimpan sebagai SRT (maksimal 1 MB); audio tidak diputar otomatis.

## Menyiapkan berkas

Di editor komik, buka episode dan unggah tiga berkas:

1. Audio `.mp3`.
2. Subtitle `.srt` standar dengan nomor cue berurutan/unik, timestamp, dan teks.
3. Sidecar `.json` yang memetakan setiap nomor cue ke UUID halaman episode.

Contoh SRT:

```srt
1
00:00:01,000 --> 00:00:03,500
Matahari terbit di balik bukit.

2
00:00:03,500 --> 00:00:05,000
Para lebah mulai terbang.
```

Contoh sidecar:

```json
{
  "1": "UUID halaman untuk cue pertama",
  "2": "UUID halaman untuk cue kedua"
}
```

Gunakan tombol **Salin template pemetaan halaman** di editor sebagai titik awal. Setiap UUID harus berasal dari halaman dalam episode tersebut. Satu halaman boleh dipakai oleh beberapa cue. ID halaman bersifat stabil saat halaman diurutkan ulang; jika halaman dihapus dan dibuat ulang, sidecar perlu diperbarui.

## Perilaku pembaca

- Player menyediakan kontrol audio standar dan tidak autoplay.
- Teks subtitle mengikuti waktu audio; ketika cue aktif berubah halaman, reader berpindah ke halaman yang dipetakan.
- Ketika pembaca mengganti halaman secara manual, audio dijeda dan diarahkan ke cue pertama pada halaman itu jika tersedia.
- Menghapus episode juga menghapus metadata audio dan meminta penghapusan objek MP3 dari R2.

## Migrasi dan deployment

Pada database yang sudah ada, jalankan `supabase/chapter-audio.sql` dan `supabase/chapter-audio-permissions.sql` sekali sebelum deploy fitur. Migrasi izin membutuhkan `supabase/creator-request.sql` dan `supabase/admin-management.sql` agar admin dapat mengelola akses. Semua kreator mulai tanpa izin audio; admin memilih kreator yang diberi akses di `/admin/users`. Untuk CORS R2, pastikan origin aplikasi diizinkan untuk metode `PUT`, `GET`, dan `HEAD`; konfigurasi repo `r2-cors.json` sudah memuat metode tersebut.
