"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CheckCircle2, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import { getComicGenreLabel, MAX_READER_INTEREST_GENRES, READER_INTEREST_GENRES } from "@/lib/reader-interests";
import { useLocale } from "@/components/locale-provider";

const supabase = createClient();

type Mode = "login" | "signup";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

function getAuthErrorMessage(error: { code?: string; message: string }, mode: Mode) {
  switch (error.code) {
    case "invalid_credentials":
    case "invalid_login_credentials":
      return "Email atau kata sandi tidak sesuai.";
    case "email_not_confirmed":
      return "Konfirmasi alamat email kamu sebelum masuk.";
    case "user_already_exists":
    case "email_exists":
      return "Email ini sudah terdaftar. Silakan masuk.";
    case "email_address_invalid":
      return "Format alamat email tidak valid.";
    case "weak_password":
      return "Kata sandi terlalu lemah. Gunakan kata sandi yang lebih kuat.";
    case "signup_disabled":
      return "Pendaftaran akun sedang dinonaktifkan.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Terlalu banyak permintaan. Tunggu sebentar, lalu coba lagi.";
    case "same_password":
      return "Kata sandi baru harus berbeda dari kata sandi sebelumnya.";
    default:
      return mode === "signup"
        ? "Akun belum dapat dibuat. Periksa kembali data dan koneksi internet, lalu coba lagi."
        : "Kamu belum dapat masuk. Periksa email dan kata sandi, lalu coba lagi.";
  }
}

export default function LoginPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
  const [personalizedAdsConsent, setPersonalizedAdsConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (data.user) {
        router.replace(getSafeNextPath(new URLSearchParams(window.location.search).get("next")));
        return;
      }
      setSignedInEmail(null);
    });
    return () => { active = false; };
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                display_name: displayName || "Pembaca",
                preferred_genres: preferredGenres,
                personalized_ads_consent: personalizedAdsConsent,
              },
            },
          });

      if (result.error) {
        console.error("Authentication request failed:", {
          code: result.error.code,
          message: result.error.message,
        });
        setError(getAuthErrorMessage(result.error, mode));
      } else if (mode === "signup") {
        setMessage("Akun berhasil dibuat. Periksa email kamu untuk konfirmasi sebelum masuk.");
        setMode("login");
        setPassword("");
        setPreferredGenres([]);
        setPersonalizedAdsConsent(false);
      } else {
        setSignedInEmail(result.data.user?.email ?? email);
        setMessage("Berhasil masuk.");
        router.replace(getSafeNextPath(new URLSearchParams(window.location.search).get("next")));
      }
    } catch (authError) {
      console.error("Authentication request could not be completed:", authError);
      setError(mode === "signup"
        ? "Akun belum dapat dibuat. Periksa koneksi internet, lalu coba lagi."
        : "Kamu belum dapat masuk. Periksa koneksi internet, lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    setMessage("");
    try {
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", getSafeNextPath(new URLSearchParams(window.location.search).get("next")));
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo.toString() },
      });
      if (oauthError) {
        console.error("Google authentication request failed:", {
          code: oauthError.code,
          message: oauthError.message,
        });
        setError("Login Google belum dapat dimulai. Periksa konfigurasi Google di Supabase lalu coba lagi.");
        setGoogleLoading(false);
        return;
      }
      if (!data.url) {
        console.error("Google authentication did not return a redirect URL.");
        setError("Login Google belum dapat dimulai. Coba lagi beberapa saat.");
        setGoogleLoading(false);
        return;
      }
      window.location.assign(data.url);
    } catch (authError) {
      console.error("Google authentication request could not be completed:", authError);
      setError("Login Google belum dapat dimulai. Periksa koneksi internet, lalu coba lagi.");
      setGoogleLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    setError("");
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error("Unable to sign out:", {
          code: signOutError.code,
          message: signOutError.message,
        });
        setError("Kamu belum dapat keluar. Periksa koneksi internet, lalu coba lagi.");
      } else {
        setSignedInEmail(null);
        setMessage("Kamu berhasil keluar.");
      }
    } catch (signOutError) {
      console.error("Sign-out request could not be completed:", signOutError);
      setError("Kamu belum dapat keluar. Periksa koneksi internet, lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const togglePreferredGenre = (genre: string) => {
    setPreferredGenres((current) => current.includes(genre)
      ? current.filter((item) => item !== genre)
      : current.length < MAX_READER_INTEREST_GENRES ? [...current, genre] : current);
  };

  return (
    <main className="auth-shell">
      <Link className="auth-back" href="/"><ArrowLeft size={16} /> {t("Kembali ke beranda")}</Link>
      <section className="auth-layout">
        <div className="auth-intro">
          <BrandLogo showName />
          <p className="eyebrow"><span /> {t("Cerita pilihanmu, kapan saja")}</p>
          <h1>{t("Simpan cerita favoritmu.")}</h1>
          <p>{t("Masuk untuk menyimpan riwayat baca, favorit, dan preferensimu di mana pun kamu membaca.")}</p>
        </div>
        <div className="auth-card">
          <div className="auth-card-top"><div className="auth-icon"><UserRound size={20} /></div><span>{signedInEmail ? t("Akun") : mode === "login" ? t("Selamat datang kembali") : t("Pembaca baru")}</span></div>
          {signedInEmail ? (
            <div className="signed-in-state"><CheckCircle2 size={32} /><h2>{t("Kamu sudah masuk.")}</h2><p>{signedInEmail}</p>{error && <p className="form-error" role="alert">{t(error)}</p>}{message && <p className="form-message" role="status">{t(message)}</p>}<button className="button button-dark auth-submit" onClick={handleSignOut} disabled={loading}>{loading ? t("Sedang keluar...") : t("Keluar")}</button></div>
          ) : (
            <>
              <h2>{mode === "login" ? t("Buka ruang bacamu") : t("Buat akun pembaca")}</h2>
              <p className="auth-subtitle">{mode === "login" ? t("Lanjutkan membaca dari bagian terakhir.") : t("Mulai membaca hanya dalam beberapa langkah.")}</p>
              {error && <p className="form-error" role="alert">{t(error)}</p>}
              {message && <p className="form-message" role="status">{t(message)}</p>}
              <button
                type="button"
                className="google-auth-button"
                onClick={() => void handleGoogleSignIn()}
                disabled={loading || googleLoading}
              >
                {googleLoading
                  ? <><LoaderCircle className="spin" size={17} /> {t("Menghubungkan ke Google...")}</>
                  : <><span className="google-auth-mark" aria-hidden="true">G</span> {t("Lanjutkan dengan Google")}</>}
              </button>
              <div className="auth-divider"><span>{t("atau dengan email")}</span></div>
              <form onSubmit={handleSubmit} className="auth-form">
                {mode === "signup" && <label><span>{t("Nama tampilan")}</span><div className="input-wrap"><UserRound size={17} /><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t("Kamu ingin dipanggil apa?")} /></div></label>}
                <label><span>{t("Email")}</span><div className="input-wrap"><Mail size={17} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="kamu@contoh.id" /></div></label>
                <label><span>{t("Kata sandi")}</span><div className="input-wrap"><LockKeyhole size={17} /><input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("Minimal 6 karakter")} /></div></label>
                {mode === "signup" && (
                  <fieldset className="reader-interest-quiz">
                    <legend>{t("Genre bacaan yang kamu sukai")} <span>({t("opsional")})</span></legend>
                    <p>{t("Pilih hingga 5 genre. Kamu bisa melewati atau mengubahnya nanti.").replace("5", String(MAX_READER_INTEREST_GENRES))}</p>
                    <div className="reader-interest-options">
                      {READER_INTEREST_GENRES.map((genre) => (
                        <label className="reader-interest-option" key={genre}>
                          <input type="checkbox" checked={preferredGenres.includes(genre)} onChange={() => togglePreferredGenre(genre)} disabled={!preferredGenres.includes(genre) && preferredGenres.length >= MAX_READER_INTEREST_GENRES} />
                          <span>{t(getComicGenreLabel(genre))}</span>
                        </label>
                      ))}
                    </div>
                    <label className="reader-interest-consent">
                      <input type="checkbox" checked={personalizedAdsConsent} onChange={(event) => setPersonalizedAdsConsent(event.target.checked)} />
                      <span><strong>{t("Saya setuju menerima iklan yang dipersonalisasi")}</strong><small>{t("Jika tidak dicentang, iklan tetap dapat disesuaikan dengan genre komik yang sedang dibaca, tanpa menggunakan pilihan minat profilmu. Persetujuan ini dapat diubah kapan saja di Pengaturan akun.")}</small></span>
                    </label>
                  </fieldset>
                )}
                <button className="button button-dark auth-submit" type="submit" disabled={loading || googleLoading}>{loading ? <><LoaderCircle className="spin" size={17} /> {t("Mohon tunggu")}</> : <>{t(mode === "login" ? "Masuk" : "Buat akun")} <ArrowUpRight size={17} /></>}</button>
              </form>
              <button className="mode-toggle" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>{t(mode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk")}</button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
