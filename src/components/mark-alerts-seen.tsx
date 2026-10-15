"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SEEN_COOKIE, mergeSeen, parseSeen } from "@/domain/alert-seen";

function readCookie(): string {
  const entry = document.cookie.split("; ").find((part) => part.startsWith(`${SEEN_COOKIE}=`));
  return entry ? decodeURIComponent(entry.slice(SEEN_COOKIE.length + 1)) : "";
}

export function MarkAlertsSeen({ keys }: { keys: string[] }) {
  const router = useRouter();
  const signature = keys.join(".");

  useEffect(() => {
    if (!signature) return;
    const list = signature.split(".");
    const current = readCookie();
    const seen = parseSeen(current);
    if (list.every((key) => seen.has(key))) return;
    const value = encodeURIComponent(mergeSeen(current, list));
    document.cookie = `${SEEN_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    router.refresh();
  }, [signature, router]);

  return null;
}
