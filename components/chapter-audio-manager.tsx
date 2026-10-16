"use client";

import { useState } from "react";
import { AudioLines, LoaderCircle, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AudioPage = { id: string; page_number: number };
type ChapterAudio = { audio_object_key: string | null; subtitles_srt: string | null; subtitle_page_map: Record<string, string> | null };

const supabase = createClient();

function isPageMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((pageId) => typeof pageId === "string");
}

export default function ChapterAudioManager({
  comicId,
  chapterId,
  pages,
  audio,
  onSaved,
}: {
  comicId: string;
  chapterId: string;
  pages: AudioPage[];
  audio: ChapterAudio;
  onSaved: (audio: ChapterAudio) => void;
}) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [sidecarFile, setSidecarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const request = async (body: Record<string, unknown>) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sesi kamu telah berakhir. Silakan masuk kembali.");
    const response = await fetch("/api/r2/chapter-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      const error = result && typeof result === "object" && "error" in result && typeof result.error === "string"
        ? result.error
        : "Permintaan audio gagal.";
      throw new Error(error);
    }
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Respons server audio tidak valid.");
    return result as Record<string, unknown>;
  };

  const saveAudio = async () => {
    if (!audioFile || !srtFile || !sidecarFile) {
      setIsError(true);
      setMessage("Pilih berkas MP3, SRT, dan JSON sidecar terlebih dahulu.");
      return;
    }
    if (!audioFile.name.toLowerCase().endsWith(".mp3") || audioFile.size === 0 || audioFile.size > 50 * 1024 * 1024) {
      setIsError(true);
      setMessage("Audio harus berupa MP3 dengan ukuran maksimal 50 MB.");
      return;
    }
    if (!srtFile.name.toLowerCase().endsWith(".srt") || srtFile.size === 0 || srtFile.size > 1024 * 1024) {
      setIsError(true);
      setMessage("Subtitle harus berupa file SRT dengan ukuran maksimal 1 MB.");
      return;
    }
    if (!sidecarFile.name.toLowerCase().endsWith(".json") || sidecarFile.size === 0 || sidecarFile.size > 256 * 1024) {
      setIsError(true);
      setMessage("Sidecar harus berupa file JSON dengan ukuran maksimal 256 KB.");
      return;
    }

    setBusy(true);
    setIsError(false);
    setMessage("Memeriksa subtitle dan pemetaan halaman...");
    let uploadedObjectKey: string | null = null;
    try {
      const subtitlesSrt = await srtFile.text();
      const pageMap: unknown = JSON.parse(await sidecarFile.text());
      if (!isPageMap(pageMap)) throw new Error("Sidecar JSON harus berisi pemetaan nomor cue ke ID halaman.");
      const prepared = await request({
        action: "prepare",
        comicId,
        chapterId,
        audioName: audioFile.name,
        audioSize: audioFile.size,
        subtitlesSrt,
        pageMap,
      });
      if (typeof prepared.uploadUrl !== "string" || typeof prepared.objectKey !== "string") {
        throw new Error("Server tidak memberikan URL unggah audio yang valid.");
      }
      const uploadUrl = prepared.uploadUrl;
      uploadedObjectKey = prepared.objectKey;
      await new Promise<void>((resolve, reject) => {
        const upload = new XMLHttpRequest();
        upload.open("PUT", uploadUrl);
        upload.setRequestHeader("Content-Type", "audio/mpeg");
        upload.upload.onprogress = (progressEvent) => {
          if (progressEvent.lengthComputable) {
            setMessage(`Mengunggah audio MP3 (${Math.floor((progressEvent.loaded / progressEvent.total) * 100)}%)...`);
          }
        };
        upload.onload = () => {
          if (upload.status >= 200 && upload.status < 300) resolve();
          else reject(new Error("Audio gagal diunggah ke penyimpanan. Coba lagi."));
        };
        upload.onerror = () => reject(new Error("Koneksi gagal saat mengunggah audio."));
        upload.onabort = () => reject(new Error("Unggah audio dibatalkan."));
        upload.send(audioFile);
      });
      setMessage("Menyimpan subtitle dan pemetaan halaman...");
      const saved = await request({
        action: "save",
        comicId,
        chapterId,
        objectKey: uploadedObjectKey,
        subtitlesSrt,
        pageMap,
      });
      if (saved.saved !== true) throw new Error("Server tidak mengonfirmasi penyimpanan audio.");
      onSaved({
        audio_object_key: uploadedObjectKey,
        subtitles_srt: subtitlesSrt,
        subtitle_page_map: pageMap,
      });
      setAudioFile(null);
      setSrtFile(null);
      setSidecarFile(null);
      setMessage(saved.storageCleanupPending === true
        ? "Audio tersimpan, tetapi audio versi lama belum dapat dibersihkan dari penyimpanan."
        : "Audio, subtitle, dan pemetaan halaman berhasil disimpan.");
    } catch (error) {
      console.error("Unable to save chapter audio:", error);
      if (uploadedObjectKey) {
        try {
          await request({ action: "discard", comicId, chapterId, objectKey: uploadedObjectKey });
        } catch (cleanupError) {
          console.error("Unable to clean up an unregistered chapter audio upload:", cleanupError);
        }
      }
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Audio episode gagal disimpan.");
    } finally {
      setBusy(false);
    }
  };

  const removeAudio = async () => {
    setBusy(true);
    setIsError(false);
    setMessage("");
    try {
      const result = await request({ action: "delete", comicId, chapterId });
      onSaved({ audio_object_key: null, subtitles_srt: null, subtitle_page_map: null });
      setMessage(result.storageCleanupPending === true
        ? "Audio dihapus dari episode, tetapi berkas lama belum dapat dibersihkan dari penyimpanan."
        : "Audio episode berhasil dihapus.");
    } catch (error) {
      console.error("Unable to delete chapter audio:", error);
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Audio episode gagal dihapus.");
    } finally {
      setBusy(false);
    }
  };

  const copyPageMapTemplate = async () => {
    const template = Object.fromEntries(pages.map((page, index) => [String(index + 1), page.id]));
    try {
      await navigator.clipboard.writeText(JSON.stringify(template, null, 2));
      setIsError(false);
      setMessage("Template sidecar berhasil disalin. Sesuaikan nomor cue dengan ID halaman yang tepat.");
    } catch (error) {
      console.error("Unable to copy subtitle mapping template:", error);
      setIsError(true);
      setMessage("Template tidak dapat disalin. Salin ID halaman dari daftar di bawah.");
    }
  };

  return (
    <section className="chapter-audio-manager" aria-label="Audio dan subtitle episode">
      <div className="chapter-audio-manager-heading">
        <div><AudioLines size={18} /><div><strong>Audio episode</strong><span>{audio.audio_object_key ? "MP3 dan subtitle tersedia" : "Belum ada audio"}</span></div></div>
        {audio.audio_object_key && <button type="button" className="chapter-audio-delete" onClick={() => void removeAudio()} disabled={busy}><Trash2 size={15} /> Hapus audio</button>}
      </div>
      <p>Unggah MP3 maksimal 50 MB, file SRT, dan sidecar JSON. Audio tidak diputar otomatis; pemetaan subtitle menggunakan ID halaman agar tetap benar saat urutan halaman berubah.</p>
      <div className="chapter-audio-fields">
        <label>Audio MP3<input type="file" accept=".mp3,audio/mpeg" onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)} disabled={busy} /></label>
        <label>Subtitle SRT<input type="file" accept=".srt,application/x-subrip,text/plain" onChange={(event) => setSrtFile(event.target.files?.[0] ?? null)} disabled={busy} /></label>
        <label>Sidecar pemetaan JSON<input type="file" accept=".json,application/json" onChange={(event) => setSidecarFile(event.target.files?.[0] ?? null)} disabled={busy} /></label>
      </div>
      <div className="chapter-audio-sidecar-help">
        <button type="button" onClick={() => void copyPageMapTemplate()} disabled={busy || pages.length === 0}>Salin template pemetaan halaman</button>
        <pre>{`{\n  "1": "ID halaman untuk cue 1",\n  "2": "ID halaman untuk cue 2"\n}`}</pre>
        {pages.length > 0 && <details><summary>Lihat ID halaman episode</summary><ol>{pages.map((page) => <li key={page.id}>Halaman {page.page_number}: <code>{page.id}</code></li>)}</ol></details>}
      </div>
      <div className="chapter-audio-actions">
        <button type="button" onClick={() => void saveAudio()} disabled={busy || !audioFile || !srtFile || !sidecarFile}>
          {busy ? <><LoaderCircle className="spin" size={15} /> {message.startsWith("Mengunggah") ? "Mengunggah..." : "Memproses..."}</> : <><Upload size={15} /> Simpan audio episode</>}
        </button>
        {busy && <span role="status">{message}</span>}
      </div>
      {!busy && message && <p className={isError ? "chapter-audio-message is-error" : "chapter-audio-message"} role={isError ? "alert" : "status"}>{message}</p>}
    </section>
  );
}
