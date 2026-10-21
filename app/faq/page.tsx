import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import { siteUrl } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import LocalizedContent from "@/components/localized-content";

export async function generateMetadata(): Promise<Metadata> {
  const english = await getRequestLocale() === "en";
  const title = english ? "FAQ & Glossary | MU-Komik" : "FAQ dan Glosarium | MU-Komik";
  const description = english
    ? "Answers to frequently asked questions and explanations of terms used on MU-Komik."
    : "Jawaban pertanyaan umum dan arti istilah yang digunakan di MU-Komik.";
  const canonical = new URL("/faq", siteUrl).toString();
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical } };
}

const frequentlyAskedQuestions = [
  {
    question: "Siapa pemilik hak cipta komik yang diterbitkan di MU-Komik?",
    answer: (
      <p>
        <LocalizedContent>Hak cipta tetap berada pada kreator atau pemegang hak yang sah. Mengunggah karya tidak memindahkan hak cipta kepada MU-Komik. Kreator memberikan izin kepada MU-Komik untuk menyimpan, menampilkan, dan memproses karya sejauh diperlukan untuk menyediakan dan menjalankan layanan. Baca</LocalizedContent>{" "}
        <Link href="/syarat-ketentuan"><LocalizedContent>Syarat dan Ketentuan</LocalizedContent></Link>
        <LocalizedContent> untuk penjelasan lengkap.</LocalizedContent>
      </p>
    ),
  },
  {
    question: "Mengapa karya disimpan di layanan MU-Komik?",
    answer: (
      <p>
        <LocalizedContent>Berkas komik perlu disimpan pada layanan digital agar dapat diproses dan ditampilkan kepada pembaca melalui situs. Penyimpanan tersebut merupakan bagian dari operasional layanan, bukan pemindahan hak cipta. Penggunaan karya tetap mengikuti izin dan ketentuan yang berlaku.</LocalizedContent>
      </p>
    ),
  },
  {
    question: "Apakah pembaca boleh menyalin atau menerbitkan ulang komik?",
    answer: (
      <p>
        <LocalizedContent>Tidak tanpa izin dari pencipta atau pemegang hak yang berwenang. Komik yang dapat dibaca di situs bukan berarti bebas untuk disalin, diunggah ulang, dijual, atau digunakan untuk kepentingan lain.</LocalizedContent>
      </p>
    ),
  },
  {
    question: "Apa perbedaan komik, episode, dan halaman?",
    answer: (
      <p>
        <LocalizedContent>Komik adalah karya atau seri secara keseluruhan. Episode adalah satu bagian terbit dari komik. Halaman adalah satu gambar atau halaman baca di dalam episode.</LocalizedContent>
      </p>
    ),
  },
  {
    question: "Apa arti “Bagian” di Mode Anak?",
    answer: (
      <p>
        <LocalizedContent>“Bagian” adalah sebutan yang lebih sederhana untuk episode pada tampilan baca Mode Anak. Isinya tetap bagian dari komik yang sama.</LocalizedContent>
      </p>
    ),
  },
  {
    question: "Apakah semua komik tersedia dalam bahasa yang sama?",
    answer: (
      <p>
        <LocalizedContent>Tidak selalu. Bahasa sebuah komik mengikuti konten yang disediakan kreatornya. Perhatikan judul dan informasi pada halaman komik sebelum mulai membaca.</LocalizedContent>
      </p>
    ),
  },
  {
    question: "Bagaimana cara mengetahui ketentuan akses sebuah komik?",
    answer: (
      <p>
        <LocalizedContent>Baca informasi akses yang tercantum pada halaman komik atau penawaran sebelum melanjutkan. Jangan menganggap sebuah label atau nama paket menjelaskan manfaat di luar keterangan yang tersedia.</LocalizedContent>
      </p>
    ),
  },
];

const glossaryGroups = [
  {
    title: "Membaca komik",
    terms: [
      ["Komik", "Karya atau seri komik secara keseluruhan."],
      ["Episode", "Satu bagian terbit dari sebuah komik."],
      ["Bagian", "Sebutan sederhana untuk episode pada tampilan Mode Anak."],
      ["Halaman", "Satu gambar atau halaman baca di dalam episode."],
      ["Sampul", "Gambar yang mewakili komik atau episode."],
      ["Genre", "Jenis cerita, seperti fantasi, komedi, atau petualangan."],
      ["Favorit", "Komik yang disimpan agar mudah ditemukan kembali."],
      ["Koleksi", "Kumpulan bacaan yang tersimpan atau tersedia pada akun."],
      ["Terakhir dibaca", "Posisi atau bagian tempat pembaca terakhir membaca."],
    ],
  },
  {
    title: "Untuk kreator",
    terms: [
      ["Kreator", "Orang yang membuat atau menerbitkan komik."],
      ["Draf", "Komik atau perubahan yang belum diterbitkan."],
      ["Tinjauan kurasi", "Pemeriksaan komik sebelum disetujui untuk ditampilkan kepada pembaca."],
      ["Diterbitkan", "Komik atau episode sudah tersedia untuk dibaca."],
      ["Unggah", "Mengirim berkas dari perangkat ke MU-Komik."],
      ["Unduh", "Menyimpan berkas ke perangkat."],
      ["Pemetaan halaman", "Pengaturan halaman yang ditampilkan untuk setiap potongan subtitle."],
      ["Cue", "Satu potongan subtitle beserta waktu tampilnya."],
      ["SRT", "Format berkas teks subtitle yang berisi teks dan waktu tampil."],
    ],
  },
  {
    title: "Akun dan akses",
    terms: [
      ["Masuk", "Membuka akun dengan metode masuk yang terdaftar."],
      ["Profil", "Informasi identitas akun atau halaman publik kreator."],
      ["PIN orang tua", "Kode enam angka untuk mengatur atau menonaktifkan Mode Anak."],
      ["Mode Anak", "Tampilan dengan katalog komik yang telah dikurasi untuk anak."],
      ["Tanpa koneksi", "Membaca konten yang sudah disimpan di perangkat tanpa internet, jika fitur tersebut tersedia."],
      ["Akses", "Keterangan tentang cara atau syarat untuk membaca sebuah komik. Periksa informasi yang tercantum pada halaman terkait."],
    ],
  },
];

export default function FaqPage() {
  return (
    <main className="manifesto-page faq-page">
      <nav className="manifesto-nav">
        <BrandLogo linked showName />
        <Link href="/" className="manifesto-back"><ArrowLeft size={16} /> <LocalizedContent>Beranda</LocalizedContent></Link>
      </nav>

      <header className="terms-hero faq-hero">
        <p className="manifesto-eyebrow"><LocalizedContent>PUSAT BANTUAN MU-KOMIK</LocalizedContent></p>
        <h1>FAQ &amp;<br /><em><LocalizedContent>Glosarium</LocalizedContent></em></h1>
        <p className="terms-lead"><LocalizedContent>Jawaban singkat dan arti istilah yang membantu pembaca serta kreator menggunakan MU-Komik.</LocalizedContent></p>
      </header>

      <section className="faq-content" aria-labelledby="faq-questions-title">
        <div className="faq-section-heading">
          <p className="manifesto-eyebrow"><LocalizedContent>JAWABAN SINGKAT</LocalizedContent></p>
          <h2 id="faq-questions-title"><LocalizedContent>Pertanyaan yang sering diajukan</LocalizedContent></h2>
        </div>
        <div className="faq-question-list">
          {frequentlyAskedQuestions.map((item) => (
            <details className="faq-question" key={item.question}>
              <summary><LocalizedContent>{item.question}</LocalizedContent></summary>
              <div>{item.answer}</div>
            </details>
          ))}
        </div>
      </section>

      <section className="faq-content faq-glossary" aria-labelledby="faq-glossary-title">
        <div className="faq-section-heading">
          <p className="manifesto-eyebrow"><LocalizedContent>ISTILAH MU-KOMIK</LocalizedContent></p>
          <h2 id="faq-glossary-title"><LocalizedContent>Glosarium</LocalizedContent></h2>
          <p><LocalizedContent>Arti istilah yang muncul pada halaman pembaca dan kreator.</LocalizedContent></p>
        </div>
        {glossaryGroups.map((group) => (
          <section className="faq-glossary-group" key={group.title}>
            <h3><LocalizedContent>{group.title}</LocalizedContent></h3>
            <dl>
              {group.terms.map(([term, definition]) => (
                <div key={term}>
                  <dt><LocalizedContent>{term}</LocalizedContent></dt>
                  <dd><LocalizedContent>{definition}</LocalizedContent></dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </section>

      <div className="faq-legal-note">
        <p><LocalizedContent>Untuk aturan resmi tentang hak cipta dan penggunaan karya, baca</LocalizedContent>{" "}<Link href="/syarat-ketentuan"><LocalizedContent>Syarat dan Ketentuan Layanan</LocalizedContent></Link>.</p>
      </div>

      <footer className="manifesto-footer">
        <BrandLogo linked />
        <Link href="/" className="manifesto-back"><LocalizedContent>Kembali ke MU-Komik</LocalizedContent> <ArrowUpRight size={16} /></Link>
      </footer>
    </main>
  );
}
