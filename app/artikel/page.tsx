import type { Metadata } from "next";
import Link from "next/link";
import ArticleSiteHeader from "@/components/article-site-header";
import { getArticleAuthor, getArticleCoverUrl, getPublishedArticles } from "@/lib/articles";
import { siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Artikel seputar Komik",
  description: "Baca panduan, wawancara kreator, dan artikel pilihan seputar komik Indonesia di MU-Komik.",
  alternates: { canonical: new URL("/artikel", siteUrl).toString() },
  openGraph: {
    type: "website",
    title: "Artikel seputar Komik | MU-Komik",
    description: "Panduan, wawancara kreator, dan cerita di balik komik Indonesia.",
    url: new URL("/artikel", siteUrl).toString(),
  },
};

export default async function ArticlesPage() {
  const articles = await getPublishedArticles();

  return (
    <main className="article-site-page">
      <ArticleSiteHeader />
      <section className="article-listing-hero">
        <p className="reader-section-kicker">RUANG BACA MU-KOMIK</p>
        <h1>Artikel seputar komik</h1>
        <p>Temukan panduan, wawancara kreator, dan cerita di balik komik Indonesia.</p>
      </section>
      {articles.length > 0 ? (
        <section className="article-listing-grid" aria-label="Daftar artikel">
          {articles.map((article) => {
            const coverUrl = getArticleCoverUrl(article.cover_key);
            return (
              <article className="article-listing-card" key={article.id}>
                <Link className="article-listing-cover" href={`/artikel/${encodeURIComponent(article.slug)}`} aria-label={`Baca ${article.title}`}>
                  {coverUrl ? <img src={coverUrl} alt="" loading="lazy" /> : <span>MU-KOMIK</span>}
                </Link>
                <div className="article-listing-card-copy">
                  <span className="article-category">{article.category}</span>
                  <h2><Link href={`/artikel/${encodeURIComponent(article.slug)}`}>{article.title}</Link></h2>
                  <p>{article.excerpt}</p>
                  <span className="article-byline">{getArticleAuthor(article)} · {new Date(article.published_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="article-listing-empty">
          <h2>Artikel segera hadir</h2>
          <p>Kami sedang menyiapkan bacaan menarik seputar dunia komik.</p>
          <Link href="/">Jelajahi komik <span aria-hidden="true">→</span></Link>
        </section>
      )}
      <footer className="article-site-footer">
        <Link href="/">Kembali ke MU-Komik</Link>
        <Link href="/syarat-ketentuan">Syarat layanan</Link>
      </footer>
    </main>
  );
}
