"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getInteractiveEffectDuration, getInteractiveSparklePositions, type PageInteractiveMarker } from "@/lib/page-text-overlays";
import { getInteractiveSound } from "@/lib/interactive-sounds";

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
      animationTimer.current = setTimeout(
        () => setActiveMarkerId(null),
        getInteractiveEffectDuration(marker.effect, marker.effectLoops),
      );
    }
    const librarySound = getInteractiveSound(marker.soundId);
    if (!marker.soundObjectKey && !librarySound) return;
    if (!librarySound && !publicUrl) {
      setPlaybackError("Suara interaktif belum dapat dimuat.");
      return;
    }
    audioRef.current?.pause();
    const audioUrl = librarySound
      ? librarySound.url
      : `${publicUrl!.replace(/\/$/, "")}/${marker.soundObjectKey}`;
    const audio = new Audio(audioUrl);
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
          aria-label={`Area interaktif ${index + 1}${marker.soundObjectKey || marker.soundId ? ", putar suara" : ""}${marker.effect !== "none" ? `, efek ${marker.effect}` : ""}`}
          onClick={() => void activateMarker(marker)}
          style={{
            left: `${marker.x}%`,
            top: `${marker.y}%`,
            width: `${marker.width}%`,
            height: `${marker.height}%`,
            "--effect-loop-count": marker.effectLoops,
          } as CSSProperties}
        >
          <span aria-hidden="true">{marker.soundObjectKey || marker.soundId ? "♪" : marker.effect !== "none" ? "✦" : ""}</span>
          {marker.effect === "sparkle" && getInteractiveSparklePositions(marker.id, marker.effectDensity).map((position, particleIndex) => (
            <span
              key={`${marker.id}-sparkle-${particleIndex}`}
              className="page-interactive-sparkle"
              aria-hidden="true"
              style={{
                ...position,
                "--sparkle-delay": `${(particleIndex / marker.effectDensity) * 0.2}s`,
              } as CSSProperties}
            >{particleIndex % 3 === 0 ? "✦" : "✨"}</span>
          ))}
        </button>
      ))}
      {playbackError && <span className="reader-sr-only" role="status">{playbackError}</span>}
    </div>
  );
}
