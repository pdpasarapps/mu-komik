# Pekerjaan Lanjutan Keamanan Kids Mode

Pekerjaan berikut sengaja ditunda. Kids Mode saat ini menggunakan cookie bertanda tangan dan HttpOnly; jangan menganggapnya sebagai perlindungan yang tahan terhadap penghapusan cookie oleh pengguna yang menguasai browser.

## Sebelum deployment produksi

- Atur `KIDS_MODE_COOKIE_SECRET` sebagai secret server-side dengan nilai acak minimal 32 karakter.
- Gunakan nilai yang sama pada semua instance aplikasi dan pertahankan nilainya saat restart maupun deployment.
- Jangan masukkan secret ke repository, log, atau variabel `NEXT_PUBLIC_*`.
- Pada Cloudflare Workers, tambahkan `KIDS_MODE_COOKIE_SECRET` sebagai encrypted secret di Settings > Variables and Secrets, lalu deploy ulang Worker. Buat nilainya secara acak dan pastikan panjangnya minimal 32 karakter.
- Rotasi secret akan membuat cookie Kids Mode yang sudah ditandatangani tidak lagi valid; rencanakan dampaknya sebelum rotasi.

Saat secret khusus belum diatur, implementasi dapat menggunakan `SUPABASE_SERVICE_ROLE_KEY` sebagai fallback. Fallback ini bukan pengganti secret khusus yang stabil untuk deployment.

## Penguatan PIN yang ditunda

PIN dan penghitung percobaan saat ini berada dalam cookie bertanda tangan. Ini membantu mencegah perubahan melalui JavaScript biasa, tetapi tidak mencegah seseorang menghapus cookie melalui pengaturan browser atau developer tools lalu mengatur PIN baru. Penghitung percobaan juga bukan rate limit persisten dan dapat dilewati dengan menghapus cookie atau melalui request paralel.

Jika perlindungan harus bertahan setelah cookie dihapus, tindak lanjutnya:

1. Simpan hash PIN dan status lockout di server, bukan sebagai bagian dari cookie.
2. Ikat pengaturan tersebut ke akun orang tua atau identitas stabil lain yang dapat diverifikasi server.
3. Terapkan pembatasan percobaan persisten dan atomik, dengan kebijakan pemulihan akun.
4. Pertahankan cookie bertanda tangan hanya sebagai status sesi Kids Mode; jangan simpan PIN mentah.

## Kriteria untuk melanjutkan

- Secret tetap konsisten di seluruh instance dan tidak terekspos ke klien.
- Menghapus cookie sesi tidak menghapus PIN atau mereset pembatasan percobaan.
- Pengaturan ulang PIN memerlukan autentikasi orang tua.
- Uji positif dan negatif mencakup restart, beberapa instance, PIN salah berulang, dan penghapusan cookie.
