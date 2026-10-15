import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ArticleSiteHeader from "@/components/article-site-header";
import MarkdownContent from "@/components/markdown-content";
import { getArticleAuthor, getArticleCoverUrl, getPublishedArticle } from "@/lib/articles";
import { siteUrl } from "@/lib/seo";

type ArticlePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) return { robots: { index: false, follow: false } };

  const title = article.seo_title?.trim() || article.title;
  const description = article.seo_description?.trim() || article.excerpt;
  const canonical = new URL(`/artikel/${encodeURIComponent(article.slug)}`, siteUrl).toString();
  const cover = getArticleCoverUrl(article.cover_key);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
      publishedTime: article.published_at,
      authors: [getArticleAuthor(article)],
      ...(cover ? { images: [{ url: cover, alt: article.title }] } : {}),
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title,
      description,
      ...(cover ? { images: [cover] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) notFound();

  const author = getArticleAuthor(article);
  const cover = getArticleCoverUrl(article.cover_key);
  const canonical = new URL(`/artikel/${encodeURIComponent(article.slug)}`, siteUrl).toString();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.seo_description?.trim() || article.excerpt,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    author: { "@type": "Person", name: author },
    publisher: { "@type": "Organization", name: "MU-Komik", url: siteUrl.toString() },
    mainEntityOfPage: canonical,
    inLanguage: "id-ID",
    articleSection: article.category,
    ...(cover ? { image: [cover] } : {}),
  };

  return (
    <main className="article-site-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <ArticleSiteHeader />
      <article className="article-detail">
        <nav className="article-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Beranda</Link><span aria-hidden="true">/</span><Link href="/artikel">Artikel</Link><span aria-hidden="true">/</span><span>{article.category}</span>
        </nav>
        <header className="article-detail-header">
          <span className="article-category">{article.category}</span>
          <h1>{article.title}</h1>
          <p className="article-detail-excerpt">{article.excerpt}</p>
          <div className="article-detail-meta"><span>{author}</span><time dateTime={article.published_at}>{new Date(article.published_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</time></div>
        </header>
        {cover && <img className="article-detail-cover" src={cover} alt={`Ilustrasi artikel: ${article.title}`} fetchPriority="high" />}
        <MarkdownContent content={article.content_markdown} />
        <footer className="article-detail-footer"><Link href="/artikel">← Kembali ke semua artikel</Link></footer>
      </article>
      <footer className="article-site-footer">
        <Link href="/">Kembali ke MU-Komik</Link>
        <Link href="/syarat-ketentuan">Syarat layanan</Link>
      </footer>
    </main>
  );
}
