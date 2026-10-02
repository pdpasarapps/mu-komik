import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";
import { NextRequest, NextResponse } from "next/server";

const allowedContentTypes = ["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"];

async function authorize(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { response: NextResponse.json({ error: "Supabase environment variables are missing" }, { status: 500 }) };
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) {
    return { response: NextResponse.json({ error: "Could not read creator profile" }, { status: 500 }) };
  }
  if (profile?.role !== "creator" && profile?.role !== "admin") {
    return { response: NextResponse.json({ error: "Creator access required" }, { status: 403 }) };
  }

  return { supabase, userId: userData.user.id };
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
    const accountId = process.env.R2_ACCOUNT_ID;
    const bucketName = process.env.R2_BUCKET_NAME;
    const missing = ["R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]
      .filter((name) => !process.env[name]);
    if (missing.length) {
      return NextResponse.json({ error: "R2 environment variables are missing", missing }, { status: 500 });
    }

    const auth = await authorize(request);
    if ("response" in auth) return auth.response;

    const body = await request.json() as { comicId?: string; filename?: string; contentType?: string };
    if (!body.comicId || !body.filename || body.filename.length > 180 || !allowedContentTypes.includes(body.contentType || "")) {
      return NextResponse.json({ error: "Invalid cover upload details" }, { status: 400 });
    }

    const { data: comic } = await auth.supabase
      .from("comics")
      .select("id")
      .eq("id", body.comicId)
      .eq("creator_id", auth.userId)
      .maybeSingle();
    if (!comic) {
      return NextResponse.json({ error: "Comic not found" }, { status: 404 });
    }

    const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
    const objectKey = `comics/${comic.id}/cover/${crypto.randomUUID()}-${safeName}`;
    const objectUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${objectKey}`;
    const signer = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      service: "s3",
      region: "auto",
    });
    const signedRequest = await signer.sign(objectUrl, {
      method: "PUT",
      headers: { "Content-Type": body.contentType! },
      aws: { signQuery: true },
    });

    return NextResponse.json({ uploadUrl: signedRequest.url, objectKey });
  } catch (error) {
    console.error("R2 comic cover upload URL error", error);
    return NextResponse.json({ error: "Could not prepare comic cover upload" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const requiredEnv = ["R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
    const missing = requiredEnv.filter((name) => !process.env[name]);
    if (missing.length) {
      return NextResponse.json({ error: "R2 environment variables are missing", missing }, { status: 500 });
    }

    const auth = await authorize(request);
    if ("response" in auth) return auth.response;

    const body = await request.json() as { comicId?: string; objectKey?: string };
    if (!body.comicId || !body.objectKey) {
      return NextResponse.json({ error: "Comic and cover key are required" }, { status: 400 });
    }

    const { data: comic } = await auth.supabase
      .from("comics")
      .select("id, cover_key")
      .eq("id", body.comicId)
      .eq("creator_id", auth.userId)
      .maybeSingle();
    if (!comic) {
      return NextResponse.json({ error: "Comic not found" }, { status: 404 });
    }

    if (!body.objectKey.startsWith(`comics/${comic.id}/cover/`) || body.objectKey === comic.cover_key) {
      return NextResponse.json({ error: "Invalid or active cover key" }, { status: 400 });
    }

    await createStorageClient().send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: body.objectKey,
    }));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("R2 comic cover cleanup error", error);
    return NextResponse.json({ error: "Could not delete old comic cover" }, { status: 500 });
  }
}
