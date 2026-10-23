import { notFound, redirect } from "next/navigation";
import ComicDetailPage, { type Chapter, type Comic, type ComicDetailPageProps } from "./comic-detail-client";
import { getComicGenreLabel } from "@/lib/comic-genres";
import { siteUrl } from "@/lib/seo";
import { canPreviewUnpublishedComic, createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { KIDS_MODE_COOKIE_NAME, readKidsModeState } from "@/lib/kids-mode";

const COMIC_REQUEST_TIMEOUT_MS = 8000;

export default async function ComicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("comics")
    .select("id, creator_id, status, title, slug, synopsis, contributor, genre, cover_key, target_device, profiles!comics_creator_id_fkey(id, public_handle, display_name, public_profile)")
    .eq("slug", slug)
    .abortSignal(AbortSignal.timeout(COMIC_REQUEST_TIMEOUT_MS))
    .maybeSingle();
  if (error?.code === "42703") {
    console.warn("Creator public profiles are not configured. Loading comic profile fields without public-profile links.");
    let legacy = await supabase
      .from("comics")
      .select("id, creator_id, status, title, slug, synopsis, contributor, genre, cover_key, target_device, profiles!comics_creator_id_fkey(display_name)")
      .eq("slug", slug)
      .abortSignal(AbortSignal.timeout(COMIC_REQUEST_TIMEOUT_MS))
      .maybeSingle();
    data = legacy.data as typeof data;
    error = legacy.error;
    if (error?.code === "42703") {
      legacy = await supabase
        .from("comics")
        .select("id, creator_id, status, title, slug, synopsis, contributor, genre, cover_key, profiles!comics_creator_id_fkey(display_name)")
        .eq("slug", slug)
        .abortSignal(AbortSignal.timeout(COMIC_REQUEST_TIMEOUT_MS))
        .maybeSingle();
      data = legacy.data as typeof data;
      error = legacy.error;
    }
  }
  if (error) {
    console.error("Unable to verify comic access:", { slug, error });
    throw error;
  }
  if (!data) notFound();
  let previewAccess = false;
  if (data.status !== "published") {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError && userError.name !== "AuthSessionMissingError") {
      console.error("Unable to verify comic preview session:", userError);
      throw userError;
    } else if (userData.user) {
      previewAccess = await canPreviewUnpublishedComic(supabase, data.creator_id, userData.user.id);
    }
  }
  if (data.status !== "published" && !previewAccess) notFound();

  const kidsMode = readKidsModeState((await cookies()).get(KIDS_MODE_COOKIE_NAME)?.value)?.enabled ?? false;
  let kidsSeriesCoverKey: string | null = null;
  if (kidsMode) {
    const { data: seriesCoverData, error: seriesCoverError } = await supabase
      .from("comics")
      .select("kids_series_cover_key")
      .eq("id", data.id)
      .abortSignal(AbortSignal.timeout(COMIC_REQUEST_TIMEOUT_MS))
      .maybeSingle();
    if (seriesCoverError?.code === "42703") {
      console.warn("Kids Mode series covers are not configured. Run supabase/kids-series-cover.sql to enable them.");
    } else if (seriesCoverError) {
      console.error("Unable to load Kids Mode series cover:", { slug, error: seriesCoverError });
      throw seriesCoverError;
    } else {
      kidsSeriesCoverKey = seriesCoverData?.kids_series_cover_key ?? null;
    }
  }
  const comic = {
    ...data,
    kids_series_cover_key: kidsSeriesCoverKey,
    preview_access: previewAccess,
  };
  const { data: kidsCuration, error: kidsCurationError } = await supabase
    .from("comic_kids_curation")
    .select("age_range")
    .eq("comic_id", comic.id)
    .eq("review_status", "approved")
    .maybeSingle();
  if (kidsCurationError) {
    console.error("Unable to verify Kids Mode curation for comic:", { slug, error: kidsCurationError });
    if (kidsMode) throw kidsCurationError;
  }
  if (kidsMode && !kidsCuration && !previewAccess) redirect("/");
  const kidsAgeRange = kidsCuration?.age_range as "4_6" | "7_9" | "10_12" | undefined;
  let chapterQuery = supabase
    .from("chapters")
    .select("id, title, chapter_number, published_at")
    .eq("comic_id", comic.id)
    .order("chapter_number", { ascending: true });
  if (!previewAccess) chapterQuery = chapterQuery.not("published_at", "is", null);
  const { data: chapterData, error: chapterError } = await chapterQuery.abortSignal(AbortSignal.timeout(COMIC_REQUEST_TIMEOUT_MS));
  if (chapterError) {
    console.error("Unable to load published episodes for comic page:", { slug, error: chapterError });
  }

  const initialComic: Comic = {
    ...comic,
    target_device: comic.target_device ?? "all",
    synopsis: comic.synopsis ?? "",
    contributor: comic.contributor ?? "",
    contributors: null,
    production_technique: "traditional_drawing",
    story_status: "ongoing",
    target_audience: "all_ages",
    language: "id",
    origin_type: "original",
    source_info: "",
    kids_mode_approved: Boolean(kidsCuration),
    kids_age_range: kidsAgeRange ?? null,
    preview_access: previewAccess,
  };
  const initialChapters = (chapterData ?? []) as Chapter[];
  const props: ComicDetailPageProps = { initialComic, initialChapters };
  const canonicalUrl = new URL(`/comic/${encodeURIComponent(slug)}`, siteUrl).toString();
  const profile = Array.isArray(initialComic.profiles) ? initialComic.profiles[0] : initialComic.profiles;
  const creatorName = initialComic.contributor.trim() || profile?.display_name;
  const description = initialComic.synopsis.replace(/\*\*/g, "").replace(/👉/g, "").replace(/\s+/g, " ").trim();
  const imageBaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;
  let coverUrl: string | undefined;
  if (initialComic.cover_key && imageBaseUrl) {
    const url = new URL(imageBaseUrl);
    const coverKey = initialComic.cover_key;
    url.pathname = `${url.pathname.replace(/\/?$/, "/")}${coverKey.split("/").map(encodeURIComponent).join("/")}`;
    coverUrl = url.toString();
  }
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CreativeWorkSeries",
        "@id": `${canonicalUrl}#comic`,
        name: initialComic.title,
        url: canonicalUrl,
        inLanguage: "id-ID",
        genre: getComicGenreLabel(initialComic.genre),
        ...(description ? { description } : {}),
        ...(creatorName ? { author: { "@type": "Person", name: creatorName } } : {}),
        ...(coverUrl ? { image: coverUrl } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Beranda", item: siteUrl.toString() },
          { "@type": "ListItem", position: 2, name: initialComic.title, item: canonicalUrl },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <ComicDetailPage key={slug} {...props} />
    </>
  );
}
