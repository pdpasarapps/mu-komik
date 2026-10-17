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

### Membuat sidecar otomatis dari penanda halaman SRT

Repository menyediakan generator sidecar yang membaca penanda seperti `Halaman 1`, `Halaman 2`, dan seterusnya di teks SRT. Generator membutuhkan file MP3 episode, SRT, dan JSON berisi ID halaman episode. JSON ID dapat berupa:

- daftar UUID halaman dalam urutan halaman; atau
- template pemetaan dari editor, yang memetakan nomor cue ke UUID halaman. Cue-cue berturut-turut yang menunjuk halaman sama akan dikelompokkan.

Langkah-langkah:

1. Di editor komik, buka episode yang akan diperbarui dan klik **Salin template pemetaan halaman**.
2. Tempel hasilnya ke file JSON, misalnya `episode.page-ids.json`. Pastikan ID berasal dari episode yang sama dan urutannya mengikuti halaman.
3. Pastikan SRT memiliki penanda untuk setiap halaman dengan format `Halaman N`. Penanda yang berdiri sendiri atau diikuti teks menandai cue halaman tersebut. Jika penanda berada di akhir cue setelah teks (contoh: `Narasi terakhir halaman ini. Halaman 2`), cue itu tetap dipetakan ke halaman sebelumnya dan cue berikutnya mulai dipetakan ke halaman 2.
4. Dari terminal PowerShell di root repository, jalankan:

   ```powershell
   npm.cmd run subtitle:page-map -- --audio "cergam\episode.mp3" --srt "cergam\episode.srt" --page-ids "cergam\episode.page-ids.json"
   ```

   Ganti nama dan lokasi file sesuai episode. Tanda kutip diperlukan jika nama atau lokasi file mengandung spasi. Opsi `--audio` memeriksa bahwa MP3 yang dipilih tersedia dan memenuhi batas ukuran; isi audio tidak dianalisis.
5. Secara default, generator menulis `episode.pages.json` di folder SRT. Untuk menentukan lokasi lain, tambahkan `--out "folder\hasil.pages.json"`.
6. Unggah MP3, SRT, dan file `.pages.json` hasil generator pada bagian **Audio episode** di editor, lalu klik **Simpan audio episode**.

Contoh untuk berkas Putri Aurora:

```powershell
npm.cmd run subtitle:page-map -- --audio "cergam\princes aurora.mp3" --srt "cergam\princes aurora.srt" --page-ids "cergam\princes aurora.pages.json"
```

Jika file `.pages.json` yang sudah ada dipakai sebagai input template dan output default, generator akan menulis ulang file tersebut. Periksa nama/path input dan output sebelum menjalankan perintah. Generator memvalidasi format SRT, urutan cue dan penanda halaman, UUID, serta batas ukuran berkas. Untuk melihat bantuan opsi, jalankan `node scripts/generate-subtitle-page-map.mjs --help`.

## Perilaku pembaca

- Player menyediakan kontrol audio standar dan tidak autoplay.
- Teks subtitle mengikuti waktu audio; ketika cue aktif berubah halaman, reader berpindah ke halaman yang dipetakan.
- Ketika pembaca mengganti halaman secara manual, audio dijeda dan diarahkan ke cue pertama pada halaman itu jika tersedia.
- Menghapus episode juga menghapus metadata audio dan meminta penghapusan objek MP3 dari R2.

## Migrasi dan deployment

Pada database yang sudah ada, jalankan `supabase/chapter-audio.sql` dan `supabase/chapter-audio-permissions.sql` sekali sebelum deploy fitur. Migrasi izin membutuhkan `supabase/creator-request.sql` dan `supabase/admin-management.sql` agar admin dapat mengelola akses. Semua kreator mulai tanpa izin audio; admin memilih kreator yang diberi akses di `/admin/users`. Untuk CORS R2, pastikan origin aplikasi diizinkan untuk metode `PUT`, `GET`, dan `HEAD`; konfigurasi repo `r2-cors.json` sudah memuat metode tersebut.
