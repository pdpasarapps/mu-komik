"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { ArrowLeft, Archive, BookOpen, ChartNoAxesColumn, Check, ClipboardList, Eye, Image as ImageIcon, LayoutDashboard, LoaderCircle, Megaphone, Search, Settings2, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import AdminAnalyticsPanel from "./analytics-panel";
import { createComicSharePreview } from "@/lib/comic-share-preview";
import { defaultPlatformSettings, type PlatformSettings } from "@/lib/platform-settings";
import { usePlatformSettings } from "../platform-runtime";

type RequestStatus = "pending" | "approved" | "rejected";
type CreatorRequest = { id: string; user_id: string; note: string; portfolio_url: string | null; instagram_url: string | null; other_url: string | null; status: RequestStatus; created_at: string; applicant: string; role: string };
type ComicReview = { id: string; title: string; slug: string; synopsis: string; contributor: string; created_at: string; creator_id: string; creator: string };
type AdminUser = { id: string; display_name: string; role: "reader" | "creator" | "admin"; created_at: string };
type AdminComic = { id: string; title: string; slug: string; synopsis: string; contributor: string; genre: string; cover_key: string | null; share_preview_key: string | null; status: "draft" | "pending_review" | "published" | "archived"; created_at: string; creator_id: string; creator: string };
type AdminSection = "overview" | "analytics" | "comic-review" | "creator-requests" | "users" | "comics" | "share-previews" | "ads-management" | "platform-settings";

const supabase = createClient();
const adminSections: Record<AdminSection, { label: string; description: string }> = {
  overview: { label: "Dashboard admin", description: "Kelola akun, komik, kurasi, dan pengajuan kreator mu-komik." },
  analytics: { label: "Analitik", description: "Pantau aktivitas membaca dan komik yang paling banyak dibaca." },
  "comic-review": { label: "Kurasi komik", description: "Tinjau komik yang menunggu persetujuan untuk diterbitkan." },
  "creator-requests": { label: "Pengajuan kreator", description: "Tinjau permohonan akses kreator." },
  users: { label: "Manajemen pengguna", description: "Kelola akun dan peran pengguna." },
  comics: { label: "Katalog komik", description: "Cari komik dan kelola status publikasinya." },
  "share-previews": { label: "Preview share komik", description: "Buat gambar preview statis di R2 untuk dibaca WhatsApp dan platform sosial." },
  "ads-management": { label: "Iklan & sponsor", description: "Siapkan monetisasi platform melalui iklan dan kerja sama sponsor." },
  "platform-settings": { label: "Pengaturan platform", description: "Atur status operasional dan fitur yang tersedia di MU-Komik." },
};
const roleLabels = { reader: "Pembaca", creator: "Kreator", admin: "Admin" };
const comicStatusLabels = { draft: "Draf", pending_review: "Menunggu kurasi", published: "Terbit", archived: "Diarsipkan" };
const requestStatusLabels = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" };

export default function AdminPage() {
  const router = useRouter();
  const { updateSettings } = usePlatformSettings();
  const params = useParams<{ section?: string }>();
  const requestedSection = params.section;
  const section = requestedSection && requestedSection in adminSections
    ? requestedSection as AdminSection
    : "overview";
  const [requests, setRequests] = useState<CreatorRequest[]>([]);
  const [comicReviews, setComicReviews] = useState<ComicReview[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [comics, setComics] = useState<AdminComic[]>([]);
  const [adminUserId, setAdminUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [comicActionId, setComicActionId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [comicSearch, setComicSearch] = useState("");
  const [comicStatusFilter, setComicStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<CreatorRequest | null>(null);
  const [generatingSharePreviews, setGeneratingSharePreviews] = useState(false);
  const [sharePreviewProgress, setSharePreviewProgress] = useState("");
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(defaultPlatformSettings);
  const [platformSettingsError, setPlatformSettingsError] = useState("");
  const [savingPlatformSettings, setSavingPlatformSettings] = useState(false);
  const [platformSettingsMessage, setPlatformSettingsMessage] = useState("");
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  const loadRequests = useEffectEvent(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
    if (profile?.role !== "admin") {
      router.replace("/account");
      return;
    }
    setAdminUserId(userData.user.id);
    if (section === "platform-settings") {
      const { data: settingsData, error: settingsError } = await supabase
        .from("platform_settings")
        .select("maintenance_enabled, maintenance_message, announcement_enabled, announcement_message, feature_flags")
        .eq("id", true)
        .maybeSingle();
      if (settingsError) {
        console.error("Unable to load platform settings:", settingsError);
        setPlatformSettingsError("Pengaturan belum dapat dimuat. Jalankan supabase/platform-settings.sql di Supabase SQL Editor, lalu muat ulang halaman.");
      } else if (settingsData) {
        setPlatformSettings({
          ...defaultPlatformSettings,
          ...settingsData,
          feature_flags: { ...defaultPlatformSettings.feature_flags, ...settingsData.feature_flags },
        });
        setPlatformSettingsError("");
      } else {
        setPlatformSettings(defaultPlatformSettings);
        setPlatformSettingsError("");
      }
    }
    const [requestResult, profileResult, comicResult] = await Promise.all([
      supabase.from("creator_requests").select("id, user_id, note, portfolio_url, instagram_url, other_url, status, created_at").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, display_name, role, created_at").order("created_at", { ascending: false }),
      supabase.from("comics").select("id, title, slug, synopsis, contributor, genre, cover_key, share_preview_key, status, created_at, creator_id").order("created_at", { ascending: false }),
    ]);
    const loadErrors = [requestResult.error, profileResult.error, comicResult.error].filter(Boolean);
    if (loadErrors.length) {
      setMessage(loadErrors.map((error) => error?.message).join(" · "));
      setLoading(false);
      return;
    }
    const profiles = (profileResult.data ?? []) as AdminUser[];
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    setUsers(profiles);
    setRequests((requestResult.data ?? []).map((request) => ({
      ...request,
      applicant: profileMap.get(request.user_id)?.display_name || "Pengguna tanpa nama",
      role: profileMap.get(request.user_id)?.role || "reader",
    })));
    const comicData = (comicResult.data ?? []) as Omit<AdminComic, "creator">[];
    setComics(comicData.map((comic) => ({
      ...comic,
      creator: profileMap.get(comic.creator_id)?.display_name || `Akun ${comic.creator_id.slice(0, 8)}`,
    })));
    const { data: pendingComics, error: comicError } = await supabase
      .from("comics")
      .select("id, title, slug, synopsis, contributor, created_at, creator_id")
      .eq("status", "pending_review")
      .order("created_at", { ascending: true });
    if (comicError) {
      setMessage(comicError.message);
    } else {
      setComicReviews((pendingComics ?? []).map((comic) => ({
        ...comic,
        creator: profileMap.get(comic.creator_id)?.display_name || `Akun ${comic.creator_id.slice(0, 8)}`,
      })));
    }
    setLoading(false);
  });

  useEffect(() => {
    const timer = window.setTimeout(() => loadRequests(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const generateSharePreviews = async () => {
    if (generatingSharePreviews) return;
    if (!publicUrl) {
      setMessage("NEXT_PUBLIC_R2_PUBLIC_URL belum dikonfigurasi.");
      return;
    }
    const comicsToProcess = comics.filter((comic) => comic.status === "published" && comic.cover_key && !comic.share_preview_key);
    if (!comicsToProcess.length) {
      setMessage("Tidak ada komik terbit dengan cover untuk diproses.");
      return;
    }

    setGeneratingSharePreviews(true);
    setMessage("");
    setSharePreviewProgress(`0 dari ${comicsToProcess.length} komik`);
    let generated = 0;
    const failures: string[] = [];
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sesi admin berakhir. Silakan masuk kembali.");

      for (const [index, comic] of comicsToProcess.entries()) {
        try {
          const coverResponse = await fetch(`/api/share-cover?key=${encodeURIComponent(comic.cover_key!)}`);
          if (!coverResponse.ok) throw new Error(`Cover gagal diunduh (${coverResponse.status}).`);
          const preview = await createComicSharePreview(await coverResponse.blob(), comic.title);
          const signResponse = await fetch("/api/r2/share-preview", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ comicId: comic.id, coverKey: comic.cover_key }),
          });
          const signResult = await signResponse.json() as { uploadUrl?: string; objectKey?: string; headers?: Record<string, string>; error?: string };
          if (!signResponse.ok || !signResult.uploadUrl || !signResult.objectKey || !signResult.headers) {
            throw new Error(signResult.error || "URL upload preview tidak tersedia.");
          }
          const uploadResponse = await fetch(signResult.uploadUrl, {
            method: "PUT",
            headers: signResult.headers,
            body: preview,
          });
          if (!uploadResponse.ok) throw new Error(`Upload preview gagal (${uploadResponse.status}).`);
          const { error: savePreviewError } = await supabase
            .from("comics")
            .update({ share_preview_key: signResult.objectKey })
            .eq("id", comic.id)
            .eq("status", "published");
          if (savePreviewError) throw new Error(`Preview terunggah tetapi belum tertaut ke komik: ${savePreviewError.message}`);
          setComics((current) => current.map((item) => item.id === comic.id
            ? { ...item, share_preview_key: signResult.objectKey! }
            : item));
          generated += 1;
        } catch (error) {
          const errorMessage = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
          console.error("Unable to generate comic share preview:", { comicId: comic.id, error: errorMessage });
          failures.push(`${comic.title}: ${errorMessage}`);
        }
        setSharePreviewProgress(`${index + 1} dari ${comicsToProcess.length} komik`);
      }
      setMessage(failures.length
        ? `${generated} preview berhasil dibuat; ${failures.length} gagal. ${failures.slice(0, 3).join(" · ")}`
        : `${generated} preview share komik berhasil dibuat dan disimpan di R2.`);
    } catch (error) {
      console.error("Comic share preview generation failed:", error);
      setMessage(error instanceof Error ? error.message : "Preview share komik tidak dapat dibuat.");
    } finally {
      setGeneratingSharePreviews(false);
    }
  };

  const savePlatformSettings = async () => {
    if (savingPlatformSettings) return;
    setSavingPlatformSettings(true);
    setPlatformSettingsMessage("");
    const { error } = await supabase.from("platform_settings").upsert({
      id: true,
      ...platformSettings,
      updated_by: adminUserId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (error) {
      console.error("Unable to save platform settings:", error);
      setPlatformSettingsMessage(error.code === "42P01" || error.code === "PGRST205"
        ? "Tabel pengaturan belum tersedia. Jalankan supabase/platform-settings.sql di Supabase SQL Editor."
        : `Pengaturan gagal disimpan: ${error.message}`);
    } else {
      updateSettings(platformSettings);
      setPlatformSettingsMessage("Pengaturan platform berhasil disimpan.");
    }
    setSavingPlatformSettings(false);
  };

  const reviewRequest = async (request: CreatorRequest, status: "approved" | "rejected") => {
    setActionId(request.id);
    setMessage("");
    const { error } = await supabase.rpc("review_creator_request", { p_request_id: request.id, p_decision: status });
    if (error) {
      setMessage(error.message);
      setActionId(null);
      return;
    }
    setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status, role: status === "approved" ? "creator" : item.role } : item));
    if (status === "approved") {
      setUsers((current) => current.map((user) => user.id === request.user_id ? { ...user, role: "creator" } : user));
    }
    setMessage(status === "approved" ? "Akses kreator disetujui." : "Pengajuan akses kreator ditolak.");
    setActionId(null);
  };

  const updateUserRole = async (user: AdminUser, role: "reader" | "creator") => {
    if (user.id === adminUserId) {
      setMessage("Peran akun admin yang sedang digunakan tidak dapat diubah dari sini.");
      return;
    }
    setActionId(user.id);
    setMessage("");
    const { error } = await supabase.from("profiles").update({ role }).eq("id", user.id);
    if (error) {
      setMessage(error.message);
    } else {
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, role } : item));
      setMessage(`Peran ${user.display_name} diubah menjadi ${roleLabels[role]}.`);
    }
    setActionId(null);
  };

  const updateComicStatus = async (comic: AdminComic, status: "pending_review" | "archived" | "draft") => {
    setComicActionId(comic.id);
    setMessage("");
    const { data, error } = await supabase
      .from("comics")
      .update({ status })
      .eq("id", comic.id)
      .eq("status", comic.status)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      setMessage(error?.message || "Status komik sudah berubah. Muat ulang halaman.");
    } else {
      setComics((current) => current.map((item) => item.id === comic.id ? { ...item, status } : item));
      if (status === "pending_review") {
        const reviewItem: ComicReview = { ...comic };
        setComicReviews((current) => [reviewItem, ...current]);
      } else {
        setComicReviews((current) => current.filter((item) => item.id !== comic.id));
      }
      setMessage(`${comic.title}: status diubah menjadi ${comicStatusLabels[status]}.`);
    }
    setComicActionId(null);
  };

  const reviewComic = async (comic: ComicReview, decision: "published" | "draft") => {
    setComicActionId(comic.id);
    setMessage("");
    const { data, error } = await supabase
      .from("comics")
      .update({ status: decision })
      .eq("id", comic.id)
      .eq("status", "pending_review")
      .select("id")
      .maybeSingle();
    if (error || !data) {
      setMessage(error?.message || "Komik ini sudah dikurasi admin lain. Muat ulang halaman.");
      setComicActionId(null);
      return;
    }
    setComicReviews((current) => current.filter((item) => item.id !== comic.id));
    setComics((current) => current.map((item) => item.id === comic.id ? { ...item, status: decision } : item));
    setMessage(decision === "published" ? `${comic.title} berhasil diterbitkan.` : `${comic.title} ditolak dan dikembalikan ke draft.`);
    setComicActionId(null);
  };

  const filteredUsers = users.filter((user) => `${user.display_name} ${user.id}`.toLowerCase().includes(userSearch.toLowerCase()));
  const filteredComics = comics.filter((comic) => {
    const matchesSearch = `${comic.title} ${comic.creator} ${comic.genre}`.toLowerCase().includes(comicSearch.toLowerCase());
    return matchesSearch && (comicStatusFilter === "all" || comic.status === comicStatusFilter);
  });
  const pendingRequests = requests.filter((request) => request.status === "pending").length;
  const publishedComics = comics.filter((comic) => comic.status === "published").length;
  const generatedSharePreviews = comics.filter((comic) => comic.status === "published" && comic.share_preview_key);

  if (loading) return <main className="admin-shell"><LoaderCircle className="spin" size={24} /></main>;

  return (
    <main className="admin-shell">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <Link className="admin-brand" href="/account" aria-label="Kembali ke Akun"><BrandLogo linked={false} /></Link>
          <nav className="admin-sidebar-links" aria-label="Navigasi dashboard admin">
            <p className="admin-sidebar-label">Administrasi</p>
            <div className="admin-sidebar-group" aria-label="Dashboard">
              <p className="admin-sidebar-group-label">Dashboard</p>
              <Link href="/admin/overview" aria-current={section === "overview" ? "page" : undefined}><LayoutDashboard size={18} /><span>Ringkasan</span></Link>
              <Link href="/admin/analytics" aria-current={section === "analytics" ? "page" : undefined}><ChartNoAxesColumn size={18} /><span>Analitik</span></Link>
            </div>
            <div className="admin-sidebar-group" aria-label="Moderasi">
              <p className="admin-sidebar-group-label">Moderasi</p>
              <Link href="/admin/comic-review" aria-current={section === "comic-review" ? "page" : undefined}><BookOpen size={18} /><span>Kurasi komik</span>{comicReviews.length > 0 && <small>{comicReviews.length}</small>}</Link>
              <Link href="/admin/creator-requests" aria-current={section === "creator-requests" ? "page" : undefined}><ClipboardList size={18} /><span>Pengajuan kreator</span>{requests.length > 0 && <small>{requests.length}</small>}</Link>
            </div>
            <div className="admin-sidebar-group" aria-label="Kelola konten">
              <p className="admin-sidebar-group-label">Kelola konten</p>
              <Link href="/admin/users" aria-current={section === "users" ? "page" : undefined}><Users size={18} /><span>Pengguna</span></Link>
              <Link href="/admin/comics" aria-current={section === "comics" ? "page" : undefined}><BookOpen size={18} /><span>Katalog komik</span></Link>
              <Link href="/admin/share-previews" aria-current={section === "share-previews" ? "page" : undefined}><ImageIcon size={18} /><span>Preview share</span></Link>
            </div>
            <div className="admin-sidebar-group" aria-label="Ads Management">
              <p className="admin-sidebar-group-label">Ads Management</p>
              <Link href="/admin/ads-management" aria-current={section === "ads-management" ? "page" : undefined}><Megaphone size={18} /><span>Iklan & sponsor</span></Link>
            </div>
            <div className="admin-sidebar-group" aria-label="Pengaturan">
              <p className="admin-sidebar-group-label">Pengaturan</p>
              <Link href="/admin/platform-settings" aria-current={section === "platform-settings" ? "page" : undefined}><Settings2 size={18} /><span>Pengaturan platform</span></Link>
            </div>
          </nav>
          <div className="admin-sidebar-user">
            <span className="admin-user-avatar"><ShieldCheck size={18} /></span>
            <span><strong>Administrator</strong><small>Akses penuh</small></span>
            <Link href="/account" aria-label="Kembali ke Akun"><ArrowLeft size={17} /></Link>
          </div>
        </aside>
        <div className="admin-main">
          <div className="admin-mobile-header"><BrandLogo linked={false} /><Link className="admin-account-link" href="/account"><ArrowLeft size={16} /> Akun</Link></div>
          <header className="admin-header">
            <p className="eyebrow">Panel administrasi</p>
            <div className="admin-title">
              <div><h1>{adminSections[section].label}</h1><p>{adminSections[section].description}</p></div>
            </div>
          </header>
          <section className="admin-content">
        {message && <p className="admin-message" role="status">{message}</p>}
        {section === "overview" && <section className="admin-dashboard" id="overview" aria-label="Ringkasan">
          <article className="admin-stat"><span>Total pengguna</span><strong>{users.length}</strong><UserRound size={20} /></article>
          <article className="admin-stat"><span>Total komik</span><strong>{comics.length}</strong><BookOpen size={20} /></article>
          <article className="admin-stat"><span>Komik terbit</span><strong>{publishedComics}</strong><Eye size={20} /></article>
          <article className="admin-stat"><span>Perlu ditinjau</span><strong>{comicReviews.length + pendingRequests}</strong><ShieldCheck size={20} /></article>
        </section>}
        {section === "ads-management" && <section className="admin-management-section">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Monetisasi platform</p><h2>Iklan & sponsor</h2></div>
          </div>
          <div className="admin-empty">
            <Megaphone size={28} />
            <h2>Ruang iklan dan sponsor sedang disiapkan.</h2>
            <p>Pengelolaan kampanye, penempatan iklan, dan kerja sama sponsor akan tersedia di sini.</p>
          </div>
        </section>}
        {section === "platform-settings" && <section className="admin-management-section admin-platform-settings">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Operasional</p><h2>Website dan platform</h2></div>
          </div>
          {platformSettingsError ? <p className="admin-settings-error" role="alert">{platformSettingsError}</p> : <>
            <article className="admin-setting-card">
              <div className="admin-setting-heading"><div><h3>Mode maintenance</h3><p>Pengunjung akan melihat halaman maintenance. Panel admin dan halaman masuk tetap bisa digunakan.</p></div><label className="admin-switch"><input type="checkbox" checked={platformSettings.maintenance_enabled} onChange={(event) => setPlatformSettings((current) => ({ ...current, maintenance_enabled: event.target.checked }))} /><span /></label></div>
              <label className="admin-setting-field">Pesan maintenance<textarea value={platformSettings.maintenance_message} onChange={(event) => setPlatformSettings((current) => ({ ...current, maintenance_message: event.target.value }))} maxLength={500} rows={3} /></label>
            </article>
            <article className="admin-setting-card">
              <div className="admin-setting-heading"><div><h3>Banner pengumuman</h3><p>Tampilkan pengumuman di bagian atas halaman untuk semua pengunjung.</p></div><label className="admin-switch"><input type="checkbox" checked={platformSettings.announcement_enabled} onChange={(event) => setPlatformSettings((current) => ({ ...current, announcement_enabled: event.target.checked }))} /><span /></label></div>
              <label className="admin-setting-field">Isi pengumuman<textarea value={platformSettings.announcement_message} onChange={(event) => setPlatformSettings((current) => ({ ...current, announcement_message: event.target.value }))} maxLength={300} rows={3} placeholder="Tulis pengumuman untuk pembaca dan kreator..." /></label>
            </article>
            <article className="admin-setting-card">
              <div className="admin-setting-heading"><div><h3>Status fitur</h3><p>Fitur yang dimatikan akan menampilkan pemberitahuan dan tidak bisa dibuka pengunjung. Komentar belum tersedia; statusnya disimpan untuk aktivasi di masa mendatang.</p></div></div>
              <div className="admin-feature-toggles">
                {([
                  ["reading", "Membaca komik"],
                  ["search", "Pencarian komik"],
                  ["creators", "Area kreator"],
                  ["comments", "Komentar (siap untuk fitur mendatang)"],
                  ["favorites", "Favorit komik"],
                ] as const).map(([feature, label]) => (
                  <label className="admin-feature-toggle" key={feature}><span>{label}</span><input type="checkbox" checked={platformSettings.feature_flags[feature]} onChange={(event) => setPlatformSettings((current) => ({ ...current, feature_flags: { ...current.feature_flags, [feature]: event.target.checked } }))} /></label>
                ))}
              </div>
            </article>
            <div className="admin-settings-actions">
              <button className="approve-button" type="button" onClick={() => void savePlatformSettings()} disabled={savingPlatformSettings}>{savingPlatformSettings ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{savingPlatformSettings ? "Menyimpan..." : "Simpan pengaturan"}</button>
              {platformSettingsMessage && <p role={platformSettingsMessage.startsWith("Pengaturan platform berhasil") ? "status" : "alert"}>{platformSettingsMessage}</p>}
            </div>
          </>}
        </section>}
        {section === "analytics" && <AdminAnalyticsPanel />}
        {section === "share-previews" && <section className="admin-management-section">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Gambar sosial</p><h2>Preview share komik</h2></div>
            <span>{comics.filter((comic) => comic.status === "published" && comic.cover_key && !comic.share_preview_key).length} komik belum memiliki preview</span>
          </div>
          <p>Cover diproses di browser menjadi JPG landscape, lalu disimpan sebagai file statis di R2. Worker hanya memberikan URL upload dan tidak merender gambar. Tombol ini membuat preview yang belum tersedia untuk komik terbit.</p>
          {sharePreviewProgress && <p role="status">{sharePreviewProgress}</p>}
          <button className="approve-button" type="button" onClick={() => void generateSharePreviews()} disabled={generatingSharePreviews}>
            {generatingSharePreviews ? <LoaderCircle className="spin" size={16} /> : <ImageIcon size={16} />}
            {generatingSharePreviews ? "Membuat preview..." : "Buat preview untuk semua komik terbit"}
          </button>
          <div className="admin-section-heading">
            <div><p className="eyebrow">Tersimpan di R2</p><h2>Preview yang sudah dibuat</h2></div>
            <span>{generatedSharePreviews.length} komik</span>
          </div>
          {generatedSharePreviews.length ? (
            <div className="request-table-wrap">
              <table className="request-table">
                <thead>
                  <tr><th>Preview</th><th>Komik</th><th>Status</th><th>File R2</th></tr>
                </thead>
                <tbody>
                  {generatedSharePreviews.map((comic) => {
                    const previewUrl = publicUrl
                      ? `${publicUrl.replace(/\/$/, "")}/${comic.share_preview_key!.split("/").map(encodeURIComponent).join("/")}`
                      : "";
                    return (
                      <tr key={comic.id}>
                        <td>
                          {previewUrl && (
                            <a href={previewUrl} target="_blank" rel="noreferrer" aria-label={`Buka preview share ${comic.title}`}>
                              <Image
                                src={previewUrl}
                                alt={`Preview share ${comic.title}`}
                                width={120}
                                height={63}
                                unoptimized
                                style={{ width: 120, height: 63, objectFit: "cover", borderRadius: 6 }}
                              />
                            </a>
                          )}
                        </td>
                        <td><strong>{comic.title}</strong><code>{comic.slug}</code></td>
                        <td><span className="request-status request-approved">Sudah dibuat</span></td>
                        <td>{previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer">Lihat file JPG</a>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty"><ImageIcon size={26} /><h2>Belum ada preview yang dibuat.</h2><p>Preview komik akan tercatat di tabel ini setelah proses berhasil.</p></div>
          )}
        </section>}
        {section === "comic-review" && <section className="comic-review-section" id="comic-review">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Antrean publikasi</p><h2>Kurasi komik</h2></div>
            <span>{comicReviews.length} menunggu kurasi</span>
          </div>
          {comicReviews.length === 0 ? (
            <div className="admin-empty comic-review-empty"><ShieldCheck size={26} /><h2>Tidak ada komik untuk ditinjau.</h2><p>Pengajuan komik dari kreator akan tampil di sini.</p></div>
          ) : (
            <div className="comic-review-list">
              {comicReviews.map((comic) => (
                <article className="comic-review-card" key={comic.id}>
                  <div className="comic-review-copy">
                    <span className="request-status request-pending">Menunggu kurasi</span>
                    <h3>{comic.title}</h3>
                    <p className="comic-review-creator">Oleh {comic.creator} · {new Date(comic.created_at).toLocaleDateString("id-ID")}</p>
                    <p className="comic-review-synopsis">{comic.synopsis}</p>
                    {comic.contributor && <p className="comic-review-contributor">Kontributor: {comic.contributor}</p>}
                  </div>
                  <div className="comic-review-actions">
                    <Link className="button button-light" href={`/account/komik/${comic.id}`}><Eye size={15} /> Tinjau komik</Link>
                    <button className="approve-button" onClick={() => reviewComic(comic, "published")} disabled={comicActionId === comic.id}><Check size={16} /> Terbitkan</button>
                    <button className="reject-button" onClick={() => reviewComic(comic, "draft")} disabled={comicActionId === comic.id}><X size={16} /> Kembalikan ke draf</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>}
        {section === "creator-requests" && <section className="creator-requests-section" id="creator-requests">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Akses kreator</p><h2>Pengajuan kreator</h2></div>
            <span>{requests.length} menunggu</span>
          </div>
          {requests.length === 0 ? (
            <div className="admin-empty"><ShieldCheck size={28} /><h2>Tidak ada pengajuan yang menunggu.</h2><p>Pengajuan lama yang sudah disetujui atau ditolak tidak ditampilkan di antrean ini.</p></div>
          ) : (
            <div className="request-table-wrap">
              <table className="request-table">
                <thead><tr><th>Pengaju</th><th>Catatan</th><th>Portofolio & media sosial</th><th>Tanggal</th><th>Status</th><th>Tindakan</th></tr></thead>
                <tbody>{requests.map((request) => (
                  <tr key={request.id}>
                    <td><strong>{request.applicant}</strong><code>{request.user_id.slice(0, 8)}...</code></td>
                    <td><p className="request-preview">{request.note || "Tidak ada catatan."}</p><button className="view-button" onClick={() => setSelectedRequest(request)}>Lihat</button></td>
                    <td><div className="request-links compact-links">{request.portfolio_url && <a href={request.portfolio_url} target="_blank" rel="noreferrer">Portofolio</a>}{request.instagram_url && <a href={request.instagram_url} target="_blank" rel="noreferrer">Instagram</a>}{request.other_url && <a href={request.other_url} target="_blank" rel="noreferrer">Lainnya</a>}{!request.portfolio_url && !request.instagram_url && !request.other_url && <span>Tidak ada</span>}</div></td>
                    <td>{new Date(request.created_at).toLocaleDateString("id-ID")}</td>
                    <td><span className={`request-status request-${request.status}`}>{request.status === "pending" ? "Menunggu" : request.status === "approved" ? "Disetujui" : "Ditolak"}</span>{request.status === "approved" && <small>Peran: {roleLabels[request.role as keyof typeof roleLabels] || "Pembaca"}</small>}</td>
                    <td>{request.status === "pending" ? <div className="request-actions"><button className="approve-button" onClick={() => reviewRequest(request, "approved")} disabled={actionId === request.id}><Check size={16} /> Setujui</button><button className="reject-button" onClick={() => reviewRequest(request, "rejected")} disabled={actionId === request.id}><X size={16} /> Tolak</button></div> : <span className="reviewed-label">Sudah ditinjau</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>}
        {section === "users" && <section className="admin-management-section" id="user-management">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Akun dan akses</p><h2>Manajemen pengguna</h2></div>
            <span>{users.length} pengguna</span>
          </div>
          <label className="admin-search"><Search size={17} /><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Cari nama atau ID pengguna" /></label>
          {filteredUsers.length === 0 ? (
            <div className="admin-empty"><Users size={26} /><h2>Pengguna tidak ditemukan.</h2><p>Coba kata kunci lain.</p></div>
          ) : (
            <div className="request-table-wrap">
              <table className="request-table admin-user-table">
                <thead><tr><th>Pengguna</th><th>Bergabung</th><th>Peran</th><th>Kelola peran</th></tr></thead>
                <tbody>{filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.display_name || "Tanpa nama"}</strong><code>{user.id.slice(0, 12)}...</code></td>
                    <td>{new Date(user.created_at).toLocaleDateString("id-ID")}</td>
                    <td><span className={`request-status request-${user.role === "admin" ? "approved" : user.role === "creator" ? "pending" : "draft"}`}>{roleLabels[user.role]}</span></td>
                    <td>{user.role === "admin"
                      ? <span className="reviewed-label">Akses admin dilindungi</span>
                      : user.id === adminUserId
                        ? <span className="reviewed-label">Akun yang sedang digunakan</span>
                        : <select className="admin-role-select" aria-label={`Ubah peran ${user.display_name}`} value={user.role} onChange={(event) => updateUserRole(user, event.target.value as "reader" | "creator")} disabled={actionId === user.id}><option value="reader">Pembaca</option><option value="creator">Kreator</option></select>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>}
        {section === "comics" && <section className="admin-management-section" id="comic-management">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Katalog</p><h2>Manajemen komik</h2></div>
            <span>{comics.length} komik</span>
          </div>
          <div className="admin-comic-filters">
            <label className="admin-search"><Search size={17} /><input value={comicSearch} onChange={(event) => setComicSearch(event.target.value)} placeholder="Cari judul, kreator, atau genre" /></label>
            <select aria-label="Saring berdasarkan status" value={comicStatusFilter} onChange={(event) => setComicStatusFilter(event.target.value)}>
              <option value="all">Semua status</option>
              <option value="draft">Draf</option>
              <option value="pending_review">Menunggu kurasi</option>
              <option value="published">Terbit</option>
              <option value="archived">Diarsipkan</option>
            </select>
          </div>
          {filteredComics.length === 0 ? (
            <div className="admin-empty"><BookOpen size={26} /><h2>Komik tidak ditemukan.</h2><p>Coba kata kunci atau status lain.</p></div>
          ) : (
            <div className="request-table-wrap">
              <table className="request-table admin-comic-table">
                <thead><tr><th>Komik</th><th>Kreator</th><th>Genre</th><th>Status</th><th>Tindakan</th></tr></thead>
                <tbody>{filteredComics.map((comic) => (
                  <tr key={comic.id}>
                    <td><strong>{comic.title}</strong><code>{comic.slug}</code></td>
                    <td>{comic.creator}</td>
                    <td>{comic.genre}</td>
                    <td><span className={`request-status request-${comic.status === "published" ? "approved" : comic.status === "pending_review" ? "pending" : comic.status}`}>{comicStatusLabels[comic.status]}</span></td>
                    <td className="admin-comic-actions">
                      <Link className="admin-manage-link" href={`/account/komik/${comic.id}`}>Kelola</Link>
                      {comic.status === "draft" && <button className="admin-action-link" onClick={() => updateComicStatus(comic, "pending_review")} disabled={comicActionId === comic.id}>Ajukan kurasi</button>}
                      {comic.status === "published" && <button className="admin-action-link admin-action-danger" onClick={() => updateComicStatus(comic, "archived")} disabled={comicActionId === comic.id}><Archive size={14} /> Arsipkan</button>}
                      {comic.status === "archived" && <button className="admin-action-link" onClick={() => updateComicStatus(comic, "draft")} disabled={comicActionId === comic.id}>Pulihkan ke draf</button>}
                      {comic.status === "pending_review" && <a className="admin-action-link" href="#comic-review">Lihat antrean</a>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>}
          </section>
        </div>
      </div>
      {selectedRequest && (
        <div className="request-modal-backdrop" role="presentation" onClick={() => setSelectedRequest(null)}>
          <section className="request-modal" role="dialog" aria-modal="true" aria-labelledby="request-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="request-modal-header">
              <div><p className="eyebrow">Pengajuan kreator</p><h2 id="request-modal-title">{selectedRequest.applicant}</h2></div>
              <button className="modal-close" onClick={() => setSelectedRequest(null)} aria-label="Tutup pengajuan">×</button>
            </div>
            <div className="modal-meta"><span>{requestStatusLabels[selectedRequest.status]}</span><span>{new Date(selectedRequest.created_at).toLocaleDateString("id-ID")}</span></div>
            <p className="modal-note">{selectedRequest.note || "Tidak ada catatan."}</p>
            <div className="modal-links">{selectedRequest.portfolio_url && <a href={selectedRequest.portfolio_url} target="_blank" rel="noreferrer">Portofolio ↗</a>}{selectedRequest.instagram_url && <a href={selectedRequest.instagram_url} target="_blank" rel="noreferrer">Instagram ↗</a>}{selectedRequest.other_url && <a href={selectedRequest.other_url} target="_blank" rel="noreferrer">Tautan lain ↗</a>}</div>
            {selectedRequest.status === "pending" && <div className="request-actions modal-actions"><button className="approve-button" onClick={() => { reviewRequest(selectedRequest, "approved"); setSelectedRequest(null); }} disabled={actionId === selectedRequest.id}><Check size={16} /> Setujui</button><button className="reject-button" onClick={() => { reviewRequest(selectedRequest, "rejected"); setSelectedRequest(null); }} disabled={actionId === selectedRequest.id}><X size={16} /> Tolak</button></div>}
          </section>
        </div>
      )}
    </main>
  );
}
