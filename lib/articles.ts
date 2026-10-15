import { cache } from "react";
import { createPublicSupabaseClient } from "@/lib/seo";

export { getArticleCoverUrl } from "@/lib/article-cover";

export type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content_markdown: string;
  category: string;
  cover_key: string | null;
  seo_title: string | null;
  seo_description: string | null;
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
    .select("id, title, slug, excerpt, content_markdown, category, cover_key, seo_title, seo_description, author_name, published_at, updated_at")
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
    .select("id, title, slug, excerpt, content_markdown, category, cover_key, seo_title, seo_description, author_name, published_at, updated_at")
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
