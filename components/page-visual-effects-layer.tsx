import type { CSSProperties } from "react";
import type { PageColorFilter, PageVisualEffect, PageVisualEffectSettings } from "@/lib/page-text-overlays";

const effectParticleCounts: Record<PageVisualEffect, number> = {
  rain: 28,
  fog: 3,
  snow: 22,
  sparkles: 14,
};

function getParticleStyle(index: number): CSSProperties {
  const left = ((index * 47 + 13) % 97) + 1;
  const top = ((index * 61 + 7) % 101) - 1;
  const delay = -((index * 17) % 40) / 10;
  const duration = 3 + (index % 5) * 0.7;
  const size = 2 + (index % 4);
  return {
    left: `${left}%`,
    top: `${top}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    width: `${size}px`,
    height: `${size}px`,
  } as CSSProperties;
}

export function getPageVisualFilterClass(colorFilter: PageColorFilter) {
  return colorFilter === "none" ? "" : `page-visual-filter-${colorFilter}`;
}

export default function PageVisualEffectsLayer({ effects, effectSettings }: {
  effects: PageVisualEffect[];
  effectSettings: Record<PageVisualEffect, PageVisualEffectSettings>;
}) {
  if (!effects.length) return null;

  return (
    <div className="page-visual-effects-layer" aria-hidden="true">
      {effects.map((effect) => {
        const { density, speed, densityMultiplier, speedMultiplier } = effectSettings[effect];
        const particleCount = Math.min(200, Math.max(1, Math.round(effectParticleCounts[effect] * density / 50 * densityMultiplier)));
        const effectStyle = {
          "--page-vfx-density": Math.min(1, density / 100 * densityMultiplier),
          "--page-vfx-speed": 100 / (speed * speedMultiplier),
        } as CSSProperties;
        return effect === "fog"
          ? <div className="page-visual-fog" key={effect} style={effectStyle}>{Array.from({ length: particleCount }, (_, index) => <span key={index} style={getParticleStyle(index)} />)}</div>
        : (
          <div className={`page-visual-effect page-visual-effect-${effect}`} key={effect} style={effectStyle}>
            {Array.from({ length: particleCount }, (_, index) => (
              <span key={index} style={getParticleStyle(index)}>
                {effect === "sparkles" ? (index % 2 ? "✦" : "✧") : null}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
