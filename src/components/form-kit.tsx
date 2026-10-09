import type { ReactNode } from "react";

export const INPUT =
  "w-full rounded-md border border-hair bg-paper px-3.5 py-2.5 text-sm placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-attention";

export function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-hair bg-paper p-5 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-soft">{hint}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export type FieldControlProps = {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
};

export function Field({
  prefix = "field",
  name,
  label,
  error,
  wide = false,
  optional = false,
  children,
}: {
  prefix?: string;
  name: string;
  label: string;
  error?: string;
  wide?: boolean;
  optional?: boolean;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const id = `${prefix}-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted">(opcional)</span>}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": error ? errorId : undefined })}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-attention">
          {error}
        </p>
      )}
    </div>
  );
}
