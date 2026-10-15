"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CustomerAvatar } from "@/components/customer-avatar";
import { INPUT } from "@/components/form-kit";
import { Icon } from "@/components/icons";
import type { PickerCustomer } from "@/domain/appointment-form";
import { formatPhone } from "@/domain/customer-rules";

type Status = "idle" | "loading" | "done" | "error";

function toPicker(item: PickerCustomer): PickerCustomer {
  return {
    id: item.id,
    code: item.code,
    firstName: item.firstName,
    lastName: item.lastName,
    phone: item.phone,
    addresses: item.addresses.map((a) => ({
      id: a.id,
      line1: a.line1,
      unit: a.unit,
      city: a.city,
      state: a.state,
      zip: a.zip,
    })),
  };
}

export function CustomerPicker({
  selected,
  onSelect,
  onClear,
  error,
  onCreateNew,
}: {
  selected: PickerCustomer | null;
  onSelect: (customer: PickerCustomer) => void;
  onClear: () => void;
  error?: string;
  onCreateNew?: (term: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerCustomer[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const term = query.trim();
  const searching = term.length >= 2;

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await fetch(`/api/customers?${new URLSearchParams({ q: term, limit: "8" })}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("search_failed");
        const body = (await response.json()) as { items: PickerCustomer[] };
        setResults(body.items.map(toPicker));
        setStatus("done");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  if (selected) {
    const fullName = `${selected.firstName} ${selected.lastName}`;
    return (
      <div className="flex items-center gap-3 rounded-md border border-hair bg-canvas px-3.5 py-3">
        <CustomerAvatar name={fullName} seed={selected.code} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate font-medium">{fullName}</span>
          <span className="block text-sm tabular-nums text-soft">
            {selected.code} · {formatPhone(selected.phone)}
          </span>
        </span>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-3 py-1.5 text-sm font-semibold text-brand-ink hover:bg-brand-soft"
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
          <Icon name="search" size={16} />
        </span>
        <input
          id="appointment-customerId"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre, teléfono o código"
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "appointment-customerId-error" : undefined}
          className={`${INPUT} pl-10`}
        />
      </div>

      {!searching && <p className="text-sm text-soft">Escribe al menos 2 letras o dígitos.</p>}
      {searching && status === "loading" && <p className="text-sm text-soft">Buscando…</p>}
      {searching && status === "error" && (
        <p role="alert" className="text-sm text-attention">
          No se pudo buscar. Inténtalo de nuevo.
        </p>
      )}
      {searching && status === "done" && results.length === 0 && (
        <p className="text-sm text-soft">
          Sin resultados para «{term}».{" "}
          {onCreateNew ? (
            <button
              type="button"
              onClick={() => onCreateNew(term)}
              className="font-medium text-brand-ink underline underline-offset-2"
            >
              Crear cliente nuevo
            </button>
          ) : (
            <Link
              href={`/customers/new?q=${encodeURIComponent(term)}`}
              className="font-medium text-brand-ink underline underline-offset-2"
            >
              Crear cliente nuevo
            </Link>
          )}
        </p>
      )}
      {searching && status === "done" && results.length > 0 && (
        <ul className="overflow-hidden rounded-md border border-hair">
          {results.map((customer) => {
            const fullName = `${customer.firstName} ${customer.lastName}`;
            return (
              <li key={customer.id} className="border-b border-hair last:border-b-0">
                <button
                  type="button"
                  onClick={() => onSelect(customer)}
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-brand-soft/40"
                >
                  <CustomerAvatar name={fullName} seed={customer.code} />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-sm font-medium">{fullName}</span>
                    <span className="block text-xs tabular-nums text-soft">
                      {customer.code} · {formatPhone(customer.phone)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p id="appointment-customerId-error" role="alert" className="text-sm text-attention">
          {error}
        </p>
      )}
    </div>
  );
}
