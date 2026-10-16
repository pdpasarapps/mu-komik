"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type KidsCuration = {
  age_range: "4_6" | "7_9" | "10_12";
  review_status: "pending" | "approved" | "rejected";
  review_note: string;
  submitted_at: string;
};

const AGE_RANGES = [
  { value: "4_6", label: "4–6 tahun" },
  { value: "7_9", label: "7–9 tahun" },
  { value: "10_12", label: "10–12 tahun" },
] as const;

const supabase = createClient();

export default function CreatorKidsCuration({ comicId }: { comicId: string }) {
  const [curation, setCuration] = useState<KidsCuration | null>(null);
  const [ageRange, setAgeRange] = useState<KidsCuration["age_range"]>("4_6");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const loadCuration = async () => {
      const { data, error } = await supabase
        .from("comic_kids_curation")
        .select("age_range, review_status, review_note, submitted_at")
        .eq("comic_id", comicId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error("Unable to load kids curation request:", error);
        setMessage(error.code === "42P01" || error.code === "PGRST205"
          ? "Aktifkan fitur ini dengan menjalankan supabase/comic-kids-curation.sql."
          : "Status kurasi anak gagal dimuat. Periksa koneksi dan coba lagi.");
      } else if (data) {
        setCuration(data as KidsCuration);
        setAgeRange(data.age_range as KidsCuration["age_range"]);
      }
      setLoading(false);
    };
    void loadCuration();
    return () => { active = false; };
  }, [comicId]);

  const submitRequest = async () => {
    setSaving(true);
    setMessage("");
    if (curation?.review_status === "rejected") {
      const { error } = await supabase
        .from("comic_kids_curation")
        .delete()
        .eq("comic_id", comicId)
        .eq("review_status", "rejected");
      if (error) {
        console.error("Unable to replace rejected kids curation request:", error);
        setMessage("Pengajuan sebelumnya tidak dapat diperbarui. Periksa koneksi lalu coba lagi.");
        setSaving(false);
        return;
      }
    }

    const { data, error } = await supabase
      .from("comic_kids_curation")
      .insert({ comic_id: comicId, age_range: ageRange, review_status: "pending" })
      .select("age_range, review_status, review_note, submitted_at")
      .single();
    if (error) {
      console.error("Unable to submit kids curation request:", error);
      setMessage(error.code === "42P01" || error.code === "PGRST205"
        ? "Aktifkan fitur ini dengan menjalankan supabase/comic-kids-curation.sql."
        : "Pengajuan kurasi anak gagal dikirim. Periksa koneksi dan coba lagi.");
    } else {
      setCuration(data as KidsCuration);
      setMessage("Pengajuan kurasi anak berhasil dikirim.");
    }
    setSaving(false);
  };

  return (
    <fieldset className="comic-contributors-fieldset creator-kids-curation">
      <legend>Kids Mode</legend>
      <p className="creator-kids-curation-note">
        Komik hanya muncul di Kids Mode setelah disetujui admin. Target pembaca “semua umur” tidak otomatis memasukkan komik ke library anak.
      </p>
      {loading ? (
        <p role="status"><LoaderCircle className="spin" size={16} /> Memuat status kurasi...</p>
      ) : curation?.review_status === "approved" ? (
        <div className="creator-kids-curation-status">
          <span className="request-status request-approved"><ShieldCheck size={14} /> Disetujui untuk Kids Mode</span>
          <p>Rentang usia: {AGE_RANGES.find((item) => item.value === curation.age_range)?.label}</p>
        </div>
      ) : curation?.review_status === "pending" ? (
        <div className="creator-kids-curation-status">
          <span className="request-status request-pending">Menunggu kurasi admin</span>
          <p>Rentang usia yang diajukan: {AGE_RANGES.find((item) => item.value === curation.age_range)?.label}</p>
        </div>
      ) : (
        <>
          {curation?.review_status === "rejected" && (
            <div className="creator-kids-curation-status">
              <span className="request-status request-rejected">Perlu perbaikan</span>
              <p>{curation.review_note || "Pengajuan belum disetujui. Periksa kembali konten dan rentang usia sebelum mengajukan ulang."}</p>
            </div>
          )}
          <label>
            Rentang usia anak
            <select value={ageRange} onChange={(event) => setAgeRange(event.target.value as KidsCuration["age_range"])}>
              {AGE_RANGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <button className="button button-light" type="button" onClick={() => void submitRequest()} disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
            {saving ? "Mengirim..." : curation?.review_status === "rejected" ? "Ajukan ulang untuk Kids Mode" : "Ajukan ke Kids Mode"}
          </button>
        </>
      )}
      {message && <p role={message.startsWith("Pengajuan") ? "status" : "alert"}>{message}</p>}
    </fieldset>
  );
}
