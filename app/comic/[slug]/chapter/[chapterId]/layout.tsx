import type { Metadata } from "next";
import { createPublicSupabaseClient, siteUrl } from "@/lib/seo";

type ChapterMetadata = {
  title: string;
  chapter_number: number;
  published_at: string | null;
  comics: { title: string; slug: string; synopsis: string | null; status: string }
    | { title: string; slug: string; synopsis: string | null; status: string }[];
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; chapterId: string }>;
}): Promise<Metadata> {
  const { slug, chapterId } = await params;
  const supabase = createPublicSupabaseClient();
  if (!supabase) {
    console.error("Unable to generate chapter metadata: Supabase public environment variables are missing.");
    return { title: "Episode komik" };
  }

  const { data, error } = await supabase
    .from("chapters")
    .select("title, chapter_number, published_at, comics!inner(title, slug, synopsis, status)")
    .eq("id", chapterId)
    .eq("comics.slug", slug)
    .eq("comics.status", "published")
    .not("published_at", "is", null)
    .maybeSingle();
  if (error) {
    console.error("Unable to load published chapter metadata:", error);
    return { title: "Episode komik" };
  }
  if (!data) return { title: "Episode tidak ditemukan", robots: { index: false, follow: false } };

  const chapter = data as ChapterMetadata;
  const comic = Array.isArray(chapter.comics) ? chapter.comics[0] : chapter.comics;
  if (!comic) return { title: "Episode tidak ditemukan", robots: { index: false, follow: false } };

  const title = `${comic.title} - Episode ${chapter.chapter_number}: ${chapter.title}`;
  const synopsis = (comic.synopsis || "").replace(/\*\*/g, "").replace(/👉/g, "").replace(/\s+/g, " ").trim();
  const description = synopsis.length > 160 ? `${synopsis.slice(0, 157).trimEnd()}...` : synopsis || `Baca episode ${chapter.chapter_number} dari komik ${comic.title} di mu-komik.`;
  const canonicalUrl = new URL(`/comic/${encodeURIComponent(slug)}/chapter/${encodeURIComponent(chapterId)}`, siteUrl).toString();
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "article",
      locale: "id_ID",
      siteName: "mu-komik",
      title,
      description,
      url: canonicalUrl,
    },
    twitter: { card: "summary", title, description },
  };
}

export default function ChapterLayout({ children }: LayoutProps<"/comic/[slug]/chapter/[chapterId]">) {
  return children;
}
