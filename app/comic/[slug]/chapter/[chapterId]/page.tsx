import { notFound } from "next/navigation";
import ChapterReaderPage, { type ChapterReaderSeed } from "./reader-client";
import { createPublicSupabaseClient } from "@/lib/seo";

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ slug: string; chapterId: string }>;
}) {
  const { slug, chapterId } = await params;
  const supabase = createPublicSupabaseClient();
  if (!supabase) {
    throw new Error("Unable to verify published episode: Supabase public environment variables are missing.");
  }

  const { data, error } = await supabase
    .from("chapters")
    .select("id, title, chapter_number, comic_id, comics!inner(title, slug, status)")
    .eq("id", chapterId)
    .eq("comics.slug", slug)
    .eq("comics.status", "published")
    .not("published_at", "is", null)
    .maybeSingle();
  if (error) {
    console.error("Unable to verify published episode:", { slug, chapterId, error });
    throw error;
  }
  if (!data) notFound();

  const linkedComic = Array.isArray(data.comics) ? data.comics[0] : data.comics;
  if (!linkedComic) notFound();

  const seed: ChapterReaderSeed = {
    chapter: {
      id: data.id,
      title: data.title,
      chapter_number: data.chapter_number,
      comic_id: data.comic_id,
    },
    comic: {
      title: linkedComic.title,
      slug: linkedComic.slug,
    },
  };
  return <ChapterReaderPage key={chapterId} seed={seed} />;
}
