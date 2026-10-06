"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ExternalLink, LoaderCircle, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AdStatus = "pending" | "contacted" | "approved" | "rejected";
type AdRequest = {
  id: string;
  advertiser_name: string;
  contact_email: string;
  contact_whatsapp: string | null;
  campaign_title: string;
  description: string;
  destination_url: string;
  image_url: string | null;
  image_url_tablet: string | null;
  image_url_mobile: string | null;
  placements: string[];
  requested_start: string | null;
  requested_end: string | null;
  status: AdStatus;
  admin_note: string;
  created_at: string;
};

const supabase = createClient();
const isAdRequestSchemaError = (code: string) => ["42P01", "42703", "PGRST204", "PGRST205"].includes(code);
const statusLabels: Record<AdStatus, string> = {
  pending: "Menunggu tinjauan",
  contacted: "Sudah dihubungi",
  approved: "Disetujui",
  rejected: "Ditolak",
};
const placementLabels: Record<string, string> = {
  home_banner: "Banner beranda",
  catalog_grid_native: "Katalog komik",
  comic_detail_sponsor: "Detail komik",
  reader_mid_chapter: "Di sela halaman baca",
  reader_episode_transition: "Antar episode",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function ReviewCard({ request, onUpdated }: { request: AdRequest; onUpdated: (request: AdRequest) => void }) {
  const [status, setStatus] = useState(request.status);
  const [adminNote, setAdminNote] = useState(request.admin_note);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const saveReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const { data, error } = await supabase
      .from("ad_requests")
      .update({ status, admin_note: adminNote.trim(), updated_at: new Date().toISOString() })
      .eq("id", request.id)
      .select("id, advertiser_name, contact_email, contact_whatsapp, campaign_title, description, destination_url, image_url, image_url_tablet, image_url_mobile, placements, requested_start, requested_end, status, admin_note, created_at")
      .single();
    setSaving(false);
    if (error) {
      console.error("Unable to save advertiser request review:", error);
      setMessage("Perubahan gagal disimpan. Periksa koneksi dan izin database.");
      return;
    }
    onUpdated(data as AdRequest);
    setMessage("Tinjauan tersimpan.");
  };

  return (
    <article className="admin-ad-request-card">
      <header className="admin-ad-request-heading">
        <div><p className="eyebrow">{request.advertiser_name}</p><h3>{request.campaign_title}</h3></div>
        <span className={`request-status request-${status === "contacted" ? "pending" : status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending"}`}>{statusLabels[status]}</span>
      </header>
      <p className="admin-ad-request-description">{request.description}</p>
      <dl className="admin-ad-request-meta">
        <div><dt>Kontak</dt><dd><a href={`mailto:${request.contact_email}`}>{request.contact_email}</a>{request.contact_whatsapp && <a href={`https://wa.me/${request.contact_whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp · {request.contact_whatsapp}</a>}</dd></div>
        <div><dt>Lokasi diminati</dt><dd>{request.placements.map((placement) => placementLabels[placement] ?? placement).join(", ")}</dd></div>
        <div><dt>Tautan tujuan</dt><dd><a href={request.destination_url} target="_blank" rel="noreferrer">{request.destination_url} <ExternalLink size={13} /></a></dd></div>
        {(request.image_url || request.image_url_tablet || request.image_url_mobile) && <div><dt>Materi iklan</dt><dd className="admin-ad-request-creatives">
          {([
            ["Desktop", request.image_url],
            ["Tablet", request.image_url_tablet],
            ["Mobile", request.image_url_mobile],
          ] as const).map(([device, imageUrl]) => imageUrl && (
            <a key={device} href={imageUrl} target="_blank" rel="noreferrer">{device} <ExternalLink size={13} /></a>
          ))}
        </dd></div>}
        <div><dt>Perkiraan jadwal</dt><dd>{request.requested_start ? `${formatDate(request.requested_start)}${request.requested_end ? ` – ${formatDate(request.requested_end)}` : ""}` : "Belum ditentukan"}</dd></div>
        <div><dt>Dikirim</dt><dd>{formatDate(request.created_at)}</dd></div>
      </dl>
      <form className="admin-ad-request-review" onSubmit={(event) => void saveReview(event)}>
        <label>Status pengajuan
          <select value={status} onChange={(event) => setStatus(event.target.value as AdStatus)}>
            {(Object.keys(statusLabels) as AdStatus[]).map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
          </select>
        </label>
        <label>Catatan untuk pengiklan
          <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} maxLength={1000} rows={3} placeholder="Tulis tindak lanjut atau alasan keputusan..." />
        </label>
        <div className="admin-ad-request-actions">
          <button className="button button-dark" type="submit" disabled={saving}>
            {saving ? <><LoaderCircle className="spin" size={15} /> Menyimpan...</> : <><Save size={15} /> Simpan tinjauan</>}
          </button>
          {message && <small role={message.includes("gagal") ? "alert" : "status"}>{message}</small>}
        </div>
      </form>
    </article>
  );
}

export default function AdRequestsPanel() {
  const [requests, setRequests] = useState<AdRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from("ad_requests")
        .select("id, advertiser_name, contact_email, contact_whatsapp, campaign_title, description, destination_url, image_url, image_url_tablet, image_url_mobile, placements, requested_start, requested_end, status, admin_note, created_at")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        if (isAdRequestSchemaError(error.code)) {
          console.warn("Advertiser request schema is outdated:", { code: error.code, message: error.message });
        } else {
          console.error("Unable to load advertiser requests for review:", error);
        }
        setErrorMessage(isAdRequestSchemaError(error.code)
          ? "Skema pengajuan iklan belum lengkap. Jalankan ulang supabase/ad-requests.sql di Supabase SQL Editor."
          : "Pengajuan iklan gagal dimuat. Periksa koneksi dan izin database.");
      } else {
        setRequests((data ?? []) as AdRequest[]);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  if (loading) return <p className="admin-loading"><LoaderCircle className="spin" size={18} /> Memuat pengajuan iklan...</p>;
  if (errorMessage) return <p className="admin-settings-error" role="alert">{errorMessage}</p>;
  if (!requests.length) return <div className="admin-empty"><p>Belum ada pengajuan iklan.</p></div>;

  return (
    <div className="admin-ad-requests-list">
      <p className="admin-ad-requests-count">{requests.filter((request) => request.status === "pending").length} pengajuan menunggu tinjauan · {requests.length} total</p>
      {requests.map((request) => (
        <ReviewCard
          key={request.id}
          request={request}
          onUpdated={(updated) => setRequests((current) => current.map((item) => item.id === updated.id ? updated : item))}
        />
      ))}
    </div>
  );
}
