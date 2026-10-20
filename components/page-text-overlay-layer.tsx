import type { CSSProperties } from "react";
import {
  getPageTextBalloonTailPaths,
  type PageTextOverlay,
} from "@/lib/page-text-overlays";

export default function PageTextOverlayLayer({ overlays }: { overlays: PageTextOverlay[] }) {
  if (!overlays.length) return null;

  return (
    <div className="page-text-overlay-layer">
      {overlays.map((overlay) => {
        const tailPaths = overlay.type === "balloon" && overlay.shape === "speech"
          ? getPageTextBalloonTailPaths(overlay)
          : null;
        return (
          <div
            className={`page-text-overlay page-text-overlay-${overlay.type}${overlay.showOnMobile ? "" : " page-text-hide-mobile"}${overlay.showOnTablet ? "" : " page-text-hide-tablet"} page-text-font-${overlay.font} page-text-level-${overlay.textLevel}${overlay.bold ? " page-text-bold" : ""}${overlay.italic ? " page-text-italic" : ""}${overlay.underline ? " page-text-underline" : ""}${overlay.type === "balloon" ? ` page-text-balloon-${overlay.shape} page-text-tail-${overlay.tailDirection}` : ""}`}
            key={overlay.id}
            style={{
              "--page-text-x": `${overlay.x}%`,
              "--page-text-y": `${overlay.y}%`,
              "--page-text-width": `${overlay.width}%`,
              "--page-text-mobile-x": `${overlay.mobileX}%`,
              "--page-text-mobile-y": `${overlay.mobileY}%`,
              "--page-text-mobile-width": `${overlay.mobileWidth}%`,
              "--page-text-font-size": `${overlay.fontSize}cqw`,
              "--page-text-color": overlay.textColor,
            } as CSSProperties}
          >
            {overlay.type === "balloon" && overlay.shape === "speech" && (
              <svg className="page-text-balloon-tail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path d={tailPaths?.tail} />
                <path className="page-text-balloon-tail-base" d={tailPaths?.base} />
              </svg>
            )}
            <span>{overlay.text}</span>
          </div>
        );
      })}
    </div>
  );
}
