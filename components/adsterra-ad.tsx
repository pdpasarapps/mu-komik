"use client";

import { useEffect, useState } from "react";
import { useReaderMembership } from "@/app/membership-runtime";
import { useKidsMode } from "@/app/platform-runtime";
import { useLocale } from "@/components/locale-provider";

type AdPlacement = "home" | "catalog" | "comic" | "reader" | "transition";
type DisplayZone = { key: string; width: number; height: number };

const DISPLAY_ZONES = {
  "160x300": { key: "1ef95b90c31ac7191d3bdc024f4cf01c", width: 160, height: 300 },
  "160x600": { key: "db2c47b40a0e9eef0b2669ca93b03b62", width: 160, height: 600 },
  "300x250": { key: "51120570fa3661dc2a8e9016ca718d54", width: 300, height: 250 },
  "320x50": { key: "0a62f4c24af0d54ef50bf2da0fb8ec63", width: 320, height: 50 },
  "468x60": { key: "53162ef874bdfb22a213745a38244962", width: 468, height: 60 },
  "728x90": { key: "a92f4f1a790943865638f79cf561cfef", width: 728, height: 90 },
} satisfies Record<string, DisplayZone>;

const NATIVE_ZONE = "7638d28d7b56e0ee6c1ecf5d0e1c8cc3";

function getDisplayZone(placement: AdPlacement, viewportWidth: number): DisplayZone {
  if (placement === "home" || placement === "reader") {
    if (viewportWidth <= 640) return DISPLAY_ZONES["320x50"];
    if (viewportWidth <= 1023) return DISPLAY_ZONES["468x60"];
    return placement === "reader" ? DISPLAY_ZONES["300x250"] : DISPLAY_ZONES["728x90"];
  }
  return DISPLAY_ZONES["300x250"];
}

function getDisplaySource(zone: DisplayZone) {
  const options = JSON.stringify({
    key: zone.key,
    format: "iframe",
    height: zone.height,
    width: zone.width,
    params: {},
  });
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}body{display:grid;place-items:center}</style></head><body><script>window.atOptions=${options};</script><script src="https://bauval.org/22/${zone.key}"></script></body></html>`;
}

function getNativeSource() {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;width:100%;min-height:300px;overflow:hidden}</style></head><body><script async="async" data-cfasync="false" src="https://bauval.org/21/${NATIVE_ZONE}"></script><div id="container-${NATIVE_ZONE}"></div></body></html>`;
}

export default function AdsterraAd({
  placement,
  format = "display",
  onAvailabilityChange,
}: {
  placement: AdPlacement;
  format?: "display" | "native";
  onAvailabilityChange?: (available: boolean) => void;
}) {
  const membership = useReaderMembership();
  const { kidsMode } = useKidsMode();
  const { t } = useLocale();
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener("resize", updateViewportWidth);
    return () => window.removeEventListener("resize", updateViewportWidth);
  }, []);

  useEffect(() => {
    if (membership.ready && (kidsMode || membership.tier !== "free")) {
      onAvailabilityChange?.(false);
    }
  }, [kidsMode, membership.ready, membership.tier, onAvailabilityChange]);

  if (kidsMode || !membership.ready || membership.tier !== "free") return null;
  if (format === "display" && viewportWidth === null) return null;

  const zone = format === "display" ? getDisplayZone(placement, viewportWidth ?? 1280) : null;
  const source = zone ? getDisplaySource(zone) : getNativeSource();
  const frameWidth = zone ? `${zone.width}px` : "100%";
  const frameHeight = zone ? `${zone.height}px` : "300px";

  return (
    <aside className={`adsterra-slot adsterra-slot-${placement}${format === "native" ? " adsterra-slot-native" : ""}`} aria-label={t("Iklan")}>
      <span className="adsterra-slot-label">{t("Iklan")}</span>
      <iframe
        className="adsterra-slot-frame"
        title={`Adsterra ${format} advertisement`}
        srcDoc={source}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ width: frameWidth, height: frameHeight }}
        onLoad={() => onAvailabilityChange?.(true)}
        onError={() => onAvailabilityChange?.(false)}
      />
    </aside>
  );
}
