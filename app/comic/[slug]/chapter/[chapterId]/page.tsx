"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronLeft, ChevronRight, List, LoaderCircle, Maximize2, Minimize2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Page = { id: string; page_number: number; object_key: string };
type Chapter = { id: string; title: string; chapter_number: number; comic_id: string };
type Comic = { title: string; slug: string };

export default function ChapterReaderPage() {
  const { slug, chapterId } = useParams<{ slug: string; chapterId: string }>();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [comic, setComic] = useState<Comic | null>(null);
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [pageLoadError, setPageLoadError] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  useEffect(() => {
    let active = true;
    const loadChapter = async () => {
      setLoading(true);
      setErrorMessage("");
      setHistoryReady(false);
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

      const [{ data: pageData, error: pageError }, { data: chapters, error: chaptersError }, { data: sessionData, error: sessionError }] = await Promise.all([
        supabase.from("pages").select("id, page_number, object_key").eq("chapter_id", chapterId).order("page_number"),
        supabase.from("chapters").select("id, title, chapter_number, comic_id").eq("comic_id", chapterData.comic_id).not("published_at", "is", null).order("chapter_number"),
        supabase.auth.getSession(),
      ]);
      if (pageError) console.error("Unable to load episode pages:", pageError);
      if (chaptersError) console.error("Unable to load comic episode navigation:", chaptersError);
      if (sessionError) console.error("Unable to check the current auth session:", sessionError);
      if (!active) return;

      setChapter(chapterData);
      setComic(comicData);
      setPages(pageData ?? []);
      setPageLoadError(Boolean(pageError));
      setChapterList(chapters ?? []);
      setUserId(sessionData.session?.user.id ?? null);

      if (sessionData.session?.user && pageData?.length) {
        const { data: history, error: historyError } = await supabase
          .from("reading_history")
          .select("last_page")
          .eq("user_id", sessionData.session.user.id)
          .eq("chapter_id", chapterId)
          .maybeSingle();
        if (historyError) console.error("Unable to load saved reading progress:", historyError);
        if (!historyError && history) {
          const resumePage = Math.max(0, Math.min(pageData.length - 1, history.last_page - 1));
          setCurrentPage(resumePage);
          window.requestAnimationFrame(() => {
            document.querySelector(`[data-reader-page="${resumePage}"]`)?.scrollIntoView({ block: "start" });
          });
        }
      }
      setHistoryReady(true);
      setLoading(false);
    };
    void loadChapter();
    return () => { active = false; };
  }, [chapterId, slug]);

  useEffect(() => {
    if (loading || !pages.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visiblePage = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      const index = Number(visiblePage?.target.getAttribute("data-reader-page"));
      if (Number.isInteger(index)) setCurrentPage(index);
    }, { threshold: [0.05, 0.1, 0.25, 0.5, 0.75] });
    document.querySelectorAll("[data-reader-page]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [loading, pages]);

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

  const scrollToPage = (index: number) => {
    const targetIndex = Math.max(0, Math.min(pages.length - 1, index));
    setCurrentPage(targetIndex);
    document.querySelector(`[data-reader-page="${targetIndex}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) return <main className="reader-loading"><LoaderCircle className="spin" size={25} /><span>Menyiapkan halaman komik...</span></main>;
  if (!chapter || !comic) {
    return <main className="reader-loading reader-error"><p>{errorMessage || "Episode tidak dapat dibuka."}</p><Link href={comic ? `/comic/${comic.slug}` : "/"}><ArrowLeft size={16} /> {comic ? "Kembali ke komik" : "Ke beranda"}</Link></main>;
  }

  const chapterIndex = chapterList.findIndex((item) => item.id === chapter.id);
  const previousChapter = chapterIndex > 0 ? chapterList[chapterIndex - 1] : null;
  const nextChapter = chapterIndex >= 0 && chapterIndex < chapterList.length - 1 ? chapterList[chapterIndex + 1] : null;
  const pageUrl = (page: Page) => publicUrl ? `${publicUrl.replace(/\/$/, "")}/${page.object_key}` : null;

  return (
    <main className={`reader-experience${controlsVisible ? "" : " reader-controls-hidden"}`}>
      <header className="reader-experience-header">
        <Link className="reader-experience-back" href={`/comic/${comic.slug}`} aria-label="Kembali ke detail komik"><ArrowLeft size={19} /><span>{comic.title}</span></Link>
        <div className="reader-experience-chapter"><span>Episode {chapter.chapter_number}</span><strong>{chapter.title}</strong></div>
        <details className="reader-episode-menu">
          <summary aria-label="Daftar episode"><List size={19} /><ChevronDown size={14} /></summary>
          <div className="reader-episode-menu-popover">
            <p>Daftar episode</p>
            {chapterList.map((item) => <Link className={item.id === chapter.id ? "reader-menu-current" : ""} key={item.id} href={`/comic/${comic.slug}/chapter/${item.id}`}>Episode {item.chapter_number} · {item.title}</Link>)}
          </div>
        </details>
      </header>

      <div className="reader-progress-track" role="progressbar" aria-label="Progres membaca" aria-valuemin={0} aria-valuemax={pages.length} aria-valuenow={pages.length ? currentPage + 1 : 0}>
        <span style={{ width: pages.length ? `${((currentPage + 1) / pages.length) * 100}%` : "0%" }} />
      </div>

      {pages.length ? (
        <section className="reader-vertical-pages" aria-label={`${chapter.title}, ${pages.length} halaman`}>
          {pages.map((page, index) => {
            const src = pageUrl(page);
            return (
              <div className="reader-page-frame" data-reader-page={index} key={page.id}>
                {src
                  ? <img src={src} alt={`${comic.title}, episode ${chapter.chapter_number}, halaman ${page.page_number}`} loading={index < 2 ? "eager" : "lazy"} onClick={() => setControlsVisible(true)} />
                  : <div className="reader-image-error">Alamat media komik belum dikonfigurasi.</div>}
              </div>
            );
          })}
        </section>
      ) : (
        <section className="reader-no-pages"><BookOpen size={28} /><h1>{pageLoadError ? "Halaman komik belum dapat dimuat." : "Episode ini belum memiliki halaman."}</h1><p>{pageLoadError ? "Periksa koneksi lalu muat ulang episode ini." : "Kembali lagi nanti untuk membaca cerita ini."}</p>{pageLoadError ? <button onClick={() => window.location.reload()}>Coba lagi</button> : <Link href={`/comic/${comic.slug}`}>Kembali ke komik</Link>}</section>
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
