"use client";

import { useEffect, useState } from "react";

export const NOTICE_EVENT = "calendar:notice";

export type NoticeDetail = { text: string; tone: "success" | "warning" };

export function announce(detail: NoticeDetail) {
  window.dispatchEvent(new CustomEvent<NoticeDetail>(NOTICE_EVENT, { detail }));
}

export function CalendarNotice() {
  const [notice, setNotice] = useState<NoticeDetail | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onNotice(event: Event) {
      setNotice((event as CustomEvent<NoticeDetail>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setNotice(null), 7000);
    }
    window.addEventListener(NOTICE_EVENT, onNotice);
    return () => {
      window.removeEventListener(NOTICE_EVENT, onNotice);
      clearTimeout(timer);
    };
  }, []);

  if (!notice) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <p
        role="status"
        className={`pointer-events-auto flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium shadow-lg ${
          notice.tone === "warning" ? "bg-warning text-white" : "bg-ink text-white"
        }`}
      >
        {notice.text}
        <button
          type="button"
          onClick={() => setNotice(null)}
          className="rounded px-2 py-0.5 text-xs font-semibold underline underline-offset-2"
        >
          Cerrar
        </button>
      </p>
    </div>
  );
}
