import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = dirname(SCRIPT_DIR);

function usage() {
  return `Generate a subtitle cue-to-page JSON sidecar from SRT page labels.

Usage:
  node scripts/generate-subtitle-page-map.mjs --audio <episode.mp3> --srt <episode.srt> --page-ids <page-ids.json> [--out <output.pages.json>]

The SRT must contain sequential labels such as "Halaman 1", "Halaman 2", ...
The page ID JSON may be an array of page UUIDs in page order, or an object
mapping cue/page numbers to UUIDs (as copied from the episode editor). Repeated
UUIDs in an object are collapsed in their first-seen order.
By default, output is written beside the SRT as <basename>.pages.json.`;
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (!["--audio", "--srt", "--page-ids", "--out"].includes(argument)) {
      throw new Error(`Unknown option: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
    options[argument.slice(2)] = value;
    index += 1;
  }
  return options;
}

function resolvePath(path) {
  return path.startsWith("/") || /^[a-z]:[\\/]/i.test(path)
    ? path
    : join(ROOT_DIR, path);
}

function parsePageIds(value) {
  let ids;
  if (Array.isArray(value)) {
    ids = value;
  } else if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.some(([key]) => !/^\d+$/.test(key))) {
      throw new Error("Page ID JSON object harus menggunakan nomor cue/halaman sebagai key.");
    }
    entries.sort(([first], [second]) => Number(first) - Number(second));
    ids = [];
    for (const [, pageId] of entries) {
      if (typeof pageId !== "string") throw new Error("Setiap nilai page ID JSON harus berupa UUID.");
      if (ids.at(-1) !== pageId) ids.push(pageId);
    }
    if (new Set(ids).size !== ids.length) {
      throw new Error("ID halaman harus muncul berurutan dalam template JSON.");
    }
  } else {
    throw new Error("Page ID JSON harus berupa array UUID atau objek pemetaan.");
  }

  if (!ids.length || ids.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
    throw new Error("Page ID JSON harus berisi UUID halaman yang valid.");
  }
  if (new Set(ids).size !== ids.length) throw new Error("Daftar ID halaman tidak boleh berisi duplikat.");
  return ids;
}

function timestampToMilliseconds(value) {
  const match = /^(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})$/.exec(value);
  if (!match) throw new Error(`Format timestamp tidak valid: ${value}`);
  return (((Number(match[1]) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000) + Number(match[4]);
}

function parseCues(srt) {
  const blocks = srt.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/);
  if (!srt.trim() || blocks.length > 2000) throw new Error("SRT kosong atau melebihi 2.000 cue.");
  const seenNumbers = new Set();
  let previousStart = -1;

  return blocks.map((block) => {
    const lines = block.split("\n");
    if (lines.length < 3 || !/^\d+$/.test(lines[0].trim())) {
      throw new Error("Format SRT tidak valid: setiap cue harus memiliki nomor, timestamp, dan teks.");
    }
    const number = Number(lines[0].trim());
    if (!Number.isSafeInteger(number) || number < 1 || seenNumbers.has(number)) {
      throw new Error("Nomor cue SRT harus unik dan positif.");
    }
    seenNumbers.add(number);

    const timing = /^(\d{2,}:[0-5]\d:[0-5]\d,\d{3})\s+-->\s+(\d{2,}:[0-5]\d:[0-5]\d,\d{3})$/.exec(lines[1].trim());
    if (!timing) throw new Error(`Timestamp cue ${number} tidak valid.`);
    const start = timestampToMilliseconds(timing[1]);
    const end = timestampToMilliseconds(timing[2]);
    if (end <= start || start < previousStart) throw new Error(`Urutan waktu cue ${number} tidak valid.`);
    previousStart = start;

    const text = lines.slice(2).join("\n").trim();
    if (!text) throw new Error(`Teks cue ${number} kosong.`);
    return { number, text };
  });
}

function createPageMap(cues, pageIds) {
  const pageMap = {};
  const markedPages = new Set();
  let currentPage = 1;

  for (const cue of cues) {
    const markers = [...cue.text.matchAll(/\bHalaman\s+(\d+)\b/giu)];
    if (markers.length > 1) throw new Error(`Cue ${cue.number} memiliki lebih dari satu penanda halaman.`);
    if (markers.length === 0) {
      pageMap[String(cue.number)] = pageIds[currentPage - 1];
      continue;
    }

    const marker = markers[0];
    const pageNumber = Number(marker[1]);
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > pageIds.length) {
      throw new Error(`Penanda halaman pada cue ${cue.number} tidak sesuai jumlah ID halaman (${pageIds.length}).`);
    }

    const before = cue.text.slice(0, marker.index).trim();
    const after = cue.text.slice(marker.index + marker[0].length).trim();
    const trailingBoundary = before.length > 0 && after.length === 0;

    if (trailingBoundary) {
      if (pageNumber !== currentPage + 1) {
        throw new Error(`Penanda "Halaman ${pageNumber}" di akhir cue ${cue.number} harus menandai halaman berikutnya.`);
      }
      pageMap[String(cue.number)] = pageIds[currentPage - 1];
      currentPage = pageNumber;
    } else {
      if (pageNumber < currentPage || pageNumber > currentPage + 1) {
        throw new Error(`Urutan penanda halaman pada cue ${cue.number} tidak berurutan.`);
      }
      currentPage = pageNumber;
      pageMap[String(cue.number)] = pageIds[currentPage - 1];
    }
    markedPages.add(pageNumber);
  }

  for (let pageNumber = 1; pageNumber <= pageIds.length; pageNumber += 1) {
    if (!markedPages.has(pageNumber)) {
      throw new Error(`SRT belum memiliki penanda "Halaman ${pageNumber}".`);
    }
  }
  return pageMap;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  for (const name of ["audio", "srt", "page-ids"]) {
    if (!options[name]) throw new Error(`Required option missing: --${name}`);
  }

  const audioPath = resolvePath(options.audio);
  const srtPath = resolvePath(options.srt);
  const pageIdsPath = resolvePath(options["page-ids"]);
  const outputPath = resolvePath(options.out ?? join(dirname(srtPath), `${basename(srtPath).replace(/\.srt$/i, "")}.pages.json`));

  const [audioInfo, srt, pageIdsContent] = await Promise.all([
    stat(audioPath),
    readFile(srtPath, "utf8"),
    readFile(pageIdsPath, "utf8"),
  ]);
  if (!audioInfo.isFile() || audioInfo.size === 0 || audioInfo.size > 50 * 1024 * 1024) {
    throw new Error("File audio tidak ditemukan, kosong, atau melebihi 50 MB.");
  }
  if (!audioPath.toLowerCase().endsWith(".mp3")) throw new Error("File audio harus berekstensi .mp3.");
  if (!srtPath.toLowerCase().endsWith(".srt") || Buffer.byteLength(srt, "utf8") > 1024 * 1024) {
    throw new Error("SRT harus berekstensi .srt dan maksimal 1 MB.");
  }
  if (Buffer.byteLength(pageIdsContent, "utf8") > 256 * 1024) {
    throw new Error("Page ID JSON maksimal 256 KB.");
  }

  let parsedPageIds;
  try {
    parsedPageIds = JSON.parse(pageIdsContent);
  } catch {
    throw new Error("Page ID file bukan JSON yang valid.");
  }

  const pageIds = parsePageIds(parsedPageIds);
  const cues = parseCues(srt);
  const pageMap = createPageMap(cues, pageIds);
  await writeFile(outputPath, `${JSON.stringify(pageMap, null, 2)}\n`, "utf8");
  console.log(`Berhasil membuat ${outputPath}`);
  console.log(`${cues.length} cue dipetakan ke ${pageIds.length} halaman.`);
}

main().catch((error) => {
  console.error(`Gagal membuat sidecar: ${error instanceof Error ? error.message : error}`);
  console.error(`\n${usage()}`);
  process.exitCode = 1;
});
