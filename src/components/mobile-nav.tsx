"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { GlobalSearch } from "@/components/top-bar-tools";

export type MobileLink = { key: string; href: string; label: string; icon: IconName };

const TABS = ["home", "calendar", "orders", "customers"] as const;

export function MobileNav({
  links,
  active,
  title,
  userName,
  userInitials,
  roleLabel,
  bell,
  logout,
}: {
  links: MobileLink[];
  active: string;
  title: string;
  userName: string;
  userInitials: string;
  roleLabel: string;
  bell: ReactNode;
  logout: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const [searchFirst, setSearchFirst] = useState(false);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
      if (searchFirst) node.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    }
    if (!open && node.open) node.close();
  }, [open, searchFirst]);

  function show(withSearch: boolean) {
    setSearchFirst(withSearch);
    setOpen(true);
  }

  const byKey = new Map(links.map((link) => [link.key, link]));
  const tabs = TABS.map((key) => byKey.get(key)).filter((link): link is MobileLink => Boolean(link));
  const moreActive = !TABS.some((key) => key === active);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-rail px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
        <Link
          href="/inicio"
          aria-label="Expert Cleaners: inicio"
          className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand text-sm font-bold text-white"
        >
          EC
        </Link>
        <span className="font-display min-w-0 flex-1 truncate text-base font-semibold text-white">{title}</span>
        <button
          type="button"
          onClick={() => show(true)}
          aria-label="Buscar cliente"
          className="flex h-10 w-10 items-center justify-center rounded-full text-rail-text hover:bg-white/[0.06] hover:text-white"
        >
          <Icon name="search" size={20} />
        </button>
        {bell}
        <button
          type="button"
          onClick={() => show(false)}
          aria-label="Abrir menú"
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-full text-rail-text hover:bg-white/[0.06] hover:text-white"
        >
          <Icon name="menu" size={22} />
        </button>
      </header>

      <nav
        aria-label="Accesos rápidos"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-hair bg-paper/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(18_24_31/0.06)] backdrop-blur lg:hidden print:hidden"
      >
        {tabs.map((link) => {
          const current = link.key === active;
          if (link.key === "orders") {
            return (
              <Link
                key={link.key}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold text-brand-ink"
              >
                <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg ring-4 ring-paper">
                  <Icon name="plus" size={22} />
                </span>
                Pedido
              </Link>
            );
          }
          return (
            <Link
              key={link.key}
              href={link.href}
              aria-current={current ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium ${
                current ? "text-brand-ink" : "text-soft"
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full ${current ? "bg-brand-soft" : ""}`}
              >
                <Icon name={link.icon} size={19} />
              </span>
              {link.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => show(false)}
          className={`flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium ${
            moreActive ? "text-brand-ink" : "text-soft"
          }`}
        >
          <span
            className={`flex h-7 w-12 items-center justify-center rounded-full ${moreActive ? "bg-brand-soft" : ""}`}
          >
            <Icon name="menu" size={19} />
          </span>
          Más
        </button>
      </nav>

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
        aria-label="Menú"
        className="m-0 ml-auto h-dvh max-h-none w-[min(22rem,88vw)] max-w-none bg-rail p-0 text-white backdrop:bg-rail/60 backdrop:backdrop-blur-sm lg:hidden"
      >
        {open && (
          <div className="flex h-full flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
            <div className="flex items-center gap-3 px-4 py-4">
              <span className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold">
                {userInitials}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-semibold">{userName}</span>
                <span className="block text-xs text-rail-text">{roleLabel}</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="flex h-10 w-10 items-center justify-center rounded-full text-rail-text hover:bg-white/[0.06] hover:text-white"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="px-4 pb-3 text-ink [&_input]:border-transparent [&_input]:bg-paper">
              <GlobalSearch />
            </div>
            <nav aria-label="Principal" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
              {links.map((link) => {
                const current = link.key === active;
                return (
                  <Link
                    key={link.key}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={current ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors ${
                      current
                        ? "bg-brand/20 text-white ring-1 ring-inset ring-brand/40"
                        : "text-rail-text hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <Icon name={link.icon} size={19} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <form action={logout} className="border-t border-rail-line px-3 py-3">
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] text-rail-text transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Icon name="logout" size={19} />
                Cerrar sesión
              </button>
            </form>
          </div>
        )}
      </dialog>
    </>
  );
}
