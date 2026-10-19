"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ArrowLeft, Bold, Italic, LoaderCircle, MessageSquareText, Plus, Save, Smile, Trash2, Type, Underline } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createPageTextOverlay,
  PAGE_TEXT_BALLOON_SHAPES,
  PAGE_TEXT_BALLOON_TAIL_BASE_PATHS,
  PAGE_TEXT_BALLOON_TAIL_DIRECTIONS,
  PAGE_TEXT_BALLOON_TAIL_PATHS,
  parsePageTextOverlays,
  type PageTextOverlay,
  type PageTextOverlayType,
} from "@/lib/page-text-overlays";

const supabase = createClient();
const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
const pageTextEmojiGroups = [
  { label: "Ekspresi", emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "☺️", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🫢", "🫣", "🤫", "🤔", "🫡", "🤐"] },
  { label: "Perasaan", emojis: ["🤨", "😐", "😑", "😶", "🫥", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🥳", "🥸", "😎", "🤓", "🧐"] },
  { label: "Kaget & takut", emojis: ["😕", "🫤", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "🥹", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "😤"] },
  { label: "Marah & jahil", emojis: ["😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "👻", "👽", "🤖", "💩", "🤡", "👹", "👺", "😼", "😾", "🙀", "💢", "💥", "👊", "💣", "🗯️"] },
  { label: "Tangan & gestur", emojis: ["👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💪"] },
  { label: "Hati & kasih sayang", emojis: ["❤️", "🩷", "🧡", "💛", "💚", "🩵", "💙", "💜", "🤎", "🖤", "🩶", "🤍", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️", "😍", "🥰", "😘", "💋", "💌"] },
  { label: "Efek komik", emojis: ["💥", "💢", "💫", "💦", "💨", "🕳️", "💤", "✨", "⭐", "🌟", "⚡", "🔥", "☄️", "🎉", "🎊", "❗", "❓", "⁉️", "‼️", "〰️", "➰", "➿", "🔔", "🔕", "📢", "📣", "🗨️", "💬", "🗯️", "👁️", "👀"] },
  { label: "Hewan & alam", emojis: ["🐱", "🐈", "🐶", "🐕", "🐻", "🐼", "🐸", "🐵", "🙈", "🙉", "🙊", "🦊", "🐰", "🐯", "🦁", "🐷", "🐮", "🐔", "🐧", "🦉", "🐉", "🐲", "🦋", "🐝", "🌸", "🌹", "🌻", "🍀", "🌈", "☀️", "🌙", "⛈️", "❄️"] },
  { label: "Makanan & benda", emojis: ["🍎", "🍊", "🍋", "🍉", "🍇", "🍓", "🍒", "🍑", "🥑", "🍕", "🍜", "🍙", "🍡", "🍰", "🍩", "☕", "🧋", "⚔️", "🗡️", "🛡️", "🏹", "🔮", "💎", "📜", "📖", "🎭", "🎵", "🎶", "🏆", "🚀", "🧨", "🎁"] },
];

type PageRecord = { id: string; chapter_id: string; page_number: number; object_key: string; text_overlays: unknown };
type ChapterRecord = { id: string; title: string; comic_id: string };

export default function PageTextEditor() {
  const { comicId, chapterId, pageId } = useParams<{ comicId: string; chapterId: string; pageId: string }>();
  const router = useRouter();
  const [page, setPage] = useState<PageRecord | null>(null);
  const [chapter, setChapter] = useState<ChapterRecord | null>(null);
  const [comicTitle, setComicTitle] = useState("");
  const [overlays, setOverlays] = useState<PageTextOverlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState(2 / 3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savedOverlays, setSavedOverlays] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const textSelectionRef = useRef({ start: 0, end: 0 });
  const dragRef = useRef<{ id: string; pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const selectedOverlay = overlays.find((overlay) => overlay.id === selectedId) ?? null;
  const imageUrl = page && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${page.object_key}` : null;
  const backHref = `/account/komik/${encodeURIComponent(comicId)}`;
  const isDirty = JSON.stringify(overlays) !== savedOverlays;

  useEffect(() => {
    let active = true;

    async function loadPage() {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData.user) {
        if (authError) console.error("Unable to verify page editor session:", authError);
        router.replace("/login");
        return;
      }

      const [{ data: pageData, error: pageError }, { data: profile, error: profileError }] = await Promise.all([
        supabase.from("pages")
          .select("id, chapter_id, page_number, object_key, text_overlays")
          .eq("id", pageId)
          .maybeSingle(),
        supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle(),
      ]);
      if (pageError || profileError) {
        if (pageError) console.error("Unable to load page for text editing:", pageError);
        if (profileError) console.error("Unable to verify page editor role:", profileError);
        if (active) {
          setError(pageError?.code === "42703" || pageError?.code === "PGRST204"
            ? "Kolom teks halaman belum tersedia. Jalankan supabase/page-text-overlays.sql terlebih dahulu."
            : "Halaman belum dapat dimuat. Periksa koneksi lalu coba lagi.");
          setLoading(false);
        }
        return;
      }
      if (!pageData || profile?.role !== "creator") {
        if (active) {
          setError("Halaman ini hanya dapat diedit oleh kreator komik.");
          setLoading(false);
        }
        return;
      }

      const [{ data: chapterData, error: chapterError }, { data: comicData, error: comicError }] = await Promise.all([
        supabase.from("chapters").select("id, title, comic_id").eq("id", pageData.chapter_id).maybeSingle(),
        supabase.from("comics").select("id, title, creator_id").eq("id", comicId).maybeSingle(),
      ]);
      if (chapterError || comicError) {
        if (chapterError) console.error("Unable to verify page chapter:", chapterError);
        if (comicError) console.error("Unable to verify page comic:", comicError);
        if (active) {
          setError("Komik atau episode halaman belum dapat diverifikasi.");
          setLoading(false);
        }
        return;
      }
      if (!chapterData || !comicData || chapterData.comic_id !== comicData.id || pageData.chapter_id !== chapterId
        || comicData.creator_id !== userData.user.id) {
        if (active) {
          setError("Anda tidak memiliki akses untuk mengedit halaman komik ini.");
          setLoading(false);
        }
        return;
      }

      try {
        const storedOverlays = parsePageTextOverlays(pageData.text_overlays);
        if (!active) return;
        setPage(pageData);
        setChapter(chapterData);
        setComicTitle(comicData.title);
        setOverlays(storedOverlays);
        setSavedOverlays(JSON.stringify(storedOverlays));
        setSelectedId(storedOverlays[0]?.id ?? null);
      } catch (parseError) {
        console.error("Unable to parse page text overlays:", parseError);
        if (active) setError("Teks pada halaman ini memiliki format yang tidak valid. Hubungi admin untuk memperbaikinya.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPage();
    return () => { active = false; };
  }, [chapterId, comicId, pageId, router]);

  function updateOverlay(id: string, updates: Partial<Omit<PageTextOverlay, "id">>) {
    setOverlays((current) => current.map((overlay) => {
      if (overlay.id !== id) return overlay;
      const updated = { ...overlay, ...updates };
      if (updates.width !== undefined) {
        updated.x = Math.min(100 - updated.width / 2, Math.max(updated.width / 2, updated.x));
      }
      return updated;
    }));
    setMessage("");
  }

  function addOverlay(type: PageTextOverlayType) {
    const overlay = createPageTextOverlay(type);
    setOverlays((current) => [...current, overlay]);
    setSelectedId(overlay.id);
    setMessage("");
  }

  function updateTextSelection(textarea: HTMLTextAreaElement) {
    textSelectionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd };
  }

  function insertEmoji(emoji: string) {
    if (!selectedOverlay) return;
    const { start, end } = textSelectionRef.current;
    const availableLength = 500 - selectedOverlay.text.length + (end - start);
    if (emoji.length > availableLength) return;

    const text = `${selectedOverlay.text.slice(0, start)}${emoji}${selectedOverlay.text.slice(end)}`;
    const cursor = start + emoji.length;
    updateOverlay(selectedOverlay.id, { text });
    window.requestAnimationFrame(() => {
      textAreaRef.current?.focus();
      textAreaRef.current?.setSelectionRange(cursor, cursor);
      if (textAreaRef.current) updateTextSelection(textAreaRef.current);
    });
  }

  function startDragging(event: PointerEvent<HTMLDivElement>, overlay: PageTextOverlay) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(overlay.id);
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    dragRef.current = { id: overlay.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: overlay.x, top: overlay.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveOverlay(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !bounds) return;
    const overlay = overlays.find((item) => item.id === drag.id);
    if (!overlay) return;
    const x = drag.left + ((event.clientX - drag.x) / bounds.width) * 100;
    const y = drag.top + ((event.clientY - drag.y) / bounds.height) * 100;
    updateOverlay(drag.id, {
      x: Math.min(100 - overlay.width / 2, Math.max(overlay.width / 2, x)),
      y: Math.min(100, Math.max(0, y)),
    });
  }

  async function saveOverlays() {
    if (!page || saving || !isDirty) return;
    setSaving(true);
    setError("");
    setMessage("");
    const result = await supabase.from("pages").update({ text_overlays: overlays }).eq("id", page.id).select("id").maybeSingle();
    if (result.error || !result.data) {
      if (result.error) console.error("Unable to save page text overlays:", result.error);
      setError(result.error?.code === "42703" || result.error?.code === "PGRST204"
        ? "Kolom teks halaman belum tersedia. Jalankan supabase/page-text-overlays.sql terlebih dahulu."
        : "Perubahan teks halaman gagal disimpan. Pastikan Anda memiliki akses kreator untuk komik ini lalu coba lagi.");
      setSaving(false);
      return;
    }
    setSavedOverlays(JSON.stringify(overlays));
    setMessage("Teks halaman berhasil disimpan.");
    setSaving(false);
  }

  if (loading) {
    return <section className="page-text-editor-status"><LoaderCircle className="spin" size={24} /><p>Memuat halaman...</p></section>;
  }

  if (!page || !chapter || !imageUrl) {
    return (
      <section className="page-text-editor-status" role="alert">
        <p>{error || "Gambar halaman belum dapat ditampilkan. Periksa konfigurasi media komik."}</p>
        <Link className="button button-dark" href={backHref}>Kembali ke pengelolaan komik</Link>
      </section>
    );
  }

  return (
    <section className="page-text-editor" aria-label="Editor teks halaman komik">
      <header className="page-text-editor-header">
        <Link className="page-text-editor-back" href={backHref}><ArrowLeft size={17} /> Kembali ke komik</Link>
        <div>
          <p className="eyebrow">Editor teks halaman</p>
          <h1>{comicTitle}</h1>
          <p>{chapter.title} · Halaman {page.page_number}</p>
        </div>
        <button className="reader-primary-button" type="button" onClick={() => void saveOverlays()} disabled={saving || !isDirty}>
          {saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}
          {saving ? "Menyimpan..." : "Simpan perubahan"}
        </button>
      </header>

      <div className="page-text-editor-workspace">
        <section className="page-text-editor-canvas-panel" aria-label="Pratinjau halaman">
          <p className="page-text-editor-hint">Pilih balon atau narasi, lalu seret teks di atas halaman untuk mengatur posisinya.</p>
          <div className="page-text-editor-canvas" style={{ aspectRatio }}>
            <Image
              src={imageUrl}
              alt={`Pratinjau halaman ${page.page_number}`}
              fill
              unoptimized
              sizes="(max-width: 800px) 100vw, 760px"
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                if (naturalWidth > 0 && naturalHeight > 0) setAspectRatio(naturalWidth / naturalHeight);
              }}
            />
            <div className="page-text-overlay-layer page-text-overlay-edit-layer">
              {overlays.map((overlay) => (
                <div
                  key={overlay.id}
                  className={`page-text-overlay page-text-overlay-${overlay.type} page-text-level-${overlay.textLevel}${overlay.bold ? " page-text-bold" : ""}${overlay.italic ? " page-text-italic" : ""}${overlay.underline ? " page-text-underline" : ""}${overlay.type === "balloon" ? ` page-text-balloon-${overlay.shape} page-text-tail-${overlay.tailDirection}` : ""}${selectedId === overlay.id ? " is-selected" : ""}`}
                  style={{
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    width: `${overlay.width}%`,
                    "--page-text-font-size": `${overlay.fontSize}cqw`,
                    "--page-text-color": overlay.textColor,
                  } as CSSProperties}
                  role="button"
                  tabIndex={0}
                  aria-label={`Pindahkan ${overlay.type === "balloon" ? "balon dialog" : "narasi"}: ${overlay.text || "teks kosong"}`}
                  onClick={() => setSelectedId(overlay.id)}
                  onPointerDown={(event) => startDragging(event, overlay)}
                  onPointerMove={moveOverlay}
                  onPointerUp={() => { dragRef.current = null; }}
                  onPointerCancel={() => { dragRef.current = null; }}
                  onKeyDown={(event) => {
                    const step = event.shiftKey ? 2 : 0.5;
                    if (event.key.startsWith("Arrow")) event.preventDefault();
                    if (event.key === "ArrowLeft") updateOverlay(overlay.id, { x: Math.max(overlay.width / 2, overlay.x - step) });
                    if (event.key === "ArrowRight") updateOverlay(overlay.id, { x: Math.min(100 - overlay.width / 2, overlay.x + step) });
                    if (event.key === "ArrowUp") updateOverlay(overlay.id, { y: Math.max(0, overlay.y - step) });
                    if (event.key === "ArrowDown") updateOverlay(overlay.id, { y: Math.min(100, overlay.y + step) });
                  }}
                >
                  {overlay.type === "balloon" && overlay.shape === "speech" && (
                    <svg className="page-text-balloon-tail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      <path d={PAGE_TEXT_BALLOON_TAIL_PATHS[overlay.tailDirection]} />
                      <path className="page-text-balloon-tail-base" d={PAGE_TEXT_BALLOON_TAIL_BASE_PATHS[overlay.tailDirection]} />
                    </svg>
                  )}
                  <span>{overlay.text || (overlay.type === "balloon" ? "Dialog" : "Narasi")}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="page-text-editor-tools" aria-label="Alat teks halaman">
          <h2>Tambah teks</h2>
          <div className="page-text-editor-add-actions">
            <button type="button" onClick={() => addOverlay("balloon")}><MessageSquareText size={17} /> Balon dialog</button>
            <button type="button" onClick={() => addOverlay("narration")}><Plus size={17} /> Kotak narasi</button>
          </div>
          <p className="page-text-editor-tool-hint">Geser teks di pratinjau. Gunakan tombol panah setelah memilih teks untuk mengatur posisi lebih presisi.</p>
          {selectedOverlay ? (
            <div className="page-text-editor-selected">
              <div className="page-text-editor-selected-title">
                {selectedOverlay.type === "balloon" ? <MessageSquareText size={17} /> : <Type size={17} />}
                <h3>{selectedOverlay.type === "balloon" ? "Balon dialog" : "Kotak narasi"}</h3>
                <button
                  type="button"
                  className="page-text-editor-delete"
                  aria-label="Hapus teks terpilih"
                  onClick={() => {
                    setOverlays((current) => current.filter((item) => item.id !== selectedOverlay.id));
                    setSelectedId(null);
                    setMessage("");
                  }}
                ><Trash2 size={16} /></button>
              </div>
              <label>
                Isi teks
                <textarea
                  ref={textAreaRef}
                  rows={5}
                  maxLength={500}
                  value={selectedOverlay.text}
                  onChange={(event) => {
                    updateTextSelection(event.currentTarget);
                    updateOverlay(selectedOverlay.id, { text: event.target.value });
                  }}
                  onSelect={(event) => updateTextSelection(event.currentTarget)}
                  onKeyUp={(event) => updateTextSelection(event.currentTarget)}
                  onClick={(event) => updateTextSelection(event.currentTarget)}
                  onBlur={(event) => updateTextSelection(event.currentTarget)}
                  placeholder="Tulis dialog atau narasi..."
                />
              </label>
              <div className="page-text-emoji-tools">
                <button
                  className="page-text-emoji-toggle"
                  type="button"
                  aria-expanded={emojiPickerOpen}
                  aria-controls="page-text-emoji-picker"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setEmojiPickerOpen((open) => !open)}
                >
                  <Smile size={16} /> Tambah emoji
                </button>
                {emojiPickerOpen && (
                  <div className="page-text-emoji-picker" id="page-text-emoji-picker" aria-label="Pilih emoji">
                    {pageTextEmojiGroups.map((group) => (
                      <section className="page-text-emoji-group" key={group.label} aria-label={group.label}>
                        <h4>{group.label}</h4>
                        <div>
                          {group.emojis.map((emoji, index) => (
                            <button
                              key={`${emoji}-${index}`}
                              type="button"
                              aria-label={`Sisipkan emoji ${emoji}`}
                              title={`Sisipkan ${emoji}`}
                              disabled={selectedOverlay.text.length + emoji.length > 500}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => insertEmoji(emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
              {selectedOverlay.type === "balloon" && (
                <>
                  <label>
                    Bentuk balon
                    <select
                      value={selectedOverlay.shape}
                      onChange={(event) => updateOverlay(selectedOverlay.id, { shape: event.target.value as PageTextOverlay["shape"] })}
                    >
                      {PAGE_TEXT_BALLOON_SHAPES.map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}
                    </select>
                  </label>
                  {selectedOverlay.shape !== "inner" && selectedOverlay.shape !== "none" && (
                    <label>
                      {selectedOverlay.shape === "thought" ? "Arah gelembung pikiran" : "Arah ujung balon"}
                      <select
                        value={selectedOverlay.tailDirection}
                        onChange={(event) => updateOverlay(selectedOverlay.id, { tailDirection: event.target.value as PageTextOverlay["tailDirection"] })}
                      >
                        {PAGE_TEXT_BALLOON_TAIL_DIRECTIONS.map((direction) => <option key={direction.value} value={direction.value}>{direction.label}</option>)}
                      </select>
                    </label>
                  )}
                </>
              )}
              <label>
                Warna teks
                <span className="page-text-color-control">
                  <input
                    type="color"
                    aria-label="Warna teks"
                    value={selectedOverlay.textColor}
                    onChange={(event) => updateOverlay(selectedOverlay.id, { textColor: event.target.value })}
                  />
                  <code>{selectedOverlay.textColor.toUpperCase()}</code>
                </span>
              </label>
              <label>
                Jenis teks
                <select
                  value={selectedOverlay.textLevel}
                  onChange={(event) => updateOverlay(selectedOverlay.id, { textLevel: event.target.value as PageTextOverlay["textLevel"] })}
                >
                  <option value="body">Teks biasa</option>
                  <option value="h1">H1 — Judul besar</option>
                  <option value="h2">H2 — Judul sedang</option>
                  <option value="h3">H3 — Judul kecil</option>
                </select>
              </label>
              <div className="page-text-inline-format" role="group" aria-label="Format teks">
                <button
                  type="button"
                  aria-label="Tebal"
                  aria-pressed={selectedOverlay.bold}
                  onClick={() => updateOverlay(selectedOverlay.id, { bold: !selectedOverlay.bold })}
                ><Bold size={17} /></button>
                <button
                  type="button"
                  aria-label="Miring"
                  aria-pressed={selectedOverlay.italic}
                  onClick={() => updateOverlay(selectedOverlay.id, { italic: !selectedOverlay.italic })}
                ><Italic size={17} /></button>
                <button
                  type="button"
                  aria-label="Garis bawah"
                  aria-pressed={selectedOverlay.underline}
                  onClick={() => updateOverlay(selectedOverlay.id, { underline: !selectedOverlay.underline })}
                ><Underline size={17} /></button>
              </div>
              <label>
                Lebar
                <input type="range" min="12" max="80" step="1" value={selectedOverlay.width} onChange={(event) => updateOverlay(selectedOverlay.id, { width: Number(event.target.value) })} />
              </label>
              <label>
                Ukuran teks
                <input type="range" min="1.5" max="8" step="0.1" value={selectedOverlay.fontSize} onChange={(event) => updateOverlay(selectedOverlay.id, { fontSize: Number(event.target.value) })} />
              </label>
            </div>
          ) : (
            <p className="page-text-editor-empty">Belum ada teks. Tambahkan balon dialog atau kotak narasi untuk memulai.</p>
          )}
          {error && <p className="page-text-editor-error" role="alert">{error}</p>}
          {message && <p className="page-text-editor-message" role="status">{message}</p>}
        </aside>
      </div>
      <div className="reader-sr-only" aria-live="polite">{message}</div>
    </section>
  );
}
