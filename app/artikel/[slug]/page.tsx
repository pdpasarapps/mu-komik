import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleSiteHeader from "@/components/article-site-header";
import { ArticleDetailContent } from "@/components/article-localized-view";
import { getArticleAuthor, getArticleCoverUrl, getPublishedArticle } from "@/lib/articles";
import { getRequestLocale } from "@/lib/request-locale";
import { siteUrl } from "@/lib/seo";

type ArticlePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) return { robots: { index: false, follow: false } };

  const locale = await getRequestLocale();
  const articleTitle = locale === "en" ? article.title_en.trim() || article.title : article.title;
  const articleExcerpt = locale === "en" ? article.excerpt_en.trim() || article.excerpt : article.excerpt;
  const title = locale === "en"
    ? article.seo_title_en?.trim() || articleTitle
    : article.seo_title?.trim() || articleTitle;
  const description = locale === "en"
    ? article.seo_description_en?.trim() || articleExcerpt
    : article.seo_description?.trim() || articleExcerpt;
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

  const cover = getArticleCoverUrl(article.cover_key);
  return (
    <main className="article-site-page">
      <ArticleSiteHeader />
      <ArticleDetailContent article={article} cover={cover} baseUrl={siteUrl.toString()} />
    </main>
  );
}
