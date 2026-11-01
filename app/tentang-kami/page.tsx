import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import LocalizedContent from "@/components/localized-content";
import { siteUrl } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const english = await getRequestLocale() === "en";
  const title = english ? "About Us | MU-Komik.com" : "Tentang Kami | MU-Komik.com";
  const description = english
    ? "MU-Komik.com is a digital comic platform for Indonesian readers and creators."
    : "MU-Komik.com adalah platform komik digital untuk pembaca dan kreator Indonesia.";
  const canonical = new URL("/tentang-kami", siteUrl).toString();
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
  };
}

const aboutSections: { title: string; paragraphs: string[] }[] = [
  {
    title: "Cerita untuk Pembaca Indonesia",
    paragraphs: [
      "MU-Komik.com adalah platform komik digital yang menghadirkan cerita visual, komik serial, dan ilustrasi karya kreator Indonesia.",
      "Kami membangun ruang baca yang ringan, nyaman di ponsel, dan mudah dijelajahi oleh pembaca dari berbagai usia.",
    ],
  },
  {
    title: "Misi Kami",
    paragraphs: [
      "Kami ingin cerita lokal lebih mudah ditemukan dan dinikmati, sekaligus memastikan karya kreator tetap dihargai dan dilindungi.",
      "Setiap episode yang dibaca adalah dukungan bagi penulis dan ilustrator yang mengerjakannya.",
    ],
  },
  {
    title: "Yang Bisa Anda Lakukan",
    paragraphs: [
      "Menjelajah komik dan genre, lalu melanjutkan bacaan dari halaman terakhir yang tersimpan.",
      "Mengaktifkan Mode Anak dengan PIN orang tua agar pembaca muda hanya melihat komik yang sesuai.",
      "Membaca artikel seputar dunia komik, wawancara kreator, dan panduan membaca.",
    ],
  },
  {
    title: "Untuk Kreator",
    paragraphs: [
      "Kreator dapat mengelola komik, episode, dan cover melalui dasbor akun.",
      "Karya tetap menjadi milik penciptanya. Kami menyediakan tempat untuk menerbitkan dan menjangkau pembaca baru.",
    ],
  },
  {
    title: "Teknologi dan AI",
    paragraphs: [
      "Kami memakai kecerdasan buatan sebagai alat bantu produksi dan menandai penggunaannya secara terbuka.",
      "Prinsip dan batasan penggunaan AI kami jelaskan dalam Manifesto AI MU-Komik.",
    ],
  },
  {
    title: "Nilai yang Kami Pegang",
    paragraphs: [
      "Menghormati hak cipta, transparan soal teknologi yang dipakai, dan menolak konten yang membahayakan pembaca, terutama anak-anak.",
      "Masukan dari pembaca dan kreator membantu kami memperbaiki Platform dari waktu ke waktu.",
    ],
  },
];

export default function AboutPage() {
  return (
    <main className="manifesto-page terms-page">
      <nav className="manifesto-nav">
        <BrandLogo linked showName />
        <Link href="/" className="manifesto-back"><ArrowLeft size={16} /> <LocalizedContent>Beranda</LocalizedContent></Link>
      </nav>

      <header className="terms-hero">
        <p className="manifesto-eyebrow">MU-KOMIK.COM</p>
        <h1><LocalizedContent>Tentang</LocalizedContent> <em><LocalizedContent>Kami</LocalizedContent></em></h1>
        <p className="terms-lead"><LocalizedContent>Tempat cerita Indonesia menemukan pembacanya, dan tempat kreator membagikan karyanya.</LocalizedContent></p>
      </header>

      <div className="terms-content">
        {aboutSections.map((section, index) => (
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
          <p><LocalizedContent>Punya pertanyaan, masukan, atau ingin bekerja sama? Kami senang mendengarnya.</LocalizedContent></p>
          <p>
            <Link href="/contact"><LocalizedContent>Hubungi MU-Komik</LocalizedContent></Link>
            {" · "}
            <Link href="/manifesto"><LocalizedContent>Manifesto AI</LocalizedContent></Link>
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
