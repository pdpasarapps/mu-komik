import { cache } from "react";
import { createPublicSupabaseClient } from "@/lib/seo";

export { getArticleCoverUrl } from "@/lib/article-cover";

export type Article = {
  id: string;
  title: string;
  title_en: string;
  slug: string;
  excerpt: string;
  excerpt_en: string;
  content_markdown: string;
  content_markdown_en: string;
  category: string;
  category_en: string;
  cover_key: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_title_en: string | null;
  seo_description_en: string | null;
  author_name: string;
  published_at: string;
  updated_at: string;
};

export const getPublishedArticles = cache(async (): Promise<Article[]> => {
  const supabase = createPublicSupabaseClient();
  if (!supabase) {
    throw new Error("Unable to load published articles: Supabase public environment variables are missing.");
  }

  const { data, error } = await supabase
    .from("articles")
    .select("id, title, title_en, slug, excerpt, excerpt_en, content_markdown, content_markdown_en, category, category_en, cover_key, seo_title, seo_description, seo_title_en, seo_description_en, author_name, published_at, updated_at")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Unable to load published articles:", error);
    throw error;
  }
  return (data ?? []) as Article[];
});

export const getPublishedArticle = cache(async (slug: string): Promise<Article | null> => {
  const supabase = createPublicSupabaseClient();
  if (!supabase) {
    throw new Error("Unable to load published article: Supabase public environment variables are missing.");
  }

  const { data, error } = await supabase
    .from("articles")
    .select("id, title, title_en, slug, excerpt, excerpt_en, content_markdown, content_markdown_en, category, category_en, cover_key, seo_title, seo_description, seo_title_en, seo_description_en, author_name, published_at, updated_at")
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Unable to load published article:", { slug, error });
    throw error;
  }
  return data as Article | null;
});

export function getArticleAuthor(article: Article): string {
  return article.author_name || "Tim MU-Komik";
}
