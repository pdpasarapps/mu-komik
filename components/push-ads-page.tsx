"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Image as ImageIcon, Megaphone, Monitor, Plus, Send, Smartphone, Tablet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/client";

type AdStatus = "pending" | "contacted" | "approved" | "rejected";
type AdRequest = {
  id: string;
  advertiser_name: string;
  campaign_title: string;
  description: string;
  destination_url: string;
  image_url: string | null;
  placements: string[];
  requested_start: string | null;
  requested_end: string | null;
  status: AdStatus;
  admin_note: string;
  created_at: string;
};

const supabase = createClient();
const placementOptions = [
  { value: "home_banner", label: "Banner beranda" },
  { value: "catalog_grid_native", label: "Di antara katalog komik" },
  { value: "comic_detail_sponsor", label: "Halaman detail komik" },
  { value: "reader_mid_chapter", label: "Di sela halaman baca" },
  { value: "reader_episode_transition", label: "Antar episode" },
];
const statusLabels: Record<AdStatus, string> = {
  pending: "Menunggu tinjauan",
  contacted: "Tim akan menghubungi",
  approved: "Pengajuan disetujui",
  rejected: "Belum dapat disetujui",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function PushAdsPreview({
  advertiserName,
  campaignTitle,
  description,
  imageUrl,
  placements,
}: {
  advertiserName: string;
  campaignTitle: string;
  description: string;
  imageUrl: string;
  placements: string[];
}) {
  const [placement, setPlacement] = useState("");
  const [failedImageUrl, setFailedImageUrl] = useState("");
  const previewHasImage = Boolean(imageUrl.trim() && isHttpUrl(imageUrl.trim()) && imageUrl.trim() !== failedImageUrl);
  const activePlacement = placements.includes(placement) ? placement : placements[0] ?? "";
  const displayPlacement = activePlacement || "home_banner";
  const readerPlacement = displayPlacement === "reader_mid_chapter" || displayPlacement === "reader_episode_transition";
  const placementLabel = placementOptions.find((item) => item.value === displayPlacement)?.label ?? "Banner beranda";

  return (
    <section className="push-ads-preview" aria-labelledby="push-ads-preview-title">
      <div className="push-ads-preview-heading">
        <div>
          <p className="eyebrow">PRATINJAU LANGSUNG</p>
          <h3 id="push-ads-preview-title">Tampilan iklanmu</h3>
        </div>
        <label>
          <span>Lihat lokasi pilihan</span>
          <select value={activePlacement} disabled={!placements.length} onChange={(event) => setPlacement(event.target.value)}>
            {!placements.length && <option value="">Pilih lokasi di formulir</option>}
            {placementOptions.filter((item) => placements.includes(item.value)).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <div className={`push-ads-preview-stage${readerPlacement ? " push-ads-preview-stage-reader" : ""}${!activePlacement ? " is-unselected" : ""}`}>
        <p className="push-ads-preview-context">Contoh penempatan · {placementLabel}</p>
        <article className={`push-ads-preview-ad${readerPlacement ? " push-ads-preview-ad-reader" : ""}`} aria-label={`Pratinjau iklan ${campaignTitle || "baru"}`}>
          <span className="push-ads-preview-label"><Megaphone size={12} /> Pratinjau iklan</span>
          <div className="push-ads-preview-content">
            <div className={`push-ads-preview-media${previewHasImage ? " has-image" : ""}`}>
              {previewHasImage
                ? <Image src={imageUrl.trim()} alt="" fill sizes="(max-width: 850px) 90vw, 350px" unoptimized onError={() => setFailedImageUrl(imageUrl.trim())} />
                : <span><ImageIcon size={22} /> Gambar iklan</span>}
            </div>
            <div className="push-ads-preview-copy">
              <small>{advertiserName.trim() || "Nama pengiklan"}</small>
              <strong>{campaignTitle.trim() || "Nama kampanye atau produk"}</strong>
              <p>{description.trim() || "Deskripsi iklan dan informasi yang ingin disampaikan kepada pembaca akan tampil di sini."}</p>
              <span className="push-ads-preview-cta">Kunjungi <ExternalLink size={13} /></span>
            </div>
          </div>
        </article>
        {!activePlacement && <p className="push-ads-preview-prompt">Pilih lokasi di formulir untuk menyesuaikan contoh tampilan iklan.</p>}
      </div>
      <p className="push-ads-preview-note">Pratinjau ini hanya simulasi. Tampilan akhir dapat menyesuaikan format dan perangkat.</p>
    </section>
  );
}

function ImageSizeGuide({ includesHomeBanner, includesOtherPlacements }: { includesHomeBanner: boolean; includesOtherPlacements: boolean }) {
  const recommendations = [
    { device: "Desktop", size: includesHomeBanner ? "1200 × 400 px" : "1200 × 600 px", icon: Monitor },
    { device: "Tablet", size: includesHomeBanner ? "768 × 360 px" : "900 × 600 px", icon: Tablet },
    { device: "Mobile", size: includesHomeBanner ? "720 × 480 px" : "720 × 900 px", icon: Smartphone },
  ];
  return (
    <div className="push-ads-image-guide" aria-label="Rekomendasi ukuran gambar">
      <strong>Rekomendasi ukuran gambar</strong>
      <div className="push-ads-image-guide-grid">
        {recommendations.map(({ device, size, icon: DeviceIcon }) => (
          <div className="push-ads-image-guide-item" key={device}>
            <span><DeviceIcon size={15} /> {device}</span>
            <b>{size}</b>
          </div>
        ))}
      </div>
      {includesHomeBanner && includesOtherPlacements
        ? <small>Untuk penempatan selain banner beranda, gunakan desktop 1200 × 600 px, tablet 900 × 600 px, dan mobile 720 × 900 px.</small>
        : !includesHomeBanner && <small>Jika memilih banner beranda, rekomendasinya desktop 1200 × 400 px, tablet 768 × 360 px, dan mobile 720 × 480 px.</small>}
      <small>JPG, PNG, atau WebP. Rasio yang tepat membantu gambar tampil utuh di berbagai layar.</small>
    </div>
  );
}

export default function PushAdsPage() {
  const [userId, setUserId] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [requests, setRequests] = useState<AdRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestTableReady, setRequestTableReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [advertiserName, setAdvertiserName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [description, setDescription] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [placements, setPlacements] = useState<string[]>([]);
  const [requestedStart, setRequestedStart] = useState("");
  const [requestedEnd, setRequestedEnd] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError) {
        console.error("Unable to check advertiser sign-in:", sessionError);
        setErrorMessage("Status masuk belum dapat diperiksa. Muat ulang halaman atau masuk kembali.");
        setLoading(false);
        return;
      }
      if (!sessionData.session) {
        setLoading(false);
        return;
      }
      const { data, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !data.user) {
        if (userError) console.error("Unable to verify advertiser account:", userError);
        setErrorMessage("Akun belum dapat diverifikasi. Silakan masuk kembali.");
        setLoading(false);
        return;
      }
      setUserId(data.user.id);
      setAccountEmail(data.user.email ?? "");
      setContactEmail(data.user.email ?? "");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileError) {
        console.error("Unable to load advertiser profile:", profileError);
      } else if (profile?.display_name) {
        setAdvertiserName(profile.display_name);
      }

      const { data: rows, error: requestError } = await supabase
        .from("ad_requests")
        .select("id, advertiser_name, campaign_title, description, destination_url, image_url, placements, requested_start, requested_end, status, admin_note, created_at")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (requestError) {
        if (requestError.code === "42P01" || requestError.code === "PGRST205") {
          console.warn("Advertiser submissions are unavailable because public.ad_requests is not installed:", {
            code: requestError.code,
            message: requestError.message,
          });
          setErrorMessage("Pengajuan iklan belum aktif. Admin perlu menjalankan supabase/ad-requests.sql di Supabase SQL Editor, lalu muat ulang halaman.");
        } else {
          console.error("Unable to load advertiser submissions:", {
            code: requestError.code,
            message: requestError.message,
            details: requestError.details,
            hint: requestError.hint,
          });
          setErrorMessage("Riwayat pengajuan iklan gagal dimuat. Coba muat ulang halaman.");
        }
      } else {
        setRequests((rows ?? []) as AdRequest[]);
        setRequestTableReady(true);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const togglePlacement = (value: string) => {
    setPlacements((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    if (!userId) return;
    if (!placements.length) {
      setErrorMessage("Pilih setidaknya satu lokasi penayangan.");
      return;
    }
    if (!isHttpUrl(destinationUrl.trim())) {
      setErrorMessage("Masukkan URL tujuan yang valid dan diawali http:// atau https://.");
      return;
    }
    if (imageUrl.trim() && !isHttpUrl(imageUrl.trim())) {
      setErrorMessage("URL materi iklan harus diawali http:// atau https://.");
      return;
    }
    if (requestedStart && requestedEnd && requestedEnd < requestedStart) {
      setErrorMessage("Tanggal akhir tidak boleh lebih awal dari tanggal mulai.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("ad_requests")
      .insert({
        user_id: userId,
        advertiser_name: advertiserName.trim(),
        contact_email: contactEmail.trim(),
        contact_whatsapp: contactWhatsapp.trim() || null,
        campaign_title: campaignTitle.trim(),
        description: description.trim(),
        destination_url: destinationUrl.trim(),
        image_url: imageUrl.trim() || null,
        placements,
        requested_start: requestedStart || null,
        requested_end: requestedEnd || null,
        status: "pending",
      })
      .select("id, advertiser_name, campaign_title, description, destination_url, image_url, placements, requested_start, requested_end, status, admin_note, created_at")
      .single();
    setSaving(false);
    if (error) {
      console.error("Unable to submit advertiser request:", error);
      setErrorMessage(error.code === "42P01" || error.code === "PGRST205"
        ? "Form pengajuan belum aktif. Admin MU Komik perlu menyiapkan database pengajuan iklan."
        : "Pengajuan belum berhasil dikirim. Periksa data dan coba lagi.");
      return;
    }
    setRequests((current) => [data as AdRequest, ...current]);
    setSuccessMessage("Pengajuan terkirim. Tim MU Komik akan meninjau dan menghubungimu melalui email.");
    setCampaignTitle("");
    setDescription("");
    setDestinationUrl("");
    setImageUrl("");
    setPlacements([]);
    setRequestedStart("");
    setRequestedEnd("");
    setContactWhatsapp("");
  };

  return (
    <main className="push-ads-page">
      <header className="push-ads-header">
        <Link href="/" aria-label="MU Komik beranda"><BrandLogo linked={false} /></Link>
        <Link className="push-ads-back" href="/"><ArrowLeft size={16} /> Beranda</Link>
      </header>

      <section className="push-ads-hero">
        <p className="eyebrow"><Megaphone size={15} /> IKLAN DI MU KOMIK</p>
        <h1>Jangkau pembaca<br /><em>cerita Indonesia.</em></h1>
        <p>Ajukan kebutuhan iklan untuk komunitas pembaca MU Komik. Tim kami akan meninjau materi, lalu menghubungimu untuk membahas harga dan jadwal.</p>
        <div className="push-ads-process">
          <span><b>01</b> Kirim kebutuhan iklan</span>
          <span><b>02</b> Ditinjau tim MU Komik</span>
          <span><b>03</b> Diskusikan penayangan</span>
        </div>
        <a className="push-ads-hero-action" href="#ad-request">Mulai pengajuan <ArrowRight size={16} /></a>
      </section>

      <section className="push-ads-content">
        <div className="push-ads-form-column">
          <div className="push-ads-section-heading" id="ad-request">
            <p className="eyebrow">MULAI PENGAJUAN</p>
            <h2>Ceritakan kampanyemu</h2>
            <p>Pengajuan ini belum menjadi iklan aktif. Tidak ada biaya yang dikenakan saat mengirim formulir.</p>
          </div>
          {loading ? <p className="push-ads-message" role="status">Memeriksa akun...</p>
            : !userId ? <div className="push-ads-login-card">
                <h3>Masuk untuk mengajukan iklan</h3>
                <p>Pengajuan dan status tinjauan akan tersimpan di akun MU Komik-mu.</p>
                <Link className="button button-dark" href="/login">Masuk atau buat akun <ArrowRight size={16} /></Link>
              </div>
              : !requestTableReady ? <div className="push-ads-login-card" role={errorMessage.includes("belum aktif") ? "status" : "alert"}>
                <h3>Formulir belum tersedia</h3>
                <p>{errorMessage || "Riwayat pengajuan belum dapat dimuat. Muat ulang halaman untuk mencoba kembali."}</p>
              </div>
              : <form className="push-ads-form" onSubmit={(event) => void submitRequest(event)}>
                {errorMessage && <p className="push-ads-alert" role="alert">{errorMessage}</p>}
                {successMessage && <p className="push-ads-success" role="status">{successMessage}</p>}
                <section className="push-ads-form-section" aria-labelledby="push-ads-campaign-heading">
                  <div className="push-ads-form-section-heading"><span>01</span><div><h3 id="push-ads-campaign-heading">Tentang kampanye</h3><p>Jelaskan produk atau layanan yang ingin kamu promosikan.</p></div></div>
                  <label className="push-ads-field">
                    <span>Nama kampanye atau produk</span>
                    <input value={campaignTitle} onChange={(event) => setCampaignTitle(event.target.value)} maxLength={120} autoComplete="off" placeholder="Contoh: Koleksi terbaru Kopi Senja" required />
                  </label>
                  <label className="push-ads-field">
                    <span>Deskripsi dan audiens yang ingin dijangkau</span>
                    <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={4} placeholder="Ceritakan pesan iklan dan siapa yang ingin kamu jangkau." required />
                    <small className="push-ads-character-count">{description.length}/500</small>
                  </label>
                  <label className="push-ads-field">
                    <span>URL tujuan iklan</span>
                    <input type="url" value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} maxLength={2000} placeholder="https://contoh.id" required />
                    <small>Halaman yang dibuka pembaca saat memilih iklan.</small>
                  </label>
                </section>

                <section className="push-ads-form-section" aria-labelledby="push-ads-placement-heading">
                  <div className="push-ads-form-section-heading"><span>02</span><div><h3 id="push-ads-placement-heading">Penempatan dan jadwal</h3><p>Pilih lokasi yang diminati. Tim akan mengonfirmasi ketersediaannya.</p></div></div>
                  <fieldset className="push-ads-placement-fieldset">
                    <legend>Lokasi iklan <small>Pilih satu atau lebih</small></legend>
                    <div className="push-ads-placement-options">
                      {placementOptions.map((placement) => (
                        <label key={placement.value}>
                          <input type="checkbox" checked={placements.includes(placement.value)} onChange={() => togglePlacement(placement.value)} />
                          <span>{placement.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="push-ads-field-grid">
                    <label className="push-ads-field">
                      <span>Perkiraan mulai <small>Opsional</small></span>
                      <input type="date" value={requestedStart} onChange={(event) => setRequestedStart(event.target.value)} />
                    </label>
                    <label className="push-ads-field">
                      <span>Perkiraan selesai <small>Opsional</small></span>
                      <input type="date" value={requestedEnd} onChange={(event) => setRequestedEnd(event.target.value)} min={requestedStart || undefined} />
                    </label>
                  </div>
                </section>

                <section className="push-ads-form-section" aria-labelledby="push-ads-creative-heading">
                  <div className="push-ads-form-section-heading"><span>03</span><div><h3 id="push-ads-creative-heading">Materi iklan</h3><p>Tambahkan gambar agar tim dapat meninjau konsep visualnya.</p></div></div>
                  <label className="push-ads-field">
                    <span>URL gambar iklan <small>Opsional</small></span>
                    <input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} maxLength={2000} placeholder="https://contoh.id/banner.jpg" />
                    <small>Gunakan URL gambar yang dapat diakses publik. JPG, PNG, atau WebP.</small>
                  </label>
                  <ImageSizeGuide
                    includesHomeBanner={placements.includes("home_banner")}
                    includesOtherPlacements={placements.some((placement) => placement !== "home_banner")}
                  />
                </section>

                <section className="push-ads-form-section" aria-labelledby="push-ads-contact-heading">
                  <div className="push-ads-form-section-heading"><span>04</span><div><h3 id="push-ads-contact-heading">Kontak pengiklan</h3><p>Gunakan kontak aktif agar tim MU Komik dapat menindaklanjuti pengajuan.</p></div></div>
                  <div className="push-ads-field-grid">
                    <label className="push-ads-field">
                      <span>Nama bisnis atau pengiklan</span>
                      <input value={advertiserName} onChange={(event) => setAdvertiserName(event.target.value)} maxLength={120} autoComplete="organization" required />
                    </label>
                    <label className="push-ads-field">
                      <span>Email kontak</span>
                      <input type="email" autoComplete="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} maxLength={254} required />
                    </label>
                  </div>
                  <label className="push-ads-field">
                    <span>WhatsApp <small>Opsional</small></span>
                    <input type="tel" autoComplete="tel" value={contactWhatsapp} onChange={(event) => setContactWhatsapp(event.target.value)} maxLength={40} placeholder="+62..." />
                  </label>
                </section>

                <div className="push-ads-form-footer">
                  <p className="push-ads-privacy-note">Pengajuan belum aktif dan belum dikenakan biaya. Tim kami akan menghubungi melalui email untuk membahas materi, harga, dan jadwal sebelum iklan tayang.</p>
                  <button className="button button-dark push-ads-submit" type="submit" disabled={saving}>
                    {saving ? "Mengirim pengajuan..." : "Kirim pengajuan"} <Send size={16} />
                  </button>
                </div>
              </form>}
        </div>

        <aside className="push-ads-side">
          <PushAdsPreview
            advertiserName={advertiserName}
            campaignTitle={campaignTitle}
            description={description}
            imageUrl={imageUrl}
            placements={placements}
          />
          <article className="push-ads-guidance">
            <span className="push-ads-guidance-icon"><Plus size={19} /></span>
            <h3>Belum ada biaya di tahap pengajuan</h3>
            <p>Tim kami akan menghubungi untuk membicarakan format yang tersedia, harga, materi, dan jadwal. Iklan hanya tayang setelah disetujui dan kampanyenya disiapkan.</p>
          </article>
          {userId && <section className="push-ads-request-history" aria-labelledby="push-ads-history-title">
            <div className="push-ads-section-heading">
              <p className="eyebrow">AKUN PENGIKLAN</p>
              <h2 id="push-ads-history-title">Pengajuan saya</h2>
              {accountEmail && <p>{accountEmail}</p>}
            </div>
            {requests.length ? requests.map((request) => (
              <article className="push-ads-request-card" key={request.id}>
                <div className="push-ads-request-card-heading">
                  <strong>{request.campaign_title}</strong>
                  <span className={`push-ads-status push-ads-status-${request.status}`}>{statusLabels[request.status]}</span>
                </div>
                <small>Dikirim {formatDate(request.created_at)}</small>
                {request.requested_start && <small>Perkiraan tayang: {formatDate(request.requested_start)}{request.requested_end ? ` – ${formatDate(request.requested_end)}` : ""}</small>}
                {request.admin_note && <p><b>Catatan tim:</b> {request.admin_note}</p>}
              </article>
            )) : !loading && <p className="push-ads-empty">Belum ada pengajuan. Isi formulir untuk memulai.</p>}
          </section>}
        </aside>
      </section>

      <footer className="push-ads-footer"><BrandLogo linked={false} /><span>© 2026 MU Komik</span></footer>
    </main>
  );
}
