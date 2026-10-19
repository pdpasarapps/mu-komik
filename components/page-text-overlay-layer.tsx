import type { CSSProperties } from "react";
import {
  PAGE_TEXT_BALLOON_TAIL_BASE_PATHS,
  PAGE_TEXT_BALLOON_TAIL_PATHS,
  type PageTextOverlay,
} from "@/lib/page-text-overlays";

export default function PageTextOverlayLayer({ overlays }: { overlays: PageTextOverlay[] }) {
  if (!overlays.length) return null;

  return (
    <div className="page-text-overlay-layer">
      {overlays.map((overlay) => (
        <div
          className={`page-text-overlay page-text-overlay-${overlay.type} page-text-level-${overlay.textLevel}${overlay.bold ? " page-text-bold" : ""}${overlay.italic ? " page-text-italic" : ""}${overlay.underline ? " page-text-underline" : ""}${overlay.type === "balloon" ? ` page-text-balloon-${overlay.shape} page-text-tail-${overlay.tailDirection}` : ""}`}
          key={overlay.id}
          style={{
            left: `${overlay.x}%`,
            top: `${overlay.y}%`,
            width: `${overlay.width}%`,
            "--page-text-font-size": `${overlay.fontSize}cqw`,
            "--page-text-color": overlay.textColor,
          } as CSSProperties}
        >
          {overlay.type === "balloon" && overlay.shape === "speech" && (
            <svg className="page-text-balloon-tail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d={PAGE_TEXT_BALLOON_TAIL_PATHS[overlay.tailDirection]} />
              <path className="page-text-balloon-tail-base" d={PAGE_TEXT_BALLOON_TAIL_BASE_PATHS[overlay.tailDirection]} />
            </svg>
          )}
          <span>{overlay.text}</span>
        </div>
      ))}
    </div>
  );
}
