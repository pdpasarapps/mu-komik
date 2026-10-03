import type { Metadata } from "next";
import { getComicGenreLabel } from "@/lib/comic-genres";
import { createPublicSupabaseClient, siteUrl } from "@/lib/seo";

type ComicMetadata = {
  title: string;
  synopsis: string | null;
  genre: string;
  contributor: string | null;
  cover_key: string | null;
  profiles: { display_name: string } | { display_name: string }[] | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const fallbackTitle = "Komik Indonesia";
  const supabase = createPublicSupabaseClient();
  if (!supabase) {
    console.error("Unable to generate comic metadata: Supabase public environment variables are missing.");
    return { title: fallbackTitle };
  }

  const { data, error } = await supabase
    .from("comics")
    .select("title, synopsis, genre, contributor, cover_key, profiles!comics_creator_id_fkey(display_name)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    console.error("Unable to load published comic metadata:", error);
    return { title: fallbackTitle };
  }
  if (!data) return { title: "Komik tidak ditemukan", robots: { index: false, follow: false } };

  const comic = data as ComicMetadata;
  const profile = Array.isArray(comic.profiles) ? comic.profiles[0] : comic.profiles;
  const descriptionText = (comic.synopsis || "").replace(/\*\*/g, "").replace(/👉/g, "").replace(/\s+/g, " ").trim();
  const description = descriptionText.length > 160
    ? `${descriptionText.slice(0, 157).trimEnd()}...`
    : descriptionText || `Baca komik ${comic.title}, genre ${getComicGenreLabel(comic.genre)}, di mu-komik.`;
  const imageBaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;
  const image = comic.cover_key && imageBaseUrl
    ? `${imageBaseUrl.replace(/\/$/, "")}/${comic.cover_key}`
    : undefined;
  const author = comic.contributor?.trim() || profile?.display_name || "Kreator independen";
  const canonicalUrl = new URL(`/comic/${encodeURIComponent(slug)}`, siteUrl).toString();

  return {
    title: comic.title,
    description,
    alternates: { canonical: canonicalUrl },
    keywords: [comic.title, getComicGenreLabel(comic.genre), "komik Indonesia", "baca komik", author],
    authors: [{ name: author }],
    openGraph: {
      type: "article",
      locale: "id_ID",
      siteName: "mu-komik",
      title: `${comic.title} - Baca Komik Indonesia`,
      description,
      url: canonicalUrl,
      ...(image ? { images: [{ url: image, alt: `Sampul komik ${comic.title}` }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: comic.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default function ComicLayout({ children }: LayoutProps<"/comic/[slug]">) {
  return children;
}
