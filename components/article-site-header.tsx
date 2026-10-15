import Link from "next/link";
import BrandLogo from "@/components/brand-logo";

export default function ArticleSiteHeader() {
  return (
    <header className="article-site-header">
      <BrandLogo className="wordmark reader-wordmark" showName />
      <nav aria-label="Navigasi artikel">
        <Link href="/">Jelajahi komik</Link>
        <Link href="/artikel">Artikel</Link>
      </nav>
    </header>
  );
}
