"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, CalendarDays, CheckCircle2, CircleDot, Copy, ExternalLink, LoaderCircle, LockKeyhole, Share2, X } from "lucide-react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { getComicGenreLabel } from "@/lib/comic-genres";

const supabase = createClient();

type Comic = {
  id: string;
  title: string;
  slug: string;
  synopsis: string;
  contributor: string;
  genre: string;
  cover_key: string | null;
  profiles: { display_name: string } | { display_name: string }[] | null;
};

type Chapter = { id: string; title: string; chapter_number: number; published_at: string | null };
type ChapterReadStatus = "accessed" | "read";

function cleanSynopsis(synopsis: string) {
  return synopsis.replace(/\*\*/g, "").replace(/👉/g, "").replace(/\n+/g, " ").trim();
}

export default function ComicDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [comic, setComic] = useState<Comic | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterReadStatuses, setChapterReadStatuses] = useState<Record<string, ChapterReadStatus>>({});
  const [chapterProgressReady, setChapterProgressReady] = useState(false);
  const [chapterProgressError, setChapterProgressError] = useState(false);
  const [episodeSnackbar, setEpisodeSnackbar] = useState("");
  const [lastReadChapterId, setLastReadChapterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [chapterLoadError, setChapterLoadError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [bookmarkMessage, setBookmarkMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareCover, setShareCover] = useState<{ coverKey: string; file: File } | null>(null);
  const shareUrlRef = useRef<HTMLTextAreaElement>(null);
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  useEffect(() => {
    if (!episodeSnackbar) return;
    const timeout = window.setTimeout(() => setEpisodeSnackbar(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [episodeSnackbar]);

  useEffect(() => {
    let active = true;
    const loadComic = async () => {
      setLoading(true);
      setLoadError("");
      const { data, error } = await supabase
        .from("comics")
        .select("id, title, slug, synopsis, contributor, genre, cover_key, profiles!comics_creator_id_fkey(display_name)")
        .eq("slug", slug)
        .single();
      if (error || !data) {
        if (error) console.error("Unable to load comic details:", error);
        if (active) {
          setLoadError(error ? "Komik belum dapat dimuat. Periksa koneksi lalu coba lagi." : "");
          setComic(null);
          setLoading(false);
        }
        return;
      }

      const { data: chapterData, error: chapterError } = await supabase
        .from("chapters")
        .select("id, title, chapter_number, published_at")
        .eq("comic_id", data.id)
        .not("published_at", "is", null)
        .order("chapter_number", { ascending: true });
      if (chapterError) console.error("Unable to load comic episodes:", chapterError);
      if (active) {
        setChapterLoadError(Boolean(chapterError));
        setChapterReadStatuses({});
        setChapterProgressReady(false);
        setChapterProgressError(false);
      }

      if (active) {
        setComic(data as Comic);
        setChapters(chapterData ?? []);
        setLoading(false);
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) console.error("Unable to check the current auth session:", sessionError);
      const currentUserId = sessionData.session?.user.id ?? null;
      if (active) setUserId(currentUserId);
      if (active && sessionError) setChapterProgressError(true);
      if (currentUserId) {
        const { data: bookmark, error: bookmarkError } = await supabase
          .from("bookmarks")
          .select("comic_id")
          .eq("user_id", currentUserId)
          .eq("comic_id", data.id)
          .maybeSingle();
        if (bookmarkError) {
          console.error("Unable to load comic bookmark:", bookmarkError);
          if (active) setBookmarkMessage("Favorit belum dapat dimuat. Coba lagi sebentar.");
        } else if (active) {
          setIsBookmarked(Boolean(bookmark));
        }
      } else if (active) {
        setIsBookmarked(false);
      }

      if (chapterData?.length) {
        const chapterIds = chapterData.map((chapter) => chapter.id);
        const { data: pageData, error: pageError } = await supabase
          .from("pages")
          .select("id, chapter_id")
          .in("chapter_id", chapterIds);
        if (pageError) console.error("Unable to load episode page counts:", pageError);

        const pageIdsByChapter = new Map<string, string[]>();
        for (const page of pageData ?? []) {
          const pageIds = pageIdsByChapter.get(page.chapter_id) ?? [];
          pageIds.push(page.id);
          pageIdsByChapter.set(page.chapter_id, pageIds);
        }

        const historyByChapter = new Map<string, number>();
        if (currentUserId) {
          const { data: history, error: historyError } = await supabase
            .from("reading_history")
            .select("chapter_id, last_page, updated_at")
            .eq("user_id", currentUserId)
            .in("chapter_id", chapterIds);
          if (historyError) console.error("Unable to load comic reading progress:", historyError);
          else {
            for (const entry of history ?? []) historyByChapter.set(entry.chapter_id, entry.last_page);
            if (active) {
              const latest = [...(history ?? [])].sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0];
              setLastReadChapterId(latest?.chapter_id ?? null);
            }
          }
          if (active && (historyError || pageError)) setChapterProgressError(true);
        } else if (active) {
          setLastReadChapterId(null);
          if (pageError) setChapterProgressError(true);
        }

        const statuses: Record<string, ChapterReadStatus> = {};
        for (const chapter of chapterData) {
          const pageIds = pageIdsByChapter.get(chapter.id) ?? [];
          const pageIdSet = new Set(pageIds);
          const readPageIds = new Set<string>();
          try {
            const storedPages = localStorage.getItem(`mu-komik:read-pages:${chapter.id}`);
            const parsedPages: unknown = storedPages ? JSON.parse(storedPages) : [];
            if (Array.isArray(parsedPages)) {
              parsedPages.forEach((pageId) => {
                if (typeof pageId === "string" && pageIdSet.has(pageId)) readPageIds.add(pageId);
              });
            }
          } catch (storageError) {
            console.error("Unable to load saved episode page markers:", storageError);
          }

          const lastPage = historyByChapter.get(chapter.id) ?? 0;
          pageIds.slice(0, lastPage).forEach((pageId) => readPageIds.add(pageId));
          if (readPageIds.size > 0 || lastPage > 0) {
            statuses[chapter.id] = pageIds.length > 0 && readPageIds.size >= pageIds.length ? "read" : "accessed";
          }
        }
        if (active) {
          setChapterReadStatuses(statuses);
          setChapterProgressReady(true);
        }
      } else if (active) {
        setChapterProgressReady(true);
      }
    };
    void loadComic();
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!comic?.cover_key || !publicUrl) return;
    const coverKey = comic.cover_key;
    const controller = new AbortController();
    const imageUrl = `/api/share-cover?key=${encodeURIComponent(coverKey)}`;
    void fetch(imageUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Cover request failed with status ${response.status}.`);
        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) throw new Error("Comic cover response is not an image.");
        const filename = coverKey.split("/").pop() || `${comic.slug}-cover`;
        setShareCover({ coverKey, file: new File([blob], filename, { type: blob.type }) });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setShareCover((current) => current?.coverKey === coverKey ? current : null);
      });
    return () => controller.abort();
  }, [comic?.cover_key, comic?.slug, publicUrl]);

  const toggleBookmark = async () => {
    if (!comic || !userId || bookmarkBusy) return;
    setBookmarkBusy(true);
    setBookmarkMessage("");
    const result = isBookmarked
      ? await supabase.from("bookmarks").delete().eq("user_id", userId).eq("comic_id", comic.id)
      : await supabase.from("bookmarks").insert({ user_id: userId, comic_id: comic.id });
    if (result.error) {
      console.error("Unable to update comic bookmark:", result.error);
      setBookmarkMessage(result.error.code === "23502" || result.error.code === "23505"
        ? "Favorit belum tersedia. Admin perlu menjalankan supabase/comic-bookmarks.sql."
        : "Favorit belum dapat diperbarui. Coba lagi sebentar.");
    } else {
      setIsBookmarked(!isBookmarked);
      setBookmarkMessage(isBookmarked ? "Komik dihapus dari favorit." : "Komik disimpan ke favorit.");
    }
    setBookmarkBusy(false);
  };

  const shareComic = async () => {
    setShareMessage("");
    const url = window.location.href;
    setShareUrl(url);
    if (navigator.share) {
      try {
        const synopsis = comic ? cleanSynopsis(comic.synopsis) : "";
        const shareText = [synopsis, `Baca ${comic?.title} di mu-komik`].filter(Boolean).join("\n\n");
        const shareData: ShareData = { title: comic?.title, text: shareText, url };
        const coverFile = shareCover && comic?.cover_key === shareCover.coverKey ? shareCover.file : null;
        if (coverFile && navigator.canShare?.({ files: [coverFile] })) {
          shareData.files = [coverFile];
        }
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Unable to open the native share dialog:", error);
      }
    }
    setShareDialogOpen(true);
  };

  const copyShareUrl = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage("Tautan komik berhasil disalin.");
        setShareDialogOpen(false);
        return;
      }
    } catch (error) {
      console.error("Clipboard API could not copy the comic link:", error);
    }
    shareUrlRef.current?.focus();
    shareUrlRef.current?.select();
    setShareMessage("Tautan dipilih. Salin dengan menekan Ctrl+C atau tahan lalu pilih Salin.");
  };

  if (loading) return <main className="reader-detail-page"><div className="reader-detail-loading"><LoaderCircle className="spin" size={25} /><span>Menyiapkan ceritamu...</span></div></main>;
  if (!comic) {
    return (
      <main className="reader-detail-page">
        <nav className="reader-subnav"><Link className="wordmark reader-wordmark" href="/"><span className="wordmark-dot" />mu<span>komik</span></Link><Link className="reader-back-link" href="/"><ArrowLeft size={17} /> Jelajahi komik</Link></nav>
        <div className="reader-detail-not-found"><h1>{loadError ? "Komik belum bisa dibuka." : "Komik tidak ditemukan."}</h1><p>{loadError || "Cerita ini mungkin telah dipindahkan atau belum diterbitkan."}</p><Link className="reader-primary-button" href="/">Kembali ke beranda <ArrowRight size={17} /></Link></div>
      </main>
    );
  }

  const creator = Array.isArray(comic.profiles) ? comic.profiles[0]?.display_name : comic.profiles?.display_name;
  const contributor = comic.contributor.trim() || creator || "Kreator independen";
  const coverUrl = comic.cover_key && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${comic.cover_key}` : null;
  const firstIncompleteIndex = chapters.findIndex((chapter) => chapterReadStatuses[chapter.id] !== "read");
  const allChaptersRead = chapters.length > 0 && firstIncompleteIndex === -1;
  const isChapterUnlocked = (chapterIndex: number) => {
    if (chapterIndex < 0) return false;
    if (!chapterProgressReady) return chapterIndex === 0;
    if (chapterProgressError) return chapterIndex === 0;
    return allChaptersRead || chapterIndex <= firstIncompleteIndex;
  };
  const resumeChapter = chapters.find((chapter, index) => chapter.id === lastReadChapterId && isChapterUnlocked(index));
  const firstChapter = resumeChapter || chapters[firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0] || chapters[0];

  return (
    <main className="reader-detail-page">
      <nav className="reader-subnav">
        <Link className="wordmark reader-wordmark" href="/"><span className="wordmark-dot" />mu<span>komik</span></Link>
        <Link className="reader-back-link" href="/"><ArrowLeft size={17} /> Jelajahi</Link>
      </nav>
      <section className="reader-comic-detail">
        <div className="reader-detail-cover">
          {coverUrl ? <img src={coverUrl} alt={`Sampul ${comic.title}`} fetchPriority="high" /> : <span>{comic.title.slice(0, 2).toUpperCase()}</span>}
        </div>
        <div className="reader-detail-copy">
          <span className="reader-detail-genre">{getComicGenreLabel(comic.genre)}</span>
          <p className="reader-section-kicker">KOMIK · {chapters.length} EPISODE</p>
          <h1>{comic.title}</h1>
          <p className="reader-detail-creator">Karya <strong>{contributor}</strong></p>
          <p className="reader-detail-synopsis">{cleanSynopsis(comic.synopsis) || "Mulai membaca dan masuk ke dunia cerita ini."}</p>
          <div className="reader-detail-actions">
            {firstChapter
              ? <Link className="reader-primary-button" href={`/comic/${comic.slug}/chapter/${firstChapter.id}`}><BookOpen size={18} /> {resumeChapter ? "Lanjutkan membaca" : "Baca sekarang"} <ArrowRight size={17} /></Link>
              : <span className="reader-detail-unavailable">Episode akan segera hadir</span>}
            {userId
              ? <button className={`reader-detail-action${isBookmarked ? " reader-detail-action-saved" : ""}`} onClick={() => void toggleBookmark()} disabled={bookmarkBusy} aria-pressed={isBookmarked}>
                  {bookmarkBusy ? <LoaderCircle className="spin" size={17} /> : <Bookmark size={17} fill={isBookmarked ? "currentColor" : "none"} />}
                  {isBookmarked ? "Favorit tersimpan" : "Favorit"}
                </button>
              : <Link className="reader-detail-action" href="/login"><Bookmark size={17} /> Masuk untuk favorit</Link>}
            <button className="reader-detail-action" onClick={() => void shareComic()}><Share2 size={17} /> Bagikan</button>
          </div>
          {bookmarkMessage && <p className="reader-detail-action-message" role="status">{bookmarkMessage}</p>}
          {shareMessage && <p className="reader-detail-action-message" role="status">{shareMessage}</p>}
          {resumeChapter && <p className="reader-detail-resume">Terakhir dibaca · Episode {resumeChapter.chapter_number}</p>}
        </div>
      </section>
      {shareDialogOpen && (
        <div className="reader-share-backdrop" role="presentation" onClick={() => setShareDialogOpen(false)}>
          <section className="reader-share-dialog" role="dialog" aria-modal="true" aria-labelledby="reader-share-title" onClick={(event) => event.stopPropagation()}>
            <button className="reader-share-close" type="button" aria-label="Tutup pilihan berbagi" onClick={() => setShareDialogOpen(false)}><X size={19} /></button>
            <p className="reader-section-kicker">BAGIKAN CERITA</p>
            <h2 id="reader-share-title">Ajak teman membaca</h2>
            <p className="reader-share-description">{comic.title}</p>
            {cleanSynopsis(comic.synopsis) && <p className="reader-share-synopsis">{cleanSynopsis(comic.synopsis)}</p>}
            {coverUrl && <img className="reader-share-cover" src={coverUrl} alt={`Cover ${comic.title} yang akan tampil saat membagikan tautan`} />}
            <textarea ref={shareUrlRef} className="reader-share-url" aria-label="Tautan komik" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
            <div className="reader-share-actions">
              <button className="reader-primary-button" type="button" onClick={() => void copyShareUrl()}><Copy size={17} /> Salin tautan</button>
              <a className="reader-detail-action" href={`https://wa.me/?text=${encodeURIComponent([cleanSynopsis(comic.synopsis), `Baca ${comic.title} di mu-komik: ${shareUrl}`].filter(Boolean).join("\n\n"))}`} target="_blank" rel="noreferrer"><ExternalLink size={17} /> Bagikan via WhatsApp</a>
            </div>
            {shareMessage && <p className="reader-detail-action-message" role="status">{shareMessage}</p>}
          </section>
        </div>
      )}
      <section className="reader-episodes">
        <div className="reader-section-heading"><div><p className="reader-section-kicker">MULAI ATAU LANJUTKAN</p><h2>Daftar episode</h2></div><span className="reader-result-count">{chapters.length} episode</span></div>
        {chapterProgressError && <p className="reader-episode-progress-error" role="status">Progres episode belum dapat diverifikasi. Muat ulang halaman untuk mencoba lagi; episode berikutnya dikunci sementara.</p>}
        {chapters.length ? (
          <div className="reader-episode-list">
            {chapters.map((chapter, index) => {
              const unlocked = isChapterUnlocked(index);
              const rowClass = `reader-episode-row${chapter.id === lastReadChapterId ? " reader-episode-last-read" : ""}${unlocked ? "" : " reader-episode-row-locked"}`;
              const content = (
                <>
                  <span className="reader-episode-number">{String(chapter.chapter_number).padStart(2, "0")}</span>
                  <span className="reader-episode-title">
                    <strong>{chapter.title || `Episode ${chapter.chapter_number}`}</strong>
                    {chapter.id === lastReadChapterId && <small>Terakhir dibaca</small>}
                    {chapterReadStatuses[chapter.id] && (
                      <small className={`reader-episode-read-status reader-episode-read-status-${chapterReadStatuses[chapter.id]}`}>
                        {chapterReadStatuses[chapter.id] === "read"
                          ? <><CheckCircle2 size={13} /> Sudah dibaca</>
                          : <><CircleDot size={13} /> Sudah diakses</>}
                      </small>
                    )}
                  </span>
                  <span className="reader-episode-date">{chapter.published_at ? <><CalendarDays size={14} />{new Date(chapter.published_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</> : null}</span>
                  {unlocked ? <ArrowRight size={17} /> : <LockKeyhole size={16} aria-label="Episode terkunci" />}
                </>
              );
              return unlocked
                ? <Link className={rowClass} href={`/comic/${comic.slug}/chapter/${chapter.id}`} key={chapter.id}>{content}</Link>
                : <button className={rowClass} type="button" aria-label={`Episode ${chapter.chapter_number} terkunci`} key={chapter.id} onClick={() => setEpisodeSnackbar("Selesaikan episode sebelumnya")}>{content}</button>;
            })}
          </div>
        ) : <div className="reader-empty-state"><p>{chapterLoadError ? "Daftar episode belum dapat dimuat. Periksa koneksi lalu coba lagi." : "Belum ada episode yang diterbitkan."}</p></div>}
      </section>
      <footer className="reader-footer">
        <Link className="wordmark reader-wordmark" href="/"><span className="wordmark-dot" />mu<span>komik</span></Link>
        <p>Tempat cerita Indonesia menemukan pembacanya.</p>
        <Link href="/">Jelajahi komik <ArrowRight size={15} /></Link>
      </footer>
      {episodeSnackbar && <div className="reader-episode-snackbar" role="status" aria-live="polite">{episodeSnackbar}</div>}
    </main>
  );
}
