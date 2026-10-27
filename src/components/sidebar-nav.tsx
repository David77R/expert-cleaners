"use client";

import Link, { useLinkStatus } from "next/link";
import type { MouseEvent } from "react";
import { Icon, type IconName } from "@/components/icons";
import { NavProgressBar, useNavProgress } from "@/components/nav-progress";

export type SidebarLink = { key: string; href: string; label: string; icon: IconName };

function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`ml-auto h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white transition-opacity ${
        pending ? "animate-spin opacity-100" : "opacity-0"
      }`}
    />
  );
}

export function SidebarNav({ links, active }: { links: SidebarLink[]; active: string }) {
  const { navigating, start } = useNavProgress();

  function onClick(event: MouseEvent<HTMLAnchorElement>, link: SidebarLink) {
    const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (plain && link.key !== active) start();
  }

  return (
    <>
      <NavProgressBar show={navigating} />
      <nav
        aria-label="Principal"
        className="mt-5 flex flex-col gap-1 px-3 [@media(max-height:760px)]:mt-3 [@media(max-height:760px)]:gap-0.5"
      >
        {links.map((link) => {
          const current = link.key === active;
          return (
            <Link
              key={link.key}
              href={link.href}
              aria-current={current ? "page" : undefined}
              onClick={(event) => onClick(event, link)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors [@media(max-height:760px)]:py-2 ${
                current
                  ? "bg-brand/20 text-white ring-1 ring-inset ring-brand/40"
                  : "text-rail-text hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icon name={link.icon} size={18} />
              {link.label}
              <PendingDot />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
