import { NextResponse, type NextRequest } from "next/server";
import {
  ANALYTICS_VISITOR_COOKIE_MAX_AGE_SECONDS,
  ANALYTICS_VISITOR_COOKIE_NAME,
  createVisitorId,
  isVisitorId,
} from "@/lib/visitor-cookie";

const canonicalHostname = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://mu-komik.com").hostname;

function visitorCookie(request: NextRequest, value: string) {
  return {
    name: ANALYTICS_VISITOR_COOKIE_NAME,
    value,
    httpOnly: true,
    maxAge: ANALYTICS_VISITOR_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: request.nextUrl.protocol === "https:",
  };
}

export function proxy(request: NextRequest) {
  const existingVisitorId = request.cookies.get(ANALYTICS_VISITOR_COOKIE_NAME)?.value;
  const visitorId = isVisitorId(existingVisitorId) ? existingVisitorId : createVisitorId();
  const shouldSetVisitor = visitorId !== existingVisitorId;

  if (shouldSetVisitor) request.cookies.set(ANALYTICS_VISITOR_COOKIE_NAME, visitorId);

  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const cloudflareVisitor = request.headers.get("cf-visitor");
  const isHttpRequest = request.nextUrl.protocol === "http:"
    || forwardedProtocol === "http"
    || (cloudflareVisitor !== null && /"scheme"\s*:\s*"http"/i.test(cloudflareVisitor));

  let response: NextResponse;
  if (request.nextUrl.hostname !== canonicalHostname || !isHttpRequest) {
    response = NextResponse.next({ request });
  } else {
    const secureUrl = request.nextUrl.clone();
    secureUrl.protocol = "https:";
    response = NextResponse.redirect(secureUrl, 308);
  }

  if (shouldSetVisitor) {
    const cookie = visitorCookie(request, visitorId);
    response.cookies.set(cookie.name, cookie.value, cookie);
  }

  return response;
}

export const config = {
  matcher: "/:path*",
};
