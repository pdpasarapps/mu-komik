import Link from "next/link";
import BrandLogo from "@/components/brand-logo";

export default function NotFound() {
  return (
    <main className="reader-detail-page">
      <nav className="reader-subnav">
        <BrandLogo className="wordmark reader-wordmark" />
        <Link className="reader-back-link" href="/">Jelajahi komik</Link>
      </nav>
      <section className="reader-detail-not-found">
        <h1>Halaman tidak ditemukan.</h1>
        <p>Tautan mungkin sudah berubah atau halaman yang kamu cari tidak tersedia.</p>
        <Link className="reader-primary-button" href="/">Kembali ke beranda</Link>
      </section>
    </main>
  );
}
