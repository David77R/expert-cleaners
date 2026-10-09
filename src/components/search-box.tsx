"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/icons";

export function SearchBox({ initial, placeholder }: { initial: string; placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (value.trim() === initial) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      const query = params.toString();
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
    }, 250);
    return () => clearTimeout(timer);
  }, [value, initial, pathname, router]);

  return (
    <div className="relative w-full max-w-xl">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
        <Icon name="search" size={18} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label="Buscar clientes"
        autoComplete="off"
        className="w-full rounded-md border border-hair bg-paper py-3 pl-11 pr-10 text-sm shadow-[0_1px_2px_rgba(21,26,33,0.04)] placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
      {pending && (
        <span
          role="status"
          aria-label="Buscando"
          className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-hair border-t-brand"
        />
      )}
    </div>
  );
}
