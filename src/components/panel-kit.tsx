import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

export const FIELD =
  "w-full rounded-md border border-hair bg-paper px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-hair px-5 py-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="shrink-0 text-soft">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}

export function Expandable({ title, tone, children }: { title: string; tone?: "danger"; children: ReactNode }) {
  return (
    <details className="group rounded-md border border-hair bg-paper open:shadow-sm">
      <summary
        className={`flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-sm font-semibold ${
          tone === "danger" ? "text-attention" : "text-ink"
        }`}
      >
        {title}
        <Icon name="right" className="transition-transform group-open:rotate-90" />
      </summary>
      <div className="border-t border-hair px-3.5 py-3">{children}</div>
    </details>
  );
}
