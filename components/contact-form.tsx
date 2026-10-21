"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

export default function ContactForm() {
  const { t } = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
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
      <form className="contact-form" onSubmit={(event) => void submit(event)}>
        <label>{t("Nama")}<input name="name" autoComplete="name" maxLength={100} required /></label>
        <label>{t("Alamat email")}<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        <label>{t("Subjek")}<input name="subject" maxLength={160} required /></label>
        <label>{t("Pesan")}<textarea name="message" rows={7} minLength={10} maxLength={5000} required /></label>
        <label className="contact-form-honeypot" aria-hidden="true">Jangan isi kolom ini<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <button className="reader-primary-button" type="submit" disabled={submitting}>
          <Send size={15} /> {submitting ? t("Mengirim...") : t("Kirim pesan")}
        </button>
        {message && <p className={`contact-form-message contact-form-message-${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}
      </form>
    </section>
  );
}
