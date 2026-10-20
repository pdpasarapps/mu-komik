import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { parsePageTextOverlayDocument } from "@/lib/page-text-overlays";
import { getPlatformSettings } from "@/lib/platform-settings";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "R2_ACCOUNT_ID",
  "R2_BUCKET_NAME",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
] as const;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
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

async function authorizePage(request: NextRequest, pageId: string) {
  const missing = requiredEnvironment.filter((name) => !process.env[name]);
  if (missing.length) return { response: errorResponse(`Server storage is not configured: ${missing.join(", ")}`, 500) };
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return { response: errorResponse("Unauthorized", 401) };
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { response: errorResponse("Unauthorized", 401) };
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profileError) return { response: errorResponse("Could not read user profile", 500) };
  if (profile?.role !== "creator" && profile?.role !== "admin") return { response: errorResponse("Creator access required", 403) };
  const { settings, error: settingsError } = await getPlatformSettings();
  if (settingsError) return { response: errorResponse("Platform settings are unavailable. Try again later.", 503) };
  if (profile.role !== "admin" && !settings.feature_flags.creators) {
    return { response: errorResponse("Creator uploads are temporarily disabled.", 403) };
  }

  const { data: page, error: pageError } = await supabase.from("pages")
    .select("id, chapter_id, text_overlays")
    .eq("id", pageId)
    .maybeSingle();
  if (pageError) return { response: errorResponse("Could not verify comic page", 500) };
  if (!page) return { response: errorResponse("Comic page not found", 404) };
  const { data: chapter, error: chapterError } = await supabase.from("chapters")
    .select("id, comic_id")
    .eq("id", page.chapter_id)
    .maybeSingle();
  if (chapterError) return { response: errorResponse("Could not verify episode", 500) };
  if (!chapter) return { response: errorResponse("Episode not found", 404) };
  let comicQuery = supabase.from("comics").select("id").eq("id", chapter.comic_id);
  if (profile.role !== "admin") comicQuery = comicQuery.eq("creator_id", userData.user.id);
  const { data: comic, error: comicError } = await comicQuery.maybeSingle();
  if (comicError) return { response: errorResponse("Could not verify comic ownership", 500) };
  if (!comic) return { response: errorResponse("Comic not found", 404) };
  return { page, prefix: `comics/${comic.id}/chapters/${chapter.id}/pages/${page.id}/interactive/` };
}

function isMp3(bytes: Uint8Array) {
  return bytes.length >= 3 && (
    bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33
    || bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0
  );
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = request.headers.get("content-length");
    const declaredLength = contentLength === null ? null : Number(contentLength);
    if (declaredLength !== null && (!Number.isFinite(declaredLength) || declaredLength <= 0 || declaredLength > MAX_AUDIO_BYTES + 64 * 1024)) {
      return errorResponse("Suara interaktif harus berukuran maksimal 10 MB.", 413);
    }
    const form = await request.formData();
    const pageId = form.get("pageId");
    const file = form.get("file");
    if (typeof pageId !== "string" || !(file instanceof File)) return errorResponse("Data unggahan suara tidak valid.", 400);
    if (file.size <= 0 || file.size > MAX_AUDIO_BYTES) return errorResponse("Suara interaktif harus berukuran antara 1 byte dan 10 MB.", 413);
    if (!file.name.toLocaleLowerCase("id-ID").endsWith(".mp3")) {
      return errorResponse("Format suara interaktif yang didukung adalah MP3.", 415);
    }
    const authorized = await authorizePage(request, pageId);
    if ("response" in authorized) return authorized.response;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isMp3(bytes)) return errorResponse("Isi berkas tidak sesuai dengan format MP3.", 415);
    const objectKey = `${authorized.prefix}${crypto.randomUUID()}.mp3`;
    await createStorageClient().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: objectKey,
      Body: bytes,
      ContentType: "audio/mpeg",
      ContentLength: file.size,
    }));
    return NextResponse.json({ objectKey }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Interactive page audio upload failed:", error);
    return errorResponse(error instanceof Error ? error.message : "Interactive page audio upload failed.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > 16 * 1024) return errorResponse("Request body is too large", 413);
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return errorResponse("Invalid JSON request body", 400);
    }
    if (!body || typeof body !== "object" || !("pageId" in body) || typeof body.pageId !== "string"
      || !("objectKey" in body) || typeof body.objectKey !== "string") {
      return errorResponse("Data penghapusan suara tidak valid.", 400);
    }
    const authorized = await authorizePage(request, body.pageId);
    if ("response" in authorized) return authorized.response;
    if (!body.objectKey.startsWith(authorized.prefix)
      || !/^[a-f0-9-]{36}\.mp3$/i.test(body.objectKey.slice(authorized.prefix.length))) {
      return errorResponse("Kunci penyimpanan suara tidak valid.", 400);
    }
    let savedMarkers;
    try {
      savedMarkers = parsePageTextOverlayDocument(authorized.page.text_overlays).interactiveMarkers;
    } catch (error) {
      console.error("Unable to check saved page markers before audio cleanup:", error);
      return errorResponse("Data area interaktif halaman belum dapat diverifikasi.", 500);
    }
    if (savedMarkers.some((marker) => marker.soundObjectKey === body.objectKey)) {
      return errorResponse("Suara masih digunakan oleh marker tersimpan.", 409);
    }
    await createStorageClient().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: body.objectKey }));
    return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Interactive page audio cleanup failed:", error);
    return errorResponse(error instanceof Error ? error.message : "Interactive page audio cleanup failed.", 500);
  }
}
