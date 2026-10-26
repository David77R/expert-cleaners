"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons";
import { formatPhone } from "@/domain/customer-rules";

type Found = { id: string; code: string; firstName: string; lastName: string; phone: string };

const TIME = new Intl.DateTimeFormat("es-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("es-US", {
  timeZone: "America/New_York",
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function CityClock({ city }: { city: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="hidden flex-col items-end leading-tight xl:flex" suppressHydrationWarning>
      <span className="font-display text-sm font-semibold tabular-nums" suppressHydrationWarning>
        {TIME.format(now)}
      </span>
      <span className="text-[11px] text-muted first-letter:uppercase" suppressHydrationWarning>
        {city} · {DAY.format(now)}
      </span>
    </span>
  );
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();

  function search(value: string) {
    setQuery(value);
    setActive(-1);
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
    const term = value.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      try {
        const response = await fetch(`/api/customers?${new URLSearchParams({ q: term, limit: "6" })}`, {
          signal: controller.signal,
        });
        const body = response.ok ? ((await response.json()) as { items: Found[] }) : { items: [] };
        if (request.current !== controller) return;
        setResults(body.items);
        setOpen(true);
      } catch {
        if (request.current === controller) setResults([]);
      } finally {
        if (request.current === controller) setLoading(false);
      }
    }, 250);
  }

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(-1, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = results[active];
      if (chosen) go(`/customers/${chosen.id}`);
      else if (query.trim().length >= 2) go(`/customers?q=${encodeURIComponent(query.trim())}`);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && query.trim().length >= 2 && !loading;

  return (
    <div className="relative w-full max-w-md">
      <Icon
        name="search"
        size={16}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        type="search"
        value={query}
        onChange={(event) => search(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="Buscar cliente por nombre, teléfono o código…"
        aria-label="Buscar cliente"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        className="h-10 w-full rounded-full border border-hair bg-canvas/70 pl-10 pr-4 text-sm transition-colors placeholder:text-muted focus:border-brand focus:bg-paper focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
      {loading && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">Buscando…</span>}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-md border border-hair bg-paper py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="flex flex-col gap-1.5 px-4 py-3 text-sm">
              <span className="text-muted">No hay clientes con esa búsqueda.</span>
              <Link
                href={`/customers/new?q=${encodeURIComponent(query.trim())}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => go(`/customers/new?q=${encodeURIComponent(query.trim())}`)}
                className="flex w-fit items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                <Icon name="plus" size={13} />
                Crear cliente con «{query.trim()}»
              </Link>
            </li>
          ) : (
            results.map((customer, index) => (
              <li key={customer.id} role="option" aria-selected={index === active}>
                <Link
                  href={`/customers/${customer.id}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => go(`/customers/${customer.id}`)}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                    index === active ? "bg-brand-soft text-brand-ink" : "hover:bg-canvas"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {customer.firstName} {customer.lastName}
                    </span>
                    <span className="block text-xs tabular-nums text-soft">{formatPhone(customer.phone)}</span>
                  </span>
                  <span className="font-display shrink-0 text-xs tabular-nums text-muted">{customer.code}</span>
                </Link>
              </li>
            ))
          )}
          {results.length > 0 && (
            <li className="border-t border-hair">
              <Link
                href={`/customers?q=${encodeURIComponent(query.trim())}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => go(`/customers?q=${encodeURIComponent(query.trim())}`)}
                className="block px-4 py-2 text-xs font-semibold text-brand-ink hover:bg-canvas"
              >
                Ver todos los resultados
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
