"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, ChevronDown, Menu, Search, Sparkles, UserRound, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const genreLabels: Record<string, string> = {
  Fantasy: "Fantasi",
  "Sci-fi": "Fiksi ilmiah",
  Drama: "Drama",
  Comedy: "Komedi",
  Action: "Aksi",
  Romance: "Romantis",
  "Slice of Life": "Slice of Life",
  Horror: "Horor",
  Kids: "Anak",
  Inspirational: "Inspirasi",
};

type Comic = {
  id: string;
  title: string;
  slug: string;
  synopsis: string;
  contributor: string;
  genre: string;
  coverUrl: string | null;
  creator: string;
  latestChapter: { id: string; title: string; chapter_number: number; published_at: string | null } | null;
  chapterCount: number;
};

type ContinueReading = {
  comic: Comic;
  chapterId: string;
  chapterTitle: string;
  chapterNumber: number;
  lastPage: number;
  pageCount: number;
};

function comicGenre(genre: string) {
  return genreLabels[genre] || genre;
}

function cleanSynopsis(synopsis: string) {
  return synopsis.replace(/\*\*/g, "").replace(/👉/g, "").replace(/\n+/g, " ").trim();
}

function ComicCard({ comic, compact = false }: { comic: Comic; compact?: boolean }) {
  const chapter = comic.latestChapter;
  return (
    <article className={`reader-comic-card${compact ? " reader-comic-card-compact" : ""}`}>
      <Link href={`/comic/${comic.slug}`} className="reader-card-link" aria-label={`Buka ${comic.title}`}>
        <div className="reader-comic-cover">
          {comic.coverUrl
            ? <img src={comic.coverUrl} alt={`Sampul ${comic.title}`} loading="lazy" />
            : <span aria-hidden="true">{comic.title.slice(0, 2).toUpperCase()}</span>}
          {chapter && <span className="reader-cover-episode">Ep. {chapter.chapter_number}</span>}
        </div>
        <div className="reader-comic-info">
          <span className="reader-card-genre">{comicGenre(comic.genre)}</span>
          <h3>{comic.title}</h3>
          <p>{comic.contributor || comic.creator}</p>
          {chapter && <span className="reader-card-latest">Terbaru · Episode {chapter.chapter_number}</span>}
        </div>
      </Link>
    </article>
  );
}

function ComicSkeleton() {
  return <div className="reader-comic-skeleton" aria-hidden="true"><span /><i /><i /><i /></div>;
}

export default function Home() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [episodeLoadError, setEpisodeLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [continueReading, setContinueReading] = useState<ContinueReading | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [authRetry, setAuthRetry] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  useEffect(() => {
    let active = true;
    const loadHome = async () => {
      setCatalogState("loading");
      const { data, error } = await supabase
        .from("comics")
        .select("id, title, slug, synopsis, genre, contributor, cover_key, profiles!comics_creator_id_fkey(display_name)")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Unable to load published comics:", error);
        if (active) setCatalogState("error");
        return;
      }

      const rows = data ?? [];
      const comicIds = rows.map((comic) => comic.id);
      const { data: chapterRows, error: chapterError } = comicIds.length
        ? await supabase
          .from("chapters")
          .select("id, comic_id, title, chapter_number, published_at")
          .in("comic_id", comicIds)
          .not("published_at", "is", null)
          .order("published_at", { ascending: false })
        : { data: [], error: null };
      if (chapterError) console.error("Unable to load published comic episodes:", chapterError);
      if (active) setEpisodeLoadError(Boolean(chapterError));

      const chaptersByComic = new Map<string, NonNullable<Comic["latestChapter"]>[]>();
      for (const chapter of chapterRows ?? []) {
        const comicChapters = chaptersByComic.get(chapter.comic_id) ?? [];
        comicChapters.push({
          id: chapter.id,
          title: chapter.title,
          chapter_number: chapter.chapter_number,
          published_at: chapter.published_at,
        });
        chaptersByComic.set(chapter.comic_id, comicChapters);
      }

      const loadedComics: Comic[] = rows.map((comic) => {
        const profiles = comic.profiles as { display_name?: string } | { display_name?: string }[] | null;
        const profileName = Array.isArray(profiles) ? profiles[0]?.display_name : profiles?.display_name;
        const chapters = chaptersByComic.get(comic.id) ?? [];
        return {
          id: comic.id,
          title: comic.title,
          slug: comic.slug,
          synopsis: comic.synopsis || "",
          contributor: comic.contributor?.trim() || "",
          genre: comic.genre,
          creator: profileName || "Kreator independen",
          coverUrl: comic.cover_key && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${comic.cover_key}` : null,
          latestChapter: chapters[0] ?? null,
          chapterCount: chapters.length,
        };
      });

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("Unable to check the current auth session:", sessionError);
        if (active) setAuthMessage("Status masuk belum dapat diperiksa. Periksa koneksi lalu coba lagi.");
      }
      const session = sessionData.session;
      if (active) setSignedIn(Boolean(session?.user));

      if (session?.user) {
        const { data: history, error: historyError } = await supabase
          .from("reading_history")
          .select("last_page, chapter_id, chapters(id, title, chapter_number, comic_id, comics(id, title, slug, synopsis, contributor, genre, cover_key, profiles!comics_creator_id_fkey(display_name)))")
          .eq("user_id", session.user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (historyError) {
          console.error("Unable to load reading history:", historyError);
        } else if (history) {
          const chapter = Array.isArray(history.chapters) ? history.chapters[0] : history.chapters;
          const historyComic = chapter && (Array.isArray(chapter.comics) ? chapter.comics[0] : chapter.comics);
          if (chapter && historyComic) {
            const { count: pageCount, error: countError } = await supabase
              .from("pages")
              .select("id", { count: "exact", head: true })
              .eq("chapter_id", history.chapter_id);
            if (countError) console.error("Unable to load reading progress total:", countError);
            const profile = Array.isArray(historyComic.profiles) ? historyComic.profiles[0] : historyComic.profiles;
            const historyRecord: ContinueReading = {
              comic: {
                id: historyComic.id,
                title: historyComic.title,
                slug: historyComic.slug,
                synopsis: historyComic.synopsis || "",
                contributor: historyComic.contributor?.trim() || "",
                genre: historyComic.genre,
                creator: profile?.display_name || "Kreator independen",
                coverUrl: historyComic.cover_key && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${historyComic.cover_key}` : null,
                latestChapter: null,
                chapterCount: 0,
              },
              chapterId: history.chapter_id,
              chapterTitle: chapter.title,
              chapterNumber: chapter.chapter_number,
              lastPage: history.last_page,
              pageCount: pageCount || 0,
            };
            if (active) setContinueReading(historyRecord);
          }
        }
      } else if (active) {
        setContinueReading(null);
      }

      if (active) {
        setComics(loadedComics);
        setCatalogState(loadedComics.length ? "ready" : "empty");
      }
    };

    void loadHome();
    return () => { active = false; };
  }, [authRetry, publicUrl]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
      if (!session?.user) setContinueReading(null);
      setAuthMessage("");
    });
    return () => subscription.unsubscribe();
  }, []);

  const genres = useMemo(() => ["all", ...new Set(comics.map((comic) => comic.genre).filter(Boolean))], [comics]);
  const searchedComics = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
    return comics.filter((comic) => {
      const matchesGenre = genre === "all" || comic.genre === genre;
      const searchable = `${comic.title} ${comic.creator} ${comic.contributor} ${comic.genre}`.toLocaleLowerCase("id-ID");
      return matchesGenre && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [comics, genre, query]);
  const featuredComic = comics.find((comic) => comic.latestChapter) || comics[0];
  const latestComics = [...comics].filter((comic) => comic.latestChapter).sort((a, b) =>
    new Date(b.latestChapter?.published_at || 0).getTime() - new Date(a.latestChapter?.published_at || 0).getTime(),
  );
  const ongoingComics = [...comics].sort((a, b) => b.chapterCount - a.chapterCount).filter((comic) => comic.chapterCount > 1);

  const focusSearch = () => {
    setMobileSearchOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  return (
    <main className="reader-home">
      <header className="reader-header">
        <button className="reader-menu-toggle" aria-label={menuOpen ? "Tutup navigasi" : "Buka navigasi"} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <Link className="wordmark reader-wordmark" href="/"><span className="wordmark-dot" />mu<span>komik</span></Link>
        <nav className={`reader-nav-links${menuOpen ? " reader-nav-links-open" : ""}`} aria-label="Navigasi utama">
          <a href="#jelajah" onClick={() => setMenuOpen(false)}>Jelajah</a>
          <a href="#genre" onClick={() => setMenuOpen(false)}>Genre</a>
          {signedIn && <a href="#creator" onClick={() => setMenuOpen(false)}>Kreator</a>}
          {signedIn && <Link href="/account" onClick={() => setMenuOpen(false)}>Koleksi saya</Link>}
          {!signedIn && <Link href="/login" onClick={() => setMenuOpen(false)}>Masuk</Link>}
        </nav>
        <form className={`reader-header-search${mobileSearchOpen ? " reader-header-search-open" : ""}`} onSubmit={(event) => { event.preventDefault(); document.querySelector("#jelajah")?.scrollIntoView({ behavior: "smooth" }); }}>
          <Search size={17} aria-hidden="true" />
          <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari komik, kreator, genre..." aria-label="Cari komik, kreator, atau genre" />
          {mobileSearchOpen && <button type="button" className="reader-search-close" onClick={() => setMobileSearchOpen(false)} aria-label="Tutup pencarian"><X size={17} /></button>}
        </form>
        <div className="reader-header-actions">
          <button className="reader-search-mobile" aria-label="Cari komik" onClick={focusSearch}><Search size={20} /></button>
          {signedIn
            ? <Link className="reader-login-button" href="/account"><UserRound size={17} /><span>Profil</span></Link>
            : <Link className="reader-login-button" href="/login"><UserRound size={17} /><span>Masuk</span></Link>}
        </div>
      </header>

      {authMessage && <div className="reader-inline-message" role="alert">{authMessage}<button onClick={() => setAuthRetry((attempt) => attempt + 1)}>Coba lagi</button></div>}

      {featuredComic ? (
        <section className="reader-featured">
          <div className="reader-featured-copy">
            <span className="reader-kicker"><Sparkles size={15} /> CERITA TERBARU</span>
            <p className="reader-featured-genre">{comicGenre(featuredComic.genre)} <span>·</span> {featuredComic.contributor || featuredComic.creator}</p>
            <h1>{featuredComic.title}</h1>
            <p className="reader-featured-synopsis">{cleanSynopsis(featuredComic.synopsis) || "Temukan cerita baru dan mulai membaca hari ini."}</p>
            {featuredComic.latestChapter && <span className="reader-featured-episode">Episode {featuredComic.latestChapter.chapter_number} · {featuredComic.latestChapter.title}</span>}
            <Link className="reader-primary-button" href={featuredComic.latestChapter ? `/comic/${featuredComic.slug}/chapter/${featuredComic.latestChapter.id}` : `/comic/${featuredComic.slug}`}>
              <BookOpen size={18} /> Baca sekarang <ArrowRight size={17} />
            </Link>
          </div>
          <Link href={`/comic/${featuredComic.slug}`} className="reader-featured-cover" aria-label={`Lihat ${featuredComic.title}`}>
            {featuredComic.coverUrl
              ? <img src={featuredComic.coverUrl} alt={`Sampul ${featuredComic.title}`} fetchPriority="high" />
              : <span>{featuredComic.title.slice(0, 2).toUpperCase()}</span>}
          </Link>
        </section>
      ) : (
        <section className="reader-welcome">
          <p className="reader-kicker"><Sparkles size={15} /> CERITA INDONESIA, DI SINI</p>
          <h1>Temukan kisah yang membuatmu betah membaca.</h1>
          <p>Jelajahi komik independen dan temukan cerita favorit berikutnya.</p>
          <Link className="reader-primary-button" href="#jelajah">Jelajahi komik <ArrowRight size={17} /></Link>
        </section>
      )}

      <div className="reader-home-content">
        {signedIn && continueReading && (
          <section className="reader-home-section reader-continue-section">
            <div className="reader-section-heading"><div><p className="reader-section-kicker">KEMBALI KE CERITAMU</p><h2>Lanjutkan membaca</h2></div></div>
            <Link className="reader-continue-card" href={`/comic/${continueReading.comic.slug}/chapter/${continueReading.chapterId}`}>
              <div className="reader-continue-cover">{continueReading.comic.coverUrl && <img src={continueReading.comic.coverUrl} alt="" loading="lazy" />}</div>
              <div className="reader-continue-info"><span>{comicGenre(continueReading.comic.genre)}</span><h3>{continueReading.comic.title}</h3><p>Episode {continueReading.chapterNumber} · {continueReading.chapterTitle}</p><span className="reader-continue-progress">Terakhir dibaca di halaman {continueReading.lastPage}{continueReading.pageCount ? ` dari ${continueReading.pageCount}` : ""}</span>{continueReading.pageCount > 0 && <span className="reader-continue-progressbar" role="progressbar" aria-label="Progres membaca" aria-valuemin={0} aria-valuemax={continueReading.pageCount} aria-valuenow={Math.min(continueReading.pageCount, continueReading.lastPage)}><i style={{ width: `${Math.min(100, (continueReading.lastPage / continueReading.pageCount) * 100)}%` }} /></span>}</div>
              <span className="reader-continue-action">Lanjutkan <ArrowRight size={17} /></span>
            </Link>
          </section>
        )}

        {ongoingComics.length > 0 && (
          <section className="reader-home-section">
            <div className="reader-section-heading"><div><p className="reader-section-kicker">SERIAL YANG TERUS BERLANJUT</p><h2>Temukan serial favoritmu</h2></div><a href="#jelajah">Semua komik <ArrowUpRight size={16} /></a></div>
            <div className="reader-comic-rail">{ongoingComics.slice(0, 6).map((comic) => <ComicCard key={comic.id} comic={comic} />)}</div>
          </section>
        )}

        <section className="reader-home-section" id="terbaru">
          <div className="reader-section-heading"><div><p className="reader-section-kicker">UPDATE TERKINI</p><h2>Episode terbaru</h2></div><a href="#jelajah">Jelajahi semua <ArrowUpRight size={16} /></a></div>
          {catalogState === "loading" && <div className="reader-comic-grid">{Array.from({ length: 4 }, (_, index) => <ComicSkeleton key={index} />)}</div>}
          {catalogState === "error" && <div className="reader-empty-state"><p>Komik belum dapat dimuat. Periksa koneksi lalu coba lagi.</p><button onClick={() => setAuthRetry((attempt) => attempt + 1)}>Coba lagi</button></div>}
          {catalogState === "empty" && <div className="reader-empty-state"><p>Belum ada cerita terbit. Kunjungi lagi nanti untuk menemukan komik baru.</p></div>}
          {catalogState === "ready" && episodeLoadError && <div className="reader-empty-state"><p>Episode terbaru belum dapat dimuat. Komik tetap bisa dijelajahi di bawah.</p><button onClick={() => setAuthRetry((attempt) => attempt + 1)}>Coba lagi</button></div>}
          {catalogState === "ready" && !episodeLoadError && latestComics.length > 0 && <div className="reader-comic-grid">{latestComics.slice(0, 8).map((comic) => <ComicCard key={comic.id} comic={comic} compact />)}</div>}
          {catalogState === "ready" && !episodeLoadError && latestComics.length === 0 && <div className="reader-empty-state"><p>Belum ada episode terbit. Jelajahi komik dan nantikan update berikutnya.</p><a href="#jelajah">Lihat semua komik <ArrowRight size={16} /></a></div>}
        </section>

        {latestComics.length > 1 && (
          <section className="reader-editorial-callout">
            <div><p className="reader-section-kicker">CERITA MENUNGGU UNTUK DITEMUKAN</p><h2>Setiap komik punya dunia yang berbeda.</h2><p>Mulai dari fantasi hingga drama, pilih cerita yang paling dekat denganmu.</p></div>
            <a className="reader-primary-button" href="#genre">Pilih genre <ArrowRight size={17} /></a>
          </section>
        )}

        <section className="reader-home-section" id="jelajah">
          <div className="reader-section-heading"><div><p className="reader-section-kicker">JELAJAHI DUNIA CERITA</p><h2>Semua komik</h2></div><span className="reader-result-count">{searchedComics.length} cerita</span></div>
          <div className="reader-discovery-tools" id="genre">
            <div className="reader-genre-chips" aria-label="Saring berdasarkan genre">
              {genres.map((item) => (
                <button key={item} className={genre === item ? "reader-genre-chip reader-genre-chip-active" : "reader-genre-chip"} onClick={() => setGenre(item)}>
                  {item === "all" ? "Semua" : comicGenre(item)}
                </button>
              ))}
            </div>
            <div className="reader-mobile-search-inline"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari komik, kreator, atau genre..." aria-label="Cari komik, kreator, atau genre" /></div>
          </div>
          {catalogState === "ready" && searchedComics.length > 0 && <div className="reader-comic-grid">{searchedComics.map((comic) => <ComicCard key={comic.id} comic={comic} />)}</div>}
          {catalogState === "ready" && searchedComics.length === 0 && <div className="reader-empty-state"><p>{query || genre !== "all" ? "Belum ada cerita di kategori ini." : "Belum ada komik terbit."}</p><button onClick={() => { setGenre("all"); setQuery(""); }}>Jelajahi semua komik</button></div>}
        </section>
      </div>

      <section className="reader-creator-cta" id="creator">
        <div><p className="reader-section-kicker">PUNYA CERITA?</p><h2>Terbitkan komikmu dan temukan pembaca baru.</h2></div>
        <Link className="reader-primary-button" href={signedIn ? "/account" : "/login"}>Jadi kreator <ArrowRight size={17} /></Link>
      </section>
      <footer className="reader-footer">
        <Link className="wordmark reader-wordmark" href="/"><span className="wordmark-dot" />mu<span>komik</span></Link>
        <p>Tempat cerita Indonesia menemukan pembacanya.</p>
        <a href="#jelajah">Jelajahi <ChevronDown size={15} /></a>
        <span>© 2026 mu-komik</span>
      </footer>
    </main>
  );
}
