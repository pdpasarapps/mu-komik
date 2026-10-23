import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase build variables are missing: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
    },
  });
}

export async function canPreviewUnpublishedComic(
  supabase: Awaited<ReturnType<typeof createClient>>,
  creatorId: string,
  userId: string | null,
) {
  if (!userId) return false;
  if (creatorId === userId) return true;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, is_staff, staff_permissions")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("Unable to verify unpublished comic preview access:", error);
    throw error;
  }

  return profile?.role === "admin"
    || (profile?.is_staff === true
      && Array.isArray(profile.staff_permissions)
      && (profile.staff_permissions.includes("comic-review") || profile.staff_permissions.includes("kids-review")));
}
