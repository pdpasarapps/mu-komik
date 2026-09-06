"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, ChevronDown, Compass, Menu, Search, Sparkles, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const previewComics = [
  { title: "The Last Alchemist", creator: "Nara K." , genre: "Fantasy", chapter: "Ep. 24", color: "cover-amber", mark: "TL" },
  { title: "Neon Afterglow", creator: "Raka Studio", genre: "Sci-fi", chapter: "Ep. 08", color: "cover-cyan", mark: "NA" },
  { title: "Malam di Utara", creator: "Ayu Pramesti", genre: "Drama", chapter: "Ep. 17", color: "cover-rose", mark: "MU" },
  { title: "Pocket Universe", creator: "Koma Works", genre: "Comedy", chapter: "Ep. 31", color: "cover-lime", mark: "PU" },
];

const genres = ["All stories", "Fantasy", "Sci-fi", "Drama", "Comedy"];
const supabase = createClient();
type Comic = typeof previewComics[number] & { id: string; slug: string; coverUrl?: string | null };

export default function Home() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All stories");
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const loadComics = async () => {
      const { data, error } = await supabase
        .from("comics")
        .select("id, title, slug, genre, cover_key, profiles!comics_creator_id_fkey(display_name)")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) {
        setCatalogState("error");
        return;
      }
      const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;
      const loadedComics = (data ?? []).map((comic, index) => {
        const profiles = comic.profiles as unknown as { display_name?: string } | { display_name?: string }[] | null;
        const creator = Array.isArray(profiles) ? profiles[0]?.display_name : profiles?.display_name;
        return { id: comic.id, slug: comic.slug, title: comic.title, creator: creator || "Independent creator", genre: comic.genre, chapter: "Read now", color: previewComics[index % previewComics.length].color, mark: comic.title.slice(0, 2).toUpperCase(), coverUrl: comic.cover_key && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${comic.cover_key}` : null };
      });
      setComics(loadedComics);
      setCatalogState(loadedComics.length ? "ready" : "empty");
    };
    loadComics();
  }, []);
  const visibleComics = useMemo(() => comics.filter((comic) => {
    const matchesGenre = genre === "All stories" || comic.genre === genre;
    const search = query.toLowerCase();
    return matchesGenre && `${comic.title} ${comic.creator}`.toLowerCase().includes(search);
  }), [genre, query]);

  return (
    <main className="site-shell">
      <nav className="topbar">
        <a className="wordmark" href="#top"><span className="wordmark-dot" />mu<span>komik</span></a>
        <div className={`nav-links ${menuOpen ? "nav-links-open" : ""}`}>
          <a className="nav-link active" href="#discover"><Compass size={16} /> Discover</a>
          <a className="nav-link" href="#library"><BookOpen size={16} /> My library</a>
                    <a className="nav-link" href="/account"><BookOpen size={16} /> My library</a>
          <a className="nav-link" href="#creator"><Sparkles size={16} /> Creator space</a>
        </div>
        <div className="nav-actions">
          <button className="icon-button" aria-label="Open search"><Search size={18} /></button>
          <a className="profile-button" href="/login"><UserRound size={16} /> Sign in</a>
          <button className="menu-button" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} /></button>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Independent stories, carefully read</p>
          <h1>Find your next<br /><em>favorite panel.</em></h1>
          <p className="hero-text">A quieter place for bold comics, fresh voices, and stories worth staying up for.</p>
          <div className="hero-actions"><a className="button button-dark" href="#discover">Start exploring <ArrowUpRight size={17} /></a><a className="text-link" href="#creator">Publish your story <ArrowUpRight size={15} /></a></div>
        </div>
        <div className="hero-art" aria-label="Featured comic artwork">
          <div className="hero-sun" /><div className="hero-line hero-line-one" /><div className="hero-line hero-line-two" />
          <div className="hero-note">new<br /><strong>voices</strong></div><div className="hero-title">MOTION<br /><span>STUDIES</span></div>
          <div className="hero-sticker">ISSUE<br /><strong>07</strong></div>
        </div>
      </section>

      <section className="discover-section" id="discover">
        <div className="section-heading"><div><p className="eyebrow">Curated for your shelf</p><h2>Stories in motion</h2></div><a className="text-link" href="#all">View all stories <ArrowUpRight size={15} /></a></div>
        <div className="toolbar"><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles or creators" /></label><div className="genre-picker"><ChevronDown size={16} /><select value={genre} onChange={(event) => setGenre(event.target.value)} aria-label="Filter by genre">{genres.map((item) => <option key={item}>{item}</option>)}</select></div></div>
        {catalogState === "loading" && <p className="empty-state">Loading stories...</p>}
        {catalogState === "error" && <p className="empty-state">Could not load stories. Check your Supabase connection.</p>}
        {catalogState === "empty" && <p className="empty-state">No published stories yet. Add a comic in Supabase to see it here.</p>}
        {catalogState === "ready" && <div className="comic-grid">{visibleComics.map((comic, index) => <article className="comic-card" key={comic.id}><a href={`/comic/${comic.slug}`} className={`comic-cover ${comic.color} ${comic.coverUrl ? "cover-with-image" : ""}`} style={comic.coverUrl ? { backgroundImage: `url(${comic.coverUrl})` } : undefined}><span className="cover-index">0{index + 1}</span><span className="cover-mark">{comic.mark}</span><span className="cover-genre">{comic.genre}</span></a><div className="comic-meta"><div><h3>{comic.title}</h3><p>{comic.creator} · {comic.chapter}</p></div><a className="round-arrow" href={`/comic/${comic.slug}`} aria-label={`Open ${comic.title}`}><ArrowUpRight size={17} /></a></div></article>)}</div>}
        {catalogState === "ready" && visibleComics.length === 0 && <p className="empty-state">No stories found. Try another title or genre.</p>}
      </section>

      <section className="creator-strip" id="creator"><div><p className="eyebrow">For the people who draw the worlds</p><h2>Your story deserves<br /><em>a real home.</em></h2></div><div className="creator-detail"><p>Upload chapters directly to your private R2 library, shape your release schedule, and meet readers without the noise.</p><a className="button button-light" href="#join">Enter creator space <ArrowUpRight size={17} /></a></div></section>
      <footer><a className="wordmark" href="#top"><span className="wordmark-dot" />mu<span>komik</span></a><p>Stories made with intent.</p><p>© 2026 mu-komik</p></footer>
    </main>
  );
}
