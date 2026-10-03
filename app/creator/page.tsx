"use client";

import { FormEvent, useEffect, useEffectEvent, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, Eye, LoaderCircle, Pencil, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { COMIC_GENRES, getComicGenreLabel } from "@/lib/comic-genres";

type ComicStatus = "draft" | "pending_review" | "published" | "archived";
type Comic = { id: string; title: string; slug: string; genre: string; synopsis: string; contributor: string; cover_key: string | null; coverUrl: string | null; status: ComicStatus; created_at: string };

const supabase = createClient();
const comicStatusLabel: Record<ComicStatus, string> = {
  draft: "Draf",
  pending_review: "Menunggu kurasi",
  published: "Terbit",
  archived: "Diarsipkan",
};

export default function CreatorPage() {
  const router = useRouter();
  const [comics, setComics] = useState<Comic[]>([]);
  const [displayName, setDisplayName] = useState("Kreator");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingComicId, setSubmittingComicId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ title: "", genre: "Fantasy", synopsis: "", contributor: "" });

  const loadCreator = useEffectEvent(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("display_name, role").eq("id", userData.user.id).single();
    if (profile?.role !== "creator" && profile?.role !== "admin") {
      router.replace("/account");
      return;
    }
    setDisplayName(profile.display_name || "Kreator");
    const query = supabase.from("comics").select("id, title, slug, genre, synopsis, contributor, cover_key, status, created_at").order("created_at", { ascending: false });
    const { data } = profile.role === "admin" ? await query : await query.eq("creator_id", userData.user.id);
    const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;
    setComics((data ?? []).map((comic) => ({
      ...comic,
      coverUrl: comic.cover_key && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${comic.cover_key}` : null,
    })));
    setLoading(false);
  });

  useEffect(() => {
    const timer = window.setTimeout(() => loadCreator(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const createComic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const slug = form.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { data, error } = await supabase.from("comics").insert({ creator_id: userData.user.id, title: form.title.trim(), slug, genre: form.genre, synopsis: form.synopsis.trim(), contributor: form.contributor.trim(), status: "draft" }).select("id, title, slug, genre, synopsis, contributor, cover_key, status, created_at").single();
    if (error) {
      setMessage(error.code === "23505" ? "Komik dengan judul ini sudah ada." : error.message);
    } else {
      setComics((current) => [{ ...data, coverUrl: null }, ...current]);
      setForm({ title: "", genre: "Fantasy", synopsis: "", contributor: "" });
      setShowForm(false);
      setMessage("Komik berhasil dibuat.");
    }
    setSaving(false);
  };

  const submitForReview = async (comic: Comic) => {
    setSubmittingComicId(comic.id);
    setMessage("");
    const { data, error } = await supabase
      .from("comics")
      .update({ status: "pending_review" })
      .eq("id", comic.id)
      .eq("status", "draft")
      .select("id, status")
      .single();
    if (error) {
      setMessage(error.message);
    } else {
      setComics((current) => current.map((item) => item.id === data.id ? { ...item, status: "pending_review" } : item));
      setMessage("Komik diajukan dan menunggu kurasi admin.");
    }
    setSubmittingComicId(null);
  };

  if (loading) return <main className="creator-shell"><LoaderCircle className="spin" size={24} /></main>;

  return (
    <main className="creator-shell">
      <nav className="creator-nav">
        <Link className="wordmark" href="/"><span className="wordmark-dot" />mu<span>komik</span></Link>
        <div className="creator-nav-actions">
          <span className="creator-identity"><Sparkles size={15} /> {displayName}</span>
          <Link className="auth-back" href="/account"><ArrowLeft size={16} /> Akun</Link>
        </div>
      </nav>
      <header className="creator-header">
        <div>
          <p className="eyebrow"><span /> Ruang Kreator</p>
          <h1>Ciptakan kisah<br /><em>yang layak dibaca.</em></h1>
          <p>Bangun duniamu, terbitkan bab, dan kumpulkan cerita yang ingin dibaca kembali oleh para pembaca.</p>
        </div>
        <button className="button button-dark" onClick={() => setShowForm(!showForm)}><Plus size={17} /> Komik baru</button>
      </header>
      {message && <p className="creator-message">{message}</p>}
      {showForm && (
        <form className="comic-form" onSubmit={createComic}>
          <div className="form-heading">
            <div><p className="eyebrow">Mulai cerita baru</p><h2>Detail komik</h2></div>
            <button type="button" className="form-close" onClick={() => setShowForm(false)}>×</button>
          </div>
          <label>Judul<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Judul komik" /></label>
          <label>Penulis atau kontributor<input maxLength={120} value={form.contributor} onChange={(event) => setForm({ ...form, contributor: event.target.value })} placeholder="Nama penulis atau kontributor" /></label>
          <label>Genre<select value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })}>{COMIC_GENRES.map((genre) => <option key={genre} value={genre}>{getComicGenreLabel(genre)}</option>)}</select></label>
          <label>Sinopsis<textarea required value={form.synopsis} onChange={(event) => setForm({ ...form, synopsis: event.target.value })} placeholder="Ceritakan tentang komik ini" rows={4} /></label>
          <button className="button button-dark" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={16} /> Menyimpan...</> : <>Buat komik <ArrowUpRight size={16} /></>}</button>
        </form>
      )}
      <section className="creator-library">
        <div className="creator-section-heading">
          <div><p className="eyebrow">Koleksi komikmu</p><h2>{comics.length} komik</h2></div>
          <span>Kelola karyamu</span>
        </div>
        {comics.length === 0 ? (
          <div className="creator-empty"><BookOpen size={26} /><h3>Mulai buat cerita pertamamu.</h3><p>Buat komik untuk mulai menambahkan bab dan halaman.</p><button className="text-link" onClick={() => setShowForm(true)}>Buat komik <ArrowUpRight size={15} /></button></div>
        ) : (
          <div className="creator-comic-grid">
            {comics.map((comic) => (
              <article className="creator-comic-card" key={comic.id}>
                <div
                  className={`creator-comic-art status-${comic.status} ${comic.coverUrl ? "has-cover" : ""}`}
                >
                  {comic.coverUrl
                    ? <img className="creator-comic-cover" src={comic.coverUrl} alt={`Sampul ${comic.title}`} />
                    : <div role="img" aria-label={`Sampul ${comic.title}`}><span>{getComicGenreLabel(comic.genre)}</span><strong>{comic.title.slice(0, 2).toUpperCase()}</strong></div>}
                </div>
                <span className={`creator-comic-status status-${comic.status}`}>
                  {comicStatusLabel[comic.status]}
                </span>
                <div className="creator-comic-info">
                  <div><h3>{comic.title}</h3></div>
                </div>
                <div className="creator-comic-actions">
                  <Link className="creator-comic-action" href={`/comic/${comic.slug}`} aria-label={`Lihat komik: ${comic.title}`} title="Lihat komik"><Eye size={16} /></Link>
                  <Link className="creator-comic-action" href={`/creator/comic/${comic.id}?edit=comic`} aria-label={`Edit detail: ${comic.title}`} title="Edit detail"><Pencil size={16} /></Link>
                  <Link className="creator-comic-action" href={`/creator/comic/${comic.id}`} aria-label={`Kelola bab: ${comic.title}`} title="Kelola bab"><BookOpen size={16} /></Link>
                  {comic.status === "draft" && <button type="button" className="button button-dark comic-submit-button" onClick={() => submitForReview(comic)} disabled={submittingComicId === comic.id}>{submittingComicId === comic.id && <LoaderCircle className="spin" size={14} />} Ajukan kurasi</button>}
                  {comic.status === "pending_review" && <span className="comic-review-waiting">Menunggu kurasi</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
