import { notFound } from "next/navigation";
import ChapterReaderPage, { type ChapterReaderSeed } from "./reader-client";
import { createPublicSupabaseClient } from "@/lib/seo";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { KIDS_MODE_COOKIE_NAME, readKidsModeState } from "@/lib/kids-mode";

const EPISODE_REQUEST_TIMEOUT_MS = 8000;

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

  let { data, error } = await supabase
    .from("chapters")
    .select("id, title, chapter_number, comic_id, audio_object_key, subtitles_srt, subtitle_page_map, comics!inner(title, slug, status, target_device)")
    .eq("id", chapterId)
    .eq("comics.slug", slug)
    .eq("comics.status", "published")
    .not("published_at", "is", null)
    .abortSignal(AbortSignal.timeout(EPISODE_REQUEST_TIMEOUT_MS))
    .maybeSingle();
  if (error?.code === "42703") {
    const legacy = await supabase
      .from("chapters")
      .select("id, title, chapter_number, comic_id, comics!inner(title, slug, status)")
      .eq("id", chapterId)
      .eq("comics.slug", slug)
      .eq("comics.status", "published")
      .not("published_at", "is", null)
      .abortSignal(AbortSignal.timeout(EPISODE_REQUEST_TIMEOUT_MS))
      .maybeSingle();
    data = legacy.data as typeof data;
    error = legacy.error;
  }
  if (error) {
    console.error("Unable to verify published episode:", { slug, chapterId, error });
    throw error;
  }
  if (!data) notFound();

  const linkedComic = Array.isArray(data.comics) ? data.comics[0] : data.comics;
  if (!linkedComic) notFound();
  const kidsMode = readKidsModeState((await cookies()).get(KIDS_MODE_COOKIE_NAME)?.value)?.enabled ?? false;
  const { data: kidsCuration, error: kidsCurationError } = await supabase
    .from("comic_kids_curation")
    .select("age_range")
    .eq("comic_id", data.comic_id)
    .eq("review_status", "approved")
    .maybeSingle();
  if (kidsCurationError) {
    console.error("Unable to verify Kids Mode curation for episode:", { slug, chapterId, error: kidsCurationError });
    if (kidsMode) throw kidsCurationError;
  }
  if (kidsMode && !kidsCuration) redirect("/");

  const seed: ChapterReaderSeed = {
    chapter: {
      id: data.id,
      title: data.title,
      chapter_number: data.chapter_number,
      comic_id: data.comic_id,
      audio_object_key: "audio_object_key" in data ? data.audio_object_key : null,
      subtitles_srt: "subtitles_srt" in data ? data.subtitles_srt : null,
      subtitle_page_map: "subtitle_page_map" in data ? data.subtitle_page_map as Record<string, string> | null : null,
    },
    comic: {
      id: data.comic_id,
      title: linkedComic.title,
      slug: linkedComic.slug,
      target_device: linkedComic.target_device || "all",
      guest_read_all_episodes: false,
      kids_mode_approved: Boolean(kidsCuration),
      kids_age_range: kidsCuration?.age_range as "4_6" | "7_9" | "10_12" | null,
    },
  };
  return <ChapterReaderPage key={chapterId} seed={seed} />;
}
