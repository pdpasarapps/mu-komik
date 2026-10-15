"use client";

import { useEffect, useState } from "react";
import { Eye, FileText, LoaderCircle, Plus, Save, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import MarkdownContent from "@/components/markdown-content";
import { getArticleCoverUrl } from "@/lib/article-cover";

type ArticleStatus = "draft" | "published";
type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content_markdown: string;
  category: string;
  cover_key: string | null;
  seo_title: string | null;
  seo_description: string | null;
  author_name: string;
  status: ArticleStatus;
  author_id: string;
  published_at: string | null;
  updated_at: string;
};
type ArticleForm = Omit<ArticleRow, "updated_at">;

const supabase = createClient();
const emptyArticle: ArticleForm = {
  id: "",
  title: "",
  slug: "",
  excerpt: "",
  content_markdown: "",
  category: "Komik",
  cover_key: null,
  seo_title: "",
  seo_description: "",
  author_name: "Tim MU-Komik",
  status: "draft",
  author_id: "",
  published_at: null,
};

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatArticleDate(value: string | null): string {
  if (!value) return "Belum diterbitkan";
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function ArticlesPanel() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [form, setForm] = useState<ArticleForm>(emptyArticle);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ArticleStatus>("all");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadArticles() {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("articles")
      .select("id, title, slug, excerpt, content_markdown, category, cover_key, seo_title, seo_description, author_name, status, author_id, published_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (loadError) {
      console.error("Could not load articles in admin:", loadError);
      setError("Artikel belum dapat dimuat. Pastikan migrasi supabase/article-cms.sql sudah diterapkan, lalu muat ulang.");
    } else {
      setArticles((data ?? []) as ArticleRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadArticles(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function startNewArticle() {
    setForm(emptyArticle);
    setSlugManuallyEdited(false);
    setPreview(false);
    setMessage("");
    setError("");
  }

  function editArticle(article: ArticleRow) {
    setForm({ ...article, seo_title: article.seo_title ?? "", seo_description: article.seo_description ?? "" });
    setSlugManuallyEdited(true);
    setPreview(false);
    setMessage("");
    setError("");
  }

  async function saveArticle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const slug = slugify(form.slug);
    if (!form.title.trim() || !form.excerpt.trim() || !form.content_markdown.trim()) {
      setError("Judul, ringkasan, dan isi artikel wajib diisi.");
      setSaving(false);
      return;
    }
    if (!slug) {
      setError("Slug wajib diisi dan harus berisi huruf atau angka.");
      setSaving(false);
      return;
    }
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setError("Sesi admin tidak ditemukan. Masuk kembali lalu coba lagi.");
      setSaving(false);
      return;
    }

    const now = new Date().toISOString();
    const payload = {
      title: form.title.trim(),
      slug,
      excerpt: form.excerpt.trim(),
      content_markdown: form.content_markdown,
      category: form.category.trim() || "Komik",
      cover_key: form.cover_key,
      seo_title: form.seo_title?.trim() || null,
      seo_description: form.seo_description?.trim() || null,
      author_name: form.author_name.trim() || "Tim MU-Komik",
      status: form.status,
      author_id: form.author_id || userData.user.id,
      published_at: form.status === "published" ? form.published_at || now : null,
    };

    const result = form.id
      ? await supabase.from("articles").update(payload).eq("id", form.id).select("id").single()
      : await supabase.from("articles").insert(payload).select("id").single();
    if (result.error) {
      console.error("Could not save article:", result.error);
      setError(result.error.code === "23505" ? "Slug sudah dipakai artikel lain." : `Artikel gagal disimpan: ${result.error.message}`);
      setSaving(false);
      return;
    }

    setForm((current) => ({ ...current, ...payload, id: result.data.id }));
    setMessage(form.status === "published" ? "Artikel berhasil diterbitkan." : "Draf berhasil disimpan.");
    setSaving(false);
    await loadArticles();
  }

  async function uploadCover(file: File | undefined) {
    if (!file || !form.id) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        setError("Sesi admin tidak ditemukan. Masuk kembali lalu coba lagi.");
        return;
      }
      const formData = new FormData();
      formData.set("articleId", form.id);
      formData.set("file", file);
      const response = await fetch("/api/r2/article-cover", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const result = await response.json() as { objectKey?: string; error?: string };
      if (!response.ok || !result.objectKey) {
        setError(result.error || "Cover artikel gagal diunggah.");
        return;
      }

      const oldCoverKey = form.cover_key;
      const { error: updateError } = await supabase.from("articles").update({ cover_key: result.objectKey }).eq("id", form.id);
      if (updateError) {
        console.error("Could not save uploaded article cover:", updateError);
        setError(`Cover sudah diunggah tetapi belum tersimpan pada artikel: ${updateError.message}`);
        return;
      }
      setForm((current) => ({ ...current, cover_key: result.objectKey ?? null }));
      setMessage("Cover artikel berhasil diunggah.");
      if (oldCoverKey) {
        const deleteResponse = await fetch("/api/r2/article-cover", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ articleId: form.id, objectKey: oldCoverKey }),
        });
        if (!deleteResponse.ok) {
          const deleteResult = await deleteResponse.json() as { error?: string };
          console.error("Could not remove replaced article cover:", deleteResult.error);
          setMessage("Cover baru tersimpan, tetapi cover lama belum dapat dihapus dari penyimpanan.");
        }
      }
      await loadArticles();
    } catch (uploadError) {
      console.error("Article cover upload request failed:", uploadError);
      setError(uploadError instanceof Error ? `Cover artikel gagal diunggah: ${uploadError.message}` : "Cover artikel gagal diunggah.");
    } finally {
      setUploading(false);
    }
  }

  const coverUrl = getArticleCoverUrl(form.cover_key);
  const visibleArticles = articles.filter((article) => {
    const matchesSearch = `${article.title} ${article.category} ${article.slug}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (statusFilter === "all" || article.status === statusFilter);
  });

  return (
    <div className="article-admin-layout">
      <section className="article-admin-list" aria-label="Daftar artikel">
        <div className="article-admin-list-heading">
          <div><strong>Artikel</strong><span>{articles.length} artikel</span></div>
          <button className="admin-action-button" type="button" onClick={startNewArticle}><Plus size={16} /> Artikel baru</button>
        </div>
        <div className="article-admin-list-filters">
          <input aria-label="Cari artikel" placeholder="Cari judul atau kategori…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="Filter status artikel" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | ArticleStatus)}>
            <option value="all">Semua status</option>
            <option value="draft">Draf</option>
            <option value="published">Terbit</option>
          </select>
        </div>
        {error && !form.title && <p className="admin-message article-admin-error" role="alert">{error}</p>}
        {loading ? <p className="article-admin-muted"><LoaderCircle className="spin" size={17} /> Memuat artikel…</p>
          : articles.length === 0 ? <p className="article-admin-muted">Belum ada artikel. Buat draf pertama untuk mulai menulis.</p>
            : visibleArticles.length === 0 ? <p className="article-admin-muted">Tidak ada artikel yang cocok dengan pencarian ini.</p>
              : <div className="article-admin-items">{visibleArticles.map((article) => (
              <button className={`article-admin-item${form.id === article.id ? " article-admin-item-selected" : ""}`} key={article.id} type="button" onClick={() => editArticle(article)}>
                <span className="article-admin-item-title">{article.title || "Tanpa judul"}</span>
                <span><small className={`article-admin-status article-admin-status-${article.status}`}>{article.status === "published" ? "Terbit" : "Draf"}</small><small>{formatArticleDate(article.published_at)}</small></span>
              </button>
            ))}</div>}
      </section>

      <section className="article-admin-editor" aria-label="Editor artikel">
        <div className="article-admin-editor-heading">
          <div><p className="eyebrow">CMS artikel</p><h2>{form.id ? "Edit artikel" : "Artikel baru"}</h2></div>
          {form.id && form.status === "published" && <a className="article-admin-view-link" href={`/artikel/${form.slug}`} target="_blank" rel="noreferrer"><Eye size={16} /> Lihat halaman</a>}
        </div>
        {error && <p className="admin-message article-admin-error" role="alert">{error}</p>}
        {message && <p className="admin-message" role="status">{message}</p>}
        <form className="article-admin-form" onSubmit={(event) => void saveArticle(event)}>
          <label className="admin-setting-field">Judul
            <input required maxLength={180} value={form.title} onChange={(event) => {
              const title = event.target.value;
              setForm((current) => ({ ...current, title, slug: slugManuallyEdited ? current.slug : slugify(title) }));
            }} />
          </label>
          <label className="admin-setting-field">Slug URL
            <input required maxLength={180} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(event) => {
              setSlugManuallyEdited(true);
              setForm((current) => ({ ...current, slug: slugify(event.target.value) }));
            }} />
          </label>
          <label className="admin-setting-field">Ringkasan
            <textarea required maxLength={320} rows={3} value={form.excerpt} onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))} />
          </label>
          <div className="article-admin-two-fields">
            <label className="admin-setting-field">Kategori
              <input maxLength={60} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
            </label>
            <label className="admin-setting-field">Nama penulis
              <input maxLength={100} value={form.author_name} onChange={(event) => setForm((current) => ({ ...current, author_name: event.target.value }))} />
            </label>
          </div>
          <div className="article-admin-two-fields">
            <label className="admin-setting-field">Status
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ArticleStatus }))}>
                <option value="draft">Draf</option>
                <option value="published">Terbit</option>
              </select>
            </label>
          </div>
          <label className="admin-setting-field">Judul SEO <small>Opsional; jika kosong, judul artikel digunakan.</small>
            <input maxLength={180} value={form.seo_title ?? ""} onChange={(event) => setForm((current) => ({ ...current, seo_title: event.target.value }))} />
          </label>
          <label className="admin-setting-field">Deskripsi SEO <small>Opsional; jika kosong, ringkasan artikel digunakan.</small>
            <textarea maxLength={320} rows={2} value={form.seo_description ?? ""} onChange={(event) => setForm((current) => ({ ...current, seo_description: event.target.value }))} />
          </label>
          <div className="admin-setting-field">
            <span>Cover artikel</span>
            {coverUrl && <img className="article-admin-cover-preview" src={coverUrl} alt="Pratinjau cover artikel" />}
            <label className={`article-admin-upload${!form.id ? " article-admin-upload-disabled" : ""}`}>
              <Upload size={16} /> {uploading ? "Mengunggah…" : form.cover_key ? "Ganti cover" : "Unggah cover"}
              <input type="file" accept="image/*" disabled={!form.id || uploading} onChange={(event) => {
                void uploadCover(event.target.files?.[0]);
                event.currentTarget.value = "";
              }} />
            </label>
            {!form.id && <small>Simpan draf terlebih dahulu untuk mengunggah cover.</small>}
          </div>
          <div className="article-admin-markdown-heading">
            <span>Isi artikel <small>Markdown, tanpa HTML mentah</small></span>
            <button type="button" className="article-admin-preview-toggle" onClick={() => setPreview((current) => !current)}><FileText size={15} /> {preview ? "Edit Markdown" : "Pratinjau"}</button>
          </div>
          {preview
            ? <div className="article-admin-markdown-preview"><MarkdownContent content={form.content_markdown || "_Pratinjau artikel akan muncul di sini._"} /></div>
            : <label className="reader-sr-only" htmlFor="article-markdown">Isi artikel dalam Markdown</label>}
          {!preview && <textarea id="article-markdown" className="article-admin-markdown-input" required rows={18} value={form.content_markdown} onChange={(event) => setForm((current) => ({ ...current, content_markdown: event.target.value }))} />}
          <div className="article-admin-form-actions">
            {form.id && <button className="article-admin-secondary-button" type="button" onClick={startNewArticle}><X size={16} /> Batal edit</button>}
            <button className="reader-primary-button" type="submit" disabled={saving || uploading}>{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{form.status === "published" ? "Simpan & terbitkan" : "Simpan draf"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
