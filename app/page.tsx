"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, BookOpen, ChevronDown, LogOut, Menu, Search, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const previewComics = [
  { title: "The Last Alchemist", creator: "Nara K." , genre: "Fantasy", chapter: "Ep. 24", color: "cover-amber", mark: "TL" },
  { title: "Neon Afterglow", creator: "Raka Studio", genre: "Sci-fi", chapter: "Ep. 08", color: "cover-cyan", mark: "NA" },
  { title: "Malam di Utara", creator: "Ayu Pramesti", genre: "Drama", chapter: "Ep. 17", color: "cover-rose", mark: "MU" },
  { title: "Pocket Universe", creator: "Koma Works", genre: "Comedy", chapter: "Ep. 31", color: "cover-lime", mark: "PU" },
];

const genres = [
  { value: "All stories", label: "Semua cerita" },
  { value: "Fantasy", label: "Fantasi" },
  { value: "Sci-fi", label: "Fiksi ilmiah" },
  { value: "Drama", label: "Drama" },
  { value: "Comedy", label: "Komedi" },
];
const genreLabels = Object.fromEntries(genres.map(({ value, label }) => [value, label]));
const supabase = createClient();
type Comic = typeof previewComics[number] & { id: string; slug: string; coverUrl?: string | null };

export default function Home() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All stories");
  const [menuOpen, setMenuOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuthMessage(error.message);
        return;
      }
      setSignedIn(Boolean(data.user));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  const signOut = async () => {
    setSigningOut(true);
    setAuthMessage("");
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthMessage(error.message);
      setSigningOut(false);
      return;
    }
    setSignedIn(false);
    setSigningOut(false);
  };
  useEffect(() => {
    const loadComics = async () => {
      const { data, error } = await supabase
        .from("comics")
        .select("id, title, slug, genre, contributor, cover_key, profiles!comics_creator_id_fkey(display_name)")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) {
        setCatalogState("error");
        return;
      }
      const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;
      const loadedComics = (data ?? []).map((comic, index) => {
        const profiles = comic.profiles as unknown as { display_name?: string } | { display_name?: string }[] | null;
        const creator = comic.contributor?.trim() || (Array.isArray(profiles) ? profiles[0]?.display_name : profiles?.display_name);
        return { id: comic.id, slug: comic.slug, title: comic.title, creator: creator || "Kreator independen", genre: comic.genre, chapter: "Baca sekarang", color: previewComics[index % previewComics.length].color, mark: comic.title.slice(0, 2).toUpperCase(), coverUrl: comic.cover_key && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${comic.cover_key}` : null };
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
  }), [comics, genre, query]);
  const featuredComic = comics.find((comic): comic is Comic & { coverUrl: string } => Boolean(comic.coverUrl));

  return (
    <main className="site-shell">
      <nav className="topbar">
        <a className="wordmark" href="#top"><span className="wordmark-dot" />mu<span>komik</span></a>
        <div className={`nav-links ${menuOpen ? "nav-links-open" : ""}`}>
          {signedIn && <Link className="nav-link" href="/account"><BookOpen size={16} /> Koleksi saya</Link>}
          {signedIn && <a className="nav-link" href="#creator"><Sparkles size={16} /> Ruang kreator</a>}
          {signedIn && <Link className="nav-link mobile-account-link" href="/account"><UserRound size={16} /> Profil</Link>}
          {signedIn && <button className="nav-link mobile-logout-link" onClick={signOut} disabled={signingOut}><LogOut size={16} /> {signingOut ? "Keluar..." : "Keluar"}</button>}
        </div>
        <div className="nav-actions">
          <button className="icon-button" aria-label="Fokus ke pencarian komik" onClick={() => searchInputRef.current?.focus()}><Search size={18} /></button>
          {signedIn
            ? <><Link className="profile-button" href="/account"><UserRound size={16} /> Profil</Link><button className="profile-button logout-button" onClick={signOut} disabled={signingOut}><LogOut size={16} /> {signingOut ? "Keluar..." : "Keluar"}</button></>
            : <Link className="profile-button" href="/login"><UserRound size={16} /> Masuk</Link>}
          <button className="menu-button" aria-label="Buka atau tutup navigasi" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} /></button>
        </div>
      </nav>
      {authMessage && <p className="empty-state" role="alert">{authMessage}</p>}

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Kisah independen, dikurasi sepenuh hati</p>
          <h1>Temukan kisah<br /><em>favorit berikutnya.</em></h1>
          <p className="hero-text">Ruang nyaman untuk komik berani, suara baru, dan cerita yang membuatmu betah membaca.</p>
          <div className="hero-actions"><a className="button button-dark" href="#discover">Mulai menjelajah <ArrowUpRight size={17} /></a><a className="text-link" href="#creator">Terbitkan ceritamu <ArrowUpRight size={15} /></a></div>
        </div>
        <div className={`hero-art ${featuredComic ? "hero-art-cover" : ""}`}>
          {featuredComic
            ? <Link className="hero-cover-link" href={`/comic/${featuredComic.slug}`} aria-label={`Buka komik terbaru: ${featuredComic.title}`}><img className="hero-cover-image" src={featuredComic.coverUrl} alt={`Sampul ${featuredComic.title}`} /></Link>
            : <>
              <div className="hero-sun" /><div className="hero-line hero-line-one" /><div className="hero-line hero-line-two" />
              <div className="hero-note">suara<br /><strong>baru</strong></div><div className="hero-title">STUDI<br /><span>GERAK</span></div>
              <div className="hero-sticker">EDISI<br /><strong>07</strong></div>
            </>}
        </div>
      </section>

      <section className="discover-section" id="discover">
        <div className="section-heading"><div><p className="eyebrow">Pilihan untuk koleksimu</p><h2>Kisah penuh warna</h2></div><a className="text-link" href="#discover">Lihat semua komik <ArrowUpRight size={15} /></a></div>
        <div className="toolbar"><label className="search-field"><Search size={17} /><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul atau kreator" /></label><div className="genre-picker"><ChevronDown size={16} /><select value={genre} onChange={(event) => setGenre(event.target.value)} aria-label="Saring berdasarkan genre">{genres.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div>
        {catalogState === "loading" && <p className="empty-state">Memuat komik...</p>}
        {catalogState === "error" && <p className="empty-state">Komik tidak dapat dimuat. Periksa koneksi Supabase.</p>}
        {catalogState === "empty" && <p className="empty-state">Belum ada komik yang terbit.</p>}
        {catalogState === "ready" && <div className="comic-grid">{visibleComics.map((comic, index) => <article className="comic-card" key={comic.id}><a href={`/comic/${comic.slug}`} aria-label={`Buka komik ${comic.title}`} className={`comic-cover ${comic.color} ${comic.coverUrl ? "cover-with-image" : ""}`}>{comic.coverUrl ? <img className="comic-cover-image" src={comic.coverUrl} alt="" aria-hidden="true" /> : <><span className="cover-index">0{index + 1}</span><span className="cover-mark">{comic.mark}</span><span className="cover-genre">{genreLabels[comic.genre] || comic.genre}</span></>}</a><div className="comic-meta"><div className="comic-meta-copy"><h3>{comic.title}</h3><p>{genreLabels[comic.genre] || comic.genre} · {comic.creator}</p><Link className="comic-read-action" href={`/comic/${comic.slug}`}>{comic.chapter}</Link></div></div></article>)}</div>}
        {catalogState === "ready" && visibleComics.length === 0 && <p className="empty-state">Komik tidak ditemukan. Coba judul atau genre lain.</p>}
      </section>

      {signedIn && <section className="creator-strip" id="creator"><div><h2>Dunia yang kamu bayangkan,<br /><em>dimulai dari sebuah cerita.</em></h2><p className="creator-tagline">Tulis. Gambar. Terbitkan.</p></div><div className="creator-detail"><p>Bangun serial komikmu, kelola setiap episode, dan hadirkan ceritamu kepada pembaca di mana pun mereka berada.</p><Link className="button button-light" href="/account">Terbitkan Komikmu <ArrowUpRight size={17} /></Link></div></section>}
      <footer><a className="wordmark" href="#top"><span className="wordmark-dot" />mu<span>komik</span></a><p>Cerita yang dibuat sepenuh hati.</p><p>© 2026 mu-komik</p></footer>
    </main>
  );
}
