import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import LocalizedContent from "@/components/localized-content";
import { siteUrl } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const english = await getRequestLocale() === "en";
  const title = english ? "Privacy Policy | MU-Komik.com" : "Kebijakan Privasi | MU-Komik.com";
  const description = english
    ? "How MU-Komik.com collects, uses, and protects personal data."
    : "Cara MU-Komik.com mengumpulkan, menggunakan, dan melindungi data pribadi.";
  const canonical = new URL("/kebijakan-privasi", siteUrl).toString();
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
  };
}

const privacySections: { title: string; paragraphs: string[] }[] = [
  {
    title: "Ringkasan",
    paragraphs: [
      "Kebijakan Privasi ini menjelaskan data apa yang kami kumpulkan saat Anda menggunakan MU-Komik.com, mengapa data tersebut diperlukan, dan bagaimana kami mengelolanya.",
      "Dengan menggunakan Platform, Anda menyetujui praktik yang dijelaskan di halaman ini.",
    ],
  },
  {
    title: "Data yang Kami Kumpulkan",
    paragraphs: [
      "Data akun: alamat email, nama tampilan, dan peran akun ketika Anda mendaftar atau masuk.",
      "Data aktivitas membaca: komik dan episode yang dibuka, posisi halaman terakhir, serta penanda episode yang sudah dibaca.",
      "Data yang Anda kirim: pesan melalui formulir kontak, komentar, atau karya yang Anda unggah sebagai kreator.",
      "Data teknis: jenis perangkat dan browser serta informasi dasar lain yang diperlukan untuk menjalankan layanan.",
    ],
  },
  {
    title: "Cookie dan Penyimpanan Lokal",
    paragraphs: [
      "Kami memakai cookie untuk menjaga sesi masuk, menyimpan pengenal kunjungan anonim, dan mengingat status Mode Anak.",
      "Pengenal kunjungan berupa kode acak yang tidak memuat nama, email, atau nomor telepon Anda.",
      "Preferensi tampilan seperti tema dan ukuran teks disimpan di penyimpanan lokal browser Anda.",
      "Anda dapat menghapus cookie dan penyimpanan lokal melalui pengaturan browser. Setelah dihapus, sesi masuk, progres membaca di perangkat, dan Mode Anak dapat berhenti berfungsi.",
    ],
  },
  {
    title: "Analitik",
    paragraphs: [
      "Kami menggunakan Google Analytics 4 untuk memahami penggunaan situs secara agregat, misalnya jumlah pembaca dan jenis perangkat yang dipakai.",
      "Google dapat memproses informasi seperti alamat IP dan interaksi halaman sesuai kebijakan privasi Google.",
      "Kami juga mencatat statistik kunjungan internal pada basis data milik kami sendiri tanpa menautkannya ke identitas pembaca.",
    ],
  },
  {
    title: "Penyedia Layanan Pihak Ketiga",
    paragraphs: [
      "Supabase digunakan untuk autentikasi dan basis data, Cloudflare untuk hosting serta pengiriman aset, dan penyimpanan objek untuk gambar serta berkas komik.",
      "Tripay digunakan untuk memproses pembayaran keanggotaan. Kami tidak menyimpan nomor kartu atau kredensial pembayaran Anda.",
      "Iklan dapat ditampilkan melalui jaringan iklan pihak ketiga yang dapat memakai cookie atau teknologi serupa sesuai kebijakan penyedianya.",
    ],
  },
  {
    title: "Cara Kami Menggunakan Data",
    paragraphs: [
      "Kami memakai data untuk menyediakan layanan, menyimpan progres bacaan, memproses keanggotaan, menjawab pertanyaan Anda, menjaga keamanan Platform, dan memahami cara situs digunakan.",
      "Kami tidak menjual data pribadi Anda kepada pihak lain.",
    ],
  },
  {
    title: "Mode Anak",
    paragraphs: [
      "PIN Mode Anak tidak disimpan di basis data kami. PIN tersebut diubah menjadi hash dan disimpan pada cookie bertanda tangan di perangkat Anda.",
      "Orang tua dapat menonaktifkan Mode Anak kapan saja menggunakan PIN yang sama.",
    ],
  },
  {
    title: "Penyimpanan dan Retensi",
    paragraphs: [
      "Data akun disimpan selama akun Anda aktif atau selama diperlukan untuk tujuan yang dijelaskan di halaman ini.",
      "Statistik kunjungan dapat disimpan dalam bentuk agregat untuk jangka waktu yang lebih lama.",
    ],
  },
  {
    title: "Keamanan Data",
    paragraphs: [
      "Kami membatasi akses ke data, memakai koneksi terenkripsi saat data dikirim, dan meninjau izin pada layanan yang kami gunakan.",
      "Meski demikian, tidak ada sistem yang sepenuhnya bebas risiko. Jika Anda menemukan dugaan kebocoran data, segera hubungi kami melalui halaman kontak.",
    ],
  },
  {
    title: "Hak Anda",
    paragraphs: [
      "Anda dapat meminta akses, koreksi, atau penghapusan data akun Anda dengan menghubungi kami melalui halaman kontak.",
      "Kami akan menindaklanjuti permintaan tersebut sesuai dengan ketentuan hukum yang berlaku.",
    ],
  },
  {
    title: "Perubahan Kebijakan",
    paragraphs: [
      "Kebijakan ini dapat diperbarui untuk menyesuaikan perubahan layanan atau peraturan yang berlaku.",
      "Versi terbaru selalu tersedia di halaman ini beserta tanggal pembaruannya.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="manifesto-page terms-page">
      <nav className="manifesto-nav">
        <BrandLogo linked showName />
        <Link href="/" className="manifesto-back"><ArrowLeft size={16} /> <LocalizedContent>Beranda</LocalizedContent></Link>
      </nav>

      <header className="terms-hero">
        <p className="manifesto-eyebrow">MU-KOMIK.COM</p>
        <h1><LocalizedContent>Kebijakan</LocalizedContent><br /><em><LocalizedContent>Privasi</LocalizedContent></em></h1>
        <p className="terms-lead"><LocalizedContent>Halaman ini menjelaskan bagaimana MU-Komik.com mengumpulkan, menggunakan, dan melindungi data Anda saat Anda membaca, berkarya, atau berinteraksi di Platform.</LocalizedContent></p>
        <p className="terms-updated"><LocalizedContent>Terakhir diperbarui: 1 November 2026</LocalizedContent></p>
      </header>

      <div className="terms-content">
        {privacySections.map((section, index) => (
          <section className="terms-section" key={section.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2><LocalizedContent>{section.title}</LocalizedContent></h2>
              <LocalizedContent>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</LocalizedContent>
            </div>
          </section>
        ))}
        <div className="terms-closing">
          <strong>MU-Komik.com</strong>
          <p><LocalizedContent>Pertanyaan tentang privasi dapat disampaikan melalui halaman kontak kami.</LocalizedContent></p>
          <p>
            <Link href="/contact"><LocalizedContent>Hubungi MU-Komik</LocalizedContent></Link>
            {" · "}
            <Link href="/syarat-ketentuan"><LocalizedContent>Syarat dan Ketentuan</LocalizedContent></Link>
          </p>
        </div>
      </div>

      <footer className="manifesto-footer">
        <BrandLogo linked />
        <Link href="/" className="manifesto-back"><LocalizedContent>Kembali ke MU-KOMIK</LocalizedContent> <ArrowUpRight size={16} /></Link>
      </footer>
    </main>
  );
}
