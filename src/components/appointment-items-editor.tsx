"use client";

import { useState } from "react";
import { INPUT } from "@/components/form-kit";
import { Icon } from "@/components/icons";
import { ServiceIcon } from "@/components/service-icon";
import { serviceIconFor } from "@/components/service-tile-picker";
import {
  DETAIL_KEYS,
  DETAIL_LABELS,
  MAX_ITEMS,
  SIZE_OPTIONS,
  centsToDollars,
  fieldsForService,
  itemDetailKey,
  itemKey,
  itemSpecKey,
  parseDollars,
  type DetailKey,
  type ItemValues,
} from "@/domain/appointment-items";
import type { FormService } from "@/domain/appointment-form";
import { formatMoney } from "@/domain/invoice";

type Row = {
  uid: number;
  serviceId: string;
  price: string;
  specs: Record<string, string>;
  details: Record<string, string>;
};

type Draft = { price: string; specs: Record<string, string>; details: Record<string, string> };

export type EditorItem = { service: FormService | null; priceCents: number };

const EMPTY_DRAFT: Draft = { price: "", specs: {}, details: {} };
const FIELD = `${INPUT} py-2`;
const LABEL = "flex flex-col gap-1 text-xs font-medium text-soft";

function rowCents(row: Row, service: FormService | undefined): number {
  const parsed = parseDollars(row.price);
  if (parsed === null) return service?.basePriceCents ?? 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toEditorItems(rows: readonly Row[], byId: ReadonlyMap<string, FormService>): EditorItem[] {
  return rows.map((row) => {
    const service = byId.get(row.serviceId) ?? null;
    return { service, priceCents: rowCents(row, service ?? undefined) };
  });
}

export function itemsDuration(items: readonly EditorItem[]): number {
  const total = items.reduce((sum, item) => sum + (item.service?.durationMin ?? 0), 0);
  return Math.min(720, Math.max(0, total));
}

function describeRow(row: Row, service: FormService): string {
  const specs = fieldsForService(service)
    .map((field) => row.specs[field.key])
    .filter(Boolean);
  const details = DETAIL_KEYS.map((key) => row.details[key]).filter(Boolean);
  return [...specs, ...details].join(" · ");
}

function ItemFields({
  service,
  values,
  errors,
  idBase,
  onPrice,
  onSpec,
  onDetail,
}: {
  service: FormService;
  values: Draft;
  errors: Record<string, string>;
  idBase: string;
  onPrice: (value: string) => void;
  onSpec: (key: string, value: string) => void;
  onDetail: (key: DetailKey, value: string) => void;
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <label className={LABEL}>
        Precio (USD)
        <input
          inputMode="decimal"
          value={values.price}
          onChange={(event) => onPrice(event.target.value)}
          placeholder={centsToDollars(service.basePriceCents)}
          aria-invalid={Boolean(errors.price)}
          className={`${FIELD} tabular-nums`}
        />
        {errors.price && <span className="text-attention">{errors.price}</span>}
      </label>
      {fieldsForService(service).map((field) => (
        <label key={field.key} className={LABEL}>
          <span>
            {field.label}
            {!field.required && <span className="ml-1 font-normal text-muted">(opcional)</span>}
          </span>
          {field.type === "select" ? (
            <select
              value={values.specs[field.key] ?? ""}
              onChange={(event) => onSpec(field.key, event.target.value)}
              aria-invalid={Boolean(errors[`spec.${field.key}`])}
              className={FIELD}
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
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={values.specs[field.key] ?? ""}
              onChange={(event) => onSpec(field.key, event.target.value)}
              aria-invalid={Boolean(errors[`spec.${field.key}`])}
              className={FIELD}
            />
          )}
          {errors[`spec.${field.key}`] && <span className="text-attention">{errors[`spec.${field.key}`]}</span>}
        </label>
      ))}
      {(["color", "size", "dimensions"] as const).map((detail) => (
        <label key={detail} className={LABEL}>
          {DETAIL_LABELS[detail]}
          <input
            value={values.details[detail] ?? ""}
            onChange={(event) => onDetail(detail, event.target.value)}
            list={detail === "size" ? `${idBase}-sizes` : undefined}
            maxLength={detail === "dimensions" ? 80 : 40}
            placeholder={detail === "dimensions" ? '84" x 36"' : detail === "size" ? "Mediano" : "Gris"}
            className={FIELD}
          />
        </label>
      ))}
      <datalist id={`${idBase}-sizes`}>
        {SIZE_OPTIONS.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <label className={`${LABEL} sm:col-span-2`}>
        Notas del artículo
        <input
          value={values.details.notes ?? ""}
          onChange={(event) => onDetail("notes", event.target.value)}
          maxLength={500}
          placeholder="Manchas, material, daños previos…"
          className={FIELD}
        />
      </label>
    </div>
  );
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
  const byId = new Map(services.map((service) => [service.id, service]));
  const categories = [...new Set(services.map((service) => service.category))];
  const [rows, setRows] = useState<Row[]>(() =>
    initialItems
      .filter((item) => item.serviceId)
      .map((item, uid) => ({
        uid,
        serviceId: item.serviceId,
        price: item.price,
        specs: { ...item.specs },
        details: { ...(item.details ?? {}) },
      })),
  );
  const [category, setCategory] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [openRows, setOpenRows] = useState<number[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [applied, setApplied] = useState<string | null>(null);

  const total = rows.reduce((sum, row) => sum + rowCents(row, byId.get(row.serviceId)), 0);
  const groups = [...new Set(rows.map((row) => row.serviceId))].map((serviceId) => ({
    serviceId,
    service: byId.get(serviceId),
    units: rows.flatMap((row, index) => (row.serviceId === serviceId ? [{ row, index }] : [])),
  }));
  const shown = (category === null ? categories : [category]).flatMap((name) =>
    services.filter((service) => service.category === name),
  );
  const generalError = rows.length === 0 ? errors[itemKey(0, "serviceId")] : undefined;

  function update(next: Row[]) {
    setRows(next);
    onChange?.(toEditorItems(next, byId));
  }

  function unitErrors(index: number): Record<string, string> {
    const prefix = `items.${index}.`;
    return Object.fromEntries(
      Object.entries(errors)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => [key.slice(prefix.length), value]),
    );
  }

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  function add(service: FormService) {
    if (rows.length >= MAX_ITEMS) return;
    const uid = rows.reduce((max, row) => Math.max(max, row.uid), -1) + 1;
    const row: Row = {
      uid,
      serviceId: service.id,
      price: centsToDollars(service.basePriceCents),
      specs: {},
      details: {},
    };
    const last = rows.map((item) => item.serviceId).lastIndexOf(service.id);
    update(last < 0 ? [...rows, row] : [...rows.slice(0, last + 1), row, ...rows.slice(last + 1)]);
  }

  function removeLast(serviceId: string) {
    const last = rows.map((item) => item.serviceId).lastIndexOf(serviceId);
    if (last >= 0) update(rows.filter((_, index) => index !== last));
  }

  function removeRow(uid: number) {
    update(rows.filter((row) => row.uid !== uid));
  }

  function removeGroup(serviceId: string) {
    update(rows.filter((row) => row.serviceId !== serviceId));
  }

  function patchRow(uid: number, patch: (row: Row) => Row) {
    update(rows.map((row) => (row.uid === uid ? patch(row) : row)));
  }

  function draftOf(serviceId: string): Draft {
    return drafts[serviceId] ?? EMPTY_DRAFT;
  }

  function patchDraft(serviceId: string, patch: (draft: Draft) => Draft) {
    setDrafts((current) => ({ ...current, [serviceId]: patch(current[serviceId] ?? EMPTY_DRAFT) }));
    setApplied(null);
  }

  function applyToAll(serviceId: string) {
    const draft = draftOf(serviceId);
    const specs = Object.fromEntries(Object.entries(draft.specs).filter(([, value]) => value.trim() !== ""));
    const details = Object.fromEntries(Object.entries(draft.details).filter(([, value]) => value.trim() !== ""));
    update(
      rows.map((row) =>
        row.serviceId === serviceId
          ? {
              ...row,
              price: draft.price.trim() !== "" ? draft.price : row.price,
              specs: { ...row.specs, ...specs },
              details: { ...row.details, ...details },
            }
          : row,
      ),
    );
    setApplied(serviceId);
  }

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.serviceId, (counts.get(row.serviceId) ?? 0) + 1);

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
      on ? "border-brand bg-brand-soft text-brand-ink" : "border-hair bg-paper text-soft hover:text-ink"
    }`;

  return (
    <div className="flex flex-col gap-4 sm:col-span-2">
      {rows.map((row, index) => (
        <div key={row.uid} hidden>
          <input type="hidden" name={itemKey(index, "serviceId")} value={row.serviceId} />
          <input type="hidden" name={itemKey(index, "price")} value={row.price} />
          {Object.entries(row.specs).map(([key, value]) => (
            <input key={key} type="hidden" name={itemSpecKey(index, key)} value={value} />
          ))}
          {DETAIL_KEYS.map((key) => (
            <input key={key} type="hidden" name={itemDetailKey(index, key)} value={row.details[key] ?? ""} />
          ))}
        </div>
      ))}

      <div className="flex flex-col gap-2.5">
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategory(null)}
              aria-pressed={category === null}
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
          className={`grid gap-2 ${
            compact
              ? "grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))]"
              : "grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))]"
          }`}
        >
          {shown.map((service) => {
            const count = counts.get(service.id) ?? 0;
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => add(service)}
                aria-label={`Agregar ${service.name}${count > 0 ? ` (llevas ${count})` : ""}`}
                className={`group relative flex flex-col items-center justify-center gap-1.5 rounded-md border p-2.5 text-center transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${
                  count > 0 ? "border-brand bg-brand-soft/50" : "border-hair bg-paper hover:border-brand/50"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                    count > 0
                      ? "bg-brand text-white"
                      : "bg-brand-soft text-brand-ink group-hover:bg-brand group-hover:text-white"
                  }`}
                >
                  <ServiceIcon icon={serviceIconFor(service)} size={22} />
                </span>
                <span className="line-clamp-2 text-xs font-medium leading-tight">{service.name}</span>
                <span className="text-[11px] tabular-nums text-muted">{formatMoney(service.basePriceCents)}</span>
                {count > 0 && (
                  <span className="font-display absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <p
          className={`rounded-md border border-dashed px-3 py-5 text-center text-sm ${
            generalError ? "border-attention text-attention" : "border-hair text-muted"
          }`}
        >
          {generalError ?? "Toca un servicio para agregarlo. Cada toque suma uno más."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map(({ serviceId, service, units }) => {
            if (!service) return null;
            const subtotal = units.reduce((sum, { row }) => sum + rowCents(row, service), 0);
            const hasErrors = units.some(({ index }) => Object.keys(unitErrors(index)).length > 0);
            const required = fieldsForService(service).filter((field) => field.required);
            const missing = units.some(({ row }) => required.some((field) => !(row.specs[field.key] ?? "").trim()));
            const open = openGroups.includes(serviceId) || hasErrors || missing;
            const draft = draftOf(serviceId);
            return (
              <li
                key={serviceId}
                className={`rounded-md border bg-paper ${hasErrors ? "border-attention" : "border-hair"}`}
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                    <ServiceIcon icon={serviceIconFor(service)} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {service.name}
                      <span className="font-display ml-1.5 text-brand-ink">x{units.length}</span>
                    </span>
                    <span className="block text-xs tabular-nums text-soft">
                      {formatMoney(subtotal)}
                      {hasErrors ? (
                        <span className="ml-2 font-semibold text-attention">Faltan datos</span>
                      ) : (
                        missing && <span className="ml-2 font-semibold text-warning">Completa los datos</span>
                      )}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center rounded-md border border-hair">
                    <button
                      type="button"
                      onClick={() => removeLast(serviceId)}
                      aria-label={`Quitar un ${service.name}`}
                      className="flex h-8 w-8 items-center justify-center text-soft hover:bg-canvas"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm font-semibold tabular-nums">{units.length}</span>
                    <button
                      type="button"
                      onClick={() => add(service)}
                      aria-label={`Agregar otro ${service.name}`}
                      className="flex h-8 w-8 items-center justify-center text-soft hover:bg-canvas"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenGroups((current) => toggle(current, serviceId))}
                    aria-expanded={open}
                    aria-label={`Editar ${service.name}`}
                    title="Editar precios y medidas"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      open ? "bg-brand text-white" : "text-brand-ink hover:bg-brand-soft"
                    }`}
                  >
                    <Icon name="pencil" size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGroup(serviceId)}
                    aria-label={`Quitar todos los ${service.name}`}
                    title="Quitar todos"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-attention-soft hover:text-attention"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>

                {open && (
                  <div className="flex flex-col gap-3 border-t border-hair px-3 py-3">
                    {units.length > 1 && (
                      <div className="flex flex-col gap-2.5 rounded-md border border-brand/30 bg-brand-soft/30 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink">
                          Aplicar a los {units.length}
                        </p>
                        <ItemFields
                          service={service}
                          values={draft}
                          errors={{}}
                          idBase={`${idPrefix}-${serviceId}-all`}
                          onPrice={(value) => patchDraft(serviceId, (d) => ({ ...d, price: value }))}
                          onSpec={(key, value) =>
                            patchDraft(serviceId, (d) => ({ ...d, specs: { ...d.specs, [key]: value } }))
                          }
                          onDetail={(key, value) =>
                            patchDraft(serviceId, (d) => ({ ...d, details: { ...d.details, [key]: value } }))
                          }
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-soft">
                            {applied === serviceId ? "Listo: aplicado a todos." : "Solo se copia lo que llenes aquí."}
                          </span>
                          <button
                            type="button"
                            onClick={() => applyToAll(serviceId)}
                            className="rounded-md bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
                          >
                            Aplicar a todos
                          </button>
                        </div>
                      </div>
                    )}
                    <ul className="flex flex-col gap-1.5">
                      {units.map(({ row, index }, position) => {
                        const rowErrors = unitErrors(index);
                        const rowOpen =
                          units.length === 1 || openRows.includes(row.uid) || Object.keys(rowErrors).length > 0;
                        const summary = describeRow(row, service);
                        return (
                          <li key={row.uid} className="rounded-md border border-hair bg-canvas/40">
                            <div className="flex items-center gap-2 px-2.5 py-1.5">
                              <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-muted">
                                #{position + 1}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-xs text-soft">
                                {summary || "Sin detalles"}
                              </span>
                              <span className="shrink-0 text-sm font-medium tabular-nums">
                                {formatMoney(rowCents(row, service))}
                              </span>
                              {units.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setOpenRows((current) => toggle(current, row.uid))}
                                  aria-expanded={rowOpen}
                                  aria-label={`Editar ${service.name} #${position + 1}`}
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-brand-ink hover:bg-brand-soft"
                                >
                                  <Icon name="pencil" size={13} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => removeRow(row.uid)}
                                aria-label={`Quitar ${service.name} #${position + 1}`}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-attention-soft hover:text-attention"
                              >
                                <Icon name="close" size={12} />
                              </button>
                            </div>
                            {rowOpen && (
                              <div className="border-t border-hair px-2.5 py-2.5">
                                <ItemFields
                                  service={service}
                                  values={row}
                                  errors={rowErrors}
                                  idBase={`${idPrefix}-${row.uid}`}
                                  onPrice={(value) => patchRow(row.uid, (r) => ({ ...r, price: value }))}
                                  onSpec={(key, value) =>
                                    patchRow(row.uid, (r) => ({ ...r, specs: { ...r.specs, [key]: value } }))
                                  }
                                  onDetail={(key, value) =>
                                    patchRow(row.uid, (r) => ({ ...r, details: { ...r.details, [key]: value } }))
                                  }
                                />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-3">
        <span className="text-xs text-muted">
          {rows.length} {rows.length === 1 ? "artículo" : "artículos"}
          {rows.length >= MAX_ITEMS && ` · máximo ${MAX_ITEMS} por cita`}
        </span>
        <p className="text-sm text-soft">
          Total
          <span className="font-display ml-2 text-lg font-semibold tabular-nums text-ink">{formatMoney(total)}</span>
        </p>
      </div>
    </div>
  );
}
