"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type MouseEvent } from "react";
import { Icon } from "@/components/icons";

const KEY = "ec:recorrido";
const LIMIT = 50;

function readTrail(): string[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeTrail(trail: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-LIMIT)));
  } catch {}
}

export function NavigationTrail() {
  const pathname = usePathname();
  useEffect(() => {
    const trail = readTrail();
    if (trail[trail.length - 1] === pathname) return;
    if (trail[trail.length - 2] === pathname) writeTrail(trail.slice(0, -1));
    else writeTrail([...trail, pathname]);
  }, [pathname]);
  return null;
}

export function BackLink({ fallback, label = "Volver" }: { fallback: string; label?: string }) {
  const router = useRouter();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    if (readTrail().length >= 2 && window.history.length > 1) {
      event.preventDefault();
      router.back();
    }
  }

  return (
    <Link
      href={fallback}
      onClick={onClick}
      className="flex w-fit items-center gap-1 rounded-md py-1 pr-2 text-sm font-medium text-soft hover:text-ink"
    >
      <Icon name="left" /> {label}
    </Link>
  );
}
