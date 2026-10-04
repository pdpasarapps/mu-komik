"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, List, LoaderCircle, LockKeyhole, Maximize2, Minimize2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Page = { id: string; page_number: number; object_key: string };
type Chapter = { id: string; title: string; chapter_number: number; comic_id: string };
type Comic = { title: string; slug: string };
export type ChapterReaderSeed = { chapter: Chapter; comic: Comic };

export default function ChapterReaderPage({ seed }: { seed: ChapterReaderSeed }) {
  const { slug, chapterId } = useParams<{ slug: string; chapterId: string }>();
  const router = useRouter();
  const [chapter, setChapter] = useState<Chapter | null>(seed.chapter);
  const [comic, setComic] = useState<Comic | null>(seed.comic);
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [firstIncompleteChapterIndex, setFirstIncompleteChapterIndex] = useState(-1);
  const [allChaptersRead, setAllChaptersRead] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [readPageIds, setReadPageIds] = useState<Set<string>>(() => new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [pageLoadError, setPageLoadError] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const pagesContainerRef = useRef<HTMLElement>(null);
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  useEffect(() => {
    let active = true;
    const loadChapter = async () => {
      setLoading(true);
      setErrorMessage("");
      setHistoryReady(false);
      setReadPageIds(new Set());
      const { data: chapterData, error: chapterError } = await supabase
        .from("chapters")
        .select("id, title, chapter_number, comic_id")
        .eq("id", chapterId)
        .maybeSingle();
      if (chapterError || !chapterData) {
        if (chapterError) console.error("Unable to load reader episode:", chapterError);
        if (active) {
          setErrorMessage(chapterError ? "Episode belum dapat dimuat. Periksa koneksi lalu coba lagi." : "Episode tidak ditemukan.");
          setLoading(false);
        }
        return;
      }
      const { data: comicData, error: comicError } = await supabase
        .from("comics")
        .select("title, slug")
        .eq("id", chapterData.comic_id)
        .eq("slug", slug)
        .maybeSingle();
      if (comicError || !comicData) {
        if (comicError) console.error("Unable to load the reader comic:", comicError);
        if (active) {
          setErrorMessage(comicError ? "Komik belum dapat dimuat. Periksa koneksi lalu coba lagi." : "Episode ini bukan bagian dari komik tersebut.");
          setLoading(false);
        }
        return;
      }

      const [{ data: chapters, error: chaptersError }, { data: sessionData, error: sessionError }] = await Promise.all([
        supabase.from("chapters").select("id, title, chapter_number, comic_id").eq("comic_id", chapterData.comic_id).not("published_at", "is", null).order("chapter_number"),
        supabase.auth.getSession(),
      ]);
      if (chaptersError) console.error("Unable to load comic episode navigation:", chaptersError);
      if (sessionError) console.error("Unable to check the current auth session:", sessionError);
      if (!active) return;
      if (sessionError) {
        setComic(comicData);
        setErrorMessage("Urutan episode belum dapat diverifikasi. Periksa koneksi lalu coba lagi.");
        setLoading(false);
        return;
      }

      if (chaptersError || !chapters?.length) {
        if (active) {
          setComic(comicData);
          setErrorMessage("Urutan episode belum dapat diverifikasi. Periksa koneksi lalu coba lagi.");
          setLoading(false);
        }
        return;
      }

      const targetChapterIndex = chapters.findIndex((item) => item.id === chapterId);
      if (targetChapterIndex < 0) {
        if (active) {
          setComic(comicData);
          setErrorMessage("Episode ini belum diterbitkan atau bukan bagian dari daftar episode.");
          setLoading(false);
        }
        return;
      }

      const chapterIds = chapters.map((item) => item.id);
      const currentUserId = sessionData.session?.user.id ?? null;
      const [{ data: allPageData, error: allPagesError }, { data: history, error: historyError }] = await Promise.all([
        supabase.from("pages").select("id, chapter_id, page_number, object_key").in("chapter_id", chapterIds).order("page_number"),
        currentUserId
          ? supabase.from("reading_history").select("chapter_id, last_page").eq("user_id", currentUserId).in("chapter_id", chapterIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (allPagesError) console.error("Unable to verify episode reading order:", allPagesError);
      if (historyError) console.error("Unable to load episode reading progress:", historyError);
      if (!active) return;
      if (allPagesError || historyError) {
        setComic(comicData);
        setErrorMessage("Urutan episode belum dapat diverifikasi. Periksa koneksi lalu coba lagi.");
        setLoading(false);
        return;
      }

      const pagesByChapter = new Map<string, Page[]>();
      for (const page of allPageData ?? []) {
        const chapterPages = pagesByChapter.get(page.chapter_id) ?? [];
        chapterPages.push({ id: page.id, page_number: page.page_number, object_key: page.object_key });
        pagesByChapter.set(page.chapter_id, chapterPages);
      }
      const historyByChapter = new Map<string, number>();
      for (const entry of history ?? []) historyByChapter.set(entry.chapter_id, entry.last_page);

      const savedPagesByChapter = new Map<string, Set<string>>();
      for (const item of chapters) {
        const chapterPages = pagesByChapter.get(item.id) ?? [];
        const pageIds = new Set(chapterPages.map((page) => page.id));
        const savedPages = new Set<string>();
        try {
          const storedPages = localStorage.getItem(`mu-komik:read-pages:${item.id}`);
          const parsedPages: unknown = storedPages ? JSON.parse(storedPages) : [];
          if (Array.isArray(parsedPages)) {
            parsedPages.forEach((pageId) => {
              if (typeof pageId === "string" && pageIds.has(pageId)) savedPages.add(pageId);
            });
          }
        } catch (error) {
          console.error("Unable to restore read page markers:", error);
        }
        chapterPages.slice(0, historyByChapter.get(item.id) ?? 0).forEach((page) => savedPages.add(page.id));
        savedPagesByChapter.set(item.id, savedPages);
      }

      const firstIncompleteIndex = chapters.findIndex((item) => {
        const chapterPages = pagesByChapter.get(item.id) ?? [];
        return chapterPages.length === 0 || (savedPagesByChapter.get(item.id)?.size ?? 0) < chapterPages.length;
      });
      const completedEveryChapter = firstIncompleteIndex < 0;
      if (!completedEveryChapter && targetChapterIndex > firstIncompleteIndex) {
        const firstIncompleteChapter = chapters[firstIncompleteIndex];
        router.replace(`/comic/${comicData.slug}/chapter/${firstIncompleteChapter.id}`);
        return;
      }

      const pageData = pagesByChapter.get(chapterId) ?? [];
      const savedReadPages = savedPagesByChapter.get(chapterId) ?? new Set<string>();
      const savedLastPage = historyByChapter.get(chapterId);
      const resumePage = savedLastPage
        ? Math.max(0, Math.min(pageData.length - 1, savedLastPage - 1))
        : -1;

      setChapter(chapterData);
      setComic(comicData);
      setPages(pageData);
      setPageLoadError(false);
      setChapterList(chapters);
      setFirstIncompleteChapterIndex(firstIncompleteIndex);
      setAllChaptersRead(completedEveryChapter);
      setUserId(currentUserId);
      if (resumePage >= 0) {
        setCurrentPage(resumePage);
        window.requestAnimationFrame(() => {
          document.querySelector(`[data-reader-page="${resumePage}"]`)?.scrollIntoView({ block: "start" });
        });
      } else {
        setCurrentPage(0);
      }
      setReadPageIds(savedReadPages);
      setHistoryReady(true);
      setLoading(false);
    };
    void loadChapter();
    return () => { active = false; };
  }, [chapterId, router, slug]);

  useEffect(() => {
    if (loading || !chapter || !pages.length) return;
    let active = true;
    const recordChapterView = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) console.error("Unable to check auth before recording a chapter view:", sessionError);
        if (!active) return;
        const response = await fetch("/api/analytics/chapter-view", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
          },
          body: JSON.stringify({ chapterId: chapter.id }),
          cache: "no-store",
        });
        if (!response.ok) {
          console.error("Unable to record chapter view:", { status: response.status });
        }
      } catch (error) {
        console.error("Unable to record chapter view:", error);
      }
    };
    void recordChapterView();
    return () => { active = false; };
  }, [chapter, loading, pages.length]);

  useEffect(() => {
    if (loading || !pages.length) return;
    const visibleRatios = new Map<Element, number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleRatios.set(entry.target, entry.intersectionRatio);
        else visibleRatios.delete(entry.target);
      }
      const visiblePage = [...visibleRatios.entries()]
        .sort((left, right) => right[1] - left[1])[0]?.[0];
      const index = Number(visiblePage?.getAttribute("data-reader-page"));
      if (Number.isInteger(index)) {
        setCurrentPage(index);
        const pageId = pages[index]?.id;
        if (pageId) {
          setReadPageIds((current) => {
            if (current.has(pageId)) return current;
            return new Set(current).add(pageId);
          });
        }
      }
    }, { threshold: [0.05, 0.1, 0.25, 0.5, 0.75] });
    document.querySelectorAll("[data-reader-page]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [loading, pages]);

  useEffect(() => {
    if (!chapter || readPageIds.size === 0) return;
    try {
      localStorage.setItem(`mu-komik:read-pages:${chapter.id}`, JSON.stringify([...readPageIds]));
    } catch (error) {
      console.error("Unable to save read page markers:", error);
    }
  }, [chapter, readPageIds]);

  useEffect(() => {
    if (loading || !pages.length) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setControlsVisible(false);
        return;
      }
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const target = event.target;
      if (target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      event.preventDefault();
      setControlsVisible(true);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const targetIndex = Math.max(0, Math.min(pages.length - 1, currentPage + direction));
      document.querySelector(`[data-reader-page="${targetIndex}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [currentPage, loading, pages.length]);

  useEffect(() => {
    if (loading || !pages.length) return;
    lastScrollY.current = window.scrollY;
    let animationFrame = 0;
    const handleScroll = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const scrollDelta = currentScrollY - lastScrollY.current;
        if (currentScrollY < 90 || scrollDelta < -8) {
          setControlsVisible(true);
        } else if (scrollDelta > 8) {
          setControlsVisible(false);
        }
        lastScrollY.current = currentScrollY;
        animationFrame = 0;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [loading, pages.length]);

  useEffect(() => {
    if (!userId || !historyReady || !chapter || !pages.length) return;
    const timer = window.setTimeout(async () => {
      const { error } = await supabase.from("reading_history").upsert({
        user_id: userId,
        chapter_id: chapter.id,
        last_page: currentPage + 1,
        updated_at: new Date().toISOString(),
      });
      if (error) console.error("Unable to save reading progress:", error);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [chapter, currentPage, historyReady, pages.length, userId]);

  const scrollToPage = useCallback((index: number) => {
    const targetIndex = Math.max(0, Math.min(pages.length - 1, index));
    setCurrentPage(targetIndex);
    document.querySelector(`[data-reader-page="${targetIndex}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pages.length]);

  useEffect(() => {
    if (loading || !pages.length) return;
    const pagesContainer = pagesContainerRef.current;
    if (!pagesContainer) return;
    let start: { x: number; y: number; pageIndex: number } | null = null;
    const handleTouchStart = (event: globalThis.TouchEvent) => {
      if (event.touches.length !== 1 || !(event.target instanceof Element)) {
        start = null;
        return;
      }
      const frame = event.target.closest<HTMLElement>("[data-reader-page]");
      const pageIndex = Number(frame?.dataset.readerPage);
      if (!Number.isInteger(pageIndex)) {
        start = null;
        return;
      }
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY, pageIndex };
    };
    const handleTouchMove = (event: globalThis.TouchEvent) => {
      if (!start || event.touches.length !== 1) return;
      const deltaX = event.touches[0].clientX - start.x;
      const deltaY = start.y - event.touches[0].clientY;
      if (Math.abs(deltaY) >= 55 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2 && event.cancelable) {
        event.preventDefault();
      }
    };
    const handleTouchEnd = (event: globalThis.TouchEvent) => {
      const touchStart = start;
      start = null;
      if (!touchStart || event.changedTouches.length !== 1) return;
      const deltaX = event.changedTouches[0].clientX - touchStart.x;
      const deltaY = touchStart.y - event.changedTouches[0].clientY;
      if (Math.abs(deltaY) < 55 || Math.abs(deltaY) <= Math.abs(deltaX) * 1.2) return;
      const targetIndex = Math.max(0, Math.min(pages.length - 1, touchStart.pageIndex + (deltaY > 0 ? 1 : -1)));
      if (targetIndex !== touchStart.pageIndex) scrollToPage(targetIndex);
    };
    const handleTouchCancel = () => { start = null; };
    pagesContainer.addEventListener("touchstart", handleTouchStart, { passive: true });
    pagesContainer.addEventListener("touchmove", handleTouchMove, { passive: false });
    pagesContainer.addEventListener("touchend", handleTouchEnd);
    pagesContainer.addEventListener("touchcancel", handleTouchCancel);
    return () => {
      pagesContainer.removeEventListener("touchstart", handleTouchStart);
      pagesContainer.removeEventListener("touchmove", handleTouchMove);
      pagesContainer.removeEventListener("touchend", handleTouchEnd);
      pagesContainer.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [loading, pages.length, scrollToPage]);

  if (loading) return (
    <main className="reader-loading">
      <h1>{comic?.title} Episode {chapter?.chapter_number}: {chapter?.title}</h1>
      <LoaderCircle className="spin" size={25} />
      <span>Menyiapkan halaman komik...</span>
    </main>
  );
  if (!chapter || !comic) {
    return <main className="reader-loading reader-error"><p>{errorMessage || "Episode tidak dapat dibuka."}</p><Link href={comic ? `/comic/${comic.slug}` : "/"}><ArrowLeft size={16} /> {comic ? "Kembali ke komik" : "Ke beranda"}</Link></main>;
  }

  const chapterIndex = chapterList.findIndex((item) => item.id === chapter.id);
  const previousChapter = chapterIndex > 0 ? chapterList[chapterIndex - 1] : null;
  const nextChapterCandidate = chapterIndex >= 0 && chapterIndex < chapterList.length - 1 ? chapterList[chapterIndex + 1] : null;
  const currentChapterRead = pages.length > 0 && readPageIds.size >= pages.length;
  const nextChapterUnlocked = Boolean(
    nextChapterCandidate &&
    (allChaptersRead ||
      chapterIndex + 1 <= firstIncompleteChapterIndex ||
      (chapterIndex === firstIncompleteChapterIndex && currentChapterRead)),
  );
  const nextChapter = nextChapterUnlocked ? nextChapterCandidate : null;
  const pageUrl = (page: Page) => publicUrl ? `${publicUrl.replace(/\/$/, "")}/${page.object_key}` : null;

  return (
    <main
      className={`reader-experience${controlsVisible ? "" : " reader-controls-hidden"}`}
      onPointerDown={(event) => {
        if (!controlsVisible && !(event.target instanceof Element && event.target.closest("a, button, summary"))) {
          setControlsVisible(true);
        }
      }}
    >
      <header className="reader-experience-header">
        <Link className="reader-experience-back" href={`/comic/${comic.slug}`} aria-label="Kembali ke detail komik"><ArrowLeft size={19} /><span>{comic.title}</span></Link>
        <div className="reader-experience-chapter"><span>Episode {chapter.chapter_number}</span><strong>{chapter.title}</strong></div>
        <details className="reader-episode-menu">
          <summary aria-label="Daftar episode"><List size={19} /><ChevronDown size={14} /></summary>
          <div className="reader-episode-menu-popover">
            <p>Daftar episode</p>
            {chapterList.map((item, index) => {
              const unlocked = allChaptersRead || index <= firstIncompleteChapterIndex || (index === firstIncompleteChapterIndex + 1 && chapterIndex === firstIncompleteChapterIndex && currentChapterRead);
              return unlocked
                ? <Link className={item.id === chapter.id ? "reader-menu-current" : ""} key={item.id} href={`/comic/${comic.slug}/chapter/${item.id}`}>Episode {item.chapter_number} · {item.title}</Link>
                : <span className="reader-menu-locked" key={item.id}><LockKeyhole size={13} /> Episode {item.chapter_number} · {item.title}</span>;
            })}
          </div>
        </details>
      </header>
      <h1 className="reader-sr-only">{comic.title} Episode {chapter.chapter_number}: {chapter.title}</h1>

      <div className="reader-progress-track" role="progressbar" aria-label="Progres membaca" aria-valuemin={0} aria-valuemax={pages.length} aria-valuenow={pages.length ? currentPage + 1 : 0}>
        <span style={{ width: pages.length ? `${((currentPage + 1) / pages.length) * 100}%` : "0%" }} />
      </div>

      {pages.length ? (
        <section
          ref={pagesContainerRef}
          className="reader-vertical-pages"
          aria-label={`${chapter.title}, ${pages.length} halaman`}
        >
          {pages.map((page, index) => {
            const src = pageUrl(page);
            const pageIsRead = readPageIds.has(page.id);
            return (
              <div
                className="reader-page-frame"
                data-reader-page={index}
                key={page.id}
                aria-label={`Halaman ${page.page_number}, ${pageIsRead ? "sudah dibaca" : "belum dibaca"}`}
              >
                <span className={`reader-page-read-status${pageIsRead ? " reader-page-read-status-read" : ""}`} role="img" aria-label={pageIsRead ? "Sudah dibaca" : "Belum dibaca"}>
                  {pageIsRead ? <Check size={14} strokeWidth={3} /> : <Circle size={12} />}
                  <span>{pageIsRead ? "Dibaca" : "Belum dibaca"}</span>
                </span>
                {src
                  ? <img src={src} alt={`${comic.title}, episode ${chapter.chapter_number}, halaman ${page.page_number}`} loading={index < 2 ? "eager" : "lazy"} onClick={() => setControlsVisible(true)} />
                  : <div className="reader-image-error">Alamat media komik belum dikonfigurasi.</div>}
              </div>
            );
          })}
        </section>
      ) : (
        <section className="reader-no-pages"><BookOpen size={28} /><h2>{pageLoadError ? "Halaman komik belum dapat dimuat." : "Episode ini belum memiliki halaman."}</h2><p>{pageLoadError ? "Periksa koneksi lalu muat ulang episode ini." : "Kembali lagi nanti untuk membaca cerita ini."}</p>{pageLoadError ? <button onClick={() => window.location.reload()}>Coba lagi</button> : <Link href={`/comic/${comic.slug}`}>Kembali ke komik</Link>}</section>
      )}

      {pages.length > 0 && (
        <section className="reader-episode-end" aria-labelledby="reader-episode-end-title">
          <span className="reader-episode-end-kicker">EPISODE SELESAI</span>
          <h2 id="reader-episode-end-title">Sampai di sini untuk episode ini.</h2>
          <p>{nextChapter ? "Lanjutkan petualangannya di episode berikutnya." : nextChapterCandidate ? "Selesaikan semua halaman untuk membuka episode berikutnya." : "Kamu sudah membaca episode terbaru dari komik ini."}</p>
          <div className="reader-episode-end-actions">
            {previousChapter && <Link className="reader-episode-secondary-action" href={`/comic/${comic.slug}/chapter/${previousChapter.id}`}><ChevronLeft size={17} /> Episode sebelumnya</Link>}
            {nextChapter
              ? <Link className="reader-episode-next-action" href={`/comic/${comic.slug}/chapter/${nextChapter.id}`}>Baca episode berikutnya <ArrowRight size={18} /></Link>
              : nextChapterCandidate
                ? <span className="reader-episode-latest-label"><LockKeyhole size={15} /> Selesaikan episode ini untuk lanjut</span>
                : <span className="reader-episode-latest-label">Ini adalah episode terbaru</span>}
            <Link className="reader-episode-secondary-action" href={`/comic/${comic.slug}`}><BookOpen size={17} /> Kembali ke komik</Link>
          </div>
        </section>
      )}

      <button className="reader-controls-toggle" onClick={() => setControlsVisible((visible) => !visible)} aria-label={controlsVisible ? "Sembunyikan kontrol" : "Tampilkan kontrol"}>
        {controlsVisible ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>

      {controlsVisible && pages.length > 0 && (
        <footer className="reader-experience-controls">
          <button onClick={() => scrollToPage(currentPage - 1)} disabled={currentPage <= 0} aria-label="Halaman sebelumnya"><ChevronLeft size={20} /><span>Sebelumnya</span></button>
          <span className="reader-page-count">{currentPage + 1} <i>/</i> {pages.length}</span>
          {currentPage < pages.length - 1
            ? <button onClick={() => scrollToPage(currentPage + 1)} aria-label="Halaman berikutnya"><span>Berikutnya</span><ChevronRight size={20} /></button>
            : nextChapter
              ? <Link href={`/comic/${comic.slug}/chapter/${nextChapter.id}`}><span>Episode selanjutnya</span><ArrowRight size={19} /></Link>
              : <Link href={`/comic/${comic.slug}`}><span>Daftar episode</span><BookOpen size={18} /></Link>}
        </footer>
      )}

      {(previousChapter || nextChapter) && <nav className="reader-chapter-navigation" aria-label="Navigasi episode">
        {previousChapter
          ? <Link href={`/comic/${comic.slug}/chapter/${previousChapter.id}`}><ChevronLeft size={17} /> Episode sebelumnya</Link>
          : <span />}
        {nextChapter && <Link href={`/comic/${comic.slug}/chapter/${nextChapter.id}`}>Episode selanjutnya <ChevronRight size={17} /></Link>}
      </nav>}
    </main>
  );
}
