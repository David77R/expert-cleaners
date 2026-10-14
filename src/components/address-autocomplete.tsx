"use client";

import { useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import type { FieldControlProps } from "@/components/form-kit";
import type { AddressSuggestion } from "@/server/geocoding";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 350;
const CLIENT_TIMEOUT_MS = 9000;

function fillField(form: HTMLFormElement | null, name: string, value: string) {
  const field = form?.elements.namedItem(name);
  if (field instanceof HTMLInputElement && value) field.value = value;
}

export function AddressAutocomplete({
  control,
  name,
  prefix = "",
  defaultValue,
  required,
  placeholder,
  className,
}: {
  control: FieldControlProps;
  name: string;
  prefix?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, AddressSuggestion[]>());
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function show(list: AddressSuggestion[]) {
    setSuggestions(list);
    setOpen(true);
    setActive(-1);
  }

  function search(query: string) {
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
    request.current = null;
    const key = query.trim().replace(/\s+/g, " ").toLowerCase();
    if (key.length < MIN_CHARS) {
      setSuggestions([]);
      setLoading(false);
      close();
      return;
    }
    const cached = cache.current.get(key);
    if (cached) {
      setLoading(false);
      show(cached);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
      try {
        const res = await fetch(`/api/geocode/autocomplete?q=${encodeURIComponent(key)}`, {
          signal: controller.signal,
        });
        const data: { suggestions?: AddressSuggestion[] } = res.ok ? await res.json() : {};
        if (request.current !== controller) return;
        const list = data.suggestions ?? [];
        if (list.length > 0) cache.current.set(key, list);
        show(list);
      } catch {
        if (request.current === controller) show([]);
      } finally {
        clearTimeout(timeout);
        if (request.current === controller) {
          request.current = null;
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);
  }

  function choose(suggestion: AddressSuggestion) {
    const input = inputRef.current;
    if (input) input.value = suggestion.line1;
    fillField(input?.form ?? null, `${prefix}city`, suggestion.city);
    fillField(input?.form ?? null, `${prefix}state`, suggestion.state);
    fillField(input?.form ?? null, `${prefix}zip`, suggestion.zip);
    setCoords(suggestion.approximate ? null : { lat: suggestion.lat, lng: suggestion.lng });
    setSuggestions([]);
    close();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]);
    } else if (event.key === "Escape") {
      close();
    }
  }

  const showList = open && (suggestions.length > 0 || !loading);

  return (
    <div className="relative">
      <input
        {...control}
        ref={inputRef}
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setCoords(null);
          search(event.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={close}
        className={className}
      />
      <input type="hidden" name={`${prefix}lat`} value={coords ? String(coords.lat) : ""} />
      <input type="hidden" name={`${prefix}lng`} value={coords ? String(coords.lng) : ""} />
      {loading && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">
          Buscando…
        </span>
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-hair bg-paper py-1 shadow-lg"
        >
          {suggestions.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-muted">
              Sin sugerencias. Puedes escribir la dirección completa a mano.
            </li>
          ) : (
            suggestions.map((suggestion, index) => (
              <li
                key={`${suggestion.label}-${index}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(suggestion)}
                className={`cursor-pointer px-3.5 py-2.5 text-sm ${index === active ? "bg-brand-soft text-brand-ink" : "hover:bg-canvas"}`}
              >
                <span className="block font-medium">{suggestion.line1}</span>
                <span className="block text-xs text-soft">
                  {[suggestion.city, suggestion.state, suggestion.zip].filter(Boolean).join(", ")}
                </span>
                {suggestion.verified ? (
                  <span className="block text-[11px] font-semibold text-success">Dirección verificada</span>
                ) : (
                  suggestion.approximate && (
                    <span className="block text-[11px] text-muted">Calle encontrada con tu número</span>
                  )
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
