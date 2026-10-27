"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

export function useNavProgress() {
  const pathname = usePathname();
  const [leaving, setLeaving] = useState<string | null>(null);
  return { navigating: leaving === pathname, start: () => setLeaving(pathname) };
}

export function NavProgressBar({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px]">
      <div className="nav-progress h-full bg-brand shadow-[0_0_10px_var(--brand)]" />
    </div>
  );
}
