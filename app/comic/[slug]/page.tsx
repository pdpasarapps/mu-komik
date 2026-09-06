"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, LoaderCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Comic = { id: string; title: string; slug: string; synopsis: string; genre: string; cover_key: string | null; profiles: { display_name: string } | { display_name: string }[] | null };
type Chapter = { id: string; title: string; chapter_number: number; published_at: string | null };

export default function ComicDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [comic, setComic] = useState<Comic | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  useEffect(() => {
    const loadComic = async () => {
      const { data } = await supabase.from("comics").select("id, title, slug, synopsis, genre, cover_key, profiles!comics_creator_id_fkey(display_name)").eq("slug", slug).single();
      if (!data) {
        setLoading(false);
        return;
      }
      setComic(data as Comic);
      const { data: chapterData } = await supabase.from("chapters").select("id, title, chapter_number, published_at").eq("comic_id", data.id).order("chapter_number", { ascending: false });
      setChapters(chapterData ?? []);
      setLoading(false);
    };
    loadComic();
  }, [slug]);

  if (loading) return <main className="detail-shell"><LoaderCircle className="spin" size={24} /></main>;
  if (!comic) return <main className="detail-shell"><a className="auth-back" href="/"><ArrowLeft size={16} /> Back to discovery</a><div className="detail-empty"><h1>Story not found.</h1><a className="button button-dark" href="/">Return home</a></div></main>;

  const creator = Array.isArray(comic.profiles) ? comic.profiles[0]?.display_name : comic.profiles?.display_name;
  const coverUrl = comic.cover_key && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${comic.cover_key}` : null;

  return <main className="detail-shell"><nav className="detail-nav"><a className="wordmark" href="/"><span className="wordmark-dot" />mu<span>komik</span></a><a className="auth-back" href="/"><ArrowLeft size={16} /> Back to discovery</a></nav><section className="detail-hero"><div className={`detail-cover ${coverUrl ? "detail-cover-image" : ""}`} style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}><span>{comic.genre}</span><strong>{comic.title.slice(0, 2).toUpperCase()}</strong></div><div className="detail-copy"><p className="eyebrow"><span /> {comic.genre} · {creator || "Independent creator"}</p><h1>{comic.title}</h1><p>{comic.synopsis || "A new story is waiting to be read."}</p><a className="button button-dark" href={chapters[0] ? `/comic/${comic.slug}/chapter/${chapters[0].id}` : "#chapters"}><BookOpen size={17} /> {chapters[0] ? "Start reading" : "Chapters coming soon"}</a></div></section><section className="chapters-section" id="chapters"><div className="section-heading"><div><p className="eyebrow">The complete run</p><h2>Chapters</h2></div><span className="chapter-count">{chapters.length} chapters</span></div>{chapters.length ? <div className="chapter-list">{chapters.map((chapter) => <a className="chapter-row" key={chapter.id} href={`/comic/${comic.slug}/chapter/${chapter.id}`}><span>Chapter {chapter.chapter_number}</span><strong>{chapter.title}</strong><ArrowUpRight size={17} /></a>)}</div> : <p className="empty-state">No chapters published yet.</p>}</section></main>;
}
