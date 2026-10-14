"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Spot = { top: number; left: number; below: boolean };

export function HoverHint({
  hint,
  children,
  className = "",
}: {
  hint: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [spot, setSpot] = useState<Spot | null>(null);

  function show(target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const below = rect.top < 120;
    setSpot({
      top: below ? rect.bottom + 8 : rect.top - 8,
      left: Math.min(Math.max(rect.left + rect.width / 2, 140), window.innerWidth - 140),
      below,
    });
  }

  return (
    <span
      className={`inline-flex ${className}`}
      onMouseEnter={(event) => show(event.currentTarget)}
      onMouseLeave={() => setSpot(null)}
    >
      {children}
      {spot &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[3000] w-max max-w-64 -translate-x-1/2 rounded-md bg-ink px-3 py-2 text-xs font-medium leading-snug text-white shadow-lg"
            style={{
              top: spot.top,
              left: spot.left,
              transform: `translate(-50%, ${spot.below ? "0" : "-100%"})`,
            }}
          >
            {hint}
          </span>,
          document.body,
        )}
    </span>
  );
}
