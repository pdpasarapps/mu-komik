# HLD dan LLD: MU Komik Player

Dokumen ini merancang aplikasi player komik yang dikembangkan di repository MU Komik, tetapi berada di folder aplikasi terpisah. Player dapat dijalankan sebagai web app/PWA, di-embed ke situs lain, dan nantinya dibungkus sebagai aplikasi desktop menggunakan Tauri.

- Status: rancangan awal
- Rekomendasi: mulai dari web player; tambahkan Tauri setelah alur web dan kebutuhan offline disepakati
- Folder aplikasi yang direncanakan: `apps/player/`
- Backend dan konten tetap dikelola oleh aplikasi MU Komik yang sudah ada

## 1. HLD — High-Level Design

### 1.1 Tujuan

Menyediakan player khusus untuk membaca:

- satu chapter melalui tautan langsung;
- daftar chapter sebuah komik;
- komik melalui pemilih chapter;
- komik terpilih dalam iframe/embed;
- konten yang telah diunduh secara offline pada fase desktop berikutnya.

Player menggunakan data, akun, aturan publikasi, dan media yang telah dimiliki MU Komik. Aplikasi kreator dan reader utama tidak diganti oleh player.

### 1.2 Sasaran dan bukan sasaran

**Sasaran rilis awal**

- Player web responsif dengan navigasi halaman, mode vertikal/buku, fullscreen, dan navigasi chapter.
- URL langsung untuk sebuah chapter dan sebuah komik.
- Mode embed yang menyembunyikan navigasi situs dan menyediakan opsi tampilan terbatas.
- Mematuhi status publikasi, membership, batas pembaca tamu, target perangkat, dan Kids Mode.
- Memakai halaman komik, teks overlay, penanda interaktif, filter, dan VFX yang telah disimpan.

**Bukan sasaran rilis awal**

- Mengubah pengelolaan komik, chapter, atau halaman.
- Mengunduh konten premium untuk penggunaan offline sebelum kebijakan dan penyimpanan offline dirancang.
- Mengandalkan aplikasi desktop sebagai satu-satunya cara membaca atau embed.
- Menyediakan file PowerPoint native. PowerPoint dapat menggunakan embed web jika versi dan kebijakan perangkat mendukung; ekspor slide merupakan fitur terpisah.

### 1.3 Arsitektur yang disarankan

```text
Browser / iframe / PWA                 Aplikasi desktop (fase berikutnya)
        |                                          |
        +-------------------+----------------------+
                            |
                    apps/player/
                    React + TypeScript
                    PWA; Tauri wrapper opsional
                            |
                HTTPS API di aplikasi MU Komik
                            |
               Supabase Auth + Postgres (RLS)
                            |
                  Cloudflare R2 untuk media
```

Player berada di `apps/player/` sebagai SPA React + TypeScript yang dapat dibangun sebagai PWA. Tauri membungkus hasil aplikasi yang sama; ia bukan jalur implementasi player yang terpisah. Aplikasi utama Next.js tetap menjadi pemilik API, sesi, aturan akses, dan sumber data.

Pada tahap awal player tidak mengakses Supabase atau R2 secara langsung. API server memeriksa hak baca terlebih dahulu, lalu mengembalikan DTO reader yang aman beserta URL media yang memang boleh diakses. Ini mencegah player baru melewati batas chapter tamu, membership, kurasi, atau aturan Kids Mode yang ada di reader saat ini.

### 1.4 Komponen utama

| Komponen | Tanggung jawab |
|---|---|
| `apps/player` | UI player, routing komik/chapter, embed, PWA, kontrol baca |
| MU Komik API | Validasi publikasi/akses, pemuatan DTO, URL media dan error terstandar |
| Supabase Auth | Sesi pengguna bila login diperlukan |
| Supabase Postgres | Data komik, chapter, halaman, overlay, marker, membership, progres |
| Cloudflare R2 | Gambar halaman, audio, dan aset komik |
| Tauri (opsional) | Shell desktop, jendela aplikasi, penyimpanan lokal yang dibatasi |

### 1.5 Alur membaca

1. Pengguna membuka URL player untuk sebuah komik atau chapter.
2. Player meminta data melalui API MU Komik dan menyertakan sesi login yang tersedia.
3. Server memeriksa bahwa komik berstatus published dan chapter telah diterbitkan, lalu menerapkan aturan akses terkait.
4. Server mengembalikan metadata, urutan halaman, overlay/VFX, dan URL gambar/audio yang diizinkan.
5. Player memuat gambar sesuai kebutuhan, menampilkan halaman dan kontrol, kemudian mencatat progres melalui API yang sama.
6. Saat chapter berganti, player meminta chapter berikutnya dan kembali menjalankan pemeriksaan akses.

### 1.6 Bentuk penggunaan

**Tautan web**

```text
/comic/{slug}
/comic/{slug}/chapter/{chapterId}
```

**Embed**

```html
<iframe
  src="https://player.mu-komik.com/embed/comic/{slug}"
  title="Player MU Komik"
  width="100%"
  height="720"
  allow="fullscreen"
  loading="lazy">
</iframe>
```

Embed chapter menggunakan `/embed/comic/{slug}/chapter/{chapterId}`. Parameter tampilan harus berupa allowlist, misalnya `controls=compact`; parameter tidak boleh memberikan hak akses. Host situs sebaiknya dapat dibatasi melalui kebijakan konfigurasi yang eksplisit, bukan dianggap sebagai mekanisme autentikasi.

Untuk PowerPoint, iframe/web add-in dapat dicoba jika versi Office dan kebijakan organisasi mendukung konten web. Fallback adalah membuka tautan player pada browser. Presentasi offline memerlukan ekspor slide atau paket offline terpisah.

### 1.7 Keamanan dan privasi

- Tidak pernah menaruh Supabase service-role key, kredensial R2, atau rahasia backend di `apps/player`.
- Semua pembacaan chapter melewati API yang memvalidasi aturan akses; jangan percaya slug, ID chapter, atau query string sebagai bukti izin.
- Terapkan RLS sebagai pertahanan berlapis, validasi ownership/publikasi di API, rate limit yang sesuai, timeout, dan error yang tidak membocorkan data privat.
- Gunakan URL media publik hanya untuk objek yang memang dapat diakses publik. Untuk aset terbatas, gunakan URL bertanda tangan berumur pendek dan jangan menyimpan token di URL embed permanen.
- CORS API dibatasi pada origin player dan origin lokal pengembangan yang dibutuhkan. Embed pihak ketiga memerlukan konfigurasi frame policy yang disengaja; jangan membuka `frame-ancestors` tanpa batas secara default.
- Terapkan kebijakan Kids Mode yang sama dengan reader utama. Jangan mengandalkan penyembunyian UI untuk penegakan akses.
- Progres offline disimpan lokal dan disinkronkan secara idempoten setelah online; jangan menyimpan kredensial sensitif dalam file ekspor.
- Telemetri hanya mengumpulkan data minimum yang telah disetujui; hindari fingerprinting.

### 1.8 Deployment dan lingkungan

- Web/PWA: deploy sebagai aset statis di origin player (misalnya `player.mu-komik.com`).
- API: tetap di aplikasi Next.js MU Komik (misalnya `mu-komik.com/api/player/...`).
- Tauri: build desktop mengemas aset web; akses API tetap melalui HTTPS. Offline membutuhkan paket konten yang eksplisit dan aturan lisensi/expiry.
- Development: player dan API berjalan pada port/origin berbeda; sediakan nilai API base URL melalui konfigurasi publik tanpa rahasia.
- Release desktop menggunakan pipeline tanda tangan/notarization platform setelah target OS diputuskan.

### 1.9 Tahapan rilis

1. **API dan kontrak:** tetapkan DTO, endpoint, aturan akses dan pengujian otorisasi.
2. **Web player:** chapter tunggal, navigasi halaman, mode vertikal/buku, overlay/VFX.
3. **Comic player dan embed:** daftar chapter, tautan langsung, tampilan embed, validasi iframe dan CORS.
4. **PWA:** manifest, pemasangan, caching shell aplikasi; konten komik tidak dicache offline secara default.
5. **Tauri dan offline (opsional):** shell desktop, unduh konten yang berhak diakses, kuota/expiry, sinkronisasi progres, dan keamanan data lokal.

## 2. LLD — Low-Level Design

### 2.1 Struktur folder yang diusulkan

```text
apps/
  player/
    src/
      app/
        routes/
        components/
        features/
          catalog/
          reader/
          embed/
          offline/          # fase Tauri/offline
      api/
      styles/
      main.tsx
    public/
    index.html
    package.json
    vite.config.ts
    tsconfig.json
    tauri/                   # ditambahkan saat Tauri disetujui
packages/
  player-contracts/          # tipe DTO/API; dapat diekstrak setelah kontrak stabil
```

Struktur ini adalah target, bukan instruksi untuk memindahkan reader saat ini sekaligus. Hindari impor `apps/player` dari alias `@/` aplikasi Next.js. Mulai dengan kontrak API yang kecil, kemudian ekstrak utilitas bersama yang terbukti diperlukan.

### 2.2 Routing

| Route | Fungsi |
|---|---|
| `/comic/:slug` | Sampul, metadata yang boleh tampil, daftar chapter |
| `/comic/:slug/chapter/:chapterId` | Reader penuh untuk satu chapter |
| `/embed/comic/:slug` | Daftar chapter dan player dalam shell minimal |
| `/embed/comic/:slug/chapter/:chapterId` | Player embed yang langsung membuka chapter |
| `*` | Halaman not found/error player |

Route embed memakai komponen reader yang sama dengan route penuh, dengan properti tampilan seperti `shell="embed"`. Perbedaan shell hanya memengaruhi UI; data dan hak akses tetap ditentukan server.

### 2.3 API yang diusulkan

Semua endpoint berada di aplikasi Next.js dan menggunakan versi awal `/api/player/v1`.

| Method dan endpoint | Fungsi |
|---|---|
| `GET /comics/:slug` | Metadata komik dan daftar chapter yang boleh dilihat |
| `GET /comics/:slug/chapters/:chapterId` | Metadata chapter dan halaman berurutan |
| `PUT /chapters/:chapterId/progress` | Upsert progres pengguna yang terautentikasi |
| `POST /media/:assetId/url` | Mengeluarkan URL singkat untuk media terbatas, jika diperlukan |

Persyaratan kontrak:

- Query list memiliki batas halaman, urutan eksplisit, timeout, dan dukungan abort.
- `GET` chapter memvalidasi hubungan slug → komik → chapter → publikasi, tidak hanya keberadaan ID.
- Hak membership, batas baca tamu, target perangkat, dan Kids Mode diverifikasi di server. Jika kebijakan pembaca tamu mengharuskan state sesi, gunakan token first-party terbatas/opaque; jangan menerima daftar chapter bebas dari klien sebagai otorisasi.
- Error berbentuk konsisten: `404` untuk konten tak tersedia, `401/403` untuk autentikasi/akses sesuai kebijakan, `429` untuk rate limit, `5xx` untuk kegagalan backend. Jangan mengembalikan respons sukses kosong ketika validasi gagal.
- Endpoint progres mengabaikan ID pengguna dari body; identitas berasal dari sesi tervalidasi.
- Media URL bertanda tangan hanya diterbitkan setelah hak akses chapter diperiksa. URL memiliki masa berlaku dan tidak mengungkap secret storage.

### 2.4 DTO reader

Contoh bentuk respons chapter:

```ts
type PlayerChapterResponse = {
  comic: {
    id: string;
    slug: string;
    title: string;
    targetDevice: "all" | "mobile" | "tablet" | "desktop";
  };
  chapter: {
    id: string;
    title: string;
    chapterNumber: number;
    previousChapterId: string | null;
    nextChapterId: string | null;
  };
  pages: Array<{
    id: string;
    pageNumber: number;
    imageUrl: string;
    imageVerticalAlign: "top" | "center" | "bottom";
    overlays: PageOverlayDto[];
    interactiveMarkers: PageInteractiveMarkerDto[];
    visualEffects: PageVisualEffectDto;
  }>;
};
```

DTO tidak mengekspos `object_key` privat, kolom internal yang tidak dibutuhkan, catatan moderasi, atau data pemilik. Bentuk overlay/VFX mengikuti parser halaman yang sudah ada; kontrak harus diuji terhadap dokumen lama tanpa field opsional agar fallback tetap berfungsi.

### 2.5 Modul UI player

- `PlayerApp`: router, pemulihan error, konfigurasi API, dan batas sesi.
- `ComicLanding`: metadata dan navigasi chapter.
- `ReaderShell`: toolbar, state loading/error, area halaman, dan kontrol fullscreen.
- `PageViewport`: ukuran responsif dan mode vertical/book.
- `PageRenderer`: gambar halaman, vertical align, teks overlay, marker interaktif, filter warna, serta lapisan VFX.
- `ReaderControls`: halaman sebelumnya/berikutnya, posisi chapter, daftar halaman, pengaturan mode baca.
- `EmbedShell`: shell minimal yang menggunakan komponen reader identik.
- `OfflineLibrary`: batas modul untuk fase offline; tidak diaktifkan pada MVP.

Prioritaskan keyboard navigation, label aksesibel untuk kontrol, reduced motion, dan fallback jika gambar gagal dimuat.

### 2.6 Data loading dan state

1. Route memvalidasi parameter slug dan UUID chapter secara sintaksis, lalu memanggil API. Validasi sintaksis bukan otorisasi.
2. Reader menampilkan skeleton hingga metadata dan indeks halaman tersedia.
3. Gambar dimuat bertahap: halaman aktif dan halaman tetangga lebih dulu; gambar jauh dapat memakai lazy loading.
4. Navigasi halaman memperbarui URL/state tanpa memuat ulang seluruh aplikasi.
5. Progres disimpan dengan debounce dan hanya setelah server mengonfirmasi akses. Konflik menggunakan kebijakan last-write-wins berdasarkan `updated_at` server atau aturan progres yang disepakati.
6. Saat chapter berubah, batalkan request sebelumnya, bersihkan state chapter, kemudian muat data chapter baru.
7. Error jaringan menyediakan retry; error akses tidak dicoba ulang otomatis tanpa perubahan sesi.

### 2.7 Embed, origin, dan konfigurasi

- Parameter embed hanya untuk presentasi, contohnya `controls=compact`, `theme=dark`, atau `autoplay=false`.
- Origin parent diperiksa terhadap allowlist bila fitur `postMessage` diaktifkan. Pesan harus memvalidasi `event.origin`, skema data, dan target origin.
- Protokol `postMessage` opsional: `PLAYER_READY`, `PAGE_CHANGED`, `CHAPTER_CHANGED`, `REQUEST_FULLSCREEN`. Jangan mengirim teks privat atau token sesi.
- `frame-ancestors`/CSP, `X-Frame-Options`, CORS, cookie `SameSite`, dan autentikasi lintas subdomain perlu diuji pada domain produksi. Embed publik sebaiknya tidak memerlukan cookie pihak ketiga.
- `NEXT_PUBLIC_*` atau konfigurasi build player hanya berisi URL origin API dan konfigurasi non-rahasia.

### 2.8 PWA dan Tauri

**PWA awal**

- Cache app shell, ikon, stylesheet, font, dan bundle statis.
- Jangan cache respons chapter atau gambar komik secara default; tentukan kebijakan cache setelah menguji hak akses dan risiko perangkat bersama.
- Tampilkan status online/offline dan pesan jelas saat konten belum tersedia.

**Tauri tahap lanjutan**

- Muat bundle lokal yang telah dibangun; API tetap HTTPS.
- Matikan navigasi arbitrary dan batasi CSP/window permissions.
- Gunakan plugin resmi yang dibutuhkan saja; validasi input command dan hindari akses file generik dari webview.
- Unduhan offline harus memeriksa hak sebelum mulai, menyediakan kuota, expiry/revocation jika diwajibkan, dan penghapusan data yang dapat diverifikasi.
- Simpan metadata progres secara lokal dengan skema versi. Jangan menganggap cache web biasa sebagai mekanisme DRM.

### 2.9 Observabilitas dan pengujian

**Log/metric**

- Request ID, endpoint, latency, status, jumlah halaman, kegagalan media, dan versi player.
- Jangan mencatat access token, signed URL utuh, isi overlay sensitif, atau data identitas yang tidak diperlukan.

**Pengujian minimum**

- Unit: parser DTO, validasi parameter route, progres idempoten, allowlist embed, dan perhitungan navigasi.
- Integrasi API: published/unpublished, chapter salah komik, guest limit, membership, Kids Mode, target perangkat, RLS, dan media terbatas.
- UI: loading/error/retry, perpindahan halaman/chapter, vertical/book mode, overlay/VFX, fullscreen, keyboard, dan reduced motion.
- Embed: domain diizinkan/ditolak, CSP/frame policy, responsif, `postMessage` origin, serta fallback bila cookies pihak ketiga diblokir.
- E2E: komik publik via web player dan iframe; percobaan akses tidak sah tidak mengembalikan konten.
- Desktop/offline hanya setelah fase tersebut dimulai: instalasi/update, kehilangan jaringan, expiry, sinkronisasi progres, dan penghapusan unduhan.

### 2.10 Risiko dan keputusan sebelum implementasi

| Topik | Risiko/keputusan |
|---|---|
| Pembatasan baca saat ini | Pembaca tamu dan membership harus ditegakkan oleh API agar player terpisah tidak menjadi bypass. |
| Media premium | Pastikan objek mana yang publik; tentukan signed URL dan masa berlaku sebelum membuka embed. |
| Cookies pada iframe | Browser dapat memblokir third-party cookies; prioritaskan konten publik atau mekanisme token embed terbatas yang dirancang khusus. |
| Offline | Cache dapat menyalin konten ke perangkat; perlu kebijakan hak, expiry, storage quota, dan UX penghapusan. |
| Berbagi UI | Reader utama terikat ke Next.js runtime dan context aplikasi. Ekstraksi ke paket bersama dilakukan bertahap, bukan menyalin komponen secara membabi buta. |
| PowerPoint | Kemampuan menampilkan web berbeda antarversi Office dan kebijakan organisasi; jangan menjanjikan kompatibilitas universal. |
| Platform desktop | Konfirmasi target OS, penandatanganan aplikasi, updater, dan apakah mode offline benar-benar dibutuhkan sebelum menambahkan Tauri. |

## 3. Urutan implementasi yang diusulkan

1. Sepakati target akses: konten publik saja atau juga chapter yang memerlukan login/membership.
2. Rancang dan uji endpoint chapter serta aturan akses dengan test cases.
3. Scaffolding `apps/player` sebagai web app terpisah di repository; jangan mengubah build utama Next.js sebelum workspace disepakati.
4. Implementasikan chapter player dengan DTO dan parser kompatibel.
5. Tambahkan comic landing, embed, CSP/CORS, lalu uji domain produksi.
6. Tambahkan PWA app-shell caching.
7. Evaluasi kebutuhan Tauri/offline berdasarkan penggunaan; implementasikan sebagai fase opsional.
