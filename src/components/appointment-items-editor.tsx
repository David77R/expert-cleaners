"use client";

import { useRef, useState } from "react";
import { INPUT } from "@/components/form-kit";
import { Icon } from "@/components/icons";
import {
  MAX_ITEMS,
  centsToDollars,
  fieldsForService,
  itemKey,
  itemSpecKey,
  parseDollars,
  type ItemValues,
} from "@/domain/appointment-items";
import type { FormService } from "@/domain/appointment-form";
import { formatMoney } from "@/domain/invoice";

type Row = ItemValues & { uid: number };

export type EditorItem = { service: FormService | null; priceCents: number };

const EMPTY_ITEM: ItemValues = { serviceId: "", price: "", specs: {} };

function toEditorItems(rows: readonly Row[], services: readonly FormService[]): EditorItem[] {
  return rows.map((row) => {
    const service = services.find((option) => option.id === row.serviceId) ?? null;
    const parsed = parseDollars(row.price);
    const priceCents = parsed === null || Number.isNaN(parsed) ? (service?.basePriceCents ?? 0) : parsed;
    return { service, priceCents };
  });
}

export function itemsDuration(items: readonly EditorItem[]): number {
  const total = items.reduce((sum, item) => sum + (item.service?.durationMin ?? 0), 0);
  return Math.min(720, Math.max(15, total));
}

export function AppointmentItemsEditor({
  services,
  initialItems,
  errors = {},
  idPrefix,
  compact = false,
  onChange,
}: {
  services: FormService[];
  initialItems: ItemValues[];
  errors?: Record<string, string>;
  idPrefix: string;
  compact?: boolean;
  onChange?: (items: EditorItem[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    (initialItems.length > 0 ? initialItems : [EMPTY_ITEM]).map((item, uid) => ({ ...item, uid })),
  );
  const nextUid = useRef(Math.max(initialItems.length, 1));
  const categories = [...new Set(services.map((option) => option.category))];
  const total = toEditorItems(rows, services).reduce((sum, item) => sum + item.priceCents, 0);

  function update(next: Row[]) {
    setRows(next);
    onChange?.(toEditorItems(next, services));
  }

  function chooseService(index: number, serviceId: string) {
    const service = services.find((option) => option.id === serviceId);
    update(
      rows.map((row, i) =>
        i === index
          ? { ...row, serviceId, specs: {}, price: service ? centsToDollars(service.basePriceCents) : "" }
          : row,
      ),
    );
  }

  function setPrice(index: number, price: string) {
    update(rows.map((row, i) => (i === index ? { ...row, price } : row)));
  }

  function setSpec(index: number, key: string, value: string) {
    update(rows.map((row, i) => (i === index ? { ...row, specs: { ...row.specs, [key]: value } } : row)));
  }

  function addRow() {
    const uid = nextUid.current;
    nextUid.current += 1;
    update([...rows, { ...EMPTY_ITEM, uid }]);
  }

  function removeRow(index: number) {
    update(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      {rows.map((row, index) => {
        const service = services.find((option) => option.id === row.serviceId) ?? null;
        const serviceKey = itemKey(index, "serviceId");
        const priceKey = itemKey(index, "price");
        const base = `${idPrefix}-item-${row.uid}`;
        return (
          <div
            key={row.uid}
            role="group"
            aria-label={`Servicio ${index + 1}`}
            className="flex flex-col gap-3 rounded-md border border-hair bg-canvas/40 p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-soft">Servicio {index + 1}</span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-attention hover:bg-attention-soft"
                >
                  <Icon name="close" size={12} />
                  Quitar
                </button>
              )}
            </div>
            <div className={compact ? "grid gap-3" : "grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]"}>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${base}-service`} className="text-sm font-medium">
                  Tipo de servicio
                </label>
                <select
                  id={`${base}-service`}
                  name={serviceKey}
                  value={row.serviceId}
                  onChange={(event) => chooseService(index, event.target.value)}
                  aria-invalid={Boolean(errors[serviceKey])}
                  className={INPUT}
                >
                  <option value="">Elige un servicio</option>
                  {categories.map((category) => (
                    <optgroup key={category} label={category}>
                      {services
                        .filter((option) => option.category === category)
                        .map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                {errors[serviceKey] && (
                  <p role="alert" className="text-sm text-attention">
                    {errors[serviceKey]}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${base}-price`} className="text-sm font-medium">
                  Precio (USD)
                </label>
                <input
                  id={`${base}-price`}
                  name={priceKey}
                  inputMode="decimal"
                  value={row.price}
                  onChange={(event) => setPrice(index, event.target.value)}
                  placeholder={service ? centsToDollars(service.basePriceCents) : "0.00"}
                  aria-invalid={Boolean(errors[priceKey])}
                  className={`${INPUT} tabular-nums`}
                />
                {errors[priceKey] && (
                  <p role="alert" className="text-sm text-attention">
                    {errors[priceKey]}
                  </p>
                )}
              </div>
            </div>
            {service && (
              <div className={compact ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
                {fieldsForService(service).map((field) => {
                  const key = itemSpecKey(index, field.key);
                  const id = `${base}-spec-${field.key}`;
                  const value = row.specs[field.key] ?? "";
                  return (
                    <div key={field.key} className="flex flex-col gap-1.5">
                      <label htmlFor={id} className="text-sm font-medium">
                        {field.label}
                        {!field.required && <span className="ml-1.5 font-normal text-muted">(opcional)</span>}
                      </label>
                      {field.type === "select" ? (
                        <select
                          id={id}
                          name={key}
                          value={value}
                          onChange={(event) => setSpec(index, field.key, event.target.value)}
                          aria-invalid={Boolean(errors[key])}
                          className={INPUT}
                        >
                          <option value="">Elige una opción</option>
                          {(field.options ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={id}
                          name={key}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={value}
                          onChange={(event) => setSpec(index, field.key, event.target.value)}
                          aria-invalid={Boolean(errors[key])}
                          className={INPUT}
                        />
                      )}
                      {errors[key] && (
                        <p role="alert" className="text-sm text-attention">
                          {errors[key]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {rows.length < MAX_ITEMS ? (
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 rounded-md border border-dashed border-hair px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft/40"
          >
            <Icon name="plus" size={14} />
            Agregar otro servicio
          </button>
        ) : (
          <span className="text-xs text-muted">Máximo {MAX_ITEMS} servicios por cita</span>
        )}
        <p className="text-sm text-soft">
          Total
          <span className="font-display ml-2 text-lg font-semibold tabular-nums text-ink">{formatMoney(total)}</span>
        </p>
      </div>
    </div>
  );
}
