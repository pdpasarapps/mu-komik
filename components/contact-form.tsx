"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, Send } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { createClient } from "@/lib/supabase/client";
import { CONTACT_CATEGORIES } from "@/lib/contact-categories";

const supabase = createClient();
type ContactUser = { id: string; email: string | undefined };
type ContactProfileState =
  | { userId: string; status: "ready"; displayName: string }
  | { userId: string; status: "error" };

export default function ContactForm() {
  const { t } = useLocale();
  const [user, setUser] = useState<ContactUser | null>(null);
  const [profileState, setProfileState] = useState<ContactProfileState | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    const loadCurrentUser = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        console.error("Unable to check contact form authentication:", error);
      }
      const sessionUser = data.session?.user;
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null);
      setAuthLoading(false);
    };
    void loadCurrentUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
      setProfileState(null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const loadProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error || !data?.display_name?.trim()) {
        if (error) console.error("Unable to load contact form profile:", error);
        setProfileState({ userId: user.id, status: "error" });
      } else {
        setProfileState({ userId: user.id, status: "ready", displayName: data.display_name.trim() });
      }
    };
    void loadProfile();
    return () => { active = false; };
  }, [user]);

  const currentProfile = user && profileState?.userId === user.id ? profileState : null;
  const displayName = currentProfile?.status === "ready" ? currentProfile.displayName : "";
  const profileLoading = Boolean(user) && currentProfile === null;
  const profileError = currentProfile?.status === "error";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !user || !displayName || !user.email) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitting(true);
    setMessage(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error("Sign in is required to send a contact message.");
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          category: formData.get("category"),
          subject: formData.get("subject"),
          message: formData.get("message"),
          website: formData.get("website"),
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const serverError = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : "Contact form request failed.";
        throw new Error(serverError);
      }
      form.reset();
      setMessage({ kind: "success", text: t("Pesan berhasil dikirim. Tim MU-Komik akan meninjaunya.") });
    } catch (error) {
      console.error("Unable to submit contact message:", error);
      setMessage({ kind: "error", text: t("Pesan gagal dikirim. Silakan coba lagi.") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="contact-form-section" aria-labelledby="contact-form-title">
      <h2 id="contact-form-title">{t("Kirim pesan")}</h2>
      {authLoading
        ? <p className="contact-form-auth-state" role="status"><LoaderCircle className="spin" size={16} /> {t("Memuat akun...")}</p>
        : !user
          ? <div className="contact-form-auth-state">
            <p>{t("Masuk untuk mengirim pesan kepada tim MU-Komik.")}</p>
            <Link className="reader-primary-button" href="/login?next=%2Fcontact">{t("Masuk untuk menghubungi kami")} <ArrowRight size={15} /></Link>
          </div>
          : profileLoading
            ? <p className="contact-form-auth-state" role="status"><LoaderCircle className="spin" size={16} /> {t("Memuat akun...")}</p>
            : profileError || !displayName || !user.email
              ? <p className="contact-form-message contact-form-message-error" role="alert">{t("Profil akun belum dapat dimuat. Coba muat ulang halaman.")}</p>
              : <>
                <p className="contact-form-profile-note">{t("Nama dan email diambil dari profil akunmu.")}</p>
                <form className="contact-form" onSubmit={(event) => void submit(event)}>
                  <label>{t("Nama")}<input value={displayName} autoComplete="name" readOnly /></label>
                  <label>{t("Alamat email")}<input type="email" value={user.email} autoComplete="email" readOnly /></label>
                  <label>{t("Kategori")}
                    <select name="category" defaultValue="" required>
                      <option value="" disabled>{t("Pilih kategori")}</option>
                      {CONTACT_CATEGORIES.map((category) => (
                        <option value={category.value} key={category.value}>{t(category.label)}</option>
                      ))}
                    </select>
                  </label>
                  <label>{t("Subjek")}<input name="subject" maxLength={160} required /></label>
                  <label>{t("Pesan")}<textarea name="message" rows={7} minLength={10} maxLength={5000} required /></label>
                  <label className="contact-form-honeypot" aria-hidden="true">Jangan isi kolom ini<input name="website" tabIndex={-1} autoComplete="off" /></label>
                  <button className="reader-primary-button" type="submit" disabled={submitting}>
                    <Send size={15} /> {submitting ? t("Mengirim...") : t("Kirim pesan")}
                  </button>
                  {message && <p className={`contact-form-message contact-form-message-${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}
                </form>
              </>
      }
    </section>
  );
}
