import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const usersPerPage = 1000;
const maxRequestedUsers = 10000;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return errorResponse("Cross-site requests are not allowed", 403);
  }
  try {
    if (new URL(origin).host !== request.headers.get("host")) {
      return errorResponse("Cross-origin requests are not allowed", 403);
    }
  } catch {
    return errorResponse("Invalid request origin", 403);
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return errorResponse("Unauthorized", 401);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Unable to load admin user emails: Supabase URL, anon key, or service-role key is missing.");
    return errorResponse("User email lookup is not configured. Check the server Supabase URL, anon key, and service-role key.", 500);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData.user) return errorResponse("Unauthorized", 401);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("role, is_staff, staff_permissions")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Unable to verify admin access for user email lookup:", profileError);
    return errorResponse("Could not verify admin access", 500);
  }
  if (profile?.role !== "admin" && profile?.is_staff !== true) return errorResponse("Admin access required", 403);
  const isStaff = profile.role !== "admin" && profile.is_staff === true;
  const staffPermissions = isStaff && Array.isArray(profile.staff_permissions)
    ? profile.staff_permissions.filter((permission): permission is string => typeof permission === "string")
    : [];
  if (isStaff && !["users", "admins", "staf", "readers", "kreator", "creator-requests"].some((permission) => staffPermissions.includes(permission))) {
    return errorResponse("Staff access to user emails is not permitted", 403);
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > 512 * 1024) return errorResponse("Request body is too large", 413);
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("Invalid JSON request body", 400);
  }
  if (!body || typeof body !== "object" || !("userIds" in body)
    || !Array.isArray(body.userIds)
    || body.userIds.length > maxRequestedUsers
    || !body.userIds.every((id) => typeof id === "string" && uuidPattern.test(id))) {
    return errorResponse("A valid list of user IDs is required", 400);
  }

  const requestedIds = new Set(body.userIds as string[]);
  if (isStaff && requestedIds.size && !staffPermissions.includes("users")) {
    const [{ data: requestedProfiles, error: requestedProfilesError }, { data: pendingRequests, error: pendingRequestError }] = await Promise.all([
      serviceClient.from("profiles").select("id, role, is_staff").in("id", [...requestedIds]),
      staffPermissions.includes("creator-requests")
        ? serviceClient.from("creator_requests").select("user_id").in("user_id", [...requestedIds]).eq("status", "pending")
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (requestedProfilesError || pendingRequestError) {
      console.error("Unable to verify staff email lookup scope:", requestedProfilesError || pendingRequestError);
      return errorResponse("Could not verify staff email lookup scope", 500);
    }
    const rolePermissions = new Map<string, string>([
      ["admins", "admin"],
      ["readers", "reader"],
      ["kreator", "creator"],
    ]);
    const allowedIds = new Set([
      ...(requestedProfiles ?? [])
        .filter((user) => (
          (staffPermissions.includes("staf") && user.is_staff)
          || [...rolePermissions].some(([permission, role]) => staffPermissions.includes(permission) && user.role === role)
        ))
        .map((user) => user.id),
      ...(pendingRequests ?? []).map((request) => request.user_id),
    ]);
    for (const id of requestedIds) {
      if (!allowedIds.has(id)) requestedIds.delete(id);
    }
  }
  const emails: Record<string, string | null> = {};
  const accountStatuses: Record<string, "active" | "blocked" | "deleted"> = {};
  if (!requestedIds.size) {
    return NextResponse.json({ emails, accountStatuses }, { headers: { "Cache-Control": "no-store" } });
  }

  for (let page = 1; requestedIds.size > 0; page += 1) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: usersPerPage });
    if (error) {
      console.error("Unable to load admin user emails:", error);
      return errorResponse("User emails could not be loaded", 500);
    }
    for (const user of data.users) {
      if (requestedIds.delete(user.id)) {
        emails[user.id] = user.email ?? null;
        const status = user.app_metadata?.mu_komik_account_status;
        accountStatuses[user.id] = status === "blocked" || status === "deleted"
          ? status
          : user.banned_until && new Date(user.banned_until).getTime() > Date.now()
            ? "blocked"
            : "active";
      }
    }
    if (data.users.length < usersPerPage) break;
  }

  return NextResponse.json({ emails, accountStatuses }, { headers: { "Cache-Control": "no-store" } });
}
