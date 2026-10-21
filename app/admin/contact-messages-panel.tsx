"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Mail, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ContactStatus = "new" | "in_progress" | "resolved";
type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  created_at: string;
};

const supabase = createClient();
const statusLabels: Record<ContactStatus, string> = {
  new: "Baru",
  in_progress: "Sedang ditangani",
  resolved: "Selesai",
};
const schemaErrorCodes = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function ContactMessagesPanel() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error: queryError } = await supabase
        .from("contact_messages")
        .select("id, name, email, subject, message, status, created_at")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (queryError) {
        console.error("Unable to load contact messages:", queryError);
        setError(schemaErrorCodes.has(queryError.code)
          ? "Tabel pesan kontak belum tersedia. Jalankan supabase/contact-messages.sql di Supabase SQL Editor."
          : "Pesan kontak gagal dimuat. Pastikan akses staf dan koneksi database tersedia.");
      } else {
        setMessages((data ?? []) as ContactMessage[]);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const updateStatus = async (item: ContactMessage) => {
    setSavingId(item.id);
    setNotice("");
    const { error: updateError } = await supabase
      .from("contact_messages")
      .update({ status: item.status, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    setSavingId("");
    if (updateError) {
      console.error("Unable to update contact message status:", updateError);
      setNotice("Status pesan gagal disimpan. Periksa izin database dan coba lagi.");
      return;
    }
    setNotice("Status pesan berhasil disimpan.");
  };

  if (loading) return <p className="admin-loading"><LoaderCircle className="spin" size={18} /> Memuat pesan masuk...</p>;
  if (error) return <p className="admin-settings-error" role="alert">{error}</p>;
  return (
    <div className="contact-messages-list">
      <p className="contact-messages-summary">{messages.filter((item) => item.status === "new").length} pesan baru · {messages.length} total</p>
      {notice && <p className="contact-messages-notice" role="status">{notice}</p>}
      {!messages.length
        ? <div className="admin-empty"><p>Belum ada pesan masuk.</p></div>
        : messages.map((item) => (
          <article className="admin-ad-request-card contact-message-card" key={item.id}>
            <header className="admin-ad-request-heading">
              <div><p className="eyebrow">{item.name} · {formatDate(item.created_at)}</p><h3>{item.subject}</h3></div>
              <a className="contact-message-email" href={`mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(`Re: ${item.subject}`)}`}><Mail size={14} /> {item.email}</a>
            </header>
            <p className="contact-message-body">{item.message}</p>
            <div className="contact-message-actions">
              <label>Status pesan
                <select value={item.status} onChange={(event) => {
                  const status = event.target.value as ContactStatus;
                  setMessages((current) => current.map((message) => message.id === item.id ? { ...message, status } : message));
                }}>
                  {(Object.keys(statusLabels) as ContactStatus[]).map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}
                </select>
              </label>
              <button className="button button-dark" type="button" disabled={savingId === item.id} onClick={() => void updateStatus(item)}>
                {savingId === item.id ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}
                Simpan status
              </button>
            </div>
          </article>
        ))}
    </div>
  );
}
