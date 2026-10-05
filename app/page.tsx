"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, Eye, Heart, Menu, Search, Share2, Sparkles, UserRound, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { COMIC_GENRES, getComicGenreLabel } from "@/lib/comic-genres";
import BrandLogo from "@/components/brand-logo";
import PlatformLinks from "@/components/platform-links";
import SponsoredAd from "@/components/sponsored-ad";
import { usePlatformSettings } from "./platform-runtime";
import { useCurrentDevice } from "@/components/use-current-device";
import { isComicAvailableOnDevice, type ComicTargetDevice } from "@/lib/comic-target-device";

const supabase = createClient();

type Comic = {
  id: string;
  title: string;
  slug: string;
  synopsis: string;
  contributor: string;
  genre: string;
  target_device: ComicTargetDevice;
  coverUrl: string | null;
  creator: string;
  creatorHandle: string | null;
  creatorProfilePublic: boolean;
  latestChapter: { id: string; title: string; chapter_number: number; published_at: string | null } | null;
  chapterCount: number;
  engagement: { views: number; likes: number; shares: number } | null;
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
  return getComicGenreLabel(genre);
}

function cleanSynopsis(synopsis: string) {
  return synopsis.replace(/\*\*/g, "").replace(/👉/g, "").replace(/\n+/g, " ").trim();
}

function parseComicEngagementRows(data: unknown) {
  if (!Array.isArray(data)) return null;
  const counts = new Map<string, NonNullable<Comic["engagement"]>>();
  for (const row of data) {
    if (!row || typeof row !== "object" || !("comic_id" in row)) continue;
    const comicId = row.comic_id;
    const views = Number(row.views);
    const likes = Number(row.likes);
    const shares = Number(row.shares);
    if (typeof comicId !== "string" || ![views, likes, shares].every((count) => Number.isSafeInteger(count) && count >= 0)) {
      return null;
    }
    counts.set(comicId, { views, likes, shares });
  }
  return counts;
}

function formatEngagementCount(count: number) {
  return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(count);
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
          {comic.engagement && (
            <div className="reader-card-engagement" aria-label={`Statistik ${comic.title}`}>
              <span aria-label={`${comic.engagement.views.toLocaleString("id-ID")} dilihat`} title="Dilihat"><Eye size={13} /><b>{formatEngagementCount(comic.engagement.views)}</b></span>
              <span aria-label={`${comic.engagement.likes.toLocaleString("id-ID")} favorit`} title="Favorit"><Heart size={13} /><b>{formatEngagementCount(comic.engagement.likes)}</b></span>
              <span aria-label={`${comic.engagement.shares.toLocaleString("id-ID")} dibagikan`} title="Dibagikan"><Share2 size={13} /><b>{formatEngagementCount(comic.engagement.shares)}</b></span>
            </div>
          )}
          {chapter && <span className="reader-card-latest">Terbaru · Episode {chapter.chapter_number}</span>}
        </div>
      </Link>
      {comic.creatorHandle && comic.creatorProfilePublic && (
        <Link className="reader-creator-profile-link" href={`/kreator/${encodeURIComponent(comic.creatorHandle)}`}>Profil kreator <ArrowUpRight size={13} /></Link>
      )}
      {chapter && <Link className="reader-card-read" href={`/comic/${comic.slug}/chapter/${chapter.id}`}><BookOpen size={14} /> Baca <ArrowRight size={14} /></Link>}
    </article>
  );
}

function ComicSkeleton() {
  return <div className="reader-comic-skeleton" aria-hidden="true"><span /><i /><i /><i /></div>;
}

export default function Home() {
  const { settings } = usePlatformSettings();
  const currentDevice = useCurrentDevice();
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
      let { data, error } = await supabase
        .from("comics")
        .select("id, title, slug, synopsis, genre, contributor, cover_key, target_device, profiles!comics_creator_id_fkey(id, public_handle, display_name, public_profile)")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error?.code === "42703") {
        const fallbackQuery = await supabase
          .from("comics")
          .select("id, title, slug, synopsis, genre, contributor, cover_key, target_device, profiles!comics_creator_id_fkey(display_name)")
          .eq("status", "published")
          .order("created_at", { ascending: false });
        data = fallbackQuery.data as typeof data;
        error = fallbackQuery.error;
        if (error?.code === "42703") {
          const legacyQuery = await supabase
            .from("comics")
            .select("id, title, slug, synopsis, genre, contributor, cover_key, profiles!comics_creator_id_fkey(display_name)")
            .eq("status", "published")
            .order("created_at", { ascending: false });
          data = legacyQuery.data as typeof data;
          error = legacyQuery.error;
        }
      }
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
        const profiles = comic.profiles as { id?: string; public_handle?: string | null; display_name?: string; public_profile?: boolean } | { id?: string; public_handle?: string | null; display_name?: string; public_profile?: boolean }[] | null;
        const profile = Array.isArray(profiles) ? profiles[0] : profiles;
        const chapters = chaptersByComic.get(comic.id) ?? [];
        return {
          id: comic.id,
          title: comic.title,
          slug: comic.slug,
          synopsis: comic.synopsis || "",
          contributor: comic.contributor?.trim() || "",
          genre: comic.genre,
          target_device: comic.target_device || "all",
          creator: profile?.display_name || "Kreator independen",
          creatorHandle: profile?.public_profile ? profile.public_handle || null : null,
          creatorProfilePublic: Boolean(profile?.public_profile),
          coverUrl: comic.cover_key && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${comic.cover_key}` : null,
          latestChapter: chapters[0] ?? null,
          chapterCount: chapters.length,
          engagement: null,
        };
      });

      if (comicIds.length) {
        const { data: engagementRows, error: engagementError } = await supabase.rpc("public_comics_engagement", {
          p_comic_ids: comicIds,
        });
        if (engagementError) {
          if (engagementError.code === "PGRST202") {
            console.warn("Comic card engagement counts are unavailable. Run supabase/comic-engagement-counts.sql and refresh the Supabase API schema cache.");
          } else {
            console.error("Unable to load comic card engagement counts:", {
              message: engagementError.message,
              code: engagementError.code,
              details: engagementError.details,
              hint: engagementError.hint,
            });
          }
        } else {
          const engagementByComic = parseComicEngagementRows(engagementRows);
          if (!engagementByComic) {
            console.error("Comic card engagement counts returned an invalid response.", engagementRows);
          } else {
            for (const comic of loadedComics) {
              comic.engagement = engagementByComic.get(comic.id) ?? { views: 0, likes: 0, shares: 0 };
            }
          }
        }
      }

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
          .select("last_page, chapter_id")
          .eq("user_id", session.user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (historyError) {
          console.error("Unable to load reading history:", {
            message: historyError.message,
            code: historyError.code,
            details: historyError.details,
            hint: historyError.hint,
          });
        } else if (history) {
          const { data: chapter, error: chapterError } = await supabase
            .from("chapters")
            .select("id, title, chapter_number, comic_id")
            .eq("id", history.chapter_id)
            .maybeSingle();
          if (chapterError) {
            console.error("Unable to load the chapter from reading history:", {
              message: chapterError.message,
              code: chapterError.code,
              details: chapterError.details,
              hint: chapterError.hint,
            });
          } else if (chapter) {
            let { data: historyComic, error: comicError } = await supabase
              .from("comics")
              .select("id, title, slug, synopsis, contributor, genre, cover_key, target_device, profiles!comics_creator_id_fkey(display_name)")
              .eq("id", chapter.comic_id)
              .maybeSingle();
            if (comicError?.code === "42703") {
              const legacyHistoryComic = await supabase
                .from("comics")
                .select("id, title, slug, synopsis, contributor, genre, cover_key, profiles!comics_creator_id_fkey(display_name)")
                .eq("id", chapter.comic_id)
                .maybeSingle();
              historyComic = legacyHistoryComic.data as typeof historyComic;
              comicError = legacyHistoryComic.error;
            }
            if (comicError) {
              console.error("Unable to load the comic from reading history:", {
                message: comicError.message,
                code: comicError.code,
                details: comicError.details,
                hint: comicError.hint,
              });
            } else if (historyComic) {
                const { count: pageCount, error: countError } = await supabase
                  .from("pages")
                  .select("id", { count: "exact", head: true })
                  .eq("chapter_id", history.chapter_id);
                if (countError) {
                  console.error("Unable to load reading progress total:", {
                    message: countError.message,
                    code: countError.code,
                    details: countError.details,
                    hint: countError.hint,
                  });
                }
                const profile = Array.isArray(historyComic.profiles) ? historyComic.profiles[0] : historyComic.profiles;
                const historyRecord: ContinueReading = {
                  comic: {
                    id: historyComic.id,
                    title: historyComic.title,
                    slug: historyComic.slug,
                    synopsis: historyComic.synopsis || "",
                    contributor: historyComic.contributor?.trim() || "",
                    genre: historyComic.genre,
                    target_device: historyComic.target_device || "all",
                    creator: profile?.display_name || "Kreator independen",
                    creatorHandle: null,
                    creatorProfilePublic: false,
                    coverUrl: historyComic.cover_key && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${historyComic.cover_key}` : null,
                    latestChapter: null,
                    chapterCount: 0,
                    engagement: null,
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

  const visibleComics = useMemo(
    () => comics.filter((comic) => isComicAvailableOnDevice(comic.target_device, currentDevice)),
    [comics, currentDevice],
  );
  const genres = useMemo(() => ["all", ...new Set([
    ...COMIC_GENRES,
    ...visibleComics.map((comic) => comic.genre).filter(Boolean),
  ])], [visibleComics]);
  const searchedComics = useMemo(() => {
    const normalizedQuery = settings.feature_flags.search ? query.trim().toLocaleLowerCase("id-ID") : "";
    return visibleComics.filter((comic) => {
      const matchesGenre = genre === "all" || comic.genre === genre;
      const searchable = `${comic.title} ${comic.creator} ${comic.contributor} ${comic.genre}`.toLocaleLowerCase("id-ID");
      return matchesGenre && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [visibleComics, genre, query, settings.feature_flags.search]);
  const latestComics = [...visibleComics].filter((comic) => comic.latestChapter).sort((a, b) =>
    new Date(b.latestChapter?.published_at || 0).getTime() - new Date(a.latestChapter?.published_at || 0).getTime(),
  );
  const featuredComic = latestComics[0] || visibleComics[0];
  const ongoingComics = [...visibleComics].sort((a, b) => b.chapterCount - a.chapterCount).filter((comic) => comic.chapterCount > 1);

  const focusSearch = () => {
    setMobileSearchOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  return (
    <main className="reader-home">
      <h1 className="reader-sr-only">Baca komik Indonesia dari kreator lokal</h1>
      <header className="reader-header">
        <button className="reader-menu-toggle" aria-label={menuOpen ? "Tutup navigasi" : "Buka navigasi"} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <BrandLogo className="wordmark reader-wordmark" />
        <nav className={`reader-nav-links${menuOpen ? " reader-nav-links-open" : ""}`} aria-label="Navigasi utama">
          <a href="#jelajah" onClick={() => setMenuOpen(false)}>Jelajah</a>
          <a href="#genre" onClick={() => setMenuOpen(false)}>Genre</a>
          {signedIn && settings.feature_flags.creators && <a href="#creator" onClick={() => setMenuOpen(false)}>Kreator</a>}
          {signedIn && <Link href="/account" onClick={() => setMenuOpen(false)}>Koleksi saya</Link>}
          {!signedIn && <Link href="/login" onClick={() => setMenuOpen(false)}>Masuk</Link>}
        </nav>
        {settings.feature_flags.search && <form className={`reader-header-search${mobileSearchOpen ? " reader-header-search-open" : ""}`} onSubmit={(event) => { event.preventDefault(); document.querySelector("#jelajah")?.scrollIntoView({ behavior: "smooth" }); }}>
          <Search size={17} aria-hidden="true" />
          <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari komik, kreator, genre..." aria-label="Cari komik, kreator, atau genre" />
          {mobileSearchOpen && <button type="button" className="reader-search-close" onClick={() => setMobileSearchOpen(false)} aria-label="Tutup pencarian"><X size={17} /></button>}
        </form>}
        <div className="reader-header-actions">
          {settings.feature_flags.search && <button className="reader-search-mobile" aria-label="Cari komik" onClick={focusSearch}><Search size={20} /></button>}
          {signedIn
            ? <Link className="reader-login-button" href="/account"><UserRound size={17} /><span>Profil</span></Link>
            : <Link className="reader-login-button" href="/login"><UserRound size={17} /><span>Masuk</span></Link>}
        </div>
      </header>

      {authMessage && <div className="reader-inline-message" role="alert">{authMessage}<button onClick={() => setAuthRetry((attempt) => attempt + 1)}>Coba lagi</button></div>}

      {catalogState === "loading" ? (
        <section className="reader-featured reader-featured-loading" aria-label="Memuat komik pilihan">
          <div className="reader-featured-copy"><span className="reader-featured-skeleton reader-featured-skeleton-kicker" /><span className="reader-featured-skeleton reader-featured-skeleton-meta" /><span className="reader-featured-skeleton reader-featured-skeleton-title" /><span className="reader-featured-skeleton reader-featured-skeleton-description" /><span className="reader-featured-skeleton reader-featured-skeleton-button" /></div>
          <div className="reader-featured-cover-skeleton" aria-hidden="true" />
        </section>
      ) : featuredComic ? (
        <section className="reader-featured">
          <div className="reader-featured-copy">
            <span className="reader-kicker"><Sparkles size={15} /> UPDATE TERBARU</span>
            <p className="reader-featured-genre">{comicGenre(featuredComic.genre)} <span>·</span> {featuredComic.contributor || featuredComic.creator}</p>
            {featuredComic.creatorHandle && featuredComic.creatorProfilePublic && (
              <Link className="reader-creator-profile-link" href={`/kreator/${encodeURIComponent(featuredComic.creatorHandle)}`}>Profil kreator {featuredComic.creator} <ArrowUpRight size={13} /></Link>
            )}
            <h2>{featuredComic.title}</h2>
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
          <h2>Temukan kisah yang membuatmu betah membaca.</h2>
          <p>Jelajahi komik independen dan temukan cerita favorit berikutnya.</p>
          <Link className="reader-primary-button" href="#jelajah">Jelajahi komik <ArrowRight size={17} /></Link>
        </section>
      )}

      <SponsoredAd slotKey="home_banner" placement="home" />

      <div className="reader-home-content">
        {signedIn && continueReading && isComicAvailableOnDevice(continueReading.comic.target_device, currentDevice) && (
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
            <div className="reader-section-heading"><div><p className="reader-section-kicker">SERIAL YANG TERUS BERLANJUT</p><h2>Ikuti ceritanya</h2></div><a href="#jelajah">Semua komik <ArrowUpRight size={16} /></a></div>
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
            {settings.feature_flags.search && <div className="reader-mobile-search-inline"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari komik, kreator, atau genre..." aria-label="Cari komik, kreator, atau genre" /></div>}
          </div>
          {catalogState === "ready" && searchedComics.length > 0 && <div className="reader-comic-grid">{searchedComics.map((comic, index) => (
            <Fragment key={comic.id}>
              <ComicCard comic={comic} />
              {index === 7 && searchedComics.length > 8 && <SponsoredAd slotKey="catalog_grid_native" placement="catalog" />}
            </Fragment>
          ))}</div>}
          {catalogState === "loading" && <div className="reader-comic-grid">{Array.from({ length: 6 }, (_, index) => <ComicSkeleton key={index} />)}</div>}
          {catalogState === "ready" && searchedComics.length === 0 && <div className="reader-empty-state"><p>{query ? "Komik yang kamu cari belum ditemukan." : genre !== "all" ? "Belum ada komik dalam kategori ini." : visibleComics.length === 0 ? "Belum ada komik yang tersedia di perangkat ini." : "Belum ada komik terbit."}</p><button onClick={() => { setGenre("all"); setQuery(""); }}>Jelajahi semua komik</button></div>}
        </section>
      </div>

      <section className="reader-seo-about" aria-labelledby="reader-seo-about-title">
        <header className="reader-seo-about-header">
          <p className="reader-section-kicker">TENTANG MU KOMIK</p>
          <h2 id="reader-seo-about-title">Cerita komik Indonesia dari kreator lokal</h2>
          <p>MU Komik adalah platform untuk membaca komik Indonesia dan menjelajahi cerita karya kreator lokal. Temukan komik berdasarkan genre, ikuti episode yang terbit, atau mulai berkarya sebagai kreator.</p>
        </header>
        <div className="reader-seo-about-grid">
          <article>
            <h3>Jelajahi beragam genre</h3>
            <p>Katalog MU Komik menyediakan penelusuran berdasarkan genre, seperti fantasi, fiksi ilmiah, drama, komedi, aksi, romansa, horor, misteri, dan petualangan. Ketersediaan judul bergantung pada komik yang telah diterbitkan.</p>
            <a href="#genre">Jelajahi genre komik</a>
          </article>
          <article>
            <h3>Baca cerita dan episode</h3>
            <p>Buka halaman komik untuk membaca sinopsis, melihat informasi cerita, dan menemukan episode yang tersedia. Komik dapat dibaca pada perangkat yang didukung oleh kreatornya.</p>
            <a href="#jelajah">Lihat katalog komik</a>
          </article>
          <article>
            <h3>Ruang untuk kreator lokal</h3>
            <p>Kreator dapat mengajukan akses kreator, menerbitkan komik, dan mengelola episode karyanya. MU Komik juga menjelaskan pandangannya tentang penggunaan AI dalam proses kreatif.</p>
            <Link href="/manifesto">Baca manifesto AI MU Komik</Link>
          </article>
        </div>
      </section>

      {settings.feature_flags.creators && <section className="reader-creator-cta" id="creator">
        <div><p className="reader-section-kicker">PUNYA CERITA?</p><h2>Terbitkan komikmu dan temukan pembaca baru.</h2></div>
        <Link className="reader-primary-button" href={signedIn ? "/account" : "/login"}>Jadi kreator <ArrowRight size={17} /></Link>
      </section>}
      <footer className="reader-footer">
        <BrandLogo className="wordmark reader-wordmark" />
        <p>Tempat cerita Indonesia menemukan pembacanya.</p>
        <PlatformLinks />
        <nav className="reader-footer-links" aria-label="Tautan footer"><a href="#jelajah">Jelajah</a><a href="#genre">Genre</a><a href="#creator">Kreator</a><Link href="/manifesto">Manifesto AI</Link></nav>
        <span>© 2026 mu-komik</span>
      </footer>
    </main>
  );
}
