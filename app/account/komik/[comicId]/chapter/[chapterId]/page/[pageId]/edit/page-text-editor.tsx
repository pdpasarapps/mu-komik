"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ArrowLeft, Bold, Eye, EyeOff, Italic, LoaderCircle, MessageSquareText, MousePointer2, Plus, Save, Smile, Trash2, Type, Underline, Volume2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createPageInteractiveMarker,
  createPageTextOverlay,
  PAGE_TEXT_BALLOON_SHAPES,
  PAGE_TEXT_FONTS,
  PAGE_TEXT_BALLOON_TAIL_BASE_PATHS,
  PAGE_TEXT_BALLOON_TAIL_DIRECTIONS,
  PAGE_TEXT_BALLOON_TAIL_PATHS,
  parsePageTextOverlayDocument,
  serializePageTextOverlayDocument,
  type PageTextImageVerticalAlign,
  type PageInteractiveEffect,
  type PageInteractiveMarker,
  type PageTextOverlay,
  type PageTextOverlayType,
} from "@/lib/page-text-overlays";

const supabase = createClient();
const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
const pageTextEmojiGroups = [
  { label: "Ekspresi", emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "☺️", "😚", "😙", "😢", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "😮", "👀", "🤫", "🤔", "👋", "🤐"] },
  { label: "Perasaan", emojis: ["🤨", "😐", "😑", "😶", "😶", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🥳", "😎", "😎", "🤓", "🧐"] },
  { label: "Kaget & takut", emojis: ["😕", "😑", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😥", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "😤"] },
  { label: "Marah & jahil", emojis: ["😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "👻", "👽", "🤖", "💩", "🤡", "👹", "👺", "😼", "😾", "🙀", "💢", "💥", "👊", "💣", "🗯️"] },
  { label: "Tangan & gestur", emojis: ["👋", "🤚", "🖐️", "✋", "🖖", "👉", "👈", "👇", "🤲", "👌", "👌", "🤏", "✌️", "🤞", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💪"] },
  { label: "Hati & kasih sayang", emojis: ["❤️", "💗", "🧡", "💛", "💚", "💙", "💙", "💜", "🤎", "🖤", "🖤", "🤍", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️", "😍", "🥰", "😘", "💋", "💌"] },
  { label: "Efek komik", emojis: ["💥", "💢", "💫", "💦", "💨", "🕳️", "💤", "✨", "⭐", "🌟", "⚡", "🔥", "☄️", "🎉", "🎊", "❗", "❓", "⁉️", "‼️", "〰️", "➰", "➿", "🔔", "🔕", "📢", "📣", "🗨️", "💬", "🗯️", "👁️", "👀"] },
  { label: "Hewan & alam", emojis: ["🐱", "🐈", "🐶", "🐕", "🐻", "🐼", "🐸", "🐵", "🙈", "🙉", "🙊", "🦊", "🐰", "🐯", "🦁", "🐷", "🐮", "🐔", "🐧", "🦉", "🐉", "🐲", "🦋", "🐝", "🌸", "🌹", "🌻", "🍀", "🌈", "☀️", "🌙", "⛈️", "❄️"] },
  { label: "Makanan & benda", emojis: ["🍎", "🍊", "🍋", "🍉", "🍇", "🍓", "🍒", "🍑", "🥑", "🍕", "🍜", "🍙", "🍡", "🍰", "🍩", "☕", "🍵", "⚔️", "🗡️", "🛡️", "🏹", "🔮", "💎", "📜", "📖", "🎭", "🎵", "🎶", "🏆", "🚀", "🧨", "🎁"] },
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
  const [interactiveMarkers, setInteractiveMarkers] = useState<PageInteractiveMarker[]>([]);
  const [imageVerticalAlign, setImageVerticalAlign] = useState<PageTextImageVerticalAlign>("center");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "tablet">("mobile");
  const [pageAspectRatio, setPageAspectRatio] = useState(3 / 4);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savedDocument, setSavedDocument] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [uploadingMarkerAudio, setUploadingMarkerAudio] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const textSelectionRef = useRef({ start: 0, end: 0 });
  const dragRef = useRef<{ id: string; pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const markerDragRef = useRef<{ id: string; pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const pendingMarkerAudioKeysRef = useRef(new Set<string>());
  const selectedOverlay = overlays.find((overlay) => overlay.id === selectedId) ?? null;
  const selectedMarker = interactiveMarkers.find((marker) => marker.id === selectedMarkerId) ?? null;
  const imageUrl = page && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${page.object_key}` : null;
  const backHref = `/account/komik/${encodeURIComponent(comicId)}`;
  const isDirty = serializePageTextOverlayDocument({ overlays, interactiveMarkers, imageVerticalAlign }) !== savedDocument;

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmInternalNavigation = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a");
      if (!(link instanceof HTMLAnchorElement)) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || link.target === "_blank" || link.hasAttribute("download")) return;
      if (link.origin !== window.location.origin) return;
      if (!window.confirm("Ada perubahan yang belum disimpan. Tinggalkan halaman tanpa menyimpan?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", confirmInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", confirmInternalNavigation, true);
    };
  }, [isDirty]);

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
        const storedDocument = parsePageTextOverlayDocument(pageData.text_overlays);
        const storedOverlays = storedDocument.overlays;
        if (!active) return;
        setPage(pageData);
        setChapter(chapterData);
        setComicTitle(comicData.title);
        setOverlays(storedOverlays);
        setInteractiveMarkers(storedDocument.interactiveMarkers);
        setImageVerticalAlign(storedDocument.imageVerticalAlign);
        setSavedDocument(serializePageTextOverlayDocument(storedDocument));
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
      if (updates.mobileWidth !== undefined) {
        updated.mobileX = Math.min(100 - updated.mobileWidth / 2, Math.max(updated.mobileWidth / 2, updated.mobileX));
      }
      return updated;
    }));
    setMessage("");
  }

  function addOverlay(type: PageTextOverlayType) {
    const overlay = createPageTextOverlay(type);
    setOverlays((current) => [...current, overlay]);
    setSelectedMarkerId(null);
    setSelectedId(overlay.id);
    setMessage("");
  }

  function updateImageVerticalAlign(imageVerticalAlign: PageTextImageVerticalAlign) {
    setImageVerticalAlign(imageVerticalAlign);
    setMessage("");
  }

  function removeOverlay(id: string) {
    setOverlays((current) => current.filter((overlay) => overlay.id !== id));
    setSelectedId((current) => current === id ? null : current);
    setMessage("");
  }

  function updateInteractiveMarker(id: string, updates: Partial<Omit<PageInteractiveMarker, "id">>) {
    setInteractiveMarkers((current) => current.map((marker) => {
      if (marker.id !== id) return marker;
      const updated = { ...marker, ...updates };
      if (updates.width !== undefined || updates.x !== undefined) updated.x = Math.min(100 - updated.width / 2, Math.max(updated.width / 2, updated.x));
      if (updates.height !== undefined || updates.y !== undefined) updated.y = Math.min(100 - updated.height / 2, Math.max(updated.height / 2, updated.y));
      return updated;
    }));
    setMessage("");
  }

  function addInteractiveMarker() {
    const marker = createPageInteractiveMarker();
    setInteractiveMarkers((current) => [...current, marker]);
    setSelectedId(null);
    setSelectedMarkerId(marker.id);
    setMessage("");
  }

  async function deleteUnattachedMarkerAudio(objectKey: string) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (sessionError || !token) {
      if (sessionError) console.error("Unable to verify session for marker audio cleanup:", sessionError);
      return false;
    }
    const response = await fetch("/api/r2/page-interactive-audio", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pageId: page?.id, objectKey }),
    });
    if (!response.ok) {
      console.error("Unable to clean up unused marker audio:", await response.text());
      return false;
    }
    return true;
  }

  async function removeInteractiveMarker(id: string) {
    const marker = interactiveMarkers.find((item) => item.id === id);
    setInteractiveMarkers((current) => current.filter((item) => item.id !== id));
    setSelectedMarkerId((current) => current === id ? null : current);
    setMessage("");
    if (!marker?.soundObjectKey) return;
    const savedKeys = new Set(parsePageTextOverlayDocument(JSON.parse(savedDocument)).interactiveMarkers.map((item) => item.soundObjectKey));
    if (!savedKeys.has(marker.soundObjectKey)) {
      if (!await deleteUnattachedMarkerAudio(marker.soundObjectKey)) {
        setMessage("Area dihapus, tetapi berkas suara yang belum disimpan belum dapat dibersihkan.");
      } else {
        pendingMarkerAudioKeysRef.current.delete(marker.soundObjectKey);
      }
    }
  }

  function startDraggingMarker(event: PointerEvent<HTMLButtonElement>, marker: PageInteractiveMarker) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(null);
    setSelectedMarkerId(marker.id);
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    markerDragRef.current = {
      id: marker.id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: marker.x,
      top: marker.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveInteractiveMarker(event: PointerEvent<HTMLButtonElement>) {
    const drag = markerDragRef.current;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !bounds) return;
    const marker = interactiveMarkers.find((item) => item.id === drag.id);
    if (!marker) return;
    updateInteractiveMarker(marker.id, {
      x: Math.min(100 - marker.width / 2, Math.max(marker.width / 2, drag.left + ((event.clientX - drag.x) / bounds.width) * 100)),
      y: Math.min(100 - marker.height / 2, Math.max(marker.height / 2, drag.top + ((event.clientY - drag.y) / bounds.height) * 100)),
    });
  }

  async function uploadMarkerAudio(file: File) {
    if (!page || !selectedMarker) return;
    setUploadingMarkerAudio(true);
    setError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error("Sesi kreator tidak dapat diverifikasi. Silakan masuk kembali.");
      const form = new FormData();
      form.append("pageId", page.id);
      form.append("file", file);
      const response = await fetch("/api/r2/page-interactive-audio", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" || !("objectKey" in result) || typeof result.objectKey !== "string") {
        throw new Error(result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : "Suara interaktif gagal diunggah.");
      }
      pendingMarkerAudioKeysRef.current.add(result.objectKey);
      updateInteractiveMarker(selectedMarker.id, { soundObjectKey: result.objectKey });
      setMessage("Suara marker berhasil diunggah. Simpan perubahan halaman untuk menerapkannya.");
    } catch (uploadError) {
      console.error("Unable to upload interactive marker sound:", uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "Suara interaktif gagal diunggah.");
    } finally {
      setUploadingMarkerAudio(false);
    }
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
    dragRef.current = {
      id: overlay.id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: previewDevice === "mobile" ? overlay.mobileX : overlay.x,
      top: previewDevice === "mobile" ? overlay.mobileY : overlay.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveOverlay(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !bounds) return;
    const overlay = overlays.find((item) => item.id === drag.id);
    if (!overlay) return;
    const width = previewDevice === "mobile" ? overlay.mobileWidth : overlay.width;
    const x = drag.left + ((event.clientX - drag.x) / bounds.width) * 100;
    const y = drag.top + ((event.clientY - drag.y) / bounds.height) * 100;
    if (previewDevice === "mobile") {
      updateOverlay(drag.id, {
        mobileX: Math.min(100 - width / 2, Math.max(width / 2, x)),
        mobileY: Math.min(100, Math.max(0, y)),
      });
    } else {
      updateOverlay(drag.id, {
        x: Math.min(100 - width / 2, Math.max(width / 2, x)),
        y: Math.min(100, Math.max(0, y)),
      });
    }
  }

  async function saveOverlays() {
    if (!page || saving || !isDirty) return;
    setSaving(true);
    setError("");
    setMessage("");
    const document = { overlays, interactiveMarkers, imageVerticalAlign };
    const serializedDocument = serializePageTextOverlayDocument(document);
    const result = await supabase.from("pages").update({ text_overlays: JSON.parse(serializedDocument) }).eq("id", page.id).select("id").maybeSingle();
    if (result.error || !result.data) {
      if (result.error) console.error("Unable to save page text overlays:", result.error);
      setError(result.error?.code === "23514"
        ? "Database menolak format teks halaman terbaru. Jalankan supabase/page-text-overlays.sql, lalu coba simpan lagi."
        : result.error?.code === "42703" || result.error?.code === "PGRST204"
        ? "Kolom teks halaman belum tersedia. Jalankan supabase/page-text-overlays.sql terlebih dahulu."
        : "Perubahan teks halaman gagal disimpan. Pastikan Anda memiliki akses kreator untuk komik ini lalu coba lagi.");
      setSaving(false);
      return;
    }
    const previousDocument = parsePageTextOverlayDocument(JSON.parse(savedDocument));
    setSavedDocument(serializedDocument);
    setMessage("Teks halaman berhasil disimpan.");
    setSaving(false);
    const nextAudioKeys = new Set(interactiveMarkers.map((marker) => marker.soundObjectKey).filter((key): key is string => key !== null));
    const removedAudioKeys = new Set(previousDocument.interactiveMarkers
      .map((marker) => marker.soundObjectKey)
      .filter((key): key is string => key !== null && !nextAudioKeys.has(key)));
    for (const key of pendingMarkerAudioKeysRef.current) {
      if (!nextAudioKeys.has(key)) removedAudioKeys.add(key);
    }
    if (removedAudioKeys.size) {
      const cleanupResults = await Promise.all([...removedAudioKeys].map(async (key) => ({
        key,
        cleaned: await deleteUnattachedMarkerAudio(key),
      })));
      cleanupResults.filter(({ cleaned }) => cleaned).forEach(({ key }) => pendingMarkerAudioKeysRef.current.delete(key));
      if (cleanupResults.some(({ cleaned }) => !cleaned)) {
        setMessage("Perubahan tersimpan, tetapi beberapa berkas suara lama belum dapat dibersihkan.");
      }
    }
    nextAudioKeys.forEach((key) => pendingMarkerAudioKeysRef.current.delete(key));
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
          <p className="page-text-editor-hint">Atur posisi teks untuk tiap tampilan. Gambar tidak dipotong; ruang kosong pada ponsel dapat dipakai untuk teks.</p>
          <div className="page-text-editor-preview-switch" role="group" aria-label="Tampilan pratinjau">
            <button type="button" aria-pressed={previewDevice === "mobile"} onClick={() => setPreviewDevice("mobile")}>Ponsel · 9:16</button>
            <button type="button" aria-pressed={previewDevice === "tablet"} onClick={() => setPreviewDevice("tablet")}>Tablet · rasio gambar</button>
          </div>
          <div className={`page-text-editor-canvas page-text-editor-canvas-preview-${previewDevice}`} style={{ aspectRatio: previewDevice === "mobile" ? "9 / 16" : pageAspectRatio }}>
            <Image
              src={imageUrl}
              alt={`Pratinjau halaman ${page.page_number}`}
              fill
              unoptimized
              sizes="(max-width: 800px) 100vw, 760px"
              style={{ objectPosition: `center ${imageVerticalAlign}` }}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                if (naturalWidth > 0 && naturalHeight > 0) setPageAspectRatio(naturalWidth / naturalHeight);
              }}
            />
            <div className="page-text-overlay-layer page-text-overlay-edit-layer">
              {overlays.map((overlay) => (
                <div
                  key={overlay.id}
                  className={`page-text-overlay page-text-overlay-${overlay.type}${overlay.showOnMobile ? "" : " page-text-hide-mobile"}${overlay.showOnTablet ? "" : " page-text-hide-tablet"} page-text-font-${overlay.font} page-text-level-${overlay.textLevel}${overlay.bold ? " page-text-bold" : ""}${overlay.italic ? " page-text-italic" : ""}${overlay.underline ? " page-text-underline" : ""}${overlay.type === "balloon" ? ` page-text-balloon-${overlay.shape} page-text-tail-${overlay.tailDirection}` : ""}${selectedId === overlay.id ? " is-selected" : ""}`}
                  style={{
                    left: `${previewDevice === "mobile" ? overlay.mobileX : overlay.x}%`,
                    top: `${previewDevice === "mobile" ? overlay.mobileY : overlay.y}%`,
                    width: `${previewDevice === "mobile" ? overlay.mobileWidth : overlay.width}%`,
                    display: previewDevice === "mobile"
                      ? (overlay.showOnMobile ? "grid" : "none")
                      : (overlay.showOnTablet ? "grid" : "none"),
                    "--page-text-font-size": `${overlay.fontSize}cqw`,
                    "--page-text-color": overlay.textColor,
                  } as CSSProperties}
                  role="button"
                  tabIndex={0}
                  aria-label={`Pindahkan ${overlay.type === "balloon" ? "balon dialog" : "narasi"}: ${overlay.text || "teks kosong"}`}
                  onClick={() => { setSelectedId(overlay.id); setSelectedMarkerId(null); }}
                  onPointerDown={(event) => startDragging(event, overlay)}
                  onPointerMove={moveOverlay}
                  onPointerUp={() => { dragRef.current = null; }}
                  onPointerCancel={() => { dragRef.current = null; }}
                  onKeyDown={(event) => {
                    const step = event.shiftKey ? 2 : 0.5;
                    const x = previewDevice === "mobile" ? overlay.mobileX : overlay.x;
                    const y = previewDevice === "mobile" ? overlay.mobileY : overlay.y;
                    const width = previewDevice === "mobile" ? overlay.mobileWidth : overlay.width;
                    const positionUpdates = (nextX: number, nextY: number) => previewDevice === "mobile"
                      ? { mobileX: nextX, mobileY: nextY }
                      : { x: nextX, y: nextY };
                    if (event.key.startsWith("Arrow")) event.preventDefault();
                    if (event.key === "ArrowLeft") updateOverlay(overlay.id, positionUpdates(Math.max(width / 2, x - step), y));
                    if (event.key === "ArrowRight") updateOverlay(overlay.id, positionUpdates(Math.min(100 - width / 2, x + step), y));
                    if (event.key === "ArrowUp") updateOverlay(overlay.id, positionUpdates(x, Math.max(0, y - step)));
                    if (event.key === "ArrowDown") updateOverlay(overlay.id, positionUpdates(x, Math.min(100, y + step)));
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
              {interactiveMarkers.map((marker, index) => (
                <button
                  key={marker.id}
                  type="button"
                  className={`page-interactive-marker page-interactive-marker-edit${selectedMarkerId === marker.id ? " is-selected" : ""}`}
                  aria-label={`Pindahkan area interaktif ${index + 1}`}
                  style={{
                    left: `${marker.x}%`,
                    top: `${marker.y}%`,
                    width: `${marker.width}%`,
                    height: `${marker.height}%`,
                  }}
                  onPointerDown={(event) => startDraggingMarker(event, marker)}
                  onPointerMove={moveInteractiveMarker}
                  onPointerUp={() => { markerDragRef.current = null; }}
                  onPointerCancel={() => { markerDragRef.current = null; }}
                  onClick={() => { setSelectedMarkerId(marker.id); setSelectedId(null); }}
                >
                  <span aria-hidden="true"><MousePointer2 size={17} /></span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="page-text-editor-tools" aria-label="Alat teks halaman">
          <h2>Tambah teks</h2>
          <div className="page-text-editor-add-actions">
            <button type="button" onClick={() => addOverlay("balloon")}><MessageSquareText size={17} /> Balon dialog</button>
            <button type="button" onClick={() => addOverlay("narration")}><Plus size={17} /> Kotak narasi</button>
            <button type="button" className="page-text-editor-marker-action" onClick={addInteractiveMarker}><MousePointer2 size={17} /> Area interaktif</button>
          </div>
          <p className="page-text-editor-tool-hint">Geser teks di pratinjau. Gunakan tombol panah setelah memilih teks untuk mengatur posisi lebih presisi.</p>
          <label className="page-text-editor-page-setting">
            Posisi vertikal gambar halaman
            <select
              value={imageVerticalAlign}
              aria-label="Posisi vertikal gambar halaman"
              onChange={(event) => updateImageVerticalAlign(event.target.value as PageTextImageVerticalAlign)}
            >
              <option value="top">Atas</option>
              <option value="center">Tengah</option>
              <option value="bottom">Bawah</option>
            </select>
          </label>
          {(overlays.length > 0 || interactiveMarkers.length > 0) && (
            <section className="page-text-overlay-list" aria-label="Lapisan halaman">
              <h3>Lapisan halaman ({overlays.length + interactiveMarkers.length})</h3>
              <ul>
                {overlays.map((overlay, index) => {
                  const visible = previewDevice === "mobile" ? overlay.showOnMobile : overlay.showOnTablet;
                  return (
                    <li key={overlay.id}>
                      <button
                        type="button"
                        className="page-text-overlay-list-select"
                        aria-pressed={selectedId === overlay.id && !selectedMarkerId}
                        aria-label={`Pilih ${overlay.type === "balloon" ? "balon dialog" : "narasi"} ${index + 1}, ${visible ? "tampil" : "disembunyikan"} di ${previewDevice === "mobile" ? "ponsel" : "tablet"}`}
                        onClick={() => { setSelectedId(overlay.id); setSelectedMarkerId(null); }}
                      >
                        {visible ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
                        <span>{index + 1}. {overlay.type === "balloon" ? "Balon" : "Narasi"} — {overlay.text.trim() || "Teks kosong"}</span>
                      </button>
                      <button
                        type="button"
                        className="page-text-editor-delete"
                        aria-label={`Hapus ${overlay.type === "balloon" ? "balon" : "narasi"} ${index + 1}`}
                        onClick={() => removeOverlay(overlay.id)}
                      ><Trash2 size={15} /></button>
                    </li>
                  );
                })}
                {interactiveMarkers.map((marker, index) => (
                  <li key={marker.id}>
                    <button
                      type="button"
                      className="page-text-overlay-list-select"
                      aria-pressed={selectedMarkerId === marker.id}
                      aria-label={`Pilih area interaktif ${index + 1}`}
                      onClick={() => { setSelectedMarkerId(marker.id); setSelectedId(null); }}
                    >
                      <MousePointer2 size={15} aria-hidden="true" />
                      <span>{index + 1}. Area interaktif{marker.soundObjectKey ? " · suara" : ""} · efek {marker.effect}</span>
                    </button>
                    <button
                      type="button"
                      className="page-text-editor-delete"
                      aria-label={`Hapus area interaktif ${index + 1}`}
                      onClick={() => void removeInteractiveMarker(marker.id)}
                    ><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
              <p className="page-text-editor-tool-hint">
                {previewDevice === "mobile" ? "Ponsel" : "Tablet"}: ikon mata menandai teks yang tampil pada pratinjau ini.
              </p>
            </section>
          )}
          {selectedMarker ? (
            <div className="page-text-editor-selected">
              <div className="page-text-editor-selected-title">
                <MousePointer2 size={17} />
                <h3>Area interaktif</h3>
                <button
                  type="button"
                  className="page-text-editor-delete"
                  aria-label="Hapus area interaktif terpilih"
                  onClick={() => void removeInteractiveMarker(selectedMarker.id)}
                ><Trash2 size={16} /></button>
              </div>
              <p className="page-text-editor-tool-hint">Geser area pada pratinjau. Area transparan ini menjalankan aksi saat diketuk pembaca.</p>
              <label>
                Efek visual
                <select
                  value={selectedMarker.effect}
                  onChange={(event) => updateInteractiveMarker(selectedMarker.id, { effect: event.target.value as PageInteractiveEffect })}
                >
                  <option value="none">Tanpa efek</option>
                  <option value="sparkle">Kilau</option>
                  <option value="impact">Benturan</option>
                  <option value="shake">Getar</option>
                </select>
              </label>
              <label>
                Posisi horizontal
                <input
                  type="range"
                  min={selectedMarker.width / 2}
                  max={100 - selectedMarker.width / 2}
                  step="0.5"
                  value={selectedMarker.x}
                  onChange={(event) => updateInteractiveMarker(selectedMarker.id, { x: Number(event.target.value) })}
                />
              </label>
              <label>
                Posisi vertikal
                <input
                  type="range"
                  min={selectedMarker.height / 2}
                  max={100 - selectedMarker.height / 2}
                  step="0.5"
                  value={selectedMarker.y}
                  onChange={(event) => updateInteractiveMarker(selectedMarker.id, { y: Number(event.target.value) })}
                />
              </label>
              <label>
                Lebar area
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="1"
                  value={selectedMarker.width}
                  onChange={(event) => updateInteractiveMarker(selectedMarker.id, { width: Number(event.target.value) })}
                />
              </label>
              <label>
                Tinggi area
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="1"
                  value={selectedMarker.height}
                  onChange={(event) => updateInteractiveMarker(selectedMarker.id, { height: Number(event.target.value) })}
                />
              </label>
              <label className="page-text-marker-audio-upload">
                <span>Suara (MP3, maks. 10 MB)</span>
                <input
                  type="file"
                  accept="audio/mpeg,.mp3"
                  disabled={uploadingMarkerAudio}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (file) void uploadMarkerAudio(file);
                  }}
                />
              </label>
              {uploadingMarkerAudio && <p className="page-text-editor-tool-hint" role="status">Mengunggah suara...</p>}
              {selectedMarker.soundObjectKey && (
                <div className="page-text-marker-audio-actions">
                  <span><Volume2 size={15} /> Suara MP3 terpasang</span>
                  <button type="button" onClick={() => updateInteractiveMarker(selectedMarker.id, { soundObjectKey: null })}>Lepas suara</button>
                </div>
              )}
              <p className="page-text-editor-tool-hint">Efek suara tidak diputar otomatis; pembaca perlu mengetuk area marker.</p>
            </div>
          ) : selectedOverlay ? (
            <div className="page-text-editor-selected">
              <div className="page-text-editor-selected-title">
                {selectedOverlay.type === "balloon" ? <MessageSquareText size={17} /> : <Type size={17} />}
                <h3>{selectedOverlay.type === "balloon" ? "Balon dialog" : "Kotak narasi"}</h3>
                <button
                  type="button"
                  className="page-text-editor-delete"
                  aria-label="Hapus teks terpilih"
                  onClick={() => removeOverlay(selectedOverlay.id)}
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
              <fieldset className="page-text-device-visibility-fieldset">
                <legend>Tampilkan di perangkat</legend>
                <div className="page-text-device-visibility">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedOverlay.showOnMobile}
                      onChange={(event) => updateOverlay(selectedOverlay.id, { showOnMobile: event.target.checked })}
                    />
                    Ponsel
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedOverlay.showOnTablet}
                      onChange={(event) => updateOverlay(selectedOverlay.id, { showOnTablet: event.target.checked })}
                    />
                    Tablet / layar besar
                  </label>
                </div>
              </fieldset>
              <label>
                Jenis font
                <select
                  value={selectedOverlay.font}
                  onChange={(event) => updateOverlay(selectedOverlay.id, { font: event.target.value as PageTextOverlay["font"] })}
                >
                  {PAGE_TEXT_FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
                </select>
              </label>
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
                Lebar di {previewDevice === "mobile" ? "ponsel" : "tablet"}
                <input
                  type="range"
                  min="12"
                  max="80"
                  step="1"
                  value={previewDevice === "mobile" ? selectedOverlay.mobileWidth : selectedOverlay.width}
                  onChange={(event) => updateOverlay(selectedOverlay.id, previewDevice === "mobile"
                    ? { mobileWidth: Number(event.target.value) }
                    : { width: Number(event.target.value) })}
                />
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
