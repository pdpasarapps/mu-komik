import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type GoogleReport = {
  rows?: {
    dimensionValues?: { value?: string }[];
    metricValues?: { value?: string }[];
  }[];
};

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function getGoogleAccessToken(email: string, privateKey: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const unsignedToken = [
    encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    encodeBase64Url(JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: issuedAt,
      exp: issuedAt + 3600,
    })),
  ].join(".");
  const pemBody = privateKey.match(/-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/)?.[1];
  if (!pemBody) throw new Error("Google Analytics private key must use PKCS#8 format");
  const signingKey = await crypto.subtle.importKey(
    "pkcs8",
    new Uint8Array(Buffer.from(pemBody.replace(/\s/g, ""), "base64")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${Buffer.from(signature).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  const data: unknown = await response.json();
  if (!response.ok || !isRecord(data) || typeof data.access_token !== "string") {
    console.error("Google Analytics service-account authentication failed:", response.status);
    throw new Error("Google Analytics authentication failed");
  }
  return data.access_token;
}

function readMetric(report: GoogleReport | undefined, index: number) {
  const raw = report?.rows?.[0]?.metricValues?.[index]?.value;
  const value = Number(raw ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export async function GET(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return errorResponse("Unauthorized.", 401);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("GA4 analytics requires Supabase server credentials.");
    return errorResponse("Analitik GA4 belum dikonfigurasi di server.", 503);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData.user) return errorResponse("Unauthorized.", 401);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("role, is_staff, staff_permissions")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Unable to verify GA4 analytics access:", profileError);
    return errorResponse("Hak akses analitik tidak dapat diverifikasi.", 500);
  }
  const canAccessAnalytics = profile?.role === "admin"
    || (profile?.is_staff === true
      && Array.isArray(profile.staff_permissions)
      && profile.staff_permissions.includes("analytics"));
  if (!canAccessAnalytics) return errorResponse("Akses analitik diperlukan.", 403);

  const days = Number(new URL(request.url).searchParams.get("days") ?? "7");
  if (![7, 30, 90].includes(days)) return errorResponse("Rentang analitik tidak valid.", 400);

  const propertyId = process.env.GA4_PROPERTY_ID;
  const serviceAccountEmail = process.env.GA4_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!propertyId || !/^\d+$/.test(propertyId) || !serviceAccountEmail || !privateKey) {
    return errorResponse(
      "GA4 belum dikonfigurasi. Admin perlu mengatur GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_EMAIL, dan GA4_SERVICE_ACCOUNT_PRIVATE_KEY.",
      503,
    );
  }

  try {
    const googleToken = await getGoogleAccessToken(serviceAccountEmail, privateKey);
    const reportRequests = [
      { dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }], metrics: [{ name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "engagementRate" }, { name: "averageSessionDuration" }] },
      { dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }], dimensions: [{ name: "date" }], metrics: [{ name: "screenPageViews" }], orderBys: [{ dimension: { dimensionName: "date" } }] },
      { dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }], dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: "10" },
      { dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }], dimensions: [{ name: "deviceCategory" }], metrics: [{ name: "activeUsers" }, { name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: "10" },
      { dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }], dimensions: [{ name: "country" }], metrics: [{ name: "activeUsers" }, { name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: "10" },
      { dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }], dimensions: [{ name: "sessionSourceMedium" }], metrics: [{ name: "activeUsers" }, { name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: "10" },
    ];
    const apiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}`;
    const headers = {
      Authorization: `Bearer ${googleToken}`,
      "Content-Type": "application/json",
    };
    const [mainResponse, sourceResponse] = await Promise.all([
      fetch(`${apiUrl}:batchRunReports`, {
        method: "POST",
        headers,
        body: JSON.stringify({ requests: reportRequests.slice(0, 5) }),
        cache: "no-store",
      }),
      fetch(`${apiUrl}:runReport`, {
        method: "POST",
        headers,
        body: JSON.stringify(reportRequests[5]),
        cache: "no-store",
      }),
    ]);
    const [mainData, sourceData]: unknown[] = await Promise.all([mainResponse.json(), sourceResponse.json()]);
    if (!mainResponse.ok || !sourceResponse.ok
      || !isRecord(mainData) || !Array.isArray(mainData.reports)
      || !isRecord(sourceData)) {
      console.error("Google Analytics Data API request failed:", {
        mainStatus: mainResponse.status,
        sourceStatus: sourceResponse.status,
        mainError: mainData,
        sourceError: sourceData,
      });
      return errorResponse("Google Analytics gagal mengambil laporan. Periksa akses service account dan GA4 Property ID.", 502);
    }

    const reports = mainData.reports as GoogleReport[];
    const daily = (reports[1]?.rows ?? []).flatMap((row) => {
      const date = row.dimensionValues?.[0]?.value;
      const views = Number(row.metricValues?.[0]?.value ?? 0);
      return date && /^\d{8}$/.test(date) && Number.isFinite(views)
        ? [{ date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`, views }]
        : [];
    });
    const topPages = (reports[2]?.rows ?? []).flatMap((row) => {
      const path = row.dimensionValues?.[0]?.value;
      const views = Number(row.metricValues?.[0]?.value ?? 0);
      return typeof path === "string" && Number.isFinite(views) ? [{ path, views }] : [];
    });
    const readDimensionReport = (report: GoogleReport | undefined, dimensionCount: number) => (
      report?.rows?.flatMap((row) => {
        const dimension = row.dimensionValues?.[0]?.value;
        const activeUsers = Number(row.metricValues?.[0]?.value ?? 0);
        const sessions = Number(row.metricValues?.[1]?.value ?? 0);
        return typeof dimension === "string" && Number.isFinite(activeUsers) && Number.isFinite(sessions)
          ? [{ dimension, activeUsers, sessions }]
          : [];
      }).slice(0, dimensionCount) ?? []
    );

    return NextResponse.json({
      activeUsers: readMetric(reports[0], 0),
      newUsers: readMetric(reports[0], 1),
      sessions: readMetric(reports[0], 2),
      pageViews: readMetric(reports[0], 3),
      engagementRate: readMetric(reports[0], 4),
      averageSessionDuration: readMetric(reports[0], 5),
      daily,
      topPages,
      devices: readDimensionReport(reports[3], 10),
      countries: readDimensionReport(reports[4], 10),
      sources: readDimensionReport(sourceData as GoogleReport, 10),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load Google Analytics report:", error);
    return errorResponse("Google Analytics tidak dapat dihubungi. Coba lagi nanti.", 502);
  }
}
