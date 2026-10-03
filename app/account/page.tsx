"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bookmark, LogOut, Settings2, Sparkles, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { getComicGenreLabel } from "@/lib/comic-genres";

type Profile = { display_name: string; role: "reader" | "creator" | "admin" };
type CreatorRequest = { status: "pending" | "approved" | "rejected" };
type BookmarkedComic = { id: string; title: string; slug: string; genre: string; cover_key: string | null };

const supabase = createClient();
const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
const roleLabels: Record<Profile["role"], string> = {
  reader: "Pembaca",
  creator: "Kreator",
  admin: "Admin",
};
const requestStatusLabels: Record<CreatorRequest["status"], string> = {
  pending: "Menunggu peninjauan",
  approved: "Disetujui",
  rejected: "Ditolak",
};

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [creatorRequest, setCreatorRequest] = useState<CreatorRequest | null>(null);
  const [requestingCreator, setRequestingCreator] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [applicationNote, setApplicationNote] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [otherUrl, setOtherUrl] = useState("");
  const [bookmarks, setBookmarks] = useState<BookmarkedComic[]>([]);
  const [bookmarkError, setBookmarkError] = useState("");

  useEffect(() => {
    const loadAccount = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");
      const { data } = await supabase.from("profiles").select("display_name, role").eq("id", user.id).single();
      setProfile(data);
      const { data: request } = await supabase.from("creator_requests").select("status").eq("user_id", user.id).maybeSingle();
      setCreatorRequest(request);
      const { data: bookmarkRows, error: bookmarkLoadError } = await supabase
        .from("bookmarks")
        .select("created_at, comics(id, title, slug, genre, cover_key)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (bookmarkLoadError) {
        console.error("Unable to load account bookmarks:", bookmarkLoadError);
        setBookmarkError("Favorit belum dapat dimuat.");
      } else {
        setBookmarks((bookmarkRows ?? []).flatMap((row) => {
          const comic = Array.isArray(row.comics) ? row.comics[0] : row.comics;
          return comic ? [comic] : [];
        }));
      }
      setLoading(false);
    };
    loadAccount();
  }, [router]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/");
  };

  const handleCreatorRequest = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setRequestingCreator(true);
    setRequestMessage("");
    const requestPayload = { note: applicationNote.trim(), portfolio_url: portfolioUrl.trim() || null, instagram_url: instagramUrl.trim() || null, other_url: otherUrl.trim() || null, status: "pending" };
    const query = creatorRequest?.status === "rejected"
      ? supabase.from("creator_requests").update(requestPayload).eq("user_id", userData.user.id).select("status").single()
      : supabase.from("creator_requests").insert({ user_id: userData.user.id, ...requestPayload }).select("status").single();
    const { data, error } = await query;
    if (error) {
      setRequestMessage(error.code === "23505" ? "Pengajuan akses kreatormu sedang ditinjau." : "Pengajuan tidak dapat dikirim. Jalankan creator-request.sql terlebih dahulu.");
    } else {
      setCreatorRequest(data);
      setRequestMessage("Pengajuan terkirim. Admin akan meninjau permintaan akses kreatormu.");
    }
    setRequestingCreator(false);
  };

  if (loading) return <main className="account-shell"><p className="account-loading">Memuat halaman akun...</p></main>;

  return (
    <main className="account-shell">
      <nav className="account-nav"><Link className="wordmark" href="/"><span className="wordmark-dot" />mu<span>komik</span></Link><button className="account-logout" onClick={handleLogout} disabled={loggingOut}><LogOut size={16} /> {loggingOut ? "Keluar..." : "Keluar"}</button></nav>
      <section className="account-header"><Link className="auth-back" href="/"><ArrowLeft size={16} /> Kembali ke beranda</Link><div className="account-heading"><div className="account-avatar"><UserRound size={30} /></div><div><p className="eyebrow"><span /> Ruang bacamu</p><h1>Hai, {profile?.display_name || "Pembaca"}.</h1><p>{email}</p></div></div></section>
      <section className="account-grid">
        <article className="account-panel account-panel-wide"><div className="panel-heading"><div><p className="eyebrow">Lanjutkan dari sini</p><h2>Lanjutkan membaca</h2></div><BookOpen size={22} /></div><div className="account-empty"><div className="empty-icon"><BookOpen size={23} /></div><h3>Koleksimu menanti.</h3><p>Mulai baca komik dan bab terakhirmu akan muncul di sini.</p><Link className="button button-dark" href="/#discover">Jelajahi komik</Link></div></article>
        <article className="account-panel account-bookmark-panel">
          <div className="panel-heading"><div><p className="eyebrow">Simpan untuk nanti</p><h2>Favorit</h2></div><Bookmark size={22} /></div>
          {bookmarkError ? <p className="account-bookmark-message" role="alert">{bookmarkError} Jalankan supabase/comic-bookmarks.sql pada database.</p>
            : bookmarks.length ? <div className="account-bookmark-list">{bookmarks.map((comic) => {
              const coverUrl = comic.cover_key && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${comic.cover_key}` : null;
              return <Link className="account-bookmark-item" href={`/comic/${comic.slug}`} key={comic.id}>
                <span className="account-bookmark-cover">{coverUrl ? <img src={coverUrl} alt="" /> : <Bookmark size={19} />}</span>
                <span className="account-bookmark-copy"><strong>{comic.title}</strong><small>{getComicGenreLabel(comic.genre)}</small></span>
                <ArrowRight size={16} />
              </Link>;
            })}</div>
            : <div className="account-empty compact"><div className="empty-icon"><Bookmark size={23} /></div><p>Belum ada komik favorit.</p><Link className="text-link" href="/">Cari komik <span>↗</span></Link></div>}
        </article>
        <article className="account-panel">
          <div className="panel-heading"><div><p className="eyebrow">Ruang pribadimu</p><h2>Pengaturan</h2></div><Settings2 size={22} /></div>
          <div className="settings-row"><span>Jenis akun</span><strong>{profile?.role ? roleLabels[profile.role] : "Pembaca"}</strong></div>
          <div className="settings-row"><span>Alamat email</span><strong>{email}</strong></div>
          {profile?.role === "creator" && <Link className="account-creator-link" href="/creator"><Sparkles size={16} /> Buka ruang kreator <ArrowUpRight size={15} /></Link>}
          {profile?.role === "admin" && <Link className="account-creator-link" href="/admin"><Settings2 size={16} /> Buka panel admin <ArrowUpRight size={15} /></Link>}
          {profile?.role === "reader" && (
            <div className="creator-request">
              <div className="creator-request-title"><Sparkles size={16} /> Jadi kreator</div>
              <p>{creatorRequest?.status === "rejected" ? "Pengajuanmu ditolak. Perbarui dan kirim kembali pengajuan." : "Ceritakan kepada admin komik yang ingin kamu terbitkan dan alasan karyamu layak hadir di sini."}</p>
              {creatorRequest?.status === "pending" || creatorRequest?.status === "approved"
                ? <span className={`request-status request-${creatorRequest.status}`}>{requestStatusLabels[creatorRequest.status]}</span>
                : <>
                    <textarea className="creator-note" value={applicationNote} onChange={(event) => setApplicationNote(event.target.value)} placeholder="Ceritakan pengajuan kreatormu..." maxLength={1000} rows={4} />
                    <input className="creator-link-input" type="url" value={portfolioUrl} onChange={(event) => setPortfolioUrl(event.target.value)} placeholder="Portofolio komik (https://...)" />
                    <input className="creator-link-input" type="url" value={instagramUrl} onChange={(event) => setInstagramUrl(event.target.value)} placeholder="Instagram (https://instagram.com/...)" />
                    <input className="creator-link-input" type="url" value={otherUrl} onChange={(event) => setOtherUrl(event.target.value)} placeholder="Situs web atau media sosial lain (opsional)" />
                    <button className="text-link request-button" onClick={handleCreatorRequest} disabled={requestingCreator || !applicationNote.trim()}>{requestingCreator ? "Mengirim..." : creatorRequest?.status === "rejected" ? "Kirim ulang pengajuan" : "Ajukan akses kreator"} <span>↗</span></button>
                  </>}
              {requestMessage && <small>{requestMessage}</small>}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
