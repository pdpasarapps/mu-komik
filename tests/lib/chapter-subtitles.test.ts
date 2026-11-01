import { describe, expect, it } from "vitest";
import {
  createSubtitlePageMap,
  parseChapterSubtitles,
  parseChapterSubtitleCues,
} from "@/lib/chapter-subtitles";

const PAGE_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];

function srt(...blocks: string[]) {
  return `${blocks.join("\n\n")}\n`;
}

const MARKED_SRT = srt(
  "1\n00:00:00,000 --> 00:00:01,000\nHalaman 1",
  "2\n00:00:01,000 --> 00:00:02,000\nHalo\nHalaman 2",
  "3\n00:00:02,000 --> 00:00:03,000\nLanjut\nHalaman 3",
);

const PLAIN_SRT = srt(
  "1\n00:00:00,000 --> 00:00:02,500\nHalo dunia",
  "2\n00:00:03,000 --> 00:00:04,500\nBaris kedua",
);

describe("parseChapterSubtitleCues", () => {
  it("parses ordered cues into milliseconds", () => {
    expect(parseChapterSubtitleCues(PLAIN_SRT)).toEqual([
      { number: 1, startMs: 0, endMs: 2500, text: "Halo dunia" },
      { number: 2, startMs: 3000, endMs: 4500, text: "Baris kedua" },
    ]);
  });

  it("normalises CRLF line endings and a byte order mark", () => {
    const windows = `\uFEFF${PLAIN_SRT.replace(/\n/g, "\r\n")}`;

    expect(parseChapterSubtitleCues(windows)).toHaveLength(2);
  });

  it("rejects empty input", () => {
    expect(() => parseChapterSubtitleCues("   ")).toThrow("File SRT tidak boleh kosong.");
  });

  it("rejects malformed blocks", () => {
    expect(() => parseChapterSubtitleCues(srt("nomor"))).toThrow("Format SRT tidak valid");
  });

  it("rejects duplicate and non-positive cue numbers", () => {
    expect(() => parseChapterSubtitleCues(srt(
      "1\n00:00:00,000 --> 00:00:01,000\nSatu",
      "1\n00:00:01,000 --> 00:00:02,000\nDua",
    ))).toThrow("Nomor cue SRT harus unik");

    expect(() => parseChapterSubtitleCues(srt("0\n00:00:00,000 --> 00:00:01,000\nNol")))
      .toThrow("Nomor cue SRT harus unik");
  });

  it("rejects invalid timing and reversed ranges", () => {
    expect(() => parseChapterSubtitleCues(srt("1\n00:00:00 --> 00:00:01\nTeks")))
      .toThrow("Baris waktu cue 1 tidak valid.");

    expect(() => parseChapterSubtitleCues(srt("1\n00:00:02,000 --> 00:00:01,000\nTeks")))
      .toThrow("Waktu akhir cue 1 harus setelah waktu mulai.");
  });

  it("rejects cues that are out of order", () => {
    expect(() => parseChapterSubtitleCues(srt(
      "1\n00:00:05,000 --> 00:00:06,000\nLambat",
      "2\n00:00:01,000 --> 00:00:02,000\nCepat",
    ))).toThrow("Cue subtitle harus diurutkan berdasarkan waktu mulai.");
  });

  it("rejects cue text longer than 5.000 characters", () => {
    expect(() => parseChapterSubtitleCues(srt(`1\n00:00:00,000 --> 00:00:01,000\n${"a".repeat(5001)}`)))
      .toThrow("Teks cue 1 kosong atau melebihi 5.000 karakter.");
  });

  it("treats a cue with only whitespace as malformed", () => {
    expect(() => parseChapterSubtitleCues(srt("1\n00:00:00,000 --> 00:00:01,000\n   ")))
      .toThrow("Format SRT tidak valid. Setiap cue harus memiliki nomor, waktu, dan teks.");
  });
});

describe("createSubtitlePageMap", () => {
  it("maps cues to the page active when they start", () => {
    expect(createSubtitlePageMap(MARKED_SRT, PAGE_IDS)).toEqual({
      "1": PAGE_IDS[0],
      "2": PAGE_IDS[0],
      "3": PAGE_IDS[1],
    });
  });

  it("requires at least one page", () => {
    expect(() => createSubtitlePageMap(MARKED_SRT, [])).toThrow("Episode belum memiliki halaman");
  });

  it("rejects a page marker beyond the available pages", () => {
    const beyond = srt(
      "1\n00:00:00,000 --> 00:00:01,000\nHalaman 1",
      "2\n00:00:01,000 --> 00:00:02,000\nHalo\nHalaman 9",
    );

    expect(() => createSubtitlePageMap(beyond, PAGE_IDS)).toThrow("tidak sesuai jumlah halaman (3)");
  });

  it("rejects a marker that skips a page", () => {
    const skip = srt(
      "1\n00:00:00,000 --> 00:00:01,000\nHalaman 1",
      "2\n00:00:01,000 --> 00:00:02,000\nHalo\nHalaman 3",
    );

    expect(() => createSubtitlePageMap(skip, PAGE_IDS)).toThrow("harus menandai halaman berikutnya");
  });

  it("rejects SRT files that never mention a page", () => {
    expect(() => createSubtitlePageMap(PLAIN_SRT, PAGE_IDS)).toThrow(
      'SRT belum memiliki penanda "Halaman 1"',
    );
  });
});

describe("parseChapterSubtitles", () => {
  const pageMap = { "1": PAGE_IDS[0], "2": PAGE_IDS[1] };

  it("attaches the sidecar page id to each cue", () => {
    expect(parseChapterSubtitles(PLAIN_SRT, pageMap)).toEqual([
      { number: 1, startMs: 0, endMs: 2500, text: "Halo dunia", pageId: PAGE_IDS[0] },
      { number: 2, startMs: 3000, endMs: 4500, text: "Baris kedua", pageId: PAGE_IDS[1] },
    ]);
  });

  it("rejects a sidecar that is not a plain object", () => {
    expect(() => parseChapterSubtitles(PLAIN_SRT, null)).toThrow("Sidecar JSON harus berupa objek");
    expect(() => parseChapterSubtitles(PLAIN_SRT, [])).toThrow("Sidecar JSON harus berupa objek");
  });

  it("rejects missing, invalid, and extra entries", () => {
    expect(() => parseChapterSubtitles(PLAIN_SRT, { "1": PAGE_IDS[0] })).toThrow(
      "Sidecar belum memetakan cue 2",
    );

    expect(() => parseChapterSubtitles(PLAIN_SRT, { "1": "bukan-uuid", "2": PAGE_IDS[1] })).toThrow(
      "Sidecar belum memetakan cue 1",
    );

    expect(() => parseChapterSubtitles(PLAIN_SRT, { ...pageMap, "3": PAGE_IDS[2] })).toThrow(
      "Sidecar harus memetakan setiap cue SRT tepat satu kali.",
    );
  });
});
