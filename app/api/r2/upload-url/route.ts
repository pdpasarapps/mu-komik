import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authorization.slice("Bearer ".length);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if (profileError) {
      return NextResponse.json({ error: "Could not read creator profile", detail: profileError.message }, { status: 500 });
    }
    if (profile?.role !== "creator" && profile?.role !== "admin") {
      return NextResponse.json({ error: "Creator access required", role: profile?.role || "profile-not-found" }, { status: 403 });
    }

    const body = await request.json() as { comicId?: string; chapterId?: string; filename?: string; contentType?: string };
    if (!body.comicId || !body.chapterId || !body.filename || !body.contentType?.startsWith("image/")) {
      return NextResponse.json({ error: "Invalid upload details" }, { status: 400 });
    }

    const comicQuery = supabase.from("comics").select("id").eq("id", body.comicId);
    const { data: comic } = profile.role === "admin"
      ? await comicQuery.maybeSingle()
      : await comicQuery.eq("creator_id", userData.user.id).maybeSingle();
    if (!comic) {
      return NextResponse.json({ error: "Comic not found" }, { status: 404 });
    }

    const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
    const objectKey = `comics/${body.comicId}/chapters/${body.chapterId}/${crypto.randomUUID()}-${safeName}`;
    const command = new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: objectKey, ContentType: body.contentType });
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 600 });

    return NextResponse.json({ uploadUrl, objectKey });
  } catch (error) {
    console.error("R2 upload URL error", error);
    return NextResponse.json({ error: "Could not create upload URL" }, { status: 500 });
  }
}
