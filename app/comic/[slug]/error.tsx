"use client";

import { useEffect } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";

export default function ComicError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Unable to render comic page:", error);
  }, [error]);

  return (
    <main className="reader-detail-page reader-not-found-page">
      <nav className="reader-subnav">
        <BrandLogo className="wordmark reader-wordmark" showName />
        <Link className="reader-back-link" href="/"><ArrowLeft size={17} /> Jelajahi komik</Link>
      </nav>
      <div className="reader-detail-not-found">
        <h1>Komik belum bisa dibuka.</h1>
        <p>Koneksi ke server terlalu lama atau sedang terganggu. Periksa koneksi lalu coba lagi.</p>
        <button className="reader-primary-button" type="button" onClick={retry}>Coba lagi <ArrowRight size={17} /></button>
        <Link className="reader-detail-secondary-link" href="/">Jelajahi komik</Link>
      </div>
    </main>
  );
}
