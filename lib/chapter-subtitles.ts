export type ChapterSubtitleCue = {
  number: number;
  startMs: number;
  endMs: number;
  text: string;
  pageId: string;
};

function parseTimestamp(value: string) {
  const match = /^(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})$/.exec(value);
  if (!match) throw new Error(`Format waktu subtitle tidak valid: ${value}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds;
}

export function parseChapterSubtitles(srt: string, pageMap: unknown): ChapterSubtitleCue[] {
  if (typeof srt !== "string" || !srt.trim()) throw new Error("File SRT tidak boleh kosong.");
  if (new TextEncoder().encode(srt).byteLength > 1024 * 1024) throw new Error("File SRT maksimal 1 MB.");
  if (!pageMap || typeof pageMap !== "object" || Array.isArray(pageMap)) {
    throw new Error("Sidecar JSON harus berupa objek dengan nomor cue dan ID halaman.");
  }

  const mapping = pageMap as Record<string, unknown>;
  const blocks = srt.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/);
  if (blocks.length > 2000) throw new Error("Satu episode maksimal memiliki 2.000 cue subtitle.");

  const seen = new Set<number>();
  let previousStartMs = -1;
  const cues = blocks.map((block): ChapterSubtitleCue => {
    const lines = block.split("\n");
    if (lines.length < 3 || !/^\d+$/.test(lines[0].trim())) {
      throw new Error("Format SRT tidak valid. Setiap cue harus memiliki nomor, waktu, dan teks.");
    }
    const number = Number(lines[0].trim());
    if (!Number.isSafeInteger(number) || number < 1 || seen.has(number)) {
      throw new Error("Nomor cue SRT harus unik dan berupa bilangan positif.");
    }
    seen.add(number);

    const timing = /^(\d{2,}:[0-5]\d:[0-5]\d,\d{3})\s+-->\s+(\d{2,}:[0-5]\d:[0-5]\d,\d{3})$/.exec(lines[1].trim());
    if (!timing) throw new Error(`Baris waktu cue ${number} tidak valid.`);
    const startMs = parseTimestamp(timing[1]);
    const endMs = parseTimestamp(timing[2]);
    if (endMs <= startMs) throw new Error(`Waktu akhir cue ${number} harus setelah waktu mulai.`);
    if (startMs < previousStartMs) throw new Error("Cue subtitle harus diurutkan berdasarkan waktu mulai.");
    previousStartMs = startMs;

    const text = lines.slice(2).join("\n").trim();
    if (!text || text.length > 5000) throw new Error(`Teks cue ${number} kosong atau melebihi 5.000 karakter.`);
    const pageId = mapping[String(number)];
    if (typeof pageId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pageId)) {
      throw new Error(`Sidecar belum memetakan cue ${number} ke ID halaman yang valid.`);
    }
    return { number, startMs, endMs, text, pageId };
  });

  if (!cues.length) throw new Error("File SRT tidak berisi cue subtitle.");
  if (Object.keys(mapping).length !== cues.length || Object.keys(mapping).some((key) => !seen.has(Number(key)))) {
    throw new Error("Sidecar harus memetakan setiap cue SRT tepat satu kali.");
  }
  return cues;
}
