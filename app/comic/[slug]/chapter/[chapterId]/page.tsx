import { notFound } from "next/navigation";
import ChapterReaderPage, { type ChapterReaderSeed } from "./reader-client";
import { canPreviewUnpublishedComic, createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  let { data: comic, error: comicError } = await supabase
    .from("comics")
    .select("id, title, slug, status, creator_id, target_device")
    .eq("slug", slug)
    .abortSignal(AbortSignal.timeout(EPISODE_REQUEST_TIMEOUT_MS))
    .maybeSingle();
  if (comicError?.code === "42703") {
    const legacyComic = await supabase
      .from("comics")
      .select("id, title, slug, status, creator_id")
      .eq("slug", slug)
      .abortSignal(AbortSignal.timeout(EPISODE_REQUEST_TIMEOUT_MS))
      .maybeSingle();
    comic = legacyComic.data as typeof comic;
    comicError = legacyComic.error;
  }
  if (comicError) {
    console.error("Unable to verify episode comic:", { slug, chapterId, error: comicError });
    throw comicError;
  }
  if (!comic) notFound();
  let previewAccess = false;
  if (comic.status !== "published") {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError && userError.name !== "AuthSessionMissingError") {
      console.error("Unable to verify episode preview session:", userError);
      throw userError;
    } else if (userData.user) {
      previewAccess = await canPreviewUnpublishedComic(supabase, comic.creator_id, userData.user.id);
    }
  }
  if (comic.status !== "published" && !previewAccess) notFound();

  let chapterQuery = supabase
    .from("chapters")
    .select("id, title, chapter_number, comic_id, audio_object_key, subtitles_srt, subtitle_page_map, published_at")
    .eq("id", chapterId)
    .eq("comic_id", comic.id);
  if (!previewAccess) chapterQuery = chapterQuery.not("published_at", "is", null);
  let { data, error } = await chapterQuery.abortSignal(AbortSignal.timeout(EPISODE_REQUEST_TIMEOUT_MS)).maybeSingle();
  if (error?.code === "42703") {
    let legacyQuery = supabase
      .from("chapters")
      .select("id, title, chapter_number, comic_id, published_at")
      .eq("id", chapterId)
      .eq("comic_id", comic.id);
    if (!previewAccess) legacyQuery = legacyQuery.not("published_at", "is", null);
    const legacy = await legacyQuery.abortSignal(AbortSignal.timeout(EPISODE_REQUEST_TIMEOUT_MS)).maybeSingle();
    data = legacy.data as typeof data;
    error = legacy.error;
  }
  if (error) {
    console.error("Unable to verify episode:", { slug, chapterId, error });
    throw error;
  }
  if (!data) notFound();

  const kidsMode = readKidsModeState((await cookies()).get(KIDS_MODE_COOKIE_NAME)?.value)?.enabled ?? false;
  const { data: kidsCuration, error: kidsCurationError } = await supabase
    .from("comic_kids_curation")
    .select("age_range")
    .eq("comic_id", comic.id)
    .eq("review_status", "approved")
    .maybeSingle();
  if (kidsCurationError) {
    console.error("Unable to verify Kids Mode curation for episode:", { slug, chapterId, error: kidsCurationError });
    if (kidsMode) throw kidsCurationError;
  }
  if (kidsMode && !kidsCuration && !previewAccess) redirect("/");

  const seed: ChapterReaderSeed = {
    chapter: {
      id: data.id,
      title: data.title,
      chapter_number: data.chapter_number,
      comic_id: comic.id,
      audio_object_key: "audio_object_key" in data ? data.audio_object_key : null,
      subtitles_srt: "subtitles_srt" in data ? data.subtitles_srt : null,
      subtitle_page_map: "subtitle_page_map" in data ? data.subtitle_page_map as Record<string, string> | null : null,
    },
    comic: {
      id: comic.id,
      title: comic.title,
      slug: comic.slug,
      target_device: comic.target_device || "all",
      guest_read_all_episodes: false,
      kids_mode_approved: Boolean(kidsCuration),
      kids_age_range: kidsCuration?.age_range as "4_6" | "7_9" | "10_12" | null,
      preview_access: previewAccess,
    },
  };
  return <ChapterReaderPage key={chapterId} seed={seed} />;
}
