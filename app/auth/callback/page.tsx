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

      const code = callbackUrl.searchParams.get("code");
      if (!code) {
        if (active) setError("Kode login tidak ditemukan. Silakan mulai login Google lagi.");
        return;
      }

      const { data, error: exchangeError } = await withTimeout(
        supabase.auth.exchangeCodeForSession(code),
        15_000,
        "Timed out while exchanging the Google authentication code.",
      );
      if (exchangeError || !data.user) {
        if (exchangeError) {
          console.error("Could not complete Google authentication:", exchangeError);
        }
        if (active) {
          setError(exchangeError?.code === "pkce_code_verifier_not_found"
            ? "Sesi login tidak cocok dengan browser atau domain ini. Mulai login dari mu-komik.com, lalu coba lagi."
            : "Sesi Google belum dapat dibuat. Periksa koneksi internet, lalu coba login kembali.");
        }
        return;
      }

      const user = data.user;
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
