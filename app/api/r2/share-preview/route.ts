import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";
import { NextRequest, NextResponse } from "next/server";
import { getComicSharePreviewKey } from "@/lib/comic-share-preview";

const coverKeyPattern = /^comics\/[0-9a-f-]{36}\/cover\/[a-zA-Z0-9._-]+$/i;

async function authorize(request: NextRequest, comicId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { response: NextResponse.json({ error: "Supabase environment variables are missing" }, { status: 500 }) };
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(authorization.slice("Bearer ".length));
  if (userError || !userData.user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) {
    return { response: NextResponse.json({ error: "Could not read user profile" }, { status: 500 }) };
  }
  if (profile?.role !== "creator" && profile?.role !== "admin") {
    return { response: NextResponse.json({ error: "Creator access required" }, { status: 403 }) };
  }

  const { data: comic, error: comicError } = await supabase
    .from("comics")
    .select("id, creator_id")
    .eq("id", comicId)
    .maybeSingle();
  if (comicError) {
    return { response: NextResponse.json({ error: "Could not verify comic ownership" }, { status: 500 }) };
  }
  if (!comic || (profile.role !== "admin" && comic.creator_id !== userData.user.id)) {
    return { response: NextResponse.json({ error: "Comic not found" }, { status: 404 }) };
  }

  return { comic };
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
    const missing = ["R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]
      .filter((name) => !process.env[name]);
    if (missing.length) {
      return NextResponse.json({ error: "R2 environment variables are missing", missing }, { status: 500 });
    }

    const body = await request.json() as { comicId?: string; coverKey?: string };
    if (!body.comicId || !/^[0-9a-f-]{36}$/i.test(body.comicId)
      || !body.coverKey || !coverKeyPattern.test(body.coverKey)
      || !body.coverKey.startsWith(`comics/${body.comicId}/cover/`)) {
      return NextResponse.json({ error: "Invalid comic share preview details" }, { status: 400 });
    }

    const auth = await authorize(request, body.comicId);
    if ("response" in auth) return auth.response;

    const objectKey = getComicSharePreviewKey(body.comicId, body.coverKey);
    const objectUrl = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${objectKey}`;
    const uploadHeaders = {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    };
    const signer = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      service: "s3",
      region: "auto",
    });
    const signedRequest = await signer.sign(objectUrl, {
      method: "PUT",
      headers: uploadHeaders,
      aws: { signQuery: true },
    });
    return NextResponse.json({ uploadUrl: signedRequest.url, objectKey, headers: uploadHeaders });
  } catch (error) {
    console.error("Comic share preview upload URL error:", error);
    return NextResponse.json({ error: "Could not prepare comic share preview upload" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const missing = ["R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]
      .filter((name) => !process.env[name]);
    if (missing.length) {
      return NextResponse.json({ error: "R2 environment variables are missing", missing }, { status: 500 });
    }
    const body = await request.json() as { comicId?: string; coverKey?: string; previewKey?: string };
    if (!body.comicId || !/^[0-9a-f-]{36}$/i.test(body.comicId)
      || !body.coverKey || !coverKeyPattern.test(body.coverKey)
      || !body.coverKey.startsWith(`comics/${body.comicId}/cover/`)
      || !body.previewKey
      || body.previewKey !== getComicSharePreviewKey(body.comicId, body.coverKey)) {
      return NextResponse.json({ error: "Invalid comic share preview details" }, { status: 400 });
    }

    const auth = await authorize(request, body.comicId);
    if ("response" in auth) return auth.response;

    await createStorageClient().send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: body.previewKey,
    }));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Comic share preview cleanup error:", error);
    return NextResponse.json({ error: "Could not delete comic share preview" }, { status: 500 });
  }
}
