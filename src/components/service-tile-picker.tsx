"use client";

import { useState } from "react";
import { ServiceIcon } from "@/components/service-icon";
import type { FormService } from "@/domain/appointment-form";
import { formatMoney } from "@/domain/invoice";
import { guessServiceIcon } from "@/domain/service-icons";

export function serviceIconFor(service: FormService) {
  return service.iconKey ?? guessServiceIcon(service);
}

export function ServiceTilePicker({
  services,
  selectedId,
  onPick,
  compact = false,
  label,
}: {
  services: readonly FormService[];
  selectedId?: string;
  onPick: (service: FormService) => void;
  compact?: boolean;
  label: string;
}) {
  const categories = [...new Set(services.map((service) => service.category))];
  const [category, setCategory] = useState<string | null>(null);
  const shown = (category === null ? categories : [category]).flatMap((name) =>
    services.filter((service) => service.category === name),
  );

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
      on ? "border-brand bg-brand-soft text-brand-ink" : "border-hair bg-paper text-soft hover:text-ink"
    }`;

  return (
    <div className="flex flex-col gap-2.5">
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
            className={chip(category === null)}
          >
            Todos
          </button>
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={category === name}
              onClick={() => setCategory(category === name ? null : name)}
              className={chip(category === name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div
        role="radiogroup"
        aria-label={label}
        className={`grid gap-2 ${compact ? "grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))]"}`}
      >
        {shown.map((service) => {
          const selected = service.id === selectedId;
          return (
            <button
              key={service.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onPick(service)}
              className={`group flex flex-col items-center justify-center gap-1.5 rounded-md border p-2.5 text-center transition-all hover:-translate-y-0.5 hover:shadow-md ${
                selected
                  ? "border-brand bg-brand-soft/60 ring-1 ring-brand"
                  : "border-hair bg-paper hover:border-brand/50"
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  selected
                    ? "bg-brand text-white"
                    : "bg-brand-soft text-brand-ink group-hover:bg-brand group-hover:text-white"
                }`}
              >
                <ServiceIcon icon={serviceIconFor(service)} size={22} />
              </span>
              <span className="line-clamp-2 text-xs font-medium leading-tight">{service.name}</span>
              <span className="text-[11px] tabular-nums text-muted">{formatMoney(service.basePriceCents)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
