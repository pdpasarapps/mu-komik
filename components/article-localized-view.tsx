"use client";

import Link from "next/link";
import Image from "next/image";
import MarkdownContent from "@/components/markdown-content";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/localized-content";
import type { Article } from "@/lib/articles";
import AdsterraAd from "@/components/adsterra-ad";
import SponsoredAd from "@/components/sponsored-ad";

function ArticleAdPlacement() {
  return (
    <div className="article-ad-placement">
      <SponsoredAd slotKey="article_content" placement="article" />
      <AdsterraAd placement="article" />
    </div>
  );
}

export function ArticleListingContent({ articles }: { articles: (Article & { coverUrl?: string })[] }) {
  const { locale, t } = useLocale();
  return (
    <>
      <section className="article-listing-hero">
        <p className="reader-section-kicker">{t("RUANG BACA MU-KOMIK")}</p>
        <h1>{t("Artikel seputar komik")}</h1>
        <p>{t("Temukan panduan, wawancara kreator, dan cerita di balik komik Indonesia.")}</p>
      </section>
      {articles.length > 0 ? (
        <section className="article-listing-grid" aria-label={t("Daftar artikel")}>
          {articles.map((article) => {
            const title = localizedText(article.title, article.title_en, locale);
            const category = localizedText(article.category, article.category_en, locale);
            return (
              <article className="article-listing-card" key={article.id}>
                <Link className="article-listing-cover" href={`/artikel/${encodeURIComponent(article.slug)}`} aria-label={`${t("Baca")} ${title}`}>
                  {article.coverUrl ? <Image src={article.coverUrl} alt="" width={900} height={600} unoptimized loading="lazy" /> : <span>MU-KOMIK</span>}
                </Link>
                <div className="article-listing-card-copy">
                  <span className="article-category">{category}</span>
                  <h2><Link href={`/artikel/${encodeURIComponent(article.slug)}`}>{title}</Link></h2>
                  <p>{localizedText(article.excerpt, article.excerpt_en, locale)}</p>
                  <span className="article-byline">{article.author_name || "Tim MU-Komik"} · {new Date(article.published_at).toLocaleDateString(locale === "id" ? "id-ID" : "en-US", { day: "numeric", month: "long", year: "numeric" })}</span>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="article-listing-empty">
          <h2>{t("Artikel segera hadir")}</h2>
          <p>{t("Kami sedang menyiapkan bacaan menarik seputar dunia komik.")}</p>
          <Link href="/">{t("Jelajahi komik")} <span aria-hidden="true">→</span></Link>
        </section>
      )}
      <ArticleAdPlacement />
      <footer className="article-site-footer">
        <Link href="/">{t("Kembali ke MU-Komik")}</Link>
        <Link href="/syarat-ketentuan">{t("Syarat layanan")}</Link>
      </footer>
    </>
  );
}

export function ArticleDetailContent({ article, cover, baseUrl }: { article: Article; cover: string | undefined; baseUrl: string }) {
  const { locale, t } = useLocale();
  const title = localizedText(article.title, article.title_en, locale);
  const excerpt = localizedText(article.excerpt, article.excerpt_en, locale);
  const category = localizedText(article.category, article.category_en, locale);
  const seoDescription = locale === "en"
    ? article.seo_description_en?.trim() || excerpt
    : article.seo_description?.trim() || excerpt;
  const content = localizedText(article.content_markdown, article.content_markdown_en, locale);
  const author = article.author_name || "Tim MU-Komik";
  const canonical = `${baseUrl.replace(/\/$/, "")}/artikel/${encodeURIComponent(article.slug)}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: seoDescription,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    author: { "@type": "Person", name: author },
    publisher: { "@type": "Organization", name: "MU-Komik", url: baseUrl },
    mainEntityOfPage: canonical,
    inLanguage: locale === "id" ? "id-ID" : "en",
    articleSection: category,
    ...(cover ? { image: [cover] } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <article className="article-detail">
        <nav className="article-breadcrumb" aria-label={t("Breadcrumb")}>
          <Link href="/">{t("Beranda")}</Link><span aria-hidden="true">/</span><Link href="/artikel">{t("Artikel")}</Link><span aria-hidden="true">/</span><span>{category}</span>
        </nav>
        <header className="article-detail-header">
          <span className="article-category">{category}</span>
          <h1>{title}</h1>
          <p className="article-detail-excerpt">{excerpt}</p>
          <div className="article-detail-meta"><span>{author}</span><time dateTime={article.published_at}>{new Date(article.published_at).toLocaleDateString(locale === "id" ? "id-ID" : "en-US", { day: "numeric", month: "long", year: "numeric" })}</time></div>
        </header>
        {cover && <Image className="article-detail-cover" src={cover} alt={`${t("Ilustrasi artikel")}: ${title}`} width={1200} height={800} unoptimized fetchPriority="high" />}
        <MarkdownContent content={content} middleContent={<ArticleAdPlacement />} />
        <ArticleAdPlacement />
        <footer className="article-detail-footer"><Link href="/artikel">← {t("Kembali ke semua artikel")}</Link></footer>
      </article>
      <footer className="article-site-footer">
        <Link href="/">{t("Kembali ke MU-Komik")}</Link>
        <Link href="/syarat-ketentuan">{t("Syarat layanan")}</Link>
      </footer>
    </>
  );
}
