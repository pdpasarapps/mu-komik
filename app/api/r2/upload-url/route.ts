import { NextRequest, NextResponse } from "next/server";
import { AwsClient } from "aws4fetch";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const requiredR2 = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] as const;
    const missingR2 = requiredR2.filter((name) => !process.env[name]);
    if (missingR2.length) {
      return NextResponse.json({ error: "R2 environment variables are missing", missing: missingR2 }, { status: 500 });
    }
    const accountId = process.env.R2_ACCOUNT_ID!;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
    const bucketName = process.env.R2_BUCKET_NAME!;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Supabase environment variables are missing" }, { status: 500 });
    }

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
    const objectUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${objectKey}`;
    const signer = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: "auto",
    });
    const signedRequest = await signer.sign(objectUrl, {
      method: "PUT",
      headers: { "Content-Type": body.contentType },
      aws: { signQuery: true },
    });

    return NextResponse.json({ uploadUrl: signedRequest.url, objectKey });
  } catch (error) {
    console.error("R2 upload URL error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create upload URL" }, { status: 500 });
  }
}
