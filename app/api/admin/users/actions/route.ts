import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedRoles = ["reader", "creator", "staff"] as const;
const allowedStaffPermissions = new Set([
  "overview", "analytics", "comic-review", "kids-review", "creator-requests",
  "users", "admins", "staf", "readers", "kreator", "comics", "articles",
  "share-previews", "ad-requests", "sponsor-campaigns", "ad-slots",
  "homepage-promos", "platform-settings",
]);
const indefiniteBanDuration = "876000h";

type UserAction = "edit" | "block" | "unblock" | "deactivate";
type ActionBody = {
  action: UserAction;
  userId: string;
  displayName?: string;
  role?: (typeof allowedRoles)[number];
  staffTitle?: string;
  staffPermissions?: string[];
};

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
    console.error("Unable to manage admin users: Supabase URL, anon key, or service-role key is missing.");
    return errorResponse("User management is not configured", 500);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData.user) return errorResponse("Unauthorized", 401);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: adminProfile, error: adminProfileError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (adminProfileError) {
    console.error("Unable to verify admin access for user management:", adminProfileError);
    return errorResponse("Could not verify admin access", 500);
  }
  if (adminProfile?.role !== "admin") return errorResponse("Admin access required", 403);

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > 8 * 1024) return errorResponse("Request body is too large", 413);
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return errorResponse("Invalid JSON request body", 400);
  }
  if (!parsedBody || typeof parsedBody !== "object") return errorResponse("Invalid action", 400);
  const body = parsedBody as Partial<ActionBody>;
  if (!["edit", "block", "unblock", "deactivate"].includes(body.action ?? "")
    || typeof body.userId !== "string" || !uuidPattern.test(body.userId)) {
    return errorResponse("Invalid action details", 400);
  }

  const { data: targetProfile, error: targetProfileError } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("id", body.userId)
    .maybeSingle();
  if (targetProfileError) {
    console.error("Unable to load target profile for admin user management:", targetProfileError);
    return errorResponse("Could not load target user", 500);
  }
  if (!targetProfile) return errorResponse("User not found", 404);
  if (targetProfile.role === "admin") return errorResponse("Admin accounts are protected from these actions", 403);

  if (body.action === "edit") {
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (!displayName || displayName.length > 80 || !allowedRoles.includes(body.role as (typeof allowedRoles)[number])) {
      return errorResponse("A valid display name and role are required", 400);
    }
    const staffTitle = typeof body.staffTitle === "string" ? body.staffTitle.trim() : "";
    const staffPermissions = body.staffPermissions;
    if (body.role === "staff" && (
      !staffTitle
      || staffTitle.length > 60
      || !Array.isArray(staffPermissions)
      || staffPermissions.length === 0
      || staffPermissions.length > allowedStaffPermissions.size
      || !staffPermissions.every((permission) => typeof permission === "string" && allowedStaffPermissions.has(permission))
      || new Set(staffPermissions).size !== staffPermissions.length
    )) {
      return errorResponse("A staff title and valid, non-duplicate permissions are required", 400);
    }
    const { error } = await serviceClient
      .from("profiles")
      .update({
        display_name: displayName,
        role: body.role,
        staff_title: body.role === "staff" ? staffTitle : "",
        staff_permissions: body.role === "staff" ? staffPermissions : [],
        ...(body.role === "reader" ? { can_upload_audio: false } : {}),
      })
      .eq("id", body.userId);
    if (error) {
      console.error("Unable to edit admin user profile:", error);
      return errorResponse("User profile could not be updated", 500);
    }
    return NextResponse.json({
      user: {
        id: body.userId,
        displayName,
        role: body.role,
        staffTitle: body.role === "staff" ? staffTitle : "",
        staffPermissions: body.role === "staff" ? staffPermissions : [],
      },
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const nextStatus = body.action === "block" ? "blocked" : body.action === "deactivate" ? "deleted" : "active";
  const { data: authUserData, error: authUserError } = await serviceClient.auth.admin.getUserById(body.userId);
  if (authUserError || !authUserData.user) {
    console.error("Unable to load auth user for admin user management:", authUserError);
    return errorResponse("Could not load target authentication account", 500);
  }
  const { error: updateAuthError } = await serviceClient.auth.admin.updateUserById(body.userId, {
    ban_duration: nextStatus === "active" ? "none" : indefiniteBanDuration,
    app_metadata: {
      ...authUserData.user.app_metadata,
      mu_komik_account_status: nextStatus,
    },
  });
  if (updateAuthError) {
    console.error("Unable to update admin user account status:", updateAuthError);
    return errorResponse("User account status could not be updated", 500);
  }

  return NextResponse.json({ user: { id: body.userId, accountStatus: nextStatus } }, { headers: { "Cache-Control": "no-store" } });
}
