"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, LoaderCircle } from "lucide-react";
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

      if (chapterData?.length) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) console.error("Unable to check the current auth session:", sessionError);
        if (sessionData.session?.user) {
          const { data: history, error: historyError } = await supabase
            .from("reading_history")
            .select("chapter_id")
            .eq("user_id", sessionData.session.user.id)
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
          {firstChapter
            ? <Link className="reader-primary-button" href={`/comic/${comic.slug}/chapter/${firstChapter.id}`}><BookOpen size={18} /> {resumeChapter ? "Lanjutkan membaca" : "Baca sekarang"} <ArrowRight size={17} /></Link>
            : <span className="reader-detail-unavailable">Episode akan segera hadir</span>}
          {resumeChapter && <p className="reader-detail-resume">Terakhir dibaca · Episode {resumeChapter.chapter_number}</p>}
        </div>
      </section>
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
