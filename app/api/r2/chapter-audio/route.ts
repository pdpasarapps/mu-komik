import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { parseChapterSubtitles } from "@/lib/chapter-subtitles";
import { getPlatformSettings } from "@/lib/platform-settings";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const AUDIO_URL_EXPIRY_SECONDS = 5 * 60;

type AudioRequest = {
  action: "prepare" | "save" | "delete" | "discard";
  comicId: string;
  chapterId: string;
  audioName?: string;
  audioSize?: number;
  objectKey?: string;
  subtitlesSrt?: string;
  pageMap?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function readRequest(value: unknown): AudioRequest | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Partial<AudioRequest>;
  if (!["prepare", "save", "delete", "discard"].includes(body.action ?? "")) return null;
  if (typeof body.comicId !== "string" || typeof body.chapterId !== "string") return null;
  if (body.action === "prepare" && (
    !Number.isSafeInteger(body.audioSize)
    || typeof body.audioName !== "string"
    || typeof body.subtitlesSrt !== "string"
    || !body.pageMap
  )) return null;
  if (body.action === "save" && (typeof body.objectKey !== "string" || typeof body.subtitlesSrt !== "string" || !body.pageMap)) return null;
  return body as AudioRequest;
}

function createStorageClient() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const requiredEnv = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "R2_ACCOUNT_ID",
      "R2_BUCKET_NAME",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
    ] as const;
    const missing = requiredEnv.filter((name) => !process.env[name]);
    if (missing.length) return errorResponse(`Server storage is not configured: ${missing.join(", ")}`, 500);

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return errorResponse("Unauthorized", 401);
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return errorResponse("Unauthorized", 401);
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if (profileError) return errorResponse("Could not read user profile", 500);
    if (profile?.role !== "creator" && profile?.role !== "admin") return errorResponse("Creator access required", 403);
    const { settings, error: settingsError } = await getPlatformSettings();
    if (settingsError) return errorResponse("Platform settings are unavailable. Try again later.", 503);
    if (profile.role !== "admin" && !settings.feature_flags.creators) {
      return errorResponse("Creator uploads are temporarily disabled.", 403);
    }

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > 3 * 1024 * 1024) return errorResponse("Request body is too large", 413);
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return errorResponse("Invalid JSON request body", 400);
    }
    const body = readRequest(parsedBody);
    if (!body) return errorResponse("Invalid audio request details", 400);

    let comicQuery = supabase.from("comics").select("id").eq("id", body.comicId);
    if (profile.role !== "admin") comicQuery = comicQuery.eq("creator_id", userData.user.id);
    const { data: comic, error: comicError } = await comicQuery.maybeSingle();
    if (comicError) return errorResponse("Could not verify comic ownership", 500);
    if (!comic) return errorResponse("Comic not found", 404);
    const { data: chapter, error: chapterError } = await supabase
      .from("chapters")
      .select("id, audio_object_key")
      .eq("id", body.chapterId)
      .eq("comic_id", comic.id)
      .maybeSingle();
    if (chapterError) return errorResponse("Could not verify chapter", 500);
    if (!chapter) return errorResponse("Chapter not found", 404);

    const objectPrefix = `comics/${comic.id}/chapters/${chapter.id}/audio/`;
    const storage = createStorageClient();
    if (body.action === "prepare") {
      if (!Number.isSafeInteger(body.audioSize) || body.audioSize! <= 0 || body.audioSize! > MAX_AUDIO_BYTES) {
        return errorResponse("File MP3 harus berukuran antara 1 byte dan 50 MB.", 413);
      }
      if (body.audioName!.length > 255 || !body.audioName!.toLocaleLowerCase("id-ID").endsWith(".mp3")) return errorResponse("Pilih file MP3 dengan nama berkas yang valid.", 415);
      let cues;
      try {
        cues = parseChapterSubtitles(body.subtitlesSrt!, body.pageMap);
      } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "Subtitle tidak valid.", 400);
      }
      const { data: pages, error: pagesError } = await supabase.from("pages").select("id").eq("chapter_id", chapter.id);
      if (pagesError) return errorResponse("Could not verify episode pages", 500);
      const pageIds = new Set((pages ?? []).map((page) => page.id));
      if (cues.some((cue) => !pageIds.has(cue.pageId))) return errorResponse("Sidecar memetakan cue ke halaman yang bukan bagian dari episode ini.", 400);
      const objectKey = `${objectPrefix}${crypto.randomUUID()}.mp3`;
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: objectKey,
        ContentType: "audio/mpeg",
        ContentLength: body.audioSize,
      });
      const uploadUrl = await getSignedUrl(storage, command, { expiresIn: AUDIO_URL_EXPIRY_SECONDS });
      return NextResponse.json({ uploadUrl, objectKey, expiresIn: AUDIO_URL_EXPIRY_SECONDS }, { headers: { "Cache-Control": "no-store" } });
    }

    if (body.action === "discard") {
      if (typeof body.objectKey !== "string" || !body.objectKey.startsWith(objectPrefix)
        || !/^[a-f0-9-]{36}\.mp3$/i.test(body.objectKey.slice(objectPrefix.length))) {
        return errorResponse("Invalid audio storage key", 400);
      }
      if (body.objectKey === chapter.audio_object_key) return errorResponse("Cannot discard audio currently attached to chapter.", 409);
      await storage.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: body.objectKey }));
      return NextResponse.json({ deleted: true });
    }

    if (body.action === "delete") {
      const previousKey = chapter.audio_object_key;
      const { error: updateError } = await supabase.from("chapters")
        .update({ audio_object_key: null, subtitles_srt: null, subtitle_page_map: null })
        .eq("id", chapter.id)
        .eq("comic_id", comic.id);
      if (updateError) return errorResponse("Audio episode tidak dapat dihapus.", 500);
      if (!previousKey) return NextResponse.json({ deleted: true, storageCleanupPending: false });
      if (!previousKey.startsWith(objectPrefix)) {
        console.error("Chapter audio has an invalid R2 key:", { chapterId: chapter.id });
        return NextResponse.json({ deleted: true, storageCleanupPending: true });
      }
      try {
        await storage.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: previousKey }));
        return NextResponse.json({ deleted: true, storageCleanupPending: false });
      } catch (error) {
        console.error("Could not remove chapter audio from R2:", error);
        return NextResponse.json({ deleted: true, storageCleanupPending: true });
      }
    }

    if (!body.objectKey!.startsWith(objectPrefix) || !/^[a-f0-9-]{36}\.mp3$/i.test(body.objectKey!.slice(objectPrefix.length))) {
      return errorResponse("Invalid audio storage key", 400);
    }
    let cues;
    try {
      cues = parseChapterSubtitles(body.subtitlesSrt!, body.pageMap);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : "Subtitle tidak valid.", 400);
    }
    const { data: pages, error: pagesError } = await supabase.from("pages").select("id").eq("chapter_id", chapter.id);
    if (pagesError) return errorResponse("Could not verify episode pages", 500);
    const pageIds = new Set((pages ?? []).map((page) => page.id));
    if (cues.some((cue) => !pageIds.has(cue.pageId))) return errorResponse("Sidecar memetakan cue ke halaman yang bukan bagian dari episode ini.", 400);

    const { ContentLength, ContentType } = await storage.send(new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: body.objectKey,
    }));
    if (!Number.isSafeInteger(ContentLength) || ContentLength! <= 0 || ContentLength! > MAX_AUDIO_BYTES || ContentType !== "audio/mpeg") {
      return errorResponse("File audio di R2 tidak valid atau melebihi batas 50 MB.", 415);
    }

    const { error: updateError } = await supabase.from("chapters").update({
      audio_object_key: body.objectKey,
      subtitles_srt: body.subtitlesSrt,
      subtitle_page_map: body.pageMap,
    }).eq("id", chapter.id).eq("comic_id", comic.id);
    if (updateError) {
      if (body.objectKey !== chapter.audio_object_key) {
        try {
          await storage.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: body.objectKey }));
        } catch (cleanupError) {
          console.error("Could not remove unregistered chapter audio from R2:", cleanupError);
        }
      }
      return errorResponse("Audio episode tidak dapat disimpan.", 500);
    }

    const previousKey = chapter.audio_object_key;
    let storageCleanupPending = false;
    if (previousKey && previousKey !== body.objectKey) {
      if (!previousKey.startsWith(objectPrefix)) {
        storageCleanupPending = true;
        console.error("Replaced chapter audio has an invalid R2 key:", { chapterId: chapter.id });
      } else {
        try {
          await storage.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: previousKey }));
        } catch (error) {
          storageCleanupPending = true;
          console.error("Could not remove replaced chapter audio from R2:", error);
        }
      }
    }
    return NextResponse.json({ saved: true, objectKey: body.objectKey, cueCount: cues.length, storageCleanupPending });
  } catch (error) {
    console.error("Chapter audio request failed:", error);
    return errorResponse(error instanceof Error ? error.message : "Chapter audio request failed.", 500);
  }
}
