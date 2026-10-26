"use client";

import { usePathname } from "next/navigation";
import { useId, useRef } from "react";
import { switchCompanyAction } from "@/app/empresas/actions";
import { Icon } from "@/components/icons";

export type SwitcherCompany = { id: string; name: string; active: boolean };

export function CompanySwitcher({ companies, activeId }: { companies: SwitcherCompany[]; activeId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const id = useId();
  const pathname = usePathname();
  const section = `/${pathname.split("/")[1] ?? ""}`;

  return (
    <form ref={form} action={switchCompanyAction} className="relative">
      <input type="hidden" name="next" value={section === "/" ? "/inicio" : section} />
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-rail-text">
        Empresa
      </label>
      <span className="pointer-events-none absolute bottom-0 left-3 flex h-10 items-center text-rail-text">
        <Icon name="building" size={16} />
      </span>
      <select
        id={id}
        name="companyId"
        defaultValue={activeId}
        onChange={() => form.current?.requestSubmit()}
        className="h-10 w-full appearance-none rounded-md border border-rail-line bg-rail-raised pl-9 pr-9 text-sm font-semibold text-white focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      >
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
            {company.active ? "" : " (desactivada)"}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute bottom-0 right-3 flex h-10 items-center text-rail-text">
        <Icon name="down" size={14} />
      </span>
    </form>
  );
}
