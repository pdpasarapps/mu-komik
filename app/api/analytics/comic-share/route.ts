import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  ANALYTICS_VISITOR_COOKIE_MAX_AGE_SECONDS,
  ANALYTICS_VISITOR_COOKIE_NAME,
  createVisitorId,
  isVisitorId,
} from "@/lib/visitor-cookie";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const analyticsRequestTimeoutMs = 8000;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Cross-site requests are not allowed" }, { status: 403 });
  }
  try {
    if (new URL(origin).host !== request.headers.get("host")) {
      return NextResponse.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 1024) {
    return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("comicId" in body)
    || typeof body.comicId !== "string" || !uuidPattern.test(body.comicId)) {
    return NextResponse.json({ error: "A valid comic ID is required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Unable to record a comic share: Supabase URL or service-role key is missing.");
    return NextResponse.json({ error: "Analytics storage is not configured" }, { status: 500 });
  }

  const existingVisitorId = request.cookies.get(ANALYTICS_VISITOR_COOKIE_NAME)?.value;
  const visitorId = isVisitorId(existingVisitorId) ? existingVisitorId : createVisitorId();
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await serviceClient.rpc("record_comic_share", {
    p_comic_id: body.comicId,
    p_visitor_id: visitorId,
  }).abortSignal(AbortSignal.timeout(analyticsRequestTimeoutMs));

  if (error) {
    const errorMessage = error.message || "Supabase returned an empty share error";
    console.error("Unable to record a comic share:", {
      code: error.code || "UNKNOWN",
      message: errorMessage,
      details: error.details || null,
      hint: error.hint || null,
    });
    const isMissingSetup = error.code === "42883" || error.code === "PGRST202"
      || errorMessage.includes("record_comic_share");
    if (isMissingSetup) {
      return NextResponse.json({ error: "Share analytics storage is not ready" }, { status: 503 });
    }
    const normalizedMessage = errorMessage.toLowerCase();
    const isTimeout = error.code === "57014"
      || normalizedMessage.includes("timeout")
      || normalizedMessage.includes("timed out")
      || normalizedMessage.includes("abort");
    return NextResponse.json(
      { error: "Comic share could not be recorded" },
      { status: isTimeout ? 503 : 500 },
    );
  }

  const result = data && typeof data === "object"
    ? data as { recorded?: boolean; reason?: string }
    : {};
  const response = NextResponse.json({
    recorded: result.recorded === true,
    reason: typeof result.reason === "string" ? result.reason : null,
  }, { headers: { "Cache-Control": "no-store" } });
  if (!isVisitorId(existingVisitorId)) {
    response.cookies.set(ANALYTICS_VISITOR_COOKIE_NAME, visitorId, {
      httpOnly: true,
      maxAge: ANALYTICS_VISITOR_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }
  return response;
}
