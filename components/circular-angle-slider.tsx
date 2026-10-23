"use client";

import type { KeyboardEvent, PointerEvent } from "react";

export default function CircularAngleSlider({
  id,
  labelId,
  value,
  onChange,
}: {
  id: string;
  labelId: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const radians = (value * Math.PI) / 180;
  const handleX = 50 + Math.sin(radians) * 34;
  const handleY = 50 - Math.cos(radians) * 34;

  function updateFromPointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (bounds.left + bounds.width / 2);
    const dy = event.clientY - (bounds.top + bounds.height / 2);
    onChange(Math.round((Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const increments: Record<string, number> = {
      ArrowUp: 1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowLeft: -1,
      PageUp: 15,
      PageDown: -15,
    };
    if (event.key === "Home") {
      event.preventDefault();
      onChange(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(359);
    } else if (event.key in increments) {
      event.preventDefault();
      onChange((value + increments[event.key] + 360) % 360);
    }
  }

  const valueText = value === 0 || value === 180
    ? `${value} derajat, vertikal`
    : `${value} derajat, angin ke ${value < 180 ? "kanan" : "kiri"}`;

  return (
    <div
      id={id}
      className="page-vfx-angle-dial"
      role="slider"
      tabIndex={0}
      aria-labelledby={labelId}
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={value}
      aria-valuetext={valueText}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event);
      }}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="page-vfx-angle-track" cx="50" cy="50" r="34" />
        <circle className="page-vfx-angle-center" cx="50" cy="50" r="3" />
        <path className="page-vfx-angle-indicator" d={`M50 50 L${handleX} ${handleY}`} />
        <circle className="page-vfx-angle-handle" cx={handleX} cy={handleY} r="5" />
        <text x="50" y="9" textAnchor="middle">0</text>
        <text x="91" y="52" textAnchor="middle">90</text>
        <text x="50" y="98" textAnchor="middle">180</text>
        <text x="9" y="52" textAnchor="middle">270</text>
      </svg>
    </div>
  );
}
