"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, CheckCircle2, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ComicStatus = "draft" | "published" | "archived";
type Comic = { id: string; title: string; slug: string; genre: string; synopsis: string; status: ComicStatus; created_at: string };

const supabase = createClient();
const genres = ["Fantasy", "Sci-fi", "Drama", "Comedy", "Action", "Romance"];

export default function CreatorPage() {
  const router = useRouter();
  const [comics, setComics] = useState<Comic[]>([]);
  const [displayName, setDisplayName] = useState("Creator");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ title: "", genre: "Fantasy", synopsis: "", status: "draft" as ComicStatus });

  const loadCreator = async () => {
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
    setDisplayName(profile.display_name || "Creator");
    const query = supabase.from("comics").select("id, title, slug, genre, synopsis, status, created_at").order("created_at", { ascending: false });
    const { data } = profile.role === "admin" ? await query : await query.eq("creator_id", userData.user.id);
    setComics(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadCreator(); }, [router]);

  const createComic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const slug = form.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { data, error } = await supabase.from("comics").insert({ creator_id: userData.user.id, title: form.title.trim(), slug, genre: form.genre, synopsis: form.synopsis.trim(), status: form.status }).select("id, title, slug, genre, synopsis, status, created_at").single();
    if (error) {
      setMessage(error.code === "23505" ? "A comic with this title already exists." : error.message);
    } else {
      setComics((current) => [data, ...current]);
      setForm({ title: "", genre: "Fantasy", synopsis: "", status: "draft" });
      setShowForm(false);
      setMessage("Comic created successfully.");
    }
    setSaving(false);
  };

  if (loading) return <main className="creator-shell"><LoaderCircle className="spin" size={24} /></main>;

  return <main className="creator-shell"><nav className="creator-nav"><a className="wordmark" href="/"><span className="wordmark-dot" />mu<span>komik</span></a><div className="creator-nav-actions"><span className="creator-identity"><Sparkles size={15} /> {displayName}</span><a className="auth-back" href="/account"><ArrowLeft size={16} /> Account</a></div></nav><header className="creator-header"><div><p className="eyebrow"><span /> Creator space</p><h1>Make something<br /><em>worth reading.</em></h1><p>Shape your worlds, publish chapters, and build a shelf of stories your readers can return to.</p></div><button className="button button-dark" onClick={() => setShowForm(!showForm)}><Plus size={17} /> New comic</button></header>{message && <p className="creator-message">{message}</p>}{showForm && <form className="comic-form" onSubmit={createComic}><div className="form-heading"><div><p className="eyebrow">Start a new story</p><h2>Comic details</h2></div><button type="button" className="form-close" onClick={() => setShowForm(false)}>×</button></div><label>Title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="The title of your comic" /></label><label>Genre<select value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })}>{genres.map((genre) => <option key={genre}>{genre}</option>)}</select></label><label>Synopsis<textarea required value={form.synopsis} onChange={(event) => setForm({ ...form, synopsis: event.target.value })} placeholder="What is this story about?" rows={4} /></label><label>Initial status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ComicStatus })}><option value="draft">Save as draft</option><option value="published">Publish now</option></select></label><button className="button button-dark" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={16} /> Saving...</> : <>Create comic <ArrowUpRight size={16} /></>}</button></form>}<section className="creator-library"><div className="creator-section-heading"><div><p className="eyebrow">Your library</p><h2>{comics.length} {comics.length === 1 ? "story" : "stories"}</h2></div><span>Manage your work</span></div>{comics.length === 0 ? <div className="creator-empty"><BookOpen size={26} /><h3>Your first story starts here.</h3><p>Create a comic to begin adding chapters and pages.</p><button className="text-link" onClick={() => setShowForm(true)}>Create a comic <ArrowUpRight size={15} /></button></div> : <div className="creator-comic-grid">{comics.map((comic) => <article className="creator-comic-card" key={comic.id}><div className={`creator-comic-art status-${comic.status}`}><span>{comic.genre}</span><strong>{comic.title.slice(0, 2).toUpperCase()}</strong></div><div className="creator-comic-info"><div><h3>{comic.title}</h3><p>{comic.synopsis}</p></div><span className={`request-status request-${comic.status === "published" ? "approved" : comic.status}`}>{comic.status}</span></div><div className="creator-comic-actions"><a className="text-link" href={`/comic/${comic.slug}`}>View story <ArrowUpRight size={14} /></a><a className="text-link" href={`/creator/comic/${comic.id}`}>Manage chapters <ArrowUpRight size={14} /></a></div></article>)}</div>}</section></main>;
}
