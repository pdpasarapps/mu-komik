"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bell, Eye, EyeOff, LoaderCircle, Mail, MessageCircleReply, Save, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CONTACT_CATEGORIES, getContactCategoryLabel, type ContactCategory } from "@/lib/contact-categories";
import { useLocale } from "@/components/locale-provider";

type ContactStatus = "new" | "in_progress" | "resolved";
type CommunicationTab = "messages" | "send";
type ContactCategoryFilter = ContactCategory | "all";
type ContactStatusFilter = ContactStatus | "all";
type ReadStatusFilter = "all" | "unread" | "read";
type ContactMessage = {
  id: string;
  name: string;
  email: string;
  category: ContactCategory;
  subject: string;
  message: string;
  status: ContactStatus;
  created_at: string;
  read_at: string | null;
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
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<CommunicationTab>("messages");
  const [categoryFilter, setCategoryFilter] = useState<ContactCategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ContactStatusFilter>("all");
  const [readStatusFilter, setReadStatusFilter] = useState<ReadStatusFilter>("all");
  const [openMessageIds, setOpenMessageIds] = useState<Set<string>>(() => new Set());
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState("");
  const [replyMessage, setReplyMessage] = useState<ContactMessage | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const replyDialogRef = useRef<HTMLDialogElement>(null);
  const replyBodyRef = useRef<HTMLTextAreaElement>(null);
  const messagesTabRef = useRef<HTMLButtonElement>(null);
  const sendTabRef = useRef<HTMLButtonElement>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [systemSubject, setSystemSubject] = useState("");
  const [systemBody, setSystemBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    const dialog = replyDialogRef.current;
    if (!dialog) return;
    if (replyMessage && !dialog.open) {
      dialog.showModal();
      replyBodyRef.current?.focus();
    }
    if (!replyMessage && dialog.open) dialog.close();
  }, [replyMessage]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error: queryError } = await supabase
        .from("contact_messages")
        .select("id, name, email, category, subject, message, status, created_at, read_at")
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

  const sendMessage = async (payload: Record<string, string>) => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (sessionError || !accessToken) throw new Error("Sesi staf berakhir. Silakan masuk kembali.");
    const response = await fetch("/api/admin/account-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: ["Bearer", accessToken].join(" ") },
      body: JSON.stringify(payload),
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      const serverError = result && typeof result === "object" && "error" in result && typeof result.error === "string"
        ? result.error
        : "Pesan tidak dapat dikirim.";
      throw new Error(serverError);
    }
  };

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!replyMessage) return;
    const item = replyMessage;
    setSavingId(item.id);
    setNotice("");
    try {
      await sendMessage({ action: "reply", contactMessageId: item.id, body: replyBody });
      setReplyBody("");
      setReplyMessage(null);
      setNotice("Balasan untuk " + item.email + " berhasil dikirim ke kotak pesan akunnya.");
    } catch (error) {
      console.error("Unable to send private reply to contact message:", error);
      setNotice(error instanceof Error ? error.message : "Balasan gagal dikirim. Coba lagi.");
    } finally {
      setSavingId("");
    }
  };

  const sendSystemMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSendingMessage(true);
    setNotice("");
    try {
      await sendMessage({
        action: "system",
        recipientEmail,
        subject: systemSubject,
        body: systemBody,
      });
      setRecipientEmail("");
      setSystemSubject("");
      setSystemBody("");
      setNotice("Pesan sistem berhasil dikirim ke kotak pesan akun.");
    } catch (error) {
      console.error("Unable to send system account message:", error);
      setNotice(error instanceof Error ? error.message : "Pesan sistem gagal dikirim. Coba lagi.");
    } finally {
      setSendingMessage(false);
    }
  };

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

  const toggleMessage = async (item: ContactMessage) => {
    if (openMessageIds.has(item.id)) {
      setOpenMessageIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      return;
    }
    if (!item.read_at) {
      setSavingId(item.id);
      setNotice("");
      const readAt = new Date().toISOString();
      const { data: updatedMessage, error: updateError } = await supabase
        .from("contact_messages")
        .update({ read_at: readAt })
        .eq("id", item.id)
        .select("id")
        .maybeSingle();
      setSavingId("");
      if (updateError || !updatedMessage) {
        if (updateError) console.error("Unable to mark contact message as read:", updateError);
        else console.error("Contact message could not be marked as read because no row was updated.");
        setNotice("Pesan tidak dapat ditandai sudah dibaca. Pastikan migrasi supabase/contact-messages.sql sudah dijalankan.");
        return;
      }
      setMessages((current) => current.map((message) => message.id === item.id ? { ...message, read_at: readAt } : message));
    }
    setOpenMessageIds((current) => new Set(current).add(item.id));
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextTab: CommunicationTab = event.key === "Home"
      ? "messages"
      : event.key === "End"
        ? "send"
        : activeTab === "messages" ? "send" : "messages";
    setActiveTab(nextTab);
    (nextTab === "messages" ? messagesTabRef : sendTabRef).current?.focus();
  };

  const filteredMessages = messages.filter((item) =>
    (categoryFilter === "all" || item.category === categoryFilter)
    && (statusFilter === "all" || item.status === statusFilter)
    && (readStatusFilter === "all" || (readStatusFilter === "unread" ? !item.read_at : Boolean(item.read_at))));

  if (loading) return <p className="admin-loading"><LoaderCircle className="spin" size={18} /> Memuat pesan masuk...</p>;
  if (error) return <p className="admin-settings-error" role="alert">{error}</p>;
  return (
    <div className="contact-messages-list">
      {notice && <p className="contact-messages-notice" role="status">{notice}</p>}
      <div className="contact-message-tabs" role="tablist" aria-label="Komunikasi pengunjung">
        <button
          ref={messagesTabRef}
          id="contact-messages-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "messages"}
          aria-controls="contact-messages-panel"
          tabIndex={activeTab === "messages" ? 0 : -1}
          onClick={() => setActiveTab("messages")}
          onKeyDown={handleTabKeyDown}
        >
          Daftar pesan <span>{messages.length}</span>
        </button>
        <button
          ref={sendTabRef}
          id="contact-send-message-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "send"}
          aria-controls="contact-send-message-panel"
          tabIndex={activeTab === "send" ? 0 : -1}
          onClick={() => setActiveTab("send")}
          onKeyDown={handleTabKeyDown}
        >
          Kirim pesan
        </button>
      </div>
      <section
        id="contact-messages-panel"
        role="tabpanel"
        aria-labelledby="contact-messages-tab"
        tabIndex={0}
        hidden={activeTab !== "messages"}
      >
        <div className="contact-message-toolbar">
          <p className="contact-messages-summary">
            {messages.filter((item) => !item.read_at).length} belum dibaca · Menampilkan {filteredMessages.length} dari {messages.length}
          </p>
          <div className="contact-message-filters">
            <label>Kategori
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as ContactCategoryFilter)}>
                <option value="all">Semua kategori</option>
                {CONTACT_CATEGORIES.map((category) => <option value={category.value} key={category.value}>{t(category.label)}</option>)}
              </select>
            </label>
            <label>Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ContactStatusFilter)}>
                <option value="all">Semua status</option>
                {(Object.keys(statusLabels) as ContactStatus[]).map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}
              </select>
            </label>
            <label>Status baca
              <select value={readStatusFilter} onChange={(event) => setReadStatusFilter(event.target.value as ReadStatusFilter)}>
                <option value="all">Semua status baca</option>
                <option value="unread">Belum dibaca</option>
                <option value="read">Sudah dibaca</option>
              </select>
            </label>
          </div>
        </div>
        {!filteredMessages.length
          ? <div className="admin-empty"><p>{messages.length ? "Tidak ada pesan yang cocok dengan filter." : "Belum ada pesan masuk."}</p></div>
          : filteredMessages.map((item) => (
            <article className="admin-ad-request-card contact-message-card" key={item.id}>
              <header className="admin-ad-request-heading">
                <div>
                  <p className="eyebrow">{t(getContactCategoryLabel(item.category))} · {item.name} · {formatDate(item.created_at)}</p>
                  <h3>{item.subject}</h3>
                </div>
                <a className="contact-message-email" href={"mailto:" + encodeURIComponent(item.email) + "?subject=" + encodeURIComponent("Re: " + item.subject)}><Mail size={14} /> {item.email}</a>
              </header>
              <p className={`contact-message-read-status ${item.read_at ? "is-read" : "is-unread"}`}>
                {item.read_at ? "Sudah dibaca" : "Belum dibaca"}
              </p>
              <p id={`contact-message-body-${item.id}`} className="contact-message-body" hidden={!openMessageIds.has(item.id)}>{item.message}</p>
              <div className="contact-message-actions">
                <button
                  className="button button-light"
                  type="button"
                  disabled={savingId === item.id}
                  onClick={() => void toggleMessage(item)}
                  aria-expanded={openMessageIds.has(item.id)}
                  aria-controls={`contact-message-body-${item.id}`}
                >
                  {savingId === item.id
                    ? <LoaderCircle className="spin" size={15} />
                    : openMessageIds.has(item.id) ? <EyeOff size={15} /> : <Eye size={15} />}
                  {savingId === item.id ? "Membuka..." : openMessageIds.has(item.id) ? "Tutup pesan" : "Buka pesan"}
                </button>
                <div className="contact-message-status-controls">
                  <label><span>Status pesan</span>
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
                <button className="button button-dark contact-message-reply-button" type="button" onClick={() => {
                  setReplyMessage(item);
                  setReplyBody("");
                }}>
                  <MessageCircleReply size={15} /> Balas
                </button>
              </div>
            </article>
          ))}
      </section>
      <section
        id="contact-send-message-panel"
        role="tabpanel"
        aria-labelledby="contact-send-message-tab"
        tabIndex={0}
        hidden={activeTab !== "send"}
      >
        <article className="admin-setting-card account-system-message-form">
          <div className="admin-setting-heading"><div><h3><Bell size={17} /> Kirim pesan sistem</h3><p>Kirim notifikasi ke kotak pesan akun tertentu menggunakan email akun.</p></div></div>
          <form onSubmit={(event) => void sendSystemMessage(event)}>
            <label>Email akun tujuan<input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} maxLength={254} required /></label>
            <label>Subjek<input value={systemSubject} onChange={(event) => setSystemSubject(event.target.value)} maxLength={160} required /></label>
            <label>Pesan<textarea value={systemBody} onChange={(event) => setSystemBody(event.target.value)} minLength={1} maxLength={5000} rows={4} required /></label>
            <button className="button button-dark" type="submit" disabled={sendingMessage}>
              {sendingMessage ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}
              {sendingMessage ? "Mengirim..." : "Kirim pesan sistem"}
            </button>
          </form>
        </article>
      </section>
      <dialog
        className="contact-reply-dialog"
        ref={replyDialogRef}
        aria-labelledby="contact-reply-title"
        onCancel={() => setReplyMessage(null)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            replyDialogRef.current?.close();
          }
        }}
        onClose={() => {
          setReplyMessage(null);
          setReplyBody("");
        }}
      >
        {replyMessage && (
          <form className="contact-message-reply-form" onSubmit={(event) => void sendReply(event)}>
            <header className="contact-reply-dialog-heading">
              <div>
                <p className="eyebrow">Balas pesan kontak</p>
                <h2 id="contact-reply-title">Balas pesan</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Tutup" onClick={() => replyDialogRef.current?.close()}>
                <X size={18} />
              </button>
            </header>
            <label>Akun pengirim
              <input value={`${replyMessage.name} · ${replyMessage.email}`} readOnly />
            </label>
            <label>Subjek
              <input value={`Re: ${replyMessage.subject}`} readOnly />
            </label>
            <label>Balasan privat ke kotak pesan akun
              <textarea ref={replyBodyRef} value={replyBody} onChange={(event) => setReplyBody(event.target.value)} maxLength={5000} rows={5} required />
            </label>
            <div className="contact-reply-dialog-actions">
              <button className="button button-light" type="button" onClick={() => replyDialogRef.current?.close()}>Batal</button>
              <button className="button button-dark" type="submit" disabled={savingId === replyMessage.id}>
                {savingId === replyMessage.id ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}
                {savingId === replyMessage.id ? "Mengirim..." : "Kirim balasan"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
