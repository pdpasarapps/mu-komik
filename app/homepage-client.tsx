"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Baby, BookOpen, Bookmark, ChevronLeft, ChevronRight, Compass, Grid2X2, Palette, Search, Sparkles, UserRound, X, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { COMIC_GENRES, getComicGenreLabel } from "@/lib/comic-genres";
import BrandLogo from "@/components/brand-logo";
import PlatformLinks from "@/components/platform-links";
import SponsoredAd from "@/components/sponsored-ad";
import { KidsModeToggle, useKidsMode, usePlatformSettings } from "./platform-runtime";
import { useCurrentDevice } from "@/components/use-current-device";
import { isComicAvailableOnDevice } from "@/lib/comic-target-device";
import { getKidsAgeLabel } from "@/lib/kids-curation";
import type { ContinueReading, HomepageArticle, HomepageCatalog, HomepageComic } from "@/lib/homepage-data";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/localized-content";

const supabase = createClient();
const PENDING_GUEST_READING_STORAGE_KEY = "mu-komik:pending-guest-reading";

const KIDS_GENRE_ICONS: Record<string, LucideIcon> = {
  all: Grid2X2,
  Fantasy: Sparkles,
  Adventure: Compass,
  Kids: Baby,
};

type HomepagePromo = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  eyebrow_en: string;
  title_en: string;
  description_en: string;
  image_url: string;
  image_url_tablet: string | null;
  image_url_mobile: string | null;
  cta_label: string;
  cta_label_en: string;
  destination_url: string;
};

type PendingGuestReading = {
  href: string;
  comicTitle: string;
  chapterNumber: number;
  chapterTitle: string;
};

function readPendingGuestReading(): PendingGuestReading | null {
  try {
    const storedReading = localStorage.getItem(PENDING_GUEST_READING_STORAGE_KEY);
    if (!storedReading) return null;
    const parsedReading: unknown = JSON.parse(storedReading);
    if (!parsedReading || typeof parsedReading !== "object") {
      throw new Error("Stored guest reading continuation has an invalid format.");
    }
    const reading = parsedReading as Partial<PendingGuestReading>;
    if (
      typeof reading.href !== "string"
      || !reading.href.startsWith("/comic/")
      || reading.href.startsWith("//")
      || reading.href.includes("\\")
      || typeof reading.comicTitle !== "string"
      || typeof reading.chapterNumber !== "number"
      || typeof reading.chapterTitle !== "string"
    ) {
      throw new Error("Stored guest reading continuation has invalid values.");
    }
    return {
      href: reading.href,
      comicTitle: reading.comicTitle,
      chapterNumber: reading.chapterNumber,
      chapterTitle: reading.chapterTitle,
    };
  } catch (storageError) {
    console.error("Unable to read the guest reading continuation:", storageError);
    return null;
  }
}

function comicGenre(genre: string) {
  return getComicGenreLabel(genre);
}

function HomepagePromoCarousel({ promos }: { promos: HomepagePromo[] }) {
  const { locale, t } = useLocale();
  const [activeIndex, setActiveIndex] = useState(0);
  const currentIndex = promos.length ? activeIndex % promos.length : 0;
  const promo = promos[currentIndex];
  const eyebrow = localizedText(promo?.eyebrow, promo?.eyebrow_en, locale);
  const title = localizedText(promo?.title, promo?.title_en, locale);
  const description = localizedText(promo?.description, promo?.description_en, locale);
  const ctaLabel = locale === "en"
    ? promo?.cta_label_en?.trim() || t(promo?.cta_label || "Selengkapnya")
    : promo?.cta_label || "";

  if (!promo) {
    return (
      <section className="reader-welcome">
        <p className="reader-kicker">{t("CERITA INDONESIA, DI SINI")}</p>
        <h2>{t("Temukan kisah yang membuatmu betah membaca.")}</h2>
        <p>{t("Jelajahi komik independen dan temukan cerita favorit berikutnya.")}</p>
        <Link className="reader-primary-button" href="#jelajah">{t("Jelajahi komik")} <ArrowRight size={17} /></Link>
      </section>
    );
  }

  const promoLink = promo.destination_url.startsWith("/") && !promo.destination_url.startsWith("//")
    ? <Link className="reader-primary-button" href={promo.destination_url}>{ctaLabel || t("Selengkapnya")} <ArrowRight size={17} /></Link>
    : <a className="reader-primary-button" href={promo.destination_url} target="_blank" rel="noreferrer noopener">{ctaLabel || t("Selengkapnya")} <ArrowRight size={17} /></a>;

  return (
    <section className="reader-featured reader-promo-hero" aria-roledescription="carousel" aria-label={t("Promo pilihan")}>
      <picture className="reader-promo-background">
        {promo.image_url_mobile && <source media="(max-width: 640px)" srcSet={promo.image_url_mobile} />}
        {promo.image_url_tablet && <source media="(min-width: 641px) and (max-width: 1023px)" srcSet={promo.image_url_tablet} />}
        <Image src={promo.image_url} alt="" width={1920} height={720} unoptimized loading="eager" fetchPriority="high" />
      </picture>
      <div className="reader-promo-scrim" />
      <div className="reader-featured-copy reader-promo-copy" key={promo.id}>
        {eyebrow && <span className="reader-kicker">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p className="reader-featured-synopsis">{description}</p>}
        {promoLink}
      </div>
      {promos.length > 1 && <>
        <div className="reader-promo-controls" aria-label="Navigasi promo">
          <button type="button" aria-label={t("Promo sebelumnya")} onClick={() => setActiveIndex((currentIndex - 1 + promos.length) % promos.length)}><ArrowLeft size={18} /></button>
          <div className="reader-promo-dots">
            {promos.map((item, index) => <button key={item.id} type="button" aria-label={`${t("Tampilkan promo")} ${index + 1}: ${localizedText(item.title, item.title_en, locale)}`} aria-current={index === currentIndex} onClick={() => setActiveIndex(index)} />)}
          </div>
          <button type="button" aria-label={t("Promo berikutnya")} onClick={() => setActiveIndex((currentIndex + 1) % promos.length)}><ArrowRight size={18} /></button>
        </div>
        <span className="reader-promo-count" aria-live="polite">{currentIndex + 1} / {promos.length}</span>
      </>}
    </section>
  );
}

function ComicCard({ comic, compact = false, overlayDetails = false, landscapeCard = false }: { comic: HomepageComic; compact?: boolean; overlayDetails?: boolean; landscapeCard?: boolean }) {
  const chapter = comic.latestChapter;
  const { kidsMode } = useKidsMode();
  const { t } = useLocale();
  const authorName = comic.contributor.trim().replace(/^penulis\s*:\s*/i, "").trim() || comic.creator;
  const creatorProfile = !kidsMode && comic.creatorHandle && comic.creatorProfilePublic
    ? `/kreator/${encodeURIComponent(comic.creatorHandle)}`
    : null;
  const comicInfo = (
    <div className="reader-comic-info">
      {!overlayDetails && <><span className="reader-card-genre">{t(comicGenre(comic.genre))}</span><h3>{comic.title}</h3></>}
      {kidsMode && comic.kidsModeApproved && getKidsAgeLabel(comic.kidsAgeRange) && <span className="kids-comic-age-badge">{getKidsAgeLabel(comic.kidsAgeRange)}</span>}
      {!kidsMode && <div className={overlayDetails ? "reader-card-author" : undefined}>
        <p title={authorName}>{authorName}</p>
        {overlayDetails && creatorProfile && <Link className="reader-card-creator-shortcut" href={creatorProfile} aria-label={`Lihat profil kreator ${authorName}`} title="Profil kreator"><ArrowUpRight size={13} /></Link>}
      </div>}
    </div>
  );
  return (
    <article className={`reader-comic-card${compact ? " reader-comic-card-compact" : ""}${landscapeCard ? " reader-comic-card-landscape" : ""}`}>
      <Link href={`/comic/${comic.slug}`} className="reader-card-link" aria-label={`Buka ${comic.title}`}>
        <div className="reader-comic-cover">
          {comic.coverUrl
            ? <img src={comic.coverUrl} alt={`Sampul ${comic.title}`} loading="lazy" />
            : <span aria-hidden="true">{comic.title.slice(0, 2).toUpperCase()}</span>}
          {overlayDetails && <div className="reader-latest-cover-copy"><span>{t(comicGenre(comic.genre))}</span><h3>{comic.title}</h3></div>}
          {chapter && <span className="reader-cover-episode">{kidsMode ? `Cerita ${chapter.chapter_number}` : `Ep. ${chapter.chapter_number}`}</span>}
        </div>
        {!overlayDetails && comicInfo}
      </Link>
      {overlayDetails && comicInfo}
      {!overlayDetails && creatorProfile && (
        <Link className="reader-creator-profile-link" href={creatorProfile}>{t("Profil kreator")} <ArrowUpRight size={13} /></Link>
      )}
      {chapter && <Link className="reader-card-read" href={`/comic/${comic.slug}/chapter/${chapter.id}`}><BookOpen size={14} /> {t("Baca")} <ArrowRight size={14} /></Link>}
    </article>
  );
}

export default function HomePageClient({
  comics: initialComics,
  catalogState: initialCatalogState,
  episodeLoadError: initialEpisodeLoadError,
  kidsCurationAvailable,
  articles,
}: HomepageCatalog & { articles: HomepageArticle[] }) {
  const { locale, t } = useLocale();
  const { settings } = usePlatformSettings();
  const { kidsMode } = useKidsMode();
  const currentDevice = useCurrentDevice();
  const router = useRouter();
  const comics = initialComics;
  const catalogState = initialCatalogState;
  const episodeLoadError = initialEpisodeLoadError;
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [comicPage, setComicPage] = useState(1);
  const [comicsPerPage, setComicsPerPage] = useState(12);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [continueReading, setContinueReading] = useState<ContinueReading | null>(null);
  const [pendingGuestReading, setPendingGuestReading] = useState<PendingGuestReading | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [authRetry, setAuthRetry] = useState(0);
  const [homepagePromos, setHomepagePromos] = useState<HomepagePromo[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  useEffect(() => {
    let cancelled = false;
    const loadPromos = async () => {
      const { data, error } = await supabase
        .from("homepage_promos")
        .select("id, eyebrow, title, description, eyebrow_en, title_en, description_en, image_url, image_url_tablet, image_url_mobile, cta_label, cta_label_en, destination_url")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Unable to load homepage promos. Run supabase/homepage-promos.sql if the table is missing:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return;
      }
      if (!cancelled) setHomepagePromos((data ?? []) as HomepagePromo[]);
    };
    void loadPromos();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadHome = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("Unable to check the current auth session:", sessionError);
        if (active) setAuthMessage("Status masuk belum dapat diperiksa. Periksa koneksi lalu coba lagi.");
      }
      const session = sessionData.session;
      if (active) setSignedIn(Boolean(session?.user));
      if (active) setPendingGuestReading(session?.user ? readPendingGuestReading() : null);

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
                    kidsModeApproved: comics.find((comic) => comic.id === historyComic.id)?.kidsModeApproved ?? false,
                    kidsAgeRange: comics.find((comic) => comic.id === historyComic.id)?.kidsAgeRange ?? null,
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

    };

    void loadHome();
    return () => { active = false; };
  }, [authRetry, comics, publicUrl]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
      if (session?.user) setPendingGuestReading(readPendingGuestReading());
      else {
        setContinueReading(null);
        setPendingGuestReading(null);
      }
      setAuthMessage("");
    });
    return () => subscription.unsubscribe();
  }, []);

  const clearPendingGuestReading = () => {
    try {
      localStorage.removeItem(PENDING_GUEST_READING_STORAGE_KEY);
    } catch (storageError) {
      console.error("Unable to clear the guest reading continuation:", storageError);
    }
    setPendingGuestReading(null);
  };

  const visibleComics = useMemo(
    () => comics.filter((comic) => isComicAvailableOnDevice(comic.target_device, currentDevice)
      && (!kidsMode || comic.kidsModeApproved)),
    [comics, currentDevice, kidsMode],
  );
  const genres = useMemo(() => {
    const availableGenres = new Set(visibleComics.map((comic) => comic.genre).filter(Boolean));
    const standardGenres = COMIC_GENRES.filter((item) => availableGenres.has(item));
    const otherGenres = Array.from(availableGenres).filter((item) => !(COMIC_GENRES as readonly string[]).includes(item));
    return ["all", ...standardGenres, ...otherGenres];
  }, [visibleComics]);
  const activeGenre = genres.includes(genre) ? genre : "all";
  const searchedComics = useMemo(() => {
    const normalizedQuery = settings.feature_flags.search ? query.trim().toLocaleLowerCase("id-ID") : "";
    return visibleComics.filter((comic) => {
      const matchesGenre = activeGenre === "all" || comic.genre === activeGenre;
      const searchable = `${comic.title} ${comic.genre}${kidsMode ? "" : ` ${comic.creator} ${comic.contributor}`}`.toLocaleLowerCase("id-ID");
      return matchesGenre && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [visibleComics, activeGenre, query, settings.feature_flags.search, kidsMode]);
  const pageCount = Math.max(1, Math.ceil(searchedComics.length / comicsPerPage));
  const currentComicPage = Math.min(comicPage, pageCount);
  const pageStartIndex = (currentComicPage - 1) * comicsPerPage;
  const paginatedComics = searchedComics.slice(pageStartIndex, pageStartIndex + comicsPerPage);
  const latestComics = [...visibleComics].filter((comic) => comic.latestChapter).sort((a, b) =>
    new Date(b.latestChapter?.published_at || 0).getTime() - new Date(a.latestChapter?.published_at || 0).getTime(),
  );
  const ongoingComics = [...visibleComics].sort((a, b) => b.chapterCount - a.chapterCount).filter((comic) => comic.chapterCount > 1);

  useEffect(() => {
    const updatePageSize = () => {
      const pageSize = window.innerWidth <= 640 ? 4 : window.innerWidth <= 900 ? 8 : 12;
      setComicsPerPage((current) => current === pageSize ? current : pageSize);
    };
    const frame = window.requestAnimationFrame(updatePageSize);
    window.addEventListener("resize", updatePageSize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePageSize);
    };
  }, []);

  const focusSearch = () => {
    setMobileSearchOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  return (
    <main className="reader-home">
    {signedIn && pendingGuestReading && (
      <aside className="reader-pending-reading" role="dialog" aria-labelledby="reader-pending-reading-title">
        <button className="reader-pending-reading-close" type="button" aria-label={t("Tutup dialog")} onClick={clearPendingGuestReading}><X size={17} /></button>
        <p className="reader-section-kicker">{t("BACAANMU MENUNGGU")}</p>
        <h2 id="reader-pending-reading-title">{t("Lanjutkan komik yang tadi kamu baca?")}</h2>
        <p>{pendingGuestReading.comicTitle} · {kidsMode ? "Cerita" : "Episode"} {pendingGuestReading.chapterNumber}: {pendingGuestReading.chapterTitle}</p>
        <div className="reader-pending-reading-actions">
          <button className="reader-pending-reading-dismiss" type="button" onClick={clearPendingGuestReading}>{t("Nanti saja")}</button>
          <Link className="reader-primary-button" href={pendingGuestReading.href} onClick={clearPendingGuestReading}>{t("Lanjutkan membaca")} <ArrowRight size={16} /></Link>
        </div>
      </aside>
    )}
    <h1 className="reader-sr-only">{t("Baca komik Indonesia dari kreator lokal")}</h1>
    <header className={`reader-header${kidsMode ? " reader-header-kids-mode" : ""}`}>
      <BrandLogo className="wordmark reader-wordmark" showName />
      <nav className="reader-nav-links" aria-label={t("Navigasi utama")}>
        <a className="reader-primary-nav-link" href="#jelajah">{t("Jelajah")}</a>
        <a className="reader-primary-nav-link" href="#genre">{t("Genre")}</a>
        {!kidsMode && <Link href="/artikel">{t("Artikel")}</Link>}
        {!kidsMode && signedIn && settings.feature_flags.creators && <a href="#creator">{t("Kreator")}</a>}
        {!kidsMode && signedIn && <Link href="/account">{t("Koleksi saya")}</Link>}
        <KidsModeToggle />
        </nav>
        {settings.feature_flags.search && <form className={`reader-header-search${mobileSearchOpen ? " reader-header-search-open" : ""}`} onSubmit={(event) => { event.preventDefault(); document.querySelector("#jelajah")?.scrollIntoView({ behavior: "smooth" }); }}>
          <Search size={17} aria-hidden="true" />
          <input ref={searchInputRef} value={query} onChange={(event) => { setQuery(event.target.value); setComicPage(1); }} placeholder={kidsMode ? t("Cari komik atau genre...") : t("Cari komik, kreator, genre...")} aria-label={kidsMode ? t("Cari komik atau genre") : t("Cari komik, kreator, atau genre")} />
          {mobileSearchOpen && <button type="button" className="reader-search-close" onClick={() => setMobileSearchOpen(false)} aria-label={t("Tutup pencarian")}><X size={17} /></button>}
        </form>}
        <div className="reader-header-actions">
          <KidsModeToggle />
          {settings.feature_flags.search && <button className="reader-search-mobile" aria-label={t("Cari komik")} onClick={focusSearch}><Search size={20} /></button>}
          {!kidsMode && (signedIn
            ? <Link className="reader-login-button" href="/account"><UserRound size={17} /><span>{t("Profil")}</span></Link>
            : <Link className="reader-login-button" href="/login"><UserRound size={17} /><span>{t("Masuk")}</span></Link>)}
        </div>
      </header>
      <nav className={`reader-bottom-nav${kidsMode ? " reader-bottom-nav-kids" : ""}`} aria-label={t("Navigasi bawah")}>
        <a href="#jelajah"><Compass size={19} /><span>{t("Jelajah")}</span></a>
        {kidsMode ? <a href="#genre"><BookOpen size={19} /><span>{t("Genre")}</span></a> : <>
          <Link href="/account" aria-label={t("Koleksi saya")}><Bookmark size={19} /><span>{t("Koleksi saya")}</span></Link>
          {settings.feature_flags.creators && <a href="#creator"><Palette size={19} /><span>{t("Kreator")}</span></a>}
          {signedIn
            ? <Link href="/account" aria-label={t("Profil")}><UserRound size={19} /><span>{t("Profil")}</span></Link>
            : <Link href="/login" aria-label={t("Masuk")}><UserRound size={19} /><span>{t("Masuk")}</span></Link>}
        </>}
      </nav>

      {authMessage && <div className="reader-inline-message" role="alert">{authMessage}<button onClick={() => setAuthRetry((attempt) => attempt + 1)}>{t("Coba lagi")}</button></div>}

      {kidsMode && catalogState === "ready" && kidsCurationAvailable && !episodeLoadError && (
        <section className="reader-kids-welcome">
          <div><p className="reader-section-kicker">{t("SIAP BERPETUALANG?")}</p><h2>{t("Pilih cerita favoritmu")}</h2></div>
          <a className="reader-primary-button" href="#jelajah">{t("Lihat cerita")} <ArrowRight size={17} /></a>
        </section>
      )}

      {(!kidsMode || catalogState !== "ready" || episodeLoadError || !kidsCurationAvailable) && <section className="reader-home-section" id="terbaru">
        <div className="reader-home-content">
          <div className="reader-section-heading"><div><p className="reader-section-kicker">{t("UPDATE TERKINI")}</p><h2>{t(kidsMode ? "Cerita terbaru" : "Episode terbaru")}</h2></div><a href="#jelajah">{t("Jelajahi semua")} <ArrowUpRight size={16} /></a></div>
          {catalogState === "error" && <div className="reader-empty-state"><p>{t("Komik belum dapat dimuat. Periksa koneksi lalu coba lagi.")}</p><button onClick={() => router.refresh()}>{t("Coba lagi")}</button></div>}
          {catalogState === "empty" && <div className="reader-empty-state"><p>{t("Belum ada cerita terbit. Kunjungi lagi nanti untuk menemukan komik baru.")}</p></div>}
          {catalogState === "ready" && episodeLoadError && <div className="reader-empty-state"><p>{t("Episode terbaru belum dapat dimuat. Komik tetap bisa dijelajahi di bawah.")}</p><button onClick={() => router.refresh()}>{t("Coba lagi")}</button></div>}
          {catalogState === "ready" && !episodeLoadError && latestComics.length > 0 && <div className="reader-comic-grid reader-latest-comic-grid">{latestComics.slice(0, 4).map((comic) => <ComicCard key={comic.id} comic={comic} compact overlayDetails />)}</div>}
          {kidsMode && !kidsCurationAvailable && <div className="reader-empty-state" role="alert"><p>Library Kids Mode belum dapat diverifikasi. Coba muat ulang halaman.</p><button onClick={() => router.refresh()}>{t("Coba lagi")}</button></div>}
          {catalogState === "ready" && !episodeLoadError && latestComics.length === 0 && <div className="reader-empty-state"><p>{kidsMode ? "Belum ada cerita terbaru dari komik anak yang disetujui." : "Belum ada episode terbit. Jelajahi komik dan nantikan update berikutnya."}</p><a href="#jelajah">{t(kidsMode ? "Lihat komik anak" : "Lihat semua komik")} <ArrowRight size={16} /></a></div>}
        </div>
      </section>}

      {!kidsMode && <HomepagePromoCarousel promos={homepagePromos} />}

      <div className="reader-home-content">
        {signedIn && continueReading && isComicAvailableOnDevice(continueReading.comic.target_device, currentDevice)
          && (!kidsMode || continueReading.comic.kidsModeApproved) && (
          <section className="reader-home-section reader-continue-section">
            <div className="reader-section-heading"><div><p className="reader-section-kicker">{t("KEMBALI KE CERITAMU")}</p><h2>{t("Lanjutkan membaca")}</h2></div></div>
            <Link className="reader-continue-card" href={`/comic/${continueReading.comic.slug}/chapter/${continueReading.chapterId}`}>
              <div className="reader-continue-cover">{continueReading.comic.coverUrl && <img src={continueReading.comic.coverUrl} alt="" loading="lazy" />}</div>
              <div className="reader-continue-info"><span>{t(comicGenre(continueReading.comic.genre))}</span><h3>{continueReading.comic.title}</h3>{kidsMode && continueReading.comic.kidsModeApproved && getKidsAgeLabel(continueReading.comic.kidsAgeRange) && <span className="kids-comic-age-badge">{getKidsAgeLabel(continueReading.comic.kidsAgeRange)}</span>}<p>{kidsMode ? `${t("Bagian")} ${continueReading.chapterNumber}` : `${t("Episode")} ${continueReading.chapterNumber}`} · {continueReading.chapterTitle}</p><span className="reader-continue-progress">{t("Terakhir dibaca di halaman")} {continueReading.lastPage}{continueReading.pageCount ? ` ${t("dari")} ${continueReading.pageCount}` : ""}</span>{continueReading.pageCount > 0 && <span className="reader-continue-progressbar" role="progressbar" aria-label={t("Progres membaca")} aria-valuemin={0} aria-valuemax={continueReading.pageCount} aria-valuenow={Math.min(continueReading.pageCount, continueReading.lastPage)}><i style={{ width: `${Math.min(100, (continueReading.lastPage / continueReading.pageCount) * 100)}%` }} /></span>}</div>
              <span className="reader-continue-action">{t("Lanjutkan")} <ArrowRight size={17} /></span>
            </Link>
          </section>
        )}

        <SponsoredAd slotKey="home_banner" placement="home" />

        {!kidsMode && ongoingComics.length > 0 && (
          <section className="reader-home-section">
            <div className="reader-section-heading"><div><p className="reader-section-kicker">{t("SERIAL YANG TERUS BERLANJUT")}</p><h2>{t("Ikuti ceritanya")}</h2></div><a href="#jelajah">{t("Semua komik")} <ArrowUpRight size={16} /></a></div>
            <div className={`reader-comic-rail${ongoingComics.length === 1 ? " reader-ongoing-single" : ""}`}>{ongoingComics.slice(0, 4).map((comic) => <ComicCard key={comic.id} comic={comic} landscapeCard={ongoingComics.length === 1} />)}</div>
          </section>
        )}

        <section className="reader-home-section" id="jelajah">
          <div className="reader-section-heading"><div><p className="reader-section-kicker">{t("JELAJAHI DUNIA CERITA")}</p><h2>{t("Semua komik")}</h2></div><span className="reader-result-count">{searchedComics.length} {t("cerita")}</span></div>
          <div className="reader-discovery-tools" id="genre">
            <div className={`reader-genre-chips${kidsMode ? " reader-genre-chips-kids" : ""}`} role="group" aria-label={t("Saring berdasarkan genre")}>
              {genres.map((item) => {
                const Icon = KIDS_GENRE_ICONS[item] ?? BookOpen;
                return (
                  <button
                    key={item}
                    type="button"
                    data-genre={item}
                    className={`reader-genre-chip${activeGenre === item ? " reader-genre-chip-active" : ""}${kidsMode ? " reader-genre-chip-kids" : ""}`}
                    aria-label={item === "all" ? t("Semua komik") : t(comicGenre(item))}
                    aria-pressed={activeGenre === item}
                    title={item === "all" ? t("Semua komik") : t(comicGenre(item))}
                    onClick={() => { setGenre(item); setComicPage(1); }}
                  >
                    {kidsMode
                      ? <><Icon size={20} aria-hidden="true" /><span>{item === "all" ? t("Semua") : t(comicGenre(item))}</span></>
                      : item === "all" ? t("Semua") : t(comicGenre(item))}
                  </button>
                );
              })}
            </div>
            <p className="reader-genre-scroll-hint">{t("Geser untuk melihat genre lainnya")} <ChevronRight size={14} aria-hidden="true" /></p>
            {settings.feature_flags.search && <div className="reader-mobile-search-inline"><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setComicPage(1); }} placeholder={kidsMode ? t("Cari komik atau genre...") : t("Cari komik, kreator, atau genre...")} aria-label={kidsMode ? t("Cari komik atau genre") : t("Cari komik, kreator, atau genre")} /></div>}
          </div>
          {catalogState === "ready" && searchedComics.length > 0 && <div className="reader-comic-grid">{paginatedComics.map((comic, index) => (
            <Fragment key={comic.id}>
              <ComicCard comic={comic} />
              {pageStartIndex + index === 7 && searchedComics.length > 8 && <SponsoredAd slotKey="catalog_grid_native" placement="catalog" />}
            </Fragment>
          ))}</div>}
          {catalogState === "ready" && searchedComics.length > comicsPerPage && (
            <nav className="reader-catalog-pagination" aria-label="Navigasi halaman komik">
              <span aria-live="polite">{t("Menampilkan")} {pageStartIndex + 1}–{Math.min(pageStartIndex + comicsPerPage, searchedComics.length)} {t("dari")} {searchedComics.length} {t("komik")}</span>
              <div>
                <button type="button" onClick={() => setComicPage(currentComicPage - 1)} disabled={currentComicPage <= 1} aria-label={t("Halaman sebelumnya")}><ChevronLeft size={17} /><span>{t("Sebelumnya")}</span></button>
                <span className="reader-catalog-page-count">{t("Halaman")} {currentComicPage} {t("dari")} {pageCount}</span>
                <button type="button" onClick={() => setComicPage(currentComicPage + 1)} disabled={currentComicPage >= pageCount} aria-label={t("Halaman berikutnya")}><span>{t("Berikutnya")}</span><ChevronRight size={17} /></button>
              </div>
            </nav>
          )}
          {catalogState === "ready" && searchedComics.length === 0 && <div className="reader-empty-state"><p>{kidsMode ? query ? "Komik anak yang cocok belum ditemukan." : "Belum ada komik anak yang disetujui untuk Kids Mode." : query ? "Komik yang kamu cari belum ditemukan." : activeGenre !== "all" ? "Belum ada komik dalam kategori ini." : visibleComics.length === 0 ? "Belum ada komik yang tersedia di perangkat ini." : "Belum ada komik terbit."}</p>{!kidsMode && <button onClick={() => { setGenre("all"); setQuery(""); setComicPage(1); }}>Jelajahi semua komik</button>}</div>}
        </section>

        {!kidsMode && articles.length > 0 && (
          <section className="reader-editorial-callout reader-home-article-quote" aria-labelledby="reader-home-article-title">
            <div className="reader-home-article-main">
              {articles[0].coverUrl && (
                <div className="reader-home-article-cover">
                  <Image src={articles[0].coverUrl} alt={`Cover ${articles[0].title}`} width={720} height={540} sizes="(max-width: 640px) 136px, 180px" unoptimized />
                </div>
              )}
              <div className="reader-home-article-copy">
                <p className="reader-section-kicker">WAWASAN & CERITA · {localizedText(articles[0].category, articles[0].category_en, locale)}</p>
                <h2 id="reader-home-article-title">{localizedText(articles[0].title, articles[0].title_en, locale)}</h2>
                <blockquote>{localizedText(articles[0].excerpt, articles[0].excerpt_en, locale)}</blockquote>
              </div>
            </div>
            <Link className="reader-primary-button" href={`/artikel/${encodeURIComponent(articles[0].slug)}`}>{t("Baca artikel")} <ArrowUpRight size={16} /></Link>
          </section>
        )}
      </div>

      {!kidsMode && <section className="reader-seo-about" aria-labelledby="reader-seo-about-title">
        <header className="reader-seo-about-header">
          <p className="reader-section-kicker">{t("TENTANG MU KOMIK")}</p>
          <h2 id="reader-seo-about-title">{t("Cerita komik Indonesia dari kreator lokal")}</h2>
          <p>{t("MU Komik adalah platform untuk membaca komik Indonesia dan menjelajahi cerita karya kreator lokal. Temukan komik berdasarkan genre, ikuti episode yang terbit, atau mulai berkarya sebagai kreator.")}</p>
        </header>
        <div className="reader-seo-about-grid">
          <article>
            <div className="reader-seo-about-image"><Image src="/genre.png" alt="" fill sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" /></div>
            <h3>{t("Jelajahi beragam genre")}</h3>
            <p>{t("Katalog MU Komik menyediakan penelusuran berdasarkan genre, seperti fantasi, fiksi ilmiah, drama, komedi, aksi, romansa, horor, misteri, dan petualangan. Ketersediaan judul bergantung pada komik yang telah diterbitkan.")}</p>
            <a href="#genre">{t("Jelajahi genre komik")}</a>
          </article>
          <article>
            <div className="reader-seo-about-image"><Image src="/reading.png" alt="" fill sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" /></div>
            <h3>{t("Baca cerita dan episode")}</h3>
            <p>{t("Buka halaman komik untuk membaca sinopsis, melihat informasi cerita, dan menemukan episode yang tersedia. Komik dapat dibaca pada perangkat yang didukung oleh kreatornya.")}</p>
            <a href="#jelajah">{t("Lihat katalog komik")}</a>
          </article>
          <article>
            <div className="reader-seo-about-image"><Image src="/ruang_kreator.png" alt="" fill sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" /></div>
            <h3>{t("Ruang untuk kreator lokal")}</h3>
            <p>{t("Kreator dapat mengajukan akses kreator, menerbitkan komik, dan mengelola episode karyanya. MU Komik juga menjelaskan pandangannya tentang penggunaan AI dalam proses kreatif.")}</p>
            <Link href="/manifesto">{t("Baca manifesto AI MU Komik")}</Link>
          </article>
        </div>
      </section>}

      {!kidsMode && settings.feature_flags.creators && <section className="reader-creator-cta" id="creator">
        <div><p className="reader-section-kicker">{t("PUNYA CERITA?")}</p><h2>{t("Terbitkan komikmu dan temukan pembaca baru.")}</h2></div>
        <Link className="reader-primary-button" href={signedIn ? "/account" : "/login"}>{t("Jadi kreator")} <ArrowRight size={17} /></Link>
      </section>}
      <footer className={`reader-footer${kidsMode ? " reader-footer-kids" : ""}`}>
        {!kidsMode && <div className="reader-footer-main-row">
          <div className="reader-footer-brand">
            <p>{t("Tempat cerita Indonesia menemukan pembacanya.")}</p>
          </div>
          <PlatformLinks includeYoutube />
          <nav className="reader-footer-links" aria-label={t("Tautan footer")}>
            <a href="#jelajah">{t("Jelajah")}</a>
            <a href="#genre">{t("Genre")}</a>
            <a href="#creator">{t("Kreator")}</a>
            <Link href="/artikel">{t("Artikel")}</Link>
          </nav>
          <nav className="reader-footer-links" aria-label={t("Informasi platform")}>
            <Link href="/push-ads">{t("Pasang iklan")}</Link>
            <Link href="/manifesto">Manifesto AI</Link>
            <Link href="/syarat-ketentuan">{t("Syarat layanan")}</Link>
            <Link href="/faq">{t("FAQ & Glosarium")}</Link>
          </nav>
        </div>}
        <div className="reader-footer-bottom">
          <BrandLogo className="wordmark reader-wordmark" />
          <span>© 2026 mu-komik</span>
        </div>
      </footer>
    </main>
  );
}
