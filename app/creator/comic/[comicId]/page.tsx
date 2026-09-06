"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, Check, LoaderCircle, Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Comic = { id: string; title: string; slug: string; synopsis: string; genre: string; status: string };
type Chapter = { id: string; title: string; chapter_number: number; published_at: string | null };

const supabase = createClient();

export default function CreatorComicPage() {
  const { comicId } = useParams<{ comicId: string }>();
  const router = useRouter();
  const [comic, setComic] = useState<Comic | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ title: "", chapterNumber: "", published: false });
  const [uploadChapter, setUploadChapterState] = useState<Chapter | null>(null);
  const uploadChapterRef = useRef<Chapter | null>(null);
  const setUploadChapter = (chapter: Chapter | null) => {
    uploadChapterRef.current = chapter;
    setUploadChapterState(chapter);
  };
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadComic = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
      if (profile?.role !== "creator" && profile?.role !== "admin") {
        router.replace("/account");
        return;
      }
      const comicQuery = supabase.from("comics").select("id, title, slug, synopsis, genre, status").eq("id", comicId);
      const { data: comicData } = profile.role === "admin" ? await comicQuery.single() : await comicQuery.eq("creator_id", userData.user.id).single();
      if (!comicData) {
        router.replace("/creator");
        return;
      }
      setComic(comicData);
      const { data: chapterData } = await supabase.from("chapters").select("id, title, chapter_number, published_at").eq("comic_id", comicId).order("chapter_number", { ascending: true });
      setChapters(chapterData ?? []);
      setLoading(false);
    };
    loadComic();
  }, [comicId, router]);

  const createChapter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!comic) return;
    setSaving(true);
    setMessage("");
    const chapterNumber = Number(form.chapterNumber);
    if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
      setMessage("Chapter number must be a positive whole number.");
      setSaving(false);
      return;
    }
    const { data, error } = await supabase.from("chapters").insert({ comic_id: comic.id, title: form.title.trim(), chapter_number: chapterNumber, published_at: form.published ? new Date().toISOString() : null }).select("id, title, chapter_number, published_at").single();
    if (error) {
      setMessage(error.code === "23505" ? "This chapter number already exists." : error.message);
    } else {
      setChapters((current) => [...current, data].sort((a, b) => a.chapter_number - b.chapter_number));
      setForm({ title: "", chapterNumber: "", published: false });
      setShowForm(false);
      setMessage("Chapter created. You can add pages next.");
    }
    setSaving(false);
  };

  const uploadPages = async (event: React.ChangeEvent<HTMLInputElement>, selectedChapter?: Chapter) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
    const chapter = selectedChapter || uploadChapterRef.current || chapters.find((item) => item.id === event.target.dataset.chapterId);
    if (!comic || !chapter || !files.length) return;
    setUploadChapter(chapter);
    setUploading(true);
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Please log in again.");
      const existing = await supabase.from("pages").select("page_number").eq("chapter_id", chapter.id).order("page_number", { ascending: false }).limit(1).maybeSingle();
      let pageNumber = (existing.data?.page_number || 0) + 1;
      for (const file of files) {
        const urlResponse = await fetch("/api/r2/upload-url", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ comicId: comic.id, chapterId: chapter.id, filename: file.name, contentType: file.type }) });
        const urlData = await urlResponse.json() as { uploadUrl?: string; objectKey?: string; error?: string };
        if (!urlResponse.ok || !urlData.uploadUrl || !urlData.objectKey) throw new Error(urlData.error || "Could not prepare upload.");
        const uploadResponse = await fetch(urlData.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!uploadResponse.ok) throw new Error(`Upload failed for ${file.name}.`);
        const { error } = await supabase.from("pages").insert({ chapter_id: chapter.id, page_number: pageNumber, object_key: urlData.objectKey });
        if (error) throw new Error(error.message);
        pageNumber += 1;
      }
      setMessage(`${files.length} page${files.length > 1 ? "s" : ""} uploaded successfully.`);
      setUploadChapter(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    }
    setUploading(false);
    event.target.value = "";
  };

  if (loading) return <main className="creator-shell"><LoaderCircle className="spin" size={24} /></main>;
  if (!comic) return null;

  return <main className="creator-shell"><nav className="creator-nav"><a className="wordmark" href="/"><span className="wordmark-dot" />mu<span>komik</span></a><a className="auth-back" href="/creator"><ArrowLeft size={16} /> Creator space</a></nav><header className="chapter-manager-header"><div><p className="eyebrow"><span /> Chapter manager</p><h1>{comic.title}</h1><p>{comic.synopsis}</p></div><button className="button button-dark" onClick={() => setShowForm(!showForm)}><Plus size={17} /> New chapter</button></header>{message && <p className="creator-message">{message}</p>}{showForm && <form className="comic-form" onSubmit={createChapter}><div className="form-heading"><div><p className="eyebrow">Build the next part</p><h2>Chapter details</h2></div><button type="button" className="form-close" onClick={() => setShowForm(false)}>×</button></div><label>Chapter title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="The name of this chapter" /></label><label>Chapter number<input required type="number" min="1" step="1" value={form.chapterNumber} onChange={(event) => setForm({ ...form, chapterNumber: event.target.value })} placeholder="1" /></label><label className="checkbox-label"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /> Publish chapter immediately</label><button className="button button-dark" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={16} /> Saving...</> : <>Create chapter <ArrowUpRight size={16} /></>}</button></form>}<section className="chapter-manager-list"><div className="creator-section-heading"><div><p className="eyebrow">{chapters.length} chapters</p><h2>Story arc</h2></div><span className={`request-status request-${comic.status === "published" ? "approved" : "pending"}`}>{comic.status}</span></div>{chapters.length === 0 ? <div className="creator-empty"><BookOpen size={26} /><h3>No chapters yet.</h3><p>Create the first chapter for this story.</p></div> : <div className="chapter-manager-rows">{chapters.map((chapter) => <article className="chapter-manager-row" key={chapter.id}><div className="chapter-number">{String(chapter.chapter_number).padStart(2, "0")}</div><div><h3>{chapter.title}</h3><p>{chapter.published_at ? `Published ${new Date(chapter.published_at).toLocaleDateString()}` : "Draft chapter"}</p></div><span className={`request-status request-${chapter.published_at ? "approved" : "pending"}`}>{chapter.published_at ? "Published" : "Draft"}</span><label className="page-upload-button"><input type="file" accept="image/*" multiple disabled={uploading} onChange={(event) => { setUploadChapter(chapter); void uploadPages(event); }} />Upload pages</label><a className="round-arrow" href={`/comic/${comic.slug}/chapter/${chapter.id}`} aria-label={`Preview ${chapter.title}`}><ArrowUpRight size={17} /></a></article>)}</div>}</section></main>;
}
