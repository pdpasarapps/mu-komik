export type PageTextOverlayType = "balloon" | "narration";
export type PageTextBalloonShape = "speech" | "thought" | "inner" | "none";
export type PageTextLevel = "body" | "h1" | "h2" | "h3";
export type PageTextFont = "default" | "comic-neue" | "bangers" | "patrick-hand" | "nunito" | "caveat";
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
  fontSize: number;
  font: PageTextFont;
  textColor: string;
  textLevel: PageTextLevel;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

export function parsePageTextOverlays(value: unknown): PageTextOverlay[] {
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
    fontSize: 3,
    font: "default",
    textColor: "#191b19",
    textLevel: "body",
    bold: true,
    italic: false,
    underline: false,
  };
}
