"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PageInteractiveMarker } from "@/lib/page-text-overlays";

const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

export default function PageInteractiveMarkerLayer({ markers }: { markers: PageInteractiveMarker[] }) {
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (animationTimer.current) clearTimeout(animationTimer.current);
    audioRef.current?.pause();
  }, []);

  async function activateMarker(marker: PageInteractiveMarker) {
    setPlaybackError("");
    setActiveMarkerId(marker.effect === "none" ? null : marker.id);
    if (animationTimer.current) clearTimeout(animationTimer.current);
    if (marker.effect !== "none") {
      animationTimer.current = setTimeout(() => setActiveMarkerId(null), 900);
    }
    if (!marker.soundObjectKey) return;
    if (!publicUrl) {
      setPlaybackError("Suara interaktif belum dapat dimuat.");
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(`${publicUrl.replace(/\/$/, "")}/${marker.soundObjectKey}`);
    audioRef.current = audio;
    audio.onended = () => {
      if (audioRef.current === audio) audioRef.current = null;
    };
    audio.onerror = () => {
      if (audioRef.current === audio) audioRef.current = null;
      setPlaybackError("Suara interaktif gagal dimuat.");
    };
    try {
      await audio.play();
    } catch (error) {
      console.error("Unable to play interactive page sound:", error);
      setPlaybackError("Suara tidak dapat diputar. Ketuk area lagi untuk mencoba.");
    }
  }

  if (!markers.length) return null;

  return (
    <div className="page-interactive-marker-layer">
      {markers.map((marker, index) => (
        <button
          className={`page-interactive-marker page-interactive-marker-${marker.effect}${activeMarkerId === marker.id ? " is-active" : ""}`}
          key={marker.id}
          type="button"
          aria-label={`Area interaktif ${index + 1}${marker.soundObjectKey ? ", putar suara" : ""}${marker.effect !== "none" ? `, efek ${marker.effect}` : ""}`}
          onClick={() => void activateMarker(marker)}
          style={{
            left: `${marker.x}%`,
            top: `${marker.y}%`,
            width: `${marker.width}%`,
            height: `${marker.height}%`,
          } as CSSProperties}
        >
          <span aria-hidden="true">{marker.soundObjectKey ? "♪" : marker.effect !== "none" ? "✦" : ""}</span>
        </button>
      ))}
      {playbackError && <span className="reader-sr-only" role="status">{playbackError}</span>}
    </div>
  );
}
