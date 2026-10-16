import { NextResponse, type NextRequest } from "next/server";

const canonicalHostname = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://mu-komik.com").hostname;

export function proxy(request: NextRequest) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const cloudflareVisitor = request.headers.get("cf-visitor");
  const isHttpRequest = request.nextUrl.protocol === "http:"
    || forwardedProtocol === "http"
    || (cloudflareVisitor !== null && /"scheme"\s*:\s*"http"/i.test(cloudflareVisitor));

  if (request.nextUrl.hostname !== canonicalHostname || !isHttpRequest) {
    return NextResponse.next();
  }

  const secureUrl = request.nextUrl.clone();
  secureUrl.protocol = "https:";
  return NextResponse.redirect(secureUrl, 308);
}

export const config = {
  matcher: "/:path*",
};
