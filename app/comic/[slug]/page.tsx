"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, CalendarDays, Copy, ExternalLink, LoaderCircle, Share2, X } from "lucide-react";
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
function cleanSynopsis(synopsis: string) {
  return synopsis.replace(/\*\*/g, "").replace(/👉/g, "").replace(/\n+/g, " ").trim();
}

export default function ComicDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [comic, setComic] = useState<Comic | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
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
  const shareUrlRef = useRef<HTMLTextAreaElement>(null);
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

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
      if (active) setChapterLoadError(Boolean(chapterError));

      if (active) {
        setComic(data as Comic);
        setChapters(chapterData ?? []);
        setLoading(false);
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) console.error("Unable to check the current auth session:", sessionError);
      const currentUserId = sessionData.session?.user.id ?? null;
      if (active) setUserId(currentUserId);
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
        if (currentUserId) {
          const { data: history, error: historyError } = await supabase
            .from("reading_history")
            .select("chapter_id")
            .eq("user_id", currentUserId)
            .in("chapter_id", chapterData.map((chapter) => chapter.id))
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (historyError) console.error("Unable to load comic reading progress:", historyError);
          else if (active) setLastReadChapterId(history?.chapter_id ?? null);
        }
      }
    };
    void loadComic();
    return () => { active = false; };
  }, [slug]);

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
        await navigator.share({ title: comic?.title, text: `Baca ${comic?.title} di mu-komik`, url });
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
  const resumeChapter = chapters.find((chapter) => chapter.id === lastReadChapterId);
  const firstChapter = resumeChapter || chapters[0];

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
            <textarea ref={shareUrlRef} className="reader-share-url" aria-label="Tautan komik" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
            <div className="reader-share-actions">
              <button className="reader-primary-button" type="button" onClick={() => void copyShareUrl()}><Copy size={17} /> Salin tautan</button>
              <a className="reader-detail-action" href={`https://wa.me/?text=${encodeURIComponent(`Baca ${comic.title} di mu-komik: ${shareUrl}`)}`} target="_blank" rel="noreferrer"><ExternalLink size={17} /> Bagikan via WhatsApp</a>
            </div>
            {shareMessage && <p className="reader-detail-action-message" role="status">{shareMessage}</p>}
          </section>
        </div>
      )}
      <section className="reader-episodes">
        <div className="reader-section-heading"><div><p className="reader-section-kicker">MULAI ATAU LANJUTKAN</p><h2>Daftar episode</h2></div><span className="reader-result-count">{chapters.length} episode</span></div>
        {chapters.length ? (
          <div className="reader-episode-list">
            {chapters.map((chapter) => (
              <Link className={`reader-episode-row${chapter.id === lastReadChapterId ? " reader-episode-last-read" : ""}`} href={`/comic/${comic.slug}/chapter/${chapter.id}`} key={chapter.id}>
                <span className="reader-episode-number">{String(chapter.chapter_number).padStart(2, "0")}</span>
                <span className="reader-episode-title"><strong>{chapter.title || `Episode ${chapter.chapter_number}`}</strong>{chapter.id === lastReadChapterId && <small>Terakhir dibaca</small>}</span>
                <span className="reader-episode-date">{chapter.published_at ? <><CalendarDays size={14} />{new Date(chapter.published_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</> : null}</span>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        ) : <div className="reader-empty-state"><p>{chapterLoadError ? "Daftar episode belum dapat dimuat. Periksa koneksi lalu coba lagi." : "Belum ada episode yang diterbitkan."}</p></div>}
      </section>
      <footer className="reader-footer">
        <Link className="wordmark reader-wordmark" href="/"><span className="wordmark-dot" />mu<span>komik</span></Link>
        <p>Tempat cerita Indonesia menemukan pembacanya.</p>
        <Link href="/">Jelajahi komik <ArrowRight size={15} /></Link>
      </footer>
    </main>
  );
}
