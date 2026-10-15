import type { MetadataRoute } from "next";
import { createPublicSupabaseClient, siteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [{
    url: siteUrl.toString(),
    changeFrequency: "daily",
    priority: 1,
  }, {
    url: new URL("/artikel", siteUrl).toString(),
    changeFrequency: "weekly",
    priority: 0.7,
  }, {
    url: new URL("/manifesto", siteUrl).toString(),
    changeFrequency: "monthly",
    priority: 0.6,
  }, {
    url: new URL("/syarat-ketentuan", siteUrl).toString(),
    changeFrequency: "yearly",
    priority: 0.4,
  }];
  const supabase = createPublicSupabaseClient();
  if (!supabase) {
    console.error("Unable to generate comic sitemap: Supabase public environment variables are missing.");
    return entries;
  }

  const { data: articles, error: articleError } = await supabase
    .from("articles")
    .select("slug, updated_at, published_at")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });
  if (articleError) {
    console.error("Unable to load published articles for sitemap:", articleError);
  } else {
    entries.push(...(articles ?? []).map((article) => ({
      url: new URL(`/artikel/${encodeURIComponent(article.slug)}`, siteUrl).toString(),
      lastModified: article.updated_at || article.published_at,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })));
  }

  const { data: creators, error: creatorError } = await supabase
    .from("profiles")
    .select("public_handle")
    .eq("role", "creator")
    .eq("public_profile", true)
    .not("public_handle", "is", null);
  if (creatorError) {
    console.error("Unable to load public creator profiles for sitemap:", creatorError);
  } else {
    entries.push(...(creators ?? []).flatMap((creator) => creator.public_handle ? [{
      url: new URL(`/kreator/${encodeURIComponent(creator.public_handle)}`, siteUrl).toString(),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }] : []));
  }

  const { data: comics, error } = await supabase
    .from("comics")
    .select("id, slug, updated_at, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Unable to load published comics for sitemap:", error);
    return entries;
  }

  const comicEntries: MetadataRoute.Sitemap = [
    ...entries,
    ...(comics ?? []).map((comic) => ({
      url: new URL(`/comic/${encodeURIComponent(comic.slug)}`, siteUrl).toString(),
      lastModified: comic.updated_at || comic.created_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
  if (!comics?.length) return comicEntries;

  const comicSlugs = new Map(comics.map((comic) => [comic.id, comic.slug]));
  const { data: chapters, error: chapterError } = await supabase
    .from("chapters")
    .select("id, comic_id, chapter_number, published_at")
    .in("comic_id", comics.map((comic) => comic.id))
    .not("published_at", "is", null)
    .order("chapter_number", { ascending: true });
  if (chapterError) {
    console.error("Unable to load published chapters for sitemap:", chapterError);
    return comicEntries;
  }

  return [
    ...comicEntries,
    ...(chapters ?? []).flatMap((chapter) => {
      const slug = comicSlugs.get(chapter.comic_id);
      return slug ? [{
        url: new URL(`/comic/${encodeURIComponent(slug)}/chapter/${encodeURIComponent(chapter.id)}`, siteUrl).toString(),
        lastModified: chapter.published_at || undefined,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }] : [];
    }),
  ];
}
