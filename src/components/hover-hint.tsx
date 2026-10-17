"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const [pinned, setPinned] = useState(false);
  const touch = useRef(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pinned) return;
    function close(event: Event) {
      if (event.target instanceof Node && box.current?.contains(event.target)) return;
      setPinned(false);
      setSpot(null);
    }
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, { capture: true });
    };
  }, [pinned]);

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
      ref={box}
      className={`inline-flex ${className}`}
      onPointerDown={(event) => {
        touch.current = event.pointerType !== "mouse";
      }}
      onMouseEnter={(event) => {
        if (!touch.current) show(event.currentTarget);
      }}
      onMouseLeave={() => {
        if (!pinned) setSpot(null);
      }}
      onClick={(event) => {
        if (!touch.current) return;
        event.preventDefault();
        event.stopPropagation();
        if (pinned) {
          setPinned(false);
          setSpot(null);
        } else {
          show(event.currentTarget);
          setPinned(true);
        }
      }}
    >
      {children}
      {spot &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[3000] w-max max-w-64 rounded-md bg-ink px-3 py-2 text-xs font-medium leading-snug text-white shadow-lg"
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
