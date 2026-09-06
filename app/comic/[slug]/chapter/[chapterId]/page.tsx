"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
type Page = { id: string; page_number: number; object_key: string };
type Chapter = { id: string; title: string; chapter_number: number; comic_id: string; comics: { title: string; slug: string } | { title: string; slug: string }[] };

export default function ChapterReaderPage() {
  const { slug, chapterId } = useParams<{ slug: string; chapterId: string }>();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  useEffect(() => {
    const loadChapter = async () => {
      const { data } = await supabase.from("chapters").select("id, title, chapter_number, comic_id, comics!inner(title, slug)").eq("id", chapterId).eq("comics.slug", slug).single();
      if (!data) {
        setLoading(false);
        return;
      }
      setChapter(data as Chapter);
      const { data: pageData } = await supabase.from("pages").select("id, page_number, object_key").eq("chapter_id", chapterId).order("page_number");
      setPages(pageData ?? []);
      setLoading(false);
    };
    loadChapter();
  }, [chapterId, slug]);

  if (loading) return <main className="reader-shell"><LoaderCircle className="spin" size={24} /></main>;
  if (!chapter) return <main className="reader-shell"><p>Chapter not found.</p></main>;
  const comic = Array.isArray(chapter.comics) ? chapter.comics[0] : chapter.comics;
  const pageUrl = pages[currentPage] && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${pages[currentPage].object_key}` : null;

  return <main className="reader-shell"><nav className="reader-nav"><a className="auth-back" href={`/comic/${slug}`}><ArrowLeft size={16} /> {comic?.title || "Back to comic"}</a><span>Chapter {chapter.chapter_number} · {chapter.title}</span></nav><section className="reader-stage">{pageUrl ? <img src={pageUrl} alt={`Page ${currentPage + 1} of ${chapter.title}`} /> : <div className="reader-empty"><p>{pages.length ? "R2 public URL is not configured." : "This chapter has no pages yet."}</p></div>}</section><footer className="reader-controls"><button onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}><ChevronLeft size={18} /> Previous</button><span>{pages.length ? `${currentPage + 1} / ${pages.length}` : "No pages"}</span><button onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))} disabled={!pages.length || currentPage === pages.length - 1}>Next <ChevronRight size={18} /></button></footer></main>;
}
