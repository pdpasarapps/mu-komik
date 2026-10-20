export type PageTextOverlayType = "balloon" | "narration";
export type PageTextBalloonShape = "speech" | "thought" | "inner" | "none";
export type PageTextLevel = "body" | "h1" | "h2" | "h3";
export type PageTextFont = "default" | "comic-neue" | "bangers" | "patrick-hand" | "nunito" | "caveat";
export type PageTextImageVerticalAlign = "top" | "center" | "bottom";
export type PageTextBalloonTailDirection =
  | "bottom-left"
  | "bottom"
  | "bottom-right"
  | "left"
  | "right"
  | "top-left"
  | "top"
  | "top-right";

export const PAGE_TEXT_BALLOON_SHAPES: Array<{ value: PageTextBalloonShape; label: string }> = [
  { value: "speech", label: "Berbicara" },
  { value: "thought", label: "Berpikir" },
  { value: "inner", label: "Dalam hati" },
  { value: "none", label: "Tanpa balon (persegi)" },
];

export const PAGE_TEXT_FONTS: Array<{ value: PageTextFont; label: string }> = [
  { value: "default", label: "Default" },
  { value: "comic-neue", label: "Comic Neue" },
  { value: "bangers", label: "Bangers" },
  { value: "patrick-hand", label: "Patrick Hand" },
  { value: "nunito", label: "Nunito" },
  { value: "caveat", label: "Caveat" },
];

export const PAGE_TEXT_BALLOON_TAIL_DIRECTIONS: Array<{ value: PageTextBalloonTailDirection; label: string }> = [
  { value: "bottom-left", label: "Kiri bawah" },
  { value: "bottom", label: "Tengah bawah" },
  { value: "bottom-right", label: "Kanan bawah" },
  { value: "left", label: "Kiri" },
  { value: "right", label: "Kanan" },
  { value: "top-left", label: "Kiri atas" },
  { value: "top", label: "Tengah atas" },
  { value: "top-right", label: "Kanan atas" },
];

export const PAGE_TEXT_BALLOON_TAIL_PATHS: Record<PageTextBalloonTailDirection, string> = {
  "bottom-left": "M 8 4 L 38 4 L 14 96 Z",
  bottom: "M 37 4 L 63 4 L 50 96 Z",
  "bottom-right": "M 62 4 L 92 4 L 86 96 Z",
  left: "M 96 32 L 96 68 L 4 50 Z",
  right: "M 4 32 L 4 68 L 96 50 Z",
  "top-left": "M 8 96 L 38 96 L 14 4 Z",
  top: "M 37 96 L 63 96 L 50 4 Z",
  "top-right": "M 62 96 L 92 96 L 86 4 Z",
};

export const PAGE_TEXT_BALLOON_TAIL_BASE_PATHS: Record<PageTextBalloonTailDirection, string> = {
  "bottom-left": "M 8 4 L 38 4",
  bottom: "M 37 4 L 63 4",
  "bottom-right": "M 62 4 L 92 4",
  left: "M 96 32 L 96 68",
  right: "M 4 32 L 4 68",
  "top-left": "M 8 96 L 38 96",
  top: "M 37 96 L 63 96",
  "top-right": "M 62 96 L 92 96",
};

export type PageTextOverlay = {
  id: string;
  type: PageTextOverlayType;
  shape: PageTextBalloonShape;
  tailDirection: PageTextBalloonTailDirection;
  text: string;
  x: number;
  y: number;
  width: number;
  mobileX: number;
  mobileY: number;
  mobileWidth: number;
  showOnMobile: boolean;
  showOnTablet: boolean;
  fontSize: number;
  font: PageTextFont;
  textColor: string;
  textLevel: PageTextLevel;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

export type PageInteractiveEffect = "none" | "sparkle" | "impact" | "shake";

export type PageInteractiveMarker = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  soundObjectKey: string | null;
  soundId: string | null;
  effect: PageInteractiveEffect;
  effectLoops: number;
  effectDensity: number;
};

export type PageTextOverlayDocument = {
  overlays: PageTextOverlay[];
  interactiveMarkers: PageInteractiveMarker[];
  imageVerticalAlign: PageTextImageVerticalAlign;
};

export function getInteractiveSparklePositions(markerId: string, density: number) {
  let seed = 2166136261;
  for (let index = 0; index < markerId.length; index += 1) {
    seed = Math.imul(seed ^ markerId.charCodeAt(index), 16777619);
  }
  const positions: Array<{ left: string; top: string }> = [];
  for (let index = 0; index < density; index += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const x = 10 + (seed / 0x100000000) * 80;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const y = 10 + (seed / 0x100000000) * 80;
    positions.push({ left: `${x}%`, top: `${y}%` });
  }
  return positions;
}

export function getInteractiveEffectDuration(effect: PageInteractiveEffect, loops: number) {
  if (effect === "none") return 0;
  const loopDuration = effect === "sparkle" ? 900 : effect === "impact" ? 800 : 600;
  return loops * loopDuration + (effect === "sparkle" ? 200 : 0);
}

function isPageTextImageVerticalAlign(value: unknown): value is PageTextImageVerticalAlign {
  return value === "top" || value === "center" || value === "bottom";
}

export function parsePageTextOverlays(value: unknown): PageTextOverlay[] {
  if (value && typeof value === "object" && !Array.isArray(value) && "overlays" in value) {
    return parsePageTextOverlays(value.overlays);
  }
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("Teks halaman harus berupa daftar.");

  return value.map((item, index) => {
    if (
      !item
      || typeof item !== "object"
      || !("id" in item) || typeof item.id !== "string"
      || !("type" in item) || (item.type !== "balloon" && item.type !== "narration")
      || "shape" in item && item.shape !== undefined
        && item.shape !== "speech" && item.shape !== "thought" && item.shape !== "inner" && item.shape !== "none"
      || "tailDirection" in item && item.tailDirection !== undefined
        && (typeof item.tailDirection !== "string"
          || !PAGE_TEXT_BALLOON_TAIL_DIRECTIONS.some((direction) => direction.value === item.tailDirection))
      || !("text" in item) || typeof item.text !== "string"
      || !("x" in item) || typeof item.x !== "number" || !Number.isFinite(item.x)
      || !("y" in item) || typeof item.y !== "number" || !Number.isFinite(item.y)
      || !("width" in item) || typeof item.width !== "number" || !Number.isFinite(item.width)
      || "mobileX" in item && item.mobileX !== undefined && (typeof item.mobileX !== "number" || !Number.isFinite(item.mobileX))
      || "mobileY" in item && item.mobileY !== undefined && (typeof item.mobileY !== "number" || !Number.isFinite(item.mobileY))
      || "mobileWidth" in item && item.mobileWidth !== undefined && (typeof item.mobileWidth !== "number" || !Number.isFinite(item.mobileWidth))
      || "showOnMobile" in item && item.showOnMobile !== undefined && typeof item.showOnMobile !== "boolean"
      || "showOnTablet" in item && item.showOnTablet !== undefined && typeof item.showOnTablet !== "boolean"
      || "imageVerticalAlign" in item && item.imageVerticalAlign !== undefined
        && !isPageTextImageVerticalAlign(item.imageVerticalAlign)
      || !("fontSize" in item) || typeof item.fontSize !== "number" || !Number.isFinite(item.fontSize)
      || "font" in item && item.font !== undefined
        && (typeof item.font !== "string" || !PAGE_TEXT_FONTS.some((font) => font.value === item.font))
      || "textColor" in item && item.textColor !== undefined
        && (typeof item.textColor !== "string" || !/^#[\da-f]{6}$/i.test(item.textColor))
      || "textLevel" in item && item.textLevel !== undefined
        && item.textLevel !== "body" && item.textLevel !== "h1" && item.textLevel !== "h2" && item.textLevel !== "h3"
      || "bold" in item && item.bold !== undefined && typeof item.bold !== "boolean"
      || "italic" in item && item.italic !== undefined && typeof item.italic !== "boolean"
      || "underline" in item && item.underline !== undefined && typeof item.underline !== "boolean"
    ) {
      throw new Error(`Format teks halaman ke-${index + 1} tidak valid.`);
    }

    const width = Math.min(80, Math.max(12, item.width));
    const mobileWidth = "mobileWidth" in item && typeof item.mobileWidth === "number"
      ? Math.min(80, Math.max(12, item.mobileWidth))
      : width;
    const mobileX = "mobileX" in item && typeof item.mobileX === "number" ? item.mobileX : item.x;
    const mobileY = "mobileY" in item && typeof item.mobileY === "number" ? item.mobileY : item.y;
    return {
      id: item.id,
      type: item.type,
      shape: item.type === "balloon" && "shape" in item && item.shape
        ? item.shape as PageTextBalloonShape
        : "speech",
      tailDirection: "tailDirection" in item && item.tailDirection
        ? item.tailDirection as PageTextBalloonTailDirection
        : "bottom-left",
      text: item.text.slice(0, 500),
      x: Math.min(100 - width / 2, Math.max(width / 2, item.x)),
      y: Math.min(100, Math.max(0, item.y)),
      width,
      mobileX: Math.min(100 - mobileWidth / 2, Math.max(mobileWidth / 2, mobileX)),
      mobileY: Math.min(100, Math.max(0, mobileY)),
      mobileWidth,
      showOnMobile: "showOnMobile" in item && typeof item.showOnMobile === "boolean" ? item.showOnMobile : true,
      showOnTablet: "showOnTablet" in item && typeof item.showOnTablet === "boolean" ? item.showOnTablet : true,
      fontSize: Math.min(8, Math.max(1.5, item.fontSize)),
      font: "font" in item && typeof item.font === "string" && PAGE_TEXT_FONTS.some((font) => font.value === item.font)
        ? item.font as PageTextFont
        : "default",
      textColor: "textColor" in item && typeof item.textColor === "string"
        ? item.textColor
        : item.type === "balloon" && "shape" in item && item.shape === "inner" ? "#312a47" : "#191b19",
      textLevel: "textLevel" in item && item.textLevel
        ? item.textLevel as PageTextLevel
        : "body",
      bold: "bold" in item && typeof item.bold === "boolean" ? item.bold : true,
      italic: "italic" in item && typeof item.italic === "boolean"
        ? item.italic
        : item.type === "balloon" && "shape" in item && item.shape === "inner",
      underline: "underline" in item && typeof item.underline === "boolean" ? item.underline : false,
    };
  });
}

export function parsePageTextOverlayDocument(value: unknown): PageTextOverlayDocument {
  if (Array.isArray(value)) {
    const overlays = parsePageTextOverlays(value);
    const legacyAlign = value.find((item) => item && typeof item === "object" && "imageVerticalAlign" in item)?.imageVerticalAlign;
    return {
      overlays,
      interactiveMarkers: [],
      imageVerticalAlign: isPageTextImageVerticalAlign(legacyAlign) ? legacyAlign : "center",
    };
  }
  if (!value || typeof value !== "object" || !("overlays" in value)) {
    if (value == null) return { overlays: [], interactiveMarkers: [], imageVerticalAlign: "center" };
    throw new Error("Pengaturan teks halaman tidak valid.");
  }
  if ("imageVerticalAlign" in value && value.imageVerticalAlign !== undefined && !isPageTextImageVerticalAlign(value.imageVerticalAlign)) {
    throw new Error("Posisi gambar halaman tidak valid.");
  }
  const interactiveMarkers = "interactiveMarkers" in value && value.interactiveMarkers !== undefined
    ? parsePageInteractiveMarkers(value.interactiveMarkers)
    : [];
  return {
    overlays: parsePageTextOverlays(value.overlays),
    interactiveMarkers,
    imageVerticalAlign: "imageVerticalAlign" in value && isPageTextImageVerticalAlign(value.imageVerticalAlign)
      ? value.imageVerticalAlign
      : "center",
  };
}

export function parsePageInteractiveMarkers(value: unknown): PageInteractiveMarker[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("Area interaktif halaman harus berupa daftar.");
  return value.map((item, index) => {
    if (!item || typeof item !== "object"
      || !("id" in item) || typeof item.id !== "string" || !item.id
      || !("x" in item) || typeof item.x !== "number" || !Number.isFinite(item.x)
      || !("y" in item) || typeof item.y !== "number" || !Number.isFinite(item.y)
      || !("width" in item) || typeof item.width !== "number" || !Number.isFinite(item.width)
      || !("height" in item) || typeof item.height !== "number" || !Number.isFinite(item.height)
      || "soundObjectKey" in item && item.soundObjectKey !== null && item.soundObjectKey !== undefined && typeof item.soundObjectKey !== "string"
      || "soundObjectKey" in item && typeof item.soundObjectKey === "string"
        && !/^comics\/[a-f0-9-]{36}\/chapters\/[a-f0-9-]{36}\/pages\/[a-f0-9-]{36}\/interactive\/[a-f0-9-]{36}\.(mp3|ogg)$/i.test(item.soundObjectKey)
      || "soundId" in item && item.soundId !== null && item.soundId !== undefined
        && (typeof item.soundId !== "string" || !/^(laugh|cry|cheer|magic|impact)$/.test(item.soundId))
      || "soundId" in item && typeof item.soundId === "string"
        && "soundObjectKey" in item && typeof item.soundObjectKey === "string"
      || "effect" in item && item.effect !== undefined && item.effect !== "none"
        && item.effect !== "sparkle" && item.effect !== "impact" && item.effect !== "shake"
      || "effectLoops" in item && (typeof item.effectLoops !== "number" || !Number.isInteger(item.effectLoops) || item.effectLoops < 1 || item.effectLoops > 10)
      || "effectDensity" in item && (typeof item.effectDensity !== "number" || !Number.isInteger(item.effectDensity) || item.effectDensity < 1 || item.effectDensity > 20)
    ) {
      throw new Error(`Area interaktif halaman ke-${index + 1} tidak valid.`);
    }
    const width = Math.min(100, Math.max(5, item.width));
    const height = Math.min(100, Math.max(5, item.height));
    return {
      id: item.id,
      x: Math.min(100 - width / 2, Math.max(width / 2, item.x)),
      y: Math.min(100 - height / 2, Math.max(height / 2, item.y)),
      width,
      height,
      soundObjectKey: "soundObjectKey" in item && typeof item.soundObjectKey === "string" ? item.soundObjectKey : null,
      soundId: "soundId" in item && typeof item.soundId === "string" ? item.soundId : null,
      effect: "effect" in item && item.effect ? item.effect as PageInteractiveEffect : "sparkle",
      effectLoops: "effectLoops" in item && typeof item.effectLoops === "number" ? item.effectLoops : 3,
      effectDensity: "effectDensity" in item && typeof item.effectDensity === "number" ? item.effectDensity : 8,
    };
  });
}

export function serializePageTextOverlayDocument(document: PageTextOverlayDocument): string {
  return JSON.stringify({
    version: 1,
    imageVerticalAlign: document.imageVerticalAlign,
    overlays: document.overlays,
    interactiveMarkers: document.interactiveMarkers,
  });
}

export function createPageInteractiveMarker(): PageInteractiveMarker {
  return {
    id: crypto.randomUUID(),
    x: 50,
    y: 50,
    width: 24,
    height: 18,
    soundObjectKey: null,
    soundId: null,
    effect: "sparkle",
    effectLoops: 3,
    effectDensity: 8,
  };
}

export function createPageTextOverlay(type: PageTextOverlayType): PageTextOverlay {
  return {
    id: crypto.randomUUID(),
    type,
    shape: "speech",
    tailDirection: "bottom-left",
    text: "",
    x: 50,
    y: 50,
    width: type === "balloon" ? 32 : 38,
    mobileX: 50,
    mobileY: 50,
    mobileWidth: type === "balloon" ? 38 : 44,
    showOnMobile: true,
    showOnTablet: true,
    fontSize: 3,
    font: "default",
    textColor: "#191b19",
    textLevel: "body",
    bold: true,
    italic: false,
    underline: false,
  };
}
