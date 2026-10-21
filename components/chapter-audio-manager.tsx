"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AudioLines, ChevronDown, Download, LoaderCircle, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { createSubtitlePageMap, parseChapterSubtitleCues, parseChapterSubtitles, type ParsedChapterSubtitleCue } from "@/lib/chapter-subtitles";
import { createClient } from "@/lib/supabase/client";

type AudioPage = { id: string; page_number: number; object_key: string };
type ChapterAudio = { audio_object_key: string | null; subtitles_srt: string | null; subtitle_page_map: Record<string, string> | null };
type SubtitleCueDraft = ParsedChapterSubtitleCue & { startTime: string; endTime: string };
type SubtitleDraft = { cues: SubtitleCueDraft[]; pageMap: Record<string, string>; error: string };

const supabase = createClient();
const WAVEFORM_BAR_COUNT = 160;
const MAX_WAVEFORM_DECODE_BYTES = 12 * 1024 * 1024;

function isPageMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((pageId) => typeof pageId === "string");
}

function createSubtitleDraft(srt: string | null, pages: AudioPage[], savedPageMap: Record<string, string> | null): SubtitleDraft {
  if (!srt) return { cues: [], pageMap: {}, error: "" };
  try {
    const cues = parseChapterSubtitleCues(srt).map((cue) => ({
      ...cue,
      startTime: formatCueTime(cue.startMs),
      endTime: formatCueTime(cue.endMs),
    }));
    const pageIds = new Set(pages.map((page) => page.id));
    let pageMap: Record<string, string> = {};
    try {
      pageMap = createSubtitlePageMap(srt, pages.map((page) => page.id));
    } catch {
      if (savedPageMap) {
        pageMap = Object.fromEntries(
          cues
            .filter((cue) => pageIds.has(savedPageMap[String(cue.number)]))
            .map((cue) => [String(cue.number), savedPageMap[String(cue.number)]]),
        );
      }
    }
    return { cues, pageMap, error: "" };
  } catch (error) {
    return {
      cues: [],
      pageMap: {},
      error: error instanceof Error ? error.message : "SRT tidak dapat dibaca.",
    };
  }
}

function formatCueTime(milliseconds: number) {
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const fraction = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(fraction).padStart(3, "0")}`;
}

function serializeSubtitleDraft(cues: SubtitleCueDraft[]) {
  return `${cues.map((cue) => `${cue.number}\n${cue.startTime} --> ${cue.endTime}\n${cue.text}`).join("\n\n")}\n`;
}

function readCueTime(value: string) {
  const match = /^(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})$/.exec(value);
  if (!match) return Number.NaN;
  return ((Number(match[1]) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000 + Number(match[4]);
}

function createWaveformPeaks(buffer: AudioBuffer) {
  const peaks = new Array<number>(WAVEFORM_BAR_COUNT).fill(0);
  const samplesPerBar = Math.max(1, Math.floor(buffer.length / WAVEFORM_BAR_COUNT));
  const channelData = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
  for (let bar = 0; bar < WAVEFORM_BAR_COUNT; bar += 1) {
    const start = bar * samplesPerBar;
    const end = Math.min(buffer.length, start + samplesPerBar);
    let peak = 0;
    for (const samples of channelData) {
      for (let index = start; index < end; index += 1) peak = Math.max(peak, Math.abs(samples[index]));
    }
    peaks[bar] = peak;
  }
  const maximum = Math.max(...peaks, 0.01);
  return peaks.map((peak) => Math.max(0.08, peak / maximum));
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
  const [subtitleDraft, setSubtitleDraft] = useState<SubtitleDraft>(() => createSubtitleDraft(
    audio.subtitles_srt,
    [...pages].sort((left, right) => left.page_number - right.page_number),
    audio.subtitle_page_map,
  ));
  const [audioManagerExpanded, setAudioManagerExpanded] = useState(true);
  const [mapperExpanded, setMapperExpanded] = useState(() => Boolean(audio.subtitles_srt));
  const [subtitleEditMode, setSubtitleEditMode] = useState(false);
  const [subtitleEdited, setSubtitleEdited] = useState(false);
  const [mappingDirty, setMappingDirty] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [waveformState, setWaveformState] = useState<{ source: string | null; peaks: number[]; loading: boolean; error: string }>({
    source: null,
    peaks: [],
    loading: false,
    error: "",
  });
  const [audioTimeline, setAudioTimeline] = useState<{ source: string | null; currentTime: number; duration: number }>({
    source: null,
    currentTime: 0,
    duration: 0,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "");
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioPreviewUrlRef = useRef<string | null>(null);
  const audioSource = audioPreviewUrl ?? (audio.audio_object_key && publicUrl
    ? `${publicUrl}/${audio.audio_object_key}`
    : null);
  const audioDuration = audioTimeline.source === audioSource ? audioTimeline.duration : 0;
  const audioCurrentTime = audioTimeline.source === audioSource ? audioTimeline.currentTime : 0;
  const waveformPeaks = waveformState.source === audioSource ? waveformState.peaks : [];
  const waveformLoading = waveformState.source === audioSource && waveformState.loading;
  const waveformError = waveformState.source === audioSource ? waveformState.error : "";
  const sortedPages = [...pages].sort((left, right) => left.page_number - right.page_number);
  const pageIds = new Set(sortedPages.map((page) => page.id));
  const mappedCueCount = subtitleDraft.cues.filter((cue) => pageIds.has(subtitleDraft.pageMap[String(cue.number)])).length;
  const mappingComplete = subtitleDraft.cues.length > 0 && mappedCueCount === subtitleDraft.cues.length;

  const setAudioPreview = (file: File | null) => {
    if (audioPreviewUrlRef.current) URL.revokeObjectURL(audioPreviewUrlRef.current);
    const url = file ? URL.createObjectURL(file) : null;
    audioPreviewUrlRef.current = url;
    setAudioPreviewUrl(url);
  };

  useEffect(() => () => {
    if (audioPreviewUrlRef.current) URL.revokeObjectURL(audioPreviewUrlRef.current);
  }, []);

  useEffect(() => {
    if (!audioSource) return;
    let cancelled = false;
    let context: AudioContext | null = null;
    const loadWaveform = async () => {
      setWaveformState({ source: audioSource, peaks: [], loading: true, error: "" });
      try {
        let audioBytes: ArrayBuffer;
        if (audioPreviewUrl && audioFile) {
          if (audioFile.size > MAX_WAVEFORM_DECODE_BYTES) {
            throw new Error("Audio terlalu besar untuk membuat waveform di browser. Slider waktu tetap dapat digunakan.");
          }
          audioBytes = await audioFile.arrayBuffer();
        } else {
          const response = await fetch(audioSource);
          if (!response.ok) throw new Error("Audio belum dapat dimuat untuk waveform. Slider waktu tetap dapat digunakan.");
          const contentLength = Number(response.headers.get("content-length"));
          if (Number.isFinite(contentLength) && contentLength > MAX_WAVEFORM_DECODE_BYTES) {
            throw new Error("Audio terlalu besar untuk membuat waveform di browser. Slider waktu tetap dapat digunakan.");
          }
          const blob = await response.blob();
          if (blob.size > MAX_WAVEFORM_DECODE_BYTES) {
            throw new Error("Audio terlalu besar untuk membuat waveform di browser. Slider waktu tetap dapat digunakan.");
          }
          audioBytes = await blob.arrayBuffer();
        }
        context = new AudioContext();
        const decoded = await context.decodeAudioData(audioBytes);
        if (!cancelled) setWaveformState({ source: audioSource, peaks: createWaveformPeaks(decoded), loading: false, error: "" });
      } catch (error) {
        if (cancelled) return;
        console.error("Unable to create chapter audio waveform:", error);
        setWaveformState({
          source: audioSource,
          peaks: [],
          loading: false,
          error: error instanceof Error ? error.message : "Waveform tidak dapat dimuat. Slider waktu tetap dapat digunakan.",
        });
      } finally {
        if (context && context.state !== "closed") await context.close();
      }
    };
    void Promise.resolve().then(loadWaveform);
    return () => {
      cancelled = true;
      if (context && context.state !== "closed") void context.close();
    };
  }, [audioFile, audioPreviewUrl, audioSource]);

  const handleSrtFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    setSrtFile(file);
    setSidecarFile(null);
    setSubtitleEdited(false);
    setSubtitleEditMode(false);
    setMapperExpanded(true);
    setMappingDirty(false);
    setIsError(false);
    setMessage("");
    if (!file.name.toLowerCase().endsWith(".srt") || file.size === 0 || file.size > 1024 * 1024) {
      setSubtitleDraft({
        cues: [],
        pageMap: {},
        error: "Subtitle harus berupa file SRT dengan ukuran maksimal 1 MB.",
      });
      return;
    }

    try {
      const text = await file.text();
      const draft = createSubtitleDraft(
        text,
        sortedPages,
        text === audio.subtitles_srt ? audio.subtitle_page_map : null,
      );
      setSubtitleDraft(draft);
    } catch (error) {
      console.error("Unable to read chapter subtitle file:", error);
      setSubtitleDraft({
        cues: [],
        pageMap: {},
        error: error instanceof Error ? error.message : "File SRT tidak dapat dibaca.",
      });
    }
  };

  const updateCuePage = (cueNumber: number, pageId: string) => {
    setSidecarFile(null);
    setMappingDirty(true);
    setIsError(false);
    setMessage("");
    setSubtitleDraft((current) => ({
      ...current,
      pageMap: { ...current.pageMap, [String(cueNumber)]: pageId },
    }));
  };

  const updateCue = (cueNumber: number, field: "startTime" | "endTime" | "text", value: string) => {
    setSidecarFile(null);
    setSubtitleEdited(true);
    setIsError(false);
    setMessage("");
    setSubtitleDraft((current) => ({
      ...current,
      cues: current.cues.map((cue) => cue.number === cueNumber ? { ...cue, [field]: value } : cue),
    }));
  };

  const deleteCue = (cueNumber: number) => {
    if (subtitleDraft.cues.length <= 1) {
      setIsError(true);
      setMessage("SRT harus memiliki setidaknya satu cue. Hapus subtitle seluruhnya jika tidak diperlukan.");
      return;
    }
    const remainingCues = subtitleDraft.cues.filter((cue) => cue.number !== cueNumber);
    const nextPageMap: Record<string, string> = {};
    const renumberedCues = remainingCues.map((cue, index) => {
      const number = index + 1;
      const pageId = subtitleDraft.pageMap[String(cue.number)];
      if (pageId) nextPageMap[String(number)] = pageId;
      return { ...cue, number };
    });
    setSidecarFile(null);
    setSubtitleEdited(true);
    setMappingDirty(true);
    setIsError(false);
    setMessage("");
    setSubtitleDraft({ ...subtitleDraft, cues: renumberedCues, pageMap: nextPageMap, error: "" });
  };

  const addCueAtCurrentTime = () => {
    const startMs = Math.floor(audioCurrentTime * 1000);
    if (!audioSource || audioDuration <= 0) {
      setIsError(true);
      setMessage("Muat audio terlebih dahulu untuk menambahkan cue dari posisi waktu.");
      return;
    }
    if (subtitleDraft.cues.length >= 2000) {
      setIsError(true);
      setMessage("Satu episode maksimal memiliki 2.000 cue subtitle.");
      return;
    }
    const cueStartTimes = subtitleDraft.cues.map((cue) => readCueTime(cue.startTime));
    if (cueStartTimes.some((cueStartMs) => Number.isFinite(cueStartMs) && cueStartMs === startMs)) {
      setIsError(true);
      setMessage("Sudah ada cue pada timecode ini. Geser posisi audio sedikit lalu coba lagi.");
      return;
    }
    const nextCueStartMs = cueStartTimes.find((cueStartMs) => cueStartMs > startMs);
    if (nextCueStartMs !== undefined && nextCueStartMs - startMs < 100) {
      setIsError(true);
      setMessage("Posisi cue terlalu dekat dengan cue berikutnya. Geser audio sedikit ke belakang.");
      return;
    }
    const cueEndMs = nextCueStartMs !== undefined
      ? Math.min(startMs + 2000, nextCueStartMs - 1)
      : Math.min(Math.round(audioDuration * 1000), startMs + 2000);
    if (cueEndMs <= startMs) {
      setIsError(true);
      setMessage("Tidak ada ruang waktu untuk menambahkan cue di posisi ini.");
      return;
    }
    const precedingCue = [...subtitleDraft.cues]
      .sort((first, second) => readCueTime(second.startTime) - readCueTime(first.startTime))
      .find((cue) => readCueTime(cue.startTime) <= startMs);
    const defaultPageId = precedingCue
      ? subtitleDraft.pageMap[String(precedingCue.number)]
      : sortedPages[0]?.id;
    const oldPageMap = subtitleDraft.pageMap;
    const nextCues = [...subtitleDraft.cues, {
      number: 0,
      startMs,
      endMs: cueEndMs,
      text: "",
      startTime: formatCueTime(startMs),
      endTime: formatCueTime(cueEndMs),
    }].sort((first, second) => readCueTime(first.startTime) - readCueTime(second.startTime));
    const nextPageMap: Record<string, string> = {};
    const numberedCues = nextCues.map((cue, index) => {
      const number = index + 1;
      const existingPage = cue.number > 0 ? oldPageMap[String(cue.number)] : defaultPageId;
      if (existingPage) nextPageMap[String(number)] = existingPage;
      return { ...cue, number };
    });
    setSidecarFile(null);
    setSubtitleEdited(true);
    setMappingDirty(true);
    setSubtitleEditMode(true);
    setMapperExpanded(true);
    setIsError(false);
    setMessage("");
    setSubtitleDraft({ ...subtitleDraft, cues: numberedCues, pageMap: nextPageMap, error: "" });
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-subtitle-cue="${startMs}"] textarea`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const seekAudio = (time: number) => {
    const audioElement = audioRef.current;
    if (!audioElement || !Number.isFinite(time)) return;
    const nextTime = Math.min(audioDuration, Math.max(0, time));
    audioElement.currentTime = nextTime;
    setAudioTimeline({ source: audioSource, currentTime: nextTime, duration: audioDuration });
  };

  const updateCueTime = (cueNumber: number, field: "startTime" | "endTime", value: string) => {
    updateCue(cueNumber, field, value);
    const nextMs = readCueTime(value);
    if (Number.isFinite(nextMs)) seekAudio(nextMs / 1000);
  };

  const downloadPageMap = () => {
    if (!mappingComplete) return;
    const pageMap = Object.fromEntries(subtitleDraft.cues.map((cue) => [
      String(cue.number),
      subtitleDraft.pageMap[String(cue.number)],
    ]));
    const file = new Blob([`${JSON.stringify(pageMap, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `subtitle-${chapterId}.pages.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

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
    if (!audioFile && !srtFile && !sidecarFile && !mappingDirty && !subtitleEdited) {
      setIsError(true);
      setMessage("Pilih setidaknya satu berkas yang ingin diperbarui.");
      return;
    }
    if (audioFile && (!audioFile.name.toLowerCase().endsWith(".mp3") || audioFile.size === 0 || audioFile.size > 50 * 1024 * 1024)) {
      setIsError(true);
      setMessage("Audio harus berupa MP3 dengan ukuran maksimal 50 MB.");
      return;
    }
    if (srtFile && (!srtFile.name.toLowerCase().endsWith(".srt") || srtFile.size === 0 || srtFile.size > 1024 * 1024)) {
      setIsError(true);
      setMessage("Subtitle harus berupa file SRT dengan ukuran maksimal 1 MB.");
      return;
    }
    if (sidecarFile && (!sidecarFile.name.toLowerCase().endsWith(".json") || sidecarFile.size === 0 || sidecarFile.size > 256 * 1024)) {
      setIsError(true);
      setMessage("Sidecar harus berupa file JSON dengan ukuran maksimal 256 KB.");
      return;
    }

    setBusy(true);
    setIsError(false);
    setMessage("Menyiapkan pembaruan episode...");
    let uploadedObjectKey: string | null = null;
    try {
      const updatesSubtitles = Boolean(srtFile || sidecarFile || mappingDirty || subtitleEdited);
      const subtitlesSrt = subtitleEdited
        ? serializeSubtitleDraft(subtitleDraft.cues)
        : srtFile ? await srtFile.text() : audio.subtitles_srt;
      let pageMap: unknown = audio.subtitle_page_map;
      if (sidecarFile) {
        pageMap = JSON.parse(await sidecarFile.text());
        if (!isPageMap(pageMap)) throw new Error("Sidecar JSON harus berisi pemetaan nomor cue ke ID halaman.");
      } else if (srtFile || subtitleEdited || mappingDirty) {
        pageMap = subtitleDraft.pageMap;
      }
      if (sidecarFile && !subtitlesSrt) throw new Error("Unggah file SRT terlebih dahulu sebelum mengganti pemetaan halaman.");
      if (updatesSubtitles && (!subtitlesSrt || !pageMap)) {
        throw new Error("Pembaruan subtitle membutuhkan SRT dan pemetaan halaman yang valid.");
      }
      if (updatesSubtitles && subtitlesSrt && pageMap) {
        const cues = parseChapterSubtitles(subtitlesSrt, pageMap);
        if (cues.some((cue) => !pageIds.has(cue.pageId))) {
          throw new Error("Pemetaan hanya boleh menggunakan halaman dari episode ini.");
        }
      }

      const subtitleUpdate = updatesSubtitles ? { subtitlesSrt, pageMap } : {};
      if (audioFile) {
        setMessage(updatesSubtitles ? "Memeriksa subtitle dan menyiapkan audio..." : "Menyiapkan audio...");
        const prepared = await request({
          action: "prepare",
          comicId,
          chapterId,
          audioName: audioFile.name,
          audioSize: audioFile.size,
          ...subtitleUpdate,
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
      }

      setMessage("Menyimpan perubahan episode...");
      const saved = await request({
        action: "save",
        comicId,
        chapterId,
        ...(uploadedObjectKey ? { objectKey: uploadedObjectKey } : {}),
        ...subtitleUpdate,
      });
      if (saved.saved !== true) throw new Error("Server tidak mengonfirmasi penyimpanan audio.");
      onSaved({
        audio_object_key: typeof saved.audio_object_key === "string" ? saved.audio_object_key : null,
        subtitles_srt: typeof saved.subtitles_srt === "string" ? saved.subtitles_srt : null,
        subtitle_page_map: isPageMap(saved.subtitle_page_map) ? saved.subtitle_page_map : null,
      });
      setAudioFile(null);
      setAudioPreview(null);
      setSrtFile(null);
      setSidecarFile(null);
      setSubtitleEdited(false);
      setSubtitleDraft(createSubtitleDraft(
        typeof saved.subtitles_srt === "string" ? saved.subtitles_srt : subtitlesSrt,
        sortedPages,
        isPageMap(saved.subtitle_page_map) ? saved.subtitle_page_map : null,
      ));
      setMappingDirty(false);
      const updatedAssets: string[] = [];
      if (audioFile) updatedAssets.push("audio");
      if (srtFile || subtitleEdited) updatedAssets.push("subtitle dan pemetaan halaman");
      else if (sidecarFile) updatedAssets.push("pemetaan halaman");
      const updatedAssetLabel = updatedAssets.join(", ");
      setMessage(saved.storageCleanupPending === true
        ? `${updatedAssetLabel} tersimpan, tetapi audio versi lama belum dapat dibersihkan dari penyimpanan.`
        : `${updatedAssetLabel.charAt(0).toUpperCase()}${updatedAssetLabel.slice(1)} berhasil disimpan.`);
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
      setMessage(error instanceof Error ? error.message : "Perubahan episode gagal disimpan.");
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
      onSaved({
        audio_object_key: null,
        subtitles_srt: typeof result.subtitles_srt === "string" ? result.subtitles_srt : null,
        subtitle_page_map: isPageMap(result.subtitle_page_map) ? result.subtitle_page_map : null,
      });
      setMessage(result.storageCleanupPending === true
        ? "Audio dihapus, tetapi berkas lama belum dapat dibersihkan dari penyimpanan."
        : "Audio episode dihapus. Subtitle dan pemetaan halaman tetap tersimpan.");
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
        <div><AudioLines size={18} /><div><strong>Audio dan subtitle episode</strong><span>{audio.audio_object_key && audio.subtitles_srt ? "Audio dan subtitle tersedia" : audio.audio_object_key ? "Audio tersedia" : audio.subtitles_srt ? "Subtitle tersedia" : "Belum ada audio atau subtitle"}</span></div></div>
        <div className="chapter-audio-manager-heading-actions">
          {audio.audio_object_key && <button type="button" className="chapter-audio-delete" onClick={() => void removeAudio()} disabled={busy}><Trash2 size={15} /> Hapus audio</button>}
          <button
            type="button"
            className="chapter-audio-manager-toggle"
            aria-expanded={audioManagerExpanded}
            aria-controls={`chapter-audio-content-${chapterId}`}
            onClick={() => setAudioManagerExpanded((expanded) => !expanded)}
          >
            <ChevronDown className={audioManagerExpanded ? "is-expanded" : ""} size={16} />
            {audioManagerExpanded ? "Ciutkan" : "Perluas"}
          </button>
        </div>
      </div>
      <div id={`chapter-audio-content-${chapterId}`} className="chapter-audio-manager-content" hidden={!audioManagerExpanded}>
      <p>Perbarui audio MP3, SRT, atau keduanya secara terpisah. Kamu dapat mengedit teks dan timecode SRT, serta mencocokkan cue dengan thumbnail halaman. Audio maksimal 50 MB.</p>
      <div className="chapter-audio-fields">
        <label>Audio MP3<input type="file" accept=".mp3,audio/mpeg" onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          setAudioFile(file);
          setAudioPreview(file);
        }} disabled={busy} /></label>
        <label>Subtitle SRT<input type="file" accept=".srt,application/x-subrip,text/plain" onChange={(event) => void handleSrtFileChange(event)} disabled={busy} /></label>
        <label>Sidecar pemetaan JSON<input type="file" accept=".json,application/json" onChange={(event) => setSidecarFile(event.target.files?.[0] ?? null)} disabled={busy} /></label>
      </div>
      {audioSource && (
        <div className="chapter-subtitle-timeline">
          <div className="chapter-subtitle-timeline-heading">
            <strong>Audio untuk editor subtitle</strong>
            <span>{formatCueTime(Math.floor(audioCurrentTime * 1000))} / {formatCueTime(Math.floor(audioDuration * 1000))}</span>
          </div>
          <audio
            ref={audioRef}
            className="chapter-subtitle-audio-player"
            key={audioSource}
            src={audioSource}
            controls
            preload="metadata"
            onLoadedMetadata={(event) => {
              const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
              setAudioTimeline({ source: audioSource, currentTime: event.currentTarget.currentTime, duration });
            }}
            onDurationChange={(event) => {
              const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
              setAudioTimeline({ source: audioSource, currentTime: event.currentTarget.currentTime, duration });
            }}
            onTimeUpdate={(event) => setAudioTimeline({
              source: audioSource,
              currentTime: event.currentTarget.currentTime,
              duration: Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : audioDuration,
            })}
            onSeeked={(event) => setAudioTimeline({
              source: audioSource,
              currentTime: event.currentTarget.currentTime,
              duration: Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : audioDuration,
            })}
            onError={() => {
              setIsError(true);
              setMessage("Audio pratinjau tidak dapat diputar. Periksa koneksi atau pilih berkas audio yang valid.");
            }}
          />
          <div className="chapter-subtitle-waveform-wrap">
            <div className={`chapter-subtitle-waveform${waveformPeaks.length ? " has-waveform" : ""}`} aria-hidden="true">
              {waveformPeaks.length > 0
                ? waveformPeaks.map((peak, index) => <span key={index} style={{ height: `${Math.max(8, peak * 100)}%` }} />)
                : <span className="chapter-subtitle-waveform-placeholder" />}
              <span
                className="chapter-subtitle-waveform-progress"
                style={{ left: `${audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0}%` }}
              />
            </div>
            <input
              className="chapter-subtitle-seek"
              type="range"
              min={0}
              max={audioDuration || 0}
              step={0.01}
              value={Math.min(audioCurrentTime, audioDuration || 0)}
              aria-label="Geser posisi audio untuk memilih timecode subtitle"
              disabled={audioDuration <= 0}
              onChange={(event) => seekAudio(Number(event.target.value))}
            />
          </div>
          <div className="chapter-subtitle-timeline-footer">
            <span>{waveformLoading ? "Memuat waveform..." : waveformError || "Geser waveform untuk menentukan posisi cue."}</span>
            <button type="button" onClick={addCueAtCurrentTime} disabled={busy || audioDuration <= 0}>
              <Plus size={14} /> Tambah cue pada {formatCueTime(Math.floor(audioCurrentTime * 1000))}
            </button>
          </div>
        </div>
      )}
      {(subtitleDraft.cues.length > 0 || subtitleDraft.error || audioSource) && (
        <div className="chapter-subtitle-mapper">
          <div className="chapter-subtitle-mapper-heading">
            <div><strong>Editor SRT dan pemetaan halaman</strong><span>{subtitleDraft.cues.length > 0 ? `${mappedCueCount} dari ${subtitleDraft.cues.length} cue dipetakan` : subtitleDraft.error ? "SRT belum dapat dibaca" : "Belum ada cue — geser audio lalu tambahkan cue"}</span></div>
            <div className="chapter-subtitle-mapper-controls">
              {mapperExpanded && (
                <button
                  type="button"
                  onClick={() => setSubtitleEditMode((editing) => !editing)}
                  disabled={busy}
                  aria-pressed={subtitleEditMode}
                >
                  <Pencil size={14} /> {subtitleEditMode ? "Selesai mengedit" : "Edit SRT"}
                </button>
              )}
              {mapperExpanded && subtitleDraft.cues.length > 0 && <button type="button" onClick={downloadPageMap} disabled={busy || !mappingComplete}><Download size={14} /> Unduh JSON</button>}
              <button
                type="button"
                className="chapter-subtitle-mapper-toggle"
                aria-expanded={mapperExpanded}
                aria-controls={`subtitle-map-${chapterId}`}
                onClick={() => setMapperExpanded((expanded) => !expanded)}
              >
                {mapperExpanded ? "Ciutkan" : "Perluas"} <ChevronDown className={mapperExpanded ? "is-expanded" : ""} size={14} />
              </button>
            </div>
          </div>
          <div id={`subtitle-map-${chapterId}`} hidden={!mapperExpanded}>
            {subtitleDraft.error ? (
              <p className="chapter-audio-message is-error" role="alert">{subtitleDraft.error}</p>
            ) : subtitleDraft.cues.length === 0 ? (
              <p className="chapter-subtitle-cue-empty">Belum ada cue subtitle. Putar atau geser audio, lalu klik “Tambah cue” untuk mengisi timecode dan teks.</p>
            ) : sortedPages.length === 0 ? (
              <p className="chapter-audio-message is-error" role="alert">Unggah halaman episode sebelum memetakan cue subtitle.</p>
            ) : (
              <div className="chapter-subtitle-cue-list" aria-label="Daftar cue subtitle">
                {subtitleDraft.cues.map((cue) => {
                  const pageId = subtitleDraft.pageMap[String(cue.number)] ?? "";
                  const selectedPage = sortedPages.find((page) => page.id === pageId);
                  return (
                    <article className="chapter-subtitle-cue" key={cue.number} data-subtitle-cue={readCueTime(cue.startTime)}>
                      <div className="chapter-subtitle-cue-copy">
                        <span>Cue {cue.number}</span>
                        {subtitleEditMode ? (
                          <div className="chapter-subtitle-edit-fields">
                            <button
                              type="button"
                              className="chapter-subtitle-delete-cue"
                              onClick={() => deleteCue(cue.number)}
                              disabled={busy || subtitleDraft.cues.length <= 1}
                              aria-label={`Hapus cue ${cue.number}`}
                              title={subtitleDraft.cues.length <= 1 ? "SRT harus memiliki setidaknya satu cue" : `Hapus cue ${cue.number}`}
                            >
                              <Trash2 size={13} /> Hapus cue
                            </button>
                            <label>
                              Mulai
                              <input
                                type="text"
                                value={cue.startTime}
                                maxLength={32}
                                aria-label={`Timecode mulai cue ${cue.number}`}
                                placeholder="00:00:01,000"
                                onChange={(event) => updateCueTime(cue.number, "startTime", event.target.value)}
                                disabled={busy}
                              />
                            </label>
                            <label>
                              Selesai
                              <input
                                type="text"
                                value={cue.endTime}
                                maxLength={32}
                                aria-label={`Timecode selesai cue ${cue.number}`}
                                placeholder="00:00:02,000"
                                onChange={(event) => updateCueTime(cue.number, "endTime", event.target.value)}
                                disabled={busy}
                              />
                            </label>
                            <label className="chapter-subtitle-edit-text">
                              Teks subtitle
                              <textarea
                                value={cue.text}
                                maxLength={5000}
                                rows={Math.min(6, Math.max(2, cue.text.split("\n").length))}
                                aria-label={`Teks subtitle cue ${cue.number}`}
                                onChange={(event) => updateCue(cue.number, "text", event.target.value)}
                                disabled={busy}
                              />
                            </label>
                          </div>
                        ) : (
                          <>
                            <span>{formatCueTime(cue.startMs)} – {formatCueTime(cue.endMs)}</span>
                            <p>{cue.text}</p>
                          </>
                        )}
                      </div>
                      <label className="chapter-subtitle-page-select">
                        Halaman
                        <select
                          aria-label={`Pilih halaman untuk cue ${cue.number}`}
                          value={pageId}
                          onChange={(event) => updateCuePage(cue.number, event.target.value)}
                          disabled={busy}
                        >
                          <option value="">Pilih halaman</option>
                          {sortedPages.map((page) => <option key={page.id} value={page.id}>Halaman {page.page_number}</option>)}
                        </select>
                      </label>
                      {selectedPage && publicUrl
                        ? <div
                            className="chapter-subtitle-page-preview is-image"
                            style={{ backgroundImage: `url("${publicUrl}/${selectedPage.object_key}")` }}
                            role="img"
                            aria-label={`Pratinjau halaman ${selectedPage.page_number} untuk cue ${cue.number}`}
                          />
                        : <div className="chapter-subtitle-page-preview"><span>{selectedPage ? `Hal ${selectedPage.page_number}` : "Belum dipilih"}</span></div>}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="chapter-audio-tools-row">
        <div className="chapter-audio-sidecar-help">
          <button type="button" onClick={() => void copyPageMapTemplate()} disabled={busy || pages.length === 0}>Salin template pemetaan halaman</button>
          {pages.length > 0 && <details><summary>Lihat ID halaman episode</summary><ol>{pages.map((page) => <li key={page.id}>Halaman {page.page_number}: <code>{page.id}</code></li>)}</ol></details>}
        </div>
        <div className="chapter-audio-actions">
          <button type="button" onClick={() => void saveAudio()} disabled={busy || (!audioFile && !srtFile && !sidecarFile && !mappingDirty && !subtitleEdited)}>
            {busy ? <><LoaderCircle className="spin" size={15} /> {message.startsWith("Mengunggah") ? "Mengunggah..." : "Memproses..."}</> : <><Upload size={15} /> Simpan pilihan</>}
          </button>
          {busy && <span role="status">{message}</span>}
        </div>
      </div>
      {!busy && message && <p className={isError ? "chapter-audio-message is-error" : "chapter-audio-message"} role={isError ? "alert" : "status"}>{message}</p>}
      </div>
    </section>
  );
}
