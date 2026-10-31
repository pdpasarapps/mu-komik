import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  ANALYTICS_VISITOR_COOKIE_MAX_AGE_SECONDS,
  ANALYTICS_VISITOR_COOKIE_NAME,
  createVisitorId,
  isVisitorId,
} from "@/lib/visitor-cookie";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requestTimeoutMs = 8000;
const maximumLastPage = 5000;

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
  if (!body || typeof body !== "object"
    || !("chapterId" in body) || typeof body.chapterId !== "string" || !uuidPattern.test(body.chapterId)
    || !("lastPage" in body) || typeof body.lastPage !== "number" || !Number.isInteger(body.lastPage)
    || body.lastPage < 0 || body.lastPage > maximumLastPage) {
    return NextResponse.json({ error: "A valid chapter ID and page number are required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Unable to record guest reading progress: Supabase URL or service-role key is missing.");
    return NextResponse.json({ error: "Guest reading storage is not configured" }, { status: 500 });
  }

  const existingVisitorId = request.cookies.get(ANALYTICS_VISITOR_COOKIE_NAME)?.value;
  const visitorId = isVisitorId(existingVisitorId) ? existingVisitorId : createVisitorId();
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await serviceClient.rpc("record_guest_chapter_read", {
    p_visitor_id: visitorId,
    p_chapter_id: body.chapterId,
    p_last_page: body.lastPage,
  }).abortSignal(AbortSignal.timeout(requestTimeoutMs));

  if (error) {
    const errorMessage = error.message || "Supabase returned an empty guest reading error";
    console.error("Unable to record guest reading progress:", {
      code: error.code || "UNKNOWN",
      message: errorMessage,
      details: error.details || null,
      hint: error.hint || null,
    });
    const isMissingSetup = error.code === "42883" || error.code === "42P01" || error.code === "PGRST202"
      || errorMessage.includes("record_guest_chapter_read")
      || errorMessage.includes("guest_chapter_reads");
    if (isMissingSetup) {
      return NextResponse.json({ error: "Guest reading storage is not ready" }, { status: 503 });
    }
    const normalizedMessage = errorMessage.toLowerCase();
    const isTimeout = error.code === "57014"
      || normalizedMessage.includes("timeout")
      || normalizedMessage.includes("timed out")
      || normalizedMessage.includes("abort");
    return NextResponse.json(
      { error: "Guest reading progress could not be recorded" },
      { status: isTimeout ? 503 : 500 },
    );
  }

  const result = data && typeof data === "object"
    ? data as { recorded?: boolean; reason?: string; guest_limit?: number }
    : {};
  const response = NextResponse.json({
    recorded: result.recorded === true,
    reason: typeof result.reason === "string" ? result.reason : null,
    guestLimit: typeof result.guest_limit === "number" ? result.guest_limit : null,
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
