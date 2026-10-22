import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isContactCategory } from "@/lib/contact-categories";

const maxBodySize = 12 * 1024;

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return errorResponse("Cross-site requests are not allowed.", 403);
  }
  try {
    if (new URL(origin).host !== request.headers.get("host")) {
      return errorResponse("Cross-origin requests are not allowed.", 403);
    }
  } catch {
    return errorResponse("Invalid request origin.", 403);
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return errorResponse("Sign in is required to send a contact message.", 401);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Contact form is unavailable because Supabase server credentials are missing.");
    return errorResponse("Contact form is temporarily unavailable. Please try again later.", 503);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData.user?.email) return errorResponse("A valid signed-in account is required.", 401);

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBodySize) return errorResponse("Message is too large.", 413);
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > maxBodySize) return errorResponse("Message is too large.", 413);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("Invalid request body.", 400);
  }
  if (!body || typeof body !== "object") return errorResponse("Invalid request body.", 400);
  const fields = body as Record<string, unknown>;
  if (typeof fields.website === "string" && fields.website.trim()) {
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  }
  const category = fields.category;
  const subject = typeof fields.subject === "string" ? fields.subject.trim() : "";
  const message = typeof fields.message === "string" ? fields.message.trim() : "";
  if (!isContactCategory(category)
    || subject.length < 3 || subject.length > 160
    || message.length < 10 || message.length > 5000) {
    return errorResponse("Please check the required fields and try again.", 400);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("display_name")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Unable to load contact message sender profile:", profileError);
    return errorResponse("Your account profile could not be verified. Please try again later.", 500);
  }
  const name = profile?.display_name?.trim() ?? "";
  const email = userData.user.email.trim();
  if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse("Your account needs a valid name and email address to send a message.", 400);
  }

  const { error } = await serviceClient.from("contact_messages").insert({
    user_id: userData.user.id,
    name,
    email,
    category,
    subject,
    message,
  });
  if (error) {
    console.error("Unable to store contact form message:", error);
    return errorResponse("Message could not be sent. Please try again later.", 500);
  }
  return NextResponse.json({ success: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
