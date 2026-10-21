import type { Metadata } from "next";
import ArticleSiteHeader from "@/components/article-site-header";
import { ArticleListingContent } from "@/components/article-localized-view";
import { getArticleCoverUrl, getPublishedArticles } from "@/lib/articles";
import { getRequestLocale } from "@/lib/request-locale";
import { siteUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const title = locale === "id" ? "Artikel seputar Komik" : "Comics Articles";
  const description = locale === "id"
    ? "Baca panduan, wawancara kreator, dan artikel pilihan seputar komik Indonesia di MU-Komik."
    : "Read guides, creator interviews, and selected articles about Indonesian comics on MU-Komik.";
  const canonical = new URL("/artikel", siteUrl).toString();
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: `${title} | MU-Komik`,
      description,
      url: canonical,
    },
  };
}

export default async function ArticlesPage() {
  const articles = (await getPublishedArticles()).map((article) => ({
    ...article,
    coverUrl: getArticleCoverUrl(article.cover_key),
  }));

  return (
    <main className="article-site-page">
      <ArticleSiteHeader />
      <ArticleListingContent articles={articles} />
    </main>
  );
}
