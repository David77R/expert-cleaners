"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/icons";

export function LegendDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (details.current && window.matchMedia("(min-width: 1024px)").matches) details.current.open = true;
  }, []);

  return (
    <details ref={details} className="group flex flex-col gap-4">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-md text-sm font-semibold lg:hidden">
        {title}
        <Icon name="down" size={16} className="text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4 flex flex-col gap-4 lg:mt-0">{children}</div>
    </details>
  );
}
