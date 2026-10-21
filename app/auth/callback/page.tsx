"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/account";
  return value;
}

function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    Promise.resolve(operation).then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export default function AuthCallbackPage() {
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let active = true;

    const completeAuthentication = async () => {
      const callbackUrl = new URL(window.location.href);
      const providerError = callbackUrl.searchParams.get("error_description")
        || callbackUrl.searchParams.get("error");
      if (providerError) {
        console.error("Google authentication returned an error:", providerError);
        if (active) setError("Login Google dibatalkan atau tidak berhasil. Silakan coba lagi.");
        return;
      }

      if (!callbackUrl.searchParams.has("code")) {
        if (active) setError("Kode login tidak ditemukan. Silakan mulai login Google lagi.");
        return;
      }

      // The browser client detects the callback URL and exchanges the PKCE code during initialization.
      const { data, error: sessionError } = await withTimeout(
        supabase.auth.getSession(),
        15_000,
        "Timed out while waiting for the Google authentication session.",
      );
      if (sessionError || !data.session?.user) {
        if (sessionError) {
          console.error("Could not read the Google authentication session:", sessionError);
        }
        if (active) setError("Sesi Google belum dapat dibuat. Periksa koneksi internet, lalu coba login kembali.");
        return;
      }

      const user = data.session.user;
      const metadata = user.user_metadata;
      const displayName = [metadata.full_name, metadata.name]
        .find((value): value is string => typeof value === "string" && value.trim().length > 0)
        ?.trim();
      if (displayName) {
        try {
          const { error: profileError } = await withTimeout(
            supabase
              .from("profiles")
              .update({ display_name: displayName.slice(0, 80) })
              .eq("id", user.id)
              .eq("display_name", "Reader"),
            2_500,
            "Timed out while setting the Google display name.",
          );
          if (profileError) {
            console.error("Could not set the Google display name on the reader profile:", profileError);
          }
        } catch (profileError) {
          console.error("Could not set the Google display name on the reader profile:", profileError);
        }
      }

      if (active) {
        window.location.replace(getSafeNextPath(callbackUrl.searchParams.get("next")));
      }
    };

    void completeAuthentication().catch((callbackError: unknown) => {
      console.error("Google authentication callback failed:", callbackError);
      if (active) setError("Login Google belum dapat diselesaikan. Silakan coba lagi.");
    });
    return () => { active = false; };
  }, []);

  return (
    <main className="auth-shell auth-callback-shell">
      <section className="auth-card auth-callback-card" aria-live="polite">
        {error ? (
          <>
            <h1>Login Google tidak berhasil</h1>
            <p className="form-error" role="alert">{error}</p>
            <Link className="button button-dark auth-submit" href="/login">Kembali ke halaman masuk</Link>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" size={28} aria-hidden="true" />
            <h1>Menyelesaikan login...</h1>
            <p className="auth-subtitle">Sebentar, kami sedang menyiapkan akunmu.</p>
          </>
        )}
      </section>
    </main>
  );
}
