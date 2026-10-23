export type PageTextOverlayType = "balloon" | "narration";
export type PageTextBalloonShape = "speech" | "thought" | "shout" | "surprise" | "inner" | "none";
export type PageTextLevel = "body" | "h1" | "h2" | "h3";
export type PageTextFont = "default" | "comic-neue" | "bangers" | "patrick-hand" | "nunito" | "caveat";
export type PageTextImageVerticalAlign = "top" | "center" | "bottom";
export type PageVisualEffect = "rain" | "fog" | "snow" | "sparkles";
export type PageColorFilter = "none" | "warm" | "cool" | "vintage" | "mono" | "cinematic";
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
  { value: "shout", label: "Teriak" },
  { value: "surprise", label: "Kaget" },
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

export const PAGE_VISUAL_EFFECTS: Array<{ value: PageVisualEffect; label: string }> = [
  { value: "rain", label: "Hujan" },
  { value: "fog", label: "Kabut" },
  { value: "snow", label: "Salju" },
  { value: "sparkles", label: "Kilau" },
];

export const PAGE_COLOR_FILTERS: Array<{ value: PageColorFilter; label: string }> = [
  { value: "none", label: "Tanpa filter" },
  { value: "warm", label: "Hangat" },
  { value: "cool", label: "Dingin" },
  { value: "vintage", label: "Vintage" },
  { value: "mono", label: "Monokrom" },
  { value: "cinematic", label: "Sinematik" },
];

export type PageTextOverlay = {
  id: string;
  type: PageTextOverlayType;
  shape: PageTextBalloonShape;
  tailDirection: PageTextBalloonTailDirection;
  tailBaseStartAngle: number;
  tailBaseEndAngle: number;
  tailTipX: number;
  tailTipY: number;
  tailControlX: number;
  tailControlY: number;
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

export type PageTextBalloonTailGeometry = Pick<
  PageTextOverlay,
  "tailBaseStartAngle" | "tailBaseEndAngle" | "tailTipX" | "tailTipY" | "tailControlX" | "tailControlY"
>;

const defaultPageTextBalloonTailGeometry: Record<PageTextBalloonTailDirection, PageTextBalloonTailGeometry> = {
  "bottom-left": { tailBaseStartAngle: 105, tailBaseEndAngle: 150, tailTipX: 15, tailTipY: 150, tailControlX: 15, tailControlY: 120 },
  bottom: { tailBaseStartAngle: 75, tailBaseEndAngle: 105, tailTipX: 50, tailTipY: 155, tailControlX: 50, tailControlY: 125 },
  "bottom-right": { tailBaseStartAngle: 30, tailBaseEndAngle: 75, tailTipX: 85, tailTipY: 150, tailControlX: 85, tailControlY: 120 },
  left: { tailBaseStartAngle: 145, tailBaseEndAngle: 215, tailTipX: -55, tailTipY: 50, tailControlX: -25, tailControlY: 50 },
  right: { tailBaseStartAngle: 325, tailBaseEndAngle: 395, tailTipX: 155, tailTipY: 50, tailControlX: 125, tailControlY: 50 },
  "top-left": { tailBaseStartAngle: 210, tailBaseEndAngle: 255, tailTipX: 15, tailTipY: -50, tailControlX: 15, tailControlY: -20 },
  top: { tailBaseStartAngle: 255, tailBaseEndAngle: 285, tailTipX: 50, tailTipY: -55, tailControlX: 50, tailControlY: -25 },
  "top-right": { tailBaseStartAngle: 285, tailBaseEndAngle: 330, tailTipX: 85, tailTipY: -50, tailControlX: 85, tailControlY: -20 },
};

export const PAGE_TEXT_BALLOON_TAIL_RADIUS_X = 48 / 1.1;

function formatTailCoordinate(value: number) {
  return Number(value.toFixed(2));
}

function getTailEllipsePoint(angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: formatTailCoordinate(50 + PAGE_TEXT_BALLOON_TAIL_RADIUS_X * Math.cos(radians)),
    y: formatTailCoordinate(50 + 50 * Math.sin(radians)),
  };
}

export function getPageTextBalloonTailGeometry(direction: PageTextBalloonTailDirection): PageTextBalloonTailGeometry {
  return { ...defaultPageTextBalloonTailGeometry[direction] };
}

export function getPageTextBalloonTailPaths(geometry: PageTextBalloonTailGeometry) {
  const start = getTailEllipsePoint(geometry.tailBaseStartAngle);
  const end = getTailEllipsePoint(geometry.tailBaseEndAngle);
  const arc = ((geometry.tailBaseEndAngle - geometry.tailBaseStartAngle) % 360 + 360) % 360;
  const sweep = arc <= 180 ? 1 : 0;
  return {
    tail: `M ${start.x} ${start.y} Q ${geometry.tailControlX} ${geometry.tailControlY} ${geometry.tailTipX} ${geometry.tailTipY} Q ${geometry.tailControlX} ${geometry.tailControlY} ${end.x} ${end.y} Z`,
    base: `M ${start.x} ${start.y} A ${formatTailCoordinate(PAGE_TEXT_BALLOON_TAIL_RADIUS_X)} 50 0 0 ${sweep} ${end.x} ${end.y}`,
    start,
    end,
    tip: { x: geometry.tailTipX, y: geometry.tailTipY },
    control: { x: geometry.tailControlX, y: geometry.tailControlY },
  };
}

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
  visualEffects: PageVisualEffects;
};

export type PageVisualEffects = {
  effects: PageVisualEffect[];
  colorFilter: PageColorFilter;
  effectSettings: Record<PageVisualEffect, PageVisualEffectSettings>;
};

export type PageVisualEffectSettings = {
  density: number;
  speed: number;
  densityMultiplier: number;
  speedMultiplier: number;
};

export const defaultPageVisualEffectSettings: Record<PageVisualEffect, PageVisualEffectSettings> = {
  rain: { density: 50, speed: 100, densityMultiplier: 1, speedMultiplier: 1 },
  fog: { density: 50, speed: 100, densityMultiplier: 1, speedMultiplier: 1 },
  snow: { density: 50, speed: 100, densityMultiplier: 1, speedMultiplier: 1 },
  sparkles: { density: 50, speed: 100, densityMultiplier: 1, speedMultiplier: 1 },
};

export const defaultPageVisualEffects: PageVisualEffects = {
  effects: [],
  colorFilter: "none",
  effectSettings: defaultPageVisualEffectSettings,
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
        && item.shape !== "speech" && item.shape !== "thought" && item.shape !== "shout"
        && item.shape !== "surprise" && item.shape !== "inner" && item.shape !== "none"
      || "tailDirection" in item && item.tailDirection !== undefined
        && (typeof item.tailDirection !== "string"
          || !PAGE_TEXT_BALLOON_TAIL_DIRECTIONS.some((direction) => direction.value === item.tailDirection))
      || "tailBaseStartAngle" in item && item.tailBaseStartAngle !== undefined
        && (typeof item.tailBaseStartAngle !== "number" || !Number.isFinite(item.tailBaseStartAngle) || item.tailBaseStartAngle < 0 || item.tailBaseStartAngle > 360)
      || "tailBaseEndAngle" in item && item.tailBaseEndAngle !== undefined
        && (typeof item.tailBaseEndAngle !== "number" || !Number.isFinite(item.tailBaseEndAngle) || item.tailBaseEndAngle < 0 || item.tailBaseEndAngle > 720)
      || "tailTipX" in item && item.tailTipX !== undefined
        && (typeof item.tailTipX !== "number" || !Number.isFinite(item.tailTipX) || item.tailTipX < -200 || item.tailTipX > 300)
      || "tailTipY" in item && item.tailTipY !== undefined
        && (typeof item.tailTipY !== "number" || !Number.isFinite(item.tailTipY) || item.tailTipY < -200 || item.tailTipY > 300)
      || "tailControlX" in item && item.tailControlX !== undefined
        && (typeof item.tailControlX !== "number" || !Number.isFinite(item.tailControlX) || item.tailControlX < -200 || item.tailControlX > 300)
      || "tailControlY" in item && item.tailControlY !== undefined
        && (typeof item.tailControlY !== "number" || !Number.isFinite(item.tailControlY) || item.tailControlY < -200 || item.tailControlY > 300)
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
    const tailDirection = "tailDirection" in item && item.tailDirection
      ? item.tailDirection as PageTextBalloonTailDirection
      : "bottom-left";
    const defaultTailGeometry = getPageTextBalloonTailGeometry(tailDirection);
    return {
      id: item.id,
      type: item.type,
      shape: item.type === "balloon" && "shape" in item && item.shape
        ? item.shape as PageTextBalloonShape
        : "speech",
      tailDirection,
      tailBaseStartAngle: "tailBaseStartAngle" in item && typeof item.tailBaseStartAngle === "number"
        ? item.tailBaseStartAngle
        : defaultTailGeometry.tailBaseStartAngle,
      tailBaseEndAngle: "tailBaseEndAngle" in item && typeof item.tailBaseEndAngle === "number"
        ? item.tailBaseEndAngle
        : defaultTailGeometry.tailBaseEndAngle,
      tailTipX: "tailTipX" in item && typeof item.tailTipX === "number" ? item.tailTipX : defaultTailGeometry.tailTipX,
      tailTipY: "tailTipY" in item && typeof item.tailTipY === "number" ? item.tailTipY : defaultTailGeometry.tailTipY,
      tailControlX: "tailControlX" in item && typeof item.tailControlX === "number" ? item.tailControlX : defaultTailGeometry.tailControlX,
      tailControlY: "tailControlY" in item && typeof item.tailControlY === "number" ? item.tailControlY : defaultTailGeometry.tailControlY,
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
      visualEffects: defaultPageVisualEffects,
    };
  }
  if (!value || typeof value !== "object" || !("overlays" in value)) {
    if (value == null) return { overlays: [], interactiveMarkers: [], imageVerticalAlign: "center", visualEffects: defaultPageVisualEffects };
    throw new Error("Pengaturan teks halaman tidak valid.");
  }
  if ("imageVerticalAlign" in value && value.imageVerticalAlign !== undefined && !isPageTextImageVerticalAlign(value.imageVerticalAlign)) {
    throw new Error("Posisi gambar halaman tidak valid.");
  }
  const interactiveMarkers = "interactiveMarkers" in value && value.interactiveMarkers !== undefined
    ? parsePageInteractiveMarkers(value.interactiveMarkers)
    : [];
  const visualEffects = parsePageVisualEffects(value);
  return {
    overlays: parsePageTextOverlays(value.overlays),
    interactiveMarkers,
    imageVerticalAlign: "imageVerticalAlign" in value && isPageTextImageVerticalAlign(value.imageVerticalAlign)
      ? value.imageVerticalAlign
      : "center",
    visualEffects,
  };
}

function parsePageVisualEffects(value: object): PageVisualEffects {
  if (!("visualEffects" in value) || value.visualEffects === undefined) return defaultPageVisualEffects;
  const visualEffects = value.visualEffects;
  if (!visualEffects || typeof visualEffects !== "object" || !("effects" in visualEffects)
    || !Array.isArray(visualEffects.effects)
    || visualEffects.effects.some((effect) => typeof effect !== "string"
      || !PAGE_VISUAL_EFFECTS.some((option) => option.value === effect))
    || "density" in visualEffects && visualEffects.density !== undefined
      && (typeof visualEffects.density !== "number" || !Number.isInteger(visualEffects.density)
        || visualEffects.density < 1 || visualEffects.density > 100)
    || "speed" in visualEffects && visualEffects.speed !== undefined
      && (typeof visualEffects.speed !== "number" || !Number.isInteger(visualEffects.speed)
        || visualEffects.speed < 25 || visualEffects.speed > 200)
    || "colorFilter" in visualEffects && visualEffects.colorFilter !== undefined
      && (typeof visualEffects.colorFilter !== "string"
        || !PAGE_COLOR_FILTERS.some((option) => option.value === visualEffects.colorFilter))
    || "effectSettings" in visualEffects && visualEffects.effectSettings !== undefined
      && (!visualEffects.effectSettings || typeof visualEffects.effectSettings !== "object")
  ) {
    throw new Error("Efek visual halaman tidak valid.");
  }
  const legacyDensity = "density" in visualEffects && typeof visualEffects.density === "number" ? visualEffects.density : 50;
  const legacySpeed = "speed" in visualEffects && typeof visualEffects.speed === "number" ? visualEffects.speed : 100;
  const storedEffectSettings: Record<string, unknown> = "effectSettings" in visualEffects
    && visualEffects.effectSettings && typeof visualEffects.effectSettings === "object"
    ? visualEffects.effectSettings as Record<string, unknown>
    : {};
  const effectSettings = Object.fromEntries(PAGE_VISUAL_EFFECTS.map(({ value: effect }) => {
    const stored = effect in storedEffectSettings ? storedEffectSettings[effect] : undefined;
    if (stored !== undefined && (!stored || typeof stored !== "object"
      || !("density" in stored) || typeof stored.density !== "number" || !Number.isInteger(stored.density) || stored.density < 1 || stored.density > 100
      || !("speed" in stored) || typeof stored.speed !== "number" || !Number.isInteger(stored.speed) || stored.speed < 25 || stored.speed > 200
      || "densityMultiplier" in stored && (typeof stored.densityMultiplier !== "number"
        || !Number.isInteger(stored.densityMultiplier) || stored.densityMultiplier < 1 || stored.densityMultiplier > 10)
      || "speedMultiplier" in stored && (typeof stored.speedMultiplier !== "number"
        || !Number.isInteger(stored.speedMultiplier) || stored.speedMultiplier < 1 || stored.speedMultiplier > 10))) {
      throw new Error(`Pengaturan efek ${effect} tidak valid.`);
    }
    return [effect, {
      density: stored ? stored.density as number : legacyDensity,
      speed: stored ? stored.speed as number : legacySpeed,
      densityMultiplier: stored && "densityMultiplier" in stored ? stored.densityMultiplier as number : 1,
      speedMultiplier: stored && "speedMultiplier" in stored ? stored.speedMultiplier as number : 1,
    }];
  })) as Record<PageVisualEffect, PageVisualEffectSettings>;
  return {
    effects: [...new Set(visualEffects.effects as PageVisualEffect[])],
    colorFilter: "colorFilter" in visualEffects && typeof visualEffects.colorFilter === "string"
      ? visualEffects.colorFilter as PageColorFilter
      : "none",
    effectSettings,
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
    visualEffects: document.visualEffects,
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
  const tailDirection = "bottom-left";
  return {
    id: crypto.randomUUID(),
    type,
    shape: "speech",
    tailDirection,
    ...getPageTextBalloonTailGeometry(tailDirection),
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
