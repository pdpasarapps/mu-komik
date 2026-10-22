"use client";

import { useEffect, useState } from "react";
import { Bell, LoaderCircle, Mail, MailOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/locale-provider";

type AccountMessage = {
  id: string;
  message_type: "private" | "system";
  subject: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

const supabase = createClient();
const missingTableCodes = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

function formatMessageDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AccountMessagesPanel() {
  const { t } = useLocale();
  const [messages, setMessages] = useState<AccountMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadMessages = async () => {
      const { data, error: queryError } = await supabase
        .from("account_messages")
        .select("id, message_type, subject, body, created_at, read_at")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (queryError) {
        console.error("Unable to load account messages:", queryError);
        setError(missingTableCodes.has(queryError.code)
          ? "Jalankan ulang supabase/contact-messages.sql untuk mengaktifkan kotak pesan akun."
          : "Pesan akun belum dapat dimuat. Periksa koneksi dan coba muat ulang halaman.");
        setLoading(false);
        return;
      }

      const loadedMessages = (data ?? []) as AccountMessage[];
      setMessages(loadedMessages);
      setLoading(false);

      const unreadIds = loadedMessages.filter((item) => !item.read_at).map((item) => item.id);
      if (!unreadIds.length) return;
      const readAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("account_messages")
        .update({ read_at: readAt })
        .in("id", unreadIds);
      if (!active) return;
      if (updateError) {
        console.error("Unable to mark account messages as read:", updateError);
        setError("Pesan tampil, tetapi status baca belum dapat diperbarui. Coba muat ulang halaman.");
        return;
      }
      setMessages((current) => current.map((item) => unreadIds.includes(item.id) ? { ...item, read_at: readAt } : item));
    };
    void loadMessages();
    return () => { active = false; };
  }, []);

  if (loading) return <p className="account-loading"><LoaderCircle className="spin" size={18} /> {t("Memuat pesan...")}</p>;
  return (
    <section className="account-panel account-messages-panel" aria-label={t("Kotak pesan")}>
      <div className="panel-heading">
        <div><p className="eyebrow">{t("Pesan pribadi dan sistem")}</p><h2>{t("Kotak pesan")}</h2></div>
        <MailOpen size={22} />
      </div>
      {error && <p className="account-message-error" role="alert">{t(error)}</p>}
      {messages.length
        ? <div className="account-message-list">
          {messages.map((item) => (
            <article className={`account-message-card${item.read_at ? "" : " unread"}`} key={item.id}>
              <header>
                <span className={`account-message-kind account-message-kind-${item.message_type}`}>
                  {item.message_type === "system" ? <Bell size={14} /> : <Mail size={14} />}
                  {t(item.message_type === "system" ? "Pesan sistem" : "Pesan pribadi")}
                </span>
                <time dateTime={item.created_at}>{formatMessageDate(item.created_at)}</time>
              </header>
              <h3>{item.subject}</h3>
              <p>{item.body}</p>
              {item.read_at && <small className="account-message-read">{t("Sudah dibaca")}</small>}
            </article>
          ))}
        </div>
        : !error && <div className="account-empty compact">
          <div className="empty-icon"><Mail size={23} /></div>
          <p>{t("Belum ada pesan.")}</p>
          <small>{t("Balasan Contact Us dan pesan dari tim MU-Komik akan muncul di sini.")}</small>
        </div>}
    </section>
  );
}
