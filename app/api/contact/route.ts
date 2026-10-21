import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  const email = typeof fields.email === "string" ? fields.email.trim() : "";
  const subject = typeof fields.subject === "string" ? fields.subject.trim() : "";
  const message = typeof fields.message === "string" ? fields.message.trim() : "";
  if (name.length < 2 || name.length > 100
    || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || subject.length < 3 || subject.length > 160
    || message.length < 10 || message.length > 5000) {
    return errorResponse("Please check the required fields and try again.", 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Contact form is unavailable because Supabase server credentials are missing.");
    return errorResponse("Contact form is temporarily unavailable. Please try again later.", 503);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.from("contact_messages").insert({ name, email, subject, message });
  if (error) {
    console.error("Unable to store contact form message:", error);
    return errorResponse("Message could not be sent. Please try again later.", 500);
  }
  return NextResponse.json({ success: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
