import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase build variables are missing: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const isGoogleAuthCallback = typeof window !== "undefined"
    && window.location.pathname === "/auth/callback"
    && new URLSearchParams(window.location.search).has("code");

  return createBrowserClient(
    url,
    key,
    isGoogleAuthCallback ? { auth: { detectSessionInUrl: false } } : undefined,
  );
}
