"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import { COMIC_GENRES, getComicGenreLabel } from "@/lib/comic-genres";
import { COMIC_LANGUAGES, ORIGIN_TYPES, PRODUCTION_TECHNIQUES, STORY_STATUSES, TARGET_AUDIENCES } from "@/lib/comic-metadata";
import { createComicSharePreview } from "@/lib/comic-share-preview";

type ComicContributor = { role: string; name: string };
type Comic = {
  id: string;
  title: string;
  slug: string;
  synopsis: string;
  contributor: string;
  contributors: ComicContributor[];
  genre: string;
  production_technique: string;
  story_status: string;
  target_audience: string;
  language: string;
  origin_type: string;
  source_info: string;
  status: string;
  cover_key: string | null;
  share_preview_key: string | null;
};
type ComicForm = {
  title: string;
  synopsis: string;
  genre: string;
  contributors: ComicContributor[];
  technique: string;
  storyStatus: string;
  targetAudience: string;
  language: string;
  otherLanguage: string;
  originType: string;
  sourceInfo: string;
};
type Chapter = { id: string; title: string; chapter_number: number; published_at: string | null };
type ChapterPage = { id: string; chapter_id: string; page_number: number; object_key: string };

const supabase = createClient();
const initialComicForm: ComicForm = {
  title: "",
  synopsis: "",
  genre: "Fantasy",
  contributors: [{ role: "Penulis", name: "" }],
  technique: "traditional_drawing",
  storyStatus: "ongoing",
  targetAudience: "all_ages",
  language: "id",
  otherLanguage: "",
  originType: "original",
  sourceInfo: "",
};

function getComicForm(comic: Comic): ComicForm {
  const storedContributors = Array.isArray(comic.contributors) ? comic.contributors : [];
  const namedContributors = storedContributors.filter((item) => item.name?.trim());
  const knownLanguages = COMIC_LANGUAGES.map((item) => item.value);
  const hasKnownLanguage = knownLanguages.some((language) => language === comic.language);
  return {
    title: comic.title,
    synopsis: comic.synopsis,
    genre: comic.genre,
    contributors: namedContributors.length
      ? namedContributors.map((item) => ({ role: item.role || "", name: item.name || "" }))
      : [{ role: "Penulis", name: comic.contributor || "" }],
    technique: comic.production_technique || "traditional_drawing",
    storyStatus: comic.story_status || "ongoing",
    targetAudience: comic.target_audience || "all_ages",
    language: hasKnownLanguage ? comic.language : "other",
    otherLanguage: hasKnownLanguage ? "" : comic.language || "",
    originType: comic.origin_type || "original",
    sourceInfo: comic.source_info || "",
  };
}

function getPageLabel(pageNumber: number) {
  const label = `Page ${pageNumber}`;
  return label.length > 8 ? `${label.slice(0, 7)}…` : label;
}

export default function CreatorComicPage() {
  const { comicId } = useParams<{ comicId: string }>();
  const router = useRouter();
  const [comic, setComic] = useState<Comic | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [pagesByChapter, setPagesByChapter] = useState<Record<string, ChapterPage[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingComic, setSavingComic] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showComicForm, setShowComicForm] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null);
  const [reorderingPageId, setReorderingPageId] = useState<string | null>(null);
  const reorderInFlightRef = useRef(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ title: "", chapterNumber: "", published: false });
  const [comicForm, setComicForm] = useState<ComicForm>(initialComicForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [, setUploadChapterState] = useState<Chapter | null>(null);
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
      const comicQuery = supabase.from("comics").select("id, title, slug, synopsis, contributor, contributors, genre, production_technique, story_status, target_audience, language, origin_type, source_info, status, cover_key, share_preview_key").eq("id", comicId);
      const { data: comicData } = profile.role === "admin" ? await comicQuery.single() : await comicQuery.eq("creator_id", userData.user.id).single();
      if (!comicData) {
        router.replace("/creator");
        return;
      }
      setComic(comicData);
      if (new URLSearchParams(window.location.search).get("edit") === "comic") {
        setComicForm(getComicForm(comicData));
        setShowComicForm(true);
      }
      const { data: chapterData } = await supabase.from("chapters").select("id, title, chapter_number, published_at").eq("comic_id", comicId).order("chapter_number", { ascending: true });
      const loadedChapters = chapterData ?? [];
      setChapters(loadedChapters);
      if (loadedChapters.length) {
        const { data: pageData } = await supabase.from("pages").select("id, chapter_id, page_number, object_key").in("chapter_id", loadedChapters.map((chapter) => chapter.id)).order("page_number", { ascending: true });
        setPagesByChapter((pageData ?? []).reduce<Record<string, ChapterPage[]>>((grouped, page) => {
          grouped[page.chapter_id] = [...(grouped[page.chapter_id] ?? []), page];
          return grouped;
        }, {}));
      }
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
    const existingChapter = chapters.find((chapter) => chapter.id === editingChapterId);
    const publishedAt = form.published ? existingChapter?.published_at || new Date().toISOString() : null;
    if (editingChapterId) {
      const { data, error } = await supabase
        .from("chapters")
        .update({ title: form.title.trim(), chapter_number: chapterNumber, published_at: publishedAt })
        .eq("id", editingChapterId)
        .eq("comic_id", comic.id)
        .select("id, title, chapter_number, published_at")
        .single();
      if (error) {
        setMessage(error.code === "23505" ? "This chapter number already exists." : error.message);
      } else {
        setChapters((current) => current.map((chapter) => chapter.id === data.id ? data : chapter).sort((a, b) => a.chapter_number - b.chapter_number));
        setShowForm(false);
        setEditingChapterId(null);
        setForm({ title: "", chapterNumber: "", published: false });
        setMessage("Chapter updated.");
      }
    } else {
      const { data, error } = await supabase
        .from("chapters")
        .insert({ comic_id: comic.id, title: form.title.trim(), chapter_number: chapterNumber, published_at: publishedAt })
        .select("id, title, chapter_number, published_at")
        .single();
      if (error) {
        setMessage(error.code === "23505" ? "This chapter number already exists." : error.message);
      } else {
        setChapters((current) => [...current, data].sort((a, b) => a.chapter_number - b.chapter_number));
        setForm({ title: "", chapterNumber: "", published: false });
        setShowForm(false);
        setMessage("Chapter created. You can add pages next.");
      }
    }
    setSaving(false);
  };

  const startComicEdit = () => {
    if (!comic) return;
    setComicForm(getComicForm(comic));
    setCoverFile(null);
    setShowComicForm(true);
  };

  const updateContributor = (index: number, field: keyof ComicContributor, value: string) => {
    setComicForm((current) => ({
      ...current,
      contributors: current.contributors.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  };

  const addContributor = () => {
    setComicForm((current) => ({ ...current, contributors: [...current.contributors, { role: "", name: "" }] }));
  };

  const removeContributor = (index: number) => {
    setComicForm((current) => current.contributors.length <= 1
      ? current
      : { ...current, contributors: current.contributors.filter((_, itemIndex) => itemIndex !== index) });
  };

  const updateComic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!comic) return;
    const contributors = comicForm.contributors.map((item) => ({ role: item.role.trim(), name: item.name.trim() }));
    if (!contributors.length || contributors.some((item) => !item.role || !item.name)) {
      setMessage("At least one contributor with a role and name is required.");
      return;
    }
    const language = comicForm.language === "other" ? comicForm.otherLanguage.trim() : comicForm.language;
    if (!language) {
      setMessage("Masukkan bahasa komik.");
      return;
    }
    if (comicForm.originType === "adaptation" && !comicForm.sourceInfo.trim()) {
      setMessage("Cantumkan sumber karya yang diadaptasi.");
      return;
    }
    setSavingComic(true);
    setMessage("");
    const previousCoverKey = comic.cover_key;
    let uploadedCoverKey: string | null = null;
    let uploadedSharePreviewKey: string | null = null;
    let comicSaved = false;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Please log in again.");

      let coverKey = previousCoverKey;
      let sharePreviewKey = comic.share_preview_key;
      if (coverFile) {
        const signResponse = await fetch("/api/r2/comic-cover", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ comicId: comic.id, filename: coverFile.name, contentType: coverFile.type }),
        });
        const signResult = await signResponse.json() as { uploadUrl?: string; objectKey?: string; error?: string };
        if (!signResponse.ok || !signResult.uploadUrl || !signResult.objectKey) {
          throw new Error(signResult.error || "Could not prepare cover upload.");
        }
        uploadedCoverKey = signResult.objectKey;
        const uploadResponse = await fetch(signResult.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": coverFile.type },
          body: coverFile,
        });
        if (!uploadResponse.ok) throw new Error("Cover upload failed.");
        coverKey = uploadedCoverKey;

        const preview = await createComicSharePreview(coverFile, comicForm.title.trim());
        const previewSignResponse = await fetch("/api/r2/share-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ comicId: comic.id, coverKey }),
        });
        const previewSignResult = await previewSignResponse.json() as {
          uploadUrl?: string;
          objectKey?: string;
          headers?: Record<string, string>;
          error?: string;
        };
        if (!previewSignResponse.ok || !previewSignResult.uploadUrl || !previewSignResult.objectKey || !previewSignResult.headers) {
          throw new Error(previewSignResult.error || "Could not prepare comic share preview upload.");
        }
        uploadedSharePreviewKey = previewSignResult.objectKey;
        const previewUploadResponse = await fetch(previewSignResult.uploadUrl, {
          method: "PUT",
          headers: previewSignResult.headers,
          body: preview,
        });
        if (!previewUploadResponse.ok) throw new Error("Comic share preview upload failed.");
        sharePreviewKey = uploadedSharePreviewKey;
      }

      const { data, error } = await supabase
        .from("comics")
        .update({
          title: comicForm.title.trim(),
          synopsis: comicForm.synopsis.trim(),
          genre: comicForm.genre,
          contributor: contributors.map((item) => `${item.role}: ${item.name}`).join(" · "),
          contributors,
          production_technique: comicForm.technique,
          story_status: comicForm.storyStatus,
          target_audience: comicForm.targetAudience,
          language,
          origin_type: comicForm.originType,
          source_info: comicForm.originType === "adaptation" ? comicForm.sourceInfo.trim() : "",
          cover_key: coverKey,
          share_preview_key: sharePreviewKey,
          status: comic.status === "published" ? "pending_review" : comic.status,
        })
        .eq("id", comic.id)
        .select("id, title, slug, synopsis, contributor, contributors, genre, production_technique, story_status, target_audience, language, origin_type, source_info, status, cover_key, share_preview_key")
        .single();
      if (error) throw new Error(error.message);

      comicSaved = true;
      setComic(data);
      setShowComicForm(false);
      setCoverFile(null);

      let cleanupPending = false;
      if (previousCoverKey && coverKey !== previousCoverKey) {
        try {
          const cleanupResponse = await fetch("/api/r2/comic-cover", {
            method: "DELETE",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ comicId: comic.id, objectKey: previousCoverKey }),
          });
          cleanupPending = !cleanupResponse.ok;
        } catch {
          cleanupPending = true;
        }
      }
      setMessage(cleanupPending
        ? "Comic updated, but the previous cover could not be removed from storage."
        : comic.status === "published"
          ? "Comic updated and submitted for admin review."
          : "Comic details updated.");
    } catch (error) {
      if (uploadedCoverKey && !comicSaved) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          await fetch("/api/r2/comic-cover", {
            method: "DELETE",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ comicId: comic.id, objectKey: uploadedCoverKey }),
          }).catch(() => undefined);
        }
      }
      if (uploadedSharePreviewKey && coverFile && !comicSaved) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token && uploadedCoverKey) {
          await fetch("/api/r2/share-preview", {
            method: "DELETE",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              comicId: comic.id,
              coverKey: uploadedCoverKey,
              previewKey: uploadedSharePreviewKey,
            }),
          }).catch((cleanupError: unknown) => {
            console.error("Unable to clean up failed comic share preview upload:", cleanupError);
          });
        }
      }
      setMessage(error instanceof Error ? error.message : "Could not update comic.");
    } finally {
      setSavingComic(false);
    }
  };

  const startChapterForm = (chapter?: Chapter) => {
    setEditingChapterId(chapter?.id ?? null);
    setForm(chapter
      ? { title: chapter.title, chapterNumber: String(chapter.chapter_number), published: Boolean(chapter.published_at) }
      : { title: "", chapterNumber: "", published: false });
    setShowForm(true);
  };

  const deleteChapter = async (chapter: Chapter) => {
    if (!comic || !window.confirm(`Delete "${chapter.title}" and all its pages? This cannot be undone.`)) return;
    setDeletingChapterId(chapter.id);
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Please log in again.");
      const response = await fetch("/api/r2/delete-chapter", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comicId: comic.id, chapterId: chapter.id }),
      });
      const result = await response.json() as { deleted?: boolean; storageCleanupPending?: boolean; error?: string };
      if (!response.ok || !result.deleted) throw new Error(result.error || "Could not delete chapter.");
      setChapters((current) => current.filter((item) => item.id !== chapter.id));
      setMessage(result.storageCleanupPending
        ? "Chapter deleted, but some image files could not be removed from storage."
        : "Chapter and its pages deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete chapter.");
    }
    setDeletingChapterId(null);
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
        const urlData = await urlResponse.json() as { uploadUrl?: string; objectKey?: string; error?: string; detail?: string; missing?: string[] };
        if (urlData.error === "R2 environment variables are missing") {
          const missing = urlData.missing?.join(", ");
          throw new Error(`Server storage is not configured${missing ? ` (${missing})` : ""}. Ask an admin to configure the production Worker.`);
        }
        if (!urlResponse.ok || !urlData.uploadUrl || !urlData.objectKey) throw new Error(urlData.error ? `${urlData.error}${urlData.missing ? `: ${urlData.missing.join(", ")}` : ""}${urlData.detail ? ` (${urlData.detail})` : ""}` : "Could not prepare upload.");
        const uploadResponse = await fetch(urlData.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!uploadResponse.ok) throw new Error(`Upload failed for ${file.name}.`);
        const { data: page, error } = await supabase
          .from("pages")
          .insert({ chapter_id: chapter.id, page_number: pageNumber, object_key: urlData.objectKey })
          .select("id, chapter_id, page_number, object_key")
          .single();
        if (error) throw new Error(error.message);
        setPagesByChapter((current) => ({ ...current, [chapter.id]: [...(current[chapter.id] ?? []), page] }));
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

  const deletePage = async (chapter: Chapter, page: ChapterPage) => {
    if (!comic || !window.confirm(`Delete page ${page.page_number}? This cannot be undone.`)) return;
    setDeletingPageId(page.id);
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Please log in again.");
      const response = await fetch("/api/r2/delete-page", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comicId: comic.id, chapterId: chapter.id, pageId: page.id }),
      });
      const result = await response.json() as { deleted?: boolean; storageCleanupPending?: boolean; error?: string };
      if (!response.ok || !result.deleted) throw new Error(result.error || "Could not delete page.");
      setPagesByChapter((current) => ({
        ...current,
        [chapter.id]: (current[chapter.id] ?? []).filter((item) => item.id !== page.id),
      }));
      setMessage(result.storageCleanupPending
        ? "Page deleted, but its image file could not be removed from storage."
        : "Page and image deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete page.");
    }
    setDeletingPageId(null);
  };

  const reorderPage = async (chapter: Chapter, page: ChapterPage, targetPage: ChapterPage) => {
    if (!comic || reorderInFlightRef.current) return;
    reorderInFlightRef.current = true;
    setReorderingPageId(page.id);
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Please log in again.");
      const response = await fetch("/api/r2/reorder-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comicId: comic.id, chapterId: chapter.id, pageId: page.id, targetPageId: targetPage.id }),
      });
      const result = await response.json() as { reordered?: boolean; pages?: Array<{ id: string; page_number: number }>; error?: string };
      if (!response.ok || !result.reordered || !result.pages) throw new Error(result.error || "Could not reorder pages.");
      const updatedNumbers = new Map(result.pages.map((item) => [item.id, item.page_number]));
      setPagesByChapter((current) => ({
        ...current,
        [chapter.id]: (current[chapter.id] ?? [])
          .map((item) => updatedNumbers.has(item.id) ? { ...item, page_number: updatedNumbers.get(item.id)! } : item)
          .sort((first, second) => first.page_number - second.page_number),
      }));
      setMessage("Page order updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reorder pages.");
    } finally {
      reorderInFlightRef.current = false;
      setReorderingPageId(null);
    }
  };

  if (loading) return <main className="creator-shell"><LoaderCircle className="spin" size={24} /></main>;
  if (!comic) return null;
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  const thumbnailKey = comic.cover_key || pagesByChapter[chapters[0]?.id]?.[0]?.object_key;
  const coverUrl = thumbnailKey && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${thumbnailKey}` : null;
  const contributorSummary = Array.isArray(comic.contributors) && comic.contributors.length
    ? comic.contributors.map((item) => `${item.role}: ${item.name}`).join(" · ")
    : comic.contributor;

  return (
    <main className="creator-shell">
      <nav className="creator-nav">
        <BrandLogo />
        <Link className="auth-back" href="/creator"><ArrowLeft size={16} /> Creator space</Link>
      </nav>
      <header className="chapter-manager-header">
        <div className="chapter-manager-intro">
          <div className={`chapter-manager-cover ${coverUrl ? "has-cover" : ""}`}>
            {coverUrl
              ? <img src={coverUrl} alt={`Cover for ${comic.title}`} />
              : <div className="chapter-manager-cover-fallback" role="img" aria-label={`Cover for ${comic.title}`}><span>{comic.genre}</span><strong>{comic.title.slice(0, 2).toUpperCase()}</strong></div>}
          </div>
          <div className="chapter-manager-title">
            <p className="eyebrow"><span /> Chapter manager</p>
            <h1>{comic.title}</h1>
            {contributorSummary && <p className="chapter-manager-contributors">{contributorSummary}</p>}
            <div className="chapter-manager-description-row">
              <p>{comic.synopsis}</p>
            </div>
            <div className="chapter-manager-inline-actions">
              <span className={`request-status request-${comic.status === "published" ? "approved" : "pending"}`}>
                {comic.status === "pending_review" ? "Menunggu kurasi" : comic.status === "published" ? "Published" : comic.status === "draft" ? "Draft" : "Archived"}
              </span>
              <button className="button button-light chapter-manager-inline-edit" onClick={startComicEdit}>
                <Pencil size={16} /> Edit comic
              </button>
            </div>
          </div>
        </div>
      </header>
      {message && <p className="creator-message" role="status">{message}</p>}
      {showComicForm && (
        <form className="comic-form" onSubmit={updateComic}>
          <div className="form-heading">
            <div>
              <p className="eyebrow">Comic settings</p>
              <h2>Edit comic</h2>
            </div>
            <button type="button" className="form-close" aria-label="Close comic form" onClick={() => setShowComicForm(false)}>&times;</button>
          </div>
          <label>Judul Komik<input required maxLength={120} value={comicForm.title} onChange={(event) => setComicForm({ ...comicForm, title: event.target.value })} /></label>
          <label>Genre<select value={comicForm.genre} onChange={(event) => setComicForm({ ...comicForm, genre: event.target.value })}>{COMIC_GENRES.map((genre) => <option key={genre} value={genre}>{getComicGenreLabel(genre)}</option>)}</select></label>
          <label>Deskripsi<textarea required maxLength={3000} rows={4} value={comicForm.synopsis} onChange={(event) => setComicForm({ ...comicForm, synopsis: event.target.value })} /></label>
          <fieldset className="comic-contributors-fieldset">
            <legend>Kredit kreator (minimal satu)</legend>
            <datalist id="comic-contributor-roles">
              <option value="Penulis" />
              <option value="Ilustrator" />
              <option value="Pewarna" />
              <option value="Penerjemah" />
              <option value="Inker" />
              <option value="Outline" />
              <option value="Coloring" />
              <option value="Outlet" />
              <option value="Editor" />
              <option value="Letterer" />
            </datalist>
            {comicForm.contributors.map((item, index) => (
              <div className="comic-contributor-row" key={index}>
                <input
                  required
                  maxLength={60}
                  list="comic-contributor-roles"
                  aria-label={`Peran contributor ${index + 1}`}
                  placeholder="Peran, mis. Ilustrator"
                  value={item.role}
                  onChange={(event) => updateContributor(index, "role", event.target.value)}
                />
                <input
                  required
                  maxLength={120}
                  aria-label={`Nama contributor ${index + 1}`}
                  placeholder="Nama"
                  value={item.name}
                  onChange={(event) => updateContributor(index, "name", event.target.value)}
                />
                <button
                  type="button"
                  className="chapter-action chapter-action-danger"
                  aria-label={`Hapus contributor ${index + 1}`}
                  onClick={() => removeContributor(index)}
                  disabled={comicForm.contributors.length === 1 || savingComic}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button type="button" className="button button-light contributor-add-button" onClick={addContributor} disabled={savingComic}>
              <Plus size={15} /> Tambah contributor
            </button>
          </fieldset>
          <label>Teknik produksi<select value={comicForm.technique} onChange={(event) => setComicForm({ ...comicForm, technique: event.target.value })}>{PRODUCTION_TECHNIQUES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Status cerita<select value={comicForm.storyStatus} onChange={(event) => setComicForm({ ...comicForm, storyStatus: event.target.value })}>{STORY_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Target pembaca<select value={comicForm.targetAudience} onChange={(event) => setComicForm({ ...comicForm, targetAudience: event.target.value })}>{TARGET_AUDIENCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Bahasa<select value={comicForm.language} onChange={(event) => setComicForm({ ...comicForm, language: event.target.value })}>{COMIC_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}<option value="other">Bahasa lainnya</option></select></label>
          {comicForm.language === "other" && <label>Nama bahasa<input required maxLength={80} value={comicForm.otherLanguage} onChange={(event) => setComicForm({ ...comicForm, otherLanguage: event.target.value })} placeholder="Contoh: Bahasa Jawa" /></label>}
          <label>Asal karya<select value={comicForm.originType} onChange={(event) => setComicForm({ ...comicForm, originType: event.target.value })}>{ORIGIN_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          {comicForm.originType === "adaptation" && <label>Sumber adaptasi<input required maxLength={500} value={comicForm.sourceInfo} onChange={(event) => setComicForm({ ...comicForm, sourceInfo: event.target.value })} placeholder="Judul dan pencipta karya sumber" /></label>}
          <p className="comic-form-note">Semua komik di mu-komik gratis untuk dibaca.</p>
          <label className="cover-upload-field">Cover komik
            <input type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} />
            <span>{coverFile ? `Dipilih: ${coverFile.name}` : comic.cover_key ? "Cover saat ini dipertahankan jika tidak memilih file baru." : "Belum ada cover."}</span>
          </label>
          <div className="comic-form-actions">
            <button className="button button-dark" type="submit" disabled={savingComic}>
              {savingComic ? <><LoaderCircle className="spin" size={16} /> Saving...</> : <>Simpan perubahan <ArrowUpRight size={16} /></>}
            </button>
            <button className="button button-light" type="button" onClick={() => { setShowComicForm(false); setCoverFile(null); }} disabled={savingComic}>Batal</button>
          </div>
        </form>
      )}
      {showForm && (
        <form className="comic-form" onSubmit={createChapter}>
          <div className="form-heading">
            <div>
              <p className="eyebrow">{editingChapterId ? "Update this chapter" : "Build the next part"}</p>
              <h2>{editingChapterId ? "Edit chapter" : "Chapter details"}</h2>
            </div>
            <button type="button" className="form-close" aria-label="Close chapter form" onClick={() => { setShowForm(false); setEditingChapterId(null); }}>&times;</button>
          </div>
          <label>Chapter title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="The name of this chapter" /></label>
          <label>Chapter number<input required type="number" min="1" step="1" value={form.chapterNumber} onChange={(event) => setForm({ ...form, chapterNumber: event.target.value })} placeholder="1" /></label>
          <label className="checkbox-label"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /> Publish chapter</label>
          <button className="button button-dark" type="submit" disabled={saving}>
            {saving ? <><LoaderCircle className="spin" size={16} /> Saving...</> : <>{editingChapterId ? "Save changes" : "Create chapter"} <ArrowUpRight size={16} /></>}
          </button>
        </form>
      )}
      <section className="chapter-manager-list">
        <div className="creator-section-heading">
          <div><p className="eyebrow">{chapters.length} bab</p><h2>Alur Cerita</h2></div>
          <div className="chapter-list-heading-actions">
            <button className="button button-dark" onClick={() => startChapterForm()}><Plus size={17} /> New chapter</button>
          </div>
        </div>
        {chapters.length === 0 ? (
          <div className="creator-empty"><BookOpen size={26} /><h3>No chapters yet.</h3><p>Create the first chapter for this story.</p></div>
        ) : (
          <div className="chapter-manager-rows">
            {chapters.map((chapter) => (
              <article className="chapter-manager-row" key={chapter.id}>
                <div className="chapter-number">{String(chapter.chapter_number).padStart(2, "0")}</div>
                <div className="chapter-manager-copy">
                  <h3>{chapter.title}</h3>
                  <p>{chapter.published_at ? `Published ${new Date(chapter.published_at).toLocaleDateString()}` : "Draft chapter"}</p>
                </div>
                <div className="chapter-row-actions">
                  <span className={`request-status request-${chapter.published_at ? "approved" : "pending"}`}>{chapter.published_at ? "Published" : "Draft"}</span>
                  <button type="button" className="chapter-action" aria-label={`Edit ${chapter.title}`} title="Edit chapter" onClick={() => startChapterForm(chapter)} disabled={deletingChapterId !== null}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" className="chapter-action chapter-action-danger" aria-label={`Delete ${chapter.title}`} title="Delete chapter" onClick={() => void deleteChapter(chapter)} disabled={deletingChapterId !== null || uploading}>
                    {deletingChapterId === chapter.id ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}
                  </button>
                  <label className="page-upload-button">
                    <input type="file" accept="image/*" multiple disabled={uploading || deletingChapterId !== null} onChange={(event) => { setUploadChapter(chapter); void uploadPages(event); }} />
                    Upload pages
                  </label>
                  <Link className="round-arrow" href={`/comic/${comic.slug}/chapter/${chapter.id}`} aria-label={`Preview ${chapter.title}`}><ArrowUpRight size={17} /></Link>
                </div>
                {(pagesByChapter[chapter.id]?.length ?? 0) > 0 && (
                  <div className="chapter-page-list" aria-label={`Pages in ${chapter.title}`}>
                    {pagesByChapter[chapter.id].map((page, pageIndex) => (
                      <div className="chapter-page-item" key={page.id}>
                        <div
                          className="chapter-page-thumbnail"
                          style={publicUrl ? { backgroundImage: `url(${publicUrl.replace(/\/$/, "")}/${page.object_key})` } : undefined}
                          role="img"
                          aria-label={`Thumbnail for page ${page.page_number}`}
                        >
                          {!publicUrl && <BookOpen size={16} />}
                        </div>
                        <div className="chapter-page-meta">
                          <div className="chapter-page-meta-row">
                            <span className="chapter-page-label" title={`Page ${page.page_number}`}>
                              {getPageLabel(page.page_number)}
                            </span>
                            <button
                              type="button"
                              className="chapter-action chapter-action-danger"
                              aria-label={`Delete page ${page.page_number} from ${chapter.title}`}
                              title="Delete page"
                              onClick={() => void deletePage(chapter, page)}
                              disabled={deletingPageId !== null || uploading || deletingChapterId !== null || reorderingPageId !== null}
                            >
                              {deletingPageId === page.id ? <LoaderCircle className="spin" size={14} /> : <Trash2 size={14} />}
                            </button>
                          </div>
                          <div className="chapter-page-order">
                            <button
                              type="button"
                              className="chapter-action"
                              aria-label={`Move page ${page.page_number} left`}
                              title="Move page left"
                              onClick={() => void reorderPage(chapter, page, pagesByChapter[chapter.id][pageIndex - 1])}
                              disabled={pageIndex === 0 || reorderingPageId !== null || deletingPageId !== null || uploading || deletingChapterId !== null}
                            >
                              {reorderingPageId === page.id ? <LoaderCircle className="spin" size={14} /> : <ChevronLeft size={15} />}
                            </button>
                            <button
                              type="button"
                              className="chapter-action"
                              aria-label={`Move page ${page.page_number} right`}
                              title="Move page right"
                              onClick={() => void reorderPage(chapter, page, pagesByChapter[chapter.id][pageIndex + 1])}
                              disabled={pageIndex === pagesByChapter[chapter.id].length - 1 || reorderingPageId !== null || deletingPageId !== null || uploading || deletingChapterId !== null}
                            >
                              {reorderingPageId === page.id ? <LoaderCircle className="spin" size={14} /> : <ChevronRight size={15} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
