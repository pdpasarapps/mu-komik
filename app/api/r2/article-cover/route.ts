import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getPlatformSettings, matchesImageContentType } from "@/lib/platform-settings";

export const runtime = "nodejs";

async function authorize(request: NextRequest) {
  const requiredEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length) return { response: NextResponse.json({ error: "Supabase environment variables are missing", missing }, { status: 500 }) };

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, staff_permissions")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) return { response: NextResponse.json({ error: "Could not read user profile" }, { status: 500 }) };
  if (profile?.role !== "admin"
    && !(profile?.role === "staff" && Array.isArray(profile.staff_permissions) && profile.staff_permissions.includes("articles"))) {
    return { response: NextResponse.json({ error: "Article management access required" }, { status: 403 }) };
  }
  return { supabase };
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
    const requiredEnv = ["R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
    const missing = requiredEnv.filter((name) => !process.env[name]);
    if (missing.length) return NextResponse.json({ error: "Server storage is not configured", missing }, { status: 500 });

    const auth = await authorize(request);
    if ("response" in auth) return auth.response;

    const { settings, error: settingsError } = await getPlatformSettings();
    if (settingsError) return NextResponse.json({ error: "Platform limits are unavailable. Try again later." }, { status: 503 });
    const contentLength = request.headers.get("content-length");
    if (!contentLength) return NextResponse.json({ error: "Content-Length is required for image uploads." }, { status: 411 });
    const declaredLength = Number(contentLength);
    const maximumBytes = settings.max_upload_size_mb * 1024 * 1024;
    if (!Number.isFinite(declaredLength) || declaredLength <= 0) return NextResponse.json({ error: "Invalid image upload size." }, { status: 400 });
    if (declaredLength > maximumBytes + 64 * 1024) return NextResponse.json({ error: `Each image must be ${settings.max_upload_size_mb} MB or smaller.` }, { status: 413 });

    const form = await request.formData();
    const articleId = form.get("articleId");
    const file = form.get("file");
    if (typeof articleId !== "string" || !/^[0-9a-f-]{36}$/i.test(articleId) || !(file instanceof File)) {
      return NextResponse.json({ error: "A valid article and cover image are required." }, { status: 400 });
    }
    const { data: article, error: articleError } = await auth.supabase
      .from("articles")
      .select("id")
      .eq("id", articleId)
      .maybeSingle();
    if (articleError) return NextResponse.json({ error: "Could not verify article" }, { status: 500 });
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    if (!settings.allowed_image_types.includes(file.type)) {
      return NextResponse.json({ error: `Image format is not allowed. Allowed: ${settings.allowed_image_types.map((type) => type.replace("image/", "").toUpperCase()).join(", ")}.` }, { status: 415 });
    }
    if (file.size === 0 || file.size > maximumBytes) {
      return NextResponse.json({ error: `Each image must be between 1 byte and ${settings.max_upload_size_mb} MB.` }, { status: 413 });
    }
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesImageContentType(file.type, fileBytes)) {
      return NextResponse.json({ error: "Image content does not match its declared format." }, { status: 415 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-140) || "cover";
    const objectKey = `articles/${articleId}/cover/${crypto.randomUUID()}-${safeName}`;
    await createStorageClient().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: objectKey,
      Body: fileBytes,
      ContentType: file.type,
      ContentLength: file.size,
    }));
    return NextResponse.json({ objectKey });
  } catch (error) {
    console.error("Article cover upload failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Article cover upload failed." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const requiredEnv = ["R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
    const missing = requiredEnv.filter((name) => !process.env[name]);
    if (missing.length) return NextResponse.json({ error: "Server storage is not configured", missing }, { status: 500 });
    const auth = await authorize(request);
    if ("response" in auth) return auth.response;

    const body = await request.json() as { articleId?: string; objectKey?: string };
    if (!body.articleId || !/^[0-9a-f-]{36}$/i.test(body.articleId) || !body.objectKey) {
      return NextResponse.json({ error: "Article and cover key are required" }, { status: 400 });
    }
    const { data: article, error: articleError } = await auth.supabase
      .from("articles")
      .select("id, cover_key")
      .eq("id", body.articleId)
      .maybeSingle();
    if (articleError) return NextResponse.json({ error: "Could not verify article" }, { status: 500 });
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    if (!body.objectKey.startsWith(`articles/${article.id}/cover/`) || body.objectKey === article.cover_key) {
      return NextResponse.json({ error: "Invalid or active cover key" }, { status: 400 });
    }

    await createStorageClient().send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: body.objectKey,
    }));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Article cover cleanup failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Article cover cleanup failed." }, { status: 500 });
  }
}
