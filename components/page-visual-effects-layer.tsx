import type { CSSProperties } from "react";
import type { PageColorFilter, PageLeafColor, PageVisualEffect, PageVisualEffectSettings } from "@/lib/page-text-overlays";

const leafGradients: Record<PageLeafColor, string> = {
  green: "linear-gradient(135deg, #b7a64f, #657e35 70%, #425e30)",
  yellow: "linear-gradient(135deg, #fff2a0, #d3b735 70%, #987b24)",
  orange: "linear-gradient(135deg, #ffd078, #e47b2f 70%, #a94a28)",
  red: "linear-gradient(135deg, #ffad78, #c94335 70%, #792d35)",
  brown: "linear-gradient(135deg, #d4a76d, #8b5b35 70%, #563a2c)",
};

const effectParticleCounts: Record<PageVisualEffect, number> = {
  rain: 28,
  fog: 3,
  snow: 22,
  sparkles: 14,
  insects: 8,
  leaves: 10,
  glow: 8,
  burst: 5,
  stars: 24,
};

function getParticleStyle(index: number, leafSize = 8, leafRandomness = 50, effect?: PageVisualEffect, effectSize = 100): CSSProperties {
  const left = ((index * 47 + 13) % 97) + 1;
  const top = ((index * 61 + 7) % 101) - 1;
  const delay = -((index * 17) % 40) / 10;
  const duration = 3 + (index % 5) * 0.7;
  const size = 2 + (index % 4);
  const variation = ((index * 31) % 101) / 100;
  const randomness = leafRandomness / 100;
  const variedLeafSize = leafSize * (1 + (variation * 2 - 1) * randomness * 0.45);
  const motionX = 2 + (index * 29 % 7);
  const motionY = 1 + (index * 17 % 5);
  const starVariation = ((index * 37) % 17) / 16;
  const starDuration = 1.25 + starVariation * 4.5;
  return {
    left: `${left}%`,
    top: `${top}%`,
    animationDelay: `${delay}s`,
    animationDuration: effect === "stars" ? undefined : `${duration}s`,
    "--page-vfx-particle-duration": `${duration}s`,
    "--page-vfx-star-duration": `${starDuration}s`,
    "--page-vfx-star-size": `${(0.65 + starVariation * 0.7) * effectSize / 100}`,
    "--page-vfx-star-glow-short": `${1 + starVariation * 2}px`,
    "--page-vfx-star-glow-long": `${4 + starVariation * 11}px`,
    width: `${size}px`,
    height: `${size}px`,
    "--page-vfx-flight-x": `${((index * 37) % 16) - 8}cqw`,
    "--page-vfx-flight-y": `${((index * 23) % 12) - 6}cqw`,
    "--page-vfx-wind-x": `${8 + variation * randomness * 48}cqw`,
    "--page-vfx-leaf-size": `${variedLeafSize}px`,
    "--page-vfx-leaf-rotation": `${180 + variation * randomness * 360}deg`,
    "--page-vfx-movement-x": `${motionX}cqw`,
    "--page-vfx-movement-y": `${motionY}cqw`,
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
        const {
          density,
          speed,
          densityMultiplier,
          speedMultiplier,
          leafSize,
          leafRandomness,
          leafColor,
          rainPattern,
          rainLength,
          rainAngle,
          movement,
          brightness,
          size,
        } = effectSettings[effect];
        const rainPatternMultiplier = rainPattern === "heavy" ? 1.75 : 0.65;
        const particleCount = Math.min(200, Math.max(1, Math.round(
          effectParticleCounts[effect] * density / 50 * densityMultiplier
          * (effect === "rain" ? rainPatternMultiplier : 1),
        )));
        const horizontalDrift = Math.round(Math.sin((rainAngle * Math.PI) / 180) * 7000) / 100;
        const tilt = -Math.atan2(horizontalDrift, 110) * 180 / Math.PI;
        const rainDirectionStyle = {
          "--page-vfx-rain-x": `${horizontalDrift}cqw`,
          "--page-vfx-rain-angle": `${tilt}deg`,
        };
        const rainPatternStyle = rainPattern === "heavy"
          ? { "--page-vfx-rain-width": "1.7px", "--page-vfx-rain-opacity": ".9" }
          : { "--page-vfx-rain-width": ".7px", "--page-vfx-rain-opacity": ".5" };
        const effectStyle = {
          "--page-vfx-density": Math.min(1, density / 100 * densityMultiplier),
          "--page-vfx-speed": 100 / (speed * speedMultiplier),
          "--page-vfx-brightness": brightness / 100,
          "--page-vfx-size": size / 100,
          "--page-vfx-leaf-color": leafGradients[leafColor],
          "--page-vfx-rain-height": `${rainLength}%`,
          ...(effect === "rain" ? { ...rainDirectionStyle, ...rainPatternStyle } : {}),
        } as CSSProperties;
        return effect === "fog"
          ? <div className="page-visual-fog" key={effect} style={effectStyle}>{Array.from({ length: particleCount }, (_, index) => <span key={index} style={getParticleStyle(index)} />)}</div>
        : (
          <div
            className={`page-visual-effect page-visual-effect-${effect}`}
            data-movement={effect === "glow" || effect === "burst" ? movement : undefined}
            key={effect}
            style={effectStyle}
          >
            {Array.from({ length: particleCount }, (_, index) => (
              <span key={index} style={getParticleStyle(index, leafSize, leafRandomness, effect, size)}>
                {effect === "sparkles" ? (index % 2 ? "✦" : "✧") : effect === "stars" ? (index % 3 ? "✦" : "✧") : null}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
